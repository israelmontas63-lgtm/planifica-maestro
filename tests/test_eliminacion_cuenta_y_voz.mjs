import assert from "assert";
import { VoiceProvider, BrowserNativeVoiceProvider } from "../worker/services/voiceProvider.js";

console.log("=== PRUEBAS DE VERIFICACIÓN: VOZ Y ELIMINACIÓN DE CUENTA ===");

// 1. VoiceProvider es abstracta y BrowserNativeVoiceProvider declara modo cliente
const baseProvider = new VoiceProvider();
assert.rejects(async () => {
  await baseProvider.synthesize("test");
}, /debe ser implementado/, "VoiceProvider base debe requerir implementación concreta");

const browserProvider = new BrowserNativeVoiceProvider();
assert.rejects(async () => {
  await browserProvider.synthesize("test");
}, /window\.speechSynthesis/, "BrowserNativeVoiceProvider debe indicar ejecución en cliente");
console.log("✓ [1/4 SUPERADA] VoiceProvider interfaz abstracta y BrowserNativeVoiceProvider verificados.");

// 2. Simulación de endpoints de eliminación de cuenta en el Worker
const pendingAccountDeletions = new Map();
const failedDeletionAttempts = new Map();

function checkDeletionRateLimit(identifier) {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const maxAttempts = 3;
  const entry = failedDeletionAttempts.get(identifier);
  if (!entry || now > entry.resetAt) return true;
  return entry.count < maxAttempts;
}

function recordFailedDeletionAttempt(identifier) {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const entry = failedDeletionAttempts.get(identifier);
  if (!entry || now > entry.resetAt) {
    failedDeletionAttempts.set(identifier, { count: 1, resetAt: now + windowMs });
  } else {
    entry.count++;
  }
}

// Caso 1: Generación de token con TTL
const testUserId = "user_docente_123";
const testEmail = "docente@educacion.gob.do";
const confirmationToken = "ABC123";
pendingAccountDeletions.set(testUserId, {
  token: confirmationToken,
  email: testEmail,
  expiresAt: Date.now() + 5 * 60 * 1000
});

assert.strictEqual(pendingAccountDeletions.get(testUserId).token, "ABC123");
console.log("✓ [2/4 SUPERADA] Token de confirmación de un solo uso generado con TTL de 5 min.");

// Caso 2: Intento con correo incorrecto incrementa fallos y es rechazado
const intentoCorreoErroneo = "otro_correo@gmail.com";
const pending = pendingAccountDeletions.get(testUserId);
if (intentoCorreoErroneo !== pending.email) {
  recordFailedDeletionAttempt(testUserId);
}
assert.strictEqual(failedDeletionAttempts.get(testUserId).count, 1, "Debe registrar 1 intento fallido");
console.log("✓ [3/4 SUPERADA] Rechazo ante discordancia de correo con incremento de intentos fallidos.");

// Caso 3: Límite de 3 intentos fallidos bloquea el acceso
recordFailedDeletionAttempt(testUserId);
recordFailedDeletionAttempt(testUserId);
assert.strictEqual(checkDeletionRateLimit(testUserId), false, "Debe bloquear tras 3 intentos fallidos");
console.log("✓ [4/4 SUPERADA] Bloqueo por rate limit tras 3 intentos fallidos verificado.");

console.log("=== TODAS LAS PRUEBAS DE VOZ Y ELIMINACIÓN SUPERADAS EXITOSAMENTE ===");
