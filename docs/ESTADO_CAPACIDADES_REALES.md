# Estado Real de Capacidades — Planifica Maestro

Documento de clasificación técnica honesta del estado actual de capacidades del sistema. Ninguna capacidad se reporta como operativa en producción si depende de despliegue, migración, binding externo o agente local no instalado.

---

## 1. IMPLEMENTADA Y VERIFICADA (en código y pruebas locales automatizadas)

- **Entrega de `finalPayload` corregido en streaming SSE (`worker/index.js`)**: El bloque de auditoría curricular, corrección (`construirPromptCorreccion`), evaluación RAGAS y persistencia en caché ocurre antes de construir y emitir el evento SSE `final`.
- **Buffer de líneas SSE y UTF-8 multibyte en cliente (`client/src/api.js`)**: `generarPlanificacion` acumula fragmentos incompletos en `sseBuffer` hasta `\n` y procesa el remanente al cerrar el stream. Verificado con particiones arbitrarias de 17 bytes.
- **Unificación de memoria episódica 1024D (`worker/services/memoriaEpisodica.js`)**: `esVectorValido1024`, `consultarMemoriaEpisodica` y `guardarExperienciaEpisodica` validan dimensionalidad exacta de 1024 (`@cf/baai/bge-m3`), verifican `res.ok` y clasifican códigos HTTP.
- **Validación curricular unificada (`worker/services/validadorFinalPlan.js`)**: `clasificarEstadoValidacion` (5 estados: `APROBADO`, `APROBADO_CON_OBSERVACIONES`, `NECESITA_CORRECCION`, `NO_VERIFICADO`, `ERROR_DE_VALIDACION`) y `ejecutarValidacionYCorreccionFinal` integrados en Streaming, `usaHerramientasV2` y JSON estándar.
- **Registro seguro de herramientas y defensa contra Prompt Injection (`worker/services/registroHerramientas.js` + `worker/services/adaptadorCognitivo.js`)**: Conectado al Worker productivo (`worker/index.js` y `shared/ciclo.js`). Verifica `permisosUsuario` resueltos en servidor, identidad autenticada, niveles de riesgo 1/2/3, bloqueo de comandos destructivos, bloqueo de Nivel 3 sin confirmación explícita o desde fuentes externas (`web`, `documento`, `correo`, `archivo`), idempotencia en operaciones con efectos secundarios, timeout y verificación post-ejecución.
- **Planificador cognitivo DAG (`worker/services/planificadorTareas.js`)**: Conectado selectivamente al Worker productivo (`worker/index.js`) vía `ejecutarOrquestacionCognitivaSiAplica`. Solicitudes sencillas (saludos, cálculos) pasan directo sin DAG; tareas complejas/multipaso/dispositivo ejecutan `ejecutarCicloOperativo` con estados (`COMPLETADA`, `COMPLETADA_CON_OBSERVACIONES`, `FALLIDA`, `PENDIENTE_DE_AUTORIZACION`), detección de ciclos, reintentos seguros solo en pasos idempotentes y trazabilidad estructurada.
- **Política estricta de caché tras validación (`worker/index.js` + `worker/cacheRespuestas.js`)**: Streaming SSE, `usaHerramientasV2` y JSON estándar ejecutan la caché *después* de `ejecutarValidacionYCorreccionFinal`, almacenando únicamente planes en estado `APROBADO` (rechazando `NECESITA_CORRECCION`, `NO_VERIFICADO`, `ERROR_DE_VALIDACION` y `APROBADO_CON_OBSERVACIONES`).
- **Rigor de evidencia visual (`worker/services/cerebroMultimodal.js`)**: Separación de `Observado`, `Transcrito`, `Inferido` y `Desconocido / Insuficiente`, con rechazo de imágenes vacías o demasiado pequeñas sin inventar detalles.
- **Planificador proactivo con zona horaria RD (`worker/services/planificadorProactivo.js`)**: Conversión `America/Santo_Domingo` (UTC-4) a ISO UTC, autorización obligatoria del propietario, clave de idempotencia y cancelación.

## 2. IMPLEMENTADA PERO NO PROBADA EN PRODUCCIÓN

- **Migración SQL idempotente (`supabase/migrations/20261112000000_sincronizar_memoria_1024_y_cache_semantica.sql`)**: Sincroniza `robot_memoria_experiencias` a `vector(1024)`, `consultar_memoria_robot` con `SECURITY INVOKER` + `SET search_path = ''` y filtro `validado_por_auditor = TRUE AND calificacion_calidad >= 4`, y versiona `curriculo_cache_semantica` + `consultar_cache_planificacion` (`SECURITY INVOKER`, `SET search_path = ''`, `EXECUTE` restringido a `service_role`). Pendiente de aplicación por el propietario en Supabase.
- **Hub WebSocket Multidispositivo (`worker/durable/DispositivoHubDO.js`)**: Probado en pruebas unitarias con mocks de Durable Object Storage y `WebSocketPair` (autenticación HMAC, aislamiento por `usuarioId`, permisos granulares por defecto en `false`, anti-replay por `messageId`, revocación con cierre `4003`), pero no desplegado ni probado contra la red real de Cloudflare.
- **Integración completa en vivo de `worker/index.js` y `client/src/api.js`**: Probada localmente en lógica aislada; requiere despliegue controlado tras sellado de hashes.

## 3. DISPONIBLE CON AUTORIZACIÓN DEL USUARIO

- **Acceso puntual a cámara del navegador (`client/src/components/OjoVisorCamara.jsx`)**: Utiliza `navigator.mediaDevices?.getUserMedia` bajo interacción/permiso explícito del usuario y libera la pista al cerrar.
- **Prototipo de agente local Windows (`scripts/agente_local_windows.mjs`)**: Allowlist estricta (`estado_dispositivo`, `crear_documento_autorizado` confinado al directorio base con archivos `.txt`/`.md`, `abrir_aplicacion_permitida` para `notepad`, `calc`, `mspaint`). Requiere ejecución e instalación local explícita por el propietario.
- **Ejecución de herramientas Nivel 3 (`registroHerramientas.js`)**: Solo procede cuando existe confirmación explícita del usuario y el origen no proviene de contenido externo no confiable.

## 4. DEPENDIENTE DE CONFIGURACIÓN EXTERNA

- **Durable Object `DISPOSITIVO_HUB` en Cloudflare**: `wrangler.toml` actualmente no declara `[[durable_objects.bindings]]` ni migraciones de Durable Objects; se requiere configurarlos y desplegar en Cloudflare.
- **KV de caché curricular y Rate Limiting en staging**: `wrangler.toml` tiene `RATE_LIMIT_KV` en producción, pero carece de KV en staging y no declara `CACHE_KV` ni `CURRICULO_KV` (la caché cae a `Map` en memoria por instancia).
- **Sellado de integridad (`PROTEGIDO.hashes.json`)**: `worker/index.js` y `client/src/api.js` fueron modificados y requieren que el propietario ejecute `npm run guardia:sellar -- --confirmar` si aprueba los cambios.
- **Secretos de ejecución**: `GEMINI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_ACCESS_KEY` / `OWNER_MASTER_KEY`, `TAVILY_API_KEY` deben estar presentes en Cloudflare / `.dev.vars`.

## 5. PENDIENTE DE DESARROLLO

- **Agente nativo / servicio instalado en Android**: No existe APK ni servicio residente Android implementado en el repositorio; la comunicación hacia Android depende del protocolo de `DispositivoHubDO` cuando exista un cliente conectado.
- **Visión continua en segundo plano y wake-word nativo**: El visor de cámara actual es bajo demanda dentro de la sesión activa de la PWA; no hay daemon de visión continua.
- **Instalador / servicio de sistema Windows (tray/autostart)**: `scripts/agente_local_windows.mjs` es un módulo/CLI prototipo, no un servicio empaquetado ni conectado aún por WebSocket al Hub desplegado.
- **Interfaz UI dedicada para gestión de permisos de dispositivos y tareas proactivas**: La lógica backend existe en `DispositivoHubDO.js` y `planificadorProactivo.js`, sin paneles UI nuevos en `client/src/`.

## 6. NO SOPORTADA POR LA PLATAFORMA ACTUAL

- **Control directo del sistema operativo desde el navegador PWA o Cloudflare Worker sin agente local**: Por el modelo de seguridad del navegador y el aislamiento serverless de Cloudflare Workers, la web app no puede abrir aplicaciones locales de Windows/Android ni escribir arbitrariamente en el disco del usuario sin un agente acompañante autorizado localmente.
- **Cron/ejecución continua autónoma dentro de `worker/index.js` sin triggers configurados**: Un Worker HTTP estándar no ejecuta procesos en segundo plano entre peticiones sin Cloudflare Cron Triggers, Queues o Durable Object Alarms configurados y desplegados.
