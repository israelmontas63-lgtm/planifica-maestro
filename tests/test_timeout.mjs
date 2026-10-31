import test from "node:test"; import assert from "node:assert/strict"; import http from "node:http";
import { fetchConLimite, esTimeoutIntento } from "../worker/services/timeoutIntento.js";
let srv, base;
test.before(async () => { srv = http.createServer((q, s) => { if (q.url === "/rapido") { s.end("ok"); } /* /colgado: nunca responde */ }); await new Promise(r => srv.listen(0, r)); base = "http://127.0.0.1:" + srv.address().port; });
test.after(() => { srv.closeAllConnections?.(); srv.close(); });
test("respuesta rápida pasa", async () => { const r = await fetchConLimite(base + "/rapido", {}, 500); assert.equal(await r.text(), "ok"); });
test("servidor colgado se corta al límite (no espera)", async () => { const t0 = Date.now(); await assert.rejects(fetchConLimite(base + "/colgado", {}, 300), e => esTimeoutIntento(e)); assert.ok(Date.now() - t0 < 1500); });
test("si el cliente cancela, se cancela y NO se marca como timeout", async () => { const c = new AbortController(); setTimeout(() => c.abort(new Error("CLIENTE")), 100); await assert.rejects(fetchConLimite(base + "/colgado", { signal: c.signal }, 5000), e => !esTimeoutIntento(e)); });
test("señal ya cancelada falla de inmediato", async () => { const c = new AbortController(); c.abort(new Error("CLIENTE")); await assert.rejects(fetchConLimite(base + "/rapido", { signal: c.signal }, 5000)); });
