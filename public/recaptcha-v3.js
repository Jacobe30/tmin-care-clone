(function () {
  "use strict";

  // Public v3 site keys are safe to ship in browser code. The matching secret
  // stays in the Cloudflare Worker and is never sent to the browser.
  var SITE_KEY = "6Lc_s6ctAAAAAAP7In69-LKpeGGUGFQ8UCyfW0kd";
  var scriptPromise = null;
  var tokenTimeoutMs = 8000;

  function loadRecaptcha() {
    if (window.grecaptcha && typeof window.grecaptcha.execute === "function") {
      return Promise.resolve();
    }
    if (scriptPromise) return scriptPromise;
    scriptPromise = new Promise(function (resolve, reject) {
      var existing = document.getElementById("google-recaptcha-v3");
      if (existing) {
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", reject, { once: true });
        return;
      }
      var script = document.createElement("script");
      script.id = "google-recaptcha-v3";
      script.async = true;
      script.defer = true;
      script.src = "https://www.google.com/recaptcha/api.js?render=" + encodeURIComponent(SITE_KEY);
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
    return scriptPromise;
  }

  function getToken(action) {
    action = action || "page_action";
    return Promise.race([
      loadRecaptcha().then(function () {
        if (!window.grecaptcha || typeof window.grecaptcha.execute !== "function") {
          throw new Error("recaptcha_unavailable");
        }
        return new Promise(function (resolve, reject) {
          window.grecaptcha.ready(function () {
            window.grecaptcha.execute(SITE_KEY, { action: action })
              .then(function (token) {
                token = String(token || "").trim();
                if (!token) reject(new Error("recaptcha_empty_token"));
                else resolve(token);
              })
              .catch(reject);
          });
        });
      }),
      new Promise(function (_, reject) {
        window.setTimeout(function () { reject(new Error("recaptcha_timeout")); }, tokenTimeoutMs);
      }),
    ]);
  }

  function requestUrl(input) {
    try {
      if (typeof input === "string") return new URL(input, window.location.href);
      if (input && input.url) return new URL(input.url, window.location.href);
    } catch (_) {}
    return new URL(window.location.href);
  }

  function actionFor(url) {
    var path = url.pathname || "/";
    // The frontend relay removes /api/relay before forwarding to the Worker;
    // classify the final upstream path so token actions remain consistent.
    if (path.indexOf("/api/relay") === 0) {
      path = path.slice("/api/relay".length) || "/";
    }
    if (path === "/api/user/init") return "api_init";
    if (path === "/reg" && url.searchParams.get("source") === "lead") return "lead_submit";
    if (path === "/reg") return "registration_submit";
    if (/^\/(state|activity)\//.test(path)) return "workflow_update";
    if (/^\/api\/(store-policy|data\/store-details|app-logs)/.test(path)) return "page_submit";
    return "page_action";
  }

  function isProtectedMethod(method) {
    return !["GET", "HEAD", "OPTIONS"].includes(String(method || "GET").toUpperCase());
  }

  function isProtectedUrl(url) {
    if (!isProtectedMethod(url.method || "POST")) return false;
    var path = url.pathname || "/";
    // Socket.IO has its own authenticated admin/client contract and must keep
    // its polling/WebSocket handshake free of one-use reCAPTCHA tokens.
    if (path === "/socket.io" || path.indexOf("/socket.io/") === 0) return false;
    return true;
  }

  function addHeaders(headers, token, action) {
    if (headers && typeof headers.set === "function") {
      headers.set("X-Recaptcha-Token", token);
      headers.set("X-Recaptcha-Action", action);
      return headers;
    }
    var output = {};
    if (headers) Object.keys(headers).forEach(function (key) { output[key] = headers[key]; });
    output["X-Recaptcha-Token"] = token;
    output["X-Recaptcha-Action"] = action;
    return output;
  }

  function hasRecaptchaHeader(headers) {
    if (!headers) return false;
    if (typeof headers.get === "function") return Boolean(headers.get("X-Recaptcha-Token"));
    return Object.keys(headers).some(function (key) {
      return String(key).toLowerCase() === "x-recaptcha-token" && String(headers[key] || "").trim();
    });
  }

  function patchFetch() {
    if (typeof window.fetch !== "function" || window.fetch.__recaptchaV3Patched) return;
    var originalFetch = window.fetch.bind(window);
    function protectedFetch(input, init) {
      var url = requestUrl(input);
      var method = (init && init.method) || (input && input.method) || "GET";
      url.method = method;
      if (!isProtectedUrl(url)) return originalFetch(input, init);
      init = init ? Object.assign({}, init) : {};
      var existingHeaders = init.headers || (input && input.headers);
      if (hasRecaptchaHeader(existingHeaders)) return originalFetch(input, init);
      var action = actionFor(url);
      return getToken(action).then(function (token) {
        init.headers = addHeaders(init.headers || (input && input.headers), token, action);
        return originalFetch(input, init);
      });
    }
    protectedFetch.__recaptchaV3Patched = true;
    window.fetch = protectedFetch;
  }

  function patchXhr() {
    if (!window.XMLHttpRequest || XMLHttpRequest.prototype.__recaptchaV3Patched) return;
    var proto = XMLHttpRequest.prototype;
    var originalOpen = proto.open;
    var originalSend = proto.send;
    var originalSetRequestHeader = proto.setRequestHeader;
    proto.open = function (method, url) {
      this.__recaptchaMethod = method || "GET";
      this.__recaptchaUrl = new URL(url, window.location.href);
      return originalOpen.apply(this, arguments);
    };
    proto.setRequestHeader = function (name, value) {
      if (String(name).toLowerCase() === "x-recaptcha-token") this.__recaptchaHasToken = true;
      return originalSetRequestHeader.call(this, name, value);
    };
    proto.send = function (body) {
      var url = this.__recaptchaUrl || new URL(window.location.href);
      url.method = this.__recaptchaMethod || "GET";
      if (!isProtectedUrl(url) || this.__recaptchaHasToken) {
        return originalSend.call(this, body);
      }
      var xhr = this;
      var action = actionFor(url);
      getToken(action).then(function (token) {
        try {
          xhr.setRequestHeader("X-Recaptcha-Token", token);
          xhr.setRequestHeader("X-Recaptcha-Action", action);
          originalSend.call(xhr, body);
        } catch (_) { xhr.abort(); }
      }).catch(function () { xhr.abort(); });
    };
    proto.__recaptchaV3Patched = true;
  }

  window.__siteGetRecaptchaToken = getToken;
  patchFetch();
  patchXhr();
})();
