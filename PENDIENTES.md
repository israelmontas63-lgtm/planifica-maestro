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
- ~~**Aislamiento de pruebas y muestras_word**~~: **COMPLETADO**. En `tests/test_con_base_multigrado.mjs`, los archivos de prueba ahora se generan en `os.tmpdir()` y se eliminan tras verificar, evitando ensuciar archivos binarios en el árbol de trabajo git.
- ~~**Guía pedagógica de formatos y modo sin conexión**~~: **COMPLETADO**. Incorporada la "Secuencia didáctica CON BASE" y las pautas para aulas rurales en `client/src/components/AyudaModal.jsx`.
- ~~`Math.random()` genera el token de confirmación de eliminación de cuenta~~: **COMPLETADO**. Migrado a `crypto.getRandomValues` criptográficamente seguro mediante `generarCodigoSeguro()` en `worker/index.js`.
- ~~PDFs duplicados en el repositorio~~: **COMPLETADO**. Eliminados 55.6 MB de duplicados en `server/curriculum/referencias/con-base/`. Duplicación de lógica entre `server/` y `worker/` documentada en Bloque 1.

## Para la versión con cuentas

Plan estratégico y técnico para la transición desde la fase de Beta Abierta hacia la versión comercial definitiva con autenticación, multi-tenancy y monetización:

### 1. Reactivación de la Autenticación Post-Beta
Para cerrar la beta abierta y volver al modo protegido por autenticación o clave institucional en producción:
- **Cloudflare Worker (`wrangler.toml`)**: Cambiar `ACCESO_ABIERTO = "false"` y mantener `REQUIRE_ACCESS_KEY = "true"`. Desplegar con `npx wrangler deploy`.
- **Servidor Node (`.env`)**: Establecer `REQUIRE_ACCESS_KEY="true"` y `ACCESO_ABIERTO="false"`.
- **Cliente PWA (`client/.env`)**: Establecer `VITE_REQUIRE_ACCESS_KEY="true"` y `VITE_REQUIRE_LOGIN="true"`.
- **Efecto de seguridad**: El middleware del Worker y servidor volverá a exigir tokens JWT válidos de Supabase o encabezado `x-app-key` con la clave autorizada en `requerirAcceso()`, mientras que la UI montará `AccessGate` o el flujo de inicio de sesión de Supabase Auth.

### 2. Estrategia de Migración de Planes: localStorage a Supabase
Durante la Beta Abierta, las planificaciones se almacenan localmente en `localStorage` bajo `pm_biblioteca_${deviceId}` (donde `deviceId` es el identificador generado por `obtenerOrearDispositivoId()`).
- **Detección en primer inicio de sesión**: Al registrarse o iniciar sesión por primera vez con correo/contraseña o Google, `useAuth.js` detectará si existen planes locales en `pm_biblioteca_${deviceId}` o `pm_biblioteca_dev_*`.
- **Flujo de consentimiento UI**: Se presentará un modal amigable: *"Hemos encontrado planificaciones guardadas en este dispositivo. ¿Deseas subirlas a tu cuenta para acceder a ellas desde cualquier teléfono o computadora?"*.
- **Mecanismo de sincronización**:
  - Opción A (Cliente directo): `upsert` por lotes hacia la tabla `planificaciones` mediante `@supabase/supabase-js`, aprovechando las políticas de Row Level Security (RLS) donde `auth.uid() = docente_id`.
  - Opción B (API Backend): Endpoint `POST /api/planes/migrar` con el array de planes en el cuerpo y el Bearer Token del usuario autenticado.
- **Limpieza segura**: Una vez confirmado el guardado exitoso en Supabase, los planes locales se archivan o se sincronizan en la clave de usuario `pm_biblioteca_${user.id}`, limpiando la clave temporal anónima.

### 3. Planes Comerciales y Estructura de Cuotas
- **Plan Gratis (Docente Individual)**:
  - Destinado a maestros independientes para evaluación y uso cotidiano moderado.
  - Cuota: 15–20 planificaciones completas al mes (o 2–3 al día).
  - Funciones: Exportación a Word/PDF, consulta de currículo MINERD y DUA, biblioteca personal local/nube.
- **Plan Pro (Docente Avanzado / Multigrado)**:
  - Destinado a docentes de alta carga horaria, directores de grado y coordinadores de ciclo.
  - Cuota: 100 planificaciones al mes (o cuota ilimitada con rate limit de cortesía).
  - Funciones: Exportación de Rúbricas e Instrumentos de Evaluación (Ordenanza 04-2023), Registro de Calificaciones en Excel, Ojo Digital (OCR de cuadernos) ilimitado, acompañamiento de voz pedagógico de Duarte.
- **Plan Escuela (Centro Educativo Institucional)**:
  - Licencia institucional para todo el cuerpo docente y equipo directivo de la escuela/distrito.
  - Cuota: Bolsa institucional compartida o cuota ilimitada por docente registrado bajo el código SIGERD del centro.
  - Funciones:
    - Coordinación pedagógica en la nube en tiempo real (revisión de planes entre docentes y coordinadores/as).
    - Dictámenes y observaciones oficiales MINERD con notificaciones push/email.
    - Sello y certificación digital institucional en documentos Word/PDF.
    - Panel de analítica curricular y cobertura de competencias a nivel de centro.
    - Exportación consolidada de informes mensuales de supervisión para el Distrito Educativo.

### 4. Estado de las Tablas en Supabase (RLS Auditado)
- **Tablas Listas y Protegidas con RLS (`supabase/migrations/`)**:
  - `perfiles`: Almacena perfil docente (nombre, tanda, regional, distrito, centro). RLS activo: cada usuario solo lee y edita su propio perfil (`id = auth.uid()`).
  - `planificaciones`: Almacena el contenido curricular, grado, área, situación de aprendizaje y estado (`borrador`, `enviada_revision`, `aprobada`, `observada`). RLS activo: docentes leen/editan sus propios planes; coordinadores de la misma escuela pueden leer planes enviados a revisión.
  - `revisiones_coordinador`: Almacena el historial de revisiones, observaciones y recomendaciones DUA emitidas. RLS activo: solo coordinadores y directores de la escuela pueden insertar dictámenes; el docente dueño del plan puede leer sus dictámenes.
  - `cuotas_docente`: Registra consumo de planificaciones por docente y periodo (`mes`/`dia`). RLS activo para control de cuota por usuario.
- **Tablas Pendientes por Crear / Ajustar para la Fase Comercial**:
  - `suscripciones` / `planes_comerciales`: Tabla para vincular `user_id` con el plan (`gratis`, `pro`, `escuela`), estado de pago (Stripe/PayPal o transferencia local en RD$), fecha de corte y renovación.
  - `escuelas` / `membresias_centro`: Tabla formal de centros educativos con código SIGERD, vinculando a los docentes con rol (`docente`, `coordinador_area`, `director`) y gestionando la validez de la licencia anual institucional.
  - `invitaciones_institucionales`: Tokens para que el director o coordinador invite al equipo docente de su escuela a unirse a la suscripción institucional sin requerir pago individual.
