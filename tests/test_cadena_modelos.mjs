import test from "node:test"; import assert from "node:assert/strict";
import { getGeminiModels } from "../worker/services/aiProvider.js";
test("la cadena de modelos no incluye gemini-flash-latest", () => { for (const env of [{}, { GEMINI_MODEL: "gemini-3.1-flash-lite" }, { GEMINI_MODEL: "gemini-3.5-flash" }]) { const m = getGeminiModels(env); assert.ok(!m.includes("gemini-flash-latest"), JSON.stringify(m)); assert.ok(m.length >= 2, JSON.stringify(m)); } });
test("el modelo preferido va primero y no se duplica", () => { const m = getGeminiModels({ GEMINI_MODEL: "gemini-3.1-flash-lite" }, "gemini-3.5-flash-lite"); assert.equal(m[0], "gemini-3.5-flash-lite"); assert.equal(new Set(m).size, m.length); });
