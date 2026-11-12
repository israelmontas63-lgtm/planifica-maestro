// worker/durable/DispositivoHubDO.js
// Durable Object con WebSocket Hibernation API para comunicación bidireccional segura
// entre PWA/Navegador y agentes autorizados (Windows, Android).
// Requiere binding [[durable_objects.bindings]] en wrangler.toml para despliegue en Cloudflare.

export class DispositivoHubDO {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.mensajesRecientes = new Set(); // Protección contra replay por messageId
    this.registroEventos = [];
  }

  async _cargarRegistro() {
    const dispositivos = (await this.state.storage.get("dispositivos")) || {};
    return dispositivos;
  }

  async _guardarRegistro(dispositivos) {
    await this.state.storage.put("dispositivos", dispositivos);
  }

  _registrarEvento(evento) {
    this.registroEventos.push({
      timestamp: new Date().toISOString(),
      ...evento,
    });
    if (this.registroEventos.length > 200) {
      this.registroEventos.shift();
    }
  }

  async _verificarTokenDispositivo(token, dispositivoId, usuarioId) {
    if (!token || typeof token !== "string") return false;
    const secreto = this.env?.APP_ACCESS_KEY || this.env?.OWNER_MASTER_KEY;
    if (!secreto) return false;
    // Formato esperado: expMs.firmaHex
    const partes = token.split(".");
    if (partes.length !== 2) return false;
    const expMs = Number(partes[0]);
    if (!Number.isFinite(expMs) || Date.now() > expMs) return false;

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secreto),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sigBuf = await crypto.subtle.sign("HMAC", key, encoder.encode(`${usuarioId}:${dispositivoId}:${expMs}`));
    const expectedHex = Array.from(new Uint8Array(sigBuf)).map((b) => b.toString(16).padStart(2, "0")).join("");
    return expectedHex === partes[1];
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (request.headers.get("Upgrade") === "websocket") {
      const usuarioId = url.searchParams.get("usuarioId") || "";
      const dispositivoId = url.searchParams.get("dispositivoId") || "";
      const plataforma = url.searchParams.get("plataforma") || "web";
      const token = request.headers.get("x-device-token") || url.searchParams.get("token") || "";

      if (!usuarioId || !dispositivoId) {
        return new Response("Faltan usuarioId o dispositivoId", { status: 400 });
      }

      const dispositivos = await this._cargarRegistro();
      const existente = dispositivos[dispositivoId];
      if (existente?.revocado) {
        return new Response("Dispositivo revocado", { status: 403 });
      }

      const tokenValido = await this._verificarTokenDispositivo(token, dispositivoId, usuarioId);
      if (!tokenValido) {
        return new Response("Token de dispositivo inválido o expirado", { status: 401 });
      }

      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      // Hibernation API con etiquetas de usuario y dispositivo
      this.state.acceptWebSocket(server, [`user:${usuarioId}`, `dev:${dispositivoId}`]);
      server.serializeAttachment({ usuarioId, dispositivoId, plataforma });

      dispositivos[dispositivoId] = {
        usuarioId,
        dispositivoId,
        plataforma,
        revocado: false,
        permisos: existente?.permisos || {
          camara: false,
          microfono: false,
          archivos: false,
          acciones_sistema: false,
        },
        conectadoEn: new Date().toISOString(),
      };
      await this._guardarRegistro(dispositivos);
      this._registrarEvento({ tipo: "CONEXION", usuarioId, dispositivoId, plataforma });

      return new Response(null, { status: 101, webSocket: client });
    }

    if (url.pathname.endsWith("/revocar") && request.method === "POST") {
      const { usuarioId, dispositivoId } = await request.json();
      const dispositivos = await this._cargarRegistro();
      if (!dispositivos[dispositivoId] || dispositivos[dispositivoId].usuarioId !== usuarioId) {
        return new Response(JSON.stringify({ ok: false, error: "Dispositivo no encontrado" }), { status: 404 });
      }
      dispositivos[dispositivoId].revocado = true;
      await this._guardarRegistro(dispositivos);

      for (const ws of this.state.getWebSockets(`dev:${dispositivoId}`)) {
        ws.close(4003, "Dispositivo revocado por el propietario");
      }
      this._registrarEvento({ tipo: "REVOCACION", usuarioId, dispositivoId });
      return new Response(JSON.stringify({ ok: true, revocado: dispositivoId }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.pathname.endsWith("/permisos") && request.method === "POST") {
      const { usuarioId, dispositivoId, permisos } = await request.json();
      const dispositivos = await this._cargarRegistro();
      if (!dispositivos[dispositivoId] || dispositivos[dispositivoId].usuarioId !== usuarioId) {
        return new Response(JSON.stringify({ ok: false, error: "Dispositivo no encontrado" }), { status: 404 });
      }
      dispositivos[dispositivoId].permisos = {
        camara: Boolean(permisos?.camara),
        microfono: Boolean(permisos?.microfono),
        archivos: Boolean(permisos?.archivos),
        acciones_sistema: Boolean(permisos?.acciones_sistema),
      };
      await this._guardarRegistro(dispositivos);
      this._registrarEvento({ tipo: "PERMISOS_ACTUALIZADOS", usuarioId, dispositivoId });
      return new Response(JSON.stringify({ ok: true, permisos: dispositivos[dispositivoId].permisos }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, eventos: this.registroEventos.slice(-20) }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  async webSocketMessage(ws, rawMessage) {
    const meta = ws.deserializeAttachment() || {};
    let msg;
    try {
      msg = JSON.parse(typeof rawMessage === "string" ? rawMessage : new TextDecoder().decode(rawMessage));
    } catch {
      ws.send(JSON.stringify({ ok: false, error: "JSON_INVALIDO" }));
      return;
    }

    // Protección contra repetición de mensajes (Replay Attack)
    if (!msg.messageId || this.mensajesRecientes.has(msg.messageId)) {
      ws.send(JSON.stringify({ ok: false, error: "MENSAJE_DUPLICADO_O_SIN_ID" }));
      return;
    }
    this.mensajesRecientes.add(msg.messageId);
    if (this.mensajesRecientes.size > 500) {
      const primero = this.mensajesRecientes.values().next().value;
      this.mensajesRecientes.delete(primero);
    }

    const dispositivos = await this._cargarRegistro();
    const destino = msg.destinoDispositivoId ? dispositivos[msg.destinoDispositivoId] : null;

    // Aislamiento estricto: nunca enrutar a dispositivos de otro usuario
    if (msg.destinoDispositivoId) {
      if (!destino || destino.usuarioId !== meta.usuarioId || destino.revocado) {
        ws.send(JSON.stringify({ ok: false, error: "DESTINO_NO_AUTORIZADO" }));
        return;
      }

      if (msg.permisoRequerido && !destino.permisos?.[msg.permisoRequerido]) {
        ws.send(JSON.stringify({ ok: false, error: `PERMISO_DENEGADO:${msg.permisoRequerido}` }));
        return;
      }

      for (const targetWs of this.state.getWebSockets(`dev:${msg.destinoDispositivoId}`)) {
        targetWs.send(JSON.stringify({
          ...msg,
          origenDispositivoId: meta.dispositivoId,
          usuarioId: meta.usuarioId,
        }));
      }
      this._registrarEvento({
        tipo: "MENSAJE_ENRUTADO",
        usuarioId: meta.usuarioId,
        origen: meta.dispositivoId,
        destino: msg.destinoDispositivoId,
      });
    } else {
      ws.send(JSON.stringify({ ok: true, ack: msg.messageId }));
    }
  }

  async webSocketClose(ws, code, reason) {
    const meta = ws.deserializeAttachment() || {};
    this._registrarEvento({
      tipo: "DESCONEXION",
      usuarioId: meta.usuarioId,
      dispositivoId: meta.dispositivoId,
      code,
      reason: String(reason || ""),
    });
  }

  async webSocketError(ws, error) {
    const meta = ws.deserializeAttachment() || {};
    this._registrarEvento({
      tipo: "ERROR_WS",
      usuarioId: meta.usuarioId,
      dispositivoId: meta.dispositivoId,
      error: String(error?.message || error).slice(0, 120),
    });
  }
}
