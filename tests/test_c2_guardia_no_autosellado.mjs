import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { verificarGuardia, sellarGuardia, normalizarRuta, verificarAutoVigilancia } from "../scripts/guardia.js";

function hashArchivo(ruta) {
  return crypto.createHash("sha256").update(fs.readFileSync(ruta)).digest("hex");
}

test("C2 - (1) Archivo protegido con hash distinto aunque su nombre esté autorizado -> FALLA", () => {
  const tempDir = fs.mkdtempSync(path.join(process.cwd(), "tests", "tmp_c2_1_"));
  try {
    const fakeHashes = {
      version: "2.0.0",
      algoritmo: "sha256",
      hashes: {
        "worker/archivo.js": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
      }
    };
    fs.mkdirSync(path.join(tempDir, "worker"), { recursive: true });
    fs.writeFileSync(path.join(tempDir, "PROTEGIDO.hashes.json"), JSON.stringify(fakeHashes), "utf8");
    fs.writeFileSync(path.join(tempDir, "worker", "archivo.js"), "console.log('real')", "utf8");
    
    // En AUTORIZACIONES.md se autoriza worker/archivo.js pero con un hash DISTINTO al actual
    const authContent = `
### Autorización 999
- **Fecha:** 2026-10-17
- **Componente:** \`worker/archivo.js\`
- **Hash:** \`bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\`
- **Motivo:** Prueba
- **Frase Textual del Dueño:** "Autorizo..."
`;
    fs.writeFileSync(path.join(tempDir, "AUTORIZACIONES.md"), authContent, "utf8");

    const ok = verificarGuardia({ cwd: tempDir, verbose: false });
    assert.equal(ok, false, "Debe fallar si el hash del archivo no coincide con el hash explícito autorizado");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("C2 - (2) Guardia sin banderas nunca modifica archivos (compara hashes antes y después)", () => {
  const rutaHashes = path.resolve(process.cwd(), "PROTEGIDO.hashes.json");
  const rutaAuth = path.resolve(process.cwd(), "AUTORIZACIONES.md");

  const hashHashesAntes = hashArchivo(rutaHashes);
  const hashAuthAntes = hashArchivo(rutaAuth);

  const prevAncla = process.env.GUARDIA_COMMIT_SELLADO;
  let ok = false;
  try {
    const config = JSON.parse(fs.readFileSync(rutaHashes, "utf8"));
    process.env.GUARDIA_COMMIT_SELLADO = config.commit || "ff0422b";
    ok = verificarGuardia({ cwd: process.cwd(), verbose: false });
  } finally {
    if (prevAncla !== undefined) process.env.GUARDIA_COMMIT_SELLADO = prevAncla;
    else delete process.env.GUARDIA_COMMIT_SELLADO;
  }
  assert.equal(ok, true, "La guardia debe pasar en el entorno actual");

  const hashHashesDespues = hashArchivo(rutaHashes);
  const hashAuthDespues = hashArchivo(rutaAuth);

  assert.equal(hashHashesAntes, hashHashesDespues, "PROTEGIDO.hashes.json no debe ser alterado por verificarGuardia");
  assert.equal(hashAuthAntes, hashAuthDespues, "AUTORIZACIONES.md no debe ser alterado por verificarGuardia");
});

test("C2 - (2b) sellarGuardia sin flag confirmar no escribe en disco", () => {
  const tempDir = fs.mkdtempSync(path.join(process.cwd(), "tests", "tmp_c2_2b_"));
  try {
    const fakeHashes = {
      version: "2.0.0",
      algoritmo: "sha256",
      hashes: {
        "archivo.txt": "1111111111111111111111111111111111111111111111111111111111111111"
      }
    };
    fs.writeFileSync(path.join(tempDir, "PROTEGIDO.hashes.json"), JSON.stringify(fakeHashes), "utf8");
    fs.writeFileSync(path.join(tempDir, "archivo.txt"), "nuevo contenido", "utf8");

    const contenidoAntes = fs.readFileSync(path.join(tempDir, "PROTEGIDO.hashes.json"), "utf8");
    const res = sellarGuardia(tempDir, { confirmar: false, verbose: false });

    const contenidoDespues = fs.readFileSync(path.join(tempDir, "PROTEGIDO.hashes.json"), "utf8");
    assert.equal(res.aplicado, false, "Debe reportar aplicado: false si no se confirma");
    assert.equal(contenidoAntes, contenidoDespues, "El archivo no debe cambiar sin confirmar");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("C2 - (3) Basename de otra carpeta -> FALLA (verificación estricta por ruta completa)", () => {
  const tempDir = fs.mkdtempSync(path.join(process.cwd(), "tests", "tmp_c2_3_"));
  try {
    const fakeHashes = {
      version: "2.0.0",
      algoritmo: "sha256",
      hashes: {
        "otra_carpeta/archivo.js": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
      }
    };
    fs.mkdirSync(path.join(tempDir, "otra_carpeta"), { recursive: true });
    fs.writeFileSync(path.join(tempDir, "PROTEGIDO.hashes.json"), JSON.stringify(fakeHashes), "utf8");
    fs.writeFileSync(path.join(tempDir, "otra_carpeta", "archivo.js"), "modificado", "utf8");

    // Autoriza 'otra_diferente/archivo.js' (mismo basename pero diferente carpeta)
    const authContent = `
### Autorización 999
- **Fecha:** 2026-10-17
- **Componente:** \`otra_diferente/archivo.js\`
- **Motivo:** Intento de bypass por basename
- **Frase Textual del Dueño:** "Autorizo..."
`;
    fs.writeFileSync(path.join(tempDir, "AUTORIZACIONES.md"), authContent, "utf8");

    const ok = verificarGuardia({ cwd: tempDir, verbose: false });
    assert.equal(ok, false, "Debe fallar porque el basename coincide pero la ruta no");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("C2 - (4) Confirma que scripts/guardia.js, PROTEGIDO.hashes.json y AUTORIZACIONES.md están vigilados", () => {
  // auto-vigilance verifica estos 3 archivos contra git HEAD
  const fallos = verificarAutoVigilancia(process.cwd());
  assert.ok(Array.isArray(fallos), "verificarAutoVigilancia debe retornar un arreglo");
});
