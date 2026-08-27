import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://tmin-care7.vercel.app",
  "http://localhost:5173",
]);

function corsHeaders(request: Request) {
  const origin = request.headers.get("origin") ?? "";
  const allowedOrigin = allowedOrigins.has(origin)
    ? origin
    : "https://tmin-care7.vercel.app";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
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

function optionalYear(value: unknown) {
  const year = Number(value);
  return Number.isInteger(year) && year >= 1990 && year <= 2030 ? year : null;
}

function optionalMoney(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 && amount <= 10_000_000
    ? amount
    : null;
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
    insurance_type: cleanText(body.tameenAllType ?? body.tameenType ?? body.insuranceType ?? body.type, 40),
    vehicle_year: optionalYear(body.carYear ?? body.car_year ?? body.vehicleYear),
    vehicle_make_model: cleanText(body.car_model ?? body.vehicleMakeModel, 120),
    vehicle_value: optionalMoney(body.carPrice ?? body.vehicleValue),
    usage_purpose: cleanText(body.purpose_of_use ?? body.usagePurpose, 80),
    policy_start_date: optionalDate(body.startedDate ?? body.policyStartDate),
    repair_location: cleanText(body.repairLocation, 40),
  };
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
      return json(request, {
        status: "ok",
        service: "tmin-care-starter-api",
        mode: "test-only",
        workflow: "form submission → pending dashboard review → manual owner decision",
      });
    }

    // Compatible with the existing site's initial POST /reg form action.
    if (request.method === "POST" && (route === "/reg" || route === "/quotes")) {
      const body = await request.json();
      const { data, error } = await supabase
        .from("starter_quote_requests")
        .insert(requestFields(body))
        .select("id, status, created_at")
        .single();
      if (error) throw error;

      return json(request, {
        _id: data.id,
        status: data.status,
        createdAt: data.created_at,
        message: "Your request is pending manual review.",
        testOnly: true,
      }, 201);
    }

    // Compatible with the site's later vehicle-detail stage, if enabled in a future update.
    const applyMatch = route.match(/^\/apply\/([0-9a-f-]{36})$/i);
    if (request.method === "POST" && applyMatch) {
      const body = await request.json();
      const { data, error } = await supabase
        .from("starter_quote_requests")
        .update({ ...requestFields(body), updated_at: new Date().toISOString() })
        .eq("id", applyMatch[1])
        .select("id, status, updated_at")
        .maybeSingle();
      if (error) throw error;
      if (!data) return json(request, { error: "Request not found." }, 404);
      return json(request, { _id: data.id, status: data.status, updatedAt: data.updated_at, testOnly: true });
    }

    const requestMatch = route.match(/^\/quotes\/([0-9a-f-]{36})$/i);
    if (request.method === "GET" && requestMatch) {
      const { data, error } = await supabase
        .from("starter_quote_requests")
        .select("id, status, review_note, created_at, reviewed_at")
        .eq("id", requestMatch[1])
        .maybeSingle();
      if (error) throw error;
      if (!data) return json(request, { error: "Request not found." }, 404);
      return json(request, { request: data, testOnly: true });
    }

    return json(request, { error: "Route not found." }, 404);
  } catch (error) {
    console.error(error);
    return json(request, { error: "The starter API could not process the request." }, 500);
  }
});
