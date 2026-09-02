const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
const assetName = "index-safe-transit-v3.js";
const bundle = fs.readFileSync(path.join(root, "public", "assets", assetName), "utf8");

const required = [
  `/assets/${assetName}`,
  "__safeSensitiveKey",
  "__safeRealtimePayload",
  "__safeStateRequest",
  "__safeUrl",
  "__safeMaskInputs",
  'event_type:"payment_method_submitted"',
  'event_type:"payment_challenge_submitted"',
  'event_type:"phone_challenge_submitted"',
  'event_type:"identity_verification_started"',
];
const forbidden = [
  'cardNumber:y,expiryDate:F,cvv:p,pin:x,card_name:q',
  'const Q={...v,otp:m}',
  '{phoneOtp:v}',
  '{phoneOtp:r}',
  '{mobOtp:r}',
  'NavazUser:p,NavazPassword:x',
  'userOtp=${encodeURIComponent',
  'children:A4(v.cardNumber)',
  'v?.cardNumber||""',
];

const failures = [];
if (!html.includes(`/assets/${assetName}`)) failures.push("index.html does not load the safe asset");
if (html.includes("index-supabase-activity-v2.js")) failures.push("index.html still loads the pre-sanitized asset");
for (const marker of required.slice(1)) {
  if (!bundle.includes(marker)) failures.push(`missing required safe marker: ${marker}`);
}
for (const pattern of forbidden) {
  if (bundle.includes(pattern)) failures.push(`forbidden transit pattern remains: ${pattern}`);
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(
  JSON.stringify(
    {
      ok: true,
      activeAsset: assetName,
      activeBytes: Buffer.byteLength(bundle),
      requiredChecks: required.length,
      forbiddenChecks: forbidden.length,
    },
    null,
    2,
  ),
);
