const { createClient } = require("@supabase/supabase-js");
const { supabase } = require("../config");

let client = null;

function getSupabaseClient() {
  if (client) {
    return client;
  }

  if (!supabase.url || !supabase.serviceRoleKey) {
    return null;
  }

  client = createClient(supabase.url, supabase.serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return client;
}

module.exports = { getSupabaseClient };
