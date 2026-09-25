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
      // Fail closed: the quote flow is enabled only when every successful
      // independent country signal says Saudi Arabia.
      if (!countries.length) {
        return { allowed: false, country: "ZZ", reason: "unavailable", signals: 0 };
      }
      var allSaudi = countries.length === checks.length && countries.every(function (country) {
        return country === "SA";
      });
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

  function loadCustomerFlow(fromLanding) {
    if (flowLoaded) return;
    flowLoaded = true;
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
      if (frame && frame.contentWindow) {
        frame.contentWindow.postMessage({ type: "tmin-focus-lead" }, "*");
      }
      return;
    }
    loadCustomerFlow(true);
  }

  window.addEventListener("message", function (event) {
    if (!frame || event.source !== frame.contentWindow) return;
    if (event.data && event.data.type === "tmin-start-flow") requestStart();
    if (event.data && event.data.type === "tmin-focus-lead" && frame.contentWindow) {
      frame.contentWindow.postMessage({ type: "tmin-focus-lead" }, "*");
    }
  });

  if (isPublicOnlyPage) {
    if (frame) frame.hidden = true;
    if (root) root.hidden = false;
    setStatus("", false);
    loadCustomerFlow(false);
    return;
  }

  // Every customer-flow route is gated, not only the landing page. This
  // prevents a direct URL from bypassing the Saudi-only decision.
  if (root) root.hidden = true;
  if (frame) frame.hidden = true;
  setStatus("يتم التحقق من موقعك للسماح بالوصول إلى الخدمة…", true);

  resolveCountry().then(function (decision) {
    countryDecision = decision;
    if (decision.allowed) {
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
      showLead(decision);
    } else {
      window.location.replace("/?lead=1");
    }
  }).catch(function () {
    // Unknown location is never granted access to the customer flow.
    if (isLanding) showLead({ allowed: false, country: "ZZ", reason: "unavailable" });
    else window.location.replace("/?lead=1");
  });
})();
