# CONTEXTO DEL PROYECTO: PLANIFICA MAESTRO

## Descripción
Asistente de Planificación Curricular para docentes dominicanos (MINERD). Permite generar, consultar y organizar secuencias didácticas alineadas al diseño curricular dominicano.

## Stack Tecnológico
- **Frontend**: React PWA con Vite.
- **Móvil/Nativo**: Capacitor (iOS/Android).
- **Backend Primario (Producción)**: Cloudflare Workers (`worker/index.js`).
- **Backend Secundario (Desarrollo/Legacy)**: Node.js + Express (`server/index.js`).
- **Base de Datos & Auth**: Supabase (PostgreSQL + RLS).
- **IA**: Gemini (principal), Groq, OpenRouter, Claude. ElevenLabs (Voz).

## Arquitectura y Flujos
1. **Frontend**: Se comunica con el backend a través de endpoints `/api/*`. Utiliza Service Workers para funcionalidad offline y caché PWA.
2. **Backend**: 
   - `worker/` aloja la lógica principal desplegada en la nube perimetral.
   - Maneja la validación de Rate Limits, conexión con Supabase e integraciones con IA (Ojo Digital, Clasificador de Intención, RAG Curricular).
3. **Persistencia**: Los docentes guardan sus planificaciones, perfiles y consumos en Supabase.

## Reglas del Proyecto y Modo Autónomo
- **Autonomía**: El agente se detiene SÓLO si necesita un secreto (claves, accesos dueños) o si falla 2 veces intentando reparar una verificación. Para todo lo demás, elige la vía más segura y reversible, y la documenta en `DECISIONES.md`.
- **Inmutabilidad**: Prohibido refactorizar o reescribir código funcional sin autorización. Cirugía precisa.
- **Continuidad**: Antes de iniciar, leer `CONTEXTO.md`, `PROGRESO.md`, `DECISIONES.md` y `PENDIENTES.md`. Actualizarlos al terminar.
