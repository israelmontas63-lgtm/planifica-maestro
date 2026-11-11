import https from "node:https";

const WORKER_URL = process.env.VITE_API_URL || "https://planifica-maestro.israelmontas65.workers.dev";

console.log(`📡 Probando conectividad del Cerebro en producción: ${WORKER_URL}/api/health`);

// Realizar petición GET al health check o OPTIONS para validar headers CORS
const req = https.request(`${WORKER_URL}/api/health`, { method: "GET", timeout: 10000 }, (res) => {
  console.log(`HTTP Status: ${res.statusCode}`);
  let data = "";
  res.on("data", chunk => data += chunk);
  res.on("end", () => {
    console.log("Respuesta del Worker:", data || "(Vacía / 200 OK)");
  });
});

req.on("error", (e) => {
  console.log("Aviso de conexión:", e.message);
});
req.end();
