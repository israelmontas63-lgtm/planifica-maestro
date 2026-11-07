import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GestorMemoriaHibrida } from '../worker/services/gestorMemoriaHibrida.js';
import { OrquestadorPedagogico } from '../worker/services/orquestadorPedagogico.js';

describe('GestorMemoriaHibrida - Memoria a Corto y Largo Plazo', () => {
  const urlMock = 'https://test-supabase.supabase.co';
  const keyMock = 'test-service-key';

  it('debe obtener la memoria a largo plazo con hechos por defecto si no hay conexión', async () => {
    const gestor = new GestorMemoriaHibrida(urlMock, keyMock);
    gestor.fetchFn = async () => ({ ok: false, status: 500 });

    const memoriaTexto = await gestor.obtenerMemoriaLargoPlazo('docente_principal');
    assert.equal(typeof memoriaTexto, 'string');
    assert.ok(memoriaTexto.includes('### MEMORIA PERMANENTE DEL DOCENTE:'));
    assert.ok(memoriaTexto.includes('Israel Montás'));
    assert.ok(memoriaTexto.includes('Escuela Primaria Batey Pinos'));
    assert.ok(memoriaTexto.includes('Multigrado (1.º y 2.º de Primaria)'));
  });

  it('debe recuperar la memoria a largo plazo formateada en markdown desde Supabase', async () => {
    let urlConsultada = '';
    const mockFilas = [
      { categoria: 'perfil', clave: 'nombre_docente', valor: 'Israel Montás' },
      { categoria: 'aula', clave: 'centro_educativo', valor: 'Escuela Primaria Batey Pinos' },
      { categoria: 'preferencia', clave: 'enfoque_lectura', valor: 'Método Con Base' }
    ];

    const gestor = new GestorMemoriaHibrida(urlMock, keyMock);
    gestor.fetchFn = async (url) => {
      urlConsultada = url;
      return {
        ok: true,
        json: async () => mockFilas
      };
    };

    const memoriaTexto = await gestor.obtenerMemoriaLargoPlazo('docente_principal');
    assert.ok(urlConsultada.includes('docente_memoria_largo_plazo'));
    assert.ok(urlConsultada.includes('usuario_id=eq.docente_principal'));
    assert.ok(memoriaTexto.includes('### MEMORIA PERMANENTE DEL DOCENTE:'));
    assert.ok(memoriaTexto.includes('- [perfil] nombre_docente: Israel Montás'));
    assert.ok(memoriaTexto.includes('- [aula] centro_educativo: Escuela Primaria Batey Pinos'));
    assert.ok(memoriaTexto.includes('- [preferencia] enfoque_lectura: Método Con Base'));
  });

  it('debe guardar o actualizar un hecho a largo plazo con resolution=merge-duplicates', async () => {
    let payloadEnviado = null;
    let headersEnviados = null;

    const gestor = new GestorMemoriaHibrida(urlMock, keyMock);
    gestor.fetchFn = async (url, opts) => {
      payloadEnviado = JSON.parse(opts.body);
      headersEnviados = opts.headers;
      return {
        ok: true,
        json: async () => payloadEnviado
      };
    };

    const exito = await gestor.aprenderHecho('preferencia', 'tipo_instrumento', 'Lista de cotejo', 'docente_principal');

    assert.equal(exito, true);
    assert.ok(headersEnviados['Prefer'].includes('resolution=merge-duplicates'));
    assert.equal(payloadEnviado.clave, 'tipo_instrumento');
    assert.equal(payloadEnviado.valor, 'Lista de cotejo');
    assert.equal(payloadEnviado.categoria, 'preferencia');
    assert.equal(payloadEnviado.usuario_id, 'docente_principal');
  });

  it('debe cargar la memoria a corto plazo en formato de mensajes compatibles con Gemini parts', async () => {
    let urlConsultada = '';
    const mockFilas = [
      { rol: 'user', contenido: 'Hola, prepara clase de matemáticas' },
      { rol: 'model', contenido: 'Plan estructurado para 2do grado' }
    ];

    const gestor = new GestorMemoriaHibrida(urlMock, keyMock);
    gestor.fetchFn = async (url) => {
      urlConsultada = url;
      return {
        ok: true,
        json: async () => mockFilas
      };
    };

    const mensajes = await gestor.obtenerMemoriaCortoPlazo('sesion_123', 6);
    assert.ok(urlConsultada.includes('conversaciones_mensajes'));
    assert.ok(urlConsultada.includes('sesion_id=eq.sesion_123'));
    assert.equal(mensajes.length, 2);
    assert.deepEqual(mensajes[0], {
      role: 'user',
      parts: [{ text: 'Hola, prepara clase de matemáticas' }]
    });
    assert.deepEqual(mensajes[1], {
      role: 'model',
      parts: [{ text: 'Plan estructurado para 2do grado' }]
    });
  });

  it('debe inyectar la memoria permanente en el prompt maestro de OrquestadorPedagogico', async () => {
    const gestor = new GestorMemoriaHibrida(urlMock, keyMock);
    gestor.fetchFn = async () => ({
      ok: true,
      json: async () => [
        { categoria: 'perfil', clave: 'nombre_docente', valor: 'Israel Montás' },
        { categoria: 'aula', clave: 'centro_educativo', valor: 'Escuela Primaria Batey Pinos' },
        { categoria: 'aula', clave: 'modalidad', valor: 'Multigrado (1.º y 2.º de Primaria)' }
      ]
    });

    const orquestador = new OrquestadorPedagogico({
      SUPABASE_URL: urlMock,
      SUPABASE_SERVICE_ROLE_KEY: keyMock
    }, { gestorMemoria: gestor });

    const res = await orquestador.prepararContextoCompleto('planifica clase sobre la noticia');

    assert.ok(res.promptMaestro.includes('### MEMORIA PERMANENTE DEL DOCENTE:'));
    assert.ok(res.promptMaestro.includes('Israel Montás'));
    assert.ok(res.promptMaestro.includes('Escuela Primaria Batey Pinos'));
    assert.ok(res.promptMaestro.includes('Multigrado (1.º y 2.º de Primaria)'));
  });

  it('debe extraer hechos en segundo plano desde mensajes de la memoria a corto plazo', async () => {
    const hechosGuardados = [];
    const gestor = new GestorMemoriaHibrida(urlMock, keyMock);
    gestor.aprenderHecho = async (cat, clave, valor, user) => {
      hechosGuardados.push({ cat, clave, valor, user });
      return true;
    };

    // 1. Preferencia
    const extraidos1 = await gestor.extraerYConsolidarHechos('No me gusta usar tablas muy extensas en el Word');
    assert.equal(extraidos1.length, 1);
    assert.equal(extraidos1[0].categoria, 'preferencia');
    assert.equal(extraidos1[0].clave, 'formato_evitado');

    // 2. Aula
    const extraidos2 = await gestor.extraerYConsolidarHechos('Toma en cuenta que mi aula no tiene proyector digital');
    assert.equal(extraidos2.length, 1);
    assert.equal(extraidos2[0].categoria, 'aula');
    assert.ok(extraidos2[0].valor.includes('proyector'));

    // 3. Proyecto
    const extraidos3 = await gestor.extraerYConsolidarHechos('En este mes estamos trabajando el huerto escolar pedagógico');
    assert.equal(extraidos3.length, 1);
    assert.equal(extraidos3[0].categoria, 'proyecto');
    assert.ok(extraidos3[0].valor.includes('huerto escolar'));

    // Confirmar que se consolidaron en disco (Supabase)
    assert.equal(hechosGuardados.length, 3);
  });
});
