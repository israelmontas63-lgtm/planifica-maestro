import { createClient } from "@supabase/supabase-js";

const env = (typeof import.meta !== "undefined" && import.meta.env) ? import.meta.env : (typeof process !== "undefined" ? process.env : {});
const supabaseUrl = env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || "";

// INTERRUPTOR DE AUTENTICACIÓN (BETA ABIERTA):
// En client/.env: VITE_REQUIRE_LOGIN=false desactiva las cuentas para la beta de 5 o 6 maestros.
// Si es "false", Supabase permanece completamente dormido y no hace llamadas a la red (*.supabase.co).
// Si es "true" o no está definido (por defecto en tests institucionales), la autenticación está activa.
export const isAuthEnabled = (
  env.VITE_REQUIRE_LOGIN !== "false" &&
  env.VITE_ENABLE_AUTH !== "false"
);

export const isSupabaseConfigured = Boolean(
  isAuthEnabled &&
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl.startsWith("http") &&
  !supabaseUrl.includes("xxxxxxxxxxxx")
);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

