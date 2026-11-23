const FEEDS = [
  { source: "LowEndBox", url: "https://lowendbox.com/feed/", host: "lowendbox.com", region: "overseas" },
  { source: "LEB Black Friday", url: "https://lowendbox.com/tag/black-friday/feed/", host: "lowendbox.com", region: "overseas" },
  { source: "LowEndTalk Offers", url: "https://lowendtalk.com/categories/offers.rss", host: "lowendtalk.com", region: "overseas" },
  { source: "LowEndSpirit Offers", url: "https://lowendspirit.com/categories/offers.rss", host: "lowendspirit.com", region: "overseas" },
  { source: "RackNerd Blog", url: "https://blog.racknerd.com/feed/", host: "blog.racknerd.com", region: "overseas" },
  { source: "老左笔记", url: "https://www.laozuo.org/feed/", host: "laozuo.org", region: "china" },
  { source: "VPSGO", url: "https://www.vpsgo.com/feed", host: "vpsgo.com", region: "china" },
  { source: "VPS小学生", url: "https://www.vpsxxs.com/feed/", host: "vpsxxs.com", region: "china" },
  { source: "VPS侦探", url: "https://www.vpser.net/feed", host: "vpser.net", region: "china" }
];

const PROVIDER_PAGES = [
  { provider: "RackNerd", url: "https://www.racknerd.com/BlackFriday/?category=vps" },
  { provider: "CloudCone", url: "https://cloudcone.com/" },
  { provider: "阿里云", url: "https://www.aliyun.com/activity/ecs/99program" },
  { provider: "腾讯云", url: "https://cloud.tencent.com/act/pro/double11-xfzq" },
  { provider: "华为云", url: "https://activity.huaweicloud.com/" },
  { provider: "netcup", url: "https://www.netcup.com/en/deals/black-friday" },
  { provider: "Contabo", url: "https://contabo.com/en-us/black-friday/" },
  { provider: "HostDare", url: "https://hostdare.com/promo.html" },
  { provider: "Hetzner", url: "https://www.hetzner.com/cloud/" }
];

const INTERVAL_HOURS = 4;
const INTERVAL_MS = INTERVAL_HOURS * 3600 * 1000;
// Set INDEXNOW_KEY and SITE_HOST in wrangler.jsonc [vars] or Cloudflare Dashboard
const DEFAULT_HOST = "vps.xiaotianai.win";
const AI_MODELS = [
  "@cf/qwen/qwen2.5-coder-32b-instruct",
  "@cf/meta/llama-3.3-70b-instruct-fp8-fast"
];

function escHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, x => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[x]));
}

function formatCnDate(iso) {
  if (!iso) return "日期未确认";
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return "日期未确认";
  const d = new Date(ts + 8 * 3600 * 1000);
  return `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${String(d.getUTCDate()).padStart(2, "0")}`;
}

function formatCnDateTime(iso) {
  if (!iso) return "";
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return "";
  const d = new Date(ts + 8 * 3600 * 1000);
  return `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${String(d.getUTCDate()).padStart(2, "0")} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

async function runWorkersAiJson(env, systemPrompt, userPrompt, maxTokens = 900) {
  if (!env.AI) return null;
  for (const model of AI_MODELS) {
    try {
      const res = await env.AI.run(model, {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        max_tokens: maxTokens,
        temperature: 0.2
      });
      let raw = res?.response ?? res?.choices?.[0]?.message?.content ?? "";
      if (typeof raw === "object" && raw !== null) return { model, data: raw };
      const str = String(raw).trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
      const firstObj = str.indexOf("{");
      const firstArr = str.indexOf("[");
      let start = -1;
      if (firstObj >= 0 && firstArr >= 0) start = Math.min(firstObj, firstArr);
      else start = Math.max(firstObj, firstArr);
      if (start < 0) continue;
      const endChar = str[start] === "[" ? "]" : "}";
      const end = str.lastIndexOf(endChar);
      if (end <= start) continue;
      const parsed = JSON.parse(str.slice(start, end + 1));
      return { model, data: parsed };
    } catch {}
  }
  return null;
}

async function enrichLeadsWithAi(env, items) {
  let cache = {};
  try {
    const raw = await env.SITE_KV.get("dynamic:ai_cache");
    if (raw) cache = JSON.parse(raw);
  } catch {}

  const nowMs = Date.now();
  const cutoff = nowMs - 14 * 86400 * 1000;
  for (const k of Object.keys(cache)) {
    if (!cache[k] || (cache[k].ts && cache[k].ts < cutoff)) delete cache[k];
  }

  const needTranslate = items
    .filter(x => !cache[x.url] && /[A-Za-z]{4,}/.test(x.title || ""))
    .slice(0, 12);

  let usedModel = null;
  let cacheDirty = false;

  if (needTranslate.length && env.AI) {
    const inputList = needTranslate.map((x, i) => ({ i, source: x.source, title: x.title }));
    const sys = "你是严谨的VPS选购编辑。只输出合法JSON数组，不加Markdown代码块，不编造标题里没有的价格或续费承诺。";
    const usr = `为以下VPS公开线索生成JSON数组，每项格式 {"i":序号,"zh":"忠实原文的简明中文标题(<=34字)","tag":"极短客观标签(<=10字,如黑五4GB/年付促销/机房上新)","tip":"一句客观核验提醒(<=20字,如核实续费价与机房线路)"}：\n${JSON.stringify(inputList)}`;
    const out = await runWorkersAiJson(env, sys, usr, 1100);
    if (out && Array.isArray(out.data)) {
      usedModel = out.model;
      for (const row of out.data) {
        const target = needTranslate[Number(row?.i)];
        if (!target || !row?.zh) continue;
        cache[target.url] = {
          zh: String(row.zh).slice(0, 80),
          tag: String(row.tag || "").slice(0, 24),
          tip: String(row.tip || "请打开原文核实价格、续费与库存").slice(0, 48),
          ts: nowMs
        };
        cacheDirty = true;
      }
    }
  }

  const enriched = items.map(item => {
    const hit = cache[item.url];
    if (!hit) return item;
    return { ...item, ai: { zh: hit.zh, tag: hit.tag, tip: hit.tip } };
  });

  if (cacheDirty) {
    await env.SITE_KV.put("dynamic:ai_cache", JSON.stringify(cache));
  }

  const translatedCount = enriched.filter(x => x.ai && x.ai.zh).length;
  const topForBrief = enriched.slice(0, 10).map((x, i) => ({
    i,
    source: x.source,
    title: x.ai?.zh || x.title,
    promo: !!x.is_promo
  }));

  let summary = `本轮共从 9 个国内外公开源聚合 ${enriched.length} 条最新 VPS 线索（含 ${enriched.filter(x => x.is_promo).length} 条促销关键词线索，已自动中文化 ${translatedCount} 条海外标题）。请重点对比三年总成本、是否循环同价续费及硬盘类型。`;
  if (env.AI && topForBrief.length) {
    const bOut = await runWorkersAiJson(
      env,
      "你是严谨克制的VPS资讯编辑。仅返回纯JSON对象，不要编造任何未给出的报价或库存。",
      `根据以下最新公开线索，用2句简明中文总结本轮黑五/VPS动态与避坑关注点，返回 {"summary":"60-110字中文总结"}：\n${JSON.stringify(topForBrief)}`,
      260
    );
    if (bOut?.data?.summary) {
      usedModel = usedModel || bOut.model;
      summary = String(bOut.data.summary).slice(0, 220);
    }
  }

  const highlights = enriched
    .filter(x => x.is_promo || x.ai?.zh)
    .slice(0, 5)
    .map(x => ({
      source: x.source,
      title: x.title,
      zh: x.ai?.zh || x.title,
      tip: x.ai?.tip || "",
      url: x.url
    }));

  return {
    items: enriched,
    ai_brief: {
      generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
      model: usedModel || "cache",
      translated_count: translatedCount,
      summary,
      highlights
    }
  };
}

async function pingIndexNow(env, urls) {
  const key = env?.INDEXNOW_KEY || "";
  const host = env?.SITE_HOST || DEFAULT_HOST;
  if (!key) return;
  try {
    await fetchWithTimeout("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host,
        key,
        keyLocation: `https://${host}/${key}.txt`,
        urlList: urls
      })
    }, 6000);
  } catch {}
}

function renderSsrSnippets(leads) {
  if (!leads || !Array.isArray(leads.items)) return { briefHtml: "", leadsHtml: "" };
  const brief = leads.ai_brief;
  let briefHtml = "";
  if (brief && brief.summary) {
    const ts = formatCnDateTime(brief.generated_at);
    const listHtml = Array.isArray(brief.highlights) && brief.highlights.length
      ? `<ul class="ai-brief-list">${brief.highlights.slice(0, 5).map(h => `<li><strong>${escHtml(h.source || "线索")}</strong>：${escHtml(h.zh || h.title || "")}${h.tip ? " — " + escHtml(h.tip) : ""} <a href="${escHtml(h.url || "#leads")}" target="_blank" rel="noopener noreferrer nofollow">原文 ↗</a></li>`).join("")}</ul>`
      : "";
    briefHtml = `<div class="ai-brief-head"><span class="ai-brief-badge">✦ AI 每 4 小时线索速读</span><span class="ai-brief-meta">${escHtml(ts ? ts + "（北京时间）" : "")}${brief.translated_count ? " · 已自动中文化 " + escHtml(brief.translated_count) + " 条线索" : ""} · 仅供参考，以官网结算为准</span></div><p class="ai-brief-summary">${escHtml(brief.summary)}</p>${listHtml}`;
  }
  const leadsHtml = leads.items.slice(0, 12).map(x => {
    const ai = x.ai || null;
    const badgeHtml = (ai?.tag ? `<span class="lead-ai-tag">${escHtml(ai.tag)}</span>` : "") + (x.is_promo ? '<span class="promo-badge">促销线索</span>' : "");
    const zhHtml = ai?.zh && ai.zh !== x.title ? `<div class="lead-zh">中文简译：${escHtml(ai.zh)}</div>` : "";
    const tipHtml = ai?.tip ? `<p class="lead-tip">核验提醒：${escHtml(ai.tip)}</p>` : "<p>第三方公开 RSS 标题线索；请打开原文核实价格、续费规则与库存。</p>";
    return `<article class="watch-card"><div class="lead-meta-row"><span class="watch-provider">${escHtml(x.source)}</span><div style="display:flex;gap:6px;flex-wrap:wrap">${badgeHtml}</div></div><h3>${escHtml(x.title)}</h3>${zhHtml}<span class="watch-status">未核验 / ${escHtml(formatCnDate(x.published))}</span>${tipHtml}<a href="${escHtml(x.url)}" target="_blank" rel="noopener noreferrer nofollow">查看原始帖子 ↗</a></article>`;
  }).join("");
  return { briefHtml, leadsHtml };
}

const KEYWORDS = [
  "vps", "hosting", "host", "server", "ram", "kvm", "black friday", "cyber monday",
  "discount", "deal", "offer", "cloud", "nvme", "dedicated", "ssd", "promo", "bf",
  "服务器", "云主机", "云服务器", "优惠", "双十一", "黑五", "阿里云", "腾讯云", "华为云", "轻量", "云厂商", "主机", "秒杀", "续费", "促销"
];

const PROMO_KEYWORDS = [
  "black friday", "cyber monday", "黑五", "促销", "特价", "秒杀", "优惠", "折扣", "deal", "offer", "promo", "discount", "双十一", "双11"
];

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".ico": "image/x-icon"
};

const BINARY_EXTS = new Set([".png", ".webp", ".ico", ".jpg", ".jpeg"]);

function getExt(path) {
  const idx = path.lastIndexOf(".");
  return idx >= 0 ? path.slice(idx).toLowerCase() : "";
}

function decodeEntities(str) {
  return String(str || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTag(block, tag) {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = block.match(re);
  return m ? decodeEntities(m[1]) : "";
}

function extractLink(block) {
  const plain = extractTag(block, "link");
  if (plain && plain.startsWith("http")) return plain;
  const m = block.match(/<link[^>]+href=["']([^"']+)["'][^>]*>/i);
  return m ? decodeEntities(m[1]) : "";
}

function parseDate(raw) {
  if (!raw) return null;
  const ts = Date.parse(raw);
  if (Number.isNaN(ts)) return null;
  return new Date(ts).toISOString().replace(/\.\d{3}Z$/, "Z");
}

function nextSlotIso(now = new Date()) {
  const nextHour = Math.floor(now.getUTCHours() / INTERVAL_HOURS + 1) * INTERVAL_HOURS;
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), nextHour, 0, 0));
  return next.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function parseFeedXml(xml, feed) {
  const items = [];
  const blocks = xml.match(/<(item|entry)(?:\s[^>]*)?>[\s\S]*?<\/\1>/gi) || [];
  for (const block of blocks) {
    const title = extractTag(block, "title").slice(0, 240);
    const url = extractLink(block);
    if (!title || !url) continue;
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch {
      continue;
    }
    const host = parsedUrl.hostname.toLowerCase();
    if (parsedUrl.protocol !== "https:" || !(host === feed.host || host === "www." + feed.host)) continue;
    const lower = title.toLowerCase();
    if (!KEYWORDS.some(k => lower.includes(k))) continue;
    const dateRaw = extractTag(block, "pubDate") || extractTag(block, "published") || extractTag(block, "updated") || extractTag(block, "dc:date");
    const is_promo = feed.source === "LEB Black Friday" || PROMO_KEYWORDS.some(k => lower.includes(k));
    items.push({
      source: feed.source,
      region: feed.region,
      is_promo,
      title,
      url: parsedUrl.toString(),
      published: parseDate(dateRaw)
    });
    if (items.length >= 25) break;
  }
  return items;
}

async function fetchWithTimeout(url, init = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function refreshLeads(env) {
  let existing = [];
  try {
    const prevRaw = await env.SITE_KV.get("dynamic:leads");
    if (prevRaw) {
      const prev = JSON.parse(prevRaw);
      if (Array.isArray(prev.items)) existing = prev.items;
    }
  } catch {}

  const results = await Promise.all(
    FEEDS.map(async (feed) => {
      try {
        const res = await fetchWithTimeout(feed.url, {
          headers: {
            "User-Agent": "VPSRadarHeadlines/1.6 (+https://vps.xiaotianai.win; public RSS; 4h schedule)",
            "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml"
          }
        }, 12000);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        const parsed = parseFeedXml(text, feed);
        if (!parsed.length) throw new Error("empty feed");
        return { ok: true, source: feed.source, items: parsed };
      } catch (err) {
        return {
          ok: false,
          source: feed.source,
          error: `${feed.source}: ${err?.message || String(err)}`,
          items: existing.filter(x => x.source === feed.source)
        };
      }
    })
  );

  const successes = results.filter(r => r.ok).map(r => r.source);
  const failures = results.filter(r => !r.ok).map(r => r.error);
  if (!successes.length) return { updated: false, failures };

  const dedup = new Map();
  for (const r of results) {
    for (const item of r.items) {
      if (!dedup.has(item.url)) dedup.set(item.url, item);
    }
  }
  const sortedItems = Array.from(dedup.values())
    .sort((a, b) => (b.published || "").localeCompare(a.published || ""))
    .slice(0, 60);

  const prevUrls = new Set(existing.map(x => x.url));
  const hasNewLead = sortedItems.some(x => !prevUrls.has(x.url));
  const aiOut = await enrichLeadsWithAi(env, sortedItems);

  const now = new Date();
  const payload = {
    updated_at: now.toISOString().replace(/\.\d{3}Z$/, "Z"),
    next_refresh_at: nextSlotIso(now),
    interval_hours: INTERVAL_HOURS,
    engine: "cloudflare-workers-cron-4h-ai",
    sources: FEEDS.map(f => f.source),
    successful_sources: successes,
    failed_sources: failures,
    notice: "仅为公开来源标题线索，AI 中文简译与核验提醒仅供参考，未经官方价格与库存核验。",
    ai_brief: aiOut.ai_brief,
    items: aiOut.items
  };
  await env.SITE_KV.put("dynamic:leads", JSON.stringify(payload));
  if (hasNewLead) {
    await pingIndexNow(env, [`https://${env?.SITE_HOST || DEFAULT_HOST}/`]);
  }
  return { updated: true, count: aiOut.items.length, successes, failures, payload };
}

async function refreshLiveStatus(env) {
  let prev = {};
  try {
    const raw = await env.SITE_KV.get("dynamic:live_status");
    if (raw) prev = JSON.parse(raw);
  } catch {}

  let fx = prev.fx || { usd_cny: 7.2, updated_at: null, source: "fallback" };
  try {
    const res = await fetchWithTimeout("https://open.er-api.com/v6/latest/USD", {
      headers: { "User-Agent": "VPSRadar/1.6 (+https://vps.xiaotianai.win)" }
    }, 8000);
    if (res.ok) {
      const data = await res.json();
      const rate = Number(data?.rates?.CNY);
      if (Number.isFinite(rate) && rate > 3 && rate < 15) {
        fx = {
          usd_cny: Number(rate.toFixed(4)),
          updated_at: parseDate(data.time_last_update_utc) || new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
          source: "open.er-api.com"
        };
      }
    }
  } catch {}

  const checks = await Promise.all(
    PROVIDER_PAGES.map(async (item) => {
      try {
        const res = await fetchWithTimeout(item.url, {
          method: "HEAD",
          redirect: "manual",
          headers: { "User-Agent": "Mozilla/5.0 (compatible; VPSRadarHealth/1.6; +https://vps.xiaotianai.win)" }
        }, 7000);
        const reachable = res.status >= 200 && res.status < 400;
        return { provider: item.provider, status: res.status, reachable };
      } catch {
        return { provider: item.provider, status: 0, reachable: false };
      }
    })
  );

  const now = new Date();
  const payload = {
    checked_at: now.toISOString().replace(/\.\d{3}Z$/, "Z"),
    next_refresh_at: nextSlotIso(now),
    interval_hours: INTERVAL_HOURS,
    fx,
    providers: checks
  };
  await env.SITE_KV.put("dynamic:live_status", JSON.stringify(payload));
  return payload;
}

async function refreshAll(env) {
  const [leads, status] = await Promise.all([refreshLeads(env), refreshLiveStatus(env)]);
  return { leads, status };
}

function securityHeaders(extra = {}) {
  return {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "SAMEORIGIN",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    ...extra
  };
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", { status: 405, headers: securityHeaders() });
    }

    if (path === "/index.html") {
      return Response.redirect(new URL("/", url.origin).toString(), 301);
    }

    const indexNowKey = env?.INDEXNOW_KEY || "";
    if (indexNowKey && path === `/${indexNowKey}.txt`) {
      return new Response(request.method === "HEAD" ? null : indexNowKey, {
        status: 200,
        headers: securityHeaders({
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "public, max-age=86400"
        })
      });
    }

    if (path === "/api/leads") {
      let body = await env.SITE_KV.get("dynamic:leads");
      if (!body) {
        const fresh = await refreshLeads(env);
        if (fresh?.payload) body = JSON.stringify(fresh.payload);
      }
      if (!body) body = await env.SITE_KV.get("static:/data/leads.json");
      if (!body) body = JSON.stringify({ updated_at: null, interval_hours: INTERVAL_HOURS, sources: [], items: [] });
      try {
        const parsed = JSON.parse(body);
        const ts = parsed.updated_at ? Date.parse(parsed.updated_at) : 0;
        if (!ts || Date.now() - ts > INTERVAL_MS + 300000) {
          ctx.waitUntil(refreshAll(env));
        }
      } catch {}
      return new Response(request.method === "HEAD" ? null : body, {
        status: 200,
        headers: securityHeaders({
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "public, max-age=180, s-maxage=180",
          "Access-Control-Allow-Origin": "*"
        })
      });
    }

    if (path === "/api/live-status") {
      let body = await env.SITE_KV.get("dynamic:live_status");
      if (!body) {
        const generated = await refreshLiveStatus(env);
        body = JSON.stringify(generated);
      } else {
        try {
          const parsed = JSON.parse(body);
          const ts = parsed.checked_at ? Date.parse(parsed.checked_at) : 0;
          if (!ts || Date.now() - ts > INTERVAL_MS + 300000) {
            ctx.waitUntil(refreshLiveStatus(env));
          }
        } catch {}
      }
      return new Response(request.method === "HEAD" ? null : body, {
        status: 200,
        headers: securityHeaders({
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "public, max-age=300, s-maxage=300",
          "Access-Control-Allow-Origin": "*"
        })
      });
    }

    const cache = caches.default;
    const cacheKey = new Request(url.toString(), { method: "GET" });
    if (request.method === "GET") {
      const cached = await cache.match(cacheKey);
      if (cached) return cached;
    }

    let assetPath = path;
    if (assetPath === "/" || assetPath === "") assetPath = "/index.html";
    else if (assetPath.endsWith("/")) assetPath += "index.html";

    const kvKey = `static:${assetPath}`;
    const ext = getExt(assetPath);
    const isBinary = BINARY_EXTS.has(ext);
    let content = await env.SITE_KV.get(kvKey, isBinary ? "arrayBuffer" : "text");

    if (content === null) {
      const notFoundHtml = await env.SITE_KV.get("static:/404.html", "text");
      return new Response(
        request.method === "HEAD" ? null : (notFoundHtml || "404 Not Found"),
        {
          status: 404,
          headers: securityHeaders({
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store"
          })
        }
      );
    }

    // SSR inject latest AI brief & top 12 translated leads into homepage HTML for zero-JS SEO & GEO crawlers
    if (assetPath === "/index.html" && typeof content === "string") {
      try {
        const rawLeads = await env.SITE_KV.get("dynamic:leads");
        if (rawLeads) {
          const parsedLeads = JSON.parse(rawLeads);
          const { briefHtml, leadsHtml } = renderSsrSnippets(parsedLeads);
          if (briefHtml) content = content.replace("<!--SSR_AI_BRIEF-->", briefHtml);
          if (leadsHtml) content = content.replace("<!--SSR_LEADS-->", leadsHtml);
        }
      } catch {}
    }

    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    const cacheControl = isBinary || ext === ".css" || ext === ".js" || ext === ".svg"
      ? "public, max-age=604800, s-maxage=604800"
      : "public, max-age=180, s-maxage=180";

    const response = new Response(request.method === "HEAD" ? null : content, {
      status: 200,
      headers: securityHeaders({
        "Content-Type": contentType,
        "Cache-Control": cacheControl
      })
    });

    if (request.method === "GET") {
      ctx.waitUntil(cache.put(cacheKey, response.clone()));
    }
    return response;
  },

  async scheduled(controller, env, ctx) {
    ctx.waitUntil(refreshAll(env));
  }
};
