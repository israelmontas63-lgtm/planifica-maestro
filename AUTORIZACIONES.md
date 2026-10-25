# BITÁCORA FORMAL DE AUTORIZACIONES DEL PROPIETARIO
**Planifica Maestro — Registro de Modificaciones Autorizadas**

> Este documento es la única fuente de verdad reconocida por `npm run guardia`.
> Ningún archivo protegido puede ser modificado sin estar previamente registrado aquí con fecha, componente, motivo y frase textual de autorización del Dueño.

---

## Registro de Autorizaciones

### Autorización 001
- **Fecha:** 2026-10-13
- **Componente:** `tests/test_transcribir_audio.mjs`
- **Motivo:** Sustitución de credenciales fijas por lectura segura de variables de entorno para evitar exposición de claves en código de pruebas.
- **Frase Textual del Dueño:** `"Autorizo modificar tests/test_transcribir_audio.mjs para que lea la clave del entorno."`
- **Estado:** APLICADA

### Autorización 002
- **Fecha:** 2026-10-13
- **Componente:** `worker/index.js` y `worker/services/aiProvider.js`
- **Motivo:** Enviar la clave de Gemini por cabecera HTTP `x-goog-api-key` en lugar del parámetro URL `?key=`, evitando exposición de claves en logs de red y URLs de peticiones.
- **Frase Textual del Dueño:** `"Autorizo modificar el worker SOLO para enviar la clave de Gemini por cabecera x-goog-api-key en vez de ?key=."`
- **Estado:** APLICADA

### Autorización 003
- **Fecha:** 2026-10-13
- **Componente:** Sistema de Protección (`PROTEGIDO.md`, `PROTEGIDO.hashes.json`, `AUTORIZACIONES.md`, `scripts/guardia.js`, hooks y `package.json`)
- **Motivo:** Implementación del sistema inmutable de guardia para blindar el repositorio contra regresiones o modificaciones no autorizadas.
- **Frase Textual del Dueño:** `"Autorizo crear PROTEGIDO.md, PROTEGIDO.hashes.json, AUTORIZACIONES.md, script de guardia y hooks."`
- **Estado:** APLICADA

### Autorización 004
- **Fecha:** 2026-10-14
- **Componente:** `shared/herramientasCerebro.js`
- **Motivo:** Eliminación del stub consultar_curriculo_minerd y unificación en consultar_base_datos según Fase 4 del Sistema Curricular Real.
- **Frase Textual del Dueño:** `"En shared/herramientasCerebro.js, eliminar el stub consultar_curriculo_minerd dejando consultar_base_datos como única herramienta"`
- **Estado:** APLICADA

### Autorización 005
- **Fecha:** 2026-10-15
- **Componente:** `worker/cacheRespuestas.js`
- **Motivo:** Eliminación de bloques catch vacíos para evitar silenciar errores y trazabilidad diagnóstica según ORDEN DIRECTA.
- **Frase Textual del Dueño:** `"Elimina todos los catch vacíos (grep -rn "catch *([a-zA-Z]*) *{ *}" worker/ shared/) y pega el grep antes y después."`
- **Estado:** APLICADA

### Autorización 006
- **Fecha:** 2026-10-15
- **Componente:** `shared/clasificadorIntencion.js`
- **Motivo:** Eliminación de bloques catch vacíos para evitar silenciar errores y trazabilidad diagnóstica según ORDEN DIRECTA.
- **Frase Textual del Dueño:** `"Elimina todos los catch vacíos (grep -rn "catch *([a-zA-Z]*) *{ *}" worker/ shared/) y pega el grep antes y después."`
- **Estado:** APLICADA

### Autorización 007
- **Fecha:** 2026-10-15
- **Componente:** `shared/parseadorJsonSeguro.js`
- **Motivo:** Eliminación de bloques catch vacíos para evitar silenciar errores y trazabilidad diagnóstica según ORDEN DIRECTA.
- **Frase Textual del Dueño:** `"Elimina todos los catch vacíos (grep -rn "catch *([a-zA-Z]*) *{ *}" worker/ shared/) y pega el grep antes y después."`
- **Estado:** APLICADA

### Autorización 008
- **Fecha:** 2026-10-16
- **Componente:** `shared/modoConversacional.js`
- **Motivo:** Saneamiento de nombre de docente contra inyecciones y caracteres extraños, puntuación española correcta (¡! y ¿?) y omisión de marcadores genéricos visibles cuando no hay nombre según T5.
- **Frase Textual del Dueño:** `"T5. Nombre de docente: sanear contra inyecciones y caracteres extraños (longitud <= 50, sin saltos de línea ni caracteres de control); signos ¡! y ¿? correctos en español. Si no hay nombre, no inventar ninguno ni usar marcadores genéricos visibles."`
- **Estado:** APLICADA

### Autorización 009
- **Fecha:** 2026-10-16
- **Componente:** `server/ia/modoConversacional.js`
- **Motivo:** Exportación de fachada de sanearNombreDocente según T5.
- **Frase Textual del Dueño:** `"T5. Nombre de docente: sanear contra inyecciones y caracteres extraños (longitud <= 50, sin saltos de línea ni caracteres de control); signos ¡! y ¿? correctos en español. Si no hay nombre, no inventar ninguno ni usar marcadores genéricos visibles."`
- **Estado:** APLICADA

### Autorización 010
- **Fecha:** 2026-10-16
- **Componente:** `client/src/api.js`
- **Motivo:** Preservar causa y diagnóstico devuelto por el worker en el fallback de error sin sobreescribir con mensaje genérico según T10.
- **Frase Textual del Dueño:** `"T10. Cliente: el fallback de error debe mostrar la causa devuelta por el worker (si la hay) y no sobreescribir siempre con 'Tuve dificultades para organizar los componentes...'."`
- **Estado:** APLICADA

### Autorización 011
- **Fecha:** 2026-10-16
- **Componente:** `scripts/guardia.js`, `PROTEGIDO.hashes.json`, `shared/parseadorJsonSeguro.js`, `client/src/api.js`, `worker/index.js`, `client/vite.config.js`, `client/src/utils/parseadorJsonSeguro.js`, `shared/modoConversacional.js`, `scripts/prueba_real_gemini.mjs`
- **Motivo:** Reparación integral de auditoría del 16/10/2026 (guardia por hash y ruta completa, eliminación de catch vacíos, formateador de consulta curricular sin duplicados ni coma-punto, cliente api.js y pruebas de aceptación canónicas) y cierre de pendientes R0-bis.
- **Frase Textual del Dueño:** `"Autorizo modificar scripts/guardia.js, PROTEGIDO.hashes.json, shared/parseadorJsonSeguro.js, client/src/api.js y el formateador de consulta curricular para reparar los fallos de la auditoría del 16/10/2026."` y `"Autorizo revisar y, si hace falta, corregir client/vite.config.js, client/src/utils/parseadorJsonSeguro.js, shared/modoConversacional.js y scripts/prueba_real_gemini.mjs, y registrar su cobertura en la guardia, para cerrar los pendientes de la auditoría del 16/10/2026."`
- **Estado:** APLICADA

### Autorización 012
- **Fecha:** 2026-10-16
- **Componentes:** `scripts/verificar_supabase.mjs`, `scripts/verificar_cerebro.mjs`, `wrangler.toml`, `docs/RUNBOOK_SUPABASE.md`, `docs/RUNBOOK_DESPLIEGUE.md`, `supabase/migrations/20261016_buscar_curriculo_secuencias.sql`, `tests/test_f3_tool_calling_stream.mjs`, `worker/index.js`
- **Motivo:** Conexión y verificación de las 11 capas del cerebro, scripts de verificación de Supabase y cerebro, configuración de entorno staging en wrangler.toml sin desplegar ni tocar producción.
- **Frase Textual del Dueño:** `"Autorizo crear scripts de verificación, la configuración de staging en wrangler.toml y los ajustes mínimos de código necesarios para conectar las capas del cerebro, sin desplegar ni tocar producción."`
- **Estado:** APLICADA

### Autorización 013
- **Fecha:** 2026-10-17
- **Componentes:** `package.json`, `scripts/guardia.js`, `shared/modoConversacional.js`, `worker/index.js`, `scripts/verificar_cerebro.mjs`, `wrangler.toml`, `docs/RUNBOOK_SUPABASE.md`, `docs/RUNBOOK_DESPLIEGUE.md`, `scripts/verificar_supabase.mjs`
- **Motivo:** Cierre de hallazgos de la revisión del 17/10/2026 (restauración y garantía del pipeline de npm test, eliminación de autosellado en guardia.js con diff previo y confirmación explícita, cálculo de saludo por franja horaria Santo Domingo con reloj inyectable, traza real acumulada de las 11 capas en verificar_cerebro.mjs con aserciones y pruebas de mutación, corrección de runbooks y homologación de migraciones).
- **Frase Textual del Dueño:** `"Autorizo corregir package.json, scripts/guardia.js, el cálculo de la hora del saludo, scripts/verificar_cerebro.mjs, wrangler.toml y los runbooks, para cerrar los hallazgos de la revisión del 17/10/2026."`
- **Estado:** APLICADA

### Autorización 014
- **Fecha:** 2026-10-19
- **Componentes:** `scripts/deploy.js`, `shared/clasificadorIntencion.js`, `shared/herramientas.mjs`, `shared/modoConversacional.js`, `shared/promptSistemaV2.js`, `worker/index.js`, `tests/test_e1_cerebro_experto.mjs`
- **Motivo:** Implementación del Cerebro Pedagógico Experto (E1): Bloque de criterio experto MINERD, Bloom y competencias en prompts V2 y conversacional; clasificación de 20 casos pedagógicos + 6 controles; filtro estricto de secuencias por `coincide_tema` en streaming y citas; traza directa de capas 5 y 6; manejo de quejas sin saludo horario; ruta ambigua para cambios de actividades solicitando planificación; consulta sin grado solicitando 1.° a 6.° sin consultar RPC; flag `--keep-vars` en script de deploy.
- **Frase Textual del Dueño:** `"proede"`
- **Estado:** APLICADA

### Autorización 015
- **Fecha:** 2026-10-20
- **Componentes:** `shared/clasificadorIntencion.js`, `shared/modoConversacional.js`, `tests/test_apoyo_docente_015.mjs`, `DESPLIEGUE.md`
- **Motivo:** El desahogo docente y el pedido de actividad para dos grados caen en "ambigua" (confianza 0.45) y devuelven el mensaje genérico de worker/index.js línea 1780.
- **Frase Textual del Dueño:** `"Autorizo la Autorización 015: cambios en shared/clasificadorIntencion.js, shared/modoConversacional.js, tests/test_apoyo_docente_015.mjs y DESPLIEGUE.md."`
- **Estado:** APLICADA

### Autorización 016
- **Fecha:** 2026-10-20
- **Componentes:** `shared/curriculoService.mjs`, `worker/index.js`, `tests/test_limpieza_consulta_016.mjs`, `scripts/prueba_aceptacion_6_mensajes.mjs`, `scripts/prueba_real_gemini.mjs`
- **Motivo:** Corrección de caso b2 mediante limpieza de consulta curricular previa a RPC (eliminación de interrogativas, términos de sistema, áreas, grados y palabras vacías para evitar falsos positivos con OR de FTS en PostgreSQL), condicionamiento estricto del aviso de borrador a la inyección efectiva de fragmentos verificados, homologación de script de aceptación de 6 mensajes y parametrización del modelo Gemini con fallback a gemini-3.1-flash-lite.
- **Frase Textual del Dueño:** `"Autorizo la Autorización 016: cambios en shared/curriculoService.mjs, worker/index.js, tests/test_limpieza_consulta_016.mjs, scripts/prueba_aceptacion_6_mensajes.mjs y scripts/prueba_real_gemini.mjs."`
- **Estado:** APLICADA

### Autorización 017
- **Fecha:** 2026-10-21
- **Componentes:** `shared/catalogoCurricular.mjs`, `shared/catalogoCurricular.test.mjs`, `worker/index.js`, `scripts/curriculo/extraer_por_columnas.mjs`, `scripts/curriculo/salida/nuevas_secuencias_v2.json`, `tests/test_filtro_plantilla_curriculo_017.mjs`
- **Motivo:** Extractor calibrado por columnas, 78 secuencias curriculares oficiales v2 en Supabase sin texto inventado, soporte de 8 áreas y aulas multigrado en catalogoCurricular.mjs, integración en worker/index.js con filtrado estricto de plantillas sintéticas en pantalla y streaming SSE con tope de 1500 caracteres.
- **Frase Textual del Dueño:** `"procede"`
- **Estado:** APLICADA

### Autorización 019
- **Fecha:** 2026-10-21
- **Componentes:** `shared/curriculoService.mjs`, `tests/test_b2_b4_forense.mjs`, `PROTEGIDO.hashes.json`
- **Motivo:** Verificación forense y corrección en rama: propagación de límite en RPC (p_limite hasta 25 para listar todos los temas curriculares sin truncar a 5) y suite de pruebas unitarias forenses B2-B4.
- **Frase Textual del Dueño:** `"AUTORIZACIÓN 019 (DEL DUEÑO, LIMITADA): (1) commits y push a feat/curriculo-real, sin force; (2) PATCH sobre filas del informe SOLO para restaurar tema, pagina, estado_validacion, version_curricular y huella al estado de backup_pre_018_secuencias_completas.json"`
- **Estado:** APLICADA

### Autorización 025
- **Fecha:** 2026-10-22
- **Componentes:** `client/vite.config.js`, `tests/test_t12_sw_cache_version.mjs`, `PROTEGIDO.hashes.json`
- **Motivo:** Actualización de PWA incrementando la versión de caché de Workbox a v3 para forzar la invalidación limpia de assets en navegadores cliente.
- **Frase Textual del Dueño:** `"actuliza la pwa" - "Incrementar la versión de caché de Workbox (v3) y recompilar antes de desplegar"`
- **Estado:** APLICADA

### Autorización 026
- **Fecha:** 2026-10-24
- **Componentes:** `shared/clasificadorIntencion.js`, `shared/matematica.mjs`, `worker/index.js`, `worker/verificadorCitas.js`, `server/curriculum/verificadorCitas.js`, `PROTEGIDO.hashes.json`
- **Motivo:** Corrección de anomalías residuales de Cierre 025: soporte de rangos de páginas en verificador de citas (`extraerPaginasDeFragmentos`), rechazo de seguridad determinista ante peticiones de claves de API/tokens (`B24`, `B24b`), rechazo de invención de ordenanzas oficiales (`B25`), respuesta en inglés para consultas en inglés (`B11`) y soporte de operadores verbales ('más', 'menos', 'por', 'entre') en tutor matemático.
- **Estado:** APLICADA

### Autorización 027
- **Fecha:** 2026-10-24
- **Componentes:** `scripts/deploy.js`, `worker/index.js`, `tests/test_t11_health.mjs`, `client/src/components/ErrorBoundary.jsx`, `client/vite.config.js`, `client/src/App.jsx`, `client/public/version.json`, `PROTEGIDO.hashes.json`
- **Motivo:** Implementación de las 8 mejoras prioritarias:
  1. `/version.json` verídico con commit hash, fecha, `cache_version: "planifica-maestro-v3"`, `build_id` y cabeceras estrictas no-cache.
  2. `/api/health` separando 'vivo' de 'listo': HTTP 503 cuando la base de datos está en memoria o en degradación, soporte de `?readiness=1` reportando `curriculo_filas` (156 secuencias en Supabase) preservando compatibilidad con `test_t11_health.mjs`.
  3. Diagnóstico claro en `ErrorBoundary.jsx` con código de error, tipología de fallo y botón no destructivo de reintento de componente sin perder datos.
  4. PWA manifest calibrado a `lang: "es-DO"` y renderizado de banner visible de actualización en `App.jsx`.
- **Frase Textual del Dueño:** `"Mejoras, por prioridad: Que /version.json y /api/health digan la verdad... Separar “vivo” de “listo”... Pasar el SQL pendiente... Service worker con estrategia clara..."` (Aprobación formal del Implementation Plan).
- **Estado:** EN PROCESO

