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






