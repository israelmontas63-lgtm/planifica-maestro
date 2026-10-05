/**
 * scripts/prueba_vision_real.mjs
 * Prueba real de visión contra el motor de IA de Ojo Digital.
 * Envía 3 imágenes reales:
 * 1. Objeto / Logotipo educativo (icon-192.png)
 * 2. Texto / Documento gráfico (icon-512.png)
 * 3. Imagen Borrosa / Ilegible (1x1 pixel oscuro)
 */

import fs from 'node:fs';
import path from 'node:path';
import { identificarImagenWorker } from '../worker/ojoDigital.js';

// Cargar variables de entorno desde .dev.vars
const devVarsPath = path.resolve(process.cwd(), '.dev.vars');
const env = {};
if (fs.existsSync(devVarsPath)) {
  const lines = fs.readFileSync(devVarsPath, 'utf8').split('\n');
  for (const line of lines) {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
    }
  }
}

// 1. Imagen de Objeto / Emblema escolar (icon-192.png real)
const imagenObjeto = fs.readFileSync('client/public/icons/icon-192.png').toString('base64');

// 2. Imagen de Texto / Gráfico educativo (icon-512.png real)
const imagenTexto = fs.readFileSync('client/public/icons/icon-512.png').toString('base64');

// 3. Imagen Borrosa / Ilegible (1x1 píxel JPEG oscuro)
const imagenBorrosa = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

async function probarCaso(nombre, imageBase64, mediaType) {
  console.log(`\n========================================`);
  console.log(`Probando caso: ${nombre}`);
  console.log(`========================================`);

  const t0 = performance.now();
  const res = await identificarImagenWorker({
    imageBase64,
    mediaType,
    env
  });
  const t1 = performance.now();
  const duracion = Math.round(t1 - t0);

  console.log(`⏱️ Tiempo transcurrido: ${duracion} ms`);
  console.log(`✅ Éxito: ${res.exito}`);
  if (res.exito) {
    console.log(`🤖 Proveedor / Modelo utilizado: ${res.proveedor_utilizado}`);
    console.log(`📋 Tipo visual detectado: ${res.tipo_visual}`);
    console.log(`🔍 Es borrosa: ${res.es_borrosa}`);
    console.log(`💬 Descripción devuelta:\n"${res.descripcion}"`);
    console.log(`🔘 Opciones interactivas generadas (${res.opciones?.length}):`);
    res.opciones?.forEach((op, i) => console.log(`   ${i + 1}. ${op}`));

    // Validar cumplimiento de esquema Ojo Digital
    const cumpleEsquema = Boolean(
      res.descripcion &&
      typeof res.descripcion === 'string' &&
      res.tipo_visual &&
      Array.isArray(res.opciones) &&
      res.opciones.length >= 2
    );
    console.log(`📐 Cumple esquema JSON de Ojo Digital: ${cumpleEsquema ? 'SÍ (VÁLIDO)' : 'NO (INVÁLIDO)'}`);
  } else {
    console.error(`❌ Falló: motivo=${res.motivo}, código_http=${res.codigo_http}`);
    console.error(`Mensaje: ${res.mensaje}`);
  }
  return res;
}

async function main() {
  console.log('🚀 Iniciando Batería de Pruebas Reales de Visión Ojo Digital...');
  const res1 = await probarCaso('1. Objeto / Emblema', imagenObjeto, 'image/png');
  const res2 = await probarCaso('2. Texto / Gráfico educativo', imagenTexto, 'image/png');
  const res3 = await probarCaso('3. Imagen Borrosa / Ilegible', imagenBorrosa, 'image/jpeg');

  console.log('\n========================================');
  console.log('RESUMEN DE PRUEBAS REALES:');
  console.log(`- Objeto: ${res1.exito ? 'PASÓ' : 'FALLÓ'}`);
  console.log(`- Texto: ${res2.exito ? 'PASÓ' : 'FALLÓ'}`);
  console.log(`- Borrosa: ${res3.exito ? 'PASÓ' : 'FALLÓ'}`);
  console.log('========================================\n');
}

main();
