/*
CV Masterpiece order form integration helper.
1) Load Supabase JS v2 before this file.
2) Set SUPABASE_URL and SUPABASE_ANON_KEY from your Supabase project.
3) Call submitCvMasterpieceOrder(...) from the existing service/package form submit handler.
Do NOT place a service-role key in browser code.
*/
const CVM_SUPABASE_URL = "PASTE_SUPABASE_PROJECT_URL";
const CVM_SUPABASE_ANON_KEY = "PASTE_SUPABASE_PUBLIC_ANON_KEY";
const cvmSupabase = window.supabase.createClient(CVM_SUPABASE_URL, CVM_SUPABASE_ANON_KEY);

async function submitCvMasterpieceOrder(formData) {
  const order = {
    customer_name: String(formData.customer_name || "").trim(),
    email: String(formData.email || "").trim() || null,
    phone: String(formData.phone || "").trim(),
    country: String(formData.country || "").trim() || null,
    currency: String(formData.currency || "EGP").trim(),
    service_name: String(formData.service_name || "").trim(),
    package_name: String(formData.package_name || "").trim() || null,
    price: Number(formData.price),
    notes: String(formData.notes || "").trim() || null
  };
  if (!order.customer_name || !order.phone || !order.service_name || !Number.isFinite(order.price) || order.price < 0) {
    throw new Error("Please provide customer name, phone, service, and a valid price.");
  }
  const { data, error } = await cvmSupabase.from("orders").insert(order).select("id, order_number").single();
  if (error) throw error;
  return data;
}
