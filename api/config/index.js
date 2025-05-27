// Laad noodzakelijke omgevingsvariabelen
const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  ADDRESS_CHECK_TABLE = 'coverage'
} = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment variables');
}

// Exporteer configuratiewaarden voor gebruik in REST-calls
export const CONFIG = {
  supabaseUrl: SUPABASE_URL,
  supabaseKey: SUPABASE_SERVICE_ROLE_KEY,
  addressTable: ADDRESS_CHECK_TABLE
};
