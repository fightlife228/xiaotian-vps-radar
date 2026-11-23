const $ = id => document.getElementById(id);
const money = (n, currency = 'USD') =>
  n === null || n === undefined
    ? '待核实'
    : (currency === 'CNY' ? '¥' : '$') + Number(n).toFixed(currency === 'CNY' ? 0 : 2);
const market = d => d.market || (d.currency === 'CNY' ? 'china' : 'overseas');
const safe = s => String(s ?? '').replace(/[&<>"']/g, x => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[x]));

let current = [];
let freebies = [];
let archived = [];
let watch = [];
let payments = [];
let infoSites = [];
let allLeads = [];
let activeLeadFilter = 'all';
let leadQuery = '';
let liveStatus = null;
let liveFxRate = 7.20;
let snapshotDate = '2026-11-23';

const BENCH_COMMANDS = [
  {
    id: 'ecs',
    title: '融合怪 VPS 综合测评（CPU / 磁盘 / 三网 / 流媒体）',
    tag: '综合验机',
    desc: '开源一站式检测脚本，新机到手跑一遍即可看清硬件超售、IO、IP 质量与基础线路。',
    cmd: 'curl -L https://gitlab.com/spiritysdx/za/-/raw/main/ecs.sh -o ecs.sh && chmod +x ecs.sh && bash ecs.sh'
  },
  {
    id: 'yabs',
    title: 'YABS 性能跑分（Geekbench + fio 磁盘 IO + iperf3）',
    tag: '硬核基准',
    desc: '海外 VPS 社区（LET/LEB）通用基准，快速辨别真 NVMe/SSD 还是慢速 HDD。',
    cmd: 'curl -sL https://yabs.sh | bash -s -- -i'
  },
  {
    id: 'nexttrace',
    title: 'NextTrace 三网回程路由追踪',
    tag: '回程测速',
    desc: '验证电信 / 联通 / 移动真实回程路径，区分普通 BGP、CN2 GIA 与 CMIN2。',
    cmd: 'curl -sL https://nxtrace.org/nt | bash && nexttrace --fast-trace'
  },
  {
    id: 'bbr',
    title: '开启 Linux 内核原生 BBR + fq 拥塞控制',
    tag: '网络优化',
    desc: 'Linux Kernel 4.9+ 直接生效，显著降低跨境高延迟链路丢包抖动（需 root）。',
    cmd: 'echo -e "net.core.default_qdisc=fq\\nnet.ipv4.tcp_congestion_control=bbr" >> /etc/sysctl.conf && sysctl -p && sysctl net.ipv4.tcp_congestion_control'
  },
  {
    id: 'docker',
    title: 'Docker Engine + Compose 官方一键安装',
    tag: '容器部署',
    desc: '海外 VPS 标准安装方式，装完即可直接部署 OpenClaw、n8n、Uptime Kuma 等服务。',
    cmd: 'curl -fsSL https://get.docker.com | sh && docker --version && docker compose version'
  }
];

const paymentByProvider = provider => payments.find(p => p.provider === provider);
const payStatus = x => x === 'yes' ? '已确认' : x === 'verify' ? '待结账核实' : x === 'unlisted' ? '官网未列出' : '未确认';
const isKnown = d => typeof d.renewal === 'number' && (d.renewal_type === 'recurring' || d.renewal_type === 'until-date' || !d.renewal_type);
const threeCost = d => isKnown(d) ? d.price + 2 * d.renewal : Infinity;
const renewalText = d => isKnown(d)
  ? `${money(d.renewal, d.currency)}/年${d.renewal_type === 'until-date' ? '（锁价）' : '（循环同价）'}`
  : d.renewal_type === 'once'
    ? '仅可同价续费 1 次'
    : '待核实 / 非同价';

function annualCny(d) {
  return d.currency === 'CNY' ? d.price : d.price * liveFxRate;
}

function monthlyEquivText(d) {
  const cnyMonth = annualCny(d) / 12;
  return `≈ ¥${cnyMonth.toFixed(1)}/月`;
}

function shortRegion(region) {
  return String(region || '').replace(/（.*?）/g, '').replace(/中国内地 · /g, '国内·').replace(/美国 · /g, '美·').trim() || '见官网';
}

function providerHealth(provider) {
  if (!liveStatus || !Array.isArray(liveStatus.providers)) return null;
  return liveStatus.providers.find(x => x.provider === provider) || null;
}

function providerHealthTag(provider) {
  const hit = providerHealth(provider);
  if (!hit) return '';
  return hit.reachable ? '● 官网在线' : '● 待复核';
}

function card(d) {
  const checked = d.confidence === 'official';
  const pay = paymentByProvider(d.provider);
  const health = providerHealth(d.provider);
  const healthBadge = health
    ? `<span class="${health.reachable ? 'health-ok' : ''}">${health.reachable ? '● 官网在线 ✓' : '● 待复核'}</span>`
    : '<span>官网快照</span>';
  const payPills = [];
  if (pay?.alipay === 'yes') payPills.push('<span class="meta-pill ok">支付宝 ✓</span>');
  else if (pay?.alipay === 'verify') payPills.push('<span class="meta-pill warn">支付宝待核</span>');
  if (pay?.wechat === 'yes') payPills.push('<span class="meta-pill ok">微信支付 ✓</span>');
  if (d.currency === 'CNY') payPills.push('<span class="meta-pill">人民币账单</span>');
  if (d.icp_note) payPills.push(`<span class="meta-pill ${market(d) === 'china' ? 'warn' : ''}">${safe(market(d) === 'china' ? '建站需备案' : '免备案')}</span>`);
  if (d.disk_type === 'HDD') payPills.push('<span class="meta-pill warn">HDD 慢盘警示</span>');
  if (d.bandwidth && !/请查/.test(d.bandwidth)) payPills.push(`<span class="meta-pill">${safe(d.bandwidth)}</span>`);

  return `<article class="deal-card ${d.recommended ? 'is-recommended' : ''}">
    <div class="card-top">
      <div class="provider-wrap">
        <span class="provider">${safe(d.provider)}</span>
        ${d.recommended ? '<span class="rec-badge">★ 实测推荐</span>' : ''}
      </div>
      <span class="status ${checked ? 'official' : 'article'}">${checked ? '官网核验' : '社区线索'}</span>
    </div>
    <div class="card-title-row">
      <h3>${safe(d.name)}</h3>
      ${d.window_badge ? `<span class="window-tag">${safe(d.window_badge)}</span>` : ''}
    </div>
    <div class="card-price-row">
      <div class="card-price">
        <strong>${money(d.price, d.currency)}</strong>
        <span>/ 年 · ${safe(d.currency)}</span>
      </div>
      <span class="price-equiv" title="按实时参考汇率折算">${monthlyEquivText(d)}</span>
    </div>
    <div class="specs">
      <div><small>vCPU</small><b>${safe(d.cpu)} 核</b></div>
      <div><small>内存</small><b>${safe(d.ram)} GB</b></div>
      <div><small>存储</small><b class="${d.disk_type === 'HDD' ? 'hdd' : ''}">${safe(d.disk)}G ${safe(d.disk_type)}</b></div>
      <div><small>机房</small><b title="${safe(d.region)}">${safe(shortRegion(d.region))}</b></div>
    </div>
    <div class="renewal-line">
      <span>续费口径</span>
      <b class="${isKnown(d) ? '' : 'unknown'}">${safe(renewalText(d))}</b>
    </div>
    <div class="card-meta-list">${payPills.join('')}</div>
    <p class="card-note">${safe(d.score)}</p>
    <div class="card-links">
      <button type="button" data-open-drawer="${safe(d.id)}">详情与日志</button>
      <a class="primary" href="${safe(d.buy)}" target="_blank" rel="${d.sponsored ? 'noopener noreferrer sponsored' : 'noopener noreferrer nofollow'}">${d.sponsored ? '官网推广直达 ↗' : '直达官方页 ↗'}</a>
    </div>
    <div class="card-foot">
      <span>核验 ${safe(d.checked)}</span>
      ${healthBadge}
    </div>
  </article>`;
}

function openDrawer(id) {
  const d = current.find(x => x.id === id);
  if (!d) return;
  const pay = paymentByProvider(d.provider);
  const threeStr = isKnown(d) ? `${money(d.price + 2 * d.renewal, d.currency)}（约 ¥${((d.currency === 'CNY' ? d.price + 2 * d.renewal : (d.price + 2 * d.renewal) * liveFxRate)).toFixed(0)}）` : '暂无法可靠核算（非循环同价或待核实）';
  const logs = Array.isArray(d.changelog) && d.changelog.length
    ? d.changelog.map(c => `<li><time>${safe(c.date)}</time><span>${safe(c.note)}</span></li>`).join('')
    : `<li><time>${safe(d.checked)}</time><span>核验官方公开报价与续费口径。</span></li>`;

  $('drawerProvider').textContent = `${d.provider} · ${d.window_badge || d.kind}`;
  $('drawerTitle').textContent = d.name;
  $('drawerBody').innerHTML = `
    <div class="drawer-kv-grid">
      <div class="drawer-kv"><span>首期年费 / 折合月价</span><strong>${money(d.price, d.currency)}/年 · ${monthlyEquivText(d)}</strong></div>
      <div class="drawer-kv"><span>续费条款</span><strong>${safe(renewalText(d))}</strong></div>
      <div class="drawer-kv"><span>三年账面总成本</span><strong>${safe(threeStr)}</strong></div>
      <div class="drawer-kv"><span>规格配置</span><strong>${safe(d.cpu)}C / ${safe(d.ram)}GB / ${safe(d.disk)}GB ${safe(d.disk_type)}</strong></div>
      <div class="drawer-kv"><span>机房 / 带宽流量</span><strong>${safe(d.region)} · ${safe(d.bandwidth || '见官网')}${d.monthly_traffic_gb ? ' / ' + safe(d.monthly_traffic_gb) : ''}</strong></div>
      <div class="drawer-kv"><span>支付与合规</span><strong>支付宝:${payStatus(pay?.alipay)} · 微信:${payStatus(pay?.wechat)} · ${safe(d.icp_note || '')}</strong></div>
    </div>
    <div class="drawer-section">
      <h4>适用场景与工程师点评</h4>
      <p>${safe(d.score)}</p>
    </div>
    <div class="drawer-section">
      <h4>续费与资格核验备注</h4>
      <p>${safe(d.renewal_note || '')}<br>${safe(d.eligible ? '购买资格：' + d.eligible + '。' : '')}${safe(d.note || '')}</p>
    </div>
    <div class="drawer-section">
      <h4>核验与变更日志</h4>
      <ul class="changelog-list">${logs}</ul>
    </div>
    <div class="drawer-section">
      <h4>披露与报错</h4>
      <p>${d.sponsored ? '右侧“官网推广直达”含联盟推广参数（已标 sponsored），不会增加你的购机价格；左侧“原始核验来源”为纯官方信息页。' : '本套餐当前不含联盟推广参数，直达官方活动原页。'} 如发现涨价或无货，欢迎在 <a href="https://github.com/fightlife228/xiaotian-vps-radar/issues/new" target="_blank" rel="noopener noreferrer" style="color:var(--accent-text);font-weight:650">GitHub Issue 提报纠错 ↗</a>。</p>
    </div>
  `;
  $('drawerSourceLink').href = d.source;
  const buyEl = $('drawerBuyLink');
  buyEl.href = d.buy;
  buyEl.rel = d.sponsored ? 'noopener noreferrer sponsored' : 'noopener noreferrer nofollow';
  buyEl.textContent = d.sponsored ? '官网推广直达 ↗' : '直达官方活动页 ↗';
  $('offerDrawer').classList.add('open');
  $('offerDrawer').setAttribute('aria-hidden', 'false');
}

function closeDrawer() {
  const el = $('offerDrawer');
  if (!el) return;
  el.classList.remove('open');
  el.setAttribute('aria-hidden', 'true');
}

function renderDeals() {
  const q = $('search').value.trim().toLowerCase();
  const ram = Number($('ram').value);
  const ren = $('renewal').value;
  const sort = $('sort').value;
  const payFilter = $('payFilter').value;
  const marketFilter = $('market').value;
  const items = current.filter(d =>
    `${d.provider} ${d.name} ${d.region} ${d.disk_type} ${d.score} ${d.window_badge || ''} ${(d.tags || []).join(' ')}`.toLowerCase().includes(q) &&
    (marketFilter === 'all' || market(d) === marketFilter) &&
    d.ram >= ram &&
    (ren === 'all' || (ren === 'known' ? isKnown(d) : !isKnown(d))) &&
    (payFilter === 'all' || (
      payFilter === 'yes' ? paymentByProvider(d.provider)?.alipay === 'yes' :
      payFilter === 'maybe' ? ['yes', 'verify'].includes(paymentByProvider(d.provider)?.alipay) :
      payFilter === 'unlisted' ? paymentByProvider(d.provider)?.alipay === 'unlisted' :
      payFilter === 'wechat' ? paymentByProvider(d.provider)?.wechat === 'yes' :
      payFilter === 'cny' ? d.currency === 'CNY' : false
    ))
  );
  if (sort === 'recommended') {
    items.sort((a, b) => (b.recommended ? 1 : 0) - (a.recommended ? 1 : 0) || annualCny(a) - annualCny(b));
  } else if (sort === 'memory') {
    items.sort((a, b) => b.ram - a.ram || annualCny(a) - annualCny(b));
  } else if (sort === 'three') {
    items.sort((a, b) => (isKnown(a) ? annualCny(a) * 3 : Infinity) - (isKnown(b) ? annualCny(b) * 3 : Infinity));
  } else if (sort === 'cny-asc') {
    items.sort((a, b) => annualCny(a) - annualCny(b));
  } else {
    items.sort((a, b) => a.currency.localeCompare(b.currency) || a.price - b.price);
  }
  $('dealGrid').innerHTML = items.map(card).join('');
  $('empty').hidden = !!items.length;
  $('resultText').textContent = `在售精选 ${items.length} 款 · 已自动隔离 ${archived.length} 条过期优惠 · 快照 ${snapshotDate}`;
}

function applyPreset(preset) {
  $('search').value = '';
  $('market').value = 'all';
  $('ram').value = '0';
  $('renewal').value = 'all';
  $('payFilter').value = 'all';
  $('sort').value = 'recommended';
  if (preset === 'bf-recurring') { $('market').value = 'overseas'; $('renewal').value = 'known'; $('sort').value = 'three'; }
  else if (preset === 'under-20') { $('sort').value = 'cny-asc'; $('search').value = ''; }
  else if (preset === 'china-budget') { $('market').value = 'china'; $('payFilter').value = 'cny'; $('sort').value = 'cny-asc'; }
  else if (preset === 'alipay') { $('payFilter').value = 'yes'; $('sort').value = 'recommended'; }
  else if (preset === 'ai-agent') { $('ram').value = '4'; $('sort').value = 'three'; }
  document.querySelectorAll('.quick-pill').forEach(btn => btn.classList.toggle('active', btn.dataset.preset === preset));
  if (preset === 'under-20') {
    const lowItems = current.filter(d => annualCny(d) <= 150).sort((a, b) => annualCny(a) - annualCny(b));
    $('dealGrid').innerHTML = lowItems.map(card).join('');
    $('empty').hidden = !!lowItems.length;
    $('resultText').textContent = `筛选：年付 ≤ ¥150（含 <$20 入门机），共 ${lowItems.length} 款 · 快照 ${snapshotDate}`;
    return;
  }
  renderDeals();
}

function renderFreebies() {
  const grid = $('freebieGrid');
  if (!grid) return;
  grid.innerHTML = freebies.map(f => {
    const level = f.tier_level || 'experimental';
    return `<article class="freebie-card tier-${safe(level)}">
      <div class="fb-top">
        <span class="watch-provider">${safe(f.provider)} · <span class="mono" style="font-weight:600;color:var(--muted)">${safe(f.form)}</span></span>
        <span class="fb-badge ${safe(level)}">${safe(f.stability)}</span>
      </div>
      <h3>${safe(f.name)}</h3>
      <div class="fb-spec-bar">
        <span class="meta-pill mono">${safe(f.spec)}</span>
        <span class="meta-pill">${safe(f.auth_req)}</span>
      </div>
      <div class="fb-kv">
        <div><strong>时效 / 保活：</strong>${safe(f.renewal_rule)}</div>
        <div><strong>适用边界：</strong>${safe(f.use_case)}</div>
      </div>
      <div class="fb-warn ${level === 'stable' ? 'is-safe' : ''}">
        <strong>${level === 'stable' ? '能力边界：' : '硬伤与风险红线：'}</strong>${safe(f.caveats)}
      </div>
      <div class="fb-foot">
        <span class="mono" style="color:var(--muted);font-size:11px">核验 ${safe(f.checked)} · 纯官方无推广</span>
        <a href="${safe(f.url)}" target="_blank" rel="noopener noreferrer nofollow">直达官方入口 ↗</a>
      </div>
    </article>`;
  }).join('');
}

function renderArchive() {
  const grid = $('archiveGrid');
  if (!grid) return;
  grid.innerHTML = archived.map(a => `
    <article class="archive-card">
      <div class="archive-top">
        <span class="watch-provider">${safe(a.provider)}</span>
        <span class="sp-badge ended">已截止 · ${safe(a.ended_at)}</span>
      </div>
      <h3>${safe(a.name)}</h3>
      <div class="archive-spec">${safe(a.spec)} · 历史参考：${safe(a.historical_price)}</div>
      <p>${safe(a.reason)}</p>
      <div class="archive-links">
        <a href="${safe(a.source)}" target="_blank" rel="noopener noreferrer">历史依据 ↗</a>
        <a href="${safe(a.portal)}" target="_blank" rel="${a.sponsored ? 'noopener noreferrer sponsored' : 'noopener noreferrer nofollow'}">${a.sponsored ? '查看当前在售（推广）↗' : '查看商家当前页 ↗'}</a>
      </div>
    </article>
  `).join('');
}

function renderPayments() {
  $('paymentRows').innerHTML = payments.map(p => `<tr><td><strong>${safe(p.provider)}</strong></td><td><span class="payment-status pay-${safe(p.alipay)}">${payStatus(p.alipay)}</span></td><td><span class="payment-status pay-${safe(p.wechat || 'unknown')}">${payStatus(p.wechat)}</span></td><td><span class="payment-status pay-${safe(p.unionpay)}">${payStatus(p.unionpay)}</span></td><td><small class="mono">${safe(p.billing_currency)}</small><div class="payment-detail">${safe(p.note)}</div></td><td><a href="${safe(p.source)}" target="_blank" rel="noopener noreferrer">官方依据 ↗</a></td></tr>`).join('');
}

function renderWatch() {
  $('watchGrid').innerHTML = watch.map(w => {
    const h = providerHealth(w.provider);
    const hText = h ? (h.reachable ? ' · 官网在线 ✓' : ' · 待复核') : '';
    return `<article class="watch-card">
      <div class="lead-meta-row">
        <span class="watch-provider">${safe(w.provider)}${safe(hText)}</span>
        <span class="watch-status">${safe(w.status)}</span>
      </div>
      <h3>${safe(w.headline)}</h3>
      <p>${safe(w.detail)}</p>
      <div class="lead-meta-row">
        <small class="mono" style="color:var(--muted);font-size:11px">复核 ${safe(w.review_date || snapshotDate)}</small>
        <a href="${safe(w.url)}" target="_blank" rel="${w.sponsored ? 'noopener noreferrer sponsored' : 'noopener noreferrer'}">${w.sponsored ? '官方推广入口 ↗' : '查看来源 ↗'}</a>
      </div>
    </article>`;
  }).join('');
}

function calc() {
  const sel = $('compareSelect');
  if (!sel) return;
  const id = sel.value;
  const d = current.find(x => x.id === id);
  if (!d) return;
  const oldPrice = Math.max(0, Number($('oldPrice').value) || 0);
  const oldRam = Math.max(0, Number($('oldRam').value) || 0);
  const oldCpu = Math.max(0, Number($('oldCpu').value) || 0);
  const fx = Math.max(0.1, Number($('fxRate').value) || liveFxRate);
  const nextInUsd = d.currency === 'CNY' ? d.price / fx : d.price;
  const delta = nextInUsd - oldPrice;
  const change = delta > 0.009 ? `新机首年约多付 $${delta.toFixed(2)}` : delta < -0.009 ? `新机首年约少付 $${(-delta).toFixed(2)}` : '首年费用大致相近';
  const total3y = isKnown(d) ? money(d.price + 2 * d.renewal, d.currency) : '无法可靠核算';
  const save3y = isKnown(d)
    ? (() => {
        const next3Usd = d.currency === 'CNY' ? (d.price + 2 * d.renewal) / fx : (d.price + 2 * d.renewal);
        const diff3 = oldPrice * 3 - next3Usd;
        return diff3 > 0.5 ? `3 年预计净省 $${diff3.toFixed(2)}（≈ ¥${(diff3 * fx).toFixed(0)}）` : `3 年预计多支出 $${(-diff3).toFixed(2)}`;
      })()
    : '非循环同价套餐，暂不推算 3 年差额';
  const fxSource = liveStatus?.fx?.usd_cny ? `1 USD≈¥${fx.toFixed(2)}（已每 4 小时自动同步）` : `1 USD≈¥${fx.toFixed(2)}`;
  $('compareResult').innerHTML = `
    <div class="compare-stat"><span>新机首年付款</span><strong>${money(d.price, d.currency)}</strong></div>
    <div class="compare-stat"><span>新机三年账面价</span><strong>${total3y}</strong></div>
    <div class="compare-stat"><span>内存增减</span><strong>${oldRam ? ((d.ram / oldRam - 1) >= 0 ? '+' : '') + ((d.ram / oldRam - 1) * 100).toFixed(0) + '%' : '—'}</strong></div>
    <div class="compare-stat"><span>vCPU 变化</span><strong>${oldCpu ? (d.cpu - oldCpu > 0 ? '+' : '') + (d.cpu - oldCpu) : '—'}</strong></div>
    <div class="compare-summary"><strong>${change}</strong>；${save3y}。参考汇率 ${fxSource}。${isKnown(d) ? safe(d.renewal_note) : '仅一次同价或未知续费，不推算第三年。'}</div>
  `;
}

function updatePromptPreview() {
  const out = $('promptPreview');
  if (!out) return;
  const budget = $('pBudget').value;
  const scene = $('pScene').value;
  const pay = $('pPay').value;
  const region = $('pRegion').value;
  const extra = $('pExtra').value.trim();
  const offersBrief = current.slice(0, 7).map(d =>
    `- ${d.provider} ${d.name}：${d.cpu}C/${d.ram}G/${d.disk}G ${d.disk_type}，${money(d.price, d.currency)}/年（${renewalText(d)}，${d.region}）`
  ).join('\n');

  out.value = `你是一位严谨的 Linux 运维与云服务器选型顾问。请帮我从以下已核验的 2026 VPS/国内云候选中选出最稳妥的 1~2 款方案，并给出明确理由与避坑提醒：

【我的硬性需求】
- 年预算上限：${budget}
- 核心部署场景：${scene}
- 机房/合规偏好：${region}
- 支付方式要求：${pay}${extra ? `\n- 补充约束：${extra}` : ''}

【参考实时核验快照（来源：https://vps.xiaotianai.win/data/offers.json，汇率 1 USD ≈ ¥${liveFxRate.toFixed(2)}）】
${offersBrief}

【请按以下结构输出】
1. 首选方案 + 备选方案（计算 3 年总持有成本，禁止只看首年低价）
2. 针对我这个场景的 CPU / 内存 / SSD IO / 备案与续费风险分析
3. 如果以上候选都不合适，给出更稳妥的替代架构（例如 Cloudflare Pages + 轻量 API）。`;
}

function renderBenchKit() {
  const grid = $('benchGrid');
  if (!grid) return;
  grid.innerHTML = BENCH_COMMANDS.map(item => `
    <article class="bench-card">
      <div class="bench-card-head">
        <h4>${safe(item.title)}</h4>
        <span class="bench-tag">${safe(item.tag)}</span>
      </div>
      <p>${safe(item.desc)}</p>
      <div class="cmd-box">
        <code>${safe(item.cmd)}</code>
        <button type="button" class="cmd-copy" data-copy-cmd="${safe(item.id)}">复制</button>
      </div>
    </article>
  `).join('');
}

async function copyText(text, btn, defaultLabel) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  if (btn) {
    btn.textContent = '已复制 ✓';
    setTimeout(() => { btn.textContent = defaultLabel; }, 1600);
  }
}

function renderSites() {
  const target = $('sourceGrid');
  if (!target) return;
  target.innerHTML = infoSites.map(x => `<article class="watch-card"><div class="watch-provider">${safe(x.title)}</div><h3>${safe(x.category)}</h3><p>${safe(x.description)}</p><a href="${safe(x.url)}" target="_blank" rel="noopener noreferrer nofollow">访问资讯站 ↗</a></article>`).join('');
}

function formatCountdown(iso) {
  if (!iso) return '';
  const diffMs = Date.parse(iso) - Date.now();
  if (!Number.isFinite(diffMs) || diffMs <= 0) return ' · 即将自动刷新';
  const mins = Math.ceil(diffMs / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? ` · 下次自动更新约 ${h}h${m}m 后` : ` · 下次自动更新约 ${m}m 后`;
}

function renderAiBrief(feed) {
  const box = $('aiBriefBox');
  if (!box) return;
  const brief = feed && feed.ai_brief;
  if (!brief || !brief.summary) { box.hidden = true; return; }
  box.hidden = false;
  const ts = brief.generated_at ? new Date(brief.generated_at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) : '';
  const listHtml = Array.isArray(brief.highlights) && brief.highlights.length
    ? `<ul class="ai-brief-list">${brief.highlights.slice(0, 5).map(h => `<li><strong>${safe(h.source || '线索')}</strong>：${safe(h.zh || h.title || '')}${h.tip ? ' — ' + safe(h.tip) : ''} <a href="${safe(h.url || '#leads')}" target="_blank" rel="noopener noreferrer nofollow">原文 ↗</a></li>`).join('')}</ul>`
    : '';
  box.innerHTML = `<div class="ai-brief-head"><span class="ai-brief-badge">✦ AI 每 4 小时线索速读</span><span class="ai-brief-meta">${safe(ts ? ts + '（北京时间）' : '')}${brief.translated_count ? ' · 已中文化 ' + safe(brief.translated_count) + ' 条' : ''} · 仅供参考</span></div><p class="ai-brief-summary">${safe(brief.summary)}</p>${listHtml}`;
}

function renderLeads() {
  const grid = $('leadGrid');
  if (!grid) return;
  const asDate = s => {
    if (!s) return '日期未确认';
    const d = new Date(s);
    return Number.isFinite(d.getTime()) ? d.toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }) : '日期未确认';
  };
  let filtered = allLeads;
  if (activeLeadFilter === 'promo') filtered = filtered.filter(x => x.is_promo || /black friday|黑五|促销|优惠|特价|deal|offer|promo/i.test(x.title || ''));
  else if (activeLeadFilter === 'china') filtered = filtered.filter(x => x.region === 'china' || /laozuo\.org|vpsgo\.com|vpsxxs\.com|vpser\.net/i.test(x.url || ''));
  else if (activeLeadFilter === 'overseas') filtered = filtered.filter(x => x.region === 'overseas' || /lowendbox\.com|lowendtalk\.com|lowendspirit\.com|blog\.racknerd\.com/i.test(x.url || ''));
  if (leadQuery) {
    filtered = filtered.filter(x => `${x.source} ${x.title} ${x.ai?.zh || ''} ${x.ai?.tag || ''}`.toLowerCase().includes(leadQuery));
  }
  grid.innerHTML = filtered.length ? filtered.slice(0, 18).map(x => {
    const isPromo = x.is_promo || /black friday|黑五|促销|优惠|特价|deal|offer|promo/i.test(x.title || '');
    const ai = x.ai || null;
    const badgeHtml = (ai?.tag ? `<span class="lead-ai-tag">${safe(ai.tag)}</span>` : '') + (isPromo ? '<span class="promo-badge">促销线索</span>' : '');
    const zhHtml = ai?.zh && ai.zh !== x.title ? `<div class="lead-zh">中文简译：${safe(ai.zh)}</div>` : '';
    const tipHtml = ai?.tip ? `<p class="lead-tip">核验提醒：${safe(ai.tip)}</p>` : '<p>第三方公开 RSS 标题线索；请打开原文核实价格、续费规则与库存。</p>';
    return `<article class="watch-card"><div class="lead-meta-row"><span class="watch-provider">${safe(x.source)}</span><div style="display:flex;gap:5px;flex-wrap:wrap">${badgeHtml}</div></div><h3>${safe(x.title)}</h3>${zhHtml}<span class="watch-status">未核验 / ${safe(asDate(x.published))}</span>${tipHtml}<a href="${safe(x.url)}" target="_blank" rel="noopener noreferrer nofollow">查看原始帖子 ↗</a></article>`;
  }).join('') : '<p class="lead-empty">当前筛选/搜索条件下暂无线索，可清空搜索词或切换回“全部线索”。</p>';
}

async function loadLiveStatus() {
  try {
    const res = await fetch('/api/live-status', { cache: 'no-store' });
    if (!res.ok) return;
    liveStatus = await res.json();
    if (liveStatus?.fx?.usd_cny) {
      liveFxRate = Number(liveStatus.fx.usd_cny);
      if ($('fxRate')) $('fxRate').value = liveFxRate.toFixed(2);
      if ($('statFx')) $('statFx').textContent = `¥${liveFxRate.toFixed(2)}`;
      if ($('statFxMeta')) {
        const okProviders = (liveStatus.providers || []).filter(p => p.reachable).length;
        $('statFxMeta').textContent = `1 USD 汇率 · ${okProviders} 官网在线`;
      }
      calc();
      updatePromptPreview();
    }
    if (current.length) {
      renderDeals();
      renderWatch();
    }
  } catch {}
}

function bindToolboxTabs() {
  const tabs = document.querySelectorAll('.tool-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.toolTab;
      tabs.forEach(t => t.classList.toggle('active', t === tab));
      document.querySelectorAll('.tool-panel').forEach(p => {
        p.hidden = p.id !== target;
      });
    });
  });
}

async function main() {
  try {
    const res = await fetch('/data/offers.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    snapshotDate = data.snapshot || snapshotDate;
    current = data.offers || [];
    freebies = data.freebies || [];
    archived = data.archived || [];
    watch = data.watch || [];
    payments = data.payment_providers || [];
    infoSites = data.info_sites || [];

    if ($('statCount')) $('statCount').textContent = `${current.length} 款`;
    if ($('statProviders')) $('statProviders').textContent = `${new Set([...current.map(x => x.provider), ...watch.map(x => x.provider)]).size} 家`;
    if ($('statRenewal')) $('statRenewal').textContent = `${current.filter(isKnown).length} 款`;
    if ($('snapLine')) $('snapLine').textContent = `快照 ${snapshotDate} · 每 4 小时自动同步 9 源线索、实时汇率与官网探活`;

    if ($('compareSelect')) {
      $('compareSelect').innerHTML = current.map(d => `<option value="${safe(d.id)}">${safe(d.provider)} · ${safe(d.ram)}GB · ${money(d.price, d.currency)}/年</option>`).join('');
      $('compareSelect').value = 'rn-bf26-4g';
    }

    renderDeals();
    renderFreebies();
    renderArchive();
    renderWatch();
    renderPayments();
    renderSites();
    renderBenchKit();
    calc();
    updatePromptPreview();
    bindToolboxTabs();

    ['search', 'market', 'ram', 'renewal', 'payFilter', 'sort'].forEach(id => {
      const el = $(id);
      if (el) el.addEventListener(id === 'search' ? 'input' : 'change', () => {
        document.querySelectorAll('.quick-pill').forEach(btn => btn.classList.remove('active'));
        renderDeals();
      });
    });
    document.querySelectorAll('.quick-pill').forEach(btn => btn.addEventListener('click', () => applyPreset(btn.dataset.preset)));
    ['oldPrice', 'oldRam', 'oldCpu', 'fxRate'].forEach(id => $(id)?.addEventListener('input', calc));
    $('compareSelect')?.addEventListener('change', calc);
    ['pBudget', 'pScene', 'pPay', 'pRegion', 'pExtra'].forEach(id => $(id)?.addEventListener(id === 'pExtra' ? 'input' : 'change', updatePromptPreview));
    $('copyPromptBtn')?.addEventListener('click', async e => {
      await copyText($('promptPreview').value, e.currentTarget, '一键复制 Prompt');
      if ($('promptCopyStatus')) {
        $('promptCopyStatus').textContent = '已复制到剪贴板，直接粘贴给 ChatGPT / DeepSeek / Claude 即可';
        setTimeout(() => { $('promptCopyStatus').textContent = ''; }, 3000);
      }
    });

    document.addEventListener('click', e => {
      const drawerBtn = e.target.closest('[data-open-drawer]');
      if (drawerBtn) {
        openDrawer(drawerBtn.dataset.openDrawer);
        return;
      }
      const copyBtn = e.target.closest('[data-copy-cmd]');
      if (copyBtn) {
        const item = BENCH_COMMANDS.find(x => x.id === copyBtn.dataset.copyCmd);
        if (item) copyText(item.cmd, copyBtn, '复制');
      }
    });
    $('drawerCloseBtn')?.addEventListener('click', closeDrawer);
    $('offerDrawer')?.addEventListener('click', e => {
      if (e.target.id === 'offerDrawer') closeDrawer();
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeDrawer();
    });

    loadLiveStatus();
  } catch (err) {
    if ($('resultText')) $('resultText').textContent = '优惠数据读取失败';
    if ($('dealGrid')) $('dealGrid').innerHTML = `<div class="empty">请通过 Web 服务器访问站点。错误：${safe(err.message)}</div>`;
  }
}

async function loadLeads() {
  const status = $('leadStatus');
  const grid = $('leadGrid');
  if (!status || !grid) return;

  document.querySelectorAll('.lead-tab').forEach(btn => btn.addEventListener('click', () => {
    activeLeadFilter = btn.dataset.leadFilter;
    document.querySelectorAll('.lead-tab').forEach(b => b.classList.toggle('active', b === btn));
    renderLeads();
  }));
  $('leadSearch')?.addEventListener('input', e => {
    leadQuery = e.target.value.trim().toLowerCase();
    renderLeads();
  });

  try {
    let feed = null;
    let via = 'Cloudflare 4H Cron';
    try {
      const apiRes = await fetch('/api/leads', { cache: 'no-store' });
      if (apiRes.ok) {
        const candidate = await apiRes.json();
        if (Array.isArray(candidate.items) && candidate.items.length) feed = candidate;
      }
    } catch {}
    if (!feed) {
      via = '静态兜底快照';
      const response = await fetch('/data/leads.json', { cache: 'no-store' });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      feed = await response.json();
    }
    if (!Array.isArray(feed.items)) throw new Error('线索数据格式不正确');
    const allowHost = /^https:\/\/(?:www\.)?(?:lowendbox\.com|lowendtalk\.com|lowendspirit\.com|blog\.racknerd\.com|laozuo\.org|vpsgo\.com|vpsxxs\.com|vpser\.net)\//i;
    allLeads = feed.items.filter(x => typeof x.title === 'string' && typeof x.source === 'string' && allowHost.test(x.url || ''));
    const okCount = Array.isArray(feed.successful_sources) ? feed.successful_sources.length : new Set(allLeads.map(x => x.source)).size;
    const totalSources = Array.isArray(feed.sources) ? feed.sources.length : okCount;
    status.textContent = feed.updated_at
      ? `最近更新：${new Date(feed.updated_at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })} · ${okCount}/${totalSources} 源 · ${allLeads.length} 条线索 · ${via}${formatCountdown(feed.next_refresh_at)}`
      : '尚未运行首次自动采集';
    renderAiBrief(feed);
    renderLeads();
  } catch {
    status.textContent = '线索读取暂不可用（在售核验榜不受影响）';
  }
}

main();
loadLeads();
