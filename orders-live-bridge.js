/* CV Masterpiece live orders bridge.
   Uses only the public Supabase publishable/anon key. Never use a secret/service_role key here.
   This helper is loaded by the main site and can be called by its existing order form handler.
*/
(function () {
  const projectUrl = 'PASTE_SUPABASE_PROJECT_URL';
  const publishableKey = 'PASTE_SUPABASE_PUBLISHABLE_KEY';

  if (!window.supabase || projectUrl.includes('PASTE_') || publishableKey.includes('PASTE_')) {
    console.warn('CV Masterpiece order integration needs Supabase URL and public key configuration.');
    window.cvmOrdersClient = null;
    return;
  }

  window.cvmOrdersClient = window.supabase.createClient(projectUrl, publishableKey);

  window.submitCvmLiveOrder = async function (order) {
    if (!window.cvmOrdersClient) throw new Error('Order database is not configured.');
    const payload = {
      customer_name: String(order.customer_name || '').trim(),
      email: order.email || null,
      phone: String(order.phone || '').trim(),
      country: String(order.country || '').trim() || null,
      currency: String(order.currency || 'EGP').trim(),
      service_name: String(order.service_name || '').trim(),
      package_name: String(order.package_name || '').trim() || null,
      price: Number(order.price ?? 0),
      notes: String(order.notes || '').trim() || null
    };
    if (payload.customer_name.length < 2 || payload.phone.length < 5 ||
        payload.service_name.length < 2 || !Number.isFinite(payload.price) || payload.price < 0) {
      throw new Error('Please provide a valid name, contact, service and price.');
    }
    const { data, error } = await window.cvmOrdersClient
      .from('orders')
      .insert(payload)
      .select('id, order_number, created_at')
      .single();
    if (error) throw error;
    return data;
  };
})();