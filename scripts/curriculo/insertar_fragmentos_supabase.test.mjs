import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizarFragmento,
  procesarFragmentos,
  calcularHuella,
  clasificarRegistrosExistentes
} from './insertar_fragmentos_supabase.mjs';

const baseValida = () => ({
  id: 'matriz_test_1',
  nivel: 'Primario',
  ciclo: 'Primer Ciclo',
  grado: '2do Grado',
  area: 'Matemática',
  tema: 'Adición con reagrupación',
  competencias_especificas: ['Aplica operaciones de suma.', 'Resuelve situaciones cotidianas.'],
  contenidos: 'Conceptos y algoritmos de suma.',
  indicadores_logro: [
    'Resuelve problemas aditivos con números naturales.',
    'Utiliza estrategias de cálculo mental.'
  ],
  documento_fuente: 'Guía Didáctica de Matemática (MINERD / CON BASE)',
  pagina_referencia: '40'
});

describe('scripts/curriculo/insertar_fragmentos_supabase.mjs', () => {
  it('normaliza un registro válido y genera huella SHA-256', () => {
    const res = normalizarFragmento(baseValida(), { versionFija: '2023' });
    assert.equal(res.valido, true);
    assert.equal(res.registro.source_id, 'matriz_test_1');
    assert.equal(res.registro.nivel, 'Primario');
    assert.equal(res.registro.grado_num, 2);
    assert.equal(res.registro.ciclo, 'Primer Ciclo');
    assert.equal(res.registro.area, 'Matemática');
    assert.equal(res.registro.competencias_especificas, 'Aplica operaciones de suma. Resuelve situaciones cotidianas.');
    assert.equal(res.registro.estado_validacion, 'pendiente_validacion');
    assert.equal(typeof res.registro.huella, 'string');
    assert.equal(res.registro.huella.length, 64);
  });

  it('rechaza nivel Inicial con mensaje no soportado todavía', () => {
    const item = { ...baseValida(), nivel: 'Inicial' };
    const res = normalizarFragmento(item, { versionFija: '2023' });
    assert.equal(res.valido, false);
    assert.ok(res.errores.some(e => e.includes('no soportado todavía')));
  });

  it('rechaza área desconocida fuera de catálogo', () => {
    const item = { ...baseValida(), area: 'Ciencias Sociales' };
    const res = normalizarFragmento(item, { versionFija: '2023' });
    assert.equal(res.valido, false);
    assert.ok(res.errores.some(e => e.includes('fuera de catálogo')));
  });

  it('detecta ciclo incoherente con el grado', () => {
    const item = { ...baseValida(), grado: '5to Grado', ciclo: 'Primer Ciclo' };
    const res = normalizarFragmento(item, { versionFija: '2023' });
    assert.equal(res.valido, false);
    assert.ok(res.errores.some(e => e.includes('incoherente')));
  });

  it('detecta indicador truncado (caso real 2do grado sin punto final)', () => {
    const item = baseValida();
    item.indicadores_logro = [
      'Indicador 1 correcto.',
      'Demuestra respeto por las'
    ];
    const res = normalizarFragmento(item, { versionFija: '2023' });
    assert.equal(res.valido, true);
    assert.equal(res.registro.estado_validacion, 'requiere_revision_fuente');
    assert.ok(res.motivos_revision.some(m => m.includes('truncado')));
  });

  it('detecta indicador partido (caso real 3er grado sin punto intermedio)', () => {
    const item = baseValida();
    item.indicadores_logro = [
      'Valora las opiniones de sus',
      'interlocutores en el aula.'
    ];
    const res = normalizarFragmento(item, { versionFija: '2023' });
    assert.equal(res.valido, true);
    assert.equal(res.registro.estado_validacion, 'requiere_revision_fuente');
    assert.ok(res.motivos_revision.some(m => m.includes('partido')));
  });

  it('une competencias sin alterar palabras y exige punto final', () => {
    const item = baseValida();
    item.competencias_especificas = ['Competencia A', 'sin punto final'];
    const res = normalizarFragmento(item, { versionFija: '2023' });
    assert.equal(res.valido, true);
    assert.equal(res.registro.estado_validacion, 'requiere_revision_fuente');
    assert.ok(res.motivos_revision.some(m => m.includes('competencias_especificas no termina en punto')));
  });

  it('rechaza versión faltante en carga real pero emite aviso en dry-run', () => {
    const item = baseValida();
    const resCarga = normalizarFragmento(item, { esDryRun: false });
    assert.equal(resCarga.valido, false);
    assert.ok(resCarga.errores.some(e => e.includes('Falta versión curricular')));

    const resDry = normalizarFragmento(item, { esDryRun: true });
    assert.equal(resDry.valido, true);
    assert.equal(resDry.registro.version_curricular, 'SIN_VERSION');
  });

  it('misma huella con espacios distintos y huella distinta al cambiar un indicador', () => {
    const item1 = baseValida();
    const item2 = {
      ...baseValida(),
      competencias_especificas: ['Aplica  operaciones   de suma. ', ' Resuelve situaciones cotidianas.']
    };
    const r1 = normalizarFragmento(item1, { versionFija: '2023' });
    const r2 = normalizarFragmento(item2, { versionFija: '2023' });
    assert.equal(r1.registro.huella, r2.registro.huella);

    const item3 = {
      ...baseValida(),
      indicadores_logro: ['Indicador modificado sustancialmente.']
    };
    const r3 = normalizarFragmento(item3, { versionFija: '2023' });
    assert.notEqual(r1.registro.huella, r3.registro.huella);
  });

  it('clasifica nuevos, cambiados y sin cambios contra cliente BD simulado', async () => {
    const registros = [
      { source_id: 'id_1', huella: 'h1' },
      { source_id: 'id_2', huella: 'h2_modificada' },
      { source_id: 'id_3', huella: 'h3' }
    ];
    const clienteMock = {
      obtenerSourceIdsYHuellas: async () => [
        { source_id: 'id_2', huella: 'h2_antigua' },
        { source_id: 'id_3', huella: 'h3' },
        { source_id: 'id_antiguo_en_bd', huella: 'h_old' }
      ]
    };

    const res = await clasificarRegistrosExistentes(registros, clienteMock);
    assert.equal(res.nuevos.length, 1);
    assert.equal(res.nuevos[0].source_id, 'id_1');
    assert.equal(res.cambiados.length, 1);
    assert.equal(res.cambiados[0].source_id, 'id_2');
    assert.equal(res.sinCambios.length, 1);
    assert.equal(res.sinCambios[0].source_id, 'id_3');
    assert.deepEqual(res.ausentesEnArchivo, ['id_antiguo_en_bd']);
  });
});
