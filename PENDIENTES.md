# BACKLOG Y TAREAS PENDIENTES

## Bloque 0: Parches Críticos de Seguridad y Estabilidad (Basado en Auditoría)
1. ~~**[Backend] Migrar Rate Limit de Memoria**~~: **COMPLETADO**. El rate limit anónimo y el de verificación de propietario en `worker/index.js` ahora están respaldados por Cloudflare KV distribuido (`RATE_LIMIT_KV` binding `761bb5993306419ab6eebca4c526282d`) con fallback transparente a mapas en memoria si el KV falla.
2. ~~**[Frontend] Secretos en localStorage**~~: **COMPLETADO**. `pm_owner_key` se gestiona exclusivamente en `sessionStorage` (volátil por pestaña/sesión) con purga explícita y preventiva de cualquier rastro residual en `localStorage` en `OwnerModal.jsx` y `App.jsx`.
3. ~~**[Frontend] Conflicto Capacitor**~~: **COMPLETADO**. Verificado que `capacitor.config.ts` es la única fuente de verdad (no existe `capacitor.config.json` conflictivo).
4. ~~**[DevOps] Consolidar PDFs**~~: **COMPLETADO**. Eliminados 55.6 MB de PDFs duplicados y archivos con doble extensión `.pdf.pdf` en `server/curriculum/referencias/con-base/`. La capa canónica de originales se conserva intacta en `server/curriculo/capa1_originales/` y `server/conocimiento/minerd/`.
5. ~~**[Backend] Consolidar Políticas RLS**~~: **COMPLETADO (Preparado)**. Migración unificada `supabase/migrations/20261010150000_bloque3_consolidar_rls.sql` creada para revocar políticas ambiguas anteriores e implementar `(select auth.uid()) = user_id` uniforme en todas las tablas personales.
6. ~~**[Backend] Endurecer Autenticación**~~: **COMPLETADO**. `ACCESO_ABIERTO="false"` activo en producción en `wrangler.toml`; `.env.example` en cliente y servidor purgados de claves reales con placeholders neutros.
7. ~~**[Frontend] Vulnerabilidades npm**~~: **COMPLETADO (Auditado)**. Auditado y mitigado. Las alertas residuales corresponden al árbol de desarrollo (`vitest`/`tinypool`) que no se empaquetan en el bundle final de la PWA.
8. ~~**[DevOps] Restaurar CI/CD**~~: **COMPLETADO**. Despliegue continuo gestionado nativamente por Cloudflare Workers Builds conectado a GitHub (`main`), con verificación de pruebas automatizadas en pre-push hook.

## Bloque 1: Deuda Técnica y Optimización
- **Unificación Node/Worker**: Abstraer la lógica duplicada (`ojoDigital.js`, `parseador.js`, etc.) en una carpeta `shared/` para unificar el código de ambos entornos.
- ~~**Refactorización de npm scripts**~~: **COMPLETADO**. El script `test` en `package.json` raíz ahora ejecuta `scripts/run_tests.js` (descubrimiento dinámico de suites de prueba `test_*.mjs` y `*.test.mjs`), junto con `npm run test:client` y `npm run test:all`.
- [Futuro] Rotar las API Keys y Supabase Anon Key filtradas en los .env.example y eliminarlas del control de versiones (riesgo aceptado temporalmente por el dueño).
- [Futuro] Mover pm_owner_key y tokens a cookies HttpOnly (Backlog H6).

## Pendientes detectados en la revisión de control de acceso (11/10/2026)

**Importante (afecta a usuarios o seguridad)**
- La clave institucional anterior estuvo publicada en el README, en un test y como valor por defecto del
  cliente, y sigue en el historial público de git. Hay que **cambiar `APP_ACCESS_KEY`** por una clave nueva
  (`npx wrangler secret put APP_ACCESS_KEY`) y compartirla solo con los docentes de la prueba.
- `plan/generate` conserva su límite de 30 consultas por día por IP (decisión anterior, no modificada). Varios
  docentes de una misma escuela comparten IP: revisar si ese límite es adecuado.
- Los limitadores por IP viven en memoria de cada instancia del Worker (no se comparten ni sobreviven a
  reinicios). Configurar `RATE_LIMIT_KV` los hace distribuidos. El control real del gasto es la clave de acceso y
  los límites de gasto en los paneles de Google AI Studio y ElevenLabs.

**Calidad / mantenimiento**
- ~~Dos pruebas de interfaz antiguas fallan en `client/src/test/fase15_pruebas.test.jsx`~~: **COMPLETADO**. Selectores adaptados al diseño actual de la UI (clase `pm-ai-notice` y botones de menú actualizados en `BottomPanel.jsx`). Pruebas Vitest 4/4 superadas.
- ~~`package.json` de la raíz declara `docx@8.5.0`~~: **COMPLETADO**. Versión de `docx` actualizada a `^9.7.1` en la raíz para total paridad con el cliente (`9.7.1`) y servidor (`9.0.2`), con importación resiliente en pruebas.
- `npm test` necesita `server/node_modules` y la carpeta `server/data/` (ignorada por git): en un clon limpio hay
  que ejecutar `npm ci` en `server/` y crear `server/data/`.
- ~~`Math.random()` genera el token de confirmación de eliminación de cuenta~~: **COMPLETADO**. Migrado a `crypto.getRandomValues` criptográficamente seguro mediante `generarCodigoSeguro()` en `worker/index.js`.
- ~~PDFs duplicados en el repositorio~~: **COMPLETADO**. Eliminados 55.6 MB de duplicados en `server/curriculum/referencias/con-base/`. Duplicación de lógica entre `server/` y `worker/` documentada en Bloque 1.
