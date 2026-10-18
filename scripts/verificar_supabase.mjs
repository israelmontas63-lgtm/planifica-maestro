/**
 * scripts/verificar_supabase.mjs
 * 
 * Verificación de conexión a Supabase y esquema curricular oficial (RPC buscar_curriculo_secuencias)
 * Usa clave ANON por defecto y falla si public.curriculo_secuencias tiene 0 filas.
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

  // Regla única de clave (G10): SOLO se permite SUPABASE_ANON_KEY.
  // La clave service_role está prohibida para la verificación de acceso público y del cliente.
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!anonKey && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn("⚠️ [Seguridad G10] SUPABASE_SERVICE_ROLE_KEY detectada pero ignorada. Este verificador requiere estrictamente SUPABASE_ANON_KEY.");
  }
  return {
    url: process.env.SUPABASE_URL,
    key: anonKey || null
  };
}

export async function verificarSupabase({ urlOverride, keyOverride } = {}) {
  const { url: envUrl, key: envKey } = cargarEntorno();
  const url = urlOverride || envUrl;
  const key = keyOverride || envKey;

  console.log("================================================================================");
  console.log("VERIFICACIÓN DE CONEXIÓN A SUPABASE Y TABLA curriculo_secuencias (CLAVE ANON)");
  console.log("================================================================================\n");

  if (!url || !key) {
    console.error("❌ [SUPABASE CONFIG]: Faltan variables de conexión.");
    if (!url) console.error("   - Falta SUPABASE_URL (ej: https://xyzcompany.supabase.co)");
    if (!key) console.error("   - Falta SUPABASE_ANON_KEY (Regla G10: únicamente clave anon autorizada)");
    console.log("\n💡 Para verificar Supabase con la clave anon, ejecuta:");
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
  let totalFilas = 0;
  let conteoPorNivelArea = {};
  let rpcOk = false;
  let registrosRpcCount = 0;

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

  // B. Contar filas con 'Prefer: count=exact' (G10) sin descargar toda la tabla
  const tTabla = Date.now();
  try {
    const headersCount = {
      ...headers,
      Prefer: "count=exact"
    };

    // Consulta con limit=0 para obtener el conteo exacto desde la cabecera Content-Range
    const resCount = await fetch(`${endpointBase}/rest/v1/curriculo_secuencias?select=id&limit=0`, {
      headers: headersCount
    });
    const msTabla = Date.now() - tTabla;

    if (resCount.ok) {
      const cr = resCount.headers.get("content-range");
      if (cr && cr.includes("/")) {
        const totalStr = cr.split("/")[1];
        const parsed = parseInt(totalStr, 10);
        if (!isNaN(parsed)) totalFilas = parsed;
      }

      console.log(`[Tabla curriculo_secuencias]: ${totalFilas > 0 ? "OK" : "VACÍA O NO VISIBLE POR RLS (0 FILAS)"} (${msTabla} ms, count=exact: ${totalFilas})`);

      if (totalFilas > 0) {
        // Desglose paginado por lotes de 1000 registros para evitar saturar memoria o ancho de banda
        const pageSize = 1000;
        let offset = 0;
        let procesados = 0;

        while (procesados < totalFilas) {
          const resPag = await fetch(`${endpointBase}/rest/v1/curriculo_secuencias?select=id,nivel,area&order=id.asc&limit=${pageSize}&offset=${offset}`, { headers });
          if (!resPag.ok) {
            const errPagTxt = await resPag.text().catch(() => "");
            throw new Error(`Fallo en paginación de curriculo_secuencias (HTTP ${resPag.status}): ${errPagTxt.slice(0, 150)}`);
          }
          const filas = await resPag.json();
          if (!Array.isArray(filas) || filas.length === 0) break;

          for (const f of filas) {
            const k = `${f.nivel || "Sin Nivel"} - ${f.area || "Sin Área"}`;
            conteoPorNivelArea[k] = (conteoPorNivelArea[k] || 0) + 1;
          }

          procesados += filas.length;
          offset += pageSize;
          if (filas.length < pageSize) break;
        }

        console.log(`[Distribución Curricular (Paginada)]: ${totalFilas} registros procesados`);
        for (const [k, v] of Object.entries(conteoPorNivelArea)) {
          console.log(`   * ${k}: ${v} secuencias`);
        }
      } else {
        console.error("❌ [FALLO G10]: La tabla public.curriculo_secuencias devuelve 0 filas (tabla vacía o filas no visibles bajo política RLS con clave anon). Requiere ingesta oficial.");
      }
    } else {
      const errTxt = await resCount.text();
      console.error(`[Tabla curriculo_secuencias]: FAIL (HTTP ${resCount.status})`);
      console.error(`   Causa: ${errTxt.slice(0, 200)}`);
    }
  } catch (err) {
    console.error(`[Tabla curriculo_secuencias]: FAIL (${err.message})`);
  }

  // C. Probar RPC buscar_curriculo_secuencias con clave anon
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
      registrosRpcCount = Array.isArray(dataRpc) ? dataRpc.length : 0;
      console.log(`[RPC buscar_curriculo_secuencias]: OK (${msRpc} ms)`);
      console.log(`[Registros RPC 2do Primaria Lengua Española]: ${registrosRpcCount}`);
    } else {
      const errBody = await resRpc.text();
      console.error(`[RPC buscar_curriculo_secuencias]: FAIL (HTTP ${resRpc.status})`);
      console.error(`   Causa: ${errBody.slice(0, 200)}`);
    }
  } catch (err) {
    console.error(`[RPC buscar_curriculo_secuencias]: FAIL (${err.message})`);
  }

  const okTotal = conexionOk && totalFilas > 0 && rpcOk;
  console.log("\n================================================================================");
  console.log(`RESULTADO FINAL: ${okTotal ? "✅ TODO CORRECTO" : "❌ FALLO DE INTEGRIDAD (ver docs/RUNBOOK_SUPABASE.md)"}`);
  console.log("================================================================================");
  return { ok: okTotal, conexionOk, totalFilas, conteoPorNivelArea, rpcOk, registrosCount: registrosRpcCount, registrosRpcCount };
}

if (process.argv[1] && process.argv[1].endsWith("verificar_supabase.mjs")) {
  verificarSupabase().then((res) => {
    process.exit(res.ok ? 0 : 1);
  });
}
