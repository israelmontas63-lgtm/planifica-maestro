import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

/**
 * CAPA DE NOVEDADES Y CAMBIOS CURRICULARES
 * 
 * Calcula el hash SHA-256 de los documentos.
 * Si detecta un documento nuevo o modificado respecto al manifiesto oficial de Capa 1,
 * lo resguarda en server/curriculo/pendiente_revision/ y emite una alerta
 * indicando que debe ser revisado por un experto curricular antes de entrar a la biblioteca oficial.
 */

function calcularSha256(filePath) {
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function recorrerDirectorio(dir, extensiones = [".pdf", ".txt", ".json"]) {
  let archivos = [];
  if (!fs.existsSync(dir)) return archivos;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      archivos = archivos.concat(recorrerDirectorio(fullPath, extensiones));
    } else if (entry.isFile() && extensiones.includes(path.extname(entry.name).toLowerCase())) {
      archivos.push(fullPath);
    }
  }
  return archivos;
}

async function detectarNovedades() {
  console.log("🕵️ [Novedades] Verificando integridad de documentos oficiales (SHA-256)...");

  const baseDir = process.cwd();
  const capa1Dir = path.join(baseDir, "server", "curriculo", "capa1_originales");
  const revisionDir = path.join(baseDir, "server", "curriculo", "pendiente_revision");
  const manifiestoPath = path.join(capa1Dir, "manifiesto_originales.json");

  fs.mkdirSync(revisionDir, { recursive: true });

  let manifiesto = [];
  if (fs.existsSync(manifiestoPath)) {
    manifiesto = JSON.parse(fs.readFileSync(manifiestoPath, "utf-8"));
  }

  const mapaOficial = new Map();
  for (const item of manifiesto) {
    mapaOficial.set(item.id, item);
  }

  // Verificar archivos en Capa 1
  const archivosCapa1 = recorrerDirectorio(path.join(capa1Dir, "primario"), [".pdf", ".txt"]);
  let documentosAlterados = 0;
  let documentosVerificados = 0;

  for (const archivo of archivosCapa1) {
    const nombre = path.basename(archivo);
    const id = nombre.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_");
    const sha = calcularSha256(archivo);

    if (mapaOficial.has(id)) {
      const oficial = mapaOficial.get(id);
      if (oficial.sha256 === sha) {
        documentosVerificados++;
      } else {
        console.warn(`🚨 [Novedades] DOCUMENTO MODIFICADO DETECTADO: ${nombre}`);
        console.warn(`   Hash esperado: ${oficial.sha256}`);
        console.warn(`   Hash actual:   ${sha}`);
        documentosAlterados++;

        // Mover copia a pendiente de revisión
        const copiaDest = path.join(revisionDir, `MODIFICADO_${nombre}`);
        fs.copyFileSync(archivo, copiaDest);
      }
    }
  }

  // Verificar si hay documentos nuevos en pendiente_revision esperando ser catalogados
  const archivosRevision = recorrerDirectorio(revisionDir, [".pdf", ".txt"]).filter(
    (f) => !path.basename(f).startsWith("registro_")
  );

  const registroNovedades = {
    fecha_analisis: new Date().toISOString(),
    documentos_oficiales_intactos: documentosVerificados,
    documentos_alterados_detectados: documentosAlterados,
    documentos_en_cola_revision: archivosRevision.length,
    archivos_pendientes: archivosRevision.map((f) => ({
      archivo: path.basename(f),
      sha256: calcularSha256(f),
      estado: "pendiente de validación por experto"
    }))
  };

  fs.writeFileSync(
    path.join(revisionDir, "registro_novedades.json"),
    JSON.stringify(registroNovedades, null, 2),
    "utf-8"
  );

  console.log(`✅ [Novedades] Comprobación de integridad finalizada:`);
  console.log(`   - Documentos oficiales verificados e intactos: ${documentosVerificados}`);
  console.log(`   - Documentos modificados no autorizados: ${documentosAlterados}`);
  console.log(`   - Documentos pendientes de revisión por experto: ${archivosRevision.length}`);
}

detectarNovedades();
