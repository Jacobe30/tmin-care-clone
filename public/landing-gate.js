(function () {
  "use strict";

  var path = window.location.pathname.replace(/\/+$/, "") || "/";
  var isLanding = path === "/";
  var isPublicOnlyPage = /^(\/privacy|\/robots\.txt|\/sitemap\.xml)$/.test(path);
  var root = document.getElementById("root");
  var frame = document.getElementById("tmin-landing-frame");
  var nonSaudiSpinner = document.getElementById("tmin-non-saudi-spinner");
  var countryDecision = null;
  var waitingForStart = false;
  var pendingLeadScroll = false;
  var touchY = null;
  var flowLoaded = false;
  var currentScript = null;

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

  function scrollUnderlayToLead() {
    pendingLeadScroll = true;
    if (!frame || !frame.contentWindow) return;
    frame.contentWindow.postMessage({ type: "tmin-scroll-to-lead" }, "*");
    window.setTimeout(function () {
      if (frame && frame.contentWindow) {
        frame.contentWindow.postMessage({ type: "tmin-scroll-to-lead" }, "*");
      }
      pendingLeadScroll = false;
    }, 250);
  }

  function scrollUnderlayBy(deltaY) {
    if (!frame || !frame.contentWindow || !Number.isFinite(deltaY) || deltaY === 0) return;
    frame.contentWindow.postMessage({ type: "tmin-scroll-by", deltaY: deltaY }, "*");
  }

  function showLanding(decision) {
    if (!frame) return;
    frame.hidden = false;
    if (!decision.allowed) {
      frame.onload = function () {
        if (pendingLeadScroll) scrollUnderlayToLead();
      };
    }
    frame.src = frameUrl(decision);
    // The spinner is deliberately non-blocking: the page remains normal and
    // clickable underneath it, but the overlay stays forever for non-Saudi.
    if (nonSaudiSpinner) nonSaudiSpinner.hidden = !!decision.allowed;
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
      return;
    }
    if (!countryDecision.allowed) return;
    loadCustomerFlow(true);
  }

  if (nonSaudiSpinner) {
    nonSaudiSpinner.addEventListener("wheel", function (event) {
      event.preventDefault();
      scrollUnderlayBy(event.deltaY);
    }, { passive: false });
    nonSaudiSpinner.addEventListener("touchstart", function (event) {
      touchY = event.touches && event.touches[0] ? event.touches[0].clientY : null;
    }, { passive: true });
    nonSaudiSpinner.addEventListener("touchmove", function (event) {
      var currentY = event.touches && event.touches[0] ? event.touches[0].clientY : null;
      if (touchY === null || currentY === null) return;
      event.preventDefault();
      scrollUnderlayBy(touchY - currentY);
      touchY = currentY;
    }, { passive: false });
    nonSaudiSpinner.addEventListener("touchend", function () { touchY = null; }, { passive: true });
    nonSaudiSpinner.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      scrollUnderlayToLead();
    });
  }

  window.addEventListener("message", function (event) {
    if (!frame || event.source !== frame.contentWindow) return;
    if (event.data && event.data.type === "tmin-start-flow") requestStart();
  });

  if (isPublicOnlyPage) {
    if (frame) frame.hidden = true;
    if (root) root.hidden = false;
    if (nonSaudiSpinner) nonSaudiSpinner.hidden = true;
    loadCustomerFlow(false);
    return;
  }

  // The landing is visible immediately. Geo detection runs in the background;
  // it only decides whether a CTA may enter the customer flow.
  if (isLanding && frame) {
    frame.hidden = false;
    frame.src = "/old-landing.html?country=ZZ";
  }
  if (nonSaudiSpinner) nonSaudiSpinner.hidden = false;

  resolveCountry().then(function (decision) {
    countryDecision = decision;
    if (isLanding) {
      showLanding(decision);
      if (waitingForStart && decision.allowed) loadCustomerFlow(true);
    } else if (decision.allowed) {
      loadCustomerFlow(false);
    } else {
      window.location.replace("/");
    }
  }).catch(function () {
    countryDecision = { allowed: false, country: "ZZ", reason: "unavailable" };
    if (!isLanding) window.location.replace("/");
    else showLanding(countryDecision);
  });
})();
