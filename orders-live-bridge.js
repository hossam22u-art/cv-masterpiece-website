/* CV Masterpiece live orders bridge.
   Uses only the public Supabase publishable/anon key. Never use a secret/service_role key here.
   The main website must load this script and call submitCvmLiveOrder(...) from its order form.
*/
(function () {
  const config = () => ({
    projectUrl: localStorage.getItem('cvm_supabase_url') || '',
    publishableKey: localStorage.getItem('cvm_supabase_key') || ''
  });

  function connect() {
    const { projectUrl, publishableKey } = config();
    if (!window.supabase || !projectUrl.startsWith('https://') || !publishableKey) {
      window.cvmOrdersClient = null;
      return false;
    }
    window.cvmOrdersClient = window.supabase.createClient(projectUrl, publishableKey);
    return true;
  }

  connect();

  window.submitCvmLiveOrder = async function (order) {
    if (!connect() || !window.cvmOrdersClient) {
      throw new Error('Orders database is not configured. Open the admin page, connect Supabase, then reload the website.');
    }
    const payload = {
      customer_name: String(order.customer_name || '').trim(),
      email: String(order.email || '').trim() || null,
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
      throw new Error('Please provide a valid name, phone, service and price.');
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