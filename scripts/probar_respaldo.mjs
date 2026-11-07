// scripts/probar_respaldo.mjs — Prueba REAL de Groq y OpenRouter, uno por uno. NUNCA imprime claves.
import fs from "node:fs";
import { generarTextoConRespaldo, reiniciarEstadoTexto } from "../worker/services/enrutadorTexto.js";
const env = {};
for (const ruta of [".dev.vars", ".env"]) {
  if (!fs.existsSync(ruta)) continue;
  for (const l of fs.readFileSync(ruta, "utf8").split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in env)) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const contents = [{ role: "user", parts: [{ text: 'Devuelve exactamente este JSON: {"ok": true, "saludo": "hola maestro"}' }] }];
for (const clave of ["GROQ_API_KEY", "OPENROUTER_API_KEY"]) {
  reiniciarEstadoTexto();
  const aislado = {};
  if (env[clave]) aislado[clave] = env[clave];
  for (const extra of ["GROQ_MODEL", "OPENROUTER_MODEL", "OPENROUTER_JSON_MODE"]) if (env[extra]) aislado[extra] = env[extra];
  const resumen = { proveedor_probado: clave.replace("_API_KEY", ""), clave_presente: Boolean(env[clave]) };
  try {
    const r = await generarTextoConRespaldo(aislado, { contents, maxTokens: 200, json: true, presupuestoMs: 25000 });
    let jsonValido = false;
    try { jsonValido = JSON.parse(r.texto).ok === true; } catch (e) { /* sin JSON válido */ }
    console.log(JSON.stringify({ ...resumen, resultado: "OK", proveedor: r.proveedor, modelo: r.modelo, ms: r.ms, json_valido: jsonValido }));
  } catch (e) {
    console.log(JSON.stringify({ ...resumen, resultado: "FALLO", motivo: e.message, intentos: e.intentos || null }));
  }
}
