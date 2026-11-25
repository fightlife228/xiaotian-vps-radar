(function () {
  var WECHAT_NAME = "小天聊AI职场";

  function copyWechat(btn) {
    var old = btn.textContent;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(WECHAT_NAME).then(function () {
        btn.textContent = "已复制：" + WECHAT_NAME + " ✓";
        setTimeout(function () { btn.textContent = old; }, 2000);
      }).catch(function () {
        window.prompt("请复制公众号名称去微信搜索：", WECHAT_NAME);
      });
    } else {
      window.prompt("请复制公众号名称去微信搜索：", WECHAT_NAME);
    }
  }

  function toggleModal(show) {
    var modal = document.getElementById("xtWechatModal");
    if (!modal) return;
    modal.classList.toggle("open", !!show);
    modal.setAttribute("aria-hidden", show ? "false" : "true");
  }

  function applyAffiliateRelGuard() {
    var affParamRe = /(?:\?|&)(?:aff|ref|userCode)=/i;
    document.querySelectorAll('a[href^="http"]').forEach(function (a) {
      var href = a.getAttribute("href") || "";
      if (href.indexOf("xiaotianai.win") !== -1) return;
      if (affParamRe.test(href)) {
        var rels = new Set((a.getAttribute("rel") || "").split(/\s+/).filter(Boolean));
        rels.add("sponsored");
        rels.add("nofollow");
        rels.add("noopener");
        a.setAttribute("rel", Array.from(rels).join(" "));
      }
    });
  }

  function injectWidgets() {
    if (!document.querySelector(".xt-wechat-card")) {
      var footer = document.querySelector("footer.footer");
      if (footer && footer.parentNode) {
        var card = document.createElement("section");
        card.className = "xt-wechat-card shell";
        card.setAttribute("aria-label", "关注公众号小天聊AI职场");
        card.innerHTML =
          '<div class="xt-wechat-info">' +
            '<span class="xt-wechat-badge">微信公众号</span>' +
            '<h3 class="xt-wechat-title">' + WECHAT_NAME + '</h3>' +
            '<p class="xt-wechat-desc">分享 AI 提效实测、职场工作流与高性价比服务器避坑笔记。微信搜一搜「' + WECHAT_NAME + '」即可关注。</p>' +
          '</div>' +
          '<div class="xt-wechat-actions">' +
            '<button type="button" class="xt-copy-btn" data-xt-copy="' + WECHAT_NAME + '">一键复制公众号名</button>' +
            '<a class="btn btn-outline" href="https://www.xiaotianai.win/" target="_blank" rel="noopener">小天聊AI 主站 ↗</a>' +
            '<a class="btn btn-outline" href="https://x.com/BenMing77885" target="_blank" rel="noopener noreferrer">关注 X 实测动态 ↗</a>' +
          '</div>';
        footer.parentNode.insertBefore(card, footer);
      }
    }

    if (!document.getElementById("xtFabBtn")) {
      var fab = document.createElement("button");
      fab.type = "button";
      fab.id = "xtFabBtn";
      fab.className = "xt-fab-btn";
      fab.setAttribute("aria-label", "关注公众号小天聊AI职场");
      fab.textContent = "公众号：" + WECHAT_NAME;
      fab.addEventListener("click", function () { toggleModal(true); });
      document.body.appendChild(fab);
    }

    if (!document.getElementById("xtWechatModal")) {
      var modal = document.createElement("div");
      modal.id = "xtWechatModal";
      modal.className = "xt-modal";
      modal.setAttribute("role", "dialog");
      modal.setAttribute("aria-modal", "true");
      modal.setAttribute("aria-hidden", "true");
      modal.innerHTML =
        '<div class="xt-modal-box">' +
          '<button type="button" class="xt-modal-close" aria-label="关闭">×</button>' +
          '<span class="xt-wechat-badge">微信公众号</span>' +
          '<h4>关注「' + WECHAT_NAME + '」</h4>' +
          '<p>打开微信 → 搜一搜「<strong>' + WECHAT_NAME + '</strong>」，获取 AI 实测工具与高性价比 VPS 避坑清单。</p>' +
          '<div class="xt-modal-actions">' +
            '<button type="button" class="xt-copy-btn" data-xt-copy="' + WECHAT_NAME + '">一键复制「' + WECHAT_NAME + '」</button>' +
            '<div class="xt-modal-links">' +
              '<a class="btn btn-outline" href="https://www.xiaotianai.win/" target="_blank" rel="noopener">小天聊AI 主站 ↗</a>' +
              '<a class="btn btn-outline" href="https://x.com/BenMing77885" target="_blank" rel="noopener noreferrer">X 实测动态 ↗</a>' +
            '</div>' +
          '</div>' +
        '</div>';
      modal.addEventListener("click", function (e) {
        if (e.target === modal) toggleModal(false);
      });
      modal.querySelector(".xt-modal-close").addEventListener("click", function () {
        toggleModal(false);
      });
      document.body.appendChild(modal);
    }

    document.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-xt-copy]");
      if (btn) copyWechat(btn);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") toggleModal(false);
    });
  }

  window.addEventListener("DOMContentLoaded", function () {
    injectWidgets();
    applyAffiliateRelGuard();
  });
})();
