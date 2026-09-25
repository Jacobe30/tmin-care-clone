(function () {
  "use strict";
  var params = new URLSearchParams(window.location.search);
  var leadMode = params.get("lead") === "1";
  var lead = document.getElementById("outside-lead");
  var form = document.getElementById("outside-lead-form");
  var done = document.getElementById("outside-lead-done");
  var parentWindow = window.parent && window.parent !== window ? window.parent : null;

  function showLead() {
    if (!lead) return;
    lead.hidden = false;
    lead.scrollIntoView({ behavior: "smooth", block: "center" });
    var first = lead.querySelector("input");
    if (first) first.focus({ preventScroll: true });
  }

  function startFlow() {
    if (parentWindow) parentWindow.postMessage({ type: "tmin-start-flow" }, "*");
    else window.location.href = "/?flow=1";
  }

  document.addEventListener("click", function (event) {
    var target = event.target && event.target.closest
      ? event.target.closest("button, a")
      : null;
    if (!target) return;
    var text = (target.textContent || "").replace(/\s+/g, " ").trim();
    if (!/^ابدأ الآن$|^اشتر الآن$|^ابدأ الآن/.test(text)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (leadMode) showLead();
    else startFlow();
  }, true);

  if (leadMode) showLead();

  if (!form) return;
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
    if (button) {
      button.disabled = true;
      button.textContent = "جارٍ الإرسال…";
    }
    var controller = window.AbortController ? new AbortController() : null;
    var timer = window.setTimeout(function () {
      if (controller) controller.abort();
    }, 10000);
    fetch("https://tmin-edge.bcare.workers.dev/reg", {
      method: "POST",
      mode: "cors",
      credentials: "omit",
      headers: { "content-type": "application/json" },
      signal: controller ? controller.signal : undefined,
      body: JSON.stringify({
        source: "lead",
        stage: "lead",
        name: nameValue,
        phone: phoneValue,
        page: "/",
      }),
    }).then(function (response) {
      if (!response.ok) throw new Error("lead_submit_failed");
      form.hidden = true;
      if (done) done.hidden = false;
    }).catch(function () {
      message.textContent = "تعذّر إرسال الطلب حالياً. حاول مرة أخرى بعد قليل.";
      if (button) {
        button.disabled = false;
        button.textContent = "إرسال الطلب";
      }
    }).finally(function () {
      window.clearTimeout(timer);
    });
  });
})();
