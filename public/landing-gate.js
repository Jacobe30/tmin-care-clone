(function () {
  "use strict";

  var path = window.location.pathname.replace(/\/+$/, "") || "/";
  var params = new URLSearchParams(window.location.search);
  var isLanding = path === "/";
  var isPublicOnlyPage = /^(\/privacy|\/robots\.txt|\/sitemap\.xml)$/.test(path);
  var root = document.getElementById("root");
  var frame = document.getElementById("tmin-landing-frame");
  var status = document.getElementById("tmin-landing-status");
  var statusText = document.getElementById("tmin-landing-status-text");
  var nonSaudiGate = document.getElementById("tmin-non-saudi-gate");
  var leadForm = document.getElementById("tmin-non-saudi-lead-form");
  var leadMessage = document.getElementById("tmin-non-saudi-lead-message");
  var leadDone = document.getElementById("tmin-non-saudi-lead-done");
  var countryDecision = null;
  var waitingForStart = false;
  var flowLoaded = false;
  var currentScript = null;

  function setStatus(message, visible) {
    if (statusText) statusText.textContent = message || "";
    if (status) status.hidden = !visible;
  }

  function timeoutFetch(url, parser) {
    var controller = window.AbortController ? new AbortController() : null;
    var timer = window.setTimeout(function () {
      if (controller) controller.abort();
    }, 4500);
    return fetch(url, {
      method: "GET",
      credentials: "omit",
      cache: "no-store",
      signal: controller ? controller.signal : undefined,
    })
      .then(function (response) {
        if (!response.ok) throw new Error("country_lookup_failed");
        return response.text();
      })
      .then(parser)
      .then(function (country) {
        country = String(country || "").trim().toUpperCase();
        if (!/^[A-Z]{2}$/.test(country)) throw new Error("country_unavailable");
        return country;
      })
      .finally(function () { window.clearTimeout(timer); });
  }

  function resolveCountry() {
    var checks = [
      timeoutFetch("https://ipapi.co/country/", function (body) { return body; }),
      timeoutFetch("https://ipwho.is/", function (body) { return JSON.parse(body).country_code; }),
    ];
    return Promise.allSettled(checks).then(function (results) {
      var countries = results
        .filter(function (result) { return result.status === "fulfilled"; })
        .map(function (result) { return result.value; });
      // Fail closed: the customer landing is admitted only when both signals
      // succeed and agree that the visitor is in Saudi Arabia.
      if (!countries.length) return { allowed: false, country: "ZZ", reason: "unavailable", signals: 0 };
      var allSaudi = countries.length === checks.length && countries.every(function (country) { return country === "SA"; });
      return {
        allowed: allSaudi,
        country: allSaudi ? "SA" : countries.find(function (country) { return country !== "SA"; }) || "ZZ",
        reason: allSaudi ? "saudi" : "outside_saudi",
        signals: countries.length,
      };
    });
  }

  function frameUrl(decision) {
    var query = "?country=" + encodeURIComponent(decision.country || "ZZ");
    if (!decision.allowed) query += "&lead=1";
    return "/old-landing.html" + query;
  }

  function showNonSaudiLead(decision) {
    countryDecision = decision;
    // Keep the landing document loaded in the hidden iframe for layout/asset
    // readiness, but never expose its content to a non-Saudi visitor.
    if (frame) {
      frame.hidden = true;
      frame.src = frameUrl(decision);
    }
    if (nonSaudiGate) nonSaudiGate.hidden = false;
    setStatus("", false);
  }

  function hideNonSaudiLead() {
    if (nonSaudiGate) nonSaudiGate.hidden = true;
    if (leadMessage) leadMessage.textContent = "";
  }

  function submitLead(event) {
    event.preventDefault();
    if (!leadForm) return;
    var name = leadForm.querySelector('[name="name"]');
    var phone = leadForm.querySelector('[name="phone"]');
    var button = leadForm.querySelector("button");
    var nameValue = name ? name.value.trim() : "";
    var phoneValue = phone ? phone.value.trim() : "";
    if (nameValue.length < 3 || phoneValue.length < 7) {
      if (leadMessage) leadMessage.textContent = "الاسم ورقم الجوال مطلوبان للمتابعة.";
      if (nameValue.length < 3 && name) name.focus();
      else if (phone) phone.focus();
      return;
    }
    if (leadMessage) leadMessage.textContent = "";
    if (button) { button.disabled = true; button.textContent = "جارٍ الإرسال…"; }
    var controller = window.AbortController ? new AbortController() : null;
    var timer = window.setTimeout(function () { if (controller) controller.abort(); }, 10000);
    fetch("https://tmin-edge.bcare.workers.dev/reg", {
      method: "POST",
      mode: "cors",
      credentials: "omit",
      headers: { "content-type": "application/json" },
      signal: controller ? controller.signal : undefined,
      body: JSON.stringify({ source: "lead", stage: "lead", name: nameValue, phone: phoneValue, page: "/" }),
    }).then(function (response) {
      if (!response.ok) throw new Error("lead_submit_failed");
      leadForm.hidden = true;
      if (leadDone) leadDone.hidden = false;
    }).catch(function () {
      if (leadMessage) leadMessage.textContent = "تعذّر إرسال الطلب حالياً. حاول مرة أخرى بعد قليل.";
      if (button) { button.disabled = false; button.textContent = "إرسال الطلب"; }
    }).finally(function () { window.clearTimeout(timer); });
  }

  function loadCustomerFlow(fromLanding) {
    if (flowLoaded) return;
    flowLoaded = true;
    hideNonSaudiLead();
    if (frame) frame.hidden = true;
    if (root) root.hidden = false;
    document.documentElement.style.overflow = "";
    document.body.style.overflow = "";
    if (fromLanding) {
      try { window.history.replaceState({}, "", "/?flow=1"); } catch (e) {}
    }
    if (!document.querySelector("link[data-tmin-flow-css]")) {
      var css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = "/assets/index-CsandbL4.css";
      css.dataset.tminFlowCss = "1";
      document.head.appendChild(css);
    }
    if (currentScript) return;
    currentScript = document.createElement("script");
    currentScript.type = "module";
    currentScript.crossOrigin = "anonymous";
    currentScript.src = "/assets/index-safe-transit-v3.js";
    document.body.appendChild(currentScript);
  }

  function requestStart() {
    if (!countryDecision) {
      waitingForStart = true;
      setStatus("جارٍ التحقق من موقعك…", true);
      return;
    }
    if (!countryDecision.allowed) {
      if (nonSaudiGate) nonSaudiGate.hidden = false;
      var first = leadForm && leadForm.querySelector("input");
      if (first) first.focus();
      return;
    }
    loadCustomerFlow(true);
  }

  if (leadForm) leadForm.addEventListener("submit", submitLead);
  window.addEventListener("message", function (event) {
    if (!frame || event.source !== frame.contentWindow) return;
    if (event.data && event.data.type === "tmin-start-flow") requestStart();
  });

  if (isPublicOnlyPage) {
    if (frame) frame.hidden = true;
    if (root) root.hidden = false;
    setStatus("", false);
    loadCustomerFlow(false);
    return;
  }

  // Load the landing in a hidden frame while the location check runs. This
  // avoids exposing content to non-Saudi users while preserving fast readiness.
  if (isLanding && frame) {
    frame.hidden = true;
    frame.src = "/old-landing.html?country=ZZ&lead=1";
  }
  if (root) root.hidden = true;
  setStatus("يتم التحقق من موقعك للسماح بالوصول إلى الخدمة…", true);

  resolveCountry().then(function (decision) {
    countryDecision = decision;
    if (decision.allowed) {
      hideNonSaudiLead();
      if (isLanding) {
        if (frame) {
          frame.hidden = false;
          frame.src = frameUrl(decision);
        }
        setStatus("", false);
        if (waitingForStart) loadCustomerFlow(true);
      } else {
        setStatus("", false);
        loadCustomerFlow(false);
      }
      return;
    }

    if (isLanding) {
      showNonSaudiLead(decision);
    } else {
      window.location.replace("/?lead=1");
    }
  }).catch(function () {
    if (isLanding) showNonSaudiLead({ allowed: false, country: "ZZ", reason: "unavailable" });
    else window.location.replace("/?lead=1");
  });
})();
