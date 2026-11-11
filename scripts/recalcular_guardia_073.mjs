import fs from 'fs';
import crypto from 'crypto';

function sha256File(path) {
  const content = fs.readFileSync(path);
  return crypto.createHash('sha256').update(content).digest('hex');
}

const config = JSON.parse(fs.readFileSync('PROTEGIDO.hashes.json', 'utf8'));
const files = Object.keys(config.hashes);

for (const file of files) {
  if (fs.existsSync(file)) {
    config.hashes[file] = sha256File(file);
  } else {
    console.warn("Archivo no existe:", file);
  }
}

// Calcular resumen concatenado en orden alfabetico
const hashesConcatenados = files
  .sort()
  .map(f => config.hashes[f])
  .join('');

const nuevoResumen = crypto.createHash('sha256').update(hashesConcatenados).digest('hex');
config.resumen = nuevoResumen;
config.resumen_criptografico = nuevoResumen;
config.fecha_generacion = new Date().toISOString();

fs.writeFileSync('PROTEGIDO.hashes.json', JSON.stringify(config, null, 2) + '\n', 'utf8');

console.log("Nuevo resumen criptográfico:", nuevoResumen);
console.log("Hash worker/index.js:", config.hashes['worker/index.js']);
console.log("Hash client/src/App.jsx:", config.hashes['client/src/App.jsx']);
