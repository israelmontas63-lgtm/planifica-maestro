# DECISIONES TÉCNICAS Y ARQUITECTÓNICAS

## Fase 0 - Auditoría y Setup Autónomo
- **Decisión**: Se implementó el protocolo de memoria del proyecto (`CONTEXTO.md`, `PROGRESO.md`, `DECISIONES.md`, `PENDIENTES.md`) para habilitar el Modo Autónomo.
- **Motivo**: Requerimiento estricto del usuario para garantizar la continuidad entre sesiones y evitar bloqueos innecesarios.
- **Decisión**: Los hallazgos de la auditoría de seguridad y dependencias se categorizaron y movieron al `PENDIENTES.md` bajo "Bloque 0".
- **Motivo**: Tratar los problemas de seguridad detectados (RLS, Rate Limit, vulnerabilidades npm) antes de añadir nuevas funcionalidades.
