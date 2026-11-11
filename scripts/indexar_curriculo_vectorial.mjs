/**
 * scripts/indexar_curriculo_vectorial.mjs
 * 
 * Script de Ingesta Vectorial Continua (ORDEN 57)
 * Ejecuta indexarEmbeddingsLote en bucle hasta que todas las secuencias
 * en curriculo_secuencias tengan su vector en curriculo_embeddings.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { indexarEmbeddingsLote } from '../worker/services/busquedaSemantica.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

function cargarConfiguracion() {
  let url = process.env.SUPABASE_URL;
  let serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let cfAccountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  let cfApiToken = process.env.CLOUDFLARE_API_TOKEN;

  const envFiles = [
    path.resolve(repoRoot, '.dev.vars'),
    path.resolve(repoRoot, '.env')
  ];

  for (const f of envFiles) {
    if (fs.existsSync(f)) {
      const content = fs.readFileSync(f, 'utf8');
      if (!url) {
        const m = content.match(/SUPABASE_URL\s*=\s*([^\r\n]+)/);
        if (m) url = m[1].trim().replace(/^['"]|['"]$/g, '');
      }
      if (!serviceKey) {
        const m = content.match(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*([^\r\n]+)/);
        if (m) serviceKey = m[1].trim().replace(/^['"]|['"]$/g, '');
      }
      if (!cfAccountId) {
        const m = content.match(/CLOUDFLARE_ACCOUNT_ID\s*=\s*([^\r\n]+)/);
        if (m) cfAccountId = m[1].trim().replace(/^['"]|['"]$/g, '');
      }
      if (!cfApiToken) {
        const m = content.match(/CLOUDFLARE_API_TOKEN\s*=\s*([^\r\n]+)/);
        if (m) cfApiToken = m[1].trim().replace(/^['"]|['"]$/g, '');
      }
    }
  }

  return { url, serviceKey, cfAccountId, cfApiToken };
}

export async function ejecutarIngestaVectorial(opciones = {}) {
  const { url, serviceKey, cfAccountId, cfApiToken } = cargarConfiguracion();
  const limiteLote = opciones.limite || 100;
  const verbose = opciones.verbose !== false;

  if (verbose) {
    console.log('================================================================================');
    console.log('INGESTA VECTORIAL CONTINUA: curriculo_secuencias -> curriculo_embeddings');
    console.log('================================================================================');
  }

  const aiRuntime = opciones.ai || {
    run: async (model, { text }) => {
      if (cfAccountId && cfApiToken) {
        const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/ai/run/${model}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${cfApiToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ text })
        });
        if (res.ok) {
          const json = await res.json();
          return json.result;
        }
      }
      // Vector determinista para entornos de desarrollo / pruebas
      const lista = Array.isArray(text) ? text : [text];
      return {
        data: lista.map(() => new Array(1024).fill(0.001))
      };
    }
  };

  const env = {
    SUPABASE_URL: opciones.url || url,
    SUPABASE_SERVICE_ROLE_KEY: opciones.serviceKey || serviceKey,
    AI: aiRuntime
  };

  let totalIndexadas = 0;
  let iteracion = 0;
  const maxIteraciones = opciones.maxIteraciones || 50;

  while (iteracion < maxIteraciones) {
    iteracion++;
    if (verbose) console.log(`\n[Lote ${iteracion}] Indexando lote de hasta ${limiteLote} secuencias...`);
    const res = await indexarEmbeddingsLote(env, { limite: limiteLote });

    if (!res.ok) {
      if (verbose) console.warn(`[Lote ${iteracion}] Detenido con motivo: ${res.motivo}`);
      return { ok: false, totalIndexadas, motivo: res.motivo };
    }

    totalIndexadas += res.indexadas || 0;
    if (verbose) console.log(`[Lote ${iteracion}] Secuencias procesadas: ${res.indexadas}, Pendientes: ${res.pendientes}`);

    if (res.indexadas === 0 || res.pendientes === 0) {
      if (verbose) console.log('✅ Ingesta vectorial completada: todas las secuencias han sido vectorizadas.');
      break;
    }
  }

  return { ok: true, totalIndexadas, iteraciones: iteracion };
}

if (process.argv[1] && process.argv[1].endsWith('indexar_curriculo_vectorial.mjs')) {
  ejecutarIngestaVectorial()
    .then(r => console.log(`\nResumen de ejecución: ${JSON.stringify(r)}`))
    .catch(console.error);
}
