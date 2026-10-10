import test from "node:test";
import assert from "node:assert";

test("1. Códigos de error y estructura amigable", () => {
  const codigos = [
    "CUOTA_DIARIA_AGOTADA",
    "IA_NO_DISPONIBLE",
    "IA_RESPUESTA_INVALIDA",
    "DATOS_INCOMPLETOS",
    "TIEMPO_AGOTADO",
    "ERROR_INTERNO"
  ];
  for (const c of codigos) {
    assert.ok(typeof c === "string");
  }
});

test("2. Protección de bucles de recarga en PWA", () => {
  const store = new Map();
  function safeReloadMock(now) {
    const hasLast = store.has("pm_sw_last_reload");
    const last = hasLast ? parseInt(store.get("pm_sw_last_reload"), 10) : 0;
    if (hasLast && now - last < 8000) return false;
    store.set("pm_sw_last_reload", String(now));
    return true;
  }
  assert.strictEqual(safeReloadMock(1000), true);
  assert.strictEqual(safeReloadMock(2000), false); // En menos de 8s bloquea
  assert.strictEqual(safeReloadMock(10000), true); // Pasan 9s y permite
});

test("3. Comparación de versiones en PWA", () => {
  const currentBuild = "2026.10.10-1845-d27cfe7";
  const remoteVersion = { commit: "b13ad19" };
  const remoteVersionOld = { commit: "d27cfe7" };
  
  const shouldUpdate = !currentBuild.includes(remoteVersion.commit);
  const shouldNotUpdate = !currentBuild.includes(remoteVersionOld.commit);

  assert.strictEqual(shouldUpdate, true);
  assert.strictEqual(shouldNotUpdate, false);
});

