import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DispositivoHubDO } from "../worker/durable/DispositivoHubDO.js";
import { ZONA_HORARIA_DEFAULT, santoDomingoAUtcIso, crearGestorTareasProactivas } from "../worker/services/planificadorProactivo.js";
import { ejecutarAccionLocalWindows } from "../scripts/agente_local_windows.mjs";
import { CerebroMultimodal, clasificarEvidenciaVisual } from "../worker/services/cerebroMultimodal.js";

async function firmarToken(secreto, usuarioId, dispositivoId, expMs) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secreto), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(`${usuarioId}:${dispositivoId}:${expMs}`));
  const hex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${expMs}.${hex}`;
}

function crearMockWebSocket() {
  const enviados = [];
  let attachment = null;
  let cerrado = null;
  return {
    enviados,
    get cerrado() { return cerrado; },
    send(msg) { enviados.push(JSON.parse(msg)); },
    close(code, reason) { cerrado = { code, reason }; },
    serializeAttachment(obj) { attachment = obj; },
    deserializeAttachment() { return attachment; }
  };
}

function crearMockState() {
  const kv = new Map();
  const sockets = [];
  return {
    storage: {
      async get(k) { return kv.get(k); },
      async put(k, v) { kv.set(k, v); }
    },
    acceptWebSocket(ws, tags) {
      ws._tags = tags;
      sockets.push(ws);
    },
    getWebSockets(tag) {
      if (!tag) return sockets.filter((s) => !s.cerrado);
      return sockets.filter((s) => !s.cerrado && s._tags?.includes(tag));
    }
  };
}

async function testDispositivoHubDO() {
  globalThis.WebSocketPair = class {
    constructor() {
      this[0] = crearMockWebSocket();
      this[1] = crearMockWebSocket();
    }
  };
  const OrigResponse = globalThis.Response;
  globalThis.Response = class extends OrigResponse {
    constructor(body, init) {
      if (init && init.status === 101 && init.webSocket) {
        super(null, { status: 200 });
        this.status101 = true;
        this.webSocket = init.webSocket;
      } else {
        super(body, init);
      }
    }
  };

  try {
    const secreto = "clave_secreta_test_hub_123";
    const state = crearMockState();
    const hub = new DispositivoHubDO(state, { APP_ACCESS_KEY: secreto });

    // 1. Token inválido => 401
    const resBad = await hub.fetch(new Request("https://hub.local/ws?usuarioId=u1&dispositivoId=win1&plataforma=windows&token=invalido", {
      headers: { Upgrade: "websocket" }
    }));
    assert.equal(resBad.status, 401);

    // 2. Token válido => conecta win1 (u1), pwa1 (u1) y otro (u2)
    const exp = Date.now() + 60000;
    const tokWin = await firmarToken(secreto, "u1", "win1", exp);
    const tokPwa = await firmarToken(secreto, "u1", "pwa1", exp);
    const tokU2 = await firmarToken(secreto, "u2", "win2", exp);

    await hub.fetch(new Request(`https://hub.local/ws?usuarioId=u1&dispositivoId=win1&plataforma=windows&token=${tokWin}`, { headers: { Upgrade: "websocket" } }));
    await hub.fetch(new Request(`https://hub.local/ws?usuarioId=u1&dispositivoId=pwa1&plataforma=web&token=${tokPwa}`, { headers: { Upgrade: "websocket" } }));
    await hub.fetch(new Request(`https://hub.local/ws?usuarioId=u2&dispositivoId=win2&plataforma=windows&token=${tokU2}`, { headers: { Upgrade: "websocket" } }));

    const [wsWin, wsPwa, wsU2] = state.getWebSockets();
    assert.ok(wsWin && wsPwa && wsU2);

    // 3. Aislamiento por usuarioId: u1 no puede enviar a win2 (u2)
    await hub.webSocketMessage(wsPwa, JSON.stringify({
      messageId: "m1",
      destinoDispositivoId: "win2",
      accion: "estado_dispositivo"
    }));
    assert.equal(wsU2.enviados.length, 0);
    assert.equal(wsPwa.enviados.at(-1).error, "DESTINO_NO_ENCONTRADO_O_SIN_AUTORIZACION" && "DESTINO_NO_AUTORIZADO");

    // 4. Permiso por defecto es false
    await hub.webSocketMessage(wsPwa, JSON.stringify({
      messageId: "m2",
      destinoDispositivoId: "win1",
      permisoRequerido: "archivos",
      accion: "crear_documento_autorizado"
    }));
    assert.equal(wsWin.enviados.length, 0);
    assert.equal(wsPwa.enviados.at(-1).error, "PERMISO_DENEGADO:archivos");

    // 5. Habilitar permiso 'archivos' y enviar comando
    await hub.fetch(new Request("https://hub.local/permisos", {
      method: "POST",
      body: JSON.stringify({ usuarioId: "u1", dispositivoId: "win1", permisos: { archivos: true } })
    }));
    await hub.webSocketMessage(wsPwa, JSON.stringify({
      messageId: "m3",
      destinoDispositivoId: "win1",
      permisoRequerido: "archivos",
      accion: "crear_documento_autorizado"
    }));
    assert.equal(wsWin.enviados.length, 1);
    assert.equal(wsWin.enviados[0].messageId, "m3");

    // 6. Replay rechazado
    await hub.webSocketMessage(wsPwa, JSON.stringify({
      messageId: "m3",
      destinoDispositivoId: "win1",
      permisoRequerido: "archivos",
      accion: "crear_documento_autorizado"
    }));
    assert.equal(wsPwa.enviados.at(-1).error, "MENSAJE_DUPLICADO_O_SIN_ID");

    // 7. Revocación cierra socket con 4003 y bloquea reconexión (403)
    await hub.fetch(new Request("https://hub.local/revocar", {
      method: "POST",
      body: JSON.stringify({ usuarioId: "u1", dispositivoId: "win1" })
    }));
    assert.equal(wsWin.cerrado?.code, 4003);
    const resReconn = await hub.fetch(new Request(`https://hub.local/ws?usuarioId=u1&dispositivoId=win1&plataforma=windows&token=${tokWin}`, {
      headers: { Upgrade: "websocket" }
    }));
    assert.equal(resReconn.status, 403);
  } finally {
    globalThis.Response = OrigResponse;
  }
}

async function testPlanificadorProactivo() {
  assert.equal(ZONA_HORARIA_DEFAULT, "America/Santo_Domingo");
  assert.equal(santoDomingoAUtcIso("2026-11-12T08:00:00"), "2026-11-12T12:00:00.000Z");

  const gestor = crearGestorTareasProactivas();
  const sinAuth = gestor.programarTarea({
    propietario: "docente_1",
    descripcion: "Resumen semanal",
    frecuencia: "semanal",
    autorizadaPorPropietario: false
  });
  assert.equal(sinAuth.ok, false);
  assert.equal(sinAuth.codigo, "REQUIERE_AUTORIZACION_PROPIETARIO");

  const prog = gestor.programarTarea({
    id: "t_1",
    propietario: "docente_1",
    descripcion: "Recordatorio planificación",
    frecuencia: "diaria",
    proximaEjecucionLocal: "2026-11-12T08:00:00",
    autorizadaPorPropietario: true
  });
  assert.equal(prog.ok, true);
  assert.equal(prog.tarea.proximaEjecucionUtc, "2026-11-12T12:00:00.000Z");

  let conteo = 0;
  const r1 = await gestor.ejecutarSiCorresponde("t_1", "run_2026_11_12", async () => {
    conteo += 1;
    return { ok: true, resumen: "Enviado" };
  });
  const r2 = await gestor.ejecutarSiCorresponde("t_1", "run_2026_11_12", async () => {
    conteo += 1;
    return { ok: true };
  });
  assert.equal(r1.ok, true);
  assert.equal(r1.duplicada, false);
  assert.equal(r2.duplicada, true);
  assert.equal(conteo, 1);

  const canc = gestor.cancelarTarea("t_1", "docente_1");
  assert.equal(canc.ok, true);
  const r3 = await gestor.ejecutarSiCorresponde("t_1", "run_2026_11_13", async () => ({ ok: true }));
  assert.equal(r3.ok, false);
  assert.equal(r3.codigo, "TAREA_CANCELADA");
}

async function testAgenteLocalWindows() {
  const est = await ejecutarAccionLocalWindows({ accion: "estado_dispositivo" });
  assert.equal(est.ok, true);
  assert.ok(est.datos.plataforma);

  const bloqShell = await ejecutarAccionLocalWindows({ accion: "powershell", autorizadoPorUsuario: true });
  assert.equal(bloqShell.ok, false);
  assert.equal(bloqShell.bloqueado, true);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pm-win-test-"));
  try {
    const sinAuth = await ejecutarAccionLocalWindows({
      accion: "crear_documento_autorizado",
      parametros: { nombreArchivo: "plan.md", contenido: "# Plan" },
      autorizadoPorUsuario: false
    }, { directorioBase: tmpDir });
    assert.equal(sinAuth.ok, false);
    assert.equal(sinAuth.requiereAutorizacion, true);

    await assert.rejects(() => ejecutarAccionLocalWindows({
      accion: "crear_documento_autorizado",
      parametros: { nombreArchivo: "../escape.txt", contenido: "x" },
      autorizadoPorUsuario: true
    }, { directorioBase: tmpDir }));

    const okDoc = await ejecutarAccionLocalWindows({
      accion: "crear_documento_autorizado",
      parametros: { nombreArchivo: "plan_clase.md", contenido: "Unidad 1" },
      autorizadoPorUsuario: true
    }, { directorioBase: tmpDir });
    assert.equal(okDoc.ok, true);
    assert.equal(okDoc.datos.verificado, true);
    assert.equal(fs.readFileSync(okDoc.datos.ruta, "utf8"), "Unidad 1");
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

async function testMultimodalEvidencia() {
  const cerebro = new CerebroMultimodal({ GEMINI_API_KEY: "dummy" });
  const resVacio = await cerebro.procesarMensaje({ mensaje: "Lee esto", imagenBase64: "abc" });
  assert.equal(resVacio.ok, false);
  assert.ok(resVacio.evidenciaVisual.desconocido);

  const ev = clasificarEvidenciaVisual("- Observado: Botón azul arriba.\n- Transcrito: \"Guardar plan\"\n- Inferido: Guarda el borrador.\n- Desconocido: El pie de página está cortado.");
  assert.equal(ev.observado, "Botón azul arriba.");
  assert.equal(ev.transcrito, "\"Guardar plan\"");
  assert.equal(ev.inferido, "Guarda el borrador.");
  assert.equal(ev.desconocido, "El pie de página está cortado.");
}

await testDispositivoHubDO();
await testPlanificadorProactivo();
await testAgenteLocalWindows();
await testMultimodalEvidencia();
console.log("PASS: test_hub_multidispositivo_y_proactivo (4/4)");
