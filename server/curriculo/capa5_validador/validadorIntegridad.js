const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

/**
 * CAPA 5: Validador de Integridad Curricular Oficial (SHA-256)
 * 
 * Verifica la integridad criptográfica de los documentos de Capa 1
 * contrastándolos con el manifiesto oficial de hashes SHA-256.
 */

function calcularSha256(filePath) {
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function verificarIntegridadCapa1(baseDir = process.cwd()) {
  const capa1Dir = path.join(baseDir, "server", "curriculo", "capa1_originales");
  const manifiestoPath = path.join(capa1Dir, "manifiesto_originales.json");

  if (!fs.existsSync(manifiestoPath)) {
    return { valido: false, error: "No se encontró manifiesto_originales.json" };
  }

  const manifiesto = JSON.parse(fs.readFileSync(manifiestoPath, "utf-8"));
  let verificados = 0;
  let fallidos = 0;
  const detalles = [];

  for (const doc of manifiesto) {
    const rutaDoc = path.resolve(baseDir, doc.ruta);
    if (!fs.existsSync(rutaDoc)) {
      fallidos++;
      detalles.push({ doc: doc.id, error: "Archivo no encontrado: " + rutaDoc });
      continue;
    }

    const hashActual = calcularSha256(rutaDoc);
    if (hashActual === doc.sha256) {
      verificados++;
      detalles.push({ doc: doc.id, sha256: hashActual, estado: "valido" });
    } else {
      fallidos++;
      detalles.push({ doc: doc.id, hashEsperado: doc.sha256, hashActual, estado: "alterado" });
    }
  }

  return {
    valido: fallidos === 0,
    documentos_verificados: verificados,
    documentos_fallidos: fallidos,
    detalles,
    estado_validacion: "pendiente de validación por experto"
  };
}

if (require.main === module) {
  console.log("🔍 [Capa 5] Ejecutando validación de integridad SHA-256...");
  const res = verificarIntegridadCapa1();
  console.log(`Documentos verificados: ${res.documentos_verificados}`);
  console.log(`Documentos fallidos: ${res.documentos_fallidos}`);
  console.log(`Estado: ${res.valido ? "✅ INTEGRIDAD CONFIRMADA" : "❌ FALLO DE INTEGRIDAD"}`);
}

module.exports = {
  calcularSha256,
  verificarIntegridadCapa1
};
