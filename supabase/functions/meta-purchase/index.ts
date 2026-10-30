import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://www.cv-masterpiece.com",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function sha256(value: string) {
  const normalized = value.trim().toLowerCase();
  const bytes = new TextEncoder().encode(normalized);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const respond = (body: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  if (req.method !== "POST") return respond({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return respond({ error: "Authentication required" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const accessToken = Deno.env.get("META_ACCESS_TOKEN");
  const pixelId = "2411520589207773";
  if (!supabaseUrl || !anonKey || !serviceKey || !accessToken) {
    return respond({ error: "Server configuration is incomplete" }, 500);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) return respond({ error: "Invalid session" }, 401);

  let orderId = "";
  try {
    const body = await req.json();
    orderId = String(body.order_id || "").trim();
  } catch {
    return respond({ error: "Invalid JSON body" }, 400);
  }
  if (!orderId) return respond({ error: "order_id is required" }, 400);

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: order, error: orderError } = await admin
    .from("orders")
    .select("id,order_number,customer_name,email,phone,service_name,price,currency,country,payment_status,payment_verified_by,meta_purchase_sent_at")
    .eq("id", orderId)
    .maybeSingle();

  if (orderError || !order) return respond({ error: "Order not found" }, 404);
  if (order.payment_status !== "Approved") return respond({ error: "Payment is not approved" }, 409);
  if (order.payment_verified_by !== authData.user.id) {
    return respond({ error: "Only the user who approved this payment can send its Purchase event" }, 403);
  }
  if (order.meta_purchase_sent_at) return respond({ ok: true, already_sent: true });

  const userData: Record<string, string> = {};
  if (order.email) userData.em = await sha256(String(order.email));
  if (order.phone) userData.ph = await sha256(String(order.phone).replace(/[^0-9]/g, ""));
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const userAgent = req.headers.get("user-agent");
  if (clientIp) userData.client_ip_address = clientIp;
  if (userAgent) userData.client_user_agent = userAgent;

  const eventId = "cvm-purchase-" + String(order.id);
  const payload = {
    data: [{
      event_name: "Purchase",
      event_time: Math.floor(Date.now() / 1000),
      event_id: eventId,
      action_source: "website",
      event_source_url: "https://www.cv-masterpiece.com/",
      user_data: userData,
      custom_data: {
        currency: String(order.currency || "EGP").toUpperCase(),
        value: Number(order.price) || 0,
        content_name: String(order.service_name || "CV Masterpiece service"),
        content_category: "CV service",
        order_id: String(order.order_number || order.id),
      },
    }],
  };

  const graphVersion = Deno.env.get("META_GRAPH_API_VERSION") || "v23.0";
  const metaResponse = await fetch(`https://graph.facebook.com/${graphVersion}/${pixelId}/events?access_token=${encodeURIComponent(accessToken)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const metaResult = await metaResponse.json().catch(() => ({}));
  if (!metaResponse.ok || Number(metaResult.events_received || 0) < 1) {
    console.error("Meta CAPI error", metaResult);
    return respond({ error: "Meta did not accept the Purchase event", details: metaResult }, 502);
  }

  const { error: markError } = await admin
    .from("orders")
    .update({ meta_purchase_sent_at: new Date().toISOString(), meta_purchase_event_id: eventId })
    .eq("id", order.id)
    .is("meta_purchase_sent_at", null);
  if (markError) {
    console.error("Could not mark Purchase event as sent", markError);
    return respond({ ok: true, warning: "Meta accepted the event but the order could not be marked as sent" });
  }

  return respond({ ok: true, events_received: metaResult.events_received || 1 });
});
