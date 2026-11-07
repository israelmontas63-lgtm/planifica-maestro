/**
 * scripts/probar_planificacion_e2e.mjs
 * Prueba E2E de Disparo Real a través del Router HTTP de Planificación
 * ORDEN 49: Verificación de Ruta HTTP y Disparo Real
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { planificacionRouter } from '../worker/routes/planificacionRouter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

function cargarEnv() {
  const env = { ...process.env };
  const devVarsPath = path.resolve(repoRoot, '.dev.vars');
  if (fs.existsSync(devVarsPath)) {
    const lines = fs.readFileSync(devVarsPath, 'utf8').split('\n');
    for (const line of lines) {
      const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim().replace(/^['"]|['"]$/g, '');
        if (!env[key]) {
          env[key] = value;
        }
      }
    }
  }
  if (!env.GEMINI_MODEL) {
    env.GEMINI_MODEL = 'gemini-3.1-flash-lite';
  }
  return env;
}

async function main() {
  console.log('================================================================================');
  console.log('PRUEBA DE DISPARO REAL E2E - RUTA POST /api/planificar');
  console.log('================================================================================');

  const env = cargarEnv();
  const promptPrueba = 'Muéstrame un ejemplo de planificación multigrado para 1.° y 2.° de Lengua Española';

  console.log(`Prompt: "${promptPrueba}"`);
  console.log('Despachando petición HTTP POST a través de planificacionRouter...');

  const request = new Request('https://planifica-maestro.local/api/planificar', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ prompt: promptPrueba })
  });

  const inicio = Date.now();
  const response = await planificacionRouter(request, env);
  const duracion = Date.now() - inicio;

  if (!response) {
    console.error('❌ Error: El enrutador retornó null (ruta no interceptada).');
    process.exit(1);
  }

  console.log(`HTTP Status: ${response.status} (${response.statusText || 'OK'}) [${duracion}ms]`);
  console.log(`Content-Type: ${response.headers.get('Content-Type')}`);

  const resultadoJson = await response.json();

  console.log('\n--- RESPUESTA JSON RETORNADA ---');
  console.log(JSON.stringify(resultadoJson, null, 2));

  // Verificaciones de Calidad Curricular y Marca Oficial
  const planTexto = resultadoJson.planificacion || JSON.stringify(resultadoJson);
  const sistemaFirma = resultadoJson.sistema || '';

  const tieneInicio = /inicio/i.test(planTexto);
  const tieneDesarrollo = /desarrollo/i.test(planTexto);
  const tieneCierre = /cierre/i.test(planTexto);
  const tieneFirmaOficial = sistemaFirma.includes('Planifica Maestro');
  const sinMencionesIA = !/cread[oa] por ia|generad[oa] por inteligencia artificial|modelo de lenguaje/i.test(planTexto);

  console.log('\n--- VERIFICACIÓN DE CONDICIONES DIDÁCTICAS Y NORMATIVAS ---');
  console.log(`1. Momento Didáctico Inicio: ${tieneInicio ? '✅ PRESENTE' : '❌ AUSENTE'}`);
  console.log(`2. Momento Didáctico Desarrollo: ${tieneDesarrollo ? '✅ PRESENTE' : '❌ AUSENTE'}`);
  console.log(`3. Momento Didáctico Cierre: ${tieneCierre ? '✅ PRESENTE' : '❌ AUSENTE'}`);
  console.log(`4. Identidad Oficial "Planifica Maestro": ${tieneFirmaOficial ? '✅ CERTIFICADA' : '❌ NO DETECTADA'}`);
  console.log(`5. Ausencia de menciones a IA: ${sinMencionesIA ? '✅ LIMPIO' : '❌ SE ENCONTRARON REFERENCIAS'}`);

  if (response.status === 200 && tieneInicio && tieneDesarrollo && tieneCierre && tieneFirmaOficial && sinMencionesIA) {
    console.log('\n🎉 ¡PRUEBA DE DISPARO REAL E2E EXITOSA AL 100%!');
    process.exit(0);
  } else {
    console.error('\n⚠️ Advertencia: Alguna de las verificaciones no se cumplió estrictamente.');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('❌ Error en ejecución E2E:', err);
  process.exit(1);
});
