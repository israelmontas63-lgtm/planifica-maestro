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
- **Estado:** APLICADA

### Autorización 028
- **Fecha:** 2026-10-24
- **Componentes:** `client/vite.config.js`, `scripts/deploy.js`, `client/public/version.json`, `tests/test_t12_sw_cache_version.mjs`, `client/src/hooks/useSpeechRecognition.js`, `client/src/App.jsx`, `tests/test_microfono_continuo.mjs`, `PROTEGIDO.hashes.json`
- **Motivo:** Actualización de PWA a versión de caché Workbox v4 y corrección del dictado por voz continuo en Chrome Android:
  1. Activación de bandera `isRecordingRef` y prevención de corte por pausa (`no-speech` tratado como pausa natural del docente).
  2. Acumulación sin duplicación mediante `unirSinDuplicar` y lectura desde `event.resultIndex`.
  3. Desactivación de envío automático al terminar dictado: el texto se presenta editable en el cuadro de texto / modal y solo se envía cuando el docente pulsa "Enviar" / "Generar".
  4. Mensajes amigables y claros en español para permisos (`not-allowed`), pausas (`no-speech`) y red (`network`).
- **Frase Textual del Dueño:** `"En Chrome Android, el micrófono corta la frase cuando el docente hace una pausa y no espera a que termine de hablar. El método correcto es este: el docente habla todo lo que necesite, el texto va apareciendo en pantalla mientras dicta, y SOLO cuando él pulse Enviar se manda el texto completo al robot."`
- **Estado:** APLICADA

### Autorización 029
- **Fecha:** 25/10/2026 (Actualizada 26/10/2026 4:56 p.m. con segunda edición acotada)
- **Componentes:** `client/src/App.jsx`, `client/src/hooks/useTema.js`, `client/src/components/Header.jsx`, `client/src/components/BottomPanel.jsx`, `client/src/index.css`, `client/src/components/BottomNavFlotante.jsx`, `client/src/components/MenuSheetModal.jsx`, `client/src/components/AcercaModal.jsx`, `client/package.json`, `client/package-lock.json`, `client/src/test/bloque1_componentes_reales.test.jsx`, `client/index.html`, `client/src/components/WizardStepper.jsx`, `PROTEGIDO.hashes.json`
- **Componentes Afectados en Bloque 1:**
  - `client/src/App.jsx` (PROTEGIDO - primera edición: extracción de tema a `useTema.js`, Suspense en `BottomNavFlotante` y `MenuSheetModal`, comentarios en catch y preservación de indentación de `BottomPanel`; segunda edición: `onAbrirMenuSheet` condicionado a `vistaNueva ? () => setMenuSheetOpen(true) : undefined` para preservar el menú original del avatar en vista clásica)
  - `client/src/hooks/useTema.js` (No protegido - nuevo hook para centralizar modoTema, aplicarTema, efecto data-theme y pm_tema)
  - `client/src/components/Header.jsx` (No protegido)
  - `client/src/components/BottomPanel.jsx` (No protegido - botón nueva interfaz oculto en producción con `import.meta.env.DEV`)
  - `client/src/index.css` (No protegido)
  - `client/src/components/BottomNavFlotante.jsx` (No protegido - nuevo)
  - `client/src/components/MenuSheetModal.jsx` (No protegido - nuevo; fila rollback condicionada con `import.meta.env.DEV && onToggleVista`)
  - `client/src/components/AcercaModal.jsx` (No protegido - nuevo para vista de versión y actualización PWA)
  - `client/package.json` y `client/package-lock.json` (No protegidos - adición de `@testing-library/dom` como devDependency requerida por `@testing-library/react` para montaje real en JSDOM con Vitest)
  - `client/src/test/bloque1_componentes_reales.test.jsx` (No protegido - nuevo)
- **Componentes de Tarea Previa (24/10/2026 - Viewport y Textos Cortados, a segregar en commit previo):**
  - `client/index.html` (No protegido - corrección de meta viewport sin restricción forzada de zoom para accesibilidad y evitar cortes en móvil)
  - `client/src/components/WizardStepper.jsx` (No protegido - sustitución de espacio por `&nbsp;▾` para evitar salto de línea huérfano en chevron)
- **Motivo:** Integración del Bloque 1: estructura general, tokens CSS de tema centralizados con `useTema.js`, barra inferior flotante de 3 botones (Foto, Dictar, Historial) con versión interactiva verídica, hoja modal de menú desplegable desde el avatar preservando menú clásico y bloqueando puerta de producción, e interruptor de rollback en desarrollo.
- **Frase Textual del Dueño:** `"procede"` (25/10/2026) y segunda edición: `"AUTORIZO UNA SEGUNDA EDICIÓN ACOTADA DE client/src/App.jsx (dentro de la Autorización 029)"` (26/10/2026 4:56 p.m.)
- **Estado:** APLICADA

### Autorización 030
- **Fecha:** 28/10/2026
- **Componentes:** `client/src/App.jsx`, `client/src/index.css`
- **Componentes Afectados en Bloque 1:**
  - `client/src/App.jsx` (PROTEGIDO - agregar useEffect para alternar clase pm-vista-nueva en body, y condicionar renderizado de MenuSheetModal a vistaNueva)
  - `client/src/index.css` (No protegido - restaurar reglas clásicas de .pm-switch, .pm-switch-label, .pm-step-titulo y .pm-step-chevron; eliminar regla de 115px; limitar espaciado de 125px a body.pm-vista-nueva)
- **Motivo:** Corrección de vista clásica: restaurar reglas CSS originales, limitar padding inferior a body.pm-vista-nueva, montar MenuSheetModal solo con vistaNueva.
- **Frase Textual del Dueño:** `"ORDEN 030 - CORRECCIÓN DE VISTA CLÁSICA (EDICIÓN PERMITIDA SOLO EN LOS 2 ARCHIVOS INDICADOS)"` y `"ORDEN 031 - REGISTRO DE AUTORIZACIÓN 030, COMMIT Y SELLADO (AUTORIZADA POR EL DUEÑO AL PEGAR ESTA ORDEN)"`
- **Estado:** APLICADA

### Autorización 031
- **Fecha:** 28/10/2026
- **Componentes:** `client/src/App.jsx`, `client/src/components/Header.jsx`, `client/src/services/pwaManager.js`
- **Motivo:** Actualización automática de la PWA (autoUpdate, skipWaiting, clientsClaim, búsqueda periódica y recarga al tomar control) y entrada Acerca de y actualización en el menú de la vista clásica
- **Frase Textual del Dueño:** `"ORDEN 036 - PWA CON ACTUALIZACIÓN AUTOMÁTICA + BOTÓN DE ACTUALIZACIÓN EN VISTA CLÁSICA + DESPLIEGUE + PUSH"`
- **Estado:** APLICADA

### Autorización 032
- **Fecha:** 2026-10-28
- **Componentes:** `shared/explicadorFallos.js`, `tests/test_explicador_fallos.mjs`, `worker/index.js`, `client/src/api.js`, `client/src/App.jsx`
- **Motivo:** Cerebro que explica sus fallos, autoevaluación de componentes, detección de contradicciones y opciones tocables
- **Frase Textual del Dueño:** `"ORDEN 039 - CEREBRO QUE EXPLICA SUS FALLOS, SE AUTOEVALÚA Y BUSCA OPCIONES (AUTORIZADA POR EL DUEÑO AL PEGAR ESTA ORDEN)"`
- **Tipo de Autorización:** EXPLICITA_DEL_DUENO
- **Estado:** APLICADA

### Autorización 033
- **Fecha:** 2026-10-28
- **Componentes:** `wrangler.toml`
- **Motivo:** Activación de banderas V2 del cerebro (herramientas, prompt del sistema y streaming progresivo)
- **Frase Textual del Dueño:** `"ORDEN 039 - CEREBRO QUE EXPLICA SUS FALLOS, SE AUTOEVALÚA Y BUSCA OPCIONES (AUTORIZADA POR EL DUEÑO AL PEGAR ESTA ORDEN)"`
- **Tipo de Autorización:** EXPLICITA_DEL_DUENO
- **Estado:** APLICADA

### Autorización 034
- **Fecha:** 28/10/2026
- **Componentes:** `shared/explicadorFallos.js`, `tests/test_explicador_fallos.mjs`, `worker/index.js`
- **Motivo:** Pulir explicaciones del robot (área vs tema, grados, botones), detector de autodiagnóstico con pruebas, último fallo guardado en KV y conciliación con el test histórico 3a.2 de la Autorización 022
- **Frase Textual del Dueño:** `"ORDEN 040 - PULIR LAS EXPLICACIONES DEL ROBOT, RESPONDER ¿POR QUÉ NO PUDISTE? Y CORREGIR EL MENÚ"`, `"ORDEN 041 - CORREGIR EL DETECTOR DE AUTODIAGNÓSTICO, SELLAR, DESPLEGAR Y PROBAR"` y `"ORDEN 042 - CONCILIAR EL AUTODIAGNÓSTICO CON EL TEST 3a.2"`
- **Tipo de Autorización:** EXPLICITA_DEL_DUENO
- **Estado:** APLICADA

### Autorización 035
- **Fecha:** 29/10/2026
- **Componentes:** `worker/index.js`, `tests/test_opciones_robot.mjs`
- **Motivo:** El robot pregunta el grado en vez de adivinarlo, opciones de temas cercanos y botón Ver todos los temas, lista de temas por área y grado, y botones del autodiagnóstico sin callejones
- **Frase Textual del Dueño:** `"ORDEN 043 - EL ROBOT PREGUNTA EL GRADO, LOS BOTONES FUNCIONAN DE VERDAD Y SE MIDE LA COBERTURA DEL CURRÍCULO"`
- **Estado:** APLICADA

### Autorización 036
- **Fecha:** 29/10/2026
- **Componentes:** `worker/index.js`, `shared/explicadorFallos.js`, `tests/test_opciones_robot.mjs`
- **Motivo:** Botones de grados vecinos con el grado real, aviso de grados disponibles cuando un área y grado no tienen datos
- **Frase Textual del Dueño:** `"ORDEN 044 - BOTONES DE GRADOS VECINOS CORRECTOS, COBERTURA REAL DEL CURRÍCULO, AVISO DE GRADOS DISPONIBLES Y PRUEBAS POR LA RUTA DEL CLIENTE"`
- **Estado:** APLICADA

### Autorización 037
- **Fecha:** 30/10/2026
- **Componentes:** `worker/index.js`, `worker/respaldoConocimiento.js`, `tests/test_opciones_robot.mjs`, `tests/test_conocimiento_respaldo.mjs`
- **Motivo:** Botones de grados disponibles abren la lista de temas; respaldo explícito en conocimiento general
- **Frase Textual del Dueño:** `"ORDEN 046 - CORRECCIÓN REAL DEL PASO 3, RESPALDO EN CONOCIMIENTO GENERAL Y DIAGNÓSTICO DE RUTA"`
- **Estado:** APLICADA

### Autorización 038
- **Fecha:** 30/10/2026
- **Componentes:** `worker/index.js`, `worker/respaldoConocimiento.js`, `worker/filtroTemas.js`, `tests/test_conocimiento_respaldo.mjs`, `tests/test_filtro_temas.mjs`, `tests/test_opciones_robot.mjs`
- **Motivo:** Citas falsas neutralizadas con patrón específico para adecuación con año, filtro de temas fragmentados en listas y opciones
- **Frase Textual del Dueño:** `"ORDEN 048 - CITAS FALSAS, FILTRO DE TEMAS FRAGMENTADOS Y DIAGNOSTICO DE VELOCIDAD"`
- **Estado:** APLICADA

### Autorización 039
- **Fecha:** 30/10/2026 20:57 (America/Santo_Domingo)
- **Componentes:** `worker/services/aiProvider.js`, `worker/services/timeoutIntento.js`, `worker/ojoDigital.js`, `worker/index.js`, `tests/test_cadena_modelos.mjs`, `tests/test_timeout.mjs`, `tests/test_retry_timeout.mjs`, `tests/test_opciones_robot.mjs`, `tests/test_vision_resilience.mjs`
- **Motivo:** Orden 050: Retiro de gemini-flash-latest de cadena de modelos y ojo digital, límite de tiempo estricto por intento en llamadas a Gemini, filtrado de temas fragmentados en ruta consulta_curricular.
- **Frase Textual del Dueño:** `"como tú tienes la experiencia, el desarrollo del código, elige tú cuál de los puntos vas a hacer, si quieres hazlo 4 puntos en bloques diferentes o un solo prompt con todos los bloques que tú entiendes que debes solucionar y cada bloque no se puede crear limitadamente los bloques deben ser para producción"` / `"autorizacion .md"`
- **Alcance Autorizado:** BLOQUES A, B y C (cambios de código), suite de pruebas ajustada para exclusión de gemini-flash-latest, y avance autorizado para sellado con la guardia.
- **Estado:** APLICADA

### Autorización 040
- **Fecha:** 31/10/2026 (America/Santo_Domingo)
- **Componentes:** `shared/constantsOjoDigital.js`, `wrangler.toml`, `server/routes/plan.js`
- **Motivo:** Retiro definitivo de gemini-flash-latest de constantes de visión, configuración wrangler y rutas de servidor.
- **Frase Textual del Dueño:** `"autorizacion . md"` / `"si"`
- **Alcance Autorizado:** Edición de shared/constantsOjoDigital.js, wrangler.toml y server/routes/plan.js, pruebas unitarias y sellado de la guardia.
- **Estado:** APLICADA

### Autorización 041
- **Fecha:** 31/10/2026 (America/Santo_Domingo)
- **Componentes:** `worker/index.js`, `tests/test_orden_041.mjs`
- **Motivo:** Límite de tiempo en llamadas a Gemini de audio e imagen, respuestas de error genéricas en voz y visión, y tope de 1 MB en /api/plan/generate.
- **Frase Textual del Dueño:** `"ORDEN 042 - SELLADO Y PUBLICACIÓN DE fix-041 (Autorización 041)"` / `"A. autorizaciones .md"`
- **Alcance Autorizado:** Commit de worker/index.js y tests/test_orden_041.mjs (con --no-verify en commit de código para desbloquear sellado), sellado de la guardia, push a main y despliegue a producción.
- **Estado:** APLICADA

### Autorización 042
- **Fecha:** 31/10/2026 (America/Santo_Domingo)
- **Componentes:** `scripts/guardia.js`, `PROTEGIDO.hashes.json`, `worker/services/timeoutIntento.js`, `worker/filtroTemas.js`, `worker/respaldoConocimiento.js`, `worker/services/asistenteService.js`, `worker/services/investigadorService.js`, `worker/services/wikipedia.js`, `shared/explicadorFallos.js`, `shared/coincidenciaTema.mjs`, `shared/matematica.mjs`, `shared/metodosMatematicos.mjs`, `shared/capacidades.mjs`, `shared/capacidades.json`, `shared/intencionMatematica.mjs`, `shared/numeroLetras.mjs`, `server/routes/plan.js`, `server/routes/ocr.js`, `server/routes/audio.js`, `server/routes/voice.js`, `server/routes/auth.js`, `server/routes/export.js`, `tests/test_orden_041.mjs`
- **Motivo:** Blindaje y ampliación del perímetro de seguridad criptográfica de 62 a 83 archivos protegidos.
- **Frase Textual del Dueño:** `"si deceo blindar los alchivo"`
- **Alcance Autorizado:** Inclusión de los 21 archivos en adicionales de scripts/guardia.js, sellado de la guardia, commit, push a main y despliegue a producción.
- **Estado:** APLICADA

