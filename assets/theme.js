(function () {
  var KEY = "vps_radar_theme";
  function apply(theme) {
    var mode = theme === "dark" ? "dark" : "light";
    document.documentElement.dataset.theme = mode;
    var meta = document.querySelector('meta[name="color-scheme"]');
    if (meta) meta.setAttribute("content", mode === "dark" ? "dark light" : "light dark");
    document.querySelectorAll("[data-theme-toggle]").forEach(function (btn) {
      btn.setAttribute("aria-label", mode === "dark" ? "切换至工程亮色" : "切换至专业暗黑");
      btn.setAttribute("title", mode === "dark" ? "当前：专业暗黑（点击切工程亮色）" : "当前：工程亮色（点击切专业暗黑）");
      btn.textContent = mode === "dark" ? "☀️" : "🌙";
    });
  }
  var saved = "light";
  try { saved = localStorage.getItem(KEY) || "light"; } catch (e) {}
  apply(saved);
  window.addEventListener("DOMContentLoaded", function () {
    apply(document.documentElement.dataset.theme || "light");
    document.querySelectorAll("[data-theme-toggle]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
        try { localStorage.setItem(KEY, next); } catch (e) {}
        apply(next);
      });
    });
  });
})();
