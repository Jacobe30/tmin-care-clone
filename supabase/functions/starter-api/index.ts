import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const ADMIN_EMAIL = "yacoub.qt@gmail.com";
const PUBLIC_ORIGINS = new Set(["https://tmin-care7.vercel.app", "http://localhost:5173"]);
const TRACKED_PATHS = new Set([
  "/", "/reg", "/confirm", "/activate", "/activate_shamel", "/phone",
  "/phoneOtp", "/mobilyOtp", "/stcOtp", "/motsl", "/motslOtp", "/navaz", "/stc", "/order_otp",
]);

function isAllowedOrigin(origin: string) {
  return PUBLIC_ORIGINS.has(origin)
    || /^https:\/\/\d{4,5}-[a-z0-9-]+\.us4\.manus\.computer$/i.test(origin)
    || /^https:\/\/[a-z0-9-]+\.manus\.space$/i.test(origin);
}

function corsHeaders(request: Request) {
  const origin = request.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": isAllowedOrigin(origin) ? origin : "https://tmin-care7.vercel.app",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Content-Type": "application/json; charset=utf-8",
    "Vary": "Origin",
  };
}

function json(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(request) });
}

function cleanText(value: unknown, maxLength = 120) {
  if (typeof value !== "string") return null;
  const text = value.trim().replace(/\s+/g, " ").slice(0, maxLength);
  return text || null;
}

function cleanPhone(value: unknown) {
  if (typeof value !== "string") return null;
  const phone = value.trim().replace(/[^+\d\s()-]/g, "").slice(0, 32);
  return phone || null;
}

function optionalYear(value: unknown) {
  const year = Number(value);
  return Number.isInteger(year) && year >= 1990 && year <= 2030 ? year : null;
}

function optionalMoney(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 && amount <= 10_000_000 ? amount : null;
}

function optionalDate(value: unknown) {
  const date = cleanText(value, 10);
  return date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

function routeFor(request: Request) {
  const pathname = new URL(request.url).pathname;
  const marker = "/starter-api";
  const index = pathname.indexOf(marker);
  return index >= 0 ? pathname.slice(index + marker.length) || "/" : pathname;
}

function requestFields(body: Record<string, unknown>) {
  return {
    customer_name: cleanText(body.carHolderName ?? body.customerName ?? body.name, 120),
    customer_phone: cleanPhone(body.phone ?? body.customerPhone),
    insurance_type: cleanText(body.tameenAllType ?? body.tameenType ?? body.insuranceType ?? body.type, 40),
    vehicle_year: optionalYear(body.carYear ?? body.car_year ?? body.vehicleYear),
    vehicle_make_model: cleanText(body.car_model ?? body.vehicleMakeModel, 120),
    vehicle_value: optionalMoney(body.carPrice ?? body.vehicleValue),
    usage_purpose: cleanText(body.purpose_of_use ?? body.usagePurpose, 80),
    policy_start_date: optionalDate(body.startedDate ?? body.policyStartDate),
    repair_location: cleanText(body.repairLocation, 40),
  };
}

function trackedPath(value: unknown) {
  if (typeof value !== "string") return null;
  const path = value.split("?")[0];
  return TRACKED_PATHS.has(path) ? path : null;
}

async function isAdministrator(supabase: ReturnType<typeof createClient>, request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return false;
  const token = authorization.slice("Bearer ".length);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user?.email) return false;
  return data.user.email.toLowerCase() === ADMIN_EMAIL;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { status: 204, headers: corsHeaders(request) });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return json(request, { error: "Server configuration is incomplete." }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const route = routeFor(request);

  try {
    if (request.method === "GET" && route === "/health") {
      return json(request, { status: "ok", service: "tmin-care-starter-api", mode: "test-only" });
    }

    if (request.method === "POST" && (route === "/reg" || route === "/quotes")) {
      const body = await request.json();
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("starter_quote_requests")
        .insert({ ...requestFields(body), last_page: "/", last_activity_at: now })
        .select("id, status, created_at")
        .single();
      if (error) throw error;
      await supabase.from("starter_quote_activity").insert({ request_id: data.id, page_path: "/", occurred_at: now });

      return json(request, {
        _id: data.id,
        status: data.status,
        createdAt: data.created_at,
        message: "Your request is pending manual review.",
        testOnly: true,
      }, 201);
    }

    const applyMatch = route.match(/^\/apply\/([0-9a-f-]{36})$/i);
    if (request.method === "POST" && applyMatch) {
      const body = await request.json();
      const { data, error } = await supabase
        .from("starter_quote_requests")
        .update({ ...requestFields(body), last_page: "/reg", last_activity_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", applyMatch[1])
        .select("id, status, updated_at")
        .maybeSingle();
      if (error) throw error;
      if (!data) return json(request, { error: "Request not found." }, 404);
      return json(request, { _id: data.id, status: data.status, updatedAt: data.updated_at, testOnly: true });
    }

    const activityMatch = route.match(/^\/activity\/([0-9a-f-]{36})$/i);
    if (request.method === "POST" && activityMatch) {
      const body = await request.json();
      const pagePath = trackedPath(body.page_path);
      if (!pagePath) return json(request, { error: "Unsupported page path." }, 400);
      const now = new Date().toISOString();
      const { data: requestRecord, error: requestError } = await supabase
        .from("starter_quote_requests")
        .update({ last_page: pagePath, last_activity_at: now, updated_at: now })
        .eq("id", activityMatch[1])
        .select("id")
        .maybeSingle();
      if (requestError) throw requestError;
      if (!requestRecord) return json(request, { error: "Request not found." }, 404);
      const { error } = await supabase.from("starter_quote_activity")
        .insert({ request_id: requestRecord.id, page_path: pagePath, occurred_at: now });
      if (error) throw error;
      return json(request, { recorded: true });
    }

    if (route.startsWith("/admin/") && !(await isAdministrator(supabase, request))) {
      return json(request, { error: "Administrator access is required." }, 403);
    }

    if (request.method === "GET" && route === "/admin/requests") {
      const status = new URL(request.url).searchParams.get("status");
      const query = supabase.from("starter_quote_requests")
        .select("id, status, customer_name, customer_phone, insurance_type, vehicle_year, vehicle_make_model, vehicle_value, usage_purpose, policy_start_date, repair_location, review_note, reviewed_at, last_page, last_activity_at, created_at")
        .order("last_activity_at", { ascending: false, nullsFirst: false })
        .limit(100);
      const { data, error } = ["pending", "accepted", "declined"].includes(status ?? "")
        ? await query.eq("status", status)
        : await query;
      if (error) throw error;
      return json(request, { requests: data ?? [] });
    }

    const reviewMatch = route.match(/^\/admin\/requests\/([0-9a-f-]{36})\/review$/i);
    if (request.method === "POST" && reviewMatch) {
      const body = await request.json();
      const status = body.status;
      if (status !== "accepted" && status !== "declined") {
        return json(request, { error: "Decision must be accepted or declined." }, 400);
      }
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("starter_quote_requests")
        .update({ status, review_note: cleanText(body.review_note, 300), reviewed_at: now, updated_at: now })
        .eq("id", reviewMatch[1])
        .select("id, status, review_note, reviewed_at")
        .maybeSingle();
      if (error) throw error;
      if (!data) return json(request, { error: "Request not found." }, 404);
      return json(request, { request: data });
    }

    const activityListMatch = route.match(/^\/admin\/requests\/([0-9a-f-]{36})\/activity$/i);
    if (request.method === "GET" && activityListMatch) {
      const { data, error } = await supabase.from("starter_quote_activity")
        .select("page_path, occurred_at")
        .eq("request_id", activityListMatch[1])
        .order("occurred_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return json(request, { activity: data ?? [] });
    }

    return json(request, { error: "Route not found." }, 404);
  } catch (error) {
    console.error(error);
    return json(request, { error: "The starter API could not process the request." }, 500);
  }
});
