import test from 'node:test';
import assert from 'node:assert/strict';

// Handler lógico idéntico a FIX 2 corregido
async function handlerIndexarEmbeddings(request, env, indexarFn) {
  const corsHeaders = { 'Access-Control-Allow-Origin': '*' };
  const ownerKey = request.headers.get('x-owner-key');
  const esDueno = Boolean(
    env.OWNER_MASTER_KEY &&
    ownerKey &&
    ownerKey.trim() === env.OWNER_MASTER_KEY.trim()
  );

  if (!esDueno) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const r = await indexarFn(env, { limite: 40 });
    return new Response(JSON.stringify(r), {
      status: r.ok ? 200 : 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({
      ok: false,
      motivo: 'ERROR_INTERNO',
      detalle: String((e && e.message) || e).slice(0, 200)
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

test('FIX 2: Petición sin x-owner-key retorna 401 sin invocar indexación', async () => {
  let invocado = false;
  const env = { OWNER_MASTER_KEY: 'secreto-dueno-123' };
  const req = new Request('https://api/owner/indexar-embeddings', {
    method: 'POST',
    headers: {}
  });

  const res = await handlerIndexarEmbeddings(req, env, async () => {
    invocado = true;
    return { ok: true };
  });

  assert.equal(res.status, 401);
  assert.equal(invocado, false, 'No debió llamar a indexarEmbeddingsLote');
  const body = await res.json();
  assert.equal(body.error, 'No autorizado');
});

test('FIX 2: Petición con x-owner-key inválida retorna 401', async () => {
  let invocado = false;
  const env = { OWNER_MASTER_KEY: 'secreto-dueno-123' };
  const req = new Request('https://api/owner/indexar-embeddings', {
    method: 'POST',
    headers: { 'x-owner-key': 'clave-falsa' }
  });

  const res = await handlerIndexarEmbeddings(req, env, async () => {
    invocado = true;
    return { ok: true };
  });

  assert.equal(res.status, 401);
  assert.equal(invocado, false);
});

test('FIX 2: Petición con llave correcta y fallo de red en Supabase retorna 500 con JSON', async () => {
  const env = { OWNER_MASTER_KEY: 'secreto-dueno-123' };
  const req = new Request('https://api/owner/indexar-embeddings', {
    method: 'POST',
    headers: { 'x-owner-key': 'secreto-dueno-123' }
  });

  const res = await handlerIndexarEmbeddings(req, env, async () => {
    throw new Error('Fallo de red al conectar con Supabase pgvector');
  });

  assert.equal(res.status, 500);
  const body = await res.json();
  assert.equal(body.ok, false);
  assert.equal(body.motivo, 'ERROR_INTERNO');
  assert.match(body.detalle, /Fallo de red/);
});

test('FIX 2: Petición con llave correcta y éxito retorna 200 con estadísticas', async () => {
  const env = { OWNER_MASTER_KEY: 'secreto-dueno-123' };
  const req = new Request('https://api/owner/indexar-embeddings', {
    method: 'POST',
    headers: { 'x-owner-key': 'secreto-dueno-123' }
  });

  const res = await handlerIndexarEmbeddings(req, env, async () => {
    return { ok: true, indexadas: 40, pendientes: 116 };
  });

  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.indexadas, 40);
});
