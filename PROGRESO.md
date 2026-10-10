# PROGRESO: CIERRE DEL CEREBRO DE PLANIFICA MAESTRO

## Estado General
- **Paso actual**: FASE 4 — SET DORADO DE 40 CASOS DE EVALUACIÓN (Fase 0, 1, 2 y 3 completadas y verificadas).
- **Siguiente paso**: Ejecutar el Set Dorado de 40 casos representativos con registro de métricas y transcritos docentes.
- **Bloques de Trabajo Global**:
  - FASE 0 — Diagnóstico y Respaldo (COMPLETADA: tag pre-limpieza-despliegue, rollback 38b42ec3 documentado, secretos auditados).
  - FASE 1 — Despliegue Cloudflare y Pipeline (COMPLETADA: commit 9bacede, versión 3c8c0d1 en vivo en producción).
  - FASE 2 — Limpieza y Cabeceras de Seguridad (COMPLETADA: commit 25617a2, X-Content-Type-Options y Referrer-Policy en vivo).
  - FASE 3 — Anclaje Curricular Oficial y Clasificador de 6 Categorías (COMPLETADA: commits 3c8c0d1 y 23c332f; corpus.json, catalogo.json, terminologia_rd.json, clasificadorIntencion y reglas 7-9 en modoConversacional con paridad Node/Worker; 231/231 tests en verde).
  - FASE 4 — Set Dorado de 40 Casos (EN EJECUCIÓN).
  - FASE 5 — Freno de Emergencia y Rate Limit (PENDIENTE).
  - FASE 6 & 7 — Voz bajo demanda y Recursos Beta (PENDIENTE).
  - FASE 8 — Verificación Final y Despliegue a Producción (PENDIENTE).

## Procedimiento para Reactivar Supabase en Lanzamiento Masivo (Paso 1.5)
Cuando se configure el nuevo proyecto activo de Supabase para el lanzamiento masivo a todos los docentes:
1. En `client/.env`:
   - Cambiar `VITE_REQUIRE_LOGIN=false` a `VITE_REQUIRE_LOGIN=true`.
   - Colocar la nueva URL de Supabase en `VITE_SUPABASE_URL`.
   - Colocar la clave pública (anon) en `VITE_SUPABASE_ANON_KEY`.
2. En la base de datos de Supabase:
   - Ejecutar la migración SQL `supabase/migrations/20261008_fase4_aislamiento_rls.sql` desde el SQL Editor de Supabase.
3. El frontend reactivará automáticamente:
   - El botón "Entrar / Iniciar Sesión" en el encabezado.
   - La pantalla de autenticación y registro por correo/contraseña (`AuthScreen.jsx`).
   - La sincronización bidireccional en la nube con `perfil_docente` y `planes_guardados`.
   - La purga de datos al cerrar sesión para ordenadores compartidos.
   - Cero reescritura de código: todo el flujo de autenticación está protegido y testeado.
4. Procedimiento de prueba pendiente para lanzamiento masivo (con 2 cuentas reales en Supabase):
   - Paso a: Registrar dos docentes de prueba (`docente_a@prueba.com` y `docente_b@prueba.com`).
   - Paso b: Iniciar sesión como Docente A y autenticar sesión HTTP.
   - Paso c: Probar consulta legítima de cuota: `supabase.from('uso_docentes').select('*')` -> Devuelve únicamente la fila de Docente A (HTTP 200).
   - Paso d: Probar intento de mutación maliciosa desde cliente: `supabase.from('uso_docentes').update({ usadas: 0 }).eq('docente_id', userA.id)` -> Debe rechazar con error de privilegios (HTTP 403 / permission denied for table uso_docentes).
   - Paso e: Probar intento de lectura cruzada: `supabase.from('planes_guardados').select('*').eq('user_id', userB.id)` -> Devuelve 0 filas (política RLS no coincide con auth.uid()).
   - Paso f: Iniciar sesión como Docente B y confirmar que su biblioteca y perfil están 100% aislados de Docente A.
   - Paso g: Cerrar sesión y confirmar que `limpiarDatosUsuario` purga el almacenamiento local del dispositivo.

## Commits Realizados
- `378c1b1`: `fix(conducta): salvaguarda de saludo directo y defensa en código para imagen ilegible`
- `f82fcb2`: `test(conducta): evaluadores semánticos y reporte de corridas por lotes`
- `ba3be29`: `fix(conducta): cierre de Paso 3C con benchmark justo 5 corridas, verificador de citas y defensas`
- `798e527`: `feat(fase2): modelo oficial Word CON BASE en A4 horizontal, perfil ampliado, multigrado y selector IA`
- `f5ed81e`: `feat(fase3): indexacion de 9 PDFs oficiales MINERD, desduplicacion SHA-256 y buscador multiciclo`
- `15dafcd`: `feat(fase4): persistencia y aislamiento multiusuario con Supabase RLS, purga en cierre de sesion y sincronizacion hibrida`
- `68615c4`: `feat(beta): modo beta abierta sin login con dispositivo estable y almacenamiento local`
- `3abc035`: `feat(beta): perfil multigrado, formato de secuencia didactica CON BASE y 3 muestras docx completas`
- `9bacede`: `build(ci): configurar workspaces y build de version para despliegue en Cloudflare`
- `25617a2`: `feat(seguridad): anadir cabeceras X-Content-Type-Options y Referrer-Policy y limpiar temporales`
- `3c8c0d1`: `feat(curriculo): inventario oficial del corpus, catalogo de esquemas y terminologia dominicana`
- `23c332f`: `feat(clasificador): clasificador de 6 categorias y reglas de conducta con paridad node/worker`

## Decisiones y Reglas Obligatorias
1. Cero commits ni logs con claves completas (solo 4 primeros y 4 últimos caracteres). Claves solo en servidor/worker.
2. NO desplegar a producción ni hacer git push sin autorización expresa.
3. Respaldo creado: branch `backup-antes-commits-20261007`.
4. Cero gasto de cuota de ElevenLabs en pruebas (solo consultar /v1/user/subscription).
5. Conservar intacto todo lo que ya funciona (modo hablado, cámara/ojo digital, PWA, dictado continuo).

## Respaldo de Producción (Fase 0.1)
- **Tag git de respaldo creado**: `pre-limpieza-despliegue`
- **Deployment ID activo**: `38b42ec3-2b9e-451b-b1f2-c38919df5bb3`
- **Fecha de creación**: `2026-10-09T21:23:03.712Z`
- **Mensaje**: `deploy fff699b`
- **Deployment previo inmediato**: `52e6fb92-f2f2-4215-8636-f6731ea6e205` (`2026-10-09T19:51:50.190Z`)
- **Comando de reversa inmediata**: `npx wrangler rollback 38b42ec3-2b9e-451b-b1f2-c38919df5bb3` (o `npx wrangler rollback 52e6fb92-f2f2-4215-8636-f6731ea6e205`)
- **Ruta del panel de Cloudflare**: `Workers & Pages` → `planifica-maestro` → `Deployments` → `View rollout history`
- **Tipo de autenticación**: Token de API (Account API Token de `Israelmontas65@gmail.com's Account`, ID `9513f780180c7be282365f811706b695`) desde `CLOUDFLARE_API_TOKEN`.

## Decisiones tomadas (Fase 0 - SRE/DevOps)
- **Tag git de protección**: Creado `pre-limpieza-despliegue` antes de cualquier acción.
- **Rollback documentado**: IDs `38b42ec3` y `52e6fb92`.
- **Estrategia de Un Solo Desplegador**: El build conectado en Cloudflare se diagnostica y repara para ser el único desplegador oficial conectado a GitHub sin requerir tokens ni actions.

## Decisiones tomadas (Fase 1 y 2 - Limpieza y Pipeline)
- **Workspaces en package.json**: Añadido `"workspaces": ["client"]` y script `scripts/ensure_client_deps.js` para asegurar dependencias en entornos de CI/CD limpios sin alterar el flujo local.
- **Generación de versión**: Script `scripts/build_version.js` inyecta automáticamente `client/dist/version.json` con el SHA de commit.
- **Encabezados de seguridad HTTP**: `client/public/_headers` y `worker/index.js` (tanto para assets estáticos como cabeceras API CORS) incorporan `X-Content-Type-Options: nosniff` y `Referrer-Policy: strict-origin-when-cross-origin`.
## Decisiones tomadas (Fase 3 - Anclaje Curricular y Clasificador)
- **Inventario Oficial (`corpus.json`)**: 9 PDFs oficiales MINERD y UNICEF catalogados (2,264 páginas auditadas con SHA-256).
- **Catálogo de Esquemas (`catalogo.json`)**: Esquemas de Unidad de Aprendizaje MINERD, Secuencia CON BASE y Plan de Clase Diaria.
- **Terminología Dominicana (`terminologia_rd.json`)**: Mapeo unívoco de conceptos extranjeros (DBA Colombia, Aprendizajes Clave México, Estándares Básicos Colombia, NAP Argentina, OA Chile, Malla Curricular) a la terminología oficial dominicana (Adecuación Curricular 2023).
- **Clasificador en 6 Categorías**: Implementado y verificado en `server/ia/clasificadorIntencion.js` y `worker/clasificadorIntencion.js` con paridad 100%. Reglas de conducta 7, 8 y 9 añadidas a `SYSTEM_PROMPT_CONVERSACIONAL`.
- **Evidencia**: Suite `tests/test_clasificador_6_categorias.mjs` pasando 42/42 pruebas; suite global pasando 231/231 pruebas.

## Decisiones tomadas (Fase 4 - Set Dorado de 40 Casos)
- En ejecución: Preparación y corrida de los 40 casos representativos balanceados para evaluar precisión de categorización, latencia (p50, p95), citas verificadas contra el corpus y respuestas en tono docente sin jerga técnica.



