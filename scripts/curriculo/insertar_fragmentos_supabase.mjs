/**
 * scripts/curriculo/insertar_fragmentos_supabase.mjs
 * 
 * Ingesta masiva y validación criptográfica de secuencias curriculares oficiales MINERD
 * hacia la tabla public.curriculo_secuencias de Supabase.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  gradoANumero,
  cicloDeGrado,
  normalizarNivel,
  normalizarArea,
  NIVELES,
  AREAS
} from '../../shared/catalogoCurricular.mjs';

export function normalizarEspacios(texto) {
  if (typeof texto !== 'string') return '';
  return texto.trim().replace(/\s+/g, ' ');
}

export function calcularHuella(item) {
  const comp = normalizarEspacios(item.competencias_especificas || '');
  const cont = normalizarEspacios(item.contenidos_texto_original || '');
  const indStr = Array.isArray(item.indicadores_logro)
    ? item.indicadores_logro.map(normalizarEspacios).join('|')
    : '';

  const cadena = [
    item.nivel || '',
    item.grado_num || '',
    item.area || '',
    normalizarEspacios(item.tema || ''),
    comp,
    cont,
    indStr,
    normalizarEspacios(item.fuente_documento || '')
  ].join('::');

  return crypto.createHash('sha256').update(cadena, 'utf8').digest('hex');
}

/**
 * Normaliza y valida un registro crudo del JSON
 */
export function normalizarFragmento(item, opciones = {}) {
  const { versionesPorDoc = {}, versionFija = null, esDryRun = false } = opciones;
  const errores = [];
  const motivosRevision = [];

  if (!item || typeof item !== 'object') {
    return { valido: false, errores: ['Registro nulo o no es un objeto'] };
  }

  // 1. source_id (id de la matriz original)
  const source_id = item.id || item.source_id;
  if (!source_id || typeof source_id !== 'string') {
    errores.push('Falta el campo id/source_id obligatorio');
  }

  // 2. nivel
  const nivelNorm = normalizarNivel(item.nivel);
  if (!nivelNorm) {
    errores.push(`Nivel inválido o no reconocido: "${item.nivel}"`);
  } else if (nivelNorm === 'Inicial') {
    errores.push('Nivel Inicial no soportado todavía (requiere estructura etaria)');
  }

  // 3. grado_num y ciclo
  const grado_num = gradoANumero(item.grado);
  if (grado_num === null) {
    errores.push(`Grado escolar inválido o no reconocido: "${item.grado}"`);
  }

  const cicloDerivado = grado_num ? cicloDeGrado(grado_num) : null;
  if (item.ciclo) {
    const cLimpio = normalizarEspacios(item.ciclo).toLowerCase();
    if (cicloDerivado && cLimpio.includes('primer') && cicloDerivado !== 'Primer Ciclo') {
      errores.push(`Ciclo "${item.ciclo}" incoherente con el grado ${grado_num}`);
    } else if (cicloDerivado && cLimpio.includes('segundo') && cicloDerivado !== 'Segundo Ciclo') {
      errores.push(`Ciclo "${item.ciclo}" incoherente con el grado ${grado_num}`);
    }
  }

  // 4. area
  let areaNorm = null;
  try {
    areaNorm = normalizarArea(item.area);
  } catch (errArea) {
    errores.push(errArea.message);
  }

  // 5. tema
  const tema = typeof item.tema === 'string' ? item.tema.trim() : '';
  if (!tema) {
    errores.push('Falta el tema del fragmento');
  }

  // 6. competencias_especificas
  let compTexto = '';
  if (Array.isArray(item.competencias_especificas)) {
    compTexto = item.competencias_especificas.map(s => String(s).trim()).filter(Boolean).join(' ');
  } else if (typeof item.competencias_especificas === 'string') {
    compTexto = item.competencias_especificas.trim();
  }

  if (!compTexto) {
    errores.push('Faltan las competencias específicas');
  } else if (!/[.!?]$/.test(compTexto.trim())) {
    motivosRevision.push('competencias_especificas no termina en punto');
  }

  // 7. contenidos_texto_original
  const contenidosTexto = typeof item.contenidos === 'string'
    ? item.contenidos.trim()
    : typeof item.contenidos_texto_original === 'string'
    ? item.contenidos_texto_original.trim()
    : null;

  // 8. indicadores_logro
  let indicadores = [];
  if (Array.isArray(item.indicadores_logro)) {
    indicadores = item.indicadores_logro.map(s => String(s).trim()).filter(Boolean);
  } else if (Array.isArray(item.indicadores)) {
    indicadores = item.indicadores.map(s => String(s).trim()).filter(Boolean);
  }

  if (indicadores.length === 0) {
    errores.push('indicadores_logro debe ser un arreglo no vacío');
  } else {
    // Detección de texto dañado o indicadores partidos/truncados
    for (let i = 0; i < indicadores.length; i++) {
      const ind = indicadores[i];
      const esUltimo = i === indicadores.length - 1;

      if (!/[.!?]$/.test(ind)) {
        if (!esUltimo) {
          motivosRevision.push(`indicador partido en posición ${i}: no termina en signo final`);
        } else {
          motivosRevision.push(`indicador truncado en último elemento: no termina en signo final`);
        }
      }

      if (/[]|\uFFFD|\?\?/.test(ind)) {
        motivosRevision.push(`caracteres corruptos detectados en indicador ${i}`);
      }
    }
  }

  // 9. fuente y versión
  const fuente_documento = (item.documento_fuente || item.fuente_documento || '').trim();
  if (!fuente_documento) {
    errores.push('Falta el documento_fuente oficial');
  }

  let version_curricular = versionFija || versionesPorDoc[fuente_documento] || item.version_curricular || null;
  if (!version_curricular) {
    if (esDryRun) {
      version_curricular = 'SIN_VERSION';
    } else {
      errores.push(`Falta versión curricular oficial para el documento: "${fuente_documento}"`);
    }
  }

  const pagina = item.pagina_referencia != null
    ? String(item.pagina_referencia).trim()
    : (item.pagina != null ? String(item.pagina).trim() : null);

  const bloque_guia = item.bloque || item.bloque_guia || null;
  const url_fuente = item.url_fuente || null;

  let estado_validacion = item.estado_validacion || 'pendiente_validacion';
  if (motivosRevision.length > 0) {
    estado_validacion = 'requiere_revision_fuente';
  }

  if (errores.length > 0) {
    return { valido: false, source_id, errores };
  }

  const normalizado = {
    source_id,
    nivel: nivelNorm,
    ciclo: cicloDerivado,
    grado_num,
    area: areaNorm,
    tema,
    bloque_guia,
    competencias_especificas: compTexto,
    contenidos_texto_original: contenidosTexto,
    indicadores_logro: indicadores,
    fuente_documento,
    version_curricular,
    pagina,
    url_fuente,
    estado_validacion,
    vigente: true,
    motivos_revision: motivosRevision
  };

  normalizado.huella = calcularHuella(normalizado);

  return {
    valido: true,
    registro: normalizado,
    requiere_revision: motivosRevision.length > 0,
    motivos_revision: motivosRevision
  };
}

/**
 * Procesa un lote de fragmentos, validando y detectando duplicados locales
 */
export function procesarFragmentos(lista = [], opciones = {}) {
  const validos = [];
  const errores = [];
  const vistosSourceId = new Set();
  const vistosHuella = new Set();
  let duplicadosOmitidos = 0;
  const idsRevision = [];

  for (const item of lista) {
    const res = normalizarFragmento(item, opciones);
    if (!res.valido) {
      errores.push({ source_id: res.source_id || 'desconocido', errores: res.errores });
      continue;
    }

    if (vistosSourceId.has(res.registro.source_id)) {
      errores.push({ source_id: res.registro.source_id, errores: ['source_id duplicado en el archivo fuente'] });
      continue;
    }

    if (vistosHuella.has(res.registro.huella)) {
      duplicadosOmitidos++;
      continue;
    }

    vistosSourceId.add(res.registro.source_id);
    vistosHuella.add(res.registro.huella);

    if (res.requiere_revision) {
      idsRevision.push({ source_id: res.registro.source_id, motivos: res.motivos_revision, pagina: res.registro.pagina });
    }

    validos.push(res.registro);
  }

  return { validos, errores, duplicadosOmitidos, idsRevision };
}

/**
 * Clasifica registros contra una base de datos o cliente simulado
 */
export async function clasificarRegistrosExistentes(registrosValidos, clienteBD) {
  const existentes = await clienteBD.obtenerSourceIdsYHuellas();
  const mapaExistentes = new Map(existentes.map(e => [e.source_id, e.huella]));

  const nuevos = [];
  const cambiados = [];
  const sinCambios = [];
  const setArchivo = new Set(registrosValidos.map(r => r.source_id));

  for (const reg of registrosValidos) {
    if (!mapaExistentes.has(reg.source_id)) {
      nuevos.push(reg);
    } else {
      const huellaBD = mapaExistentes.get(reg.source_id);
      if (huellaBD !== reg.huella) {
        cambiados.push(reg);
      } else {
        sinCambios.push(reg);
      }
    }
  }

  const ausentesEnArchivo = existentes
    .filter(e => !setArchivo.has(e.source_id))
    .map(e => e.source_id);

  return { nuevos, cambiados, sinCambios, ausentesEnArchivo };
}

export function listarValores(lista = []) {
  const niveles = {};
  const ciclos = {};
  const grados = {};
  const areas = {};
  const fuentes = {};

  for (const item of lista) {
    const n = item.nivel || 'desconocido';
    niveles[n] = (niveles[n] || 0) + 1;

    const c = item.ciclo || item.bloque || 'sin_ciclo';
    ciclos[c] = (ciclos[c] || 0) + 1;

    const g = item.grado || 'sin_grado';
    grados[g] = (grados[g] || 0) + 1;

    const a = item.area || 'sin_area';
    areas[a] = (areas[a] || 0) + 1;

    const f = item.documento_fuente || item.fuente_documento || 'sin_fuente';
    fuentes[f] = (fuentes[f] || 0) + 1;
  }

  console.log('--- VALORES DISTINTOS EN LA FUENTE ---');
  console.log('Niveles:', niveles);
  console.log('Ciclos / Bloques:', ciclos);
  console.log('Grados:', grados);
  console.log('Áreas:', areas);
  console.log('Fuentes:', fuentes);
}

// Ejecución CLI si es invocado directamente
if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  (async () => {
    const args = process.argv.slice(2);
    const esDryRun = args.includes('--dry-run');
    const esListar = args.includes('--listar-valores');
    const esInsertar = args.includes('--insertar');

    const archivoArg = args.find(a => a.startsWith('--archivo='));
    const rutaJson = archivoArg
      ? archivoArg.split('=')[1]
      : path.resolve(process.cwd(), 'server', 'curriculo', 'capa3_estructurados', 'curriculo_estructurado.json');

    const versionArg = args.find(a => a.startsWith('--version='));
    const versionFija = versionArg ? versionArg.split('=')[1] : null;

    if (!fs.existsSync(rutaJson)) {
      console.error(`❌ Error: No existe el archivo de entrada: ${rutaJson}`);
      process.exit(1);
    }

    const raw = JSON.parse(fs.readFileSync(rutaJson, 'utf8'));
    console.log(`📖 Leyendo fuente de datos desde: ${rutaJson}`);
    console.log(`📊 Total de registros leídos: ${raw.length}\n`);

    if (esListar) {
      listarValores(raw);
      process.exit(0);
    }

    let versionesPorDoc = {};
    const rutaVersiones = path.resolve(process.cwd(), 'server', 'curriculo', 'fuentes_versiones.json');
    if (fs.existsSync(rutaVersiones)) {
      versionesPorDoc = JSON.parse(fs.readFileSync(rutaVersiones, 'utf8'));
    }

    const { validos, errores, duplicadosOmitidos, idsRevision } = procesarFragmentos(raw, {
      versionesPorDoc,
      versionFija,
      esDryRun: esDryRun || !esInsertar
    });

    if (errores.length > 0) {
      console.error(`❌ Errores de validación en ${errores.length} registros:`);
      errores.forEach(e => console.error(`  - [${e.source_id}]: ${e.errores.join('; ')}`));
      process.exit(1);
    }

    console.log('✅ Validación completada con éxito:');
    console.log(`   - Registros válidos listos: ${validos.length}`);
    console.log(`   - Duplicados en archivo omitidos: ${duplicadosOmitidos}`);
    console.log(`   - Registros marcados 'requiere_revision_fuente': ${idsRevision.length}`);
    console.log(`   - IDs con texto dañado para revisión contra PDF: ${idsRevision.map(r => r.source_id).join(', ')}\n`);

    if (esDryRun || !esInsertar) {
      console.log('🔍 MODO DRY-RUN: Simulación completada exitosamente. No se escribieron datos.');
      process.exit(0);
    }

    console.log('🚀 MODO CARGA REAL: Iniciando conexión con Supabase...');
    // Prohibido ejecutar carga real en esta fase si no está la base activa
    console.log('Operación de inserción en Supabase remota no autorizada en esta fase.');
  })();
}
