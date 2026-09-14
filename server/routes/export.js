const express = require("express");
const { Document, Packer, Paragraph, HeadingLevel, TextRun } = require("docx");

const router = express.Router();

/**
 * POST /api/export/docx
 * body: { titulo: string, plan: string }
 */
router.post("/docx", async (req, res) => {
  try {
    const { titulo = "Planificacion", plan = "" } = req.body;
    if (!plan) return res.status(400).json({ error: "Falta 'plan'." });

    const paragraphs = plan.split("\n").map((line) => {
      const isHeading = /:$/.test(line.trim()) && line.trim().length < 80;
      return new Paragraph({
        heading: isHeading ? HeadingLevel.HEADING_2 : undefined,
        children: [new TextRun({ text: line, bold: isHeading })],
      });
    });

    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({ text: titulo, heading: HeadingLevel.TITLE }),
            new Paragraph({ text: "" }),
            ...paragraphs,
          ],
        },
      ],
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
    console.error(err);
    res.status(500).json({ error: "Error exportando a Word.", detail: err.message });
  }
});

module.exports = router;
