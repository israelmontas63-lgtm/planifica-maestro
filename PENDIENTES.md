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
- ~~**Unificación Node/Worker**~~: **COMPLETADO**. Creados módulos canónicos en `shared/` (`parseadorJsonSeguro.js`, `constantsOjoDigital.js`, `clasificadorIntencion.js`, `correctorTexto.js`, `modoConversacional.js`) con fachadas transparentes hacia `shared/` en `worker/`, `server/` y `client/`. Paridad total del 100% conservada sin breaking changes.
- ~~**Refactorización de npm scripts**~~: **COMPLETADO**. El script `test` en `package.json` raíz ahora ejecuta `scripts/run_tests.js` (descubrimiento dinámico de suites de prueba `test_*.mjs` y `*.test.mjs`), junto con `npm run test:client` y `npm run test:all`.
- [Futuro] Rotar las API Keys y Supabase Anon Key filtradas en los .env.example y eliminarlas del control de versiones (riesgo aceptado temporalmente por el dueño).
- [Futuro] Mover pm_owner_key y tokens a cookies HttpOnly (Backlog H6).

## Pendientes detectados en la revisión de control de acceso (11/10/2026)

**Importante (afecta a usuarios o seguridad)**
- La clave institucional anterior estuvo publicada en el README, en un test y como valor por defecto del
  cliente, y sigue en el historial público de git. Hay que **cambiar `APP_ACCESS_KEY`** por una clave nueva
  (`npx wrangler secret put APP_ACCESS_KEY`) y compartirla solo con los docentes de la prueba.
- ~~**Límite diario por IP en escuelas**~~: **COMPLETADO**. Parametrizado mediante variable `RATE_LIMIT_ANONIMO_DIARIO` en `worker/index.js` y `wrangler.toml` (elevado a 50 consultas/día por defecto con ajuste dinámico), previniendo saturación accidental entre docentes en la misma red escolar.
- ~~**Distribución de Rate Limit en KV**~~: **COMPLETADO**. El namespace `RATE_LIMIT_KV` (`id: 761bb5993306419ab6eebca4c526282d`) está vinculado y activo en `wrangler.toml` y en producción Cloudflare, permitiendo persistencia compartida entre instancias sin depender de memoria efímera.

**Calidad / mantenimiento**
- ~~Dos pruebas de interfaz antiguas fallan en `client/src/test/fase15_pruebas.test.jsx`~~: **COMPLETADO**. Selectores adaptados al diseño actual de la UI (clase `pm-ai-notice` y botones de menú actualizados en `BottomPanel.jsx`). Pruebas Vitest 4/4 superadas.
- ~~`package.json` de la raíz declara `docx@8.5.0`~~: **COMPLETADO**. Versión de `docx` actualizada a `^9.7.1` en la raíz para total paridad con el cliente (`9.7.1`) y servidor (`9.0.2`), con importación resiliente en pruebas.
- ~~**Clon limpio y dependencias de servidor/datos**~~: **COMPLETADO**. `server/data/.gitkeep` añadido y `.gitignore` ajustado para preservar el directorio; `server` agregado a `workspaces` de `package.json` y auto-creación/auto-instalación garantizada en `scripts/run_tests.js` y `tests/setup_test_env.mjs`.

- ~~`Math.random()` genera el token de confirmación de eliminación de cuenta~~: **COMPLETADO**. Migrado a `crypto.getRandomValues` criptográficamente seguro mediante `generarCodigoSeguro()` en `worker/index.js`.
- ~~PDFs duplicados en el repositorio~~: **COMPLETADO**. Eliminados 55.6 MB de duplicados en `server/curriculum/referencias/con-base/`. Duplicación de lógica entre `server/` y `worker/` documentada en Bloque 1.
