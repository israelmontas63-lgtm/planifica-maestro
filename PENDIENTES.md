# BACKLOG Y TAREAS PENDIENTES

## Bloque 0: Parches Críticos de Seguridad y Estabilidad (Basado en Auditoría)
1. ~~**[Backend] Migrar Rate Limit de Memoria**~~: **COMPLETADO**. El rate limit anónimo y el de verificación de propietario en `worker/index.js` ahora están respaldados por Cloudflare KV distribuido (`RATE_LIMIT_KV` binding `761bb5993306419ab6eebca4c526282d`) con fallback transparente a mapas en memoria si el KV falla.
2. ~~**[Frontend] Secretos en localStorage**~~: **COMPLETADO**. `pm_owner_key` se gestiona exclusivamente en `sessionStorage` (volátil por pestaña/sesión) con purga explícita y preventiva de cualquier rastro residual en `localStorage` en `OwnerModal.jsx` y `App.jsx`.
3. ~~**[Frontend] Conflicto Capacitor**~~: **COMPLETADO**. Verificado que `capacitor.config.ts` es la única fuente de verdad (no existe `capacitor.config.json` conflictivo).
4. ~~**[DevOps] Consolidar PDFs**~~: **COMPLETADO**. Eliminados 55.6 MB de PDFs duplicados y archivos con doble extensión `.pdf.pdf` en `server/curriculum/referencias/con-base/`. La capa canónica de originales se conserva intacta en `server/curriculo/capa1_originales/` y `server/conocimiento/minerd/`.
5. **[Backend] Consolidar Políticas RLS**: Corregir políticas contradictorias en `supabase/migrations/` (ej. `Perfil docente` tiene `FOR ALL TO authenticated` vs `FOR ALL` exclusivo del propietario).
6. **[Backend] Endurecer Autenticación**: Revisar `ACCESO_ABIERTO=true` y `REQUIRE_ACCESS_KEY=false` para no bypassar protección en producción. Rotar o purgar claves hardcodeadas en `.env.example`.
7. **[Frontend] Vulnerabilidades npm**: Resolver `tinypool` (RCE) y `proxy-addr` (XSS) ejecutando `npm audit fix --force` o actualizando `vite`.
8. **[DevOps] Restaurar CI/CD**: Renombrar/mover `deploy.yml.guardado` a `.github/workflows/deploy.yml` si procede, y habilitarlo.

## Bloque 1: Deuda Técnica y Optimización
- **Unificación Node/Worker**: Abstraer la lógica duplicada (`ojoDigital.js`, `parseador.js`, etc.) en una carpeta `shared/` para unificar el código de ambos entornos.
- **Refactorización de npm scripts**: Mejorar el script `test` en el `package.json` raíz utilizando wildcards en lugar de enumerar todos los archivos estáticos.
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
- Dos pruebas de interfaz antiguas fallan en `client/src/test/fase15_pruebas.test.jsx` (ya fallaban antes de este
  cambio): prueban una interfaz que cambió.
- `package.json` de la raíz declara `docx@8.5.0` (añadido como "arreglo"), pero el cliente y el servidor usan
  `docx@9.7.1`. Las pruebas del directorio `tests/` y la aplicación pueden usar versiones distintas de `docx`.
- `npm test` necesita `server/node_modules` y la carpeta `server/data/` (ignorada por git): en un clon limpio hay
  que ejecutar `npm ci` en `server/` y crear `server/data/`.
- `Math.random()` genera el token de confirmación de eliminación de cuenta; usar `crypto.getRandomValues`
  (la ruta hoy está inactiva porque Supabase no está configurado).
- Duplicación de lógica entre `server/` y `worker/`; PDFs duplicados en el repositorio.
