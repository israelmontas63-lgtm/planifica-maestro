const express = require("express");
const { Packer } = require("docx");
const { construirDocumentoWordOficial } = require("../services/generadorWordConBaseServer.js");

const router = express.Router();

/**
 * POST /api/export/docx
 * body: { titulo: string, plan: string, datos?: object, perfil?: object }
 */
router.post("/docx", async (req, res) => {
  try {
    const { titulo = "Planificacion", plan = "", datos = null, perfil = null } = req.body;
    if (!plan && (!datos || Object.keys(datos).length === 0)) {
      return res.status(400).json({ error: "Falta 'plan' o 'datos'." });
    }

    const doc = await construirDocumentoWordOficial({
      titulo,
      plan,
      datos,
      perfil
    });

    const buffer = await Packer.toBuffer(doc);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${titulo.replace(/\s+/g, "_")}.docx"`
    );
    res.send(buffer);
  } catch (err) {
    console.error("Error exportando a Word en servidor:", err);
    res.status(500).json({ error: "Error exportando a Word.", detail: err.message });
  }
});

module.exports = router;

