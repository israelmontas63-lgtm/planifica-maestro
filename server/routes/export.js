const express = require("express");
const { Packer } = require("docx");
const { construirDocumentoWordOficial } = require("../services/generadorWordConBaseServer.js");
const { generarWordConBaseMultigrado } = require("../services/generadorWordConBaseMultigrado.js");

const router = express.Router();

/**
 * POST /api/export/docx
 * body: { titulo: string, plan: string, datos?: object, perfil?: object, formato?: string, mostrarTiempo?: boolean }
 */
router.post("/docx", async (req, res) => {
  try {
    const { titulo = "Planificacion", plan = "", datos = null, perfil = null, formato = "oficial", mostrarTiempo = false } = req.body;
    if (!plan && (!datos || Object.keys(datos).length === 0)) {
      return res.status(400).json({ error: "Falta 'plan' o 'datos'." });
    }

    let doc;
    if (formato === "con_base_multigrado" && datos && datos.apartado_I_insercion_curricular) {
      doc = await generarWordConBaseMultigrado(datos, { mostrarTiempo: Boolean(mostrarTiempo) });
    } else {
      doc = await construirDocumentoWordOficial({
        titulo,
        plan,
        datos,
        perfil
      });
    }

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

/**
 * POST /api/export/docx-con-base-multigrado
 * Exportación directa y específica del formato "Secuencia didáctica CON BASE - multigrado (primer ciclo)"
 */
router.post("/docx-con-base-multigrado", async (req, res) => {
  try {
    const { datos, titulo = "Secuencia_Didactica_CON_BASE_Multigrado", mostrarTiempo = false } = req.body;
    if (!datos || typeof datos !== "object") {
      return res.status(400).json({ error: "Faltan los datos estructurados del esquema CON BASE multigrado." });
    }

    const doc = await generarWordConBaseMultigrado(datos, { mostrarTiempo: Boolean(mostrarTiempo) });
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
    console.error("Error exportando CON BASE multigrado a Word:", err);
    res.status(500).json({ error: "Error exportando a Word.", detail: err.message });
  }
});

module.exports = router;

