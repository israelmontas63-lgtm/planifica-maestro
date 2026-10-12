const express = require("express");
const crypto = require("crypto");
const router = express.Router();

function timingSafeEqualStr(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

/**
 * POST /api/auth/verify
 * Verifica la clave institucional enviada por el frontend
 */
router.post("/verify", (req, res) => {
  if (process.env.REQUIRE_ACCESS_KEY === "false" || process.env.ACCESO_ABIERTO === "true") {
    return res.json({
      ok: true,
      token: "beta_abierta",
      modo: "abierto",
      mensaje: "Acceso libre a la beta abierta de Planifica Maestro."
    });
  }

  const { password } = req.body;
  const expectedKey = process.env.APP_ACCESS_KEY;

  if (!expectedKey) {
    return res.status(500).json({ ok: false, error: "Servidor mal configurado. Falta clave institucional." });
  }

  if (password && typeof password === "string" && timingSafeEqualStr(password.trim(), expectedKey.trim())) {
    return res.json({
      ok: true,
      token: expectedKey.trim(),
      mensaje: "Acceso autorizado al sistema Planifica Maestro."
    });
  }

  return res.status(401).json({
    ok: false,
    error: "Clave de acceso incorrecta. Solicita la clave institucional a tu coordinador o administrador."
  });
});

const fs = require("fs");
const path = require("path");

/**
 * POST /api/auth/owner-verify
 * Verifica la llave maestra de dueño exclusivamente en el servidor
 */
router.post("/owner-verify", (req, res) => {
  const { key } = req.body;
  const expectedOwnerKey = process.env.OWNER_MASTER_KEY;

  if (!expectedOwnerKey || expectedOwnerKey.trim() === "ESCRIBE_AQUI_TU_LLAVE_SECRETA") {
    return res.status(500).json({
      ok: false,
      error: "La llave maestra no ha sido configurada en server/.env (OWNER_MASTER_KEY)."
    });
  }

  if (key && typeof key === "string" && timingSafeEqualStr(key.trim(), expectedOwnerKey.trim())) {
    return res.json({
      ok: true,
      isOwner: true,
      mensaje: "Acceso de Propietario autorizado."
    });
  }

  return res.status(401).json({
    ok: false,
    error: "Llave maestra incorrecta."
  });
});

/**
 * GET /api/auth/owner-stats
 * Retorna las métricas agregadas del sistema (solo accesible con x-owner-key válida)
 */
router.get("/owner-stats", (req, res) => {
  // Validación estricta en el servidor
  if (!req.isOwner) {
    return res.status(403).json({
      ok: false,
      error: "Acceso denegado: Se requiere llave maestra de propietario válida."
    });
  }

  try {
    const dataDir = process.env.PM_DATA_DIR || (process.env.NODE_ENV === "test" ? path.join(require("os").tmpdir(), "planifica_maestro_test_data") : path.join(__dirname, "../data"));
    const dataPath = path.join(dataDir, "uso_docentes.json");
    let raw = {};
    if (fs.existsSync(dataPath)) {
      raw = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
    }
    const docentes = Object.keys(raw);
    const totalDocentes = docentes.length;
    let totalPlanificaciones = 0;
    const lista = [];

    for (const id of docentes) {
      const d = raw[id] || {};
      const count = d.usadas || 0;
      totalPlanificaciones += count;
      lista.push({
        docenteId: id,
        periodo: d.periodo || "n/a",
        usadas: count,
        ultimaActualizacion: d.ultimaActualizacion || null
      });
    }

    const { tipoPersistencia } = require("../ia/persistenciaEstado.js");
    return res.json({
      ok: true,
      stats: {
        totalDocentes,
        totalPlanificaciones,
        listaDocentes: lista,
        persistencia: tipoPersistencia()
      }
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
