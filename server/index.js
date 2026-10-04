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

// Middleware de seguridad y detección de propietario en toda la aplicación
app.use(authMiddleware);

// Rutas de autenticación y verificación institucional
app.use("/api/auth", authRoutes);
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

app.use("/api/plan", planRoutes);
app.use("/api/ocr", ocrRoutes);
app.use("/api/export", exportRoutes);
app.use("/api/voice", voiceRoutes);
app.use("/api/voz", voiceRoutes);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Planifica Maestro backend escuchando en http://localhost:${PORT}`);
  console.log("=== ESTADO INICIAL DE PROVEEDORES ===");
  try {
    const { obtenerEstadoProveedores } = require("./ia/enrutadorIA");
    const { obtenerEstadoProveedoresVoz } = require("./ia/enrutadorVoz");
    const provsTexto = obtenerEstadoProveedores();
    provsTexto.forEach(p => {
      const tagClave = p.conClave ? "[CONFIGURADO]" : "[FALTA CLAVE]";
      console.log(`  IA (${p.id}): ${tagClave} - Estado: ${p.estado} - Modelo: ${p.modelo} (${p.activo ? "Activo" : "Inactivo"})`);
    });
    const provsVoz = obtenerEstadoProveedoresVoz();
    provsVoz.forEach(p => {
      const tagClave = p.conClave ? "[CONFIGURADO]" : "[FALTA CLAVE]";
      console.log(`  Voz (${p.id}): ${tagClave} - Estado: ${p.estado} (${p.activo ? "Activo" : "Inactivo"})`);
    });
  } catch (err) {
    console.warn("No se pudo obtener el estado inicial de proveedores:", err.message);
  }
  console.log("=====================================");
});

