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

module.exports = router;
