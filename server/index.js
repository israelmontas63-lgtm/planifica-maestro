require("dotenv").config();
const express = require("express");
const cors = require("cors");

const planRoutes = require("./routes/plan");
const ocrRoutes = require("./routes/ocr");
const exportRoutes = require("./routes/export");
const voiceRoutes = require("./routes/voice");
const authRoutes = require("./routes/auth");
const authMiddleware = require("./middleware/auth");

const app = express();

app.use(cors());
app.use(express.json({ limit: "15mb" }));

// Ruta pública de autenticación y verificación de clave institucional
app.use("/api/auth", authRoutes);
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

// Middleware de seguridad: protege todas las demás APIs sensibles con 401
app.use(authMiddleware);

app.use("/api/plan", planRoutes);
app.use("/api/ocr", ocrRoutes);
app.use("/api/export", exportRoutes);
app.use("/api/voice", voiceRoutes);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Planifica Maestro backend escuchando en http://localhost:${PORT}`);
  if (!process.env.GEMINI_API_KEY) {
    console.warn("WARNING: GEMINI_API_KEY no esta configurada. Copia .env.example a .env y agrega tu clave.");
  }
});
