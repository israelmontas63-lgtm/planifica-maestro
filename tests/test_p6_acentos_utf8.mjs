import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const PALABRAS_ROTAS = ['tcnico', 'currculo', 'planificacin', 'didctica', 'micrfono'];
const DIRECTORIOS = ['worker', 'shared', 'client/src'];

function escanearDirectorio(dir, extensiones = ['.js', '.mjs', '.jsx', '.json']) {
  const hallazgos = [];
  if (!fs.existsSync(dir)) return hallazgos;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    const rutaCompleta = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name !== 'node_modules' && ent.name !== 'dist' && ent.name !== '.git') {
        hallazgos.push(...escanearDirectorio(rutaCompleta, extensiones));
      }
    } else if (extensiones.some(ext => ent.name.endsWith(ext))) {
      const contenido = fs.readFileSync(rutaCompleta, 'utf8');
      
      // 1. Detección de caracter de sustitución UTF-8 roto
      if (contenido.includes('\uFFFD')) {
        hallazgos.push({
          archivo: rutaCompleta,
          tipo: 'Caracter corrupto \uFFFD detectado'
        });
      }

      // 2. Detección de raíces o palabras despojadas sin tilde en código o mensajes
      const lower = contenido.toLowerCase();
      for (const p of PALABRAS_ROTAS) {
        if (lower.includes(p)) {
          hallazgos.push({
            archivo: rutaCompleta,
            tipo: 'Palabra desprovista de acento detectada: ' + p
          });
        }
      }
    }
  }
  return hallazgos;
}

test('P6: Integridad de acentos UTF-8 en worker, shared y client/src', (t) => {
  const todosLosHallazgos = [];
  for (const d of DIRECTORIOS) {
    todosLosHallazgos.push(...escanearDirectorio(d));
  }

  assert.equal(
    todosLosHallazgos.length,
    0,
    'No debe existir ningún caracter corrupto \uFFFD ni palabras rotas sin tildes en el código: ' +
      JSON.stringify(todosLosHallazgos, null, 2)
  );
});
