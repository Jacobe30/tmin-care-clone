(function () {
  "use strict";

  var params = new URLSearchParams(window.location.search);
  var isLanding = window.location.pathname === "/" && !params.has("flow");
  var root = document.getElementById("root");
  var frame = document.getElementById("tmin-landing-frame");
  var status = document.getElementById("tmin-landing-status");
  var countryDecision = null;
  var waitingForStart = false;
  var flowLoaded = false;
  var currentScript = null;

  function setStatus(message, visible) {
    if (!status) return;
    status.textContent = message || "";
    status.hidden = !visible;
  }

  function timeoutFetch(url, parser) {
    var controller = window.AbortController ? new AbortController() : null;
    var timer = window.setTimeout(function () {
      if (controller) controller.abort();
    }, 3500);
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
      .finally(function () {
        window.clearTimeout(timer);
      });
  }

  function resolveCountry() {
    var checks = [
      timeoutFetch("https://ipapi.co/country/", function (body) { return body; }),
      timeoutFetch("https://ipwho.is/", function (body) {
        return JSON.parse(body).country_code;
      }),
    ];
    return Promise.allSettled(checks).then(function (results) {
      var countries = results
        .filter(function (result) { return result.status === "fulfilled"; })
        .map(function (result) { return result.value; });
      if (!countries.length) {
        return { allowed: false, country: "ZZ", reason: "unavailable" };
      }
      var allSaudi = countries.every(function (country) { return country === "SA"; });
      return {
        allowed: allSaudi,
        country: allSaudi
          ? "SA"
          : countries.find(function (country) { return country !== "SA"; }) || "ZZ",
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

  function showLead(decision) {
    countryDecision = decision;
    if (frame) {
      frame.hidden = false;
      frame.src = frameUrl(decision);
    }
    setStatus("", false);
  }

  function loadCustomerFlow() {
    if (flowLoaded) return;
    flowLoaded = true;
    if (frame) frame.hidden = true;
    if (root) root.hidden = false;
    document.documentElement.style.overflow = "";
    document.body.style.overflow = "";
    try { window.history.replaceState({}, "", "/?flow=1"); } catch (e) {}
    if (!document.querySelector('link[data-tmin-flow-css]')) {
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
      setStatus("جارٍ التحقق من توفر الخدمة في موقعك…", true);
      return;
    }
    if (!countryDecision.allowed) {
      if (frame && frame.contentWindow) {
        frame.contentWindow.postMessage({ type: "tmin-focus-lead" }, "*");
      }
      return;
    }
    loadCustomerFlow();
  }

  window.addEventListener("message", function (event) {
    if (!frame || event.source !== frame.contentWindow) return;
    if (event.data && event.data.type === "tmin-start-flow") requestStart();
    if (event.data && event.data.type === "tmin-focus-lead" && frame.contentWindow) {
      frame.contentWindow.postMessage({ type: "tmin-focus-lead" }, "*");
    }
  });

  if (!isLanding) {
    if (root) root.hidden = false;
    loadCustomerFlow();
    return;
  }

  if (root) root.hidden = true;
  if (frame) {
    frame.hidden = false;
    frame.src = "/old-landing.html?country=ZZ";
  }

  resolveCountry().then(function (decision) {
    countryDecision = decision;
    if (decision.allowed) {
      if (frame) frame.src = frameUrl(decision);
      setStatus("", false);
      if (waitingForStart) loadCustomerFlow();
    } else {
      showLead(decision);
    }
  }).catch(function () {
    showLead({ allowed: false, country: "ZZ", reason: "unavailable" });
  });
})();
