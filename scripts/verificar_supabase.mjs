/**
 * scripts/verificar_supabase.mjs
 * 
 * Verificación de conexión a Supabase y esquema curricular oficial (RPC buscar_curriculo_secuencias)
 * NO expone claves ni tokens en consola.
 */

import fs from "node:fs";
import path from "node:path";

// 1. Cargar variables de entorno o de .env.test si existe
function cargarEntorno() {
  const envTestPath = path.resolve(process.cwd(), ".env.test");
  if (fs.existsSync(envTestPath)) {
    const raw = fs.readFileSync(envTestPath, "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const [key, ...rest] = trimmed.split("=");
      if (key && rest.length > 0) {
        process.env[key.trim()] = rest.join("=").trim().replace(/^["']|["']$/g, "");
      }
    }
  }

  return {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  };
}

export async function verificarSupabase({ urlOverride, keyOverride } = {}) {
  const { url: envUrl, key: envKey } = cargarEntorno();
  const url = urlOverride || envUrl;
  const key = keyOverride || envKey;

  console.log("================================================================================");
  console.log("VERIFICACIÓN DE CONEXIÓN A SUPABASE Y RPC buscar_curriculo_secuencias");
  console.log("================================================================================\n");

  if (!url || !key) {
    console.error("❌ [SUPABASE CONFIG]: Faltan variables de conexión.");
    if (!url) console.error("   - Falta SUPABASE_URL (ej: https://xyzcompany.supabase.co)");
    if (!key) console.error("   - Falta SUPABASE_ANON_KEY o SUPABASE_SERVICE_ROLE_KEY");
    console.log("\n💡 Para verificar Supabase real, ejecuta:");
    console.log("   $env:SUPABASE_URL='https://tu-proyecto.supabase.co'");
    console.log("   $env:SUPABASE_ANON_KEY='tu-anon-key'");
    console.log("   node scripts/verificar_supabase.mjs\n");
    console.log("Consulta docs/RUNBOOK_SUPABASE.md para más detalles.");
    return { ok: false, motivo: "FALTAN_CREDENCIALES" };
  }

  const endpointBase = url.replace(/\/$/, "");
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json"
  };

  const t0 = Date.now();
  let conexionOk = false;
  let rpcOk = false;
  let registrosCount = 0;
  let detalleRegistros = [];

  // A. Probar conexión básica
  try {
    const resPing = await fetch(`${endpointBase}/rest/v1/`, { headers });
    const msPing = Date.now() - t0;
    conexionOk = resPing.ok || resPing.status === 404; // REST root responde
    console.log(`[Conexión]: ${conexionOk ? "OK" : "FAIL"} (${msPing} ms)`);
  } catch (err) {
    console.error(`[Conexión]: FAIL (${err.message})`);
    return { ok: false, conexionOk: false, motivo: "ERROR_RED" };
  }

  // B. Probar RPC buscar_curriculo_secuencias con parámetros canónicos (2do Primaria Lengua Española)
  const tRpc = Date.now();
  try {
    const payloadRpc = {
      p_nivel: "Primario",
      p_grado: 2,
      p_area: "Lengua Española",
      p_consulta: "noticia",
      p_limite: 3
    };

    const resRpc = await fetch(`${endpointBase}/rest/v1/rpc/buscar_curriculo_secuencias`, {
      method: "POST",
      headers,
      body: JSON.stringify(payloadRpc)
    });

    const msRpc = Date.now() - tRpc;

    if (resRpc.ok) {
      const dataRpc = await resRpc.json();
      rpcOk = true;
      registrosCount = Array.isArray(dataRpc) ? dataRpc.length : 0;
      detalleRegistros = dataRpc || [];
      console.log(`[RPC buscar_curriculo_secuencias]: OK (${msRpc} ms)`);
      console.log(`[Registros 2do Primaria Lengua Española]: ${registrosCount}`);
      if (registrosCount > 0) {
        console.log(`   Ejemplo: "${detalleRegistros[0].tema || detalleRegistros[0].source_id}" (Fuente: ${detalleRegistros[0].fuente_documento || "MINERD"})`);
      } else {
        console.warn("⚠️ Advertencia: La RPC existe pero no devolvió registros para 2do Primaria. Aplica el script de migración y datos.");
      }
    } else {
      const errBody = await resRpc.text();
      console.error(`[RPC buscar_curriculo_secuencias]: FAIL (HTTP ${resRpc.status})`);
      console.error(`   Causa: ${errBody.slice(0, 200)}`);
    }
  } catch (err) {
    console.error(`[RPC buscar_curriculo_secuencias]: FAIL (${err.message})`);
  }

  const okTotal = conexionOk && rpcOk && registrosCount > 0;
  console.log("\n================================================================================");
  console.log(`RESULTADO FINAL: ${okTotal ? "✅ TODO CORRECTO" : "⚠️ REQUIERE ACCIÓN (ver docs/RUNBOOK_SUPABASE.md)"}`);
  console.log("================================================================================");
  return { ok: okTotal, conexionOk, rpcOk, registrosCount };
}

if (process.argv[1] && process.argv[1].endsWith("verificar_supabase.mjs")) {
  verificarSupabase().then((res) => {
    process.exit(res.ok ? 0 : 1);
  });
}
