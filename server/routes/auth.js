const express = require("express");
const router = express.Router();

/**
 * POST /api/auth/verify
 * Verifica la clave institucional enviada por el frontend
 */
router.post("/verify", (req, res) => {
  const { password } = req.body;
  const expectedKey = process.env.APP_ACCESS_KEY;

  if (!expectedKey) {
    return res.json({ ok: true, token: "open_dev_mode" });
  }

  if (password && typeof password === "string" && password.trim() === expectedKey.trim()) {
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

  if (key && typeof key === "string" && key.trim() === expectedOwnerKey.trim()) {
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
    const dataPath = path.join(__dirname, "../data/uso_docentes.json");
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

    return res.json({
      ok: true,
      stats: {
        totalDocentes,
        totalPlanificaciones,
        listaDocentes: lista
      }
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
