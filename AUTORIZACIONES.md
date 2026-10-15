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

