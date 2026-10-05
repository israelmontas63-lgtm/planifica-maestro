import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

test("VERIFICACIÓN DE ARCHIVOS CONGELADOS (estable-camara-v1)", async (t) => {
  const congeladosPath = path.resolve(process.cwd(), "tests/congelados.json");
  assert.ok(fs.existsSync(congeladosPath), "Debe existir tests/congelados.json");

  const congelados = JSON.parse(fs.readFileSync(congeladosPath, "utf8"));

  for (const [archivo, hashEsperado] of Object.entries(congelados)) {
    await t.test(`Archivo congelado: ${archivo}`, () => {
      const fullPath = path.resolve(process.cwd(), archivo);
      assert.ok(fs.existsSync(fullPath), `El archivo congelado ${archivo} debe existir`);

      const contenido = fs.readFileSync(fullPath);
      const hashActual = crypto.createHash("sha256").update(contenido).digest("hex");

      assert.equal(
        hashActual,
        hashEsperado,
        `¡ALERTA DE CONTROL DE CAMBIOS! El archivo congelado ${archivo} ha sido modificado sin aprobación previa. Hash actual: ${hashActual}, Hash esperado: ${hashEsperado}`
      );
    });
  }
});
