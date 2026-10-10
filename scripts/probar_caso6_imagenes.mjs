import fs from 'node:fs';
import path from 'node:path';
import { identificarImagenWorker } from '../worker/ojoDigital.js';

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

const imagenes = [
  { nombre: '1. Pixel Negro 1x1', path: null, b64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQIAAA1tHwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVIrkKJRgw=' },
  { nombre: '2. Imagen Borrosa 800x600', path: 'tests/fixtures/ocr/imagen_borrosa_800x600.png' },
  { nombre: '3. Imagen Oscura 800x600', path: 'tests/fixtures/ocr/imagen_oscura_800x600.png' },
  { nombre: '4. Imagen Legible 800x600', path: 'tests/fixtures/ocr/imagen_legible_800x600.png' }
];

async function testImagenes() {
  console.log('=== TEST CASO 6 CON 4 IMAGENES ===');
  const resultados = [];
  for (const img of imagenes) {
    const b64 = img.b64 || fs.readFileSync(img.path).toString('base64');
    const t0 = performance.now();
    try {
      const res = await identificarImagenWorker({
        imageBase64: b64,
        mediaType: 'image/png',
        env,
        validarCalidad: true
      });
      const ms = Math.round(performance.now() - t0);
      const salida = {
        nombre: img.nombre,
        ms,
        exito: res.exito,
        tipo_visual: res.tipo_visual,
        es_borrosa: res.es_borrosa,
        proveedor: res.proveedor_utilizado,
        codigo_http: res.codigo_http,
        descripcion: res.descripcion,
        opciones: res.opciones
      };
      resultados.push(salida);
      console.log('IMG: ' + img.nombre);
      console.log('  Tiempo: ' + ms + ' ms | Proveedor: ' + res.proveedor_utilizado + ' | HTTP: ' + res.codigo_http);
      console.log('  Tipo visual: ' + res.tipo_visual + ' | Es borrosa: ' + res.es_borrosa);
      console.log('  Descripcion: ' + JSON.stringify(res.descripcion));
      console.log('  Opciones: ' + (res.opciones ? res.opciones.join(' | ') : 'ninguna'));
    } catch (e) {
      const ms = Math.round(performance.now() - t0);
      console.error('ERROR en ' + img.nombre, { ms, error: e.message });
      resultados.push({ nombre: img.nombre, error: e.message, ms });
    }
  }
  fs.writeFileSync('scratch_caso6_imagenes.json', JSON.stringify(resultados, null, 2), 'utf8');
  console.log('GRABADO caso6_imagenes.json');
}

testImagenes().catch(console.error);
