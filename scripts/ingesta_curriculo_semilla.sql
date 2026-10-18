-- =============================================================================
-- SCRIPT DE INGESTA DE DATOS CURRICULARES MINERD (NO EJECUTADO EN MIGRACIONES)
-- Procedencia: Adecuación Curricular Nivel Primario (MINERD 2023)
-- NOTA: Este script requiere validación previa de tomo y página oficial antes de su ejecución.
-- =============================================================================

INSERT INTO public.curriculo_secuencias (
    source_id, nivel, ciclo, grado_num, area, tema, bloque_guia, competencias_especificas,
    contenidos_texto_original, indicadores_logro, fuente_documento, version_curricular, pagina, estado_validacion, huella
) VALUES 
(
    'SEC-PRI-2-ESP-001', 'Primario', 'Primer Ciclo', 2, 'Lengua Española',
    'La Noticia', 'Secuencia 1',
    'Comprende noticias sencillas que escucha sobre acontecimientos escolares y comunitarios.',
    'Estructura de la noticia: titular, cuerpo, fecha y lugar.',
    '["Identifica el hecho ocurrido en la noticia escuchada.", "Distingue la fecha y lugar del acontecimiento."]'::jsonb,
    'Adecuación Curricular Nivel Primario (MINERD)', '2023', '75', 'pendiente_validacion', 'huella-sec-pri-2-esp-001'
),
(
    'SEC-PRI-2-ESP-002', 'Primario', 'Primer Ciclo', 2, 'Lengua Española',
    'El Documento de Identidad', 'Secuencia 2',
    'Produce de forma escrita su documento de identidad con sus nombres, apellidos y fecha de nacimiento.',
    'Uso de mayúsculas en nombres propios y función de la tarjeta de identidad.',
    '["Escribe sus nombres y apellidos correctamente.", "Reconoce los datos personales en la tarjeta de identidad."]'::jsonb,
    'Adecuación Curricular Nivel Primario (MINERD)', '2023', '78', 'pendiente_validacion', 'huella-sec-pri-2-esp-002'
),
(
    'SEC-PRI-2-MAT-001', 'Primario', 'Primer Ciclo', 2, 'Matemática',
    'Adición de números naturales', 'Bloque 1',
    'Resuelve problemas cotidianos utilizando adiciones con números naturales de hasta tres dígitos.',
    'Algoritmo de la suma con y sin reagrupación.',
    '["Aplica el algoritmo estándar de la adición.", "Modela sumas con material concreto y en la recta numérica."]'::jsonb,
    'Adecuación Curricular Nivel Primario (MINERD)', '2023', '118', 'pendiente_validacion', 'huella-sec-pri-2-mat-001'
)
ON CONFLICT (source_id) DO NOTHING;
