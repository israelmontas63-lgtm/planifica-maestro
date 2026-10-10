# INFORME FINAL DE AUDITORÍA Y REMEDIACIÓN (Beta Cerrada)
**Proyecto:** Planifica Maestro
**Rama de resolución:** `fix/auditoria-beta`

## 1. Tabla de Hallazgos y Resoluciones

| Hallazgo | Estado Inicial | Veredicto | Resolución Aplicada | Bloque |
|----------|----------------|-----------|---------------------|--------|
| **H1. RLS Supabase** | Políticas solapadas y `public.perfil_docente` global. | **SÍ (Crítico)** | Se creó migración `20261010_bloque3_consolidar_rls.sql` que dropea políticas antiguas e impone estricto `auth.uid() = user_id`. | 3 |
| **H2. Fail-Open Auth** | `ACCESO_ABIERTO=true`, middleware permitía todo sin clave. | **SÍ (Crítico)** | `ACCESO_ABIERTO` en false. Middleware y Worker actualizados para dar error 500 (Fail-Closed) si falta `APP_ACCESS_KEY`. | 2 |
| **H3. Secretos en Git** | `.env.example` versionados con claves reales quemadas. | **SÍ (Crítico)** | Se sanitizaron con `TU_CLAVE_AQUI`. El dueño decidió **Aceptar el Riesgo** de no rotar las claves en su historial. | 2 |
| **H4. Vulnerabilidades** | Reportadas por `npm audit`. | **FALSO (Bajo)** | 0 vulnerabilidades en producción (`--omit=dev`). Solo existen en dependencias de desarrollo. | 4 |
| **H5. Rate Limit Memoria** | Uso de `new Map()` en Cloudflare Workers. | **SÍ (Alto)** | Se adaptó la lógica para usar un Cloudflare KV (`RATE_LIMIT_KV`). Si falla/no existe, hace fallback seguro al Map. | 5 |
| **H6. Llave Dueño Local** | `pm_owner_key` almacenada en `localStorage`. | **SÍ (Medio)** | Mitigación aplicada: Migrada a `sessionStorage` en `api.js`, `App.jsx` y `OwnerModal.jsx`. | 6 |
| **H7. Capacitor dual** | `capacitor.config.json` y `.ts` duplicados. | **SÍ (Bajo)** | Se eliminó `.json` preservando la versión tipada `.ts` que utiliza el build real. | 7 |
| **H8. CI/CD inactivo** | `deploy.yml.guardado` fuera del pipeline. | **SÍ (Informativo)**| Se documentó en `CONTEXTO.md` que el despliegue es vía `scripts/deploy.js` (manual). | 7 |

---

## 2. Historial de Cambios (Por Bloque)

- **Bloque 0:** Tag `respaldo-pre-auditoria`. Línea base confirmada (build y 236 tests OK). Generación de memoria (`CONTEXTO.md`, `PROGRESO.md`, `DECISIONES.md`, `PENDIENTES.md`, `DESPLIEGUE.md`).
- **Bloque 1:** Diagnóstico de lectura sin escritura. (Resultados mapeados arriba).
- **Bloque 2:** Sanitizados los `.env.example`. Actualizado `wrangler.toml` a `ACCESO_ABIERTO=false`. Añadida condición de `APP_ACCESS_KEY` estricta (500 Server Error) en `server/middleware/auth.js` y `worker/index.js`.
- **Bloque 3:** Escritas migraciones SQL (`20261010_bloque3_consolidar_rls.sql` y `_REVERT.sql`) para unificar la seguridad RLS basada estrictamente en `auth.uid() = user_id`.
- **Bloque 4:** Comprobación de seguridad en NPM (ninguna vulnerabilidad productiva; no se forzaron dependencias de dev para mantener la estabilidad).
- **Bloque 5:** Se inyectó compatibilidad con Cloudflare KV en la función `verificarRateLimitAnonimo` del `worker/index.js` (Namespace `RATE_LIMIT_KV`).
- **Bloque 6:** Refactorizado el manejo de la llave maestra del dueño para utilizar exclusivamente `sessionStorage` en todo el flujo de cliente.
- **Bloque 7:** Limpieza del entorno borrando configuraciones duplicadas de Capacitor y actualizando la documentación CI/CD en la memoria del proyecto.

---

## 3. Verificación y Testing

- **Pruebas Locales (Unitarias/Integración):** Todos los 236 tests originales (`npm test`) pasaron exitosamente tras los cambios.
- **Construcción (Build):** `npm run build` genera el PWA manifest y el `dist/version.json` correctamente sin errores.
- **Producción:** *NO se desplegó código automáticamente debido a la restricción P6* (falta de token de Cloudflare/Supabase a nivel de CLI local). Todo está preparado para que el Dueño ejecute el despliegue en un solo click.

---

## 4. Pendientes Manuales del Dueño (Acciones Inmediatas)

Al no poseer las credenciales (Supabase CLI activo ni API Tokens de CF en el agente), debes realizar estos pasos **antes de hacer push a la rama `main` (Producción)**:

1. **Configurar Cloudflare KV (Bloque 5):**
   ```bash
   npx wrangler kv:namespace create RATE_LIMIT_KV
   ```
   *Agrega el bloque generado a tu `wrangler.toml` local*.

2. **Garantizar las Variables en Cloudflare (Bloque 2):**
   Ejecuta `npx wrangler secret put APP_ACCESS_KEY` y el resto de las variables expuestas en `DESPLIEGUE.md` si aún no lo has hecho.

3. **Aplicar Migración Supabase (Bloque 3):**
   Copia y pega el contenido del archivo `supabase/migrations/20261010_bloque3_consolidar_rls.sql` en el SQL Editor del dashboard web de Supabase.

4. **Desplegar:**
   ```bash
   npm run deploy
   ```

---

## 5. Pruebas de Humo (Smoke Test) a realizar en Producción

Tras desplegar, verifica los siguientes flujos para validar la estabilidad:

1. [ ] **Carga Inicial:** Ingresa a la URL base. La PWA debe cargar sin pantalla en blanco.
2. [ ] **Fallo Seguro (Fail-Closed):** Intenta usar la app forzando que falte `APP_ACCESS_KEY`. Debe rechazar y lanzar error 500 (Fail-Closed) al cargar `/api/auth/verify`.
3. [ ] **Acceso Normal:** Ingresa la Clave Institucional válida; la app debe dejarte avanzar.
4. [ ] **Rate Limit (Anónimo):** Simula peticiones en masa o usa la app sin loguearte como Docente/Dueño y verifica que el límite KV se ejecute (o que el fallback en memoria arroje aviso por log).
5. [ ] **Protección RLS (Escritura):** Crea un plan de clase autenticado.
6. [ ] **Protección RLS (Aislamiento):** Inicia sesión con un Docente A, verifica que NO puedes ver los planes generados por un Docente B en tu dashboard.
7. [ ] **Llave del Dueño (Session):** Ingresa como dueño, abre y cierra la pestaña completamente, y vuelve a entrar. El sistema debería volver a pedirte la llave (ya no está en `localStorage`).
8. [ ] **Llave del Dueño (Flujo):** Accede al panel de Uso de Docentes; debe listar los datos sin problema.

---

## 6. Riesgos Abiertos (Backlog)

Quedan anotados en `PENDIENTES.md` para el ciclo de estabilización posterior (Fuera del Alcance de Beta):
- Duplicación completa de la lógica entre `server/` y `worker/`.
- Archivos `.pdf` duplicados y binarios pesados en el repositorio (ej. doble extensión `.pdf.pdf`).
- Migrar `pm_owner_key` y JWT a cookies `HttpOnly` firmadas, en lugar de Web Storage.
- Rotar y purgar completamente el historial git de los `.env.example` en el futuro.
