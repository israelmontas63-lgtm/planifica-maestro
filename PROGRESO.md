# PROGRESO: CIERRE DEL CEREBRO DE PLANIFICA MAESTRO

## Estado General
- **Paso actual**: MODO BETA ABIERTA — PASO 1 COMPLETADO (Beta abierta sin cuentas ni contraseñas, Supabase dormido vía `VITE_REQUIRE_LOGIN=false`, identificador anónimo por dispositivo `pm_device_id`, perfil docente y biblioteca en dispositivo, aviso amigable de guardar en Word; 189/189 tests en verde y build de producción verificado).
- **Siguiente paso**: PASO 2 — VERIFICACIÓN Y AJUSTES DE LÍMITES Y CAPACIDAD PARA 5 O 6 MAESTROS (esperando confirmación del usuario).
- **Bloques de Trabajo Global**:
  - PASO 1 — Commit seguro y respaldo (TERMINADO: commits f987009, 551c08e, 43d7808).
  - PASO 2 — Recopilación en cuadro único y resolución de contradicciones (TERMINADO).
  - PASO 3 / 3B / 3C — Conducta pedagógica y robustecimiento (TERMINADO).
  - PASO 4 / 4B — Auditoría técnica integral y verificaciones (TERMINADO).
  - PASO 5 — Propuesta formal de orden de trabajo para la Beta (TERMINADO).
  - FASE 2 — Modelo Oficial de Planificación (TERMINADO: Word CON BASE A4 horizontal con 17 filas y sombreado #CDEEF6, Perfil Docente ampliado, Selector Multigrado, Selector IA Gemini 3.1 Flash-Lite vs 3.5 Flash; 146/146 tests).
  - FASE 3 — Indexación Curricular Completa y Desduplicación (TERMINADO: 2,264 páginas de 9 PDFs oficiales MINERD en Capa 2, descarte de 383 fragmentos redundantes, 2,455 fragmentos únicos indexados en Capa 4 con hash SHA-256, buscador curricular multi-nivel calibrado; 164/164 tests).
  - FASE 4 — Persistencia y Aislamiento Multiusuario (TERMINADO: Script SQL RLS para Supabase con políticas auth.uid() en perfil_docente, planes_guardados y uso_docentes; blindaje de solo lectura de cuotas para el cliente, sincronización híbrida PWA, purga en cierre de sesión en useAuth.js, límite unificado de 20 cuotas con observabilidad origen_cuota; 180/180 tests en verde y build PWA verificado en 4.15s).
  - BETA ABIERTA PASO 1 — Desactivación de Supabase sin eliminar código, modo sin cuentas con identificador `pm_device_id`, perfil local y aviso amigable sin jerga (TERMINADO: 189/189 tests en verde).

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

## Commits Realizados
- `378c1b1`: `fix(conducta): salvaguarda de saludo directo y defensa en código para imagen ilegible`
- `f82fcb2`: `test(conducta): evaluadores semánticos y reporte de corridas por lotes`
- `ba3be29`: `fix(conducta): cierre de Paso 3C con benchmark justo 5 corridas, verificador de citas y defensas`

## Decisiones y Reglas Obligatorias
1. Cero commits ni logs con claves completas (solo 4 primeros y 4 últimos caracteres). Claves solo en servidor/worker.
2. NO desplegar a producción ni hacer git push sin autorización expresa.
3. Respaldo creado: branch `backup-antes-commits-20261007`.
4. Cero gasto de cuota de ElevenLabs en pruebas (solo consultar /v1/user/subscription).
5. Conservar intacto todo lo que ya funciona (modo hablado, cámara/ojo digital, PWA, dictado continuo).
