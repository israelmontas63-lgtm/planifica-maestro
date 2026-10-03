const express = require("express");
const router = express.Router();
const { enrutarVoz, obtenerEstadoProveedoresVoz } = require("../ia/enrutadorVoz");

/**
 * Controlador común para generación de voz con respaldo
 */
async function handleVoz(req, res) {
  try {
    const text = req.body.text || req.body.texto;
    if (!text) {
      return res.status(400).json({ error: "Se requiere texto para generar voz." });
    }

    const resultado = await enrutarVoz({
      texto: text,
      env: process.env
    });

    if (resultado.fallbackLocal || !resultado.buffer) {
      return res.json({
        fallbackLocal: true,
        proveedor: "speech_synthesis_local",
        mensaje: "Usando síntesis nativa del navegador."
      });
    }

    res.set({
      "Content-Type": resultado.contentType || "audio/mpeg",
      "Content-Length": resultado.buffer.length,
      "X-Voice-Provider": resultado.proveedor || "unknown",
      "X-Voice-Cached": resultado.desdeCache ? "true" : "false"
    });
    res.send(resultado.buffer);
  } catch (err) {
    console.error("Error generando voz:", err);
    res.status(200).json({ fallbackLocal: true, error: err.message });
  }
}

router.post("/generate", handleVoz);
router.post("/", handleVoz);

router.get("/estado", (_req, res) => {
  res.json({ proveedores: obtenerEstadoProveedoresVoz() });
});

module.exports = router;
