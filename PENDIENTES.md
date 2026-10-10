# BACKLOG Y TAREAS PENDIENTES

## Bloque 0: Parches Críticos de Seguridad y Estabilidad (Basado en Auditoría)
1. **[Backend] Migrar Rate Limit de Memoria**: El rate limit en `worker/index.js` usa mapas en memoria que no se comparten entre isolates de Cloudflare. Requiere migrar a Cloudflare KV o Supabase.
2. **[Backend] Consolidar Políticas RLS**: Corregir políticas contradictorias en `supabase/migrations/` (ej. `Perfil docente` tiene `FOR ALL TO authenticated` vs `FOR ALL` exclusivo del propietario).
3. **[Backend] Endurecer Autenticación**: Revisar `ACCESO_ABIERTO=true` y `REQUIRE_ACCESS_KEY=false` para no bypassar protección en producción. Rotar o purgar claves hardcodeadas en `.env.example`.
4. **[Frontend] Vulnerabilidades npm**: Resolver `tinypool` (RCE) y `proxy-addr` (XSS) ejecutando `npm audit fix --force` o actualizando `vite`.
5. **[Frontend] Secretos en localStorage**: Mover almacenamiento de `pm_owner_key` fuera del `localStorage` en `OwnerModal.jsx` (riesgo XSS).
6. **[Frontend] Conflicto Capacitor**: Eliminar `capacitor.config.json` para dejar como fuente única a `capacitor.config.ts`.
7. **[DevOps] Restaurar CI/CD**: Renombrar/mover `deploy.yml.guardado` a `.github/workflows/deploy.yml` si procede, y habilitarlo.
8. **[DevOps] Consolidar PDFs**: Eliminar PDFs duplicados y archivos `.pdf.pdf` en `server/conocimiento/`, `server/curriculo/` y `server/curriculum/referencias/` para reducir bloat.

## Bloque 1: Deuda Técnica y Optimización
- **Unificación Node/Worker**: Abstraer la lógica duplicada (`ojoDigital.js`, `parseador.js`, etc.) en una carpeta `shared/` para unificar el código de ambos entornos.
- **Refactorización de npm scripts**: Mejorar el script `test` en el `package.json` raíz utilizando wildcards en lugar de enumerar todos los archivos estáticos.
