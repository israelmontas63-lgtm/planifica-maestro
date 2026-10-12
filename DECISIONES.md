# DECISIONES TÉCNICAS Y ARQUITECTÓNICAS

## Fase 0: Auditoría y Setup Autónomo
- **Decisión**: Se implementó el protocolo de memoria del proyecto (CONTEXTO.md, PROGRESO.md, DECISIONES.md, PENDIENTES.md) para habilitar el Modo Autónomo.
- **Motivo**: Requerimiento para garantizar la continuidad entre sesiones y evitar bloqueos innecesarios.
- **Decisión H3**: El dueño decidió conservar las claves quemadas en los .env.example del repositorio bajo riesgo aceptado. Se sanitizaron los archivos .env.example locales sin reescribir el historial de Git.

## Bloque 0: Seguridad y Estabilidad
- **Decisión (H5 - Rate Limit)**: Se migró el rate limit de memoria a Cloudflare KV distribuido (RATE_LIMIT_KV), manteniendo un fallback transparente a Map() en memoria si el binding KV no está disponible o falla temporalmente.
- **Motivo**: Evitar que cada instancia perimetral efímera reinicie el conteo y permitir límites compartidos entre réplicas.
- **Decisión (H6 - Llave Dueño)**: pm_owner_key se almacena exclusivamente en sessionStorage (volátil por pestaña/sesión), eliminando cualquier persistencia residual en localStorage.
- **Motivo**: Reducir la superficie de ataque ante scripts de terceros o inspección física de dispositivos compartidos.
- **Decisión (H7 - Capacitor)**: Se eliminó capacitor.config.json duplicado, conservando únicamente capacitor.config.ts como fuente única de verdad tipada.

## Bloque 1: Deuda Técnica y Optimización
- **Decisión (Unificación Canónica en shared/)**: Se extrajo toda la lógica compartida (parseador JSON, constantes Ojo Digital, clasificador de intención, corrector de texto y modo conversacional) hacia el directorio central shared/. Se crearon fachadas transparentes en worker/, server/ y client/ para mantener 100% de compatibilidad hacia atrás.
- **Motivo**: Eliminar más de 2,400 líneas de código duplicado manteniendo compatibilidad con Node.js v24 (require() nativo de ESM) y Cloudflare Workers.
- **Decisión (Dependencia docx)**: Se unificó docx en versión ^9.7.1 tanto en la raíz como en el cliente y servidor, resolviendo la rotura de prepForXml mediante el uso correcto del constructor estándar.
- **Motivo**: Paridad total entre entornos y eliminación de advertencias de versiones divergentes.
- **Decisión (Higiene de Clon Limpio y Aislamiento de Pruebas)**:
  1. Se añadió server/data/.gitkeep y se configuró .gitignore para registrar el directorio sin versionar datos volátiles.
  2. Se añadió 'server' a workspaces en el package.json raíz.
  3. En tests/test_con_base_multigrado.mjs, se utilizó os.tmpdir() para generar el archivo Word de prueba con eliminación automática tras la verificación.
- **Motivo**: Evitar que la ejecución de pruebas ensucie el árbol de trabajo git con archivos binarios de muestra.
- **Decisión (Límite IP en Escuelas)**: Se parametrizó RATE_LIMIT_ANONIMO_DIARIO = '50' (ajustable por variable de entorno) para prevenir que múltiples docentes en la misma red escolar agoten la cuota diaria prematuramente.
- **Decisión (Modo Offline en Aulas Rurales)**: La PWA almacena planificaciones y perfiles directamente en el dispositivo (localStorage) y encola ajustes para sincronización automática cuando el dispositivo detecta el evento online.

## Bloque 12: Multiusuario Institucional y Supervisión Pedagógica
- **Decisión (Aislamiento RLS y Estados Canónicos)**:
  1. Los borradores (`borrador`) son de estricta privacidad del docente autor (`(select auth.uid()) = docente_id`).
  2. Los coordinadores y directores únicamente tienen acceso de lectura a planes explícitamente enviados a revisión (`enviada_revision`, `aprobada`, `observada`) pertenecientes a su misma escuela (`escuela_id`).
  3. Los estados del dictamen del coordinador se estandarizaron como `aprobada`, `requiere_ajustes` y `sugerencias`, incorporando retroalimentación de momentos de clase (Inicio, Desarrollo, Cierre) y pautas DUA para atención a la diversidad (NEAE).
- **Decisión (Carga Diferida y Resiliencia Offline)**:
  1. `PanelCoordinacionModal.jsx` se empaqueta como chunk diferido (`React.lazy`), garantizando 0 KB de impacto en el primer renderizado de la PWA para docentes.
  2. El servicio `coordinacionService.js` opera de manera transparente tanto conectado a Supabase como en modo local offline, permitiendo que docentes y supervisores en zonas sin conectividad estable continúen trabajando sin interrupciones.
