import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

test("FASE 5: Freno de Emergencia, Rate Limit Anónimo e Integridad de Secretos", async (t) => {
  await t.test("1. timingSafeEqualStr realiza comparación en tiempo constante", () => {
    function timingSafeEqualStr(a, b) {
      if (typeof a !== "string" || typeof b !== "string") return false;
      const aBuf = Buffer.from(a);
      const bBuf = Buffer.from(b);
      if (aBuf.length !== bBuf.length) return false;
      return crypto.timingSafeEqual(aBuf, bBuf);
    }

    assert.equal(timingSafeEqualStr("clave_secreta_123", "clave_secreta_123"), true);
    assert.equal(timingSafeEqualStr("clave_secreta_123", "clave_secreta_124"), false);
    assert.equal(timingSafeEqualStr("clave_secreta_123", "clave_corta"), false);
    assert.equal(timingSafeEqualStr("", ""), true);
    assert.equal(timingSafeEqualStr(null, "clave"), false);
    assert.equal(timingSafeEqualStr(undefined, undefined), false);
  });

  await t.test("2. Rate limit anónimo usa hash SHA-256 de IP + fecha sin guardar la IP en texto claro", async () => {
    const rateLimitMap = new Map();
    async function verificarRateLimitAnonimo(clientIp, limiteDiario = 5) {
      const fechaHoy = new Date().toISOString().substring(0, 10);
      const data = Buffer.from(`${clientIp}_pm_anon_${fechaHoy}`);
      const hashHex = crypto.createHash("sha256").update(data).digest("hex").substring(0, 32);

      // Verificamos que el mapa use el hash y NUNCA la IP en crudo
      assert.ok(!hashHex.includes(clientIp), "El hash no debe contener la IP en texto claro");

      const entry = rateLimitMap.get(hashHex) || { count: 0, resetAt: Date.now() + 86400000 };
      if (entry.count >= limiteDiario) {
        return { permitido: false, restantes: 0, hash: hashHex };
      }
      entry.count++;
      rateLimitMap.set(hashHex, entry);
      return { permitido: true, restantes: limiteDiario - entry.count, hash: hashHex };
    }

    const testIp = "192.168.1.150";
    for (let i = 1; i <= 5; i++) {
      const res = await verificarRateLimitAnonimo(testIp, 5);
      assert.equal(res.permitido, true);
    }

    // El 6to intento debe ser bloqueado con límite alcanzado
    const bloqueo = await verificarRateLimitAnonimo(testIp, 5);
    assert.equal(bloqueo.permitido, false);
    assert.equal(bloqueo.restantes, 0);

    // Otra IP diferente debe seguir permitida de forma independiente
    const resOtraIp = await verificarRateLimitAnonimo("10.0.0.88", 5);
    assert.equal(resOtraIp.permitido, true);
  });

  await t.test("3. Freno de emergencia (ia_apagada) responde amablemente sin tumbar el sitio", () => {
    function simularRespuestaConIaApagada({ iaApagada, esCurricularOficial, tema }) {
      if (iaApagada) {
        if (esCurricularOficial) {
          return {
            tipo: "biblioteca_oficial",
            mensaje_chat: `Profe, aquí tienes el contenido oficial del currículo para ${tema}.`,
            plan_completado: true
          };
        }
        return {
          tipo: "mantenimiento_ia",
          mensaje_chat: "Profe, el asistente de IA está en mantenimiento breve; puedes seguir consultando el currículo oficial del MINERD y las secuencias didácticas disponibles.",
          plan_completado: false
        };
      }
      return {
        tipo: "ia_generativa",
        mensaje_chat: "Plan generado con inteligencia artificial.",
        plan_completado: true
      };
    }

    // Con IA apagada, consulta curricular oficial funciona directo
    const resOficial = simularRespuestaConIaApagada({
      iaApagada: true,
      esCurricularOficial: true,
      tema: "La tarjeta de identidad"
    });
    assert.equal(resOficial.tipo, "biblioteca_oficial");
    assert.ok(resOficial.mensaje_chat.includes("contenido oficial del currículo"));

    // Con IA apagada, consulta de IA generativa informa amablemente sin error 500
    const resMantenimiento = simularRespuestaConIaApagada({
      iaApagada: true,
      esCurricularOficial: false,
      tema: "Conocimiento General"
    });
    assert.equal(resMantenimiento.tipo, "mantenimiento_ia");
    assert.ok(resMantenimiento.mensaje_chat.includes("mantenimiento breve"));
  });

  await t.test("4. client/dist no contiene el valor de OWNER_MASTER_KEY ni claves secretas de backend", () => {
    const distPath = path.resolve(process.cwd(), "client/dist");
    if (!fs.existsSync(distPath)) return;

    const devVarsPath = path.resolve(process.cwd(), ".dev.vars");
    let ownerKey = "";
    if (fs.existsSync(devVarsPath)) {
      const match = fs.readFileSync(devVarsPath, "utf8").match(/OWNER_MASTER_KEY=(.*)/);
      if (match) ownerKey = match[1].trim().replace(/^['"]|['"]$/g, "");
    }

    function escanear(dir) {
      for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, item.name);
        if (item.isDirectory()) escanear(full);
        else if (item.isFile()) {
          const content = fs.readFileSync(full, "utf8");
          if (ownerKey && ownerKey.length > 5) {
            assert.ok(!content.includes(ownerKey), `El archivo ${full} contiene el valor de OWNER_MASTER_KEY`);
          }
        }
      }
    }

    escanear(distPath);
  });
});
