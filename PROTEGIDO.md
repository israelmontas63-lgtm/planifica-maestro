# INVENTARIO DE COMPONENTES PROTEGIDOS Y CONTRATOS OBSERVABLES
**Planifica Maestro — Sistema Inmutable de Protección de Integridad**

Este documento define el inventario formal de todo lo que funciona hoy en Planifica Maestro. De acuerdo a la **Regla Única**, ningún comportamiento aquí descrito puede ser alterado o roto sin una autorización explícita previa registrada en `AUTORIZACIONES.md`.

---

## 1. Contratos de Rutas API en Cloudflare Worker (`worker/index.js`)

| Ruta | Método | Entrada Esperada | Salida Contractual Observable | Comportamiento Crítico |
| :--- | :--- | :--- | :--- | :--- |
| `/api/health` | `GET` | Headers opcionales (`x-owner-key`) | JSON con `status: "ok"`, `services`, `tablas_disponibles` | Detecta servicios de IA, base de datos y estado de emergencia. |
| `/api/auth/verify` | `GET`/`POST` | Body `{ accessKey }` o header `x-app-key` | JSON `{ ok: true, accessGranted: true, mode: "beta_abierta" \| "institucional" }` | Control de acceso por llave institucional o modo abierto. |
| `/api/plan/generate` y `/api/plan` | `POST` | Body `{ messages, grado, area, tema, stream: true }` | SSE stream (`event: estado`, `event: bloque`, `event: mensaje`, `event: finalizado`) | Streaming bloque a bloque (<4s primer contenido útil), parseo JSON seguro y caché SHA-256. |
| `/api/plan/esquemas` | `GET` | Ninguna | JSON con catálogo de esquemas (MINERD General y CON BASE Multigrado) | Inmutable para el frontend. |
| `/api/plan/cuota` | `GET` | Header `x-docente-id` o IP | JSON `{ restante, total, resetEn, esIlimitado }` | Topes diarios por dispositivo e IP. |
| `/api/chat` | `POST` | Body `{ mensaje, historial }` | JSON con respuesta pedagógica | Respuestas inmediatas a saludos, podado de saludos reiterativos y modo conversacional. |
| `/api/transcribir` | `POST` | Header `x-app-key`, Body `{ audioBase64 }` | JSON `{ ok: true, texto: string }` | Transcripción de voz mediante Whisper Turbo o Gemini multimodal. |
| `/api/imagen/editar` | `POST` | Body `{ imagen, operacionId, instruccion }` | JSON `{ ok: true, imagenProcesada: base64, motorUtilizado }` | Filtro de política de dignidad docente, catálogo de 480 operaciones y fallback a motor local puro. |
| `/api/imagen/identificar` | `POST` | Body `{ imageBase64, mediaType }` | JSON `{ exito: true, identificacion: { etiqueta, descripcion } }` | Ojo Digital: análisis de legibilidad y sugerencias pedagógicas guiadas. |

---

## 2. Esquema Canónico del Plan de Clase (MINERD / CON BASE)
Todo objeto generado por `/api/plan` debe cumplir la siguiente estructura JSON canónica (`shared/parseadorJsonSeguro.js`):
- `mensaje_chat`: Mensaje pedagógico empático dirigido al maestro.
- `plan_completado`: Booleano `true`.
- `datos_planificacion`:
  - `datos_generales`: `{ centro_educativo, docente, grado, seccion, area, fecha, tiempo_estimado, estrategia_ensenanza }`
  - `intencion_pedagogica`: Cadena no vacía orientada al logro del día.
  - `competencias_fundamentales`: Array con competencias fundamentales MINERD.
  - `competencias_especificas`: Array con competencias específicas del grado y área.
  - `contenidos`: `{ conceptuales: [], procedimentales: [], actitudinales: [] }`
  - `indicadores_logro`: Array con indicadores de logro oficiales.
  - `momentos_clase`: `{ inicio: { tiempo, actividades_docente, actividades_alumnos, recursos }, desarrollo: {...}, cierre: {...} }`
  - `evaluacion`: `{ tecnicas, instrumentos }`
  - `adaptaciones_curriculares`: Pautas DUA para atención a la diversidad.
- `confianza_curricular`: `{ nivel, documento_fuente }`

---

## 3. Generación y Exportación Canónica DOCX
- **Archivos:** `server/services/documentGenerator.js`, `shared/construirInformeSupervisionDocx.js`, plantillas en `plantillas/`.
- **Comportamiento Observable:**
  - Genera archivos binarios `.docx` válidos (cabecera ZIP `PK\x03\x04`).
  - Aplica márgenes oficiales de 2.54 cm, tipografía Arial/Calibri, colores institucionales MINERD (#1B365D azul marino).
  - Tablas con celdas alineadas y sombreado para momentos de clase, rúbricas analíticas oficiales (4 niveles de logro: Destacado, Logrado, En Proceso, Incipiente) y listas de cotejo.

---

## 4. Sistema de Cuotas y Bypass de Propietario
- **Rate Limit por Dispositivo:** Límites diarios en memoria y Cloudflare KV (`RATE_LIMIT_KV`).
- **Bypass de Propietario:**
  - Header `x-owner-key` comparado contra `OWNER_MASTER_KEY` con función `timingSafeEqualStr` (inmune a ataques de temporización).
  - Si es válido, el Dueño cuenta con acceso ilimitado sin consumo de cuotas diarias.

---

## 5. Enrutador Inteligente y Clasificador Multicapa
- **Archivo:** `shared/clasificadorIntencion.js` y `worker/clasificadorIntencion.js`.
- **Comportamiento:**
  - Ejecución en **0 ms y $0.00** para patrones deterministas (saludos, acciones de app, ambigüedad).
  - Detección de términos curriculares extranjeros (DBA de Colombia, Aprendizajes Clave de México, NAP de Argentina, OA de Chile) con traducción pedagógica automática al marco MINERD.
  - Podado estricto de saludos innecesarios en turnos posteriores (`limpiarSaludoInnecesario`).

---

## 6. Ojo Digital, Política de Dignidad y Motor Local de Imagen
- **`shared/politicaDignidadImagen.js`:** 120 casos de prueba de dignidad dominicana. Bloquea de forma inmediata prompts denigrantes hacia la labor docente.
- **`shared/catalogoEdicionImagen.js`:** 480 operaciones divididas en 12 categorías pedagógicas.
- **`shared/editorImagenLocalPuro.js`:** 28 transformaciones de píxeles en memoria sin consumo de cuota ni APIs externas.

---

## 7. Arquitectura Cliente PWA
- **Service Worker:** Configurado con Workbox precaching de 88 entradas estáticas.
- **Actualización sin bucles:** Detección de nueva versión y recarga atómica controlada con marca en `sessionStorage` para evitar bucles infinitos.
- **Almacenamiento Local:** IndexedDB / LocalStorage para persistencia offline de planificaciones sin comprometer privacidad.

---

## 8. Catálogo de Archivos Protegidos por Hash Criptográfico
Todos los archivos fuente que componen los 7 bloques anteriores están inventariados en `PROTEGIDO.hashes.json`. Cualquier alteración será abortada por `npm run guardia`.
