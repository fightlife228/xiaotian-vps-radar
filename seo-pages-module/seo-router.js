// seo-router.js
// 挂载到现有 V2.0 Cloudflare Workers 的多页 SEO/GEO 路由器
// 样式与日/夜双主题完全对齐线上 /assets/site.css 与 /assets/theme.js

import { SITE_META, AFF_LINKS, VERIFIED_DEALS, PAYMENT_METHODS, SEO_ROUTES, EXISTING_STATIC_ROUTES } from "./seo-data.js";

function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmtPrice(deal) {
  const sym = deal.currency === "CNY" ? "¥" : "$";
  return `${sym}${deal.first_year_price}/年`;
}

function fmtThreeYear(deal) {
  if (deal.three_year_total == null) return "待核实（勿按首年×3）";
  const sym = deal.currency === "CNY" ? "¥" : "$";
  return `${sym}${deal.three_year_total}`;
}

function getAff(affKey) {
  return AFF_LINKS[affKey] || { url: SITE_META.siteUrl, sponsored: false };
}

function renderLayout({ path, title, description, directAnswer, bodyHtml, jsonLdObjects = [] }) {
  const canonical = `${SITE_META.siteUrl}${path}`;
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: SITE_META.siteName, item: SITE_META.siteUrl },
      { "@type": "ListItem", position: 2, name: title, item: canonical },
    ],
  };
  const allLd = [breadcrumbLd, ...jsonLdObjects]
    .map((obj) => `<script type="application/ld+json">${JSON.stringify(obj)}</script>`)
    .join("\n  ");

  const relatedCards = SEO_ROUTES.map(
    (r) => `<a href="${r.path}"><strong>${esc(r.short)}</strong><br><span style="font-size:12px;color:var(--muted)">${esc(r.title)}</span></a>`
  ).join("");

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="color-scheme" content="light dark" />
  <title>${esc(title)}｜${esc(SITE_META.siteName)}</title>
  <meta name="description" content="${esc(description)}" />
  <link rel="canonical" href="${esc(canonical)}" />
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="${esc(SITE_META.siteName)}" />
  <meta property="og:locale" content="zh_CN" />
  <meta property="og:title" content="${esc(title)}｜${esc(SITE_META.siteName)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:url" content="${esc(canonical)}" />
  <meta property="og:image" content="${SITE_META.siteUrl}/assets/og-cover.png" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:image" content="${SITE_META.siteUrl}/assets/og-cover.png" />
  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  <script src="/assets/theme.js?v=20"></script>
  <link rel="stylesheet" href="/assets/site.css?v=22" />
  ${allLd}
</head>
<body>
  <header class="topbar">
    <div class="shell nav-inner">
      <a class="brand" href="/"><span class="brand-mark">✳</span><span>小天 <b>VPS RADAR</b></span></a>
      <nav class="nav-links" aria-label="专题导航">
        <a href="/">首页雷达</a>
        <a href="/black-friday" class="${path === "/black-friday" ? "active" : ""}">黑五专题</a>
        <a href="/guide/ai-agent-vps" class="${path === "/guide/ai-agent-vps" ? "active" : ""}">AI Agent</a>
        <a href="/guide/alipay-vps" class="${path === "/guide/alipay-vps" ? "active" : ""}">支付宝VPS</a>
        <a href="/guide/china-cloud-renewal" class="${path === "/guide/china-cloud-renewal" ? "active" : ""}">国内云续费</a>
        <a href="/vs/racknerd-vs-cloudcone" class="${path === "/vs/racknerd-vs-cloudcone" ? "active" : ""}">RN vs CC</a>
        <a href="/vs/aliyun-vs-tencent" class="${path === "/vs/aliyun-vs-tencent" ? "active" : ""}">阿里 vs 腾讯</a>
        <a href="/table.html">参数总表</a>
      </nav>
      <div class="nav-actions">
        <a class="github-btn" href="${SITE_META.githubUrl}" target="_blank" rel="noopener noreferrer" aria-label="GitHub 开源仓库">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
          <span>GitHub</span>
        </a>
        <button type="button" class="theme-toggle" data-theme-toggle aria-label="切换主题">🌙</button>
      </div>
    </div>
  </header>

  <main>
    <div class="shell guide-hero">
      <div class="section-kicker"><a href="/">首页雷达</a> / ${esc(SEO_ROUTES.find(r => r.path === path)?.short || "专题")}</div>
      <h1>${esc(title)}</h1>
      <p class="seo-fineprint mono">数据核验快照：${esc(SITE_META.snapshotDate)} · 人民币与美元分币种核对 · 拒绝虚标续费价</p>
      <div class="guide-tip"><strong>直接回答（TL;DR）：</strong>${esc(directAnswer)}</div>
    </div>

    <div class="shell guide-article" style="max-width:1080px;padding-bottom:24px;">
      ${bodyHtml}
      <section style="margin-top:32px;padding-top:20px;border-top:1px solid var(--border);">
        <h2>继续对比其他 SEO / GEO 专题</h2>
        <div class="related-links">${relatedCards}</div>
      </section>
    </div>
  </main>

  <footer class="footer shell">
    <div>
      <a class="brand" href="/"><span class="brand-mark">✳</span><span>小天 <b>VPS RADAR</b></span></a>
      <p>${esc(SITE_META.disclosure)}</p>
    </div>
    <div class="foot-right">
      <span>
        <a href="/">返回 4H 自动雷达首页</a> ·
        <a href="/table.html">完整参数总表</a> ·
        <a href="/sitemap.xml">Sitemap</a> ·
        <a href="/llms.txt">LLMs.txt</a> ·
        <a href="/about.html">核验原则</a>
      </span>
      <span class="mono">© 2026 ${esc(SITE_META.siteName)} · SSR SEO/GEO Engine</span>
    </div>
  </footer>
  <script src="/assets/wechat-widget.js?v=1" defer></script>
</body>
</html>`;
}

function renderDealsTable(deals) {
  const rows = deals
    .map((d) => {
      const aff = getAff(d.aff_key);
      const badge = d.renewal_verified
        ? `<span class="payment-status pay-yes">已核实</span>`
        : `<span class="payment-status pay-verify">待核实</span>`;
      const rel = aff.sponsored ? "noopener noreferrer sponsored" : "noopener noreferrer nofollow";
      const btnText = aff.sponsored ? "推广直达 ↗" : "直达官网 ↗";
      return `<tr>
        <td><strong>${esc(d.provider)}</strong><div class="payment-detail">${esc(d.plan_name)}</div></td>
        <td class="mono">${d.vcpu}C / ${d.ram_gb}GB<div class="payment-detail">${esc(d.storage)}</div></td>
        <td class="mono"><strong>${esc(fmtPrice(d))}</strong></td>
        <td>${badge}<div class="payment-detail">${esc(d.renewal_policy)}</div></td>
        <td class="mono">${esc(fmtThreeYear(d))}</td>
        <td>${esc(d.alipay)}</td>
        <td><a href="${esc(d.source_url)}" target="_blank" rel="noopener noreferrer" style="margin-right:8px;color:var(--muted)">核验源</a> <a href="${esc(aff.url)}" target="_blank" rel="${rel}">${btnText}</a></td>
      </tr>`;
    })
    .join("");

  return `<div class="payment-table-wrap"><table class="data-table">
    <thead><tr><th>商家 / 套餐</th><th>配置</th><th>首年价格</th><th>续费条款</th><th>三年账面总价</th><th>支付宝</th><th>核验与入口</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}

function pageBlackFriday() {
  const faqs = [
    {
      q: "2026 黑五买 VPS，续费一定会涨价吗？",
      a: "不一定。像 RackNerd 2026 黑五 KVM 套餐在官方活动页明确声明为循环同价续费（4GB 内存 $47.98/年，三年账面 $143.94）；而部分首年特价或新客秒杀（如华为云 36 元秒杀）续费可能恢复原价，CloudCone 预热码 PREBF26 已于 11-20 截止，下单前务必看清结算页续费金额。",
    },
    {
      q: "没有外币信用卡和 PayPal，黑五能买海外 VPS 吗？",
      a: "可以。RackNerd、CloudCone（通过充值 Cloud Credits）、GreenCloudVPS 和 HostDare 均已在官方渠道确认支持支付宝付款；注意支付宝扫码仍按美元标价实时换算汇率。",
    },
    {
      q: "看到 $24.99/年 8GB 大内存 VPS 能直接冲吗？",
      a: "先看硬盘和 CPU。例如 DediRock High-RAM Core 8GB 虽然年付只要 $24.99，但配的是 1 vCPU + 20GB HDD 机械硬盘，仅适合低 I/O 缓存或内存型轻任务，不适合承载高频写入数据库或多任务 AI Agent。",
    },
  ];
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };

  const bodyHtml = `
    <h2>已核验 2026 黑五与国内云精选榜（共 ${VERIFIED_DEALS.length} 条记录）</h2>
    ${renderDealsTable(VERIFIED_DEALS)}
    <h2>黑五下单前必查的 4 条避坑原则</h2>
    <div class="seo-card-grid">
      <div class="seo-card"><h3>01. 先算三年总账单</h3><p>首年 $47.98 若次年涨到 $89.99，三年总价直接飙到 $227.96；优先锁定明确写明“循环同价续费”的套餐。</p></div>
      <div class="seo-card"><h3>02. 看清 HDD ≠ SSD</h3><p>低价大内存神车常配 HDD 慢盘与单核 CPU，用来跑数据库或 Docker 编译会严重卡顿。</p></div>
      <div class="seo-card"><h3>03. 区分人民币定价与支付宝扫码</h3><p>海外 VPS 支持支付宝不等于人民币定价，结算受实时汇率影响，且次年通常需手动续费。</p></div>
      <div class="seo-card"><h3>04. 国内节点必须考虑 ICP 备案</h3><p>阿里云、腾讯云、华为云内地节点对外公开建站需实名与 ICP 备案，且要看清是固定带宽还是月流量包。</p></div>
    </div>
    <h2>黑五常见问题</h2>
    <div class="faq">${faqs.map((f) => `<details open style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:12px 16px;margin-bottom:10px;"><summary style="cursor:pointer;font-weight:700;color:var(--ink)">${esc(f.q)}</summary><p style="margin:8px 0 0">${esc(f.a)}</p></details>`).join("")}</div>
  `;

  return renderLayout({
    path: "/black-friday",
    title: "2026 黑五 VPS 优惠实时榜与续费避坑",
    description: "2026 黑五海外 VPS 与国内云官方核验优惠汇总：RackNerd 4GB/6GB/8GB 循环同价、阿里云 99 计划、腾讯云 199 轻量对比，逐条标注续费条款与支付宝支持。",
    directAnswer: `截至 ${SITE_META.snapshotDate}，海外长期自用首选 RackNerd 2026 黑五 KVM（1GB $15.98/年、4GB $47.98/年，循环同价且支持支付宝）；国内长期入门看阿里云 99 计划（¥99/年锁价至 2029 年）或腾讯云 4GB（¥199/年，限同价续费1次）。`,
    bodyHtml,
    jsonLdObjects: [faqLd],
  });
}

function pageAiAgentVps() {
  const aiDeals = VERIFIED_DEALS.filter((d) => d.ram_gb >= 4);
  const bodyHtml = `
    <h2>4GB 以上大内存方案实测筛选（含 SSD 与 HDD 避坑标注）</h2>
    ${renderDealsTable(aiDeals)}
    <h2>不同 AI Agent 场景该买什么配置？</h2>
    <div class="seo-card-grid">
      <div class="seo-card"><h3>轻量调度 / 定时脚本 / Webhook</h3><p>推荐 <strong>4GB RAM + SSD</strong>（如 RackNerd 4GB $47.98/年 或 腾讯云 4GB ¥199/年）。足以运行 Node.js/Python Agent、定时爬虫与轻量队列。</p></div>
      <div class="seo-card"><h3>多容器 / 浏览器自动化 / 个人知识库</h3><p>推荐 <strong>6GB–8GB RAM + 多核 + SSD</strong>（如 RackNerd 6GB $74.98/年 或 8GB $94.98/年）。Headless Chrome 与多个 Docker 容器极吃内存，4GB 容易 OOM。</p></div>
      <div class="seo-card"><h3>警惕：廉价大内存 HDD 陷阱</h3><p>DediRock 8GB ($24.99/年) / 16GB ($59.99/年) 仅配 1 vCPU + HDD 硬盘，适合静态缓存，<strong>不建议</strong>跑频繁读写 SQLite/Postgres 的 Agent 服务。</p></div>
      <div class="seo-card"><h3>高风险免费容器提醒</h3><p>Discord 免绑卡免费面板（如 Nodaroo / Altare）无独立内核权限且无 SLA，仅适合临时测试 Bot，禁止存放 Agent 密钥与生产库（详情见首页白嫖实验区）。</p></div>
    </div>
  `;
  return renderLayout({
    path: "/guide/ai-agent-vps",
    title: "2026 跑 AI Agent 要买多少内存？4GB/8GB 与 SSD/HDD 选购指南",
    description: "对比 4GB、6GB、8GB、16GB VPS 在部署 AI Agent、Docker 多容器和无头浏览器时的真实门槛，附 SSD vs HDD 避坑清单与三年成本。",
    directAnswer: "跑 API 调用型 AI Agent（无需本地大模型推理）建议 4GB 内存 + SSD 起步；若同时运行 Docker 多容器或无头浏览器，直接上 6GB–8GB SSD（例如 RackNerd 黑五 4GB $47.98/年或 8GB $94.98/年，循环续费同价）。避开 1 核 + HDD 的纯大内存机型。",
    bodyHtml,
  });
}

function pageAlipayVps() {
  const rows = PAYMENT_METHODS.map(
    (p) => `<tr>
      <td><strong>${esc(p.provider)}</strong></td>
      <td>${esc(p.region)}</td>
      <td>${p.alipay.includes("已确认") ? `<span class="payment-status pay-yes">${esc(p.alipay)}</span>` : `<span class="payment-status pay-verify">${esc(p.alipay)}</span>`}</td>
      <td>${p.wechat_pay.includes("已确认") ? `<span class="payment-status pay-yes">${esc(p.wechat_pay)}</span>` : `<span class="payment-status pay-unknown">${esc(p.wechat_pay)}</span>`}</td>
      <td>${esc(p.unionpay)}</td>
      <td class="mono">${esc(p.currency)}</td>
      <td><div class="payment-detail">${esc(p.notes)}</div></td>
    </tr>`
  ).join("");

  const bodyHtml = `
    <h2>12 家国内外云商支付方式核验表</h2>
    <div class="payment-table-wrap"><table class="data-table">
      <thead><tr><th>服务商</th><th>类型</th><th>支付宝</th><th>微信支付</th><th>银联</th><th>账单币种</th><th>核验说明</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    <h2>已确认支持支付宝的在售精选</h2>
    ${renderDealsTable(VERIFIED_DEALS.filter((d) => d.alipay.includes("已确认")))}
  `;
  return renderLayout({
    path: "/guide/alipay-vps",
    title: "2026 支持支付宝与微信支付的海外 VPS 与国内云核验清单",
    description: "逐条核对 12 家国内外 VPS 与云厂商是否支持支付宝、微信支付与银联，区分美元标价与人民币定价，避免结账失败或汇率坑。",
    directAnswer: "目前官网公开确认支持支付宝的海外 VPS 包括 RackNerd、CloudCone（充值余额）、GreenCloudVPS 和 HostDare；Hetzner、netcup、Contabo 官网未列出支付宝。国内云中，阿里云和华为云确认支持支付宝，腾讯云中国站主推微信支付。",
    bodyHtml,
  });
}

function pageChinaCloudRenewal() {
  const cnDeals = VERIFIED_DEALS.filter((d) => d.region_type === "china_cloud");
  const bodyHtml = `
    <h2>国内云御三家核心低价套餐对比</h2>
    ${renderDealsTable(cnDeals)}
    <h2>选国内云必须盯紧的 3 个条款</h2>
    <div class="seo-card-grid">
      <div class="seo-card"><h3>同价续费次数不同</h3><p>阿里云 99 计划写明活动规则锁价至 2029-03-31；腾讯云 199 专区明确限同价续费 1 次；华为云 36 元为新客秒杀，次年续费未知。</p></div>
      <div class="seo-card"><h3>固定带宽 vs 峰值流量包</h3><p>阿里云 99 计划给的是 3M 固定带宽不限流量；腾讯云给 6M 峰值 + 600GB/月流量包；华为云 36 元仅 100GB/月，超额需核查计费。</p></div>
      <div class="seo-card"><h3>实名与 ICP 备案</h3><p>中国内地节点绑定域名对外提供 Web 服务必须走 ICP 备案；如用于海外业务或免备案测试，建议选海外 VPS。</p></div>
    </div>
  `;
  return renderLayout({
    path: "/guide/china-cloud-renewal",
    title: "国内云御三家（阿里云/腾讯云/华为云）续费同价规则与三年账单对比",
    description: "拆解阿里云 99 计划、腾讯云 199 轻量应用服务器、华为云 36 元 Flexus L 的续费次数限制、带宽流量差异与 ICP 备案要求。",
    directAnswer: "长期持有最稳的是阿里云 ECS 99 计划（¥99/年，2C2G 3M 固定带宽，按规则可续费至 2029 年，三年 ¥297）；短期需要 4GB 内存选腾讯云 199（但仅限同价续费 1 次，两年 ¥398，第三年需重新规划）；华为云 ¥36/年仅适合首年尝鲜。",
    bodyHtml,
  });
}

function pageVsRnCc() {
  const deals = VERIFIED_DEALS.filter((d) => d.provider === "RackNerd" || d.provider === "CloudCone");
  const bodyHtml = `
    <h2>核心参数与条款横评</h2>
    <div class="payment-table-wrap"><table class="data-table">
      <thead><tr><th>对比维度</th><th>RackNerd（2026 黑五 KVM）</th><th>CloudCone（预热回顾 / 正式黑五）</th></tr></thead>
      <tbody>
        <tr><td><strong>入门门槛</strong></td><td>1GB 内存 $15.98/年；4GB 内存 $47.98/年</td><td>1GB 预热历史参考 $24.00/年（PREBF26 已过期）</td></tr>
        <tr><td><strong>续费透明度</strong></td><td><span class="payment-status pay-yes">官方声明循环同价续费</span></td><td><span class="payment-status pay-verify">预热码已于 11-20 截止，需核对正式黑五页</span></td></tr>
        <tr><td><strong>支付宝付款</strong></td><td>已确认支持支付宝直接结算</td><td>已确认支持支付宝充值 Cloud Credits 余额</td></tr>
        <tr><td><strong>大内存梯度</strong></td><td>1GB / 4GB / 6GB / 8GB 全系 SSD 齐全</td><td>需盯黑五正式闪购页放出更高配置</td></tr>
        <tr><td><strong>选购结论</strong></td><td>追求省心锁价、直接买 4GB+ 跑业务优先选 RN</td><td>适合习惯余额按需扣费、蹲守正式黑五闪购的玩家</td></tr>
      </tbody>
    </table></div>
    <h2>核验记录与入口</h2>
    ${renderDealsTable(deals)}
  `;
  return renderLayout({
    path: "/vs/racknerd-vs-cloudcone",
    title: "RackNerd vs CloudCone 2026 黑五怎么选？续费、支付与适用场景对比",
    description: "RackNerd 与 CloudCone 2026 黑五全方位对比：年付价格、循环续费承诺、支付宝付款方式与 4GB/8GB 大内存选择建议。",
    directAnswer: "2026 黑五更推荐优先锁定 RackNerd：1GB 起步仅 $15.98/年，4GB 仅 $47.98/年，官方明确承诺循环同价续费且支持支付宝直付。CloudCone 预热码 PREBF26 已过 11 月 20 日，适合充值余额后关注官方正式黑五放货。",
    bodyHtml,
  });
}

function pageVsAliTencent() {
  const deals = VERIFIED_DEALS.filter((d) => d.provider === "阿里云" || d.provider === "腾讯云");
  const bodyHtml = `
    <h2>阿里云 99 计划 vs 腾讯云 199 轻量：核心差异表</h2>
    <div class="payment-table-wrap"><table class="data-table">
      <thead><tr><th>对比维度</th><th>阿里云 ECS 经济型 e · 99 计划</th><th>腾讯云 Lighthouse · 同价续费专区</th></tr></thead>
      <tbody>
        <tr><td><strong>核心配置</strong></td><td class="mono">2 vCPU / 2GB / 40GB ESSD Entry</td><td class="mono">2 vCPU / 4GB / 70GB SSD</td></tr>
        <tr><td><strong>首年价格</strong></td><td class="mono"><strong>¥99/年</strong></td><td class="mono"><strong>¥199/年</strong></td></tr>
        <tr><td><strong>带宽与流量</strong></td><td>3 Mbps 固定带宽，不限流量</td><td>6 Mbps 峰值带宽，600GB/月流量包</td></tr>
        <tr><td><strong>续费锁价规则</strong></td><td><span class="payment-status pay-yes">规则锁价至 2029-03-31（三年 ¥297）</span></td><td><span class="payment-status pay-verify">仅限同价续费 1 次（第三年未知）</span></td></tr>
        <tr><td><strong>支付方式</strong></td><td>支付宝、银联、网银</td><td>微信支付、QQ 钱包、网银（官网未列支付宝）</td></tr>
      </tbody>
    </table></div>
    <h2>已核验直达入口</h2>
    ${renderDealsTable(deals)}
  `;
  return renderLayout({
    path: "/vs/aliyun-vs-tencent",
    title: "阿里云 99 计划 vs 腾讯云 199 轻量服务器：三年真实总成本硬核对比",
    description: "深度对比阿里云 99 计划（2C2G 3M）与腾讯云 199 轻量（2C4G 6M）的续费次数、带宽流量与三年总账单，帮你一次选对不踩坑。",
    directAnswer: "如果你打算稳定用满 3 年以上且只需 2GB 内存（博客、轻量 API），选阿里云 99 计划（三年总计 ¥297，3M 不限流量）；如果你 1–2 年内急需 4GB 内存和更高峰值带宽，选腾讯云 199（注意仅限同价续费 1 次，两年后需做好迁移准备）。",
    bodyHtml,
  });
}

function renderSitemap() {
  const allUrls = [...EXISTING_STATIC_ROUTES, ...SEO_ROUTES];
  const xmlRows = allUrls
    .map(
      (r) => `  <url>
    <loc>${SITE_META.siteUrl}${r.path}</loc>
    <lastmod>${SITE_META.snapshotDate}</lastmod>
    <changefreq>${r.changefreq}</changefreq>
    <priority>${r.priority}</priority>
  </url>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${xmlRows}
</urlset>`;
}

function renderLlmsTxt() {
  const seoLines = SEO_ROUTES.map((r) => `- [${r.title}](${SITE_META.siteUrl}${r.path})`).join("\n");
  const guideLines = EXISTING_STATIC_ROUTES.map((r) => `- [${r.title}](${SITE_META.siteUrl}${r.path})`).join("\n");
  const dealLines = VERIFIED_DEALS.map(
    (d) => `- ${d.provider} ${d.plan_name}: ${d.vcpu} vCPU / ${d.ram_gb}GB RAM / ${d.storage}, ${fmtPrice(d)}, 续费: ${d.renewal_policy}, 支付宝: ${d.alipay}`
  ).join("\n");

  return `# ${SITE_META.siteName} (${SITE_META.siteUrl})

> 面向中文开发者与 AI Agent 玩家的 VPS 与国内云优惠核验雷达。每 4 小时自动采集全球 9 大社区线索，正式榜单坚持人工核验续费条款、三年账单、支付宝/微信支付方式与白嫖容器风险边界。

## 核心页面与工具
${guideLines}

## SSR SEO/GEO 专题与横向对比页
${seoLines}

## 实时 API 与开源仓库
- 4 小时自动采集 9 源线索与 AI 中文简报 JSON：${SITE_META.siteUrl}/api/leads
- 实时参考汇率与官网在线探活 JSON：${SITE_META.siteUrl}/api/live-status
- 结构化核验数据快照：${SITE_META.siteUrl}/data/offers.json
- GitHub 开源仓库 (MIT)：${SITE_META.githubUrl}

## 已核验精选数据快照（${SITE_META.snapshotDate}）
${dealLines}

## 核验原则
1. 人民币与美元分币种核对，不拿月均价掩盖年付预付金额。
2. 明确区分循环同价续费、限期锁价、仅限一次同价与待核实；过期活动独立归档。
3. 未实测网络路线不标“中国优化”或“CN2 GIA”。
`;
}

export function handleSeoRoutes(request) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";

  const htmlHeaders = {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "public, max-age=1800",
    "x-content-type-options": "nosniff",
  };
  const isHead = request.method === "HEAD";

  switch (path) {
    case "/black-friday":
      return new Response(isHead ? null : pageBlackFriday(), { headers: htmlHeaders });
    case "/guide/ai-agent-vps":
      return new Response(isHead ? null : pageAiAgentVps(), { headers: htmlHeaders });
    case "/guide/alipay-vps":
      return new Response(isHead ? null : pageAlipayVps(), { headers: htmlHeaders });
    case "/guide/china-cloud-renewal":
      return new Response(isHead ? null : pageChinaCloudRenewal(), { headers: htmlHeaders });
    case "/vs/racknerd-vs-cloudcone":
      return new Response(isHead ? null : pageVsRnCc(), { headers: htmlHeaders });
    case "/vs/aliyun-vs-tencent":
      return new Response(isHead ? null : pageVsAliTencent(), { headers: htmlHeaders });
    case "/sitemap.xml":
      return new Response(isHead ? null : renderSitemap(), {
        headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" },
      });
    case "/llms.txt":
      return new Response(isHead ? null : renderLlmsTxt(), {
        headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" },
      });
    default:
      return null;
  }
}
