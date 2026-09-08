/* Saudi-only availability gate with a mobile CAPTCHA step.
 * A successful challenge is kept only for the current browser tab/session.
 */
(function () {
  "use strict";

  var COUNTRY_ENDPOINTS = [
    { url: "https://ipapi.co/country/", parse: function (text) { return text.trim(); } },
    { url: "https://ipwho.is/", parse: function (text) { return JSON.parse(text).country_code; } },
    { url: "https://freeipapi.com/api/json", parse: function (text) { return JSON.parse(text).countryCode; } }
  ];
  var LOOKUP_TIMEOUT_MS = 3500;
  var VERIFIED_KEY = "tmin_sa_mobile_captcha_verified";
  var MOBILE_UA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i;

  function isMobile() {
    var uaMobile = MOBILE_UA.test(navigator.userAgent || "");
    var compactTouch = window.matchMedia && window.matchMedia("(max-width: 767px) and (pointer: coarse)").matches;
    return uaMobile || !!compactTouch;
  }

  function addStyles() {
    var style = document.createElement("style");
    style.textContent =
      "#tmin-geo-captcha-gate{position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(15,23,42,.58);font-family:Arial,sans-serif;direction:rtl}" +
      "#tmin-geo-captcha-gate .tmin-gate-card{width:min(100%,390px);box-sizing:border-box;background:#fff;border-radius:16px;padding:26px 22px;box-shadow:0 18px 50px rgba(0,0,0,.25);text-align:right}" +
      "#tmin-geo-captcha-gate h1{margin:0 0 10px;color:#172554;font-size:22px;line-height:1.45}" +
      "#tmin-geo-captcha-gate p{margin:0 0 18px;color:#475569;font-size:15px;line-height:1.7}" +
      "#tmin-geo-captcha-gate .tmin-captcha-code{display:flex;align-items:center;justify-content:center;letter-spacing:9px;direction:ltr;font-size:27px;font-weight:700;color:#172554;background:#f1f5f9;border:1px dashed #94a3b8;border-radius:10px;padding:13px;margin-bottom:12px;user-select:none}" +
      "#tmin-geo-captcha-gate label{display:block;margin-bottom:7px;color:#334155;font-weight:600;font-size:14px}" +
      "#tmin-geo-captcha-gate input{box-sizing:border-box;width:100%;padding:12px;border:1px solid #cbd5e1;border-radius:9px;font-size:20px;letter-spacing:5px;text-align:center;direction:ltr;outline:none}" +
      "#tmin-geo-captcha-gate input:focus{border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,.15)}" +
      "#tmin-geo-captcha-gate button{width:100%;margin-top:15px;padding:12px;border:0;border-radius:9px;background:#2563eb;color:#fff;font-size:16px;font-weight:700;cursor:pointer}" +
      "#tmin-geo-captcha-gate button:hover{background:#1d4ed8}" +
      "#tmin-geo-captcha-gate .tmin-gate-error{min-height:21px;margin-top:9px;color:#b91c1c;font-size:13px}";
    document.head.appendChild(style);
  }

  function randomCode() {
    return String(Math.floor(1000 + Math.random() * 9000));
  }

  function showKsaAvailability() {
    if (document.getElementById("tmin-geo-captcha-gate")) return;
    addStyles();
    var gate = document.createElement("div");
    gate.id = "tmin-geo-captcha-gate";
    gate.innerHTML =
      '<section class="tmin-gate-card" role="dialog" aria-modal="true" aria-labelledby="tmin-gate-title">' +
      '<h1 id="tmin-gate-title">الخدمة متاحة داخل المملكة العربية السعودية فقط</h1>' +
      '<p>نعتذر، خدماتنا متاحة حاليًا للمستخدمين داخل المملكة العربية السعودية.</p>' +
      "</section>";
    document.body.appendChild(gate);
  }

  function showGate() {
    if (sessionStorage.getItem(VERIFIED_KEY) === "1") return;
    addStyles();
    var code = randomCode();
    var gate = document.createElement("div");
    gate.id = "tmin-geo-captcha-gate";
    gate.innerHTML =
      '<section class="tmin-gate-card" role="dialog" aria-modal="true" aria-labelledby="tmin-gate-title">' +
      '<h1 id="tmin-gate-title">التحقق من المستخدم</h1>' +
      '<p>للمتابعة من داخل المملكة العربية السعودية، أدخل الرمز الظاهر أدناه.</p>' +
      '<div class="tmin-captcha-code" aria-label="رمز التحقق">' + code.split("").join(" ") + "</div>" +
      '<label for="tmin-gate-input">رمز التحقق</label>' +
      '<input id="tmin-gate-input" inputmode="numeric" autocomplete="off" maxlength="4" aria-describedby="tmin-gate-error">' +
      '<div id="tmin-gate-error" class="tmin-gate-error" role="alert"></div>' +
      '<button type="button" id="tmin-gate-submit">متابعة</button>' +
      "</section>";
    document.body.appendChild(gate);
    var input = document.getElementById("tmin-gate-input");
    var error = document.getElementById("tmin-gate-error");
    var submit = document.getElementById("tmin-gate-submit");
    function verify() {
      if (input.value.trim() !== code) {
        error.textContent = "رمز التحقق غير صحيح. حاول مرة أخرى.";
        input.select();
        return;
      }
      sessionStorage.setItem(VERIFIED_KEY, "1");
      gate.remove();
    }
    submit.addEventListener("click", verify);
    input.addEventListener("keydown", function (event) { if (event.key === "Enter") verify(); });
    input.focus();
  }

  function lookupCountry(index) {
    index = index || 0;
    if (index >= COUNTRY_ENDPOINTS.length) return Promise.reject(new Error("country lookup failed"));
    var provider = COUNTRY_ENDPOINTS[index];
    var controller = window.AbortController ? new AbortController() : null;
    var timer = window.setTimeout(function () { if (controller) controller.abort(); }, LOOKUP_TIMEOUT_MS);
    return fetch(provider.url, {
      method: "GET",
      credentials: "omit",
      cache: "no-store",
      signal: controller ? controller.signal : undefined
    }).then(function (response) {
      if (!response.ok) throw new Error("country lookup failed");
      return response.text();
    }).then(function (body) {
      var country = provider.parse(body);
      if (!country) throw new Error("country unavailable");
      return country.trim().toUpperCase();
    }).catch(function () {
      return lookupCountry(index + 1);
    }).finally(function () { window.clearTimeout(timer); });
  }

  function start() {
    if (sessionStorage.getItem(VERIFIED_KEY) === "1") return;
    lookupCountry().then(function (country) {
      if (country !== "SA" || !isMobile()) {
        showKsaAvailability();
      } else {
        showGate();
      }
    }).catch(function () {
      // Fail open only when all geo providers are unavailable.
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
