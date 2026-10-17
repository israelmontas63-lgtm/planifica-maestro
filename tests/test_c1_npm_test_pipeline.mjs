import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

test("C1 - package.json define el pipeline estricto de pruebas", () => {
  const pkgPath = path.resolve(process.cwd(), "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

  assert.equal(
    pkg.scripts.test,
    "node scripts/guardia.js && node scripts/escanear_secretos.js && node scripts/run_tests.js",
    "El comando npm test debe encadenar guardia, escaneo de secretos y run_tests con &&"
  );
});

test("C1 - Guardia aborta la ejecución si un archivo protegido es alterado sin autorización", () => {
  const tempDir = fs.mkdtempSync(path.join(process.cwd(), "tests", "tmp_c1_"));
  try {
    const fakeHashes = {
      version: "2.0.0",
      algoritmo: "sha256",
      hashes: {
        "archivo_protegido.txt": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
      }
    };
    fs.writeFileSync(path.join(tempDir, "PROTEGIDO.hashes.json"), JSON.stringify(fakeHashes), "utf8");
    fs.writeFileSync(path.join(tempDir, "archivo_protegido.txt"), "CONTENIDO_ALTERADO", "utf8");
    fs.writeFileSync(path.join(tempDir, "AUTORIZACIONES.md"), "# Autorizaciones\n", "utf8");

    let fallo = false;
    try {
      execSync(`node "${path.resolve(process.cwd(), 'scripts', 'guardia.js')}"`, {
        cwd: tempDir,
        stdio: ["pipe", "pipe", "pipe"]
      });
    } catch (e) {
      fallo = true;
      assert.notEqual(e.status, 0, "Debe salir con código de error distinto de 0");
    }
    assert.equal(fallo, true, "La guardia debe fallar y bloquear");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
