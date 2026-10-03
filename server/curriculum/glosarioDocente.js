const fs = require("fs");
const path = require("path");

let cacheGlosario = null;

function cargarGlosario() {
  if (cacheGlosario) return cacheGlosario;
  const ruta = path.join(__dirname, "..", "curriculo", "glosario_docente.json");
  if (fs.existsSync(ruta)) {
    try {
      cacheGlosario = JSON.parse(fs.readFileSync(ruta, "utf-8"));
    } catch (e) {
      cacheGlosario = {};
    }
  } else {
    cacheGlosario = {};
  }
  return cacheGlosario;
}

function buscarEnGlosario(termino) {
  if (!termino || typeof termino !== "string") return null;
  const norm = termino.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  const glosario = cargarGlosario();
  
  for (const [clave, item] of Object.entries(glosario)) {
    const claveNorm = clave.replace(/_/g, " ");
    const terminoNorm = (item.termino || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (norm === claveNorm || norm.includes(claveNorm) || norm === terminoNorm || norm.includes(terminoNorm)) {
      return item;
    }
  }
  return null;
}

// Carga inmediata en memoria al arrancar
cargarGlosario();

module.exports = {
  cargarGlosario,
  buscarEnGlosario
};
