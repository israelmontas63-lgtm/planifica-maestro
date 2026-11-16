# Actualizaciones Técnicas — Planifica Maestro (Fases A–K)

Registro técnico consolidado del estado final de la integración, correcciones aplicadas, pruebas verificadas, hashes de integridad y acciones pendientes del propietario.

---

## 1. Resumen de Cambios y Correcciones Aplicadas

### Fase A — Entrega de `finalPayload` corregido en SSE (`worker/index.js`)
- Se reubicó el bloque de auditoría curricular, corrección Self-RAG, evaluación RAGAS/CRAG y guardado en caché **antes** de construir y emitir el evento SSE `final` (`finalPayload`), garantizando que el cliente reciba la planificación corregida y su resultado de auditoría.

### Fase B — Unificación de Embeddings 1024D y Memoria Episódica
- **`worker/services/memoriaEpisodica.js` (nuevo):** Valida dimensionalidad exacta de 1024 (`@cf/baai/bge-m3`) mediante `esVectorValido1024`, verifica `res.ok` y clasifica errores HTTP (400/401/403/500) al consultar `consultar_memoria_robot` o insertar en `robot_memoria_experiencias`.
- **`worker/services/memoriaService.js`:** Verifica `res.ok` y registra códigos HTTP en `guardarTurnoConversacion` y `guardarMensaje`.
- **`worker/services/gestorMemoriaExperiencias.js` / `memoriaCognitivaService.js`:** Marcados `@deprecated` como módulos heredados; `gestorMemoriaExperiencias.js` rechaza vectores distintos de 1024D.
- **`supabase/migrations/20261112000000_sincronizar_memoria_1024_y_cache_semantica.sql` (nueva, pendiente de aplicación):**
  - Sincroniza `robot_memoria_experiencias` a `vector(1024)` de forma idempotente (lanza excepción segura antes de alterar datos si existiera `vector(768)` con filas no nulas).
  - Reemplaza `consultar_memoria_robot` a `vector(1024)` con `SECURITY INVOKER`, `SET search_path = ''`, tablas calificadas y filtro `validado_por_auditor = TRUE AND calificacion_calidad >= 4`.
  - Versiona `curriculo_cache_semantica` y `consultar_cache_planificacion` con `SECURITY INVOKER`, `SET search_path = ''`, `REVOKE ALL ... FROM PUBLIC` y `GRANT EXECUTE ... TO service_role`.

### Fase C — Validación Curricular Común y Política de Caché
- **`worker/services/validadorFinalPlan.js` (nuevo):** Unifica `clasificarEstadoValidacion` (`APROBADO`, `APROBADO_CON_OBSERVACIONES`, `NECESITA_CORRECCION`, `NO_VERIFICADO`, `ERROR_DE_VALIDACION`) y `ejecutarValidacionYCorreccionFinal` en los 3 flujos de `worker/index.js` (Streaming SSE, `usaHerramientasV2` y JSON estándar).
- **`worker/cacheRespuestas.js` + `worker/index.js`:** En los 3 flujos la caché se guarda **después** de `ejecutarValidacionYCorreccionFinal`. `esRespuestaCacheable` solo permite almacenar respuestas en estado `APROBADO` (rechaza `NECESITA_CORRECCION`, `NO_VERIFICADO`, `ERROR_DE_VALIDACION` y `APROBADO_CON_OBSERVACIONES`), y la lectura de caché descarta entradas no aprobadas.

### Fase D — Buffering SSE y UTF-8 Multibyte en Cliente (`client/src/api.js`)
- `generarPlanificacion` acumula fragmentos en `sseBuffer` hasta `\n` usando `TextDecoder` en modo `{ stream: true }` y procesa el remanente al cerrar el stream.

### Fases E, F y K — Planificador DAG, Registro de Herramientas y Conexión al Worker
- **`worker/services/registroHerramientas.js` (nuevo):** Niveles de riesgo 1/2/3, verificación de `def.habilitada`, identidad autenticada y permisos del usuario (`contexto.permisosUsuario` resuelto en servidor), validación de parámetros, detección de patrones de Prompt Injection, bloqueo de Nivel 3 sin autorización explícita o desde fuentes externas (`web`, `documento`, `correo`, `archivo`), idempotencia obligatoria en operaciones con efectos secundarios (`efectosSecundarios: true`), timeout y bitácora de auditoría.
- **`worker/services/planificadorTareas.js` (nuevo):** Ciclo operativo de 11 etapas (`ETAPAS_CICLO`), `ESTADOS_OPERATIVOS` (`PLANIFICADA`, `EN_EJECUCION`, `COMPLETADA`, `COMPLETADA_CON_OBSERVACIONES`, `FALLIDA`, `PENDIENTE_DE_AUTORIZACION`), detección de ciclos DAG, límites de iteración/tiempo y reintento seguro solo en pasos idempotentes.
- **`worker/services/adaptadorCognitivo.js` (nuevo) + `shared/ciclo.js` + `worker/index.js`:**
  - Conecta los adaptadores reales de `shared/herramientas.mjs` (`consultar_base_datos`, `consultar_fuente_curricular`, `buscar_contexto_web`) y el stub de verificación `accion_externa_nivel_3` al registro central.
  - Conecta `cicloToolCalling` (Streaming SSE y `usaHerramientasV2`) a `registroHerramientas.ejecutar(...)`.
  - Conecta selectivamente `ejecutarOrquestacionCognitivaSiAplica` al handler HTTP de `worker/index.js` (los saludos y cálculos simples pasan directo sin DAG).

### Fases G, H e I — Módulos Preparados (no conectados aún al Worker productivo)
- **`worker/services/cerebroMultimodal.js`:** Reglas de evidencia visual (`Observado`, `Transcrito`, `Inferido`, `Desconocido / Insuficiente`) y rechazo de imágenes vacías/insuficientes.
- **`worker/durable/DispositivoHubDO.js` (nuevo):** Durable Object WebSocket con token HMAC, aislamiento por `usuarioId`, permisos por defecto en `false` y revocación `4003`. Pendiente de binding en `wrangler.toml`.
- **`scripts/agente_local_windows.mjs` (nuevo):** Prototipo local allowlist para Windows sin shell arbitrario (sin cliente WebSocket conectado aún).
- **`worker/services/planificadorProactivo.js` (nuevo):** Gestor con zona horaria `America/Santo_Domingo` (UTC-4), idempotencia y cancelación (requiere Cron Triggers o DO Alarms para ejecución autónoma).
- **Documentación de capacidades:** `docs/ESTADO_CAPACIDADES_REALES.md`.

---

## 2. Verificación y Pruebas Ejecutadas

Todas las pruebas locales siguientes pasaron tras las últimas ediciones de código (con mocks de `fetch`, `env` y `Storage`/`WebSocketPair` en Node):
- `scripts/escanear_secretos.js`: 0 secretos detectados en archivos rastreados.
- `tests/test_integracion_cognitiva_worker.mjs`: **7/7 pasaron** (Escenarios A–H sobre `worker.fetch`, `adaptadorCognitivo` y `cacheRespuestas`).
- `tests/test_memoria_episodica_1024.mjs`: **5/5 pasaron**.
- `tests/test_validador_final_comun.mjs`: **2/2 pasaron**.
- `tests/test_sse_buffer_cliente.mjs`: **1/1 pasó**.
- `tests/test_planificador_y_seguridad.mjs`: **3/3 pasaron**.
- `tests/test_hub_multidispositivo_y_proactivo.mjs`: **4/4 pasaron**.
- `tests/test_4a_sse.mjs`: **1/1 pasó**.
- `tests/test_sse_herramientas_integracion.mjs`: **4/4 pasaron**.
- `tests/test_t4_conversacion_streaming.mjs`: **2/2 pasaron**.

---

## 3. Hashes SHA-256 de Archivos Protegidos Modificados

`node scripts/guardia.js` reporta exactamente 4 archivos protegidos modificados respecto a `PROTEGIDO.hashes.json`:

| Archivo | Hash Sellado | Hash Actual |
|---|---|---|
| `client/src/api.js` | `b7bd439cdcd1db019cb3498d87ae998444b546a254e47aeb4d0706dab3965ad0` | `a69d3943721546cf6518011add4a1676f33f1d334a0e0f5b1514022bfe491848` |
| `shared/ciclo.js` | `fd0dda3a01570c2ea34119cc86eb300ca966da16706e6ebbf98a3eb9840e6a1d` | `9f6c6f1893ee547510038d09ec148428ee0c7da5f493c844e6e8ad6266f6110c` |
| `worker/cacheRespuestas.js` | `a2eaebc30f061c49e7741eb822d8012538e60df4c004ca69d96e142847da3ef7` | `21b039fe1b33fc428140b8a66df8c976ccb1767eb3405d9a30328bdafb39b7bb` |
| `worker/index.js` | `3131d67313aa5064b5c646d45f2a720278a31ec3a29b434d39b6898f153661c5` | `bc3967d6384100114c3dc1c5cb21f94a963106cc8fdb821b651123f2a766e1fd` |

---

## 4. Acciones Pendientes del Propietario (No Ejecutadas por Regla de Seguridad)

1. **Sellar archivos protegidos** (Regla P2 — acto exclusivo del Dueño) dentro de `planifica-maestro/`:
   ```powershell
   npm run guardia:sellar -- --confirmar
   ```
2. **Aplicar la migración SQL** en Supabase:
   - `supabase/migrations/20261112000000_sincronizar_memoria_1024_y_cache_semantica.sql`
3. **Despliegue controlado** a staging/producción una vez sellada la guardia y aplicada la migración.


---

## 5. Actualizaciones Recientes (16/11/2026) — Autorizaciones 079 y 080

### Asistente Multimodal "Planifica Maestro" / "Plani Maestra" (Voz, Imagen y Texto)

1. **Blindaje de Identidad y Autoría Oficial (`worker/identidad.js` y `src/identidad.js`):**
   - **Identidad inmutable:** Asistente pedagógica creada en República Dominicana por el maestro y desarrollador Israel Montás para acompañar a docentes de primaria (1.º y 2.º grado y multigrado) según el currículo del MINERD y el programa CON BASE.
   - **Tono y estilo (Cero Estrés):** Trato cálido, directo y solidario dominicano; sin tecnicismos pesados ni fórmulas robóticas.
   - **Regla estricta:** Cierre obligatorio de cada intervención con una única pregunta breve de seguimiento.
   - **Firma en cabeceras:** Retorno de `X-App-Author: Israel Montas - Planifica Maestro` en cada respuesta HTTP de chat.

2. **Backend `/api/chat` Multimodal en Cloudflare Worker (`worker/index.js`):**
   - Integración con Google Gemini (`gemini-2.5-flash`) mediante `GEMINI_API_KEY`.
   - Soporte de 3 canales de interacción (`canal`: `"texto"` | `"voz"` | `"imagen"`).
   - En canal `"imagen"`, recibe `imagenBase64` y `mimeType`, procesando el análisis visual con `inlineData` y vinculándolo al currículo MINERD/CON BASE.
   - Consulta a `curriculo_fragmentos` en Supabase para fundamentar con rigor pedagógico oficial.
   - Gestión de caché en `CACHE_KV`: almacenamiento de respuestas frecuentes para texto y voz (etiquetadas con versión de identidad `id-v1.1-plani-maestra`), con bypass automático cuando hay imagen adjunta.

3. **Frontend PWA React + Vite (`client/src/App.jsx`, `client/src/api.js`, `HomeGreeting.jsx`):**
   - Saludo institucional actualizado presentando a "Plani Maestra".
   - Barra inferior unificada con 3 controles: campo de texto, botón de micrófono y botón de cámara/imagen.
   - Reconocimiento de voz vía Web Speech API (`SpeechRecognition` configurado para `es-DO` / `es-419`).
   - Síntesis de voz automática (`window.speechSynthesis`) cuando la entrada fue por voz, más botón de altavoz en cada burbuja de respuesta.
   - Compresión y redimensionado ligero de imágenes en Canvas (máx 1024px, JPEG 0.8) antes de la codificación Base64.
   - Memoria de sesión acotada a los últimos 8 mensajes en estado y almacenamiento volátil.

4. **Sellado Criptográfico e Integridad:**
   - **Commit Base Sellado:** `f8a1382`
   - **Commit de Sellado:** `f47b111`
   - **Resumen Criptográfico del Sello:** `b3443bd257a5f936098fa545e125268747a168aeaf496845186d084bb9280a3a`
   - **Estado Guardia:** 83 archivos protegidos verificados al 100%, 0 violaciones.
   - **Despliegue Producción:** Activo al 100% en Cloudflare Workers (`https://planifica-maestro.israelmontas65.workers.dev`).
