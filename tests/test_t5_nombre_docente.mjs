import test from "node:test";
import assert from "node:assert/strict";
import { sanearNombreDocente, generarRespuestaCharlaLocal } from "../shared/modoConversacional.js";

test("T5 - sanearNombreDocente limpia inyecciones, saltos y limita longitud a 50", () => {
  assert.equal(sanearNombreDocente("María González"), "María González");
  assert.equal(sanearNombreDocente("  Juan Pérez  \n\r\t"), "Juan Pérez");
  
  // Inyección de script / html
  const conInyeccion = "Carlos <script>alert('xss')</script>";
  const saneado = sanearNombreDocente(conInyeccion);
  assert.ok(!saneado.includes("<"));
  assert.ok(!saneado.includes(">"));
  assert.ok(!saneado.includes("'"));

  // Longitud <= 50
  const largo = "A".repeat(100);
  assert.ok(sanearNombreDocente(largo).length <= 50);

  // Marcadores genéricos devuelven null
  assert.equal(sanearNombreDocente(""), null);
  assert.equal(sanearNombreDocente(null), null);
  assert.equal(sanearNombreDocente("docente_default"), null);
  assert.equal(sanearNombreDocente("anonimo"), null);
});

test("T5 - Saludo con nombre incluye nombre docente y signos ¡! y ¿? correctos", () => {
  const resp = generarRespuestaCharlaLocal({ texto: "hola", nombreDocente: "Profe Laura" });
  assert.ok(resp.mensaje_chat.includes("Laura"));
  assert.ok(resp.mensaje_chat.startsWith("¡"));
  assert.ok(resp.mensaje_chat.includes("¿"));
  assert.ok(resp.mensaje_chat.includes("?"));
});

test("T5 - Saludo sin nombre no inventa ninguno ni usa marcadores genéricos visibles", () => {
  const resp = generarRespuestaCharlaLocal({ texto: "hola", nombreDocente: null });
  assert.ok(!resp.mensaje_chat.includes("docente_default"));
  assert.ok(!resp.mensaje_chat.includes("colega"));
  assert.ok(!resp.mensaje_chat.includes("Profe"));
  assert.ok(resp.mensaje_chat.startsWith("¡"));
  assert.ok(resp.mensaje_chat.includes("¿") || resp.mensaje_chat.includes("!"));
});
