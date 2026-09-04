(function () {
  window.__KINGDOM_SUPABASE_CONFIG__ = window.__KINGDOM_SUPABASE_CONFIG__ || {
    url: '',
    anonKey: ''
  };

  function getConfig() {
    return {
      url: (window.__KINGDOM_SUPABASE_CONFIG__?.url || '').trim(),
      anonKey: (window.__KINGDOM_SUPABASE_CONFIG__?.anonKey || '').trim()
    };
  }

  function getClient() {
    const { url, anonKey } = getConfig();
    if (!window.supabase || !url || !anonKey) return null;
    if (!window.__KINGDOM_SUPABASE_CLIENT__) {
      window.__KINGDOM_SUPABASE_CLIENT__ = window.supabase.createClient(url, anonKey);
    }
    return window.__KINGDOM_SUPABASE_CLIENT__;
  }

  function getLocalInquiries() {
    try {
      return JSON.parse(localStorage.getItem('inquiries') || '[]');
    } catch (error) {
      return [];
    }
  }

  function setLocalInquiries(rows) {
    localStorage.setItem('inquiries', JSON.stringify(rows));
  }

  async function saveInquiry(record) {
    const payload = {
      vehicle: record.vehicle || 'Untitled vehicle',
      vehicle_id: record.id || record.vehicle_id || '',
      name: record.name || '',
      contact: record.contact || '',
      message: record.message || '',
      status: record.status || 'new',
      reply: record.reply || '',
      history: Array.isArray(record.history) ? record.history : [],
      created_at: new Date(record.ts || Date.now()).toISOString()
    };

    const client = getClient();
    if (client) {
      try {
        const { data, error } = await client.from('inquiries').insert([payload]).select();
        if (!error) {
          return { source: 'supabase', rows: data || [] };
        }
        console.warn('Supabase inquiry insert failed:', error.message);
      } catch (error) {
        console.warn('Supabase unavailable:', error);
      }
    }

    const rows = getLocalInquiries();
    rows.push({ ...payload, ts: payload.created_at ? Date.parse(payload.created_at) : Date.now() });
    setLocalInquiries(rows);
    return { source: 'localStorage', rows };
  }

  async function loadInquiries() {
    const client = getClient();
    if (client) {
      try {
        const { data, error } = await client.from('inquiries').select('*').order('created_at', { ascending: false });
        if (!error) {
          return (data || []).map(item => ({
            ...item,
            ts: item.created_at ? Date.parse(item.created_at) : Date.now(),
            history: Array.isArray(item.history) ? item.history : []
          }));
        }
        console.warn('Supabase inquiry load failed:', error.message);
      } catch (error) {
        console.warn('Supabase unavailable:', error);
      }
    }

    return getLocalInquiries();
  }

  async function syncInquiryList(rows) {
    const client = getClient();
    if (client) {
      try {
        const { error } = await client.from('inquiries').upsert(rows.map(item => ({
          id: item.id || undefined,
          vehicle: item.vehicle || 'Untitled vehicle',
          vehicle_id: item.vehicle_id || item.id || '',
          name: item.name || '',
          contact: item.contact || '',
          message: item.message || '',
          status: item.status || 'new',
          reply: item.reply || '',
          history: Array.isArray(item.history) ? item.history : [],
          created_at: item.created_at || new Date(item.ts || Date.now()).toISOString()
        })), { onConflict: 'id' });
        if (!error) {
          return true;
        }
        console.warn('Supabase inquiry sync failed:', error.message);
      } catch (error) {
        console.warn('Supabase unavailable:', error);
      }
    }

    setLocalInquiries(rows);
    return true;
  }

  async function signUpCustomer({ email, password, metadata = {} }) {
    const client = getClient();
    if (!client || !email || !password) {
      return { error: null, demo: true };
    }

    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: { data: metadata }
    });

    return { data, error };
  }

  async function signInCustomer({ contact, password }) {
    const client = getClient();
    if (!client || !contact || !password) {
      return { error: null, demo: true };
    }

    if (/@/.test(contact)) {
      const { data, error } = await client.auth.signInWithPassword({
        email: contact,
        password
      });
      return { data, error };
    }

    const { data, error } = await client.auth.signInWithOtp({
      phone: contact,
      options: { shouldCreateUser: false }
    });

    return { data, error };
  }

  window.KingdomSupabase = {
    getConfig,
    isConfigured: Boolean(getClient()),
    saveInquiry,
    loadInquiries,
    syncInquiryList,
    signUpCustomer,
    signInCustomer,
    getLocalInquiries,
    setLocalInquiries
  };
})();
