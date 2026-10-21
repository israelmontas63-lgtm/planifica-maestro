-- =============================================================================
-- ARCHIVO CONSOLIDADO: ESQUEMA CURRICULAR MINERD Y DATOS OFICIALES
-- Generado para ejecucion directa en SQL Editor de Supabase
-- Proyecto: obcjdxearmmvtihfmtaa (Planifica Maestro)
-- =============================================================================

-- 1. MIGRACION CANONICA: ESQUEMA, TABLA, INDICES, RLS Y FUNCIONES
-- =============================================================================
-- MIGRACIÓN CANÓNICA: CURRÍCULO SECUENCIAS MINERD (DISEÑO A)
-- Tabla public.curriculo_secuencias y función public.buscar_curriculo_secuencias
-- Idempotente: puede ejecutarse repetidas veces sin error.
-- =============================================================================

-- 0. Verificación previa de seguridad
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'curriculo_secuencias'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
              AND table_name = 'curriculo_secuencias' 
              AND column_name = 'source_id'
        ) THEN
            RAISE EXCEPTION 'La tabla public.curriculo_secuencias ya existe pero con una estructura incompatible (falta columna source_id). Abortando.';
        END IF;
    END IF;
END $$;

-- 1. Habilitar extensión unaccent y configuración es_sin_tildes
CREATE EXTENSION IF NOT EXISTS unaccent;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgname = 'es_sin_tildes') THEN
        CREATE TEXT SEARCH CONFIGURATION es_sin_tildes (COPY = spanish);
        ALTER TEXT SEARCH CONFIGURATION es_sin_tildes
            ALTER MAPPING FOR word, hword, hword_part
            WITH unaccent, spanish_stem;
    END IF;
END $$;

-- 2. Función inmutable para convertir arreglo JSONB a texto en FTS
CREATE OR REPLACE FUNCTION public.jsonb_array_to_text(arr jsonb)
RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = ''
AS $$
    SELECT coalesce(string_agg(elem, ' '), '')
    FROM (
        SELECT jsonb_array_elements_text(arr) AS elem
    ) s
$$;

-- 3. Función trigger para actualizado_en
CREATE OR REPLACE FUNCTION public.trg_actualizado_en_curriculo_secuencias()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    NEW.actualizado_en = now();
    RETURN NEW;
END;
$$;

-- 4. Tabla canónica public.curriculo_secuencias
CREATE TABLE IF NOT EXISTS public.curriculo_secuencias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id TEXT NOT NULL,
    nivel TEXT NOT NULL CHECK (nivel IN ('Inicial', 'Primario', 'Secundario')),
    ciclo TEXT NOT NULL CHECK (ciclo IN ('Primer Ciclo', 'Segundo Ciclo')),
    grado_num SMALLINT NOT NULL CHECK (grado_num BETWEEN 1 AND 6),
    area TEXT NOT NULL,
    tema TEXT NOT NULL,
    bloque_guia TEXT,
    competencias_especificas TEXT NOT NULL,
    contenidos_texto_original TEXT,
    indicadores_logro JSONB NOT NULL CHECK (jsonb_typeof(indicadores_logro) = 'array'),
    fuente_documento TEXT NOT NULL,
    version_curricular TEXT NOT NULL,
    pagina TEXT,
    url_fuente TEXT,
    estado_validacion TEXT NOT NULL CHECK (estado_validacion IN ('pendiente_validacion', 'requiere_revision_fuente', 'validado')),
    vigente BOOLEAN NOT NULL DEFAULT true,
    huella TEXT NOT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_curriculo_secuencias_source_id UNIQUE (source_id),
    CONSTRAINT chk_coherencia_primaria CHECK (
        nivel <> 'Primario' 
        OR (ciclo = 'Primer Ciclo' AND grado_num BETWEEN 1 AND 3) 
        OR (ciclo = 'Segundo Ciclo' AND grado_num BETWEEN 4 AND 6)
    )
);

-- Columna generada de búsqueda FTS ponderada sin tildes (es_sin_tildes)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'curriculo_secuencias' 
          AND column_name = 'fts_vector'
    ) THEN
        ALTER TABLE public.curriculo_secuencias 
        ADD COLUMN fts_vector TSVECTOR GENERATED ALWAYS AS (
            setweight(to_tsvector('es_sin_tildes', coalesce(tema, '')), 'A') ||
            setweight(to_tsvector('es_sin_tildes', coalesce(competencias_especificas, '') || ' ' || public.jsonb_array_to_text(indicadores_logro)), 'B') ||
            setweight(to_tsvector('es_sin_tildes', coalesce(contenidos_texto_original, '')), 'C')
        ) STORED;
    END IF;
END $$;

-- 5. Índices
CREATE INDEX IF NOT EXISTS idx_curriculo_secuencias_fts 
    ON public.curriculo_secuencias USING gin (fts_vector);

CREATE INDEX IF NOT EXISTS idx_curriculo_secuencias_filtros 
    ON public.curriculo_secuencias (nivel, grado_num, area) 
    WHERE vigente;

CREATE INDEX IF NOT EXISTS idx_curriculo_secuencias_source_id 
    ON public.curriculo_secuencias (source_id);

-- 6. Trigger actualizado_en (sin WHEN por incompatibilidad de PostgreSQL con columnas generadas en triggers de fila completa, error 42P17)
DROP TRIGGER IF EXISTS set_actualizado_en_curriculo_secuencias ON public.curriculo_secuencias;
CREATE TRIGGER set_actualizado_en_curriculo_secuencias
    BEFORE UPDATE ON public.curriculo_secuencias
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_actualizado_en_curriculo_secuencias();

-- 7. RLS y Permisos
ALTER TABLE public.curriculo_secuencias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "curriculo_secuencias_select_public" ON public.curriculo_secuencias;
CREATE POLICY "curriculo_secuencias_select_public"
    ON public.curriculo_secuencias
    FOR SELECT TO anon, authenticated
    USING (vigente);

GRANT SELECT ON public.curriculo_secuencias TO anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.curriculo_secuencias FROM anon, authenticated;

-- 8. Función RPC canónica de búsqueda
CREATE OR REPLACE FUNCTION public.buscar_curriculo_secuencias(
    p_nivel TEXT,
    p_grado SMALLINT,
    p_area TEXT,
    p_consulta TEXT,
    p_limite INT DEFAULT 5
)
RETURNS TABLE (
    source_id TEXT,
    tema TEXT,
    grado_num SMALLINT,
    area TEXT,
    bloque_guia TEXT,
    competencias_especificas TEXT,
    contenidos_texto_original TEXT,
    indicadores_logro JSONB,
    fuente_documento TEXT,
    version_curricular TEXT,
    pagina TEXT,
    estado_validacion TEXT,
    coincide_tema BOOLEAN,
    relevancia REAL
)
LANGUAGE sql STABLE
SECURITY INVOKER
SET search_path = public AS $$
    WITH raw_q AS (
        SELECT plainto_tsquery('es_sin_tildes', coalesce(p_consulta, ''))::text AS q_text
    ),
    q AS (
        SELECT 
            CASE 
                WHEN q_text IS NOT NULL AND trim(q_text) <> '' THEN 
                    replace(q_text, '&', '|')::tsquery 
                ELSE NULL 
            END AS tsq
        FROM raw_q
    ),
    evaluados AS (
        SELECT 
            f.source_id,
            f.tema,
            f.grado_num,
            f.area,
            f.bloque_guia,
            f.competencias_especificas,
            f.contenidos_texto_original,
            f.indicadores_logro,
            f.fuente_documento,
            f.version_curricular,
            f.pagina,
            f.estado_validacion,
            CASE 
                WHEN (SELECT tsq FROM q) IS NOT NULL AND f.fts_vector @@ (SELECT tsq FROM q) THEN true
                ELSE false
            END AS coincide_tema,
            CASE 
                WHEN (SELECT tsq FROM q) IS NOT NULL AND f.fts_vector @@ (SELECT tsq FROM q) THEN ts_rank_cd(f.fts_vector, (SELECT tsq FROM q))
                ELSE 0.0::REAL
            END AS relevancia
        FROM public.curriculo_secuencias f
        WHERE f.vigente
          AND f.nivel = p_nivel
          AND f.grado_num = p_grado
          AND f.area = p_area
    )
    SELECT 
        e.source_id,
        e.tema,
        e.grado_num,
        e.area,
        e.bloque_guia,
        e.competencias_especificas,
        e.contenidos_texto_original,
        e.indicadores_logro,
        e.fuente_documento,
        e.version_curricular,
        e.pagina,
        e.estado_validacion,
        e.coincide_tema,
        e.relevancia
    FROM evaluados e
    ORDER BY e.coincide_tema DESC, e.relevancia DESC, e.source_id ASC
    LIMIT least(greatest(p_limite, 1), 5);
$$;

GRANT EXECUTE ON FUNCTION public.buscar_curriculo_secuencias(TEXT, SMALLINT, TEXT, TEXT, INT) TO anon, authenticated;

-- 9. Alias retrocompatible buscar_curriculo para clientes existentes
CREATE OR REPLACE FUNCTION public.buscar_curriculo(
    p_nivel TEXT,
    p_grado SMALLINT,
    p_area TEXT,
    p_consulta TEXT,
    p_limite INT DEFAULT 5
)
RETURNS TABLE (
    source_id TEXT,
    tema TEXT,
    grado_num SMALLINT,
    area TEXT,
    bloque_guia TEXT,
    competencias_especificas TEXT,
    contenidos_texto_original TEXT,
    indicadores_logro JSONB,
    fuente_documento TEXT,
    version_curricular TEXT,
    pagina TEXT,
    estado_validacion TEXT,
    coincide_tema BOOLEAN,
    relevancia REAL
)
LANGUAGE sql STABLE
SECURITY INVOKER
SET search_path = public AS $$
    SELECT * FROM public.buscar_curriculo_secuencias(p_nivel, p_grado, p_area, p_consulta, p_limite);
$$;

GRANT EXECUTE ON FUNCTION public.buscar_curriculo(TEXT, SMALLINT, TEXT, TEXT, INT) TO anon, authenticated;



-- 2. RESTAURACION DE FUNCION CANONICA FTS CON RANKING
-- =============================================================================
-- RESTAURACIÓN DE FUNCIÓN CANÓNICA FTS: buscar_curriculo_secuencias (2026-10-18)
-- Motivo: 20261016 redefine la función con ILIKE degradando la búsqueda curricular.
-- Esta migración restaura la versión FTS canónica con ranking ts_rank_cd.
-- Idempotente: debe aplicarse siempre después de 20261016.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.buscar_curriculo_secuencias(
    p_nivel TEXT,
    p_grado SMALLINT,
    p_area TEXT,
    p_consulta TEXT,
    p_limite INT DEFAULT 5
)
RETURNS TABLE (
    source_id TEXT,
    tema TEXT,
    grado_num SMALLINT,
    area TEXT,
    bloque_guia TEXT,
    competencias_especificas TEXT,
    contenidos_texto_original TEXT,
    indicadores_logro JSONB,
    fuente_documento TEXT,
    version_curricular TEXT,
    pagina TEXT,
    estado_validacion TEXT,
    coincide_tema BOOLEAN,
    relevancia REAL
)
LANGUAGE sql STABLE
SECURITY INVOKER
SET search_path = public AS $$
    WITH raw_q AS (
        SELECT plainto_tsquery('es_sin_tildes', coalesce(p_consulta, ''))::text AS q_text
    ),
    q AS (
        SELECT 
            CASE 
                WHEN q_text IS NOT NULL AND trim(q_text) <> '' THEN 
                    replace(q_text, '&', '|')::tsquery 
                ELSE NULL 
            END AS tsq
        FROM raw_q
    ),
    evaluados AS (
        SELECT 
            f.source_id,
            f.tema,
            f.grado_num,
            f.area,
            f.bloque_guia,
            f.competencias_especificas,
            f.contenidos_texto_original,
            f.indicadores_logro,
            f.fuente_documento,
            f.version_curricular,
            f.pagina,
            f.estado_validacion,
            CASE 
                WHEN (SELECT tsq FROM q) IS NOT NULL AND f.fts_vector @@ (SELECT tsq FROM q) THEN true
                ELSE false
            END AS coincide_tema,
            CASE 
                WHEN (SELECT tsq FROM q) IS NOT NULL AND f.fts_vector @@ (SELECT tsq FROM q) THEN ts_rank_cd(f.fts_vector, (SELECT tsq FROM q))
                ELSE 0.0::REAL
            END AS relevancia
        FROM public.curriculo_secuencias f
        WHERE f.vigente
          AND f.nivel = p_nivel
          AND f.grado_num = p_grado
          AND f.area = p_area
    )
    SELECT 
        e.source_id,
        e.tema,
        e.grado_num,
        e.area,
        e.bloque_guia,
        e.competencias_especificas,
        e.contenidos_texto_original,
        e.indicadores_logro,
        e.fuente_documento,
        e.version_curricular,
        e.pagina,
        e.estado_validacion,
        e.coincide_tema,
        e.relevancia
    FROM evaluados e
    ORDER BY e.coincide_tema DESC, e.relevancia DESC, e.source_id ASC
    LIMIT least(greatest(p_limite, 1), 5);
$$;

GRANT EXECUTE ON FUNCTION public.buscar_curriculo_secuencias(TEXT, SMALLINT, TEXT, TEXT, INT) TO anon, authenticated;


-- 3. INGESTA DE SECUENCIAS CURRICULARES OFICIALES (78 FILAS)
-- =============================================================================
-- NO EJECUTAR EN PRODUCCIÓN: filas pendiente_validacion, requieren verificación de tomo y página
-- Generado automáticamente por scripts/curriculo/generar_sql_secuencias.mjs
-- Total filas: 78
-- =============================================================================

INSERT INTO public.curriculo_secuencias (
    source_id, nivel, ciclo, grado_num, area, tema, bloque_guia,
    competencias_especificas, contenidos_texto_original, indicadores_logro,
    fuente_documento, version_curricular, pagina, url_fuente,
    estado_validacion, vigente, huella
) VALUES (
    'SEC-PRI-1-ESP-001',
    'Primario',
    'Primer Ciclo',
    1,
    'Lengua Española',
    'Secuencia 1: Tarjeta de identidad / Documento de identidad / Autobiografia',
    'Secuencia Didáctica 1',
    'Comunicativa. Expresa y comprende, de forma oral y escrita en diferentes contextos,
textos funcionales y literarios muy sencillos y de estructura sintáctica simple, mediante el uso de medios
y recursos apropiados, demostrando avance progresivo en sus procesos de lectura y escritura.',
    'CONCEPTUALES PROCEDIMENTALES ACTITUDINALES Y VALORES
• La tarjeta de
identidad
• Estructura (nombre y
apellido).
• Función del nombre
propio.
• Identificación de palabras que riman con
los nombres.
• Conteo de las sílabas, identificación de
la sílaba inicial/final de los nombres.
• Pronunciación y asociación de su
nombre con la tarjeta de identidad que
lo contiene.
• Pronunciación de palabras que riman
con su nombre. Descomposición en
sílaba de su nombre y/o del nombre de
compañeros.
• Lectura de su nombre y del de sus
compañeros.
• Definición de la situación de escritura
(para qué elaborar la tarjeta de
identidad).
• Planificación, escritura del primer
borrador, revisión y corrección de la
escritura de su nombre, en su tarjeta de
identidad, con la ayuda de pares y del
docente y publicación de su tarjeta de
identidad en un lugar visible del aula.
• Edición de su documento utilizando
mayúsculas al inicio de su nombre y
apellido.
• Reconocimiento de sus
características propias
y fortalecimiento de su
identidad.
• Cuidado en la
presentación, orden
y limpieza en la
elaboración de su tarjeta
de identidad para que
pueda ser comprendida
por otras personas.',
    '["Comunica sus ideas de forma oral y escrita, de acuerdo con sus conocimientos mediante un tipo de","Lee convencionalmente textos sencillos funcionales.","Muestra respeto ante las opiniones de los demás.","Expresa valores que lo identifican culturalmente, mediante textos sencillos que lee y escribe."]'::jsonb,
    'Guía Didáctica de Lengua Española (MINERD / CON BASE)',
    '2023',
    '63-64',
    'https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo',
    'pendiente_validacion',
    true,
    '9e34c4d120d1a56465f164badcdbd62385df282c29a6f0175faa403f2e414c69'
) ON CONFLICT (source_id) DO NOTHING;

INSERT INTO public.curriculo_secuencias (
    source_id, nivel, ciclo, grado_num, area, tema, bloque_guia,
    competencias_especificas, contenidos_texto_original, indicadores_logro,
    fuente_documento, version_curricular, pagina, url_fuente,
    estado_validacion, vigente, huella
) VALUES (
    'SEC-PRI-2-ESP-001',
    'Primario',
    'Primer Ciclo',
    2,
    'Lengua Española',
    'Secuencia 1: Tarjeta de identidad / Documento de identidad / Autobiografia',
    'Secuencia Didáctica 1',
    'Comunicativa. Expresa y comprende, de forma oral y escrita en diferentes contextos, textos
funcionales y literarios muy sencillos y de estructura sintáctica simple, mediante el uso de medios y recursos
apropiados, demostrando avance progresivo en sus procesos de lectura y escritura.',
    'CONCEPTUALES PROCEDIMENTALES ACTITUDINALES Y VALORES
• El documento de
identidad
• Estructura (nombre y
apellido, fecha y lugar
de nacimiento).
• La función del
documento de
identidad.
• Socialización de la intención comunicativa
de la lectura del documento de identidad
que escucha.
• Comenta sobre los datos personales que
se encuentran en sus documentos de
identidad después de ser leídos por el o la
docente o sus compañeros y compañeras.
• Identificación de palabras que riman con
palabras contenidas en el documento de
identidad.
• Conteo de las sílabas e identificación de la
sílaba inicial / final palabras contenidas en
el documento de identidad.
• Pronunciación de palabras (con rima y
sin rima) contenidas en el documento de
identidad.
• Descomposición en sílaba de palabras en
silabas contenidas en el documento de
identidad.
• Lectura de su documento de identidad y del
de sus compañeros.
• Diferenciación de los nombres, los
apellidos y la fecha del lugar de nacimiento
en los documentos de identidad que
explora.
• Análisis de organizadores gráficos que
debe completar con sus datos personales
(nombres, apellidos, fecha y lugar de
nacimiento).
• Investigación en documentos de identidad
para identificar los datos que contienen y
planificar la elaboración del documento de
identidad.
• Planificación, escritura del primer borrador,
revisión y corrección de la escritura de sus
datos, en su documento de identidad y
publicación de su tarjeta de identidad en un
lugar visible del aula.
• Edición de su documento utilizando
mayúsculas al inicio de su nombre y
apellido.
• Satisfacción al distinguir
sus nombres y apellidos
entre otros que escucha.
• Satisfacción al explicar
los datos personales
contenidos en su
documento de identidad.
• Satisfacción al distinguir
sus nombres y apellidos
entre otros que lee.',
    '["Formula sus conocimientos sobre temas variados, utilizando un tipo de texto oral y escrito.","Lee textos funcionales de manera convencional.","Expresa sus ideas por escrito mediante un texto apropiado.","Expresa sus opiniones a través de textos orales y escritos de manera crítica y muestra respeto por las"]'::jsonb,
    'Guía Didáctica de Lengua Española (MINERD / CON BASE)',
    '2023',
    '75-77',
    'https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo',
    'pendiente_validacion',
    true,
    '29d58860371f1e7c7ab3f10f7ff4dc8c7273328481804dc35d2ef7ddebae8cfc'
) ON CONFLICT (source_id) DO NOTHING;

INSERT INTO public.curriculo_secuencias (
    source_id, nivel, ciclo, grado_num, area, tema, bloque_guia,
    competencias_especificas, contenidos_texto_original, indicadores_logro,
    fuente_documento, version_curricular, pagina, url_fuente,
    estado_validacion, vigente, huella
) VALUES (
    'SEC-PRI-3-ESP-001',
    'Primario',
    'Primer Ciclo',
    3,
    'Lengua Española',
    'Secuencia 1: Tarjeta de identidad / Documento de identidad / Autobiografia',
    'Secuencia Didáctica 1',
    'Comunicativa. Expresa y comprende, de forma oral y escrita en diferentes contextos, textos
funcionales y literarios muy sencillos y de estructura sintáctica simple, mediante el uso de medios y recursos
apropiados, demostrando avance progresivo en sus procesos lectura y escritura.',
    'CONCEPTUALES PROCEDIMENTALES ACTITUDINALES Y VA-
LORES
• La autobiografía
• Función. Estructura.
(introducción,
desarrollo y
conclusión).
• Hechos organizados
en secuencia
temporal.
• Verbos en pasado.
Primera persona
gramatical.
• Adverbios de tiempo y
orden. Adjetivos.
• Conectores de orden y
temporales.
• Signos de puntuación
y signos auxiliares
(coma, punto y
seguido, punto final)
• Escucha atenta de autobiografías de compañeros
y compañeras y personas destacadas de la
comunidad, leídas o relatadas por su docente o
sus pares.
• Utilización de la estructura de la autobiografía
(introducción, desarrollo y conclusión), los datos
y acciones contadas, inferencia del significado
de palabras desconocidas a partir del contexto,
la secuencia temporal de los hechos, la persona
gramatical utilizada, los adjetivos y adverbios
y los signos de puntuación para comprender su
contenido.
• Paráfrasis del sentido global de los hechos
principales de la autobiografía, a partir de la
interpretación de las acciones principales y las
motivaciones de la persona de quien se narra la
autobiografía, haciendo inferencias sencillas.
• Identificación de palabras que riman con palabras
contenidas en el documento de identidad.
• Conteo de las sílabas e identificación de la
sílaba inicial / final palabras contenidas en el
documento de identidad.
• Lectura en voz alta de la autobiografía con
claridad, precisión y entonación adecuadas a
la intención comunicativa de este tipo de texto
y conforme a cada una de las partes de su
estructura, aplicando las convenciones de la
lectura.
• Realización de las inferencias escrita necesarias
para comprender el sentido global de la
autobiografía que lee y elaborar paráfrasis escrita
del sentido global de la autobiografía.
• Identificación de las letras mayúsculas en
nombres propios utilizados en la autobiografía.
• Investigación en documentos de identidad para
identificar los datos que contienen y planificar la
elaboración del documento de identidad.
• Planificación, escritura del primer borrador,
revisión y corrección de la escritura de sus datos,
en su documento de identidad y publicación de su
tarjeta de identidad en un lugar visible del aula.
• Reflexión sobre
los valores de las
personas cuya
autobiografía ha
escuchado para
incorporarlos a su
vida.
• Disfrute al relatar
su autobiografía.
• Creatividad
al relatar de
forma oral su
autobiografía.',
    '["Utiliza textos orales y escritos para comunicar sus ideas en variados contextos sociales.","Produce textos orales y escritos sobre temas y problemas sociales de su entorno local y nacional.","Formula opiniones críticas y creativas mediante textos variados, respetando las ajenas de sus","interlocutores."]'::jsonb,
    'Guía Didáctica de Lengua Española (MINERD / CON BASE)',
    '2023',
    '90-93',
    'https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo',
    'pendiente_validacion',
    true,
    'f09a9544d170dbe6349c7a62e971e44c55608c5d70180ba2dfde97b6cf7c22d6'
) ON CONFLICT (source_id) DO NOTHING;

INSERT INTO public.curriculo_secuencias (
    source_id, nivel, ciclo, grado_num, area, tema, bloque_guia,
    competencias_especificas, contenidos_texto_original, indicadores_logro,
    fuente_documento, version_curricular, pagina, url_fuente,
    estado_validacion, vigente, huella
) VALUES (
    'SEC-PRI-1-ESP-002',
    'Primario',
    'Primer Ciclo',
    1,
    'Lengua Española',
    'Secuencia 2: Letrero, Lista de compras, Etiqueta, Receta, Instructivo',
    'Secuencia Didáctica 2',
    'Comunicativa. Expresa y comprende, de forma oral y escrita en diferentes contextos,
textos funcionales y literarios muy sencillos y de estructura sintáctica simple, mediante el uso de medios
y recursos apropiados, demostrando avance progresivo en sus procesos de lectura y escritura.',
    'CONCEPTUALES PROCEDIMENTALES ACTITUDINALES Y VALORES
Letrero
• Función y Estructura
(palabras y/o
Imágenes).
• Función del tamaño
de las letras.
• Nombres propios y
comunes.
• Escucha atenta de información de los
letreros leídos por el docente.
• Reconocimiento de la estructura de los
letreros leídos por el docente.
• Identificación de palabras que riman con
unas extraída del letrero.
• Establecimiento de la intención
comunicativa del letrero.
• Lectura en voz alta de letreros.
• Escritura, revisión y corrección del
borrador.
• Edición y publicación del letrero.
• Valoración del uso de los
letreros en la escuela
y en su comunidad
como un medio de
identificación de objetos,
lugares o situaciones.
• Interés por conocer
los letreros y su
funcionalidad en la vida
cotidiana.
• Cuidado en la
presentación, orden
y limpieza en la
elaboración de su letrero.
Lista de compras
• Función.
• Estructura.
• Silueta.
• Distinción números y
palabras.
• Identificación de palabras que riman con
otras contenidas en la lista de compras.
• Diferenciación de palabras cortas
y largas en la lista de compras que
escucha.
• Establecimiento de la intención
comunicativa.
• Lectura en voz alta de los nombres de
los productos escritos en su lista de
compras.
• Escritura, revisión y corrección de su
escrito. Edición y publicación de su lista
de compras.
• Valoración del uso de la
lista de compras como
forma de organización
para la adquisición de los
productos.
• Cuidado en la
presentación, orden
y limpieza en la
elaboración de su lista de
compras.',
    '["Comunica sus ideas de forma oral y escrita, de acuerdo con sus conocimientos mediante un tipo de","Lee convencionalmente textos sencillos funcionales.","Muestra respeto ante las opiniones de los demás."]'::jsonb,
    'Guía Didáctica de Lengua Española (MINERD / CON BASE)',
    '2023',
    '64-68',
    'https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo',
    'pendiente_validacion',
    true,
    '839c47a035245470eaad7493786b7e6f1b2846b399f586d75502df6e918c579e'
) ON CONFLICT (source_id) DO NOTHING;

INSERT INTO public.curriculo_secuencias (
    source_id, nivel, ciclo, grado_num, area, tema, bloque_guia,
    competencias_especificas, contenidos_texto_original, indicadores_logro,
    fuente_documento, version_curricular, pagina, url_fuente,
    estado_validacion, vigente, huella
) VALUES (
    'SEC-PRI-2-ESP-002',
    'Primario',
    'Primer Ciclo',
    2,
    'Lengua Española',
    'Secuencia 2: Letrero, Lista de compras, Etiqueta, Receta, Instructivo',
    'Secuencia Didáctica 2',
    'Comunicativa. Expresa y comprende, de forma oral y escrita en diferentes contextos,
textos funcionales y literarios muy sencillos y de estructura sintáctica simple, mediante el uso de medios
y recursos apropiados, demostrando avance progresivo en sus procesos lectura y escritura.',
    'CONCEPTUALES PROCEDIMENTALES ACTITUDINALES Y VALORES
Etiqueta
• Estructura. (Imagen y
palabras).
• La función.
(identificación y
publicitaria) .
• Escucha atenta de la información de una
etiqueta leída por el o la docente.
• Diferenciación entre el producto y la
marca.
• Identificación del sonido inicial / final
/ que se encuentra en el medio de las
palabras que contiene la etiqueta.
• Establecimiento de la intención
comunicativa de la etiqueta.
• Lectura de etiquetas en voz alta.
• Escritura, revisión y corrección del
borrador con ayuda
• Edición y publicación de la etiqueta.
• Valoración del uso
de las etiquetas en
los productos de uso
cotidiano como un medio
para identificarlos.
• Cuidado en la
presentación, legibilidad
de su escritura,
orden y limpieza en
la elaboración de la
etiqueta.
La receta
• Función y Estructura.
(título, ingredientes y
preparación)
• Escucha atenta de la lectura de la receta
por parte del o la docente.
• Utilización de la estructura de la receta
(título, ingredientes y preparación),
distinguiendo los ingredientes de
la preparación de la receta para
comprender su contenido.
• Paráfrasis del vocabulario relacionado
con la receta usando sinónimos u otros
recursos.
• Establecimiento de la intención
comunicativa de la receta.
• Lectura en voz alta de la receta.
• Escritura, revisión y corrección del
borrador con ayuda
• Edición y publicación de la receta.
• Valoración de la
importancia de la receta
para preparar platos
culinarios
• Cuidado en la
presentación, legibilidad
de su escritura,
orden y limpieza
en la elaboración y
presentación de la
receta.',
    '["Formula sus conocimientos sobre temas variados, utilizando un tipo de texto oral y escrito.","Lee textos funcionales de manera convencional.","Expresa sus ideas por escrito mediante un texto apropiado.","Expresa sus opiniones a través de textos orales y escritos de manera crítica y muestra respeto por las"]'::jsonb,
    'Guía Didáctica de Lengua Española (MINERD / CON BASE)',
    '2023',
    '77-82',
    'https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo',
    'pendiente_validacion',
    true,
    'c932a0f765a8dda72f08d11561654949fb66686c7d5af04a636c1998b8ac905a'
) ON CONFLICT (source_id) DO NOTHING;

INSERT INTO public.curriculo_secuencias (
    source_id, nivel, ciclo, grado_num, area, tema, bloque_guia,
    competencias_especificas, contenidos_texto_original, indicadores_logro,
    fuente_documento, version_curricular, pagina, url_fuente,
    estado_validacion, vigente, huella
) VALUES (
    'SEC-PRI-3-ESP-002',
    'Primario',
    'Primer Ciclo',
    3,
    'Lengua Española',
    'Secuencia 2: Letrero, Lista de compras, Etiqueta, Receta, Instructivo',
    'Secuencia Didáctica 2',
    'Comunicativa. Expresa y comprende, de forma oral y escrita en diferentes contextos,
textos funcionales y literarios muy sencillos y de estructura sintáctica simple, mediante el uso de medios
y recursos apropiados, demostrando avance progresivo en sus procesos lectura y escritura.',
    'CONCEPTUALES PROCEDIMENTALES ACTITUDINALES Y VALORES
El instructivo
• Función y Estructura.
(título, materiales y
procedimiento)
• Verbos en imperativo.
• Segunda persona del
singular.
• Uso de conectores de
orden.
• Escucha atenta de la lectura del
instructivo.
• Utilización de la estructura del
instructivo (título, materiales y
procedimiento), inferencia, a partir del
contexto, del significado de las palabras
que desconoce, los verbos y conectores
para comprender su contenido.
• Realización de las inferencias necesarias
para comprender el sentido global del
instructivo que escucha y elaboración
de paráfrasis del contenido global del
instructivo por medio de sinónimos u
otros recursos.
• Establecimiento de la intención
comunicativa de su instructivo.
• Planificación y organización de la
escritura del instructivos selección de
la tarea que desea que realicen los/
las destinatarios/as de su instructivo,
enumeración de los materiales que
necesita para la realización de la tarea
elegida.
• Escritura del primer borrador del
instructivo ajustándose a la intención y
la estructura.
• Revisión y corrección del borrador con
ayuda - Edición y publicación de su
instructivo.
• Aprecio y valoración
de la importancia del
instructivo para lograr
la realización de tareas
diversas.
• Apreciación y valoración
de la importancia de los
instructivos para lograr
la realización de tareas
diversas.
• Cuidado en la
presentación, legibilidad
en su escritura
orden y limpieza en
la elaboración de su
instructivo.',
    '["Utiliza textos orales y escritos para comunicar sus ideas en variados contextos sociales.","Produce textos orales y escritos sobre temas y problemas sociales de su entorno local y nacional.","Formula opiniones críticas y creativas mediante textos variados, respetando las ajenas de sus","interlocutores."]'::jsonb,
    'Guía Didáctica de Lengua Española (MINERD / CON BASE)',
    '2023',
    '93-95',
    'https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo',
    'pendiente_validacion',
    true,
    '20a58246fd84e055087a01df19bbeb79e519ffdc6f0477d8c0e6aab90475e668'
) ON CONFLICT (source_id) DO NOTHING;

INSERT INTO public.curriculo_secuencias (
    source_id, nivel, ciclo, grado_num, area, tema, bloque_guia,
    competencias_especificas, contenidos_texto_original, indicadores_logro,
    fuente_documento, version_curricular, pagina, url_fuente,
    estado_validacion, vigente, huella
) VALUES (
    'SEC-PRI-1-ESP-003',
    'Primario',
    'Primer Ciclo',
    1,
    'Lengua Española',
    'Secuencia 3: La Noticia',
    'Secuencia Didáctica 3',
    'Comunicativa. Expresa y comprende, de forma oral y escrita en diferentes contextos,
textos funcionales y literarios muy sencillos y de estructura sintáctica simple, mediante el uso de medios
y recursos apropiados, demostrando avance progresivo en sus procesos de lectura y escritura.',
    'CONCEPTUALES PROCEDIMENTALES ACTITUDINALES Y VALORES
La noticia
• Función y Estructura
(titular, cuerpo de la
noticia, foto y pie de
foto).
• Preguntas de la
noticia: qué ocurrió,
a quién le ocurrió,
dónde ocurrió, cuándo
y cómo ocurrió.
• Escucha atenta de noticias leídas por su
docente.
• Paráfrasis de las ideas principales de la
noticia.
• Identificación del sonido común en el
medio/en diferentes posiciones de dos o
más palabras de la noticia que escucha.
• Conteo de las palabras que componen el
título de la noticia que escucha.
• Selección del suceso sobre el que
informará en la noticia.
• Narración, con fluidez y entonación
adecuada, de la noticia.
• Identificación de las palabras tomando
en cuenta los espacios en blanco.
• Conteo de palabras contenidas en el
titular de la noticia.
• Establecimiento, en actividades escritas,
de la correspondencia entre letras y
sonidos de palabras correspondientes al
titular y al cuerpo de la noticia.
• Escritura del primer borrador de su
noticia.
• Revisión y corrección de su noticia con
ayuda del docente y de sus compañeros.
• Edición y publicación de su noticia.
• Valoración de la
importancia de escuchar
y elaborar noticias para
estar informado sobre
situaciones importantes
de su escuela, su
comunidad, su país y el
mundo.
• Interés por lo que sucede
en su entorno y por
contarlo a través de
noticias.
• Interés por escribir
noticias sobre sucesos de
su entorno.
• Cuidado en la
presentación, orden
y limpieza en la
elaboración de su noticia.',
    '["Comunica sus ideas de forma oral y escrita, de acuerdo con sus conocimientos mediante una noticia.","Lee convencionalmente el texto funcional de la noticia.","Muestra respeto ante las opiniones de los demás.","Expresa valores que lo identifican culturalmente, mediante textos sencillos que lee y escribe."]'::jsonb,
    'Guía Didáctica de Lengua Española (MINERD / CON BASE)',
    '2023',
    '70-72',
    'https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo',
    'pendiente_validacion',
    true,
    '1a512e4b28bf8371ec0ccdc90701bf74633bbfff8bf3ca7f388b21d86e9d4ed3'
) ON CONFLICT (source_id) DO NOTHING;

INSERT INTO public.curriculo_secuencias (
    source_id, nivel, ciclo, grado_num, area, tema, bloque_guia,
    competencias_especificas, contenidos_texto_original, indicadores_logro,
    fuente_documento, version_curricular, pagina, url_fuente,
    estado_validacion, vigente, huella
) VALUES (
    'SEC-PRI-2-ESP-003',
    'Primario',
    'Primer Ciclo',
    2,
    'Lengua Española',
    'Secuencia 3: La Noticia',
    'Secuencia Didáctica 3',
    'Comunicativa. Expresa y comprende, de forma oral y escrita en diferentes contextos,
textos funcionales y literarios muy sencillos y de estructura sintáctica simple, mediante el uso de medios
y recursos apropiados, demostrando avance progresivo en sus procesos de lectura y escritura.',
    'CONCEPTUALES PROCEDIMENTALES ACTITUDINALES Y VALORES
La noticia
• Función y estructura.
• Inferencia del
significado
de palabras
desconocidas a partir
del contexto.
• Preguntas en la
noticia: qué ocurrió,
a quién le ocurrió,
dónde ocurrió, cuándo
ocurrió y cómo
ocurrió.
• Escucha atenta de noticias presentadas
por su docente.
• Paráfrasis de las informaciones
principales de la noticia.
• Identificación del sonido común en
diferentes posiciones de dos o más
palabras de la noticia que escucha.
• Conteo de las palabras que componen el
título de la noticia que escucha.
• Lectura en voz alta de noticias.
• Selección del suceso sobre el que
informará en la noticia.
• Planificación y organización de sus ideas
para escribir la noticia.
• Escritura del borrador de la noticia.
• Revisión y corrección de su noticia con
ayuda del docente y de sus compañeros
representando con letras, de manera
convencional, las unidades sonoras de
la noticia.
• Edición y publicación de su noticia.
• Interés por lo que sucede
en su entorno y lo cuenta
a través de noticias.
• Valoración de la
importancia de contar
objetivamente noticias
para informar a otros
sobre sucesos ocurridos
en su entorno y su país.
• Interés por escribir
noticias ocurridas en su
entorno y su país.
• Cuidado en la
presentación, legibilidad
de su escritura,
orden y limpieza
en la elaboración y
presentación de la
noticia.',
    '["Formula sus conocimientos sobre temas variados, utilizando una noticia oral y escrita.","Lee noticias de manera convencional.","Expresa sus ideas por escrito mediante un texto apropiado.","Expresa sus opiniones a través de textos orales y escritos de manera crítica y muestra respeto por las"]'::jsonb,
    'Guía Didáctica de Lengua Española (MINERD / CON BASE)',
    '2023',
    '82-84',
    'https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo',
    'pendiente_validacion',
    true,
    '7f90b2f17679d6b29810247e86fe7841205b48e7375fb29d441242f372308d10'
) ON CONFLICT (source_id) DO NOTHING;

INSERT INTO public.curriculo_secuencias (
    source_id, nivel, ciclo, grado_num, area, tema, bloque_guia,
    competencias_especificas, contenidos_texto_original, indicadores_logro,
    fuente_documento, version_curricular, pagina, url_fuente,
    estado_validacion, vigente, huella
) VALUES (
    'SEC-PRI-3-ESP-003',
    'Primario',
    'Primer Ciclo',
    3,
    'Lengua Española',
    'Secuencia 3: La Noticia',
    'Secuencia Didáctica 3',
    'Comunicativa. Expresa y comprende, de forma oral y escrita en diferentes contextos,
textos funcionales y literarios muy sencillos y de estructura sintáctica simple, mediante el uso de medios
y recursos apropiados, demostrando avance progresivo en sus procesos de lectura y escritura.',
    'CONCEPTUALES PROCEDIMENTALES ACTITUDINALES Y VALORES
La noticia
• Función y estructura
noticia (titular,
entrada o copete,
cuerpo de la noticia,
foto, pie de foto).
• Preguntas en la
noticia. noticia (titular,
entrada o copete,
cuerpo de la noticia,
foto, pie de foto),
• Conectores de orden.
• La concordancia:
sujeto y predicado
• Escucha atenta de noticias relacionadas
con la realidad social y cultural de su
país y del mundo.
• Realización de las inferencias necesarias
para comprender el sentido global de la
noticia que escucha.
• Reconstrucción del sentido global de la
noticia.
• Lectura en voz alta de la noticia.
• Reconocimiento de la estructura gráfica
de la noticia (titular, entrada o copete,
cuerpo de la noticia, foto, pie de foto).
• Planificación y organización de sus ideas
para escribir la noticia.
• Elaboración del borrador de la noticia.
• Revisión y corrección de la noticia
con ayuda de su docente y de sus
compañeros y compañeras.
• Edición y publicación de la noticia.
• Valoración de la
importancia de escuchar
noticias para estar
informado/a sobre
situaciones importantes
de su escuela, su
comunidad, su país y el
mundo.
• Curiosidad por conocer
lo que sucede a su
alrededor y en el mundo.
• Valoración de la
importancia de contar
objetivamente noticias
para informar a otros
y otras sobre sucesos
ocurridos en el país y el
mundo.
• Interés por escribir
noticias ocurridas en el
país y el mundo.
• Cuidado en la
presentación, legibilidad
en su escritura, orden
y limpieza en la
elaboración de su noticia.',
    '["Utiliza noticias orales y escritas para comunicar sus ideas en variados contextos sociales.","Produce noticias orales y escritas sobre temas y problemas sociales de su entorno local y nacional.","Formula opiniones críticas y creativas mediante textos variados, respetando las ajenas de sus","interlocutores."]'::jsonb,
    'Guía Didáctica de Lengua Española (MINERD / CON BASE)',
    '2023',
    '96-98',
    'https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo',
    'pendiente_validacion',
    true,
    'eac6629f8bbee566faf8552d582ee428ee24630d20959959c8e42f7ffc5f14a5'
) ON CONFLICT (source_id) DO NOTHING;

INSERT INTO public.curriculo_secuencias (
    source_id, nivel, ciclo, grado_num, area, tema, bloque_guia,
    competencias_especificas, contenidos_texto_original, indicadores_logro,
    fuente_documento, version_curricular, pagina, url_fuente,
    estado_validacion, vigente, huella
) VALUES (
    'SEC-PRI-1-ESP-004',
    'Primario',
    'Primer Ciclo',
    1,
    'Lengua Española',
    'Secuencia 4: El Cuento',
    'Secuencia Didáctica 4',
    'Comunicativa. Expresa y comprende, de forma oral y escrita en diferentes contextos,
textos funcionales y literarios muy sencillos y de estructura sintáctica simple, mediante el uso de medios
y recursos apropiados, demostrando avance progresivo en sus procesos lectura y escritura.',
    'CONCEPTUALES PROCEDIMENTALES ACTITUDINALES Y VALORES
El cuento
• Estructura (inicio,
nudo y desenlace).
• Uso de las fórmulas
convencionales de
inicio y cierre.
• Escucha atenta de cuentos sencillos
leídos por su docente.
• Identificación de la estructura del
cuento (inicio, desarrollo y desenlace)
y explicación del vocabulario clave
relacionado con el tema para
comprender su contenido.
• Identificación y descripción de los
personajes del cuento con vocabulario
sencillo.
• Paráfrasis de las ideas principales del
cuento.
• Identificación de los signos de
puntuación (punto, raya) utilizados para
delimitar oraciones y párrafos.
• Establecimiento, en actividades escritas,
de la correspondencia entre letras
y sonidos de palabras que lee en el
cuento.
• Escritura de un borrador de cuento.
• Revisión, corrección y edición de un
cuento.
• Disfrute al escuchar
cuentos.
• Interés y curiosidad por
realizar predicciones de
cuentos que escucha.
• Disfrute al narrar
cuentos.
• Disfrute al escribir
cuentos.
• Cuidado en la
presentación, orden
y limpieza en la
elaboración de su cuento.',
    '["Comunica sus ideas de forma oral y escrita, de acuerdo con sus conocimientos mediante un tipo de","texto (cuento).","Lee convencionalmente textos literarios sencillos (cuentos).","Muestra respeto ante las opiniones de los demás.","Expresa valores que lo identifican culturalmente, mediante textos sencillos que lee y escribe."]'::jsonb,
    'Guía Didáctica de Lengua Española (MINERD / CON BASE)',
    '2023',
    '72-74',
    'https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo',
    'pendiente_validacion',
    true,
    '08f09352781089e769d404edb02fecad31e00ee06f1319df7faf289091dab899'
) ON CONFLICT (source_id) DO NOTHING;

INSERT INTO public.curriculo_secuencias (
    source_id, nivel, ciclo, grado_num, area, tema, bloque_guia,
    competencias_especificas, contenidos_texto_original, indicadores_logro,
    fuente_documento, version_curricular, pagina, url_fuente,
    estado_validacion, vigente, huella
) VALUES (
    'SEC-PRI-2-ESP-004',
    'Primario',
    'Primer Ciclo',
    2,
    'Lengua Española',
    'Secuencia 4: El Cuento',
    'Secuencia Didáctica 4',
    'Comunicativa. Expresa y comprende, de forma oral y escrita en diferentes contextos,
textos funcionales y literarios muy sencillos y de estructura sintáctica simple, mediante el uso de medios
y recursos apropiados, demostrando avance progresivo en sus procesos lectura y escritura.',
    'CONCEPTUALES PROCEDIMENTALES ACTITUDINALES Y VALORES
El cuento
• Función.
• Estructura.
• Conectores
temporales.
• Escucha atenta de cuentos de mayor
complejidad que los de primer grado.
• Paráfrasis de los sucesos principales del
cuento.
• Reconocimiento y utilización de la
estructura del cuento escuchado (inicio,
nudo y desenlace).
• Identificación de los espacios en blanco
entre las palabras, oraciones y párrafos
del cuento para leerlo con expresión
adecuada.
• Conciencia fonológica y conciencia
gráfica.
• Identificación de vocales y consonantes
en palabras del cuento.
• Adecuación a las convenciones de
lectura y escritura al leer y escribir
cuentos.
• Disfrute al escuchar
cuentos.
• Interés y curiosidad por
realizar predicciones de
cuentos que escucha.
• Disfrute al narrar
cuentos.
• Disfrute al escribir
cuentos.
• Cuidado en la
presentación, orden
y limpieza en la
elaboración de su cuento.',
    '["Formula sus conocimientos sobre temas variados, utilizando un tipo de texto oral y escrito (cuento).","Lee textos literarios de manera convencional (cuentos).","Expresa sus ideas por escrito mediante un texto apropiado.","Expresa sus opiniones a través de textos orales y escritos de manera crítica y muestra respeto por las"]'::jsonb,
    'Guía Didáctica de Lengua Española (MINERD / CON BASE)',
    '2023',
    '86-89',
    'https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo',
    'pendiente_validacion',
    true,
    'cdcdcfefc85515518cc1aab1b50e2a0413a303f01e87268ec29465f7a8b19758'
) ON CONFLICT (source_id) DO NOTHING;

INSERT INTO public.curriculo_secuencias (
    source_id, nivel, ciclo, grado_num, area, tema, bloque_guia,
    competencias_especificas, contenidos_texto_original, indicadores_logro,
    fuente_documento, version_curricular, pagina, url_fuente,
    estado_validacion, vigente, huella
) VALUES (
    'SEC-PRI-3-ESP-004',
    'Primario',
    'Primer Ciclo',
    3,
    'Lengua Española',
    'Secuencia 4: El Cuento',
    'Secuencia Didáctica 4',
    'Comunicativa. Expresa y comprende, de forma oral y escrita en diferentes contextos,
textos funcionales y literarios muy sencillos y de estructura sintáctica simple, mediante el uso de medios
y recursos apropiados, demostrando avance progresivo en sus procesos lectura y escritura.',
    'CONCEPTUALES PROCEDIMENTALES ACTITUDINALES Y VALORES
El cuento
• Estructura (inicio,
nudo y desenlace).
• Fórmulas
convencionales de
inicio y cierre.
• Conectores de orden y
causales.
• Verbos en pasado.
• Adjetivos para
describir los
personajes, distinción
entre narrador y
personajes.
• Escucha atenta de cuentos.
• Realización de las inferencias necesarias
para comprender el sentido global del
cuento que escucha.
• Reconocimiento del conflicto narrativo.
• Identificación de personajes.
• Escritura de un borrador y planificación
de la escritura de un cuento.
• Revisión y edición de borradores.
• Adecuar el texto a la normativa.
• Disfrute al escuchar
cuentos.
• Interés y curiosidad por
realizar predicciones de
cuentos que escucha.
• Disfrute al narrar
cuentos.
• Disfrute al escribir
cuentos.
• Cuidado en la
presentación, orden
y limpieza en la
elaboración de su cuento.',
    '["Utiliza textos orales y escritos (cuentos) para comunicar sus ideas en variados contextos sociales.","Produce textos orales y escritos (cuentos) sobre temas y problemas sociales de su entorno local y","nacional.","Formula opiniones críticas y creativas mediante textos variados, respetando las ajenas de sus","interlocutores."]'::jsonb,
    'Guía Didáctica de Lengua Española (MINERD / CON BASE)',
    '2023',
    '98-101',
    'https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo',
    'pendiente_validacion',
    true,
    'ac9445c5c9ce10a7c89a9b080a0973150ca832c59d3332d92cd603603f658e82'
) ON CONFLICT (source_id) DO NOTHING;

INSERT INTO public.curriculo_secuencias (
    source_id, nivel, ciclo, grado_num, area, tema, bloque_guia,
    competencias_especificas, contenidos_texto_original, indicadores_logro,
    fuente_documento, version_curricular, pagina, url_fuente,
    estado_validacion, vigente, huella
) VALUES (
    'SEC-PRI-1-ESP-005',
    'Primario',
    'Primer Ciclo',
    1,
    'Lengua Española',
    'Secuencia 5: El Articulo Expositivo',
    'Secuencia Didáctica 5',
    'Comunicativa. Expresa y comprende, de forma oral y escrita en diferentes contextos, textos
funcionales y literarios muy sencillos y de estructura sintáctica simple, mediante el uso de medios y recursos
apropiados, demostrando avance progresivo en sus procesos de lectura y escritura.',
    'CONCEPTUALES PROCEDIMENTALES ACTITUDINALES Y VALORES
El artículo expositivo
• Función y estructura
• expositiva
(introducción,
desarrollo y
conclusión).
• La descripción como
uno de los 5 modos de
organización.
• Presente de
indicativo: verbos
como ser, estar,
parecer, tener, existir,
etc.
• Adjetivos y adverbios
en la descripción.
• Conectores de adición
en la descripción del
artículo.
• Escucha atenta de artículos de
divulgación científica leídos por su
docente.
• Realización de las inferencias necesarias
para comprender el sentido global
del artículo expositivo que escucha
y realizar paráfrasis de las ideas
principales.
• Lectura en voz alta del artículo
expositivo.
• Lectura de artículos expositivos en
silencio y con concentración.
• Planificación de la escritura del artículo:
estructura, coherencia, cohesión y
puntuación.
• Escritura del borrador del artículo de
divulgación científica.
• Revisión y corrección del artículo.
• Valoración de la objetividad
de las informaciones que
escucha para conocer y
explicar temas de interés
científico.
• Interés por informar y
explicar objetivamente
sobre fenómenos diversos
a través de artículos de
divulgación científica.
• Valoración de la
importancia de investigar
para informar y explicar
a otros sobre fenómenos
diversos.
• Cuidado en la presentación,
legibilidad de su escritura,
orden y limpieza en la
elaboración de su artículo
expositivo.',
    '["Utiliza textos orales y escritos para comunicar sus ideas en variados contextos sociales.","Produce textos orales y escritos sobre temas y problemas sociales de su entorno local y nacional.","Formula opiniones críticas y creativas mediante textos variados, respetando las ajenas de sus","interlocutores.","Para primer y segundo grado se focalizan contenidos procedimentales importantes para la alfabetización como:","Escritura de palabras y oraciones breves.","Conciencia fonológica y fonográfica.","Descripciones.","Uso de adjetivos.","Concordancia entre sustantivos y adjetivos.","Identificación de familias de palabras."]'::jsonb,
    'Guía Didáctica de Lengua Española (MINERD / CON BASE)',
    '2023',
    '101-103',
    'https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo',
    'pendiente_validacion',
    true,
    '705442aad043b5ae2647608c43f3e58ac2b3c1641f8fb97f8d60de757fd8d10d'
) ON CONFLICT (source_id) DO NOTHING;

INSERT INTO public.curriculo_secuencias (
    source_id, nivel, ciclo, grado_num, area, tema, bloque_guia,
    competencias_especificas, contenidos_texto_original, indicadores_logro,
    fuente_documento, version_curricular, pagina, url_fuente,
    estado_validacion, vigente, huella
) VALUES (
    'SEC-PRI-1-ESP-006',
    'Primario',
    'Primer Ciclo',
    1,
    'Lengua Española',
    'Secuencia 6: Cancion infantil, Adivinanzas',
    'Secuencia Didáctica 6',
    'Comunicativa. Expresa y comprende, de forma oral y escrita en diferentes contextos,
textos funcionales y literarios muy sencillos y de estructura sintáctica simple, mediante el uso de medios y
recursos apropiados, demostrando avance progresivo en sus procesos de lectura y escritura.',
    'CONCEPTUALES PROCEDIMENTALES ACTITUDINALES Y
VALORES
El mensaje corto
• Función y
estructura (fecha,
destinatario,
cuerpo del
mensaje y
firma, signos de
puntuación).
• Escucha atenta de mensajes leídos por el docente.
• Utilización de la estructura y el vocabulario del
mensaje que escucha (fecha, destinatario, cuerpo
del mensaje y firma) para comprender su contenido.
• Conteo de las palabras que componen las frases
y/u oraciones del mensaje corto.
• Establecimiento de la intención comunicativa e
identificación del destinatario del mensaje corto.
• Planificación del contenido del mensaje (fecha,
destinatario, contenido y firma) que producirá.
• Segmentación de cada uno de los sonidos que
componen una palabra dada del mensaje corto.
• Lectura en voz alta del mensaje corto con claridad y
entonación adecuada.
• Identificación de las palabras que conforman el
mensaje corto, tomando en cuenta los espacios en
blanco.
• Establecimiento, en actividades de escritura, de la
correspondencia entre letras y sonidos de palabras
correspondientes al cuerpo del mensaje, al nombre
del destinatario y a la firma del mensaje corto.
• Escritura del primer borrador del mensaje de
acuerdo a su intención, interlocutor, estructura y la
utilización del vocabulario apropiado en función de
la intensión comunicativa
• Revisión y corrección del borrador con ayuda del
docente
• Edición de la versión final del mensaje.
• Curiosidad e interés
al escuchar los
mensajes.
• Valoración del
mensaje como medio
para comunicarse
con otros.
• Curiosidad e interés
al leer los mensajes.
• Cuidado en la
presentación, orden
y limpieza en la
elaboración de su
mensaje corto.',
    '["Comunica sus ideas de forma oral y escrita, de acuerdo con sus conocimientos mediante un tipo de texto.","Lee convencionalmente textos sencillos funcionales.","Muestra respeto ante las opiniones de los demás.","T extos que se transversalizan:","Primer grado: El mensaje corto","Segundo grado: La canción infantil","T ercer grado: La adivinanza"]'::jsonb,
    'Guía Didáctica de Lengua Española (MINERD / CON BASE)',
    '2023',
    '68-70',
    'https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo',
    'pendiente_validacion',
    true,
    '27de417b6b6951d6995c9129c58d226b43533814eef164d89bec8e1cb48e8f59'
) ON CONFLICT (source_id) DO NOTHING;

INSERT INTO public.curriculo_secuencias (
    source_id, nivel, ciclo, grado_num, area, tema, bloque_guia,
    competencias_especificas, contenidos_texto_original, indicadores_logro,
    fuente_documento, version_curricular, pagina, url_fuente,
    estado_validacion, vigente, huella
) VALUES (
    'SEC-PRI-2-ESP-005',
    'Primario',
    'Primer Ciclo',
    2,
    'Lengua Española',
    'Secuencia 6: Cancion infantil, Adivinanzas',
    'Secuencia Didáctica 6',
    'Comunicativa. Expresa y comprende, de forma oral y escrita en diferentes contextos,
textos funcionales y literarios muy sencillos y de estructura sintáctica simple, mediante el uso de medios y
recursos apropiados, demostrando avance progresivo en sus procesos de lectura y escritura.',
    'CONCEPTUALES PROCEDIMENTALES ACTITUDINALES Y VALORES
La canción infantil
• La canción.
• Función y
estructura.
• Melodía y letra.
• Versos y estrofas.
• Comprensión oral.
• Escucha atenta de canciones acordes con la
edad e intereses.
• Interpretación de la canción.
• Paráfrasis del sentido global.
• Identificación de las palabras que riman.
• Descomposición de las palabras del título
de la canción en sílabas, y composición de
nuevas palabras con esas sílabas.
• Lectura, con pronunciación clara, de las
palabras y versos de las canciones.
• Realización de las inferencias necesarias
para comprender el sentido global de las
canciones que lee y realizar una paráfrasis
de la misma.
• Establecimiento de la intención
comunicativa de la canción.
• Planificación y organización de las ideas
para la selección del tipo de canción que se
va a escribir.
• Escritura de borradores de la canción
ajustándose a la intención, el tema y a la
estructura (título, versos, estrofas) de la
canción.
• Revisión y corrección de borradores.
• Edición de las letras de la canción para ser
cantada.
• Disfrute al escuchar
canciones.
• Valoración de la función
lúdica y estética de la
lengua.
• Valoración de la tradición
oral propia de las
canciones que escucha.
• Interés y curiosidad
por comprender las
canciones que escucha.
• Disfrute al cantar
canciones.
• Creatividad e imaginación
al producir las letras de
canciones.
• Disfrute y motivación al
escribir las letras de las
canciones.',
    '["Formula sus conocimientos sobre temas variados, utilizando un tipo de texto oral y escrito.","Lee textos funcionales de manera convencional.","Expresa sus ideas por escrito mediante un texto apropiado.","Expresa sus opiniones a través de textos orales y escritos de manera crítica y muestra respeto por las"]'::jsonb,
    'Guía Didáctica de Lengua Española (MINERD / CON BASE)',
    '2023',
    '84-86',
    'https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo',
    'pendiente_validacion',
    true,
    '0bb13321623c42a807041d61fe4690464bd00ba20f89ffb9b30a91d48c25c896'
) ON CONFLICT (source_id) DO NOTHING;

INSERT INTO public.curriculo_secuencias (
    source_id, nivel, ciclo, grado_num, area, tema, bloque_guia,
    competencias_especificas, contenidos_texto_original, indicadores_logro,
    fuente_documento, version_curricular, pagina, url_fuente,
    estado_validacion, vigente, huella
) VALUES (
    'SEC-PRI-3-ESP-005',
    'Primario',
    'Primer Ciclo',
    3,
    'Lengua Española',
    'Secuencia 6: Cancion infantil, Adivinanzas',
    'Secuencia Didáctica 6',
    'Comunicativa. Expresa y comprende, de forma oral y escrita en diferentes contextos,
textos funcionales y literarios muy sencillos y de estructura sintáctica simple, mediante el uso de medios y
recursos apropiados, demostrando avance progresivo en sus procesos de lectura y escritura.',
    'CONCEPTUALES PROCEDIMENTALES ACTITUDINALES Y VALORES
La adivinanza
• Función y
estructura.
(Fórmula de
introducción,
elementos
orientadores,
elementos
desorientadores,
fórmula de
conclusión.)
• La rima y el ritmo.
• La descripción.
• Vocabulario
simbólico.
• Escucha atenta de adivinanzas acordes con
la edad e intereses.
• Utilización de la estructura de la adivinanza
(fórmulas de introducción, elementos
orientadores, elementos desorientadores,
fórmulas de conclusión) y uso de la
descripción del objeto o realidad para
comprender su contenido, y presentada para
descubrir la incógnita encubierta.
• Reconocimiento de los elementos
orientadores y desorientadores en la
adivinanza que escucha para resolverla.
• Realización de las inferencias necesarias
para resolver el problema o enigma
planteado.
• Elección de palabras que terminen con el
mismo sonido que la palabra final de cada
verso de la adivinanza que escucha.
• Lectura en voz alta de adivinanzas,
aplicando las normas convencionales de
lectura.
• Planificación de la escritura de la adivinanza:
selección del objeto o la realidad que va
a describir, junto con sus características,
las preguntas y fórmulas de introducción
y conclusión, elementos descriptivos para
crear suspenso, comparación y vocabulario
simbólico y elementos orientadores y
desorientadores que tendrá su adivinanza.
• Escritura del primer borrador de la
adivinanza ajustándose a la intención y a la
estructura.
• Revisión y corrección del borrador.
• Edición y publicación de la adivinanza que
produce.
• Disfrute al escuchar
adivinanzas.
• Valoración de la función
lúdica y estética de la
lengua.
• Interés y curiosidad
por comprender las
adivinanzas que escucha.
• Disfrute al contar
adivinanzas.
• Creatividad e imaginación
al contar adivinanzas.
• Disfrute al escribir
adivinanzas.',
    '["Utiliza textos orales y escritos para comunicar sus ideas en variados contextos sociales.","Produce textos orales y escritos sobre temas y problemas sociales de su entorno local y nacional.","Formula opiniones críticas y creativas mediante textos variados, respetando las de sus interlocutores."]'::jsonb,
    'Guía Didáctica de Lengua Española (MINERD / CON BASE)',
    '2023',
    '104-105',
    'https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo',
    'pendiente_validacion',
    true,
    'db530b3f5af9cec49d0706d8d9cff95af0145a15a0db664511542ef6b197d479'
) ON CONFLICT (source_id) DO NOTHING;

INSERT INTO public.curriculo_secuencias (
    source_id, nivel, ciclo, grado_num, area, tema, bloque_guia,
    competencias_especificas, contenidos_texto_original, indicadores_logro,
    fuente_documento, version_curricular, pagina, url_fuente,
    estado_validacion, vigente, huella
) VALUES (
    'SEC-PRI-1-MAT-001',
    'Primario',
    'Primer Ciclo',
    1,
    'Matemática',
    'Secuencia 1: Conteo, organizacion y representacion de numeros',
    'Secuencia Didáctica 1',
    'Comunicativa
Relaciona materiales y objetos físicos e imágenes con ideas matemáticas que expresa para buscar
soluciones a situaciones de problemas elementales relacionados con su entorno cotidiano.
Pensamiento Lógico, Crítico y Creativo; Competencia Resolución de Problemas; Competencia
Tecnológica y Científica
Resuelve situaciones problemáticas, en forma coherente y con el apoyo de recursos manipulativos para
la explicación matemática de situaciones cotidianas.
Ética y Ciudadana, Competencia Ambiental y de la Salud, Competencia Desarrollo Personal y Espiritual
Valora las normas de convivencia y el trabajo en equipo, respetando las ideas de compañeros para llegar
a acuerdos sobre los temas matemáticos desarrollados.',
    'Conceptos Procedimientos Actitudes y Valores
• Secuencia de números
naturales como mínimo
hasta el 10.
• Adición de números
naturales como mínimo
hasta el 10.
• Sustracción de números
naturales como mínimo
hasta el 10.
• Cuerpos geométricos:
cubo, esfera, cono y
cilindro, prisma y pirámide
rectangulares.
• Conteo de números menores
o iguales a 10 de acuerdo con
diferentes criterios.
• Resolución de problemas
utilizando las operaciones de
adición y sustracción.
• Comparación y clasificación
de cuerpos geométricos de
acuerdo con características
comunes.
• Resolución de problemas que
impliquen prisma rectangular
y pirámide.
• Identificación y relación de
formas del entorno escolar
y familiar con cuerpos
geométricos.
• Disfrute del trabajo en
matemática.
• Actitud de esfuerzo y
perseverancia.
• Disfrute del juego en el aula.',
    '["Construye el significado de las operaciones de adición y sustracción de números naturales hasta el 10","discutiendo situaciones problema.","Expresa, en forma oral, los procesos realizados en la búsqueda de solución a problemas geométricos.","Utiliza formas de pensamiento lógico para la resolución de problemas en contextos cercanos.","Describe figuras geométricas planas y cuerpos geométricos.","Trabaja de manera colaborativa respetando las diferentes ideas y puntos de vista de los demás en el","quehacer matemático de aula."]'::jsonb,
    'Guía Didáctica de Matemática (MINERD / CON BASE)',
    '2023',
    '115 y 116',
    'https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo',
    'pendiente_validacion',
    true,
    '512ba5ffbd3bcfe6c0116fe108925fc90f5f7bf0301f5963d7e99ea03deb9cf2'
) ON CONFLICT (source_id) DO NOTHING;

INSERT INTO public.curriculo_secuencias (
    source_id, nivel, ciclo, grado_num, area, tema, bloque_guia,
    competencias_especificas, contenidos_texto_original, indicadores_logro,
    fuente_documento, version_curricular, pagina, url_fuente,
    estado_validacion, vigente, huella
) VALUES (
    'SEC-PRI-2-MAT-001',
    'Primario',
    'Primer Ciclo',
    2,
    'Matemática',
    'Secuencia 1: Conteo, organizacion y representacion de numeros',
    'Secuencia Didáctica 1',
    'Comunicativa
Explica sus ideas utilizando números naturales para uso del lenguaje cotidiano.
Pensamiento Lógico, Creativo y Crítico; Resolución de Problemas; Tecnológica y Científica
Utiliza la estimación con la finalidad de resolver problemas.
Ética y Ciudadana; Desarrollo Personal y Espiritual; Ambiental y de la Salud
Respeta los puntos de vista y argumentos de los demás sobre situaciones que implican conocimientos
matemáticos.',
    'Conceptos Procedimientos Actitudes y Valores
• Secuencia de números
naturales como mínimo
hasta el 100.
• Adición de números
naturales, sustracción
de números naturales
mínimo hasta el 100.
• Cuerpos geométricos:
cubo, prisma rectangular,
pirámide, esfera, cono,
cilindro.
• Elementos o partes de
los cuerpos geométricos
y figuras planas en las
caras de los cuerpos
geométricos.
• Conteo de números hasta 100 siguiendo
diferentes criterios.
• Composición y descomposición de números
naturales con números mínimos hasta el
100.
• Comparación y ordenamiento de números
menores que 100.
• Resolución de problemas de adición y
sustracción de números naturales mínimo
hasta el 100.
• Aplicación de los signos de =, +, - en juegos
en el aula y otras situaciones de sus
entornos.
• Identificación de cuerpos geométricos: cubo,
prisma rectangular, pirámide, esfera, cono,
cilindro en situaciones de la vida diaria.
• Resolución de problemas que impliquen
el reconocimiento de figuras planas en las
caras de los cuerpos.
• Responsabilidad en
las actuaciones y en
los compromisos
contraídos al
resolver problemas.
• Autonomía en la
identificación de
formas simétricas
del entorno.
• Satisfacción al
sentirse competente.',
    '["Justifica a partir de ideas matemáticas procesos implicados en la"]'::jsonb,
    'Guía Didáctica de Matemática (MINERD / CON BASE)',
    '2023',
    '117, 118 y 119',
    'https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo',
    'pendiente_validacion',
    true,
    '672cc12ab04844811bcd56c6f519953aa3f77e808f16869cc3d13035ac02a271'
) ON CONFLICT (source_id) DO NOTHING;

INSERT INTO public.curriculo_secuencias (
    source_id, nivel, ciclo, grado_num, area, tema, bloque_guia,
    competencias_especificas, contenidos_texto_original, indicadores_logro,
    fuente_documento, version_curricular, pagina, url_fuente,
    estado_validacion, vigente, huella
) VALUES (
    'SEC-PRI-3-MAT-001',
    'Primario',
    'Primer Ciclo',
    3,
    'Matemática',
    'Secuencia 1: Conteo, organizacion y representacion de numeros',
    'Secuencia Didáctica 1',
    'Comunicativa
Representa, leyendo, escribiendo, interpretando y discutiendo, su comprensión de los enunciados de
problemas matemáticos.
Pensamiento Lógico, Creativo y Crítico; Resolución de Problemas; Tecnológica y Científica
Utiliza en forma sistemática estrategias de resolución de problemas, justificando con su lenguaje cotidiano
procesos de razonamientos propios, acerca de un resultado matemático, de forma inductiva y utilizando
recursos concretos.
Ética y Ciudadana; Desarrollo Personal y Espiritual; Ambiental y de la Salud
Interpreta posibles soluciones a situaciones del entorno a partir de sus conocimientos matemáticos.',
    'Conceptos Procedimientos Actitudes y Valores
• Secuencia de números
naturales como mínimo
hasta el 1,000.
• Cálculo mental.
• Adición y sustracción de
números naturales.
• Estimación de sumas y
restas.
• Cuerpos geométricos:
cubo, prisma rectangular,
pirámide.
• Comprensión de la secuencia numérica
como mínimo hasta 1,000.
• Composición y descomposición de números
naturales a partir del valor posicional
mínimo hasta el 1,000.
• Resolución de problemas que requieren el
manejo de números naturales.
• Resolución de problemas utilizando las
operaciones aritméticas que impliquen el
cálculo mental, y estimaciones.
• Cálculo de operaciones de suma y resta
de números naturales cuyo resultado no
exceda a 1,000.
• Identificación de cuerpos geométricos.
• Disfrute del trabajo
en matemática.
• Perseverancia
en el trabajo en
matemática.
• Responsabilidad en
las actuaciones y en
los compromisos
contraídos.',
    '["Expresa, a partir de la lectura y la escritura, ideas matemáticas referidas a"]'::jsonb,
    'Guía Didáctica de Matemática (MINERD / CON BASE)',
    '2023',
    '120, 121, 122 y 123',
    'https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo',
    'pendiente_validacion',
    true,
    '6b5c3e29f08d44860921eac0a5f2b11a23fe37c69b331df7cbd9d3f1054ba836'
) ON CONFLICT (source_id) DO NOTHING;

INSERT INTO public.curriculo_secuencias (
    source_id, nivel, ciclo, grado_num, area, tema, bloque_guia,
    competencias_especificas, contenidos_texto_original, indicadores_logro,
    fuente_documento, version_curricular, pagina, url_fuente,
    estado_validacion, vigente, huella
) VALUES (
    'SEC-PRI-1-MAT-002',
    'Primario',
    'Primer Ciclo',
    1,
    'Matemática',
    'Secuencia 2: Series numericas, patrones y valor de posicion',
    'Secuencia Didáctica 2',
    'Comunicativa
Relaciona materiales y objetos físicos, con ideas matemáticas que expresa para buscar soluciones a
situaciones de problemas elementales relacionados con su entorno cotidiano.
Pensamiento Lógico, Creativo y Crítico; Resolución de Problemas; Científica y Tecnológica
Resuelve situaciones problemáticas, en forma coherente y con el apoyo de recursos manipulativos;
identificando patrones, estructuras o regularidades de forma inductiva para la explicación matemática
de situaciones cotidianas.
Ética y Ciudadana; Desarrollo Personal y Espiritual; Ambiental y de la Salud
Valora las normas de convivencia y el trabajo en equipo, respetando las ideas de compañeros para llegar
a acuerdos sobre los temas matemáticos desarrollados.',
    'Conceptos Procedimientos Actitudes y Valores
• Secuencia de números
naturales hasta el 100.
• Patrones de números.
• Adición de números
naturales hasta el 50.
• Sustracción de números
naturales hasta el 50.
• Medidas y longitud.
• Unidades arbitrarias de
longitud.
• Medidas arbitrarias y
corporales.
• Composición y
descomposición de números
hasta el 100.
• Resolución de problemas
utilizando las operaciones de
adición y sustracción.
• Comparaciones de números
menores o iguales que 100.
• Resolución de problemas
que impliquen medidas de
longitud.
• Valoración del uso del valor
posicional de un número
mínimo a 99.
• Disfrute del trabajo en
matemática con las
operaciones de adición y
sustracción de números
naturales mínimo hasta el
99.
• Disfrute al resolver
problemas de adición y
sustracción de números
naturales mínimo hasta el
99.',
    '["Demuestra comprensión del sistema de numeración decimal y de valor de posición.","Construye el significado de las operaciones de adición y sustracción de números naturales hasta el 50,","discutiendo situaciones de problema.","Expresa, en forma oral, los procesos realizados en la búsqueda de solución a problemas de","mediciones.","Utiliza formas de pensamiento lógico para la resolución de problemas en contextos cercanos.","Reconoce y describe una amplia diversidad de patrones numéricos.","Integra recursos manipulativos como apoyo para la comprensión de las ideas matemáticas y en la","resolución de problemas.","Trabaja de manera colaborativa respetando las diferentes ideas y puntos de vista de los demás en el","quehacer matemático de aula."]'::jsonb,
    'Guía Didáctica de Matemática (MINERD / CON BASE)',
    '2023',
    '115 y 116',
    'https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo',
    'pendiente_validacion',
    true,
    '2657a4ada370b584d411a2446fd00b260aa71de78f388de45ebf9bfed208e7ae'
) ON CONFLICT (source_id) DO NOTHING;

INSERT INTO public.curriculo_secuencias (
    source_id, nivel, ciclo, grado_num, area, tema, bloque_guia,
    competencias_especificas, contenidos_texto_original, indicadores_logro,
    fuente_documento, version_curricular, pagina, url_fuente,
    estado_validacion, vigente, huella
) VALUES (
    'SEC-PRI-2-MAT-002',
    'Primario',
    'Primer Ciclo',
    2,
    'Matemática',
    'Secuencia 2: Series numericas, patrones y valor de posicion',
    'Secuencia Didáctica 2',
    'Comunicativa
Explica sus ideas utilizando números naturales para uso del lenguaje cotidiano.
Pensamiento Lógico, Creativo y Crítico; Resolución de Problemas; Tecnológica y Científica
Utiliza la estimación y medición matemática.
Ética y Ciudadana; Desarrollo Personal y Espiritual; Ambiental y de la Salud
Respeta los puntos de vista y argumentos de los demás sobre situaciones que implican conocimientos
matemáticos referidos al contexto social y ambiental.',
    'Conceptos Procedimientos Actitudes y Valores
• Secuencia de números
naturales como mínimo
hasta el 1,000.
• Adición de números
naturales y sustracción de
números naturales hasta el
100.
• Unidad de medida arbitraria
o convencional.
• Longitudes, unidades
arbitrarias, el centímetro.
• Reglas.
• Composición y
descomposición de números
naturales mínimo hasta el
1,000.
• Comparación y ordenamiento
de números menores o
iguales que 1,000.
• Resolución de problemas de
adición y sustracciones de
números naturales mínimo
hasta el 100.
• Utilización de instrumentos
de medición.
• Uso de materiales del
entorno como unidades
arbitrarias de medida.
• Responsabilidad en las
actuaciones y en los
compromisos contraídos al
resolver problemas.
• Interés al realizar medidas de
longitud.
• Satisfacción al sentirse
competente para medir
objetos en su entorno.
• Valoración al poder utilizar
partes de su cuerpo
para realizar mediciones
arbitrarias.',
    '["Justifica a partir de ideas matemáticas, procesos implicados en la"]'::jsonb,
    'Guía Didáctica de Matemática (MINERD / CON BASE)',
    '2023',
    '117, 118 y 119',
    'https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo',
    'pendiente_validacion',
    true,
    '0f42b152cc8fb18c08f19a2ee0e65195a1a634a9abd81dba7d8fc51ce2b7d86d'
) ON CONFLICT (source_id) DO NOTHING;

INSERT INTO public.curriculo_secuencias (
    source_id, nivel, ciclo, grado_num, area, tema, bloque_guia,
    competencias_especificas, contenidos_texto_original, indicadores_logro,
    fuente_documento, version_curricular, pagina, url_fuente,
    estado_validacion, vigente, huella
) VALUES (
    'SEC-PRI-3-MAT-002',
    'Primario',
    'Primer Ciclo',
    3,
    'Matemática',
    'Secuencia 2: Series numericas, patrones y valor de posicion',
    'Secuencia Didáctica 2',
    'Comunicativa
Representa, leyendo, escribiendo, interpretando y discutiendo, su comprensión de los enunciados de
problemas matemáticos y los conceptos.
Pensamiento Lógico, Creativo y Crítico; Resolución de Problemas; Tecnológica y Científica
Utiliza en forma sistemática estrategias de resolución de problemas, verificando e interpretando sus
resultados con relación a la situación de problema presentada, y justificando con su lenguaje cotidiano,
procesos de razonamientos propios, acerca de un procedimiento o un resultado matemático, de forma
inductiva y utilizando recursos concretos.
Ética y Ciudadana; Desarrollo Personal y Espiritual; Ambiental y de la Salud
Interpreta posibles soluciones a situaciones a partir de sus conocimientos matemáticos.',
    'Conceptos Procedimientos Actitudes y Valores
• Secuencia de números
naturales hasta el
10,000.
• Adición de números
naturales, propiedades
de la adición.
• Sustracción de números
naturales.
• Multiplicación y división
como sumas y restas
reiteradas.
• Unidades de medidas:
centímetro y metro.
• Suma y resta de
longitudes.
• Composición y descomposición de
números naturales a partir del valor
posicional hasta el 10,000.
• Resolución de problemas utilizando
las operaciones aritméticas que
impliquen el cálculo mental,
estimación y propiedades de las
operaciones de adición y sustracción
de números naturales.
• Cálculo de operaciones de suma y
resta de números naturales cuyo
resultado no exceda a 1,000.
• Multiplicación con números
naturales de una cifra por dos cifras.
• División con números naturales de
números de una cifra o dos cifras
entre una cifra.
• Descripción del procedimiento
utilizado para medir longitudes.
• Resolución de problemas de la vida
diaria que involucren medidas de
longitud.
• Disfrute del trabajo en
matemática.
• Perseverancia en el
trabajo en matemática.
• Responsabilidad en las
actuaciones y en los
compromisos contraídos.
• Criticidad al medir
longitudes usando el
centímetro y el metro
como unidades de
medidas.',
    '["Expresa ideas matemáticas sobre temáticas del contexto escolar referidas a"]'::jsonb,
    'Guía Didáctica de Matemática (MINERD / CON BASE)',
    '2023',
    '120, 121, 122 y 123',
    'https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo',
    'pendiente_validacion',
    true,
    'ec964da21f70559a66573544e37c319723d109db94cdc3568a0faa97d395211b'
) ON CONFLICT (source_id) DO NOTHING;

INSERT INTO public.curriculo_secuencias (
    source_id, nivel, ciclo, grado_num, area, tema, bloque_guia,
    competencias_especificas, contenidos_texto_original, indicadores_logro,
    fuente_documento, version_curricular, pagina, url_fuente,
    estado_validacion, vigente, huella
) VALUES (
    'SEC-PRI-1-MAT-003',
    'Primario',
    'Primer Ciclo',
    1,
    'Matemática',
    'Secuencia 3: Suma y resta con agrupamientos de 10',
    'Secuencia Didáctica 3',
    'Comunicativa
Relaciona materiales y objetos físicos con ideas matemáticas que expresa claramente para buscar
soluciones a situaciones elementales relacionados con su entorno cotidiano.
Pensamiento Lógico, Creativo y Crítico; Resolución de Problemas; Científica y Tecnológica
Resuelve situaciones problemáticas, en forma coherente y con el apoyo de recursos manipulativos,
identificando patrones, regularidades de forma inductiva.
Ética y Ciudadana; Desarrollo Personal y Espiritual; Ambiental y de la Salud; Competencia Desarrollo
Personal y Espiritual
Valora las normas de convivencia y el trabajo en equipo, respetando las ideas de compañeros para llegar
a acuerdos sobre los temas matemáticos desarrollados.',
    'Conceptos Procedimientos Actitudes y Valores
• Secuencia de números
naturales como mínimo
hasta el 99.
• Patrones de números.
• Adición de números
naturales como mínimo
hasta 99.
• Sustracción de números
naturales como mínimo
hasta el 99.
• Recolección y organización
de datos no agrupados.
• Tablas de conteo.
• Pictogramas.
• Composición y
descomposición de números
como mínimo hasta el 99.
• Resolución de problemas
utilizando las operaciones de
adición y sustracción.
• Comparaciones de números
menores o iguales que 99.
• Recolección, organización
y clasificación de datos no
agrupados.
• Lectura o interpretación
de pictogramas y tablas de
datos sencillos.
• Disfrute del trabajo en
matemática con las
operaciones de adición y
sustracción de números
naturales mínimo hasta el
99.
• Disfrute al resolver
problemas de adición y
sustracción de números
naturales mínimo hasta el
99.
• Actitud de esfuerzo y
perseverancia en la solución
de problemas.',
    '["Demuestra comprensión del sistema de numeración decimal al relacionar los conceptos de contar y de","valor de posición.","Construye el significado de las operaciones de adición y sustracción de números naturales hasta el 99,","discutiendo situaciones de problema.","Expresa en forma oral los procesos realizados en la búsqueda de solución a problemas.","Utiliza formas de pensamiento lógico para organizar y relacionar informaciones diversas relativas a la","vida cotidiana y a la resolución de problemas en contextos cercanos.","Recoge, organiza y representa datos en tablas de conteo interpretándolos de acuerdo a su contexto","escolar y familiar.","Reconoce y describe una amplia diversidad de patrones numéricos.","Integra recursos manipulativos como apoyo para la comprensión de las ideas matemáticas y en la","resolución de problemas.","Trabaja de manera colaborativa respetando las diferentes ideas y puntos de vista de los demás en el","quehacer matemático de aula."]'::jsonb,
    'Guía Didáctica de Matemática (MINERD / CON BASE)',
    '2023',
    '115 y 116',
    'https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo',
    'pendiente_validacion',
    true,
    '9450053cc351b504541f875229a1db34306cd096a95338bc1c951110e640e428'
) ON CONFLICT (source_id) DO NOTHING;

INSERT INTO public.curriculo_secuencias (
    source_id, nivel, ciclo, grado_num, area, tema, bloque_guia,
    competencias_especificas, contenidos_texto_original, indicadores_logro,
    fuente_documento, version_curricular, pagina, url_fuente,
    estado_validacion, vigente, huella
) VALUES (
    'SEC-PRI-2-MAT-003',
    'Primario',
    'Primer Ciclo',
    2,
    'Matemática',
    'Secuencia 3: Suma y resta con agrupamientos de 10',
    'Secuencia Didáctica 3',
    'Comunicativa
Explica sus ideas utilizando números naturales para uso del lenguaje cotidiano.
Pensamiento Lógico, Creativo y Crítico; Resolución de Problemas; Científica y Tecnológica
Resuelve problemas identificados en su comunidad.
Ética y Ciudadana; Desarrollo Personal y Espiritual; Ambiental y de la Salud
Respeta los puntos de vista y argumentos de los demás sobre situaciones que implican conocimientos
matemáticos referidos al contexto social y ambiental.',
    'Conceptos Procedimientos Actitudes y Valores
• Secuencia de números
naturales como mínimo
hasta el 999.
• Valor de posición: unidad,
decena y centena.
• Adición de números
naturales y sustracción de
números naturales hasta el
999.
• Multiplicación y división
(iniciación).
• Recolección y organización
de datos en tablas.
• Gráficas de barras.
• Composición y
descomposición de números
naturales mínimo hasta el
999.
• Comparación y ordenamiento
de números menores o
iguales que 999.
• Resolución de problemas
de adición y sustracción de
números naturales mínimo
hasta el 999.
• Recolección de datos sobre
preferencias.
• Resolución de problemas que
involucren la recolección,
organización y tabulación e
interpretación de datos no
agrupados en tablas y en
gráficas de barras.
• Responsabilidad en las
actuaciones y en los
compromisos contraídos
al resolver problemas de
adición, sustracción, mínimo
hasta el 999.',
    '["Justifica, a partir de ideas matemáticas, procesos implicados en la"]'::jsonb,
    'Guía Didáctica de Matemática (MINERD / CON BASE)',
    '2023',
    '117, 118 y 119',
    'https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo',
    'pendiente_validacion',
    true,
    'b957901baf1574717b8775ca442b9497095af713d49342ae16ef487297b7c42b'
) ON CONFLICT (source_id) DO NOTHING;

INSERT INTO public.curriculo_secuencias (
    source_id, nivel, ciclo, grado_num, area, tema, bloque_guia,
    competencias_especificas, contenidos_texto_original, indicadores_logro,
    fuente_documento, version_curricular, pagina, url_fuente,
    estado_validacion, vigente, huella
) VALUES (
    'SEC-PRI-3-MAT-003',
    'Primario',
    'Primer Ciclo',
    3,
    'Matemática',
    'Secuencia 3: Suma y resta con agrupamientos de 10',
    'Secuencia Didáctica 3',
    'Comunicativa
Representa, leyendo, escribiendo, interpretando y discutiendo, su comprensión de los enunciados de
problemas matemáticos y los conceptos y propiedades de las operaciones relativas a estos, para establecer
las relaciones entre ellos y con el contexto circundante.
Pensamiento Lógico, Creativo y Crítico; Resolución de Problemas; Científica y Tecnológica
Utiliza en forma sistemática estrategias de resolución de problemas, verificando e interpretando sus
resultados con relación a la situación de problema presentada, y justificando con su lenguaje cotidiano,
procesos de razonamientos propios, acerca de una demostración, un algoritmo o un resultado matemático,
de forma inductiva y utilizando recursos concretos e integrando las tecnologías digitales.
Ética y Ciudadana; Desarrollo Personal y Espiritual; Ambiental y de la Salud
Respeta los puntos de vista y argumentos de los demás sobre situaciones que implican conocimientos
matemáticos referidos al contexto social y ambiental.',
    'Conceptos Procedimientos Actitudes y Valores
• Secuencia de
números naturales
como mínimo hasta
el 999.
• Valor de posición:
unidad, decena y
centena.
• Adición de números
naturales y
sustracción de
números naturales
hasta el 999.
• Multiplicación y
división (iniciación).
• Recolección y
organización de
datos en tablas.
• Gráficas de barras.
• Composición y descomposición de números
naturales a partir del valor posicional hasta el 9,999.
• Resolución de problemas utilizando las operaciones
aritméticas que impliquen el cálculo mental,
estimación y propiedades de las operaciones de
adición y sustracción de números naturales.
• Cálculo de operaciones de suma y resta de números
naturales cuyo resultado no exceda 9,999.
• Multiplicación con números naturales de una cifra
por dos cifras.
• División con números naturales de números de una
cifra o dos cifras entre una cifra con sumas y restas
reiteradas.
• Recolección, organización, registro en tabla y
análisis de datos no agrupados.
• Resolución de problemas relacionados con la
recolección y organización, análisis e interpretación
de datos en tablas y gráficas de barras.
• Disfrute del
trabajo en
matemática.
• Perseverancia
en el trabajo en
matemática.
• Responsabilidad
en las actuaciones
y en los
compromisos
contraídos.
• Satisfacción al
colorear gráficos
de barras.',
    '["Expresa, a partir de la lectura, escritura y traducción, ideas matemáticas sobre temáticas del contexto","escolar referidas a"]'::jsonb,
    'Guía Didáctica de Matemática (MINERD / CON BASE)',
    '2023',
    '120, 121, 122 y 123',
    'https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo',
    'pendiente_validacion',
    true,
    '9582b0e969fc463999a2b07b8e7a0a0811463d315d250bde482803b45e8fd8e9'
) ON CONFLICT (source_id) DO NOTHING;

INSERT INTO public.curriculo_secuencias (
    source_id, nivel, ciclo, grado_num, area, tema, bloque_guia,
    competencias_especificas, contenidos_texto_original, indicadores_logro,
    fuente_documento, version_curricular, pagina, url_fuente,
    estado_validacion, vigente, huella
) VALUES (
    'SEC-PRI-1-MAT-004',
    'Primario',
    'Primer Ciclo',
    1,
    'Matemática',
    'Secuencia 4: Geometria, figuras y analisis de datos',
    'Secuencia Didáctica 4',
    'Comunicativa
Relaciona materiales y objetos físicos con ideas matemáticas que expresa para buscar soluciones a
situaciones de problemas elementales relacionados con su entorno cotidiano.
Pensamiento Lógico, Creativo y Crítico; Resolución de Problemas; Tecnológica y Científica
Resuelve situaciones problemáticas, en forma coherente y con el apoyo de recursos manipulativos,
identificando patrones, estructuras o regularidades.
Ética y Ciudadana; Ambiental y de la Salud; Desarrollo Personal y Espiritual
Valora las normas de convivencia y el trabajo en equipo, respetando las ideas de compañeros para llegar a
acuerdos sobre los temas matemáticos desarrollados.',
    'Conceptos Procedimientos Actitudes y Valores
• Secuencia de números
naturales hasta el 99.
• Adición de números
naturales hasta el 99.
• Sustracción de números
naturales hasta el 99.
• Figuras planas: círculo,
triángulo, cuadrado y
rectángulo.
• Conteo de números menores
que 50 de acuerdo a diferentes
criterios.
• Conteo de dos en dos, de tres
en tres, de cinco en cinco, de
diez en diez.
• Composición y descomposición
de números hasta el 99.
• Resolución de problemas
utilizando las operaciones de
adición y sustracción.
• Resolución de problemas que
impliquen prisma rectangular y
pirámide.
• Identificación y relación de
formas del entorno escolar
y familiar con cuerpos
geométricos y figuras planas
geométricas.
• Disfrute del trabajo en
matemática.
• Actitud de esfuerzo y
perseverancia.
• Disfrute del juego en el aula.',
    '["Demuestra comprensión del sistema de numeración decimal al relacionar los conceptos de contar,","agrupar y de valor de posición.","Construye el significado de las operaciones de adición y sustracción de números naturales hasta el 99,","discutiendo situaciones de problema.","Expresa en forma oral los procesos realizados en la búsqueda de solución a problemas geométricos.","Utiliza formas de pensamiento lógico para la resolución de problemas en contextos cercanos.","Describe y clasifica figuras geométricas planas y cuerpos geométricos.","Reconoce y describe una amplia diversidad de patrones numéricos.","Trabaja de manera colaborativa respetando las diferentes ideas y puntos de vista de los demás en el","quehacer matemático del aula."]'::jsonb,
    'Guía Didáctica de Matemática (MINERD / CON BASE)',
    '2023',
    '115 y 116',
    'https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo',
    'pendiente_validacion',
    true,
    'f3f4acb704d2abdc79b8cbac9793268a1bbe3d351f1b5b312fba91c3f0416f89'
) ON CONFLICT (source_id) DO NOTHING;

INSERT INTO public.curriculo_secuencias (
    source_id, nivel, ciclo, grado_num, area, tema, bloque_guia,
    competencias_especificas, contenidos_texto_original, indicadores_logro,
    fuente_documento, version_curricular, pagina, url_fuente,
    estado_validacion, vigente, huella
) VALUES (
    'SEC-PRI-2-MAT-004',
    'Primario',
    'Primer Ciclo',
    2,
    'Matemática',
    'Secuencia 4: Geometria, figuras y analisis de datos',
    'Secuencia Didáctica 4',
    'Comunicativa
Explica sus ideas utilizando números naturales para uso del lenguaje cotidiano.
Pensamiento Lógico, Creativo y Crítico; Resolución de Problemas; Tecnológica y Científica
Resuelve situaciones problemáticas de numeración, operaciones y geometría.
Ética y Ciudadana; Ambiental y de la Salud; Desarrollo Personal y Espiritual
Respeta los puntos de vista y argumentos de los demás sobre situaciones que implican conocimientos
matemáticos referidos al contexto social y ambiental.',
    'Conceptos Procedimientos Actitudes y Valores
• Secuencia de números
naturales como mínimo
hasta el 999.
• Valor de posición: unidad,
decena y centena.
• Adición y sustracción de
números naturales hasta el
999.
• Multiplicación y división
(iniciación).
• Figuras planas: círculo,
triángulo, cuadrado y
rectángulo.
• Composición y descomposición
de números naturales mínimo
hasta el 999.
• Comparación y ordenamiento
de números menores o iguales
que 999.
• Resolución de problemas de
adición y sustracciones de
números naturales mínimo
hasta el 999.
• Identificación de figuras planas
en situaciones de la vida diaria.
• Resolución de problemas que
impliquen el reconocimiento de
figuras planas en las caras de
los cuerpos.
• Responsabilidad en las
actuaciones y en los
compromisos contraídos al
resolver problemas.',
    '["Justifica, a partir de ideas matemáticas, procesos implicados en la"]'::jsonb,
    'Guía Didáctica de Matemática (MINERD / CON BASE)',
    '2023',
    '117, 118 y 119',
    'https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo',
    'pendiente_validacion',
    true,
    '2b5d0d545ceb158347758ff21b7321bf6dbdcb5ca6398ceecb6477a5c6737876'
) ON CONFLICT (source_id) DO NOTHING;

INSERT INTO public.curriculo_secuencias (
    source_id, nivel, ciclo, grado_num, area, tema, bloque_guia,
    competencias_especificas, contenidos_texto_original, indicadores_logro,
    fuente_documento, version_curricular, pagina, url_fuente,
    estado_validacion, vigente, huella
) VALUES (
    'SEC-PRI-3-MAT-004',
    'Primario',
    'Primer Ciclo',
    3,
    'Matemática',
    'Secuencia 4: Geometria, figuras y analisis de datos',
    'Secuencia Didáctica 4',
    'Comunicativa
Representa, leyendo, escribiendo, interpretando y discutiendo, su comprensión de los enunciados
de problemas matemáticos y los conceptos y propiedades de las operaciones relativas a estos, para
establecer las relaciones entre ellos y con el contexto circundante.
Pensamiento Lógico, Creativo y Crítico; Resolución de Problemas; Tecnológica y Científica
Utiliza en forma sistemática estrategias de resolución de problemas, verificando e interpretando sus
resultados con relación a la situación de problema presentada, y justificando con su lenguaje cotidiano,
procesos de razonamientos propios, utilizando recursos concretos.
Ética y Ciudadana; Ambiental y de la Salud; Desarrollo Personal y Espiritual
Interpreta posibles soluciones a situaciones del entorno a partir de sus conocimientos matemáticos.',
    'Conceptos Procedimientos Actitudes y Valores
• Secuencia de números
naturales hasta el 9,999.
• Valor de posición: unidad,
decena, centena, unidad de
mil.
• Adición de números naturales.
• Propiedades de la adición.
• Sustracción de números
naturales.
• Multiplicación y división como
sumas y restas reiteradas.
• Propiedades de la
multiplicación.
• Números pares e impares.
• Polígonos: triángulos,
cuadriláteros.
• Elementos de los polígonos:
lados, vértices.
• Cuerpos geométricos: cubo,
prisma rectangular, pirámide.
• Composición y
descomposición de números
naturales a partir del valor
posicional hasta el 9,999.
• Cálculo de operaciones de
suma y resta de números
naturales cuyo resultado no
exceda 9,999.
• Multiplicación con números
naturales de una cifra por dos
cifras.
• División con números
naturales de números de
una cifra o dos cifras entre
una cifra con sumas y restas
reiteradas.
• Disfrute del trabajo en
matemática.
• Perseverancia en el trabajo
en matemática.
• Responsabilidad en las
actuaciones y en los
compromisos contraídos.
• Curiosidad e interés por el
aprendizaje.',
    '["Expresa, a partir de la lectura y escritura, ideas matemáticas sobre temáticas del contexto escolar","referidas a"]'::jsonb,
    'Guía Didáctica de Matemática (MINERD / CON BASE)',
    '2023',
    '120, 121, 122 y 123',
    'https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo',
    'pendiente_validacion',
    true,
    '5f85016282e0aa7f6284c5cbbe3142bd3e0e3bbe2207c6bd429ec973a25e7b22'
) ON CONFLICT (source_id) DO NOTHING;

INSERT INTO public.curriculo_secuencias (
    source_id, nivel, ciclo, grado_num, area, tema, bloque_guia,
    competencias_especificas, contenidos_texto_original, indicadores_logro,
    fuente_documento, version_curricular, pagina, url_fuente,
    estado_validacion, vigente, huella
) VALUES (
    'SEC-PRI-1-MAT-005',
    'Primario',
    'Primer Ciclo',
    1,
    'Matemática',
    'Secuencia 5: Recta numerica, medicion y capacidad',
    'Secuencia Didáctica 5',
    'Comunicativa
Relaciona materiales y objetos físicos e imágenes con ideas matemáticas que expresa claramente para
buscar soluciones a situaciones de problemas elementales relacionados con su entorno cotidiano.
Pensamiento Lógico, Creativo y Crítico; Resolución de Problemas; Tecnológica y Científica
Resuelve situaciones problemáticas, en forma coherente y con el apoyo de recursos manipulativos y
digitales, identificando patrones, o regularidades de forma inductiva para la explicación matemática de
situaciones cotidianas.
Ética y Ciudadana; Ambiental y de la Salud; Desarrollo Personal y Espiritual
Valora las normas de convivencia y el trabajo en equipo, respetando las ideas de compañeros para llegar a
acuerdos sobre los temas matemáticos desarrollados.',
    'Conceptos Procedimientos Actitudes y Valores
• Secuencia de números
naturales como mínimo
hasta el 99.
• Patrones de números.
• Valor de posición: unidad y
decena.
• Adición de números
naturales como mínimo
hasta el 99.
• Sustracción de números
naturales como mínimo
hasta el 99.
• Medida de capacidad.
• Conteo de números menores
que 99 de acuerdo con
diferentes criterios.
• Composición de números como
mínimo hasta el 99.
• Resolución de problemas
utilizando las operaciones de
adición y sustracción.
• Disfruta del trabajo en
matemática con las
operaciones de adición y
sustracción de números
naturales mínimo hasta el
99.
• Actitud de esfuerzo y
perseverancia.',
    '["Demuestra comprensión del sistema de numeración decimal al relacionar los conceptos de contar,","agrupar y de valor de posición.","Construye el significado de las operaciones de adición y sustracción de números naturales hasta el 99,","discutiendo situaciones de problema.","Expresa, en forma oral los procesos realizados en la búsqueda de solución a problemas de mediciones.","Utiliza formas de pensamiento lógico para organizar y relacionar informaciones diversas relativas a la","vida cotidiana y a la resolución de problemas en contextos cercanos.","Reconoce y describe una amplia diversidad de patrones numéricos.","Trabaja de manera colaborativa respetando las diferentes ideas y puntos de vista de los demás en el","quehacer matemático de aula."]'::jsonb,
    'Guía Didáctica de Matemática (MINERD / CON BASE)',
    '2023',
    '115 y 116',
    'https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo',
    'pendiente_validacion',
    true,
    '30e4e4075f401cae35fdd3eca6b485e1a6287a1f2f2bf713b5d9358cf9550db4'
) ON CONFLICT (source_id) DO NOTHING;

INSERT INTO public.curriculo_secuencias (
    source_id, nivel, ciclo, grado_num, area, tema, bloque_guia,
    competencias_especificas, contenidos_texto_original, indicadores_logro,
    fuente_documento, version_curricular, pagina, url_fuente,
    estado_validacion, vigente, huella
) VALUES (
    'SEC-PRI-2-MAT-005',
    'Primario',
    'Primer Ciclo',
    2,
    'Matemática',
    'Secuencia 5: Recta numerica, medicion y capacidad',
    'Secuencia Didáctica 5',
    'Comunicativa
Explica sus ideas utilizando números naturales para uso del lenguaje cotidiano.
Pensamiento Lógico, Creativo y Crítico; Resolución de Problemas; Tecnológica y Científica
Utiliza la estimación y medición matemática con la finalidad de resolver problemas.
Ética y Ciudadana; Ambiental y de la Salud; Desarrollo Personal y Espiritual
Respeta los puntos de vista y argumentos de los demás sobre situaciones que implican conocimientos
matemáticos referidos al contexto ambiental.',
    'Conceptos Procedimientos Actitudes y Valores
• Secuencia de números
naturales como mínimo
hasta el 999.
• Valor de posición: unidad,
decena y centena.
• Adición de números
naturales, sustracción de
números naturales mínimo
hasta el 999, multiplicación
de números naturales
(cuyos factores sean
menores que diez).
• Patrones numéricos en la
recta numérica.
• Medidas de capacidad,
unidades arbitrarias de
capacidad, la taza, el litro y
estimación de capacidades.
• Resolución de problemas
de adición y sustracción de
números naturales mínimo
hasta el 999.
• Resolución de problemas de
multiplicación de números
naturales cuyos factores sean
menores que 10.
• Uso de materiales del entorno
como unidades arbitrarias de
medida.
• Medición y estimación de
capacidad en situaciones
diversas y a partir de taza y
litro.
• Responsabilidad en las
actuaciones y en los
compromisos contraídos
al resolver problemas de
adición, sustracción, mínimo
hasta el 999, y multiplicación
de números naturales cuyos
factores sean menores que
diez.
• Autonomía.
• Satisfacción al sentirse
competente para medir
objetos en su entorno.',
    '["Justifica, a partir de ideas matemáticas, procesos implicados en la"]'::jsonb,
    'Guía Didáctica de Matemática (MINERD / CON BASE)',
    '2023',
    '117, 118 y 119',
    'https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo',
    'pendiente_validacion',
    true,
    '4aae1fcd8e19b2c775e4f6b1e10a8baec4c0a5378f111cf7964661f5c0d8f4f6'
) ON CONFLICT (source_id) DO NOTHING;

INSERT INTO public.curriculo_secuencias (
    source_id, nivel, ciclo, grado_num, area, tema, bloque_guia,
    competencias_especificas, contenidos_texto_original, indicadores_logro,
    fuente_documento, version_curricular, pagina, url_fuente,
    estado_validacion, vigente, huella
) VALUES (
    'SEC-PRI-3-MAT-005',
    'Primario',
    'Primer Ciclo',
    3,
    'Matemática',
    'Secuencia 5: Recta numerica, medicion y capacidad',
    'Secuencia Didáctica 5',
    'Comunicativa
Representa leyendo, escribiendo, interpretando y discutiendo, su comprensión de los enunciados de
problemas matemáticos y los conceptos y propiedades de las operaciones relativas a estos, para establecer
las relaciones entre ellos y con el contexto circundante.
Pensamiento Lógico, Creativo y Crítico; Resolución de Problemas; Tecnológica y Científica
Utiliza en forma sistemática estrategias de resolución de problemas, verificando e interpretando sus
resultados con relación a la situación de problema presentada, y justificando con su lenguaje cotidiano
procesos de razonamientos propios acerca de un procedimiento o un resultado matemático, de forma
inductiva y utilizando recursos concretos.
Ética y Ciudadana; Ambiental y de la Salud; Desarrollo Personal y Espiritual
Interpreta posibles soluciones a situaciones del entorno a partir de sus conocimientos matemáticos.',
    'Conceptos Procedimientos Actitudes y Valores
• Secuencia de números
naturales como
mínimo hasta el
99,999.
• Valor de posición:
unidad, decena,
centena, unidad de mil
y decena de mil.
• Recta numérica.
• Cálculo mental, adición
de números naturales,
propiedades de la
adición, sustracción de
números naturales
• Multiplicación y
división como sumas
y restas de sumando y
restando iguales.
• Propiedades de la
multiplicación.
• Capacidad, taza,
litro, medio litro,
equivalencia entre litro
y taza.
• Comprensión de la secuencia numérica como
mínimo hasta 99,999.
• Composición y descomposición de números
naturales a partir del valor posicional mínimo
hasta el 99,999.
• Resolución de problemas que impliquen el uso de
la recta numérica.
• Resolución de problemas utilizando las
operaciones aritméticas y las propiedades de las
operaciones de adición y sustracción de números
naturales.
• Cálculo de operaciones de suma y resta de
números naturales cuyo resultado no exceda a
99,999.
• Multiplicación con números naturales de una cifra
por dos cifras, con resultados que no excedan
los 99,999. Resolución de problemas en la recta
numérica.
• Identificación de patrones numéricos en la recta
numérica.
• Estimación y medición de capacidades de distintos
recipientes del entorno usando la taza y el litro.
• Resolución de problemas que impliquen: taza, litro,
medio litro, equivalencia entre litro y taza.
• Identificación de fracciones comunes en
situaciones de su entorno de aula y de su
comunidad.
• Responsabilidad
en las
actuaciones
y en los
compromisos
contraídos
al resolver
problemas
de adición,
sustracción,
mínimo hasta
el 999, y
multiplicación
de números
naturales cuyos
factores sean
menores que
diez.
• Autonomía.
• Satisfacción
al sentirse
competente
para medir
objetos en su
entorno.',
    '["Expresa, a partir de la lectura y escritura, ideas matemáticas referidas a"]'::jsonb,
    'Guía Didáctica de Matemática (MINERD / CON BASE)',
    '2023',
    '120, 121, 122 y 123',
    'https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo',
    'pendiente_validacion',
    true,
    'b252dd16c561230196e5413a5fa0415af2229d3a468b730a6ef2309a4db4f346'
) ON CONFLICT (source_id) DO NOTHING;

INSERT INTO public.curriculo_secuencias (
    source_id, nivel, ciclo, grado_num, area, tema, bloque_guia,
    competencias_especificas, contenidos_texto_original, indicadores_logro,
    fuente_documento, version_curricular, pagina, url_fuente,
    estado_validacion, vigente, huella
) VALUES (
    'SEC-PRI-1-MAT-006',
    'Primario',
    'Primer Ciclo',
    1,
    'Matemática',
    'Secuencia 6: Estimacion, redondeo y operaciones avanzadas',
    'Secuencia Didáctica 6',
    'Comunicativa
Relaciona materiales y objetos físicos, imágenes y diagramas con ideas matemáticas que expresa claramente
para buscar soluciones a situaciones de problemas elementales relacionados con su entorno cotidiano.
Pensamiento Lógico, Creativo y Crítico; Competencia Resolución de Problemas; Competencia Tecnológica
y Científica
Formula y resuelve situaciones problemáticas, en forma coherente y con el apoyo de recursos manipulativos
y digitales; identificando patrones, estructuras o regularidades de forma inductiva para la explicación
matemática de situaciones cotidianas.
Ética y Ciudadana; Competencia Ambiental y de la Salud; Competencia Desarrollo Personal y Espiritual
Valora las normas de convivencia y el trabajo en equipo, respetando las ideas de compañeros para llegar a
acuerdos sobre los temas matemáticos desarrollados.',
    'Conceptos Procedimientos Actitudes y Valores
• Secuencia de números
naturales como mínimo
hasta el 99.
• Patrones de números.
• Valor de posición: unidad y
decena.
• Adición de números
naturales como mínimo
hasta el 99.
• Sustracción de números
naturales como mínimo
hasta el 99.
• Simbología de =.
• Recolección y organización
de datos no agrupados.
• Tablas de conteo.
• Pictogramas.
• Composición y descomposición de
números como mínimo hasta el 99.
• Resolución de problemas utilizando las
operaciones de adición y sustracción.
• Uso de la simbología de =.
• Recolección, organización y
clasificación de datos no agrupados.
• Elaboración de tablas de conteo, dada
una serie de objetos distintos, haciendo
una marca a medida que localiza cada
objeto del tipo que está contando.
• Elaboración e interpretación de
pictogramas elaborados con objetos de
su entorno: juguetes, lápices, alimentos.
• Lectura o interpretación de pictogramas
y tablas de datos sencillos usando
herramientas tecnológicas.
• Disfrute del trabajo
en matemática con
las operaciones de
adición y sustracción
de números naturales
mínimo hasta el 99.
• Disfrute al resolver
problemas de adición
y sustracción de
números naturales
mínimo hasta el 99.
• Actitud de esfuerzo y
perseverancia.
• Disfrute del juego en el
aula.',
    '["Demuestra comprensión del sistema de numeración decimal al relacionar los conceptos de contar, agrupar","y de valor de posición.","Construye el significado de las operaciones de adición y sustracción de números naturales hasta el 99,","modelando y discutiendo situaciones de problema.","Expresa, en forma oral y por escrito, los procesos realizados en la búsqueda de solución a problemas.","Utiliza formas de pensamiento lógico para organizar y relacionar informaciones diversas relativas a la vida","cotidiana y a la resolución de problemas en contextos cercanos.","Recoge, organiza, describe datos y los representa en tablas de conteo y pictogramas, interpretándolos de","acuerdo a su contexto escolar y familiar.","Reconoce y describe una amplia diversidad de patrones numéricos.","Trabaja de manera colaborativa respetando las diferentes ideas y puntos de vista de los demás en el","quehacer matemático de aula."]'::jsonb,
    'Guía Didáctica de Matemática (MINERD / CON BASE)',
    '2023',
    '115 y 116',
    'https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo',
    'pendiente_validacion',
    true,
    '019e77a97afe6a000e5a212c2c01d3be94230a698fb300e362a0796d923c6534'
) ON CONFLICT (source_id) DO NOTHING;

INSERT INTO public.curriculo_secuencias (
    source_id, nivel, ciclo, grado_num, area, tema, bloque_guia,
    competencias_especificas, contenidos_texto_original, indicadores_logro,
    fuente_documento, version_curricular, pagina, url_fuente,
    estado_validacion, vigente, huella
) VALUES (
    'SEC-PRI-2-MAT-006',
    'Primario',
    'Primer Ciclo',
    2,
    'Matemática',
    'Secuencia 6: Estimacion, redondeo y operaciones avanzadas',
    'Secuencia Didáctica 6',
    'Comunicativa
Explica sus ideas utilizando números naturales para uso del lenguaje cotidiano.
Pensamiento Lógico, Creativo y Crítico; Resolución de Problemas; Tecnológica y Científica
Resuelve problemas identificados en su comunidad.
Ética y Ciudadana; Desarrollo Personal y Espiritual; Ambiental y de la Salud
Respeta los puntos de vista y argumentos de los demás sobre situaciones que implican conocimientos
matemáticos.',
    'Conceptos Procedimientos Actitudes y Valores
• Secuencia de números
naturales como mínimo
hasta el 999.
• Valor de posición: unidad,
decena y centena.
• Símbolo =.
• Adición de números
naturales, sustracción
de números naturales
mínimo hasta el 999,
multiplicación de números
naturales (cuyos factores
sean menores que diez),
signos =, +, - y x.
• Recolección y organización
de datos en tablas.
• Gráficas de barras.
• Composición y descomposición de
números naturales con números
mínimo hasta el 999.
• Comparación y ordenamiento de
números menores que 999.
• Resolución de problemas de adición
y sustracción de números naturales
mínimo hasta el 999.
• Aplicación de los signos de =, +, - y x en
juegos en el aula y otras situaciones de
sus entornos.
• Multiplicación de números naturales
cuyos factores sean menores que diez.
• Recolección de datos.
• Resolución de problemas que
involucren la recolección, organización
y tabulación e interpretación de datos
no agrupados en tablas y en barras.
• Resolución de problemas de
organización e interpretación de datos.
• Responsabilidad en
las actuaciones y en
los compromisos
contraídos al resolver
problemas de
adición, sustracción,
mínimo hasta el 999,
y multiplicación de
números naturales
cuyos factores sean
menores que diez.
• Autonomía.
• Satisfacción al sentirse
competente.',
    '["Justifica, a partir de ideas matemáticas, procesos implicados en la"]'::jsonb,
    'Guía Didáctica de Matemática (MINERD / CON BASE)',
    '2023',
    '117, 118 y 119',
    'https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo',
    'pendiente_validacion',
    true,
    '8cc28a088940e84931d123c4660211200da6f273f8dc018b1738214766fc0cfb'
) ON CONFLICT (source_id) DO NOTHING;

INSERT INTO public.curriculo_secuencias (
    source_id, nivel, ciclo, grado_num, area, tema, bloque_guia,
    competencias_especificas, contenidos_texto_original, indicadores_logro,
    fuente_documento, version_curricular, pagina, url_fuente,
    estado_validacion, vigente, huella
) VALUES (
    'SEC-PRI-3-MAT-006',
    'Primario',
    'Primer Ciclo',
    3,
    'Matemática',
    'Secuencia 6: Estimacion, redondeo y operaciones avanzadas',
    'Secuencia Didáctica 6',
    'Comunicativa
Representa, leyendo, escribiendo, interpretando y discutiendo, su comprensión de los enunciados de
problemas matemáticos y los conceptos y propiedades de las operaciones relativas a estos, para establecer
las relaciones entre ellos y con el contexto circundante.
Pensamiento Lógico, Creativo y Crítico; Resolución de Problemas; Científica y Tecnológica
Utiliza en forma sistemática estrategias de resolución de problemas, verificando e interpretando sus
resultados con relación a la situación de problema presentada, y justificando con su lenguaje cotidiano,
procesos de razonamientos propios, acerca de una justificación, un procedimiento o un resultado
matemático, de forma inductiva.
Ética y Ciudadana; Desarrollo Personal y Espiritual; Ambiental y de la Salud
Interpreta posibles soluciones a situaciones del entorno y el medioambiente a partir de sus conocimientos
matemáticos.',
    'Conceptos Procedimientos Actitudes y Valores
• Secuencia de números
naturales como mínimo
hasta el 99,999.
• Valor de posición: unidad,
decena, centena, unidad de
mil y decena de mil.
• Recta numérica.
• Cálculo mental, adición
de números naturales,
término de la adición,
propiedades de la adición,
sustracción de números
naturales, estimación de
sumas y restas.
• Multiplicación y división.
• Propiedades de la
multiplicación.
• Recolección, organización
y análisis de datos no
agrupados.
• Tablas de conteo.
• Gráficas de barras.
• Comprensión de la secuencia numérica
como mínimo hasta 99,999.
• Composición y descomposición de
números naturales a partir del valor
posicional, mínimo hasta el 99,999.
• Resolución de problemas que requieren
el manejo de números naturales.
• Cálculo de operaciones de suma y resta
de números naturales cuyo resultado
no exceda a 99,999.
• Multiplicación con números naturales
de una cifra por dos cifras y una cifra
por tres cifras.
• División con números naturales de dos
cifras entre una cifra.
• Recolección, organización, clasificación,
registro en tabla y análisis de datos no
agrupados.
• Clasificación y organización de datos de
acuerdo a criterios definidos.
• Resolución de problemas relacionados
con la recolección y organización,
análisis e interpretación de datos en
tablas de conteo, y gráficas de barras.
• Disfrute del trabajo en
matemática.
• Perseverancia en el
trabajo en matemática.
• Responsabilidad en
las actuaciones y en
los compromisos
contraídos.
• Curiosidad e interés por
el aprendizaje.
• Interés en leer tablas
de conteo, gráficas de
barras.
• Satisfacción al trabajar
con gráficos de barras.',
    '["Expresa, a partir de la lectura, escritura y traducción, ideas matemáticas sobre temáticas del contexto","escolar referidas a"]'::jsonb,
    'Guía Didáctica de Matemática (MINERD / CON BASE)',
    '2023',
    '120, 121, 122, 123',
    'https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo',
    'pendiente_validacion',
    true,
    'fe76c3c214d612826370618b632a1d7c66f71538a21aa73b20eb277a05008514'
) ON CONFLICT (source_id) DO NOTHING;

INSERT INTO public.curriculo_secuencias (
    source_id, nivel, ciclo, grado_num, area, tema, bloque_guia,
    competencias_especificas, contenidos_texto_original, indicadores_logro,
    fuente_documento, version_curricular, pagina, url_fuente,
    estado_validacion, vigente, huella
) VALUES (
    'SEC-PRI-1-ESP-007',
    'Primario',
    'Primer Ciclo',
    1,
    'Lengua Española',
    '“YO SOY”',
    'Página 30',
    'Comunicativa. Expresa y comprende, de forma oral y escrita en diferentes contextos,
textos funcionales y literarios muy sencillos y de estructura sintáctica simple, mediante el uso de medios
y recursos apropiados, demostrando avance progresivo en sus procesos de lectura y escritura.',
    'CONCEPTUALES PROCEDIMENTALES ACTITUDINALES Y VALORES
• La tarjeta de
identidad
• Estructura (nombre y
apellido).
• Función del nombre
propio.
• Identificación de palabras que riman con
los nombres.
• Conteo de las sílabas, identificación de
la sílaba inicial/final de los nombres.
• Pronunciación y asociación de su
nombre con la tarjeta de identidad que
lo contiene.
• Pronunciación de palabras que riman
con su nombre. Descomposición en
sílaba de su nombre y/o del nombre de
compañeros.
• Lectura de su nombre y del de sus
compañeros.
• Definición de la situación de escritura
(para qué elaborar la tarjeta de
identidad).
• Planificación, escritura del primer
borrador, revisión y corrección de la
escritura de su nombre, en su tarjeta de
identidad, con la ayuda de pares y del
docente y publicación de su tarjeta de
identidad en un lugar visible del aula.
• Edición de su documento utilizando
mayúsculas al inicio de su nombre y
apellido.
• Reconocimiento de sus
características propias
y fortalecimiento de su
identidad.
• Cuidado en la
presentación, orden
y limpieza en la
elaboración de su tarjeta
de identidad para que
pueda ser comprendida
por otras personas.',
    '["Comunica sus ideas de forma oral y escrita, de acuerdo con sus conocimientos mediante un tipo de","Lee convencionalmente textos sencillos funcionales.","Muestra respeto ante las opiniones de los demás.","Expresa valores que lo identifican culturalmente, mediante textos sencillos que lee y escribe."]'::jsonb,
    'Guia Didactica LenguaEsp  Multigrado WEB',
    '2023',
    '30',
    'https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo',
    'pendiente_validacion',
    true,
    '2b547818d436c5ddf3fb7e0b7468ef7842fa06ff5b12ddb73bfffbad1efec5b7'
) ON CONFLICT (source_id) DO NOTHING;

INSERT INTO public.curriculo_secuencias (
    source_id, nivel, ciclo, grado_num, area, tema, bloque_guia,
    competencias_especificas, contenidos_texto_original, indicadores_logro,
    fuente_documento, version_curricular, pagina, url_fuente,
    estado_validacion, vigente, huella
) VALUES (
    'SEC-PRI-1-ESP-008',
    'Primario',
    'Primer Ciclo',
    1,
    'Lengua Española',
    'Lengua Española Multigrado • 55',
    'Página 56',
    'Comunicativa. Expresa y comprende, de forma oral y escrita en diferentes contextos,
textos funcionales y literarios muy sencillos y de estructura sintáctica simple, mediante el uso de medios
y recursos apropiados, demostrando avance progresivo en sus procesos de lectura y escritura.',
    'CONCEPTUALES PROCEDIMENTALES ACTITUDINALES Y VALORES
Letrero
• Función y Estructura
(palabras y/o
Imágenes).
• Función del tamaño
de las letras.
• Nombres propios y
comunes.
• Escucha atenta de información de los
letreros leídos por el docente.
• Reconocimiento de la estructura de los
letreros leídos por el docente.
• Identificación de palabras que riman con
unas extraída del letrero.
• Establecimiento de la intención
comunicativa del letrero.
• Lectura en voz alta de letreros.
• Escritura, revisión y corrección del
borrador.
• Edición y publicación del letrero.
• Valoración del uso de los
letreros en la escuela
y en su comunidad
como un medio de
identificación de objetos,
lugares o situaciones.
• Interés por conocer
los letreros y su
funcionalidad en la vida
cotidiana.
• Cuidado en la
presentación, orden
y limpieza en la
elaboración de su letrero.
Lista de compras
• Función.
• Estructura.
• Silueta.
• Distinción números y
palabras.
• Identificación de palabras que riman con
otras contenidas en la lista de compras.
• Diferenciación de palabras cortas
y largas en la lista de compras que
escucha.
• Establecimiento de la intención
comunicativa.
• Lectura en voz alta de los nombres de
los productos escritos en su lista de
compras.
• Escritura, revisión y corrección de su
escrito. Edición y publicación de su lista
de compras.
• Valoración del uso de la
lista de compras como
forma de organización
para la adquisición de los
productos.
• Cuidado en la
presentación, orden
y limpieza en la
elaboración de su lista de
compras.',
    '["Comunica sus ideas de forma oral y escrita, de acuerdo con sus conocimientos mediante un tipo de","Lee convencionalmente textos sencillos funcionales.","Muestra respeto ante las opiniones de los demás."]'::jsonb,
    'Guia Didactica LenguaEsp  Multigrado WEB',
    '2023',
    '56',
    'https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo',
    'pendiente_validacion',
    true,
    '6a189f26cd9f7d646cfd1fb9b4d005aec6486e9dfbb03113883772ebb666a6d4'
) ON CONFLICT (source_id) DO NOTHING;

INSERT INTO public.curriculo_secuencias (
    source_id, nivel, ciclo, grado_num, area, tema, bloque_guia,
    competencias_especificas, contenidos_texto_original, indicadores_logro,
    fuente_documento, version_curricular, pagina, url_fuente,
    estado_validacion, vigente, huella
) VALUES (
    'SEC-PRI-1-ESP-009',
    'Primario',
    'Primer Ciclo',
    1,
    'Lengua Española',
    'Unidad Curricular Pág. 82',
    'Página 82',
    'Comunicativa. Expresa y comprende, de forma oral y escrita en diferentes contextos,
textos funcionales y literarios muy sencillos y de estructura sintáctica simple, mediante el uso de medios
y recursos apropiados, demostrando avance progresivo en sus procesos de lectura y escritura.',
    'CONCEPTUALES PROCEDIMENTALES ACTITUDINALES Y VALORES
La noticia
• Función y Estructura
(titular, cuerpo de la
noticia, foto y pie de
foto).
• Preguntas de la
noticia: qué ocurrió,
a quién le ocurrió,
dónde ocurrió, cuándo
y cómo ocurrió.
• Escucha atenta de noticias leídas por su
docente.
• Paráfrasis de las ideas principales de la
noticia.
• Identificación del sonido común en el
medio/en diferentes posiciones de dos o
más palabras de la noticia que escucha.
• Conteo de las palabras que componen el
título de la noticia que escucha.
• Selección del suceso sobre el que
informará en la noticia.
• Narración, con fluidez y entonación
adecuada, de la noticia.
• Identificación de las palabras tomando
en cuenta los espacios en blanco.
• Conteo de palabras contenidas en el
titular de la noticia.
• Establecimiento, en actividades escritas,
de la correspondencia entre letras y
sonidos de palabras correspondientes al
titular y al cuerpo de la noticia.
• Escritura del primer borrador de su
noticia.
• Revisión y corrección de su noticia con
ayuda del docente y de sus compañeros.
• Edición y publicación de su noticia.
• Valoración de la
importancia de escuchar
y elaborar noticias para
estar informado sobre
situaciones importantes
de su escuela, su
comunidad, su país y el
mundo.
• Interés por lo que sucede
en su entorno y por
contarlo a través de
noticias.
• Interés por escribir
noticias sobre sucesos de
su entorno.
• Cuidado en la
presentación, orden
y limpieza en la
elaboración de su noticia.',
    '["Comunica sus ideas de forma oral y escrita, de acuerdo con sus conocimientos mediante una noticia.","Lee convencionalmente el texto funcional de la noticia.","Muestra respeto ante las opiniones de los demás.","Expresa valores que lo identifican culturalmente, mediante textos sencillos que lee y escribe."]'::jsonb,
    'Guia Didactica LenguaEsp  Multigrado WEB',
    '2023',
    '82',
    'https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo',
    'pendiente_validacion',
    true,
    '239dccffb4a36c342ea5bc2d052329d52f1bc6a17fad533be95fadf7d4fea49e'
) ON CONFLICT (source_id) DO NOTHING;

INSERT INTO public.curriculo_secuencias (
    source_id, nivel, ciclo, grado_num, area, tema, bloque_guia,
    competencias_especificas, contenidos_texto_original, indicadores_logro,
    fuente_documento, version_curricular, pagina, url_fuente,
    estado_validacion, vigente, huella
) VALUES (
    'SEC-PRI-1-ESP-010',
    'Primario',
    'Primer Ciclo',
    1,
    'Lengua Española',
    'Unidad Curricular Pág. 106',
    'Página 106',
    'Comunicativa. Expresa y comprende, de forma oral y escrita en diferentes contextos,
textos funcionales y literarios muy sencillos y de estructura sintáctica simple, mediante el uso de medios
y recursos apropiados, demostrando avance progresivo en sus procesos lectura y escritura.',
    'CONCEPTUALES PROCEDIMENTALES ACTITUDINALES Y VALORES
El cuento
• Estructura (inicio,
nudo y desenlace).
• Uso de las fórmulas
convencionales de
inicio y cierre.
• Escucha atenta de cuentos sencillos
leídos por su docente.
• Identificación de la estructura del
cuento (inicio, desarrollo y desenlace)
y explicación del vocabulario clave
relacionado con el tema para
comprender su contenido.
• Identificación y descripción de los
personajes del cuento con vocabulario
sencillo.
• Paráfrasis de las ideas principales del
cuento.
• Identificación de los signos de
puntuación (punto, raya) utilizados para
delimitar oraciones y párrafos.
• Establecimiento, en actividades escritas,
de la correspondencia entre letras
y sonidos de palabras que lee en el
cuento.
• Escritura de un borrador de cuento.
• Revisión, corrección y edición de un
cuento.
• Disfrute al escuchar
cuentos.
• Interés y curiosidad por
realizar predicciones de
cuentos que escucha.
• Disfrute al narrar
cuentos.
• Disfrute al escribir
cuentos.
• Cuidado en la
presentación, orden
y limpieza en la
elaboración de su cuento.',
    '["Comunica sus ideas de forma oral y escrita, de acuerdo con sus conocimientos mediante un tipo de","texto (cuento).","Lee convencionalmente textos literarios sencillos (cuentos).","Muestra respeto ante las opiniones de los demás.","Expresa valores que lo identifican culturalmente, mediante textos sencillos que lee y escribe."]'::jsonb,
    'Guia Didactica LenguaEsp  Multigrado WEB',
    '2023',
    '106',
    'https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo',
    'pendiente_validacion',
    true,
    '19165c1476dfdd900bc530c31b25c593f8f90ca61ca766f0c447ae4f6ae82935'
) ON CONFLICT (source_id) DO NOTHING;

INSERT INTO public.curriculo_secuencias (
    source_id, nivel, ciclo, grado_num, area, tema, bloque_guia,
    competencias_especificas, contenidos_texto_original, indicadores_logro,
    fuente_documento, version_curricular, pagina, url_fuente,
    estado_validacion, vigente, huella
) VALUES (
    'SEC-PRI-2-ESP-006',
    'Primario',
    'Primer Ciclo',
    2,
    'Lengua Española',
    'Unidad Curricular Pág. 138',
    'Página 138',
    'Comunicativa. Expresa y comprende, de forma oral y escrita en diferentes contextos, textos
funcionales y literarios muy sencillos y de estructura sintáctica simple, mediante el uso de medios y recursos
apropiados, demostrando avance progresivo en sus procesos de lectura y escritura.',
    'CONCEPTUALES PROCEDIMENTALES ACTITUDINALES Y VALORES
El artículo expositivo
• Función y estructura
• expositiva
(introducción,
desarrollo y
conclusión).
• La descripción como
uno de los 5 modos de
organización.
• Presente de
indicativo: verbos
como ser, estar,
parecer, tener, existir,
etc.
• Adjetivos y adverbios
en la descripción.
• Conectores de adición
en la descripción del
artículo.
• Escucha atenta de artículos de
divulgación científica leídos por su
docente.
• Realización de las inferencias necesarias
para comprender el sentido global
del artículo expositivo que escucha
y realizar paráfrasis de las ideas
principales.
• Lectura en voz alta del artículo
expositivo.
• Lectura de artículos expositivos en
silencio y con concentración.
• Planificación de la escritura del artículo:
estructura, coherencia, cohesión y
puntuación.
• Escritura del borrador del artículo de
divulgación científica.
• Revisión y corrección del artículo.
• Valoración de la objetividad
de las informaciones que
escucha para conocer y
explicar temas de interés
científico.
• Interés por informar y
explicar objetivamente
sobre fenómenos diversos
a través de artículos de
divulgación científica.
• Valoración de la
importancia de investigar
para informar y explicar
a otros sobre fenómenos
diversos.
• Cuidado en la presentación,
legibilidad de su escritura,
orden y limpieza en la
elaboración de su artículo
expositivo.',
    '["Utiliza textos orales y escritos para comunicar sus ideas en variados contextos sociales.","Produce textos orales y escritos sobre temas y problemas sociales de su entorno local y nacional.","Formula opiniones críticas y creativas mediante textos variados, respetando las ajenas de sus","interlocutores.","Para primer y segundo grado se focalizan contenidos procedimentales importantes para la alfabetización como:","Escritura de palabras y oraciones breves.","Conciencia fonológica y fonográfica.","Descripciones.","Uso de adjetivos.","Concordancia entre sustantivos y adjetivos.","Identificación de familias de palabras."]'::jsonb,
    'Guia Didactica LenguaEsp  Multigrado WEB',
    '2023',
    '138',
    'https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo',
    'pendiente_validacion',
    true,
    '677373ddbcf54f6fe484b1a5fc6f81b645a098b1f37c7bb43c1185703292aec9'
) ON CONFLICT (source_id) DO NOTHING;

INSERT INTO public.curriculo_secuencias (
    source_id, nivel, ciclo, grado_num, area, tema, bloque_guia,
    competencias_especificas, contenidos_texto_original, indicadores_logro,
    fuente_documento, version_curricular, pagina, url_fuente,
    estado_validacion, vigente, huella
) VALUES (
    'SEC-PRI-1-ESP-011',
    'Primario',
    'Primer Ciclo',
    1,
    'Lengua Española',
    '• Primer grado: El mensaje corto',
    'Página 164',
    'Comunicativa. Expresa y comprende, de forma oral y escrita en diferentes contextos,
textos funcionales y literarios muy sencillos y de estructura sintáctica simple, mediante el uso de medios y
recursos apropiados, demostrando avance progresivo en sus procesos de lectura y escritura.',
    'CONCEPTUALES PROCEDIMENTALES ACTITUDINALES Y
VALORES
El mensaje corto
• Función y
estructura (fecha,
destinatario,
cuerpo del
mensaje y
firma, signos de
puntuación).
• Escucha atenta de mensajes leídos por el docente.
• Utilización de la estructura y el vocabulario del
mensaje que escucha (fecha, destinatario, cuerpo
del mensaje y firma) para comprender su contenido.
• Conteo de las palabras que componen las frases
y/u oraciones del mensaje corto.
• Establecimiento de la intención comunicativa e
identificación del destinatario del mensaje corto.
• Planificación del contenido del mensaje (fecha,
destinatario, contenido y firma) que producirá.
• Segmentación de cada uno de los sonidos que
componen una palabra dada del mensaje corto.
• Lectura en voz alta del mensaje corto con claridad y
entonación adecuada.
• Identificación de las palabras que conforman el
mensaje corto, tomando en cuenta los espacios en
blanco.
• Establecimiento, en actividades de escritura, de la
correspondencia entre letras y sonidos de palabras
correspondientes al cuerpo del mensaje, al nombre
del destinatario y a la firma del mensaje corto.
• Escritura del primer borrador del mensaje de
acuerdo a su intención, interlocutor, estructura y la
utilización del vocabulario apropiado en función de
la intensión comunicativa
• Revisión y corrección del borrador con ayuda del
docente
• Edición de la versión final del mensaje.
• Curiosidad e interés
al escuchar los
mensajes.
• Valoración del
mensaje como medio
para comunicarse
con otros.
• Curiosidad e interés
al leer los mensajes.
• Cuidado en la
presentación, orden
y limpieza en la
elaboración de su
mensaje corto.',
    '["Comunica sus ideas de forma oral y escrita, de acuerdo con sus conocimientos mediante un tipo de texto.","Lee convencionalmente textos sencillos funcionales.","Muestra respeto ante las opiniones de los demás.","Textos que se transversalizan:","Primer grado: El mensaje corto","Segundo grado: La canción infantil","Tercer grado: La adivinanza"]'::jsonb,
    'Guia Didactica LenguaEsp  Multigrado WEB',
    '2023',
    '164',
    'https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo',
    'pendiente_validacion',
    true,
    '6494d96d7243c31e882597cae97bccd8624e56fcffcd1f78921d27f679aa6713'
) ON CONFLICT (source_id) DO NOTHING;

INSERT INTO public.curriculo_secuencias (
    source_id, nivel, ciclo, grado_num, area, tema, bloque_guia,
    competencias_especificas, contenidos_texto_original, indicadores_logro,
    fuente_documento, version_curricular, pagina, url_fuente,
    estado_validacion, vigente, huella
) VALUES (
    'SEC-PRI-1-MAT-007',
    'Primario',
    'Primer Ciclo',
    1,
    'Matemática',
    '4. LAS SECUENCIAS DE ENSEÑANZA EN LAS GUÍAS MULTIGRADO',
    'Página 7',
    'se presentan para todo el año y se expresan de forma
general sin discriminar por',
    '. Lo mismo ocurre con los',
    '["de cada grado. A continua-","ción, se presenta la copia textual de estos componentes de la Adecuación Curricular que se toman como referencia","para acotar las particularidades de cada"]'::jsonb,
    'Guia Matematica WEB',
    '2023',
    '7',
    'https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo',
    'pendiente_validacion',
    true,
    'bf5a7bc8547ea19e19897fa864749ae99a5a406614012f87a2bed8483ca41e8f'
) ON CONFLICT (source_id) DO NOTHING;

INSERT INTO public.curriculo_secuencias (
    source_id, nivel, ciclo, grado_num, area, tema, bloque_guia,
    competencias_especificas, contenidos_texto_original, indicadores_logro,
    fuente_documento, version_curricular, pagina, url_fuente,
    estado_validacion, vigente, huella
) VALUES (
    'SEC-PRI-1-MAT-008',
    'Primario',
    'Primer Ciclo',
    1,
    'Matemática',
    'naturales como mínimo',
    'Página 38',
    'Comunicativa
Relaciona materiales y objetos físicos e imágenes con ideas matemáticas que expresa para buscar
soluciones a situaciones de problemas elementales relacionados con su entorno cotidiano.
Pensamiento Lógico, Crítico y Creativo; Competencia Resolución de Problemas; Competencia
Tecnológica y Científica
Resuelve situaciones problemáticas, en forma coherente y con el apoyo de recursos manipulativos para
la explicación matemática de situaciones cotidianas.
Ética y Ciudadana, Competencia Ambiental y de la Salud, Competencia Desarrollo Personal y Espiritual
Valora las normas de convivencia y el trabajo en equipo, respetando las ideas de compañeros para llegar
a acuerdos sobre los temas matemáticos desarrollados.',
    'Conceptos Procedimientos Actitudes y Valores
• Secuencia de números
naturales como mínimo
hasta el 10.
• Adición de números
naturales como mínimo
hasta el 10.
• Sustracción de números
naturales como mínimo
hasta el 10.
• Cuerpos geométricos:
cubo, esfera, cono y
cilindro, prisma y pirámide
rectangulares.
• Conteo de números menores
o iguales a 10 de acuerdo con
diferentes criterios.
• Resolución de problemas
utilizando las operaciones de
adición y sustracción.
• Comparación y clasificación
de cuerpos geométricos de
acuerdo con características
comunes.
• Resolución de problemas que
impliquen prisma rectangular
y pirámide.
• Identificación y relación de
formas del entorno escolar
y familiar con cuerpos
geométricos.
• Disfrute del trabajo en
matemática.
• Actitud de esfuerzo y
perseverancia.
• Disfrute del juego en el aula.',
    '["Construye el significado de las operaciones de adición y sustracción de números naturales hasta el 10","discutiendo situaciones problema.","Expresa, en forma oral, los procesos realizados en la búsqueda de solución a problemas geométricos.","Utiliza formas de pensamiento lógico para la resolución de problemas en contextos cercanos.","Describe figuras geométricas planas y cuerpos geométricos.","Trabaja de manera colaborativa respetando las diferentes ideas y puntos de vista de los demás en el","quehacer matemático de aula."]'::jsonb,
    'Guia Matematica WEB',
    '2023',
    '38',
    'https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo',
    'pendiente_validacion',
    true,
    '96541bd2162b10ad8d26707fec06a60cd2ecae46ae6e6ee8c9a388eee91f3333'
) ON CONFLICT (source_id) DO NOTHING;

INSERT INTO public.curriculo_secuencias (
    source_id, nivel, ciclo, grado_num, area, tema, bloque_guia,
    competencias_especificas, contenidos_texto_original, indicadores_logro,
    fuente_documento, version_curricular, pagina, url_fuente,
    estado_validacion, vigente, huella
) VALUES (
    'SEC-PRI-2-MAT-007',
    'Primario',
    'Primer Ciclo',
    2,
    'Matemática',
    'naturales como mínimo',
    'Página 39',
    'Comunicativa
Explica sus ideas utilizando números naturales para uso del lenguaje cotidiano.
Pensamiento Lógico, Creativo y Crítico; Resolución de Problemas; Tecnológica y Científica
Utiliza la estimación con la finalidad de resolver problemas.
Ética y Ciudadana; Desarrollo Personal y Espiritual; Ambiental y de la Salud
Respeta los puntos de vista y argumentos de los demás sobre situaciones que implican conocimientos
matemáticos.',
    'Conceptos Procedimientos Actitudes y Valores
• Secuencia de números
naturales como mínimo
hasta el 100.
• Adición de números
naturales, sustracción
de números naturales
mínimo hasta el 100.
• Cuerpos geométricos:
cubo, prisma rectangular,
pirámide, esfera, cono,
cilindro.
• Elementos o partes de
los cuerpos geométricos
y figuras planas en las
caras de los cuerpos
geométricos.
• Conteo de números hasta 100 siguiendo
diferentes criterios.
• Composición y descomposición de números
naturales con números mínimos hasta el
100.
• Comparación y ordenamiento de números
menores que 100.
• Resolución de problemas de adición y
sustracción de números naturales mínimo
hasta el 100.
• Aplicación de los signos de =, +, - en juegos
en el aula y otras situaciones de sus
entornos.
• Identificación de cuerpos geométricos: cubo,
prisma rectangular, pirámide, esfera, cono,
cilindro en situaciones de la vida diaria.
• Resolución de problemas que impliquen
el reconocimiento de figuras planas en las
caras de los cuerpos.
• Responsabilidad en
las actuaciones y en
los compromisos
contraídos al
resolver problemas.
• Autonomía en la
identificación de
formas simétricas
del entorno.
• Satisfacción al
sentirse competente.',
    '["Justifica a partir de ideas matemáticas procesos implicados en la"]'::jsonb,
    'Guia Matematica WEB',
    '2023',
    '39',
    'https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo',
    'pendiente_validacion',
    true,
    '375c872e602d85c36554b6ffc2e8d5335c700a11e07a79550aa4d7d5823eec78'
) ON CONFLICT (source_id) DO NOTHING;

INSERT INTO public.curriculo_secuencias (
    source_id, nivel, ciclo, grado_num, area, tema, bloque_guia,
    competencias_especificas, contenidos_texto_original, indicadores_logro,
    fuente_documento, version_curricular, pagina, url_fuente,
    estado_validacion, vigente, huella
) VALUES (
    'SEC-PRI-3-MAT-007',
    'Primario',
    'Primer Ciclo',
    3,
    'Matemática',
    'naturales como mínimo',
    'Página 40',
    'Comunicativa
Representa, leyendo, escribiendo, interpretando y discutiendo, su comprensión de los enunciados de
problemas matemáticos.
Pensamiento Lógico, Creativo y Crítico; Resolución de Problemas; Tecnológica y Científica
Utiliza en forma sistemática estrategias de resolución de problemas, justificando con su lenguaje cotidiano
procesos de razonamientos propios, acerca de un resultado matemático, de forma inductiva y utilizando
recursos concretos.
Ética y Ciudadana; Desarrollo Personal y Espiritual; Ambiental y de la Salud
Interpreta posibles soluciones a situaciones del entorno a partir de sus conocimientos matemáticos.',
    'Conceptos Procedimientos Actitudes y Valores
• Secuencia de números
naturales como mínimo
hasta el 1,000.
• Cálculo mental.
• Adición y sustracción de
números naturales.
• Estimación de sumas y
restas.
• Cuerpos geométricos:
cubo, prisma rectangular,
pirámide.
• Comprensión de la secuencia numérica
como mínimo hasta 1,000.
• Composición y descomposición de números
naturales a partir del valor posicional
mínimo hasta el 1,000.
• Resolución de problemas que requieren el
manejo de números naturales.
• Resolución de problemas utilizando las
operaciones aritméticas que impliquen el
cálculo mental, y estimaciones.
• Cálculo de operaciones de suma y resta
de números naturales cuyo resultado no
exceda a 1,000.
• Identificación de cuerpos geométricos.
• Disfrute del trabajo
en matemática.
• Perseverancia
en el trabajo en
matemática.
• Responsabilidad en
las actuaciones y en
los compromisos
contraídos.',
    '["Expresa, a partir de la lectura y la escritura, ideas matemáticas referidas a"]'::jsonb,
    'Guia Matematica WEB',
    '2023',
    '40',
    'https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo',
    'pendiente_validacion',
    true,
    '14be8c7adbe476d86a96ea297f0792283f8f4d7cf93cf318fd62f2d9f30df220'
) ON CONFLICT (source_id) DO NOTHING;

INSERT INTO public.curriculo_secuencias (
    source_id, nivel, ciclo, grado_num, area, tema, bloque_guia,
    competencias_especificas, contenidos_texto_original, indicadores_logro,
    fuente_documento, version_curricular, pagina, url_fuente,
    estado_validacion, vigente, huella
) VALUES (
    'SEC-PRI-1-MAT-009',
    'Primario',
    'Primer Ciclo',
    1,
    'Matemática',
    'naturales hasta el 100.',
    'Página 90',
    'Comunicativa
Relaciona materiales y objetos físicos, con ideas matemáticas que expresa para buscar soluciones a
situaciones de problemas elementales relacionados con su entorno cotidiano.
Pensamiento Lógico, Creativo y Crítico; Resolución de Problemas; Científica y Tecnológica
Resuelve situaciones problemáticas, en forma coherente y con el apoyo de recursos manipulativos;
identificando patrones, estructuras o regularidades de forma inductiva para la explicación matemática
de situaciones cotidianas.
Ética y Ciudadana; Desarrollo Personal y Espiritual; Ambiental y de la Salud
Valora las normas de convivencia y el trabajo en equipo, respetando las ideas de compañeros para llegar
a acuerdos sobre los temas matemáticos desarrollados.',
    'Conceptos Procedimientos Actitudes y Valores
• Secuencia de números
naturales hasta el 100.
• Patrones de números.
• Adición de números
naturales hasta el 50.
• Sustracción de números
naturales hasta el 50.
• Medidas y longitud.
• Unidades arbitrarias de
longitud.
• Medidas arbitrarias y
corporales.
• Composición y
descomposición de números
hasta el 100.
• Resolución de problemas
utilizando las operaciones de
adición y sustracción.
• Comparaciones de números
menores o iguales que 100.
• Resolución de problemas
que impliquen medidas de
longitud.
• Valoración del uso del valor
posicional de un número
mínimo a 99.
• Disfrute del trabajo en
matemática con las
operaciones de adición y
sustracción de números
naturales mínimo hasta el
99.
• Disfrute al resolver
problemas de adición y
sustracción de números
naturales mínimo hasta el
99.',
    '["Demuestra comprensión del sistema de numeración decimal y de valor de posición.","Construye el significado de las operaciones de adición y sustracción de números naturales hasta el 50,","discutiendo situaciones de problema.","Expresa, en forma oral, los procesos realizados en la búsqueda de solución a problemas de","mediciones.","Utiliza formas de pensamiento lógico para la resolución de problemas en contextos cercanos.","Reconoce y describe una amplia diversidad de patrones numéricos.","Integra recursos manipulativos como apoyo para la comprensión de las ideas matemáticas y en la","resolución de problemas.","Trabaja de manera colaborativa respetando las diferentes ideas y puntos de vista de los demás en el","quehacer matemático de aula."]'::jsonb,
    'Guia Matematica WEB',
    '2023',
    '90',
    'https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo',
    'pendiente_validacion',
    true,
    'f76fca6155152f685d6ce86cd7bbcf3e665bac0b59f050d370090c78ed1c92c9'
) ON CONFLICT (source_id) DO NOTHING;

INSERT INTO public.curriculo_secuencias (
    source_id, nivel, ciclo, grado_num, area, tema, bloque_guia,
    competencias_especificas, contenidos_texto_original, indicadores_logro,
    fuente_documento, version_curricular, pagina, url_fuente,
    estado_validacion, vigente, huella
) VALUES (
    'SEC-PRI-2-MAT-008',
    'Primario',
    'Primer Ciclo',
    2,
    'Matemática',
    'naturales como mínimo',
    'Página 91',
    'Comunicativa
Explica sus ideas utilizando números naturales para uso del lenguaje cotidiano.
Pensamiento Lógico, Creativo y Crítico; Resolución de Problemas; Tecnológica y Científica
Utiliza la estimación y medición matemática.
Ética y Ciudadana; Desarrollo Personal y Espiritual; Ambiental y de la Salud
Respeta los puntos de vista y argumentos de los demás sobre situaciones que implican conocimientos
matemáticos referidos al contexto social y ambiental.',
    'Conceptos Procedimientos Actitudes y Valores
• Secuencia de números
naturales como mínimo
hasta el 1,000.
• Adición de números
naturales y sustracción de
números naturales hasta el
100.
• Unidad de medida arbitraria
o convencional.
• Longitudes, unidades
arbitrarias, el centímetro.
• Reglas.
• Composición y
descomposición de números
naturales mínimo hasta el
1,000.
• Comparación y ordenamiento
de números menores o
iguales que 1,000.
• Resolución de problemas de
adición y sustracciones de
números naturales mínimo
hasta el 100.
• Utilización de instrumentos
de medición.
• Uso de materiales del
entorno como unidades
arbitrarias de medida.
• Responsabilidad en las
actuaciones y en los
compromisos contraídos al
resolver problemas.
• Interés al realizar medidas de
longitud.
• Satisfacción al sentirse
competente para medir
objetos en su entorno.
• Valoración al poder utilizar
partes de su cuerpo
para realizar mediciones
arbitrarias.',
    '["Justifica a partir de ideas matemáticas, procesos implicados en la"]'::jsonb,
    'Guia Matematica WEB',
    '2023',
    '91',
    'https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo',
    'pendiente_validacion',
    true,
    'd679e498d8f41d60619b74df6902643e77712bd3c11586a2f269141d3338c25b'
) ON CONFLICT (source_id) DO NOTHING;

INSERT INTO public.curriculo_secuencias (
    source_id, nivel, ciclo, grado_num, area, tema, bloque_guia,
    competencias_especificas, contenidos_texto_original, indicadores_logro,
    fuente_documento, version_curricular, pagina, url_fuente,
    estado_validacion, vigente, huella
) VALUES (
    'SEC-PRI-3-MAT-008',
    'Primario',
    'Primer Ciclo',
    3,
    'Matemática',
    'naturales hasta el',
    'Página 92',
    'Comunicativa
Representa, leyendo, escribiendo, interpretando y discutiendo, su comprensión de los enunciados de
problemas matemáticos y los conceptos.
Pensamiento Lógico, Creativo y Crítico; Resolución de Problemas; Tecnológica y Científica
Utiliza en forma sistemática estrategias de resolución de problemas, verificando e interpretando sus
resultados con relación a la situación de problema presentada, y justificando con su lenguaje cotidiano,
procesos de razonamientos propios, acerca de un procedimiento o un resultado matemático, de forma
inductiva y utilizando recursos concretos.
Ética y Ciudadana; Desarrollo Personal y Espiritual; Ambiental y de la Salud
Interpreta posibles soluciones a situaciones a partir de sus conocimientos matemáticos.',
    'Conceptos Procedimientos Actitudes y Valores
• Secuencia de números
naturales hasta el
10,000.
• Adición de números
naturales, propiedades
de la adición.
• Sustracción de números
naturales.
• Multiplicación y división
como sumas y restas
reiteradas.
• Unidades de medidas:
centímetro y metro.
• Suma y resta de
longitudes.
• Composición y descomposición de
números naturales a partir del valor
posicional hasta el 10,000.
• Resolución de problemas utilizando
las operaciones aritméticas que
impliquen el cálculo mental,
estimación y propiedades de las
operaciones de adición y sustracción
de números naturales.
• Cálculo de operaciones de suma y
resta de números naturales cuyo
resultado no exceda a 1,000.
• Multiplicación con números
naturales de una cifra por dos cifras.
• División con números naturales de
números de una cifra o dos cifras
entre una cifra.
• Descripción del procedimiento
utilizado para medir longitudes.
• Resolución de problemas de la vida
diaria que involucren medidas de
longitud.
• Disfrute del trabajo en
matemática.
• Perseverancia en el
trabajo en matemática.
• Responsabilidad en las
actuaciones y en los
compromisos contraídos.
• Criticidad al medir
longitudes usando el
centímetro y el metro
como unidades de
medidas.',
    '["Expresa ideas matemáticas sobre temáticas del contexto escolar referidas a"]'::jsonb,
    'Guia Matematica WEB',
    '2023',
    '92',
    'https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo',
    'pendiente_validacion',
    true,
    '880be0370c266d4b60b6842233f3a73d2fa457e0ae991d764f74b74150023bd9'
) ON CONFLICT (source_id) DO NOTHING;

INSERT INTO public.curriculo_secuencias (
    source_id, nivel, ciclo, grado_num, area, tema, bloque_guia,
    competencias_especificas, contenidos_texto_original, indicadores_logro,
    fuente_documento, version_curricular, pagina, url_fuente,
    estado_validacion, vigente, huella
) VALUES (
    'SEC-PRI-1-MAT-010',
    'Primario',
    'Primer Ciclo',
    1,
    'Matemática',
    'naturales como mínimo',
    'Página 134',
    'Comunicativa
Relaciona materiales y objetos físicos con ideas matemáticas que expresa claramente para buscar
soluciones a situaciones elementales relacionados con su entorno cotidiano.
Pensamiento Lógico, Creativo y Crítico; Resolución de Problemas; Científica y Tecnológica
Resuelve situaciones problemáticas, en forma coherente y con el apoyo de recursos manipulativos,
identificando patrones, regularidades de forma inductiva.
Ética y Ciudadana; Desarrollo Personal y Espiritual; Ambiental y de la Salud; Competencia Desarrollo
Personal y Espiritual
Valora las normas de convivencia y el trabajo en equipo, respetando las ideas de compañeros para llegar
a acuerdos sobre los temas matemáticos desarrollados.',
    'Conceptos Procedimientos Actitudes y Valores
• Secuencia de números
naturales como mínimo
hasta el 99.
• Patrones de números.
• Adición de números
naturales como mínimo
hasta 99.
• Sustracción de números
naturales como mínimo
hasta el 99.
• Recolección y organización
de datos no agrupados.
• Tablas de conteo.
• Pictogramas.
• Composición y
descomposición de números
como mínimo hasta el 99.
• Resolución de problemas
utilizando las operaciones de
adición y sustracción.
• Comparaciones de números
menores o iguales que 99.
• Recolección, organización
y clasificación de datos no
agrupados.
• Lectura o interpretación
de pictogramas y tablas de
datos sencillos.
• Disfrute del trabajo en
matemática con las
operaciones de adición y
sustracción de números
naturales mínimo hasta el
99.
• Disfrute al resolver
problemas de adición y
sustracción de números
naturales mínimo hasta el
99.
• Actitud de esfuerzo y
perseverancia en la solución
de problemas.',
    '["Demuestra comprensión del sistema de numeración decimal al relacionar los conceptos de contar y de","valor de posición.","Construye el significado de las operaciones de adición y sustracción de números naturales hasta el 99,","discutiendo situaciones de problema.","Expresa en forma oral los procesos realizados en la búsqueda de solución a problemas.","Utiliza formas de pensamiento lógico para organizar y relacionar informaciones diversas relativas a la","vida cotidiana y a la resolución de problemas en contextos cercanos.","Recoge, organiza y representa datos en tablas de conteo interpretándolos de acuerdo a su contexto","escolar y familiar.","Reconoce y describe una amplia diversidad de patrones numéricos.","Integra recursos manipulativos como apoyo para la comprensión de las ideas matemáticas y en la","resolución de problemas.","Trabaja de manera colaborativa respetando las diferentes ideas y puntos de vista de los demás en el","quehacer matemático de aula."]'::jsonb,
    'Guia Matematica WEB',
    '2023',
    '134',
    'https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo',
    'pendiente_validacion',
    true,
    'e5ca3a37a82c50a26259e4f499fdb82845aa5e4c347ee4bcbc7991346e1d4800'
) ON CONFLICT (source_id) DO NOTHING;

INSERT INTO public.curriculo_secuencias (
    source_id, nivel, ciclo, grado_num, area, tema, bloque_guia,
    competencias_especificas, contenidos_texto_original, indicadores_logro,
    fuente_documento, version_curricular, pagina, url_fuente,
    estado_validacion, vigente, huella
) VALUES (
    'SEC-PRI-2-MAT-009',
    'Primario',
    'Primer Ciclo',
    2,
    'Matemática',
    'naturales como mínimo',
    'Página 135',
    'Comunicativa
Explica sus ideas utilizando números naturales para uso del lenguaje cotidiano.
Pensamiento Lógico, Creativo y Crítico; Resolución de Problemas; Científica y Tecnológica
Resuelve problemas identificados en su comunidad.
Ética y Ciudadana; Desarrollo Personal y Espiritual; Ambiental y de la Salud
Respeta los puntos de vista y argumentos de los demás sobre situaciones que implican conocimientos
matemáticos referidos al contexto social y ambiental.',
    'Conceptos Procedimientos Actitudes y Valores
• Secuencia de números
naturales como mínimo
hasta el 999.
• Valor de posición: unidad,
decena y centena.
• Adición de números
naturales y sustracción de
números naturales hasta el
999.
• Multiplicación y división
(iniciación).
• Recolección y organización
de datos en tablas.
• Gráficas de barras.
• Composición y
descomposición de números
naturales mínimo hasta el
999.
• Comparación y ordenamiento
de números menores o
iguales que 999.
• Resolución de problemas
de adición y sustracción de
números naturales mínimo
hasta el 999.
• Recolección de datos sobre
preferencias.
• Resolución de problemas que
involucren la recolección,
organización y tabulación e
interpretación de datos no
agrupados en tablas y en
gráficas de barras.
• Responsabilidad en las
actuaciones y en los
compromisos contraídos
al resolver problemas de
adición, sustracción, mínimo
hasta el 999.',
    '["Justifica, a partir de ideas matemáticas, procesos implicados en la"]'::jsonb,
    'Guia Matematica WEB',
    '2023',
    '135',
    'https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo',
    'pendiente_validacion',
    true,
    '6eeb8251e6687383fbae97702a5566511bdfe8f08ce75caf4a8bf1bbdc380c0e'
) ON CONFLICT (source_id) DO NOTHING;

INSERT INTO public.curriculo_secuencias (
    source_id, nivel, ciclo, grado_num, area, tema, bloque_guia,
    competencias_especificas, contenidos_texto_original, indicadores_logro,
    fuente_documento, version_curricular, pagina, url_fuente,
    estado_validacion, vigente, huella
) VALUES (
    'SEC-PRI-3-MAT-009',
    'Primario',
    'Primer Ciclo',
    3,
    'Matemática',
    'números naturales',
    'Página 136',
    'Comunicativa
Representa, leyendo, escribiendo, interpretando y discutiendo, su comprensión de los enunciados de
problemas matemáticos y los conceptos y propiedades de las operaciones relativas a estos, para establecer
las relaciones entre ellos y con el contexto circundante.
Pensamiento Lógico, Creativo y Crítico; Resolución de Problemas; Científica y Tecnológica
Utiliza en forma sistemática estrategias de resolución de problemas, verificando e interpretando sus
resultados con relación a la situación de problema presentada, y justificando con su lenguaje cotidiano,
procesos de razonamientos propios, acerca de una demostración, un algoritmo o un resultado matemático,
de forma inductiva y utilizando recursos concretos e integrando las tecnologías digitales.
Ética y Ciudadana; Desarrollo Personal y Espiritual; Ambiental y de la Salud
Respeta los puntos de vista y argumentos de los demás sobre situaciones que implican conocimientos
matemáticos referidos al contexto social y ambiental.',
    'Conceptos Procedimientos Actitudes y Valores
• Secuencia de
números naturales
como mínimo hasta
el 999.
• Valor de posición:
unidad, decena y
centena.
• Adición de números
naturales y
sustracción de
números naturales
hasta el 999.
• Multiplicación y
división (iniciación).
• Recolección y
organización de
datos en tablas.
• Gráficas de barras.
• Composición y descomposición de números
naturales a partir del valor posicional hasta el 9,999.
• Resolución de problemas utilizando las operaciones
aritméticas que impliquen el cálculo mental,
estimación y propiedades de las operaciones de
adición y sustracción de números naturales.
• Cálculo de operaciones de suma y resta de números
naturales cuyo resultado no exceda 9,999.
• Multiplicación con números naturales de una cifra
por dos cifras.
• División con números naturales de números de una
cifra o dos cifras entre una cifra con sumas y restas
reiteradas.
• Recolección, organización, registro en tabla y
análisis de datos no agrupados.
• Resolución de problemas relacionados con la
recolección y organización, análisis e interpretación
de datos en tablas y gráficas de barras.
• Disfrute del
trabajo en
matemática.
• Perseverancia
en el trabajo en
matemática.
• Responsabilidad
en las actuaciones
y en los
compromisos
contraídos.
• Satisfacción al
colorear gráficos
de barras.',
    '["Expresa, a partir de la lectura, escritura y traducción, ideas matemáticas sobre temáticas del contexto","escolar referidas a"]'::jsonb,
    'Guia Matematica WEB',
    '2023',
    '136',
    'https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo',
    'pendiente_validacion',
    true,
    '1f24ee1d834a56f9c3cee08f02e0d388cd9f2cb012b29a7c2d976b73d02d5c08'
) ON CONFLICT (source_id) DO NOTHING;

INSERT INTO public.curriculo_secuencias (
    source_id, nivel, ciclo, grado_num, area, tema, bloque_guia,
    competencias_especificas, contenidos_texto_original, indicadores_logro,
    fuente_documento, version_curricular, pagina, url_fuente,
    estado_validacion, vigente, huella
) VALUES (
    'SEC-PRI-1-MAT-011',
    'Primario',
    'Primer Ciclo',
    1,
    'Matemática',
    'naturales hasta el 99.',
    'Página 186',
    'Comunicativa
Relaciona materiales y objetos físicos con ideas matemáticas que expresa para buscar soluciones a
situaciones de problemas elementales relacionados con su entorno cotidiano.
Pensamiento Lógico, Creativo y Crítico; Resolución de Problemas; Tecnológica y Científica
Resuelve situaciones problemáticas, en forma coherente y con el apoyo de recursos manipulativos,
identificando patrones, estructuras o regularidades.
Ética y Ciudadana; Ambiental y de la Salud; Desarrollo Personal y Espiritual
Valora las normas de convivencia y el trabajo en equipo, respetando las ideas de compañeros para llegar a
acuerdos sobre los temas matemáticos desarrollados.',
    'Conceptos Procedimientos Actitudes y Valores
• Secuencia de números
naturales hasta el 99.
• Adición de números
naturales hasta el 99.
• Sustracción de números
naturales hasta el 99.
• Figuras planas: círculo,
triángulo, cuadrado y
rectángulo.
• Conteo de números menores
que 50 de acuerdo a diferentes
criterios.
• Conteo de dos en dos, de tres
en tres, de cinco en cinco, de
diez en diez.
• Composición y descomposición
de números hasta el 99.
• Resolución de problemas
utilizando las operaciones de
adición y sustracción.
• Resolución de problemas que
impliquen prisma rectangular y
pirámide.
• Identificación y relación de
formas del entorno escolar
y familiar con cuerpos
geométricos y figuras planas
geométricas.
• Disfrute del trabajo en
matemática.
• Actitud de esfuerzo y
perseverancia.
• Disfrute del juego en el aula.',
    '["Demuestra comprensión del sistema de numeración decimal al relacionar los conceptos de contar,","agrupar y de valor de posición.","Construye el significado de las operaciones de adición y sustracción de números naturales hasta el 99,","discutiendo situaciones de problema.","Expresa en forma oral los procesos realizados en la búsqueda de solución a problemas geométricos.","Utiliza formas de pensamiento lógico para la resolución de problemas en contextos cercanos.","Describe y clasifica figuras geométricas planas y cuerpos geométricos.","Reconoce y describe una amplia diversidad de patrones numéricos.","Trabaja de manera colaborativa respetando las diferentes ideas y puntos de vista de los demás en el","quehacer matemático del aula."]'::jsonb,
    'Guia Matematica WEB',
    '2023',
    '186',
    'https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo',
    'pendiente_validacion',
    true,
    '12bc8a47fa12b29cf04f4dbc13e11b3a82ec2197308240affcbf7f3fe185b801'
) ON CONFLICT (source_id) DO NOTHING;

INSERT INTO public.curriculo_secuencias (
    source_id, nivel, ciclo, grado_num, area, tema, bloque_guia,
    competencias_especificas, contenidos_texto_original, indicadores_logro,
    fuente_documento, version_curricular, pagina, url_fuente,
    estado_validacion, vigente, huella
) VALUES (
    'SEC-PRI-2-MAT-010',
    'Primario',
    'Primer Ciclo',
    2,
    'Matemática',
    'naturales como mínimo',
    'Página 187',
    'Comunicativa
Explica sus ideas utilizando números naturales para uso del lenguaje cotidiano.
Pensamiento Lógico, Creativo y Crítico; Resolución de Problemas; Tecnológica y Científica
Resuelve situaciones problemáticas de numeración, operaciones y geometría.
Ética y Ciudadana; Ambiental y de la Salud; Desarrollo Personal y Espiritual
Respeta los puntos de vista y argumentos de los demás sobre situaciones que implican conocimientos
matemáticos referidos al contexto social y ambiental.',
    'Conceptos Procedimientos Actitudes y Valores
• Secuencia de números
naturales como mínimo
hasta el 999.
• Valor de posición: unidad,
decena y centena.
• Adición y sustracción de
números naturales hasta el
999.
• Multiplicación y división
(iniciación).
• Figuras planas: círculo,
triángulo, cuadrado y
rectángulo.
• Composición y descomposición
de números naturales mínimo
hasta el 999.
• Comparación y ordenamiento
de números menores o iguales
que 999.
• Resolución de problemas de
adición y sustracciones de
números naturales mínimo
hasta el 999.
• Identificación de figuras planas
en situaciones de la vida diaria.
• Resolución de problemas que
impliquen el reconocimiento de
figuras planas en las caras de
los cuerpos.
• Responsabilidad en las
actuaciones y en los
compromisos contraídos al
resolver problemas.',
    '["Justifica, a partir de ideas matemáticas, procesos implicados en la"]'::jsonb,
    'Guia Matematica WEB',
    '2023',
    '187',
    'https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo',
    'pendiente_validacion',
    true,
    '8a6584ed7e5691ceb0a3607e7334c55ef43dad513a5397560863fcf7d8dae211'
) ON CONFLICT (source_id) DO NOTHING;

INSERT INTO public.curriculo_secuencias (
    source_id, nivel, ciclo, grado_num, area, tema, bloque_guia,
    competencias_especificas, contenidos_texto_original, indicadores_logro,
    fuente_documento, version_curricular, pagina, url_fuente,
    estado_validacion, vigente, huella
) VALUES (
    'SEC-PRI-3-MAT-010',
    'Primario',
    'Primer Ciclo',
    3,
    'Matemática',
    'naturales hasta el 9,999.',
    'Página 188',
    'Comunicativa
Representa, leyendo, escribiendo, interpretando y discutiendo, su comprensión de los enunciados
de problemas matemáticos y los conceptos y propiedades de las operaciones relativas a estos, para
establecer las relaciones entre ellos y con el contexto circundante.
Pensamiento Lógico, Creativo y Crítico; Resolución de Problemas; Tecnológica y Científica
Utiliza en forma sistemática estrategias de resolución de problemas, verificando e interpretando sus
resultados con relación a la situación de problema presentada, y justificando con su lenguaje cotidiano,
procesos de razonamientos propios, utilizando recursos concretos.
Ética y Ciudadana; Ambiental y de la Salud; Desarrollo Personal y Espiritual
Interpreta posibles soluciones a situaciones del entorno a partir de sus conocimientos matemáticos.',
    'Conceptos Procedimientos Actitudes y Valores
• Secuencia de números
naturales hasta el 9,999.
• Valor de posición: unidad,
decena, centena, unidad de
mil.
• Adición de números naturales.
• Propiedades de la adición.
• Sustracción de números
naturales.
• Multiplicación y división como
sumas y restas reiteradas.
• Propiedades de la
multiplicación.
• Números pares e impares.
• Polígonos: triángulos,
cuadriláteros.
• Elementos de los polígonos:
lados, vértices.
• Cuerpos geométricos: cubo,
prisma rectangular, pirámide.
• Composición y
descomposición de números
naturales a partir del valor
posicional hasta el 9,999.
• Cálculo de operaciones de
suma y resta de números
naturales cuyo resultado no
exceda 9,999.
• Multiplicación con números
naturales de una cifra por dos
cifras.
• División con números
naturales de números de
una cifra o dos cifras entre
una cifra con sumas y restas
reiteradas.
• Disfrute del trabajo en
matemática.
• Perseverancia en el trabajo
en matemática.
• Responsabilidad en las
actuaciones y en los
compromisos contraídos.
• Curiosidad e interés por el
aprendizaje.',
    '["Expresa, a partir de la lectura y escritura, ideas matemáticas sobre temáticas del contexto escolar","referidas a"]'::jsonb,
    'Guia Matematica WEB',
    '2023',
    '188',
    'https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo',
    'pendiente_validacion',
    true,
    '3acb30ea6dd2e1f8f4d57b766b545f3a6d9da6ac60ca29005192945ab7e6a763'
) ON CONFLICT (source_id) DO NOTHING;

INSERT INTO public.curriculo_secuencias (
    source_id, nivel, ciclo, grado_num, area, tema, bloque_guia,
    competencias_especificas, contenidos_texto_original, indicadores_logro,
    fuente_documento, version_curricular, pagina, url_fuente,
    estado_validacion, vigente, huella
) VALUES (
    'SEC-PRI-1-MAT-012',
    'Primario',
    'Primer Ciclo',
    1,
    'Matemática',
    'naturales como mínimo',
    'Página 242',
    'Comunicativa
Relaciona materiales y objetos físicos e imágenes con ideas matemáticas que expresa claramente para
buscar soluciones a situaciones de problemas elementales relacionados con su entorno cotidiano.
Pensamiento Lógico, Creativo y Crítico; Resolución de Problemas; Tecnológica y Científica
Resuelve situaciones problemáticas, en forma coherente y con el apoyo de recursos manipulativos y
digitales, identificando patrones, o regularidades de forma inductiva para la explicación matemática de
situaciones cotidianas.
Ética y Ciudadana; Ambiental y de la Salud; Desarrollo Personal y Espiritual
Valora las normas de convivencia y el trabajo en equipo, respetando las ideas de compañeros para llegar a
acuerdos sobre los temas matemáticos desarrollados.',
    'Conceptos Procedimientos Actitudes y Valores
• Secuencia de números
naturales como mínimo
hasta el 99.
• Patrones de números.
• Valor de posición: unidad y
decena.
• Adición de números
naturales como mínimo
hasta el 99.
• Sustracción de números
naturales como mínimo
hasta el 99.
• Medida de capacidad.
• Conteo de números menores
que 99 de acuerdo con
diferentes criterios.
• Composición de números como
mínimo hasta el 99.
• Resolución de problemas
utilizando las operaciones de
adición y sustracción.
• Disfruta del trabajo en
matemática con las
operaciones de adición y
sustracción de números
naturales mínimo hasta el
99.
• Actitud de esfuerzo y
perseverancia.',
    '["Demuestra comprensión del sistema de numeración decimal al relacionar los conceptos de contar,","agrupar y de valor de posición.","Construye el significado de las operaciones de adición y sustracción de números naturales hasta el 99,","discutiendo situaciones de problema.","Expresa, en forma oral los procesos realizados en la búsqueda de solución a problemas de mediciones.","Utiliza formas de pensamiento lógico para organizar y relacionar informaciones diversas relativas a la","vida cotidiana y a la resolución de problemas en contextos cercanos.","Reconoce y describe una amplia diversidad de patrones numéricos.","Trabaja de manera colaborativa respetando las diferentes ideas y puntos de vista de los demás en el","quehacer matemático de aula."]'::jsonb,
    'Guia Matematica WEB',
    '2023',
    '242',
    'https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo',
    'pendiente_validacion',
    true,
    'a086ae357603e5f1a6576cea6e604bbf734da0509c223673dd8d93e184c2591b'
) ON CONFLICT (source_id) DO NOTHING;

INSERT INTO public.curriculo_secuencias (
    source_id, nivel, ciclo, grado_num, area, tema, bloque_guia,
    competencias_especificas, contenidos_texto_original, indicadores_logro,
    fuente_documento, version_curricular, pagina, url_fuente,
    estado_validacion, vigente, huella
) VALUES (
    'SEC-PRI-2-MAT-011',
    'Primario',
    'Primer Ciclo',
    2,
    'Matemática',
    'naturales como mínimo',
    'Página 243',
    'Comunicativa
Explica sus ideas utilizando números naturales para uso del lenguaje cotidiano.
Pensamiento Lógico, Creativo y Crítico; Resolución de Problemas; Tecnológica y Científica
Utiliza la estimación y medición matemática con la finalidad de resolver problemas.
Ética y Ciudadana; Ambiental y de la Salud; Desarrollo Personal y Espiritual
Respeta los puntos de vista y argumentos de los demás sobre situaciones que implican conocimientos
matemáticos referidos al contexto ambiental.',
    'Conceptos Procedimientos Actitudes y Valores
• Secuencia de números
naturales como mínimo
hasta el 999.
• Valor de posición: unidad,
decena y centena.
• Adición de números
naturales, sustracción de
números naturales mínimo
hasta el 999, multiplicación
de números naturales
(cuyos factores sean
menores que diez).
• Patrones numéricos en la
recta numérica.
• Medidas de capacidad,
unidades arbitrarias de
capacidad, la taza, el litro y
estimación de capacidades.
• Resolución de problemas
de adición y sustracción de
números naturales mínimo
hasta el 999.
• Resolución de problemas de
multiplicación de números
naturales cuyos factores sean
menores que 10.
• Uso de materiales del entorno
como unidades arbitrarias de
medida.
• Medición y estimación de
capacidad en situaciones
diversas y a partir de taza y
litro.
• Responsabilidad en las
actuaciones y en los
compromisos contraídos
al resolver problemas de
adición, sustracción, mínimo
hasta el 999, y multiplicación
de números naturales cuyos
factores sean menores que
diez.
• Autonomía.
• Satisfacción al sentirse
competente para medir
objetos en su entorno.',
    '["Justifica, a partir de ideas matemáticas, procesos implicados en la"]'::jsonb,
    'Guia Matematica WEB',
    '2023',
    '243',
    'https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo',
    'pendiente_validacion',
    true,
    '574c01eda18378d3a4fc5b6887425e0e7800125cc1b5cc21130bcd70eec261cd'
) ON CONFLICT (source_id) DO NOTHING;

INSERT INTO public.curriculo_secuencias (
    source_id, nivel, ciclo, grado_num, area, tema, bloque_guia,
    competencias_especificas, contenidos_texto_original, indicadores_logro,
    fuente_documento, version_curricular, pagina, url_fuente,
    estado_validacion, vigente, huella
) VALUES (
    'SEC-PRI-3-MAT-011',
    'Primario',
    'Primer Ciclo',
    3,
    'Matemática',
    'naturales como',
    'Página 244',
    'Comunicativa
Representa leyendo, escribiendo, interpretando y discutiendo, su comprensión de los enunciados de
problemas matemáticos y los conceptos y propiedades de las operaciones relativas a estos, para establecer
las relaciones entre ellos y con el contexto circundante.
Pensamiento Lógico, Creativo y Crítico; Resolución de Problemas; Tecnológica y Científica
Utiliza en forma sistemática estrategias de resolución de problemas, verificando e interpretando sus
resultados con relación a la situación de problema presentada, y justificando con su lenguaje cotidiano
procesos de razonamientos propios acerca de un procedimiento o un resultado matemático, de forma
inductiva y utilizando recursos concretos.
Ética y Ciudadana; Ambiental y de la Salud; Desarrollo Personal y Espiritual
Interpreta posibles soluciones a situaciones del entorno a partir de sus conocimientos matemáticos.',
    'Conceptos Procedimientos Actitudes y Valores
• Secuencia de números
naturales como
mínimo hasta el
99,999.
• Valor de posición:
unidad, decena,
centena, unidad de mil
y decena de mil.
• Recta numérica.
• Cálculo mental, adición
de números naturales,
propiedades de la
adición, sustracción de
números naturales
• Multiplicación y
división como sumas
y restas de sumando y
restando iguales.
• Propiedades de la
multiplicación.
• Capacidad, taza,
litro, medio litro,
equivalencia entre litro
y taza.
• Comprensión de la secuencia numérica como
mínimo hasta 99,999.
• Composición y descomposición de números
naturales a partir del valor posicional mínimo
hasta el 99,999.
• Resolución de problemas que impliquen el uso de
la recta numérica.
• Resolución de problemas utilizando las
operaciones aritméticas y las propiedades de las
operaciones de adición y sustracción de números
naturales.
• Cálculo de operaciones de suma y resta de
números naturales cuyo resultado no exceda a
99,999.
• Multiplicación con números naturales de una cifra
por dos cifras, con resultados que no excedan
los 99,999. Resolución de problemas en la recta
numérica.
• Identificación de patrones numéricos en la recta
numérica.
• Estimación y medición de capacidades de distintos
recipientes del entorno usando la taza y el litro.
• Resolución de problemas que impliquen: taza, litro,
medio litro, equivalencia entre litro y taza.
• Identificación de fracciones comunes en
situaciones de su entorno de aula y de su
comunidad.
• Responsabilidad
en las
actuaciones
y en los
compromisos
contraídos
al resolver
problemas
de adición,
sustracción,
mínimo hasta
el 999, y
multiplicación
de números
naturales cuyos
factores sean
menores que
diez.
• Autonomía.
• Satisfacción
al sentirse
competente
para medir
objetos en su
entorno.',
    '["Expresa, a partir de la lectura y escritura, ideas matemáticas referidas a"]'::jsonb,
    'Guia Matematica WEB',
    '2023',
    '244',
    'https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo',
    'pendiente_validacion',
    true,
    '02d664d8040a3c395a776948d260e52593c901f77ce57cc05be3f89a65edbb59'
) ON CONFLICT (source_id) DO NOTHING;

INSERT INTO public.curriculo_secuencias (
    source_id, nivel, ciclo, grado_num, area, tema, bloque_guia,
    competencias_especificas, contenidos_texto_original, indicadores_logro,
    fuente_documento, version_curricular, pagina, url_fuente,
    estado_validacion, vigente, huella
) VALUES (
    'SEC-PRI-1-MAT-013',
    'Primario',
    'Primer Ciclo',
    1,
    'Matemática',
    'naturales como mínimo',
    'Página 302',
    'Comunicativa
Relaciona materiales y objetos físicos, imágenes y diagramas con ideas matemáticas que expresa claramente
para buscar soluciones a situaciones de problemas elementales relacionados con su entorno cotidiano.
Pensamiento Lógico, Creativo y Crítico; Competencia Resolución de Problemas; Competencia Tecnológica
y Científica
Formula y resuelve situaciones problemáticas, en forma coherente y con el apoyo de recursos manipulativos
y digitales; identificando patrones, estructuras o regularidades de forma inductiva para la explicación
matemática de situaciones cotidianas.
Ética y Ciudadana; Competencia Ambiental y de la Salud; Competencia Desarrollo Personal y Espiritual
Valora las normas de convivencia y el trabajo en equipo, respetando las ideas de compañeros para llegar a
acuerdos sobre los temas matemáticos desarrollados.',
    'Conceptos Procedimientos Actitudes y Valores
• Secuencia de números
naturales como mínimo
hasta el 99.
• Patrones de números.
• Valor de posición: unidad y
decena.
• Adición de números
naturales como mínimo
hasta el 99.
• Sustracción de números
naturales como mínimo
hasta el 99.
• Simbología de =.
• Recolección y organización
de datos no agrupados.
• Tablas de conteo.
• Pictogramas.
• Composición y descomposición de
números como mínimo hasta el 99.
• Resolución de problemas utilizando las
operaciones de adición y sustracción.
• Uso de la simbología de =.
• Recolección, organización y
clasificación de datos no agrupados.
• Elaboración de tablas de conteo, dada
una serie de objetos distintos, haciendo
una marca a medida que localiza cada
objeto del tipo que está contando.
• Elaboración e interpretación de
pictogramas elaborados con objetos de
su entorno: juguetes, lápices, alimentos.
• Lectura o interpretación de pictogramas
y tablas de datos sencillos usando
herramientas tecnológicas.
• Disfrute del trabajo
en matemática con
las operaciones de
adición y sustracción
de números naturales
mínimo hasta el 99.
• Disfrute al resolver
problemas de adición
y sustracción de
números naturales
mínimo hasta el 99.
• Actitud de esfuerzo y
perseverancia.
• Disfrute del juego en el
aula.',
    '["Demuestra comprensión del sistema de numeración decimal al relacionar los conceptos de contar, agrupar","y de valor de posición.","Construye el significado de las operaciones de adición y sustracción de números naturales hasta el 99,","modelando y discutiendo situaciones de problema.","Expresa, en forma oral y por escrito, los procesos realizados en la búsqueda de solución a problemas.","Utiliza formas de pensamiento lógico para organizar y relacionar informaciones diversas relativas a la vida","cotidiana y a la resolución de problemas en contextos cercanos.","Recoge, organiza, describe datos y los representa en tablas de conteo y pictogramas, interpretándolos de","acuerdo a su contexto escolar y familiar.","Reconoce y describe una amplia diversidad de patrones numéricos.","Trabaja de manera colaborativa respetando las diferentes ideas y puntos de vista de los demás en el","quehacer matemático de aula."]'::jsonb,
    'Guia Matematica WEB',
    '2023',
    '302',
    'https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo',
    'pendiente_validacion',
    true,
    '4da51b9c73384c84315afeedb911364bbff560bc765b8cceb9109a853d2f8cd9'
) ON CONFLICT (source_id) DO NOTHING;

INSERT INTO public.curriculo_secuencias (
    source_id, nivel, ciclo, grado_num, area, tema, bloque_guia,
    competencias_especificas, contenidos_texto_original, indicadores_logro,
    fuente_documento, version_curricular, pagina, url_fuente,
    estado_validacion, vigente, huella
) VALUES (
    'SEC-PRI-2-MAT-012',
    'Primario',
    'Primer Ciclo',
    2,
    'Matemática',
    'naturales como mínimo',
    'Página 303',
    'Comunicativa
Explica sus ideas utilizando números naturales para uso del lenguaje cotidiano.
Pensamiento Lógico, Creativo y Crítico; Resolución de Problemas; Tecnológica y Científica
Resuelve problemas identificados en su comunidad.
Ética y Ciudadana; Desarrollo Personal y Espiritual; Ambiental y de la Salud
Respeta los puntos de vista y argumentos de los demás sobre situaciones que implican conocimientos
matemáticos.',
    'Conceptos Procedimientos Actitudes y Valores
• Secuencia de números
naturales como mínimo
hasta el 999.
• Valor de posición: unidad,
decena y centena.
• Símbolo =.
• Adición de números
naturales, sustracción
de números naturales
mínimo hasta el 999,
multiplicación de números
naturales (cuyos factores
sean menores que diez),
signos =, +, - y x.
• Recolección y organización
de datos en tablas.
• Gráficas de barras.
• Composición y descomposición de
números naturales con números
mínimo hasta el 999.
• Comparación y ordenamiento de
números menores que 999.
• Resolución de problemas de adición
y sustracción de números naturales
mínimo hasta el 999.
• Aplicación de los signos de =, +, - y x en
juegos en el aula y otras situaciones de
sus entornos.
• Multiplicación de números naturales
cuyos factores sean menores que diez.
• Recolección de datos.
• Resolución de problemas que
involucren la recolección, organización
y tabulación e interpretación de datos
no agrupados en tablas y en barras.
• Resolución de problemas de
organización e interpretación de datos.
• Responsabilidad en
las actuaciones y en
los compromisos
contraídos al resolver
problemas de
adición, sustracción,
mínimo hasta el 999,
y multiplicación de
números naturales
cuyos factores sean
menores que diez.
• Autonomía.
• Satisfacción al sentirse
competente.',
    '["Justifica, a partir de ideas matemáticas, procesos implicados en la"]'::jsonb,
    'Guia Matematica WEB',
    '2023',
    '303',
    'https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo',
    'pendiente_validacion',
    true,
    '3f19d900cb639743f00ef43c7229b0ecba5dee5d949d0536444177b951aa137b'
) ON CONFLICT (source_id) DO NOTHING;

INSERT INTO public.curriculo_secuencias (
    source_id, nivel, ciclo, grado_num, area, tema, bloque_guia,
    competencias_especificas, contenidos_texto_original, indicadores_logro,
    fuente_documento, version_curricular, pagina, url_fuente,
    estado_validacion, vigente, huella
) VALUES (
    'SEC-PRI-3-MAT-012',
    'Primario',
    'Primer Ciclo',
    3,
    'Matemática',
    'naturales como mínimo',
    'Página 304',
    'Comunicativa
Representa, leyendo, escribiendo, interpretando y discutiendo, su comprensión de los enunciados de
problemas matemáticos y los conceptos y propiedades de las operaciones relativas a estos, para establecer
las relaciones entre ellos y con el contexto circundante.
Pensamiento Lógico, Creativo y Crítico; Resolución de Problemas; Científica y Tecnológica
Utiliza en forma sistemática estrategias de resolución de problemas, verificando e interpretando sus
resultados con relación a la situación de problema presentada, y justificando con su lenguaje cotidiano,
procesos de razonamientos propios, acerca de una justificación, un procedimiento o un resultado
matemático, de forma inductiva.
Ética y Ciudadana; Desarrollo Personal y Espiritual; Ambiental y de la Salud
Interpreta posibles soluciones a situaciones del entorno y el medioambiente a partir de sus conocimientos
matemáticos.',
    'Conceptos Procedimientos Actitudes y Valores
• Secuencia de números
naturales como mínimo
hasta el 99,999.
• Valor de posición: unidad,
decena, centena, unidad de
mil y decena de mil.
• Recta numérica.
• Cálculo mental, adición
de números naturales,
término de la adición,
propiedades de la adición,
sustracción de números
naturales, estimación de
sumas y restas.
• Multiplicación y división.
• Propiedades de la
multiplicación.
• Recolección, organización
y análisis de datos no
agrupados.
• Tablas de conteo.
• Gráficas de barras.
• Comprensión de la secuencia numérica
como mínimo hasta 99,999.
• Composición y descomposición de
números naturales a partir del valor
posicional, mínimo hasta el 99,999.
• Resolución de problemas que requieren
el manejo de números naturales.
• Cálculo de operaciones de suma y resta
de números naturales cuyo resultado
no exceda a 99,999.
• Multiplicación con números naturales
de una cifra por dos cifras y una cifra
por tres cifras.
• División con números naturales de dos
cifras entre una cifra.
• Recolección, organización, clasificación,
registro en tabla y análisis de datos no
agrupados.
• Clasificación y organización de datos de
acuerdo a criterios definidos.
• Resolución de problemas relacionados
con la recolección y organización,
análisis e interpretación de datos en
tablas de conteo, y gráficas de barras.
• Disfrute del trabajo en
matemática.
• Perseverancia en el
trabajo en matemática.
• Responsabilidad en
las actuaciones y en
los compromisos
contraídos.
• Curiosidad e interés por
el aprendizaje.
• Interés en leer tablas
de conteo, gráficas de
barras.
• Satisfacción al trabajar
con gráficos de barras.',
    '["Expresa, a partir de la lectura, escritura y traducción, ideas matemáticas sobre temáticas del contexto","escolar referidas a"]'::jsonb,
    'Guia Matematica WEB',
    '2023',
    '304',
    'https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo',
    'pendiente_validacion',
    true,
    '39d67da8e1c0c12e705243ce0995cfd40aa24245073d56a907c07336b4f13874'
) ON CONFLICT (source_id) DO NOTHING;

INSERT INTO public.curriculo_secuencias (
    source_id, nivel, ciclo, grado_num, area, tema, bloque_guia,
    competencias_especificas, contenidos_texto_original, indicadores_logro,
    fuente_documento, version_curricular, pagina, url_fuente,
    estado_validacion, vigente, huella
) VALUES (
    'SEC-PRI-1-MAT-014',
    'Primario',
    'Primer Ciclo',
    1,
    'Matemática',
    '4. LAS SECUENCIAS DE ENSEÑANZA EN LAS GUÍAS MULTIGRADO',
    'Página 7',
    'se presentan para todo el año y se expresan de forma
general sin discriminar por',
    '. Lo mismo ocurre con los',
    '["de cada grado. A continua-","ción, se presenta la copia textual de estos componentes de la Adecuación Curricular que se toman como referencia","para acotar las particularidades de cada"]'::jsonb,
    'Guia Multigrado Matematicas',
    '2023',
    '7',
    'https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo',
    'pendiente_validacion',
    true,
    'bf5a7bc8547ea19e19897fa864749ae99a5a406614012f87a2bed8483ca41e8f'
) ON CONFLICT (source_id) DO NOTHING;

INSERT INTO public.curriculo_secuencias (
    source_id, nivel, ciclo, grado_num, area, tema, bloque_guia,
    competencias_especificas, contenidos_texto_original, indicadores_logro,
    fuente_documento, version_curricular, pagina, url_fuente,
    estado_validacion, vigente, huella
) VALUES (
    'SEC-PRI-1-MAT-015',
    'Primario',
    'Primer Ciclo',
    1,
    'Matemática',
    'naturales como mínimo',
    'Página 38',
    'Comunicativa
Relaciona materiales y objetos físicos e imágenes con ideas matemáticas que expresa para buscar
soluciones a situaciones de problemas elementales relacionados con su entorno cotidiano.
Pensamiento Lógico, Crítico y Creativo; Competencia Resolución de Problemas; Competencia
Tecnológica y Científica
Resuelve situaciones problemáticas, en forma coherente y con el apoyo de recursos manipulativos para
la explicación matemática de situaciones cotidianas.
Ética y Ciudadana, Competencia Ambiental y de la Salud, Competencia Desarrollo Personal y Espiritual
Valora las normas de convivencia y el trabajo en equipo, respetando las ideas de compañeros para llegar
a acuerdos sobre los temas matemáticos desarrollados.',
    'Conceptos Procedimientos Actitudes y Valores
• Secuencia de números
naturales como mínimo
hasta el 10.
• Adición de números
naturales como mínimo
hasta el 10.
• Sustracción de números
naturales como mínimo
hasta el 10.
• Cuerpos geométricos:
cubo, esfera, cono y
cilindro, prisma y pirámide
rectangulares.
• Conteo de números menores
o iguales a 10 de acuerdo con
diferentes criterios.
• Resolución de problemas
utilizando las operaciones de
adición y sustracción.
• Comparación y clasificación
de cuerpos geométricos de
acuerdo con características
comunes.
• Resolución de problemas que
impliquen prisma rectangular
y pirámide.
• Identificación y relación de
formas del entorno escolar
y familiar con cuerpos
geométricos.
• Disfrute del trabajo en
matemática.
• Actitud de esfuerzo y
perseverancia.
• Disfrute del juego en el aula.',
    '["Construye el significado de las operaciones de adición y sustracción de números naturales hasta el 10","discutiendo situaciones problema.","Expresa, en forma oral, los procesos realizados en la búsqueda de solución a problemas geométricos.","Utiliza formas de pensamiento lógico para la resolución de problemas en contextos cercanos.","Describe figuras geométricas planas y cuerpos geométricos.","Trabaja de manera colaborativa respetando las diferentes ideas y puntos de vista de los demás en el","quehacer matemático de aula."]'::jsonb,
    'Guia Multigrado Matematicas',
    '2023',
    '38',
    'https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo',
    'pendiente_validacion',
    true,
    '96541bd2162b10ad8d26707fec06a60cd2ecae46ae6e6ee8c9a388eee91f3333'
) ON CONFLICT (source_id) DO NOTHING;

INSERT INTO public.curriculo_secuencias (
    source_id, nivel, ciclo, grado_num, area, tema, bloque_guia,
    competencias_especificas, contenidos_texto_original, indicadores_logro,
    fuente_documento, version_curricular, pagina, url_fuente,
    estado_validacion, vigente, huella
) VALUES (
    'SEC-PRI-2-MAT-013',
    'Primario',
    'Primer Ciclo',
    2,
    'Matemática',
    'naturales como mínimo',
    'Página 39',
    'Comunicativa
Explica sus ideas utilizando números naturales para uso del lenguaje cotidiano.
Pensamiento Lógico, Creativo y Crítico; Resolución de Problemas; Tecnológica y Científica
Utiliza la estimación con la finalidad de resolver problemas.
Ética y Ciudadana; Desarrollo Personal y Espiritual; Ambiental y de la Salud
Respeta los puntos de vista y argumentos de los demás sobre situaciones que implican conocimientos
matemáticos.',
    'Conceptos Procedimientos Actitudes y Valores
• Secuencia de números
naturales como mínimo
hasta el 100.
• Adición de números
naturales, sustracción
de números naturales
mínimo hasta el 100.
• Cuerpos geométricos:
cubo, prisma rectangular,
pirámide, esfera, cono,
cilindro.
• Elementos o partes de
los cuerpos geométricos
y figuras planas en las
caras de los cuerpos
geométricos.
• Conteo de números hasta 100 siguiendo
diferentes criterios.
• Composición y descomposición de números
naturales con números mínimos hasta el
100.
• Comparación y ordenamiento de números
menores que 100.
• Resolución de problemas de adición y
sustracción de números naturales mínimo
hasta el 100.
• Aplicación de los signos de =, +, - en juegos
en el aula y otras situaciones de sus
entornos.
• Identificación de cuerpos geométricos: cubo,
prisma rectangular, pirámide, esfera, cono,
cilindro en situaciones de la vida diaria.
• Resolución de problemas que impliquen
el reconocimiento de figuras planas en las
caras de los cuerpos.
• Responsabilidad en
las actuaciones y en
los compromisos
contraídos al
resolver problemas.
• Autonomía en la
identificación de
formas simétricas
del entorno.
• Satisfacción al
sentirse competente.',
    '["Justifica a partir de ideas matemáticas procesos implicados en la"]'::jsonb,
    'Guia Multigrado Matematicas',
    '2023',
    '39',
    'https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo',
    'pendiente_validacion',
    true,
    '375c872e602d85c36554b6ffc2e8d5335c700a11e07a79550aa4d7d5823eec78'
) ON CONFLICT (source_id) DO NOTHING;

INSERT INTO public.curriculo_secuencias (
    source_id, nivel, ciclo, grado_num, area, tema, bloque_guia,
    competencias_especificas, contenidos_texto_original, indicadores_logro,
    fuente_documento, version_curricular, pagina, url_fuente,
    estado_validacion, vigente, huella
) VALUES (
    'SEC-PRI-3-MAT-013',
    'Primario',
    'Primer Ciclo',
    3,
    'Matemática',
    'naturales como mínimo',
    'Página 40',
    'Comunicativa
Representa, leyendo, escribiendo, interpretando y discutiendo, su comprensión de los enunciados de
problemas matemáticos.
Pensamiento Lógico, Creativo y Crítico; Resolución de Problemas; Tecnológica y Científica
Utiliza en forma sistemática estrategias de resolución de problemas, justificando con su lenguaje cotidiano
procesos de razonamientos propios, acerca de un resultado matemático, de forma inductiva y utilizando
recursos concretos.
Ética y Ciudadana; Desarrollo Personal y Espiritual; Ambiental y de la Salud
Interpreta posibles soluciones a situaciones del entorno a partir de sus conocimientos matemáticos.',
    'Conceptos Procedimientos Actitudes y Valores
• Secuencia de números
naturales como mínimo
hasta el 1,000.
• Cálculo mental.
• Adición y sustracción de
números naturales.
• Estimación de sumas y
restas.
• Cuerpos geométricos:
cubo, prisma rectangular,
pirámide.
• Comprensión de la secuencia numérica
como mínimo hasta 1,000.
• Composición y descomposición de números
naturales a partir del valor posicional
mínimo hasta el 1,000.
• Resolución de problemas que requieren el
manejo de números naturales.
• Resolución de problemas utilizando las
operaciones aritméticas que impliquen el
cálculo mental, y estimaciones.
• Cálculo de operaciones de suma y resta
de números naturales cuyo resultado no
exceda a 1,000.
• Identificación de cuerpos geométricos.
• Disfrute del trabajo
en matemática.
• Perseverancia
en el trabajo en
matemática.
• Responsabilidad en
las actuaciones y en
los compromisos
contraídos.',
    '["Expresa, a partir de la lectura y la escritura, ideas matemáticas referidas a"]'::jsonb,
    'Guia Multigrado Matematicas',
    '2023',
    '40',
    'https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo',
    'pendiente_validacion',
    true,
    '14be8c7adbe476d86a96ea297f0792283f8f4d7cf93cf318fd62f2d9f30df220'
) ON CONFLICT (source_id) DO NOTHING;

INSERT INTO public.curriculo_secuencias (
    source_id, nivel, ciclo, grado_num, area, tema, bloque_guia,
    competencias_especificas, contenidos_texto_original, indicadores_logro,
    fuente_documento, version_curricular, pagina, url_fuente,
    estado_validacion, vigente, huella
) VALUES (
    'SEC-PRI-1-MAT-016',
    'Primario',
    'Primer Ciclo',
    1,
    'Matemática',
    'naturales hasta el 100.',
    'Página 90',
    'Comunicativa
Relaciona materiales y objetos físicos, con ideas matemáticas que expresa para buscar soluciones a
situaciones de problemas elementales relacionados con su entorno cotidiano.
Pensamiento Lógico, Creativo y Crítico; Resolución de Problemas; Científica y Tecnológica
Resuelve situaciones problemáticas, en forma coherente y con el apoyo de recursos manipulativos;
identificando patrones, estructuras o regularidades de forma inductiva para la explicación matemática
de situaciones cotidianas.
Ética y Ciudadana; Desarrollo Personal y Espiritual; Ambiental y de la Salud
Valora las normas de convivencia y el trabajo en equipo, respetando las ideas de compañeros para llegar
a acuerdos sobre los temas matemáticos desarrollados.',
    'Conceptos Procedimientos Actitudes y Valores
• Secuencia de números
naturales hasta el 100.
• Patrones de números.
• Adición de números
naturales hasta el 50.
• Sustracción de números
naturales hasta el 50.
• Medidas y longitud.
• Unidades arbitrarias de
longitud.
• Medidas arbitrarias y
corporales.
• Composición y
descomposición de números
hasta el 100.
• Resolución de problemas
utilizando las operaciones de
adición y sustracción.
• Comparaciones de números
menores o iguales que 100.
• Resolución de problemas
que impliquen medidas de
longitud.
• Valoración del uso del valor
posicional de un número
mínimo a 99.
• Disfrute del trabajo en
matemática con las
operaciones de adición y
sustracción de números
naturales mínimo hasta el
99.
• Disfrute al resolver
problemas de adición y
sustracción de números
naturales mínimo hasta el
99.',
    '["Demuestra comprensión del sistema de numeración decimal y de valor de posición.","Construye el significado de las operaciones de adición y sustracción de números naturales hasta el 50,","discutiendo situaciones de problema.","Expresa, en forma oral, los procesos realizados en la búsqueda de solución a problemas de","mediciones.","Utiliza formas de pensamiento lógico para la resolución de problemas en contextos cercanos.","Reconoce y describe una amplia diversidad de patrones numéricos.","Integra recursos manipulativos como apoyo para la comprensión de las ideas matemáticas y en la","resolución de problemas.","Trabaja de manera colaborativa respetando las diferentes ideas y puntos de vista de los demás en el","quehacer matemático de aula."]'::jsonb,
    'Guia Multigrado Matematicas',
    '2023',
    '90',
    'https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo',
    'pendiente_validacion',
    true,
    'f76fca6155152f685d6ce86cd7bbcf3e665bac0b59f050d370090c78ed1c92c9'
) ON CONFLICT (source_id) DO NOTHING;

INSERT INTO public.curriculo_secuencias (
    source_id, nivel, ciclo, grado_num, area, tema, bloque_guia,
    competencias_especificas, contenidos_texto_original, indicadores_logro,
    fuente_documento, version_curricular, pagina, url_fuente,
    estado_validacion, vigente, huella
) VALUES (
    'SEC-PRI-2-MAT-014',
    'Primario',
    'Primer Ciclo',
    2,
    'Matemática',
    'naturales como mínimo',
    'Página 91',
    'Comunicativa
Explica sus ideas utilizando números naturales para uso del lenguaje cotidiano.
Pensamiento Lógico, Creativo y Crítico; Resolución de Problemas; Tecnológica y Científica
Utiliza la estimación y medición matemática.
Ética y Ciudadana; Desarrollo Personal y Espiritual; Ambiental y de la Salud
Respeta los puntos de vista y argumentos de los demás sobre situaciones que implican conocimientos
matemáticos referidos al contexto social y ambiental.',
    'Conceptos Procedimientos Actitudes y Valores
• Secuencia de números
naturales como mínimo
hasta el 1,000.
• Adición de números
naturales y sustracción de
números naturales hasta el
100.
• Unidad de medida arbitraria
o convencional.
• Longitudes, unidades
arbitrarias, el centímetro.
• Reglas.
• Composición y
descomposición de números
naturales mínimo hasta el
1,000.
• Comparación y ordenamiento
de números menores o
iguales que 1,000.
• Resolución de problemas de
adición y sustracciones de
números naturales mínimo
hasta el 100.
• Utilización de instrumentos
de medición.
• Uso de materiales del
entorno como unidades
arbitrarias de medida.
• Responsabilidad en las
actuaciones y en los
compromisos contraídos al
resolver problemas.
• Interés al realizar medidas de
longitud.
• Satisfacción al sentirse
competente para medir
objetos en su entorno.
• Valoración al poder utilizar
partes de su cuerpo
para realizar mediciones
arbitrarias.',
    '["Justifica a partir de ideas matemáticas, procesos implicados en la"]'::jsonb,
    'Guia Multigrado Matematicas',
    '2023',
    '91',
    'https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo',
    'pendiente_validacion',
    true,
    'd679e498d8f41d60619b74df6902643e77712bd3c11586a2f269141d3338c25b'
) ON CONFLICT (source_id) DO NOTHING;

INSERT INTO public.curriculo_secuencias (
    source_id, nivel, ciclo, grado_num, area, tema, bloque_guia,
    competencias_especificas, contenidos_texto_original, indicadores_logro,
    fuente_documento, version_curricular, pagina, url_fuente,
    estado_validacion, vigente, huella
) VALUES (
    'SEC-PRI-3-MAT-014',
    'Primario',
    'Primer Ciclo',
    3,
    'Matemática',
    'naturales hasta el',
    'Página 92',
    'Comunicativa
Representa, leyendo, escribiendo, interpretando y discutiendo, su comprensión de los enunciados de
problemas matemáticos y los conceptos.
Pensamiento Lógico, Creativo y Crítico; Resolución de Problemas; Tecnológica y Científica
Utiliza en forma sistemática estrategias de resolución de problemas, verificando e interpretando sus
resultados con relación a la situación de problema presentada, y justificando con su lenguaje cotidiano,
procesos de razonamientos propios, acerca de un procedimiento o un resultado matemático, de forma
inductiva y utilizando recursos concretos.
Ética y Ciudadana; Desarrollo Personal y Espiritual; Ambiental y de la Salud
Interpreta posibles soluciones a situaciones a partir de sus conocimientos matemáticos.',
    'Conceptos Procedimientos Actitudes y Valores
• Secuencia de números
naturales hasta el
10,000.
• Adición de números
naturales, propiedades
de la adición.
• Sustracción de números
naturales.
• Multiplicación y división
como sumas y restas
reiteradas.
• Unidades de medidas:
centímetro y metro.
• Suma y resta de
longitudes.
• Composición y descomposición de
números naturales a partir del valor
posicional hasta el 10,000.
• Resolución de problemas utilizando
las operaciones aritméticas que
impliquen el cálculo mental,
estimación y propiedades de las
operaciones de adición y sustracción
de números naturales.
• Cálculo de operaciones de suma y
resta de números naturales cuyo
resultado no exceda a 1,000.
• Multiplicación con números
naturales de una cifra por dos cifras.
• División con números naturales de
números de una cifra o dos cifras
entre una cifra.
• Descripción del procedimiento
utilizado para medir longitudes.
• Resolución de problemas de la vida
diaria que involucren medidas de
longitud.
• Disfrute del trabajo en
matemática.
• Perseverancia en el
trabajo en matemática.
• Responsabilidad en las
actuaciones y en los
compromisos contraídos.
• Criticidad al medir
longitudes usando el
centímetro y el metro
como unidades de
medidas.',
    '["Expresa ideas matemáticas sobre temáticas del contexto escolar referidas a"]'::jsonb,
    'Guia Multigrado Matematicas',
    '2023',
    '92',
    'https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo',
    'pendiente_validacion',
    true,
    '880be0370c266d4b60b6842233f3a73d2fa457e0ae991d764f74b74150023bd9'
) ON CONFLICT (source_id) DO NOTHING;

INSERT INTO public.curriculo_secuencias (
    source_id, nivel, ciclo, grado_num, area, tema, bloque_guia,
    competencias_especificas, contenidos_texto_original, indicadores_logro,
    fuente_documento, version_curricular, pagina, url_fuente,
    estado_validacion, vigente, huella
) VALUES (
    'SEC-PRI-1-MAT-017',
    'Primario',
    'Primer Ciclo',
    1,
    'Matemática',
    'naturales como mínimo',
    'Página 134',
    'Comunicativa
Relaciona materiales y objetos físicos con ideas matemáticas que expresa claramente para buscar
soluciones a situaciones elementales relacionados con su entorno cotidiano.
Pensamiento Lógico, Creativo y Crítico; Resolución de Problemas; Científica y Tecnológica
Resuelve situaciones problemáticas, en forma coherente y con el apoyo de recursos manipulativos,
identificando patrones, regularidades de forma inductiva.
Ética y Ciudadana; Desarrollo Personal y Espiritual; Ambiental y de la Salud; Competencia Desarrollo
Personal y Espiritual
Valora las normas de convivencia y el trabajo en equipo, respetando las ideas de compañeros para llegar
a acuerdos sobre los temas matemáticos desarrollados.',
    'Conceptos Procedimientos Actitudes y Valores
• Secuencia de números
naturales como mínimo
hasta el 99.
• Patrones de números.
• Adición de números
naturales como mínimo
hasta 99.
• Sustracción de números
naturales como mínimo
hasta el 99.
• Recolección y organización
de datos no agrupados.
• Tablas de conteo.
• Pictogramas.
• Composición y
descomposición de números
como mínimo hasta el 99.
• Resolución de problemas
utilizando las operaciones de
adición y sustracción.
• Comparaciones de números
menores o iguales que 99.
• Recolección, organización
y clasificación de datos no
agrupados.
• Lectura o interpretación
de pictogramas y tablas de
datos sencillos.
• Disfrute del trabajo en
matemática con las
operaciones de adición y
sustracción de números
naturales mínimo hasta el
99.
• Disfrute al resolver
problemas de adición y
sustracción de números
naturales mínimo hasta el
99.
• Actitud de esfuerzo y
perseverancia en la solución
de problemas.',
    '["Demuestra comprensión del sistema de numeración decimal al relacionar los conceptos de contar y de","valor de posición.","Construye el significado de las operaciones de adición y sustracción de números naturales hasta el 99,","discutiendo situaciones de problema.","Expresa en forma oral los procesos realizados en la búsqueda de solución a problemas.","Utiliza formas de pensamiento lógico para organizar y relacionar informaciones diversas relativas a la","vida cotidiana y a la resolución de problemas en contextos cercanos.","Recoge, organiza y representa datos en tablas de conteo interpretándolos de acuerdo a su contexto","escolar y familiar.","Reconoce y describe una amplia diversidad de patrones numéricos.","Integra recursos manipulativos como apoyo para la comprensión de las ideas matemáticas y en la","resolución de problemas.","Trabaja de manera colaborativa respetando las diferentes ideas y puntos de vista de los demás en el","quehacer matemático de aula."]'::jsonb,
    'Guia Multigrado Matematicas',
    '2023',
    '134',
    'https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo',
    'pendiente_validacion',
    true,
    'e5ca3a37a82c50a26259e4f499fdb82845aa5e4c347ee4bcbc7991346e1d4800'
) ON CONFLICT (source_id) DO NOTHING;

INSERT INTO public.curriculo_secuencias (
    source_id, nivel, ciclo, grado_num, area, tema, bloque_guia,
    competencias_especificas, contenidos_texto_original, indicadores_logro,
    fuente_documento, version_curricular, pagina, url_fuente,
    estado_validacion, vigente, huella
) VALUES (
    'SEC-PRI-2-MAT-015',
    'Primario',
    'Primer Ciclo',
    2,
    'Matemática',
    'naturales como mínimo',
    'Página 135',
    'Comunicativa
Explica sus ideas utilizando números naturales para uso del lenguaje cotidiano.
Pensamiento Lógico, Creativo y Crítico; Resolución de Problemas; Científica y Tecnológica
Resuelve problemas identificados en su comunidad.
Ética y Ciudadana; Desarrollo Personal y Espiritual; Ambiental y de la Salud
Respeta los puntos de vista y argumentos de los demás sobre situaciones que implican conocimientos
matemáticos referidos al contexto social y ambiental.',
    'Conceptos Procedimientos Actitudes y Valores
• Secuencia de números
naturales como mínimo
hasta el 999.
• Valor de posición: unidad,
decena y centena.
• Adición de números
naturales y sustracción de
números naturales hasta el
999.
• Multiplicación y división
(iniciación).
• Recolección y organización
de datos en tablas.
• Gráficas de barras.
• Composición y
descomposición de números
naturales mínimo hasta el
999.
• Comparación y ordenamiento
de números menores o
iguales que 999.
• Resolución de problemas
de adición y sustracción de
números naturales mínimo
hasta el 999.
• Recolección de datos sobre
preferencias.
• Resolución de problemas que
involucren la recolección,
organización y tabulación e
interpretación de datos no
agrupados en tablas y en
gráficas de barras.
• Responsabilidad en las
actuaciones y en los
compromisos contraídos
al resolver problemas de
adición, sustracción, mínimo
hasta el 999.',
    '["Justifica, a partir de ideas matemáticas, procesos implicados en la"]'::jsonb,
    'Guia Multigrado Matematicas',
    '2023',
    '135',
    'https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo',
    'pendiente_validacion',
    true,
    '6eeb8251e6687383fbae97702a5566511bdfe8f08ce75caf4a8bf1bbdc380c0e'
) ON CONFLICT (source_id) DO NOTHING;

INSERT INTO public.curriculo_secuencias (
    source_id, nivel, ciclo, grado_num, area, tema, bloque_guia,
    competencias_especificas, contenidos_texto_original, indicadores_logro,
    fuente_documento, version_curricular, pagina, url_fuente,
    estado_validacion, vigente, huella
) VALUES (
    'SEC-PRI-3-MAT-015',
    'Primario',
    'Primer Ciclo',
    3,
    'Matemática',
    'números naturales',
    'Página 136',
    'Comunicativa
Representa, leyendo, escribiendo, interpretando y discutiendo, su comprensión de los enunciados de
problemas matemáticos y los conceptos y propiedades de las operaciones relativas a estos, para establecer
las relaciones entre ellos y con el contexto circundante.
Pensamiento Lógico, Creativo y Crítico; Resolución de Problemas; Científica y Tecnológica
Utiliza en forma sistemática estrategias de resolución de problemas, verificando e interpretando sus
resultados con relación a la situación de problema presentada, y justificando con su lenguaje cotidiano,
procesos de razonamientos propios, acerca de una demostración, un algoritmo o un resultado matemático,
de forma inductiva y utilizando recursos concretos e integrando las tecnologías digitales.
Ética y Ciudadana; Desarrollo Personal y Espiritual; Ambiental y de la Salud
Respeta los puntos de vista y argumentos de los demás sobre situaciones que implican conocimientos
matemáticos referidos al contexto social y ambiental.',
    'Conceptos Procedimientos Actitudes y Valores
• Secuencia de
números naturales
como mínimo hasta
el 999.
• Valor de posición:
unidad, decena y
centena.
• Adición de números
naturales y
sustracción de
números naturales
hasta el 999.
• Multiplicación y
división (iniciación).
• Recolección y
organización de
datos en tablas.
• Gráficas de barras.
• Composición y descomposición de números
naturales a partir del valor posicional hasta el 9,999.
• Resolución de problemas utilizando las operaciones
aritméticas que impliquen el cálculo mental,
estimación y propiedades de las operaciones de
adición y sustracción de números naturales.
• Cálculo de operaciones de suma y resta de números
naturales cuyo resultado no exceda 9,999.
• Multiplicación con números naturales de una cifra
por dos cifras.
• División con números naturales de números de una
cifra o dos cifras entre una cifra con sumas y restas
reiteradas.
• Recolección, organización, registro en tabla y
análisis de datos no agrupados.
• Resolución de problemas relacionados con la
recolección y organización, análisis e interpretación
de datos en tablas y gráficas de barras.
• Disfrute del
trabajo en
matemática.
• Perseverancia
en el trabajo en
matemática.
• Responsabilidad
en las actuaciones
y en los
compromisos
contraídos.
• Satisfacción al
colorear gráficos
de barras.',
    '["Expresa, a partir de la lectura, escritura y traducción, ideas matemáticas sobre temáticas del contexto","escolar referidas a"]'::jsonb,
    'Guia Multigrado Matematicas',
    '2023',
    '136',
    'https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo',
    'pendiente_validacion',
    true,
    '1f24ee1d834a56f9c3cee08f02e0d388cd9f2cb012b29a7c2d976b73d02d5c08'
) ON CONFLICT (source_id) DO NOTHING;

INSERT INTO public.curriculo_secuencias (
    source_id, nivel, ciclo, grado_num, area, tema, bloque_guia,
    competencias_especificas, contenidos_texto_original, indicadores_logro,
    fuente_documento, version_curricular, pagina, url_fuente,
    estado_validacion, vigente, huella
) VALUES (
    'SEC-PRI-1-MAT-018',
    'Primario',
    'Primer Ciclo',
    1,
    'Matemática',
    'naturales hasta el 99.',
    'Página 186',
    'Comunicativa
Relaciona materiales y objetos físicos con ideas matemáticas que expresa para buscar soluciones a
situaciones de problemas elementales relacionados con su entorno cotidiano.
Pensamiento Lógico, Creativo y Crítico; Resolución de Problemas; Tecnológica y Científica
Resuelve situaciones problemáticas, en forma coherente y con el apoyo de recursos manipulativos,
identificando patrones, estructuras o regularidades.
Ética y Ciudadana; Ambiental y de la Salud; Desarrollo Personal y Espiritual
Valora las normas de convivencia y el trabajo en equipo, respetando las ideas de compañeros para llegar a
acuerdos sobre los temas matemáticos desarrollados.',
    'Conceptos Procedimientos Actitudes y Valores
• Secuencia de números
naturales hasta el 99.
• Adición de números
naturales hasta el 99.
• Sustracción de números
naturales hasta el 99.
• Figuras planas: círculo,
triángulo, cuadrado y
rectángulo.
• Conteo de números menores
que 50 de acuerdo a diferentes
criterios.
• Conteo de dos en dos, de tres
en tres, de cinco en cinco, de
diez en diez.
• Composición y descomposición
de números hasta el 99.
• Resolución de problemas
utilizando las operaciones de
adición y sustracción.
• Resolución de problemas que
impliquen prisma rectangular y
pirámide.
• Identificación y relación de
formas del entorno escolar
y familiar con cuerpos
geométricos y figuras planas
geométricas.
• Disfrute del trabajo en
matemática.
• Actitud de esfuerzo y
perseverancia.
• Disfrute del juego en el aula.',
    '["Demuestra comprensión del sistema de numeración decimal al relacionar los conceptos de contar,","agrupar y de valor de posición.","Construye el significado de las operaciones de adición y sustracción de números naturales hasta el 99,","discutiendo situaciones de problema.","Expresa en forma oral los procesos realizados en la búsqueda de solución a problemas geométricos.","Utiliza formas de pensamiento lógico para la resolución de problemas en contextos cercanos.","Describe y clasifica figuras geométricas planas y cuerpos geométricos.","Reconoce y describe una amplia diversidad de patrones numéricos.","Trabaja de manera colaborativa respetando las diferentes ideas y puntos de vista de los demás en el","quehacer matemático del aula."]'::jsonb,
    'Guia Multigrado Matematicas',
    '2023',
    '186',
    'https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo',
    'pendiente_validacion',
    true,
    '12bc8a47fa12b29cf04f4dbc13e11b3a82ec2197308240affcbf7f3fe185b801'
) ON CONFLICT (source_id) DO NOTHING;

INSERT INTO public.curriculo_secuencias (
    source_id, nivel, ciclo, grado_num, area, tema, bloque_guia,
    competencias_especificas, contenidos_texto_original, indicadores_logro,
    fuente_documento, version_curricular, pagina, url_fuente,
    estado_validacion, vigente, huella
) VALUES (
    'SEC-PRI-2-MAT-016',
    'Primario',
    'Primer Ciclo',
    2,
    'Matemática',
    'naturales como mínimo',
    'Página 187',
    'Comunicativa
Explica sus ideas utilizando números naturales para uso del lenguaje cotidiano.
Pensamiento Lógico, Creativo y Crítico; Resolución de Problemas; Tecnológica y Científica
Resuelve situaciones problemáticas de numeración, operaciones y geometría.
Ética y Ciudadana; Ambiental y de la Salud; Desarrollo Personal y Espiritual
Respeta los puntos de vista y argumentos de los demás sobre situaciones que implican conocimientos
matemáticos referidos al contexto social y ambiental.',
    'Conceptos Procedimientos Actitudes y Valores
• Secuencia de números
naturales como mínimo
hasta el 999.
• Valor de posición: unidad,
decena y centena.
• Adición y sustracción de
números naturales hasta el
999.
• Multiplicación y división
(iniciación).
• Figuras planas: círculo,
triángulo, cuadrado y
rectángulo.
• Composición y descomposición
de números naturales mínimo
hasta el 999.
• Comparación y ordenamiento
de números menores o iguales
que 999.
• Resolución de problemas de
adición y sustracciones de
números naturales mínimo
hasta el 999.
• Identificación de figuras planas
en situaciones de la vida diaria.
• Resolución de problemas que
impliquen el reconocimiento de
figuras planas en las caras de
los cuerpos.
• Responsabilidad en las
actuaciones y en los
compromisos contraídos al
resolver problemas.',
    '["Justifica, a partir de ideas matemáticas, procesos implicados en la"]'::jsonb,
    'Guia Multigrado Matematicas',
    '2023',
    '187',
    'https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo',
    'pendiente_validacion',
    true,
    '8a6584ed7e5691ceb0a3607e7334c55ef43dad513a5397560863fcf7d8dae211'
) ON CONFLICT (source_id) DO NOTHING;

INSERT INTO public.curriculo_secuencias (
    source_id, nivel, ciclo, grado_num, area, tema, bloque_guia,
    competencias_especificas, contenidos_texto_original, indicadores_logro,
    fuente_documento, version_curricular, pagina, url_fuente,
    estado_validacion, vigente, huella
) VALUES (
    'SEC-PRI-3-MAT-016',
    'Primario',
    'Primer Ciclo',
    3,
    'Matemática',
    'naturales hasta el 9,999.',
    'Página 188',
    'Comunicativa
Representa, leyendo, escribiendo, interpretando y discutiendo, su comprensión de los enunciados
de problemas matemáticos y los conceptos y propiedades de las operaciones relativas a estos, para
establecer las relaciones entre ellos y con el contexto circundante.
Pensamiento Lógico, Creativo y Crítico; Resolución de Problemas; Tecnológica y Científica
Utiliza en forma sistemática estrategias de resolución de problemas, verificando e interpretando sus
resultados con relación a la situación de problema presentada, y justificando con su lenguaje cotidiano,
procesos de razonamientos propios, utilizando recursos concretos.
Ética y Ciudadana; Ambiental y de la Salud; Desarrollo Personal y Espiritual
Interpreta posibles soluciones a situaciones del entorno a partir de sus conocimientos matemáticos.',
    'Conceptos Procedimientos Actitudes y Valores
• Secuencia de números
naturales hasta el 9,999.
• Valor de posición: unidad,
decena, centena, unidad de
mil.
• Adición de números naturales.
• Propiedades de la adición.
• Sustracción de números
naturales.
• Multiplicación y división como
sumas y restas reiteradas.
• Propiedades de la
multiplicación.
• Números pares e impares.
• Polígonos: triángulos,
cuadriláteros.
• Elementos de los polígonos:
lados, vértices.
• Cuerpos geométricos: cubo,
prisma rectangular, pirámide.
• Composición y
descomposición de números
naturales a partir del valor
posicional hasta el 9,999.
• Cálculo de operaciones de
suma y resta de números
naturales cuyo resultado no
exceda 9,999.
• Multiplicación con números
naturales de una cifra por dos
cifras.
• División con números
naturales de números de
una cifra o dos cifras entre
una cifra con sumas y restas
reiteradas.
• Disfrute del trabajo en
matemática.
• Perseverancia en el trabajo
en matemática.
• Responsabilidad en las
actuaciones y en los
compromisos contraídos.
• Curiosidad e interés por el
aprendizaje.',
    '["Expresa, a partir de la lectura y escritura, ideas matemáticas sobre temáticas del contexto escolar","referidas a"]'::jsonb,
    'Guia Multigrado Matematicas',
    '2023',
    '188',
    'https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo',
    'pendiente_validacion',
    true,
    '3acb30ea6dd2e1f8f4d57b766b545f3a6d9da6ac60ca29005192945ab7e6a763'
) ON CONFLICT (source_id) DO NOTHING;

INSERT INTO public.curriculo_secuencias (
    source_id, nivel, ciclo, grado_num, area, tema, bloque_guia,
    competencias_especificas, contenidos_texto_original, indicadores_logro,
    fuente_documento, version_curricular, pagina, url_fuente,
    estado_validacion, vigente, huella
) VALUES (
    'SEC-PRI-1-MAT-019',
    'Primario',
    'Primer Ciclo',
    1,
    'Matemática',
    'naturales como mínimo',
    'Página 242',
    'Comunicativa
Relaciona materiales y objetos físicos e imágenes con ideas matemáticas que expresa claramente para
buscar soluciones a situaciones de problemas elementales relacionados con su entorno cotidiano.
Pensamiento Lógico, Creativo y Crítico; Resolución de Problemas; Tecnológica y Científica
Resuelve situaciones problemáticas, en forma coherente y con el apoyo de recursos manipulativos y
digitales, identificando patrones, o regularidades de forma inductiva para la explicación matemática de
situaciones cotidianas.
Ética y Ciudadana; Ambiental y de la Salud; Desarrollo Personal y Espiritual
Valora las normas de convivencia y el trabajo en equipo, respetando las ideas de compañeros para llegar a
acuerdos sobre los temas matemáticos desarrollados.',
    'Conceptos Procedimientos Actitudes y Valores
• Secuencia de números
naturales como mínimo
hasta el 99.
• Patrones de números.
• Valor de posición: unidad y
decena.
• Adición de números
naturales como mínimo
hasta el 99.
• Sustracción de números
naturales como mínimo
hasta el 99.
• Medida de capacidad.
• Conteo de números menores
que 99 de acuerdo con
diferentes criterios.
• Composición de números como
mínimo hasta el 99.
• Resolución de problemas
utilizando las operaciones de
adición y sustracción.
• Disfruta del trabajo en
matemática con las
operaciones de adición y
sustracción de números
naturales mínimo hasta el
99.
• Actitud de esfuerzo y
perseverancia.',
    '["Demuestra comprensión del sistema de numeración decimal al relacionar los conceptos de contar,","agrupar y de valor de posición.","Construye el significado de las operaciones de adición y sustracción de números naturales hasta el 99,","discutiendo situaciones de problema.","Expresa, en forma oral los procesos realizados en la búsqueda de solución a problemas de mediciones.","Utiliza formas de pensamiento lógico para organizar y relacionar informaciones diversas relativas a la","vida cotidiana y a la resolución de problemas en contextos cercanos.","Reconoce y describe una amplia diversidad de patrones numéricos.","Trabaja de manera colaborativa respetando las diferentes ideas y puntos de vista de los demás en el","quehacer matemático de aula."]'::jsonb,
    'Guia Multigrado Matematicas',
    '2023',
    '242',
    'https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo',
    'pendiente_validacion',
    true,
    'a086ae357603e5f1a6576cea6e604bbf734da0509c223673dd8d93e184c2591b'
) ON CONFLICT (source_id) DO NOTHING;

INSERT INTO public.curriculo_secuencias (
    source_id, nivel, ciclo, grado_num, area, tema, bloque_guia,
    competencias_especificas, contenidos_texto_original, indicadores_logro,
    fuente_documento, version_curricular, pagina, url_fuente,
    estado_validacion, vigente, huella
) VALUES (
    'SEC-PRI-2-MAT-017',
    'Primario',
    'Primer Ciclo',
    2,
    'Matemática',
    'naturales como mínimo',
    'Página 243',
    'Comunicativa
Explica sus ideas utilizando números naturales para uso del lenguaje cotidiano.
Pensamiento Lógico, Creativo y Crítico; Resolución de Problemas; Tecnológica y Científica
Utiliza la estimación y medición matemática con la finalidad de resolver problemas.
Ética y Ciudadana; Ambiental y de la Salud; Desarrollo Personal y Espiritual
Respeta los puntos de vista y argumentos de los demás sobre situaciones que implican conocimientos
matemáticos referidos al contexto ambiental.',
    'Conceptos Procedimientos Actitudes y Valores
• Secuencia de números
naturales como mínimo
hasta el 999.
• Valor de posición: unidad,
decena y centena.
• Adición de números
naturales, sustracción de
números naturales mínimo
hasta el 999, multiplicación
de números naturales
(cuyos factores sean
menores que diez).
• Patrones numéricos en la
recta numérica.
• Medidas de capacidad,
unidades arbitrarias de
capacidad, la taza, el litro y
estimación de capacidades.
• Resolución de problemas
de adición y sustracción de
números naturales mínimo
hasta el 999.
• Resolución de problemas de
multiplicación de números
naturales cuyos factores sean
menores que 10.
• Uso de materiales del entorno
como unidades arbitrarias de
medida.
• Medición y estimación de
capacidad en situaciones
diversas y a partir de taza y
litro.
• Responsabilidad en las
actuaciones y en los
compromisos contraídos
al resolver problemas de
adición, sustracción, mínimo
hasta el 999, y multiplicación
de números naturales cuyos
factores sean menores que
diez.
• Autonomía.
• Satisfacción al sentirse
competente para medir
objetos en su entorno.',
    '["Justifica, a partir de ideas matemáticas, procesos implicados en la"]'::jsonb,
    'Guia Multigrado Matematicas',
    '2023',
    '243',
    'https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo',
    'pendiente_validacion',
    true,
    '574c01eda18378d3a4fc5b6887425e0e7800125cc1b5cc21130bcd70eec261cd'
) ON CONFLICT (source_id) DO NOTHING;

INSERT INTO public.curriculo_secuencias (
    source_id, nivel, ciclo, grado_num, area, tema, bloque_guia,
    competencias_especificas, contenidos_texto_original, indicadores_logro,
    fuente_documento, version_curricular, pagina, url_fuente,
    estado_validacion, vigente, huella
) VALUES (
    'SEC-PRI-3-MAT-017',
    'Primario',
    'Primer Ciclo',
    3,
    'Matemática',
    'naturales como',
    'Página 244',
    'Comunicativa
Representa leyendo, escribiendo, interpretando y discutiendo, su comprensión de los enunciados de
problemas matemáticos y los conceptos y propiedades de las operaciones relativas a estos, para establecer
las relaciones entre ellos y con el contexto circundante.
Pensamiento Lógico, Creativo y Crítico; Resolución de Problemas; Tecnológica y Científica
Utiliza en forma sistemática estrategias de resolución de problemas, verificando e interpretando sus
resultados con relación a la situación de problema presentada, y justificando con su lenguaje cotidiano
procesos de razonamientos propios acerca de un procedimiento o un resultado matemático, de forma
inductiva y utilizando recursos concretos.
Ética y Ciudadana; Ambiental y de la Salud; Desarrollo Personal y Espiritual
Interpreta posibles soluciones a situaciones del entorno a partir de sus conocimientos matemáticos.',
    'Conceptos Procedimientos Actitudes y Valores
• Secuencia de números
naturales como
mínimo hasta el
99,999.
• Valor de posición:
unidad, decena,
centena, unidad de mil
y decena de mil.
• Recta numérica.
• Cálculo mental, adición
de números naturales,
propiedades de la
adición, sustracción de
números naturales
• Multiplicación y
división como sumas
y restas de sumando y
restando iguales.
• Propiedades de la
multiplicación.
• Capacidad, taza,
litro, medio litro,
equivalencia entre litro
y taza.
• Comprensión de la secuencia numérica como
mínimo hasta 99,999.
• Composición y descomposición de números
naturales a partir del valor posicional mínimo
hasta el 99,999.
• Resolución de problemas que impliquen el uso de
la recta numérica.
• Resolución de problemas utilizando las
operaciones aritméticas y las propiedades de las
operaciones de adición y sustracción de números
naturales.
• Cálculo de operaciones de suma y resta de
números naturales cuyo resultado no exceda a
99,999.
• Multiplicación con números naturales de una cifra
por dos cifras, con resultados que no excedan
los 99,999. Resolución de problemas en la recta
numérica.
• Identificación de patrones numéricos en la recta
numérica.
• Estimación y medición de capacidades de distintos
recipientes del entorno usando la taza y el litro.
• Resolución de problemas que impliquen: taza, litro,
medio litro, equivalencia entre litro y taza.
• Identificación de fracciones comunes en
situaciones de su entorno de aula y de su
comunidad.
• Responsabilidad
en las
actuaciones
y en los
compromisos
contraídos
al resolver
problemas
de adición,
sustracción,
mínimo hasta
el 999, y
multiplicación
de números
naturales cuyos
factores sean
menores que
diez.
• Autonomía.
• Satisfacción
al sentirse
competente
para medir
objetos en su
entorno.',
    '["Expresa, a partir de la lectura y escritura, ideas matemáticas referidas a"]'::jsonb,
    'Guia Multigrado Matematicas',
    '2023',
    '244',
    'https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo',
    'pendiente_validacion',
    true,
    '02d664d8040a3c395a776948d260e52593c901f77ce57cc05be3f89a65edbb59'
) ON CONFLICT (source_id) DO NOTHING;

INSERT INTO public.curriculo_secuencias (
    source_id, nivel, ciclo, grado_num, area, tema, bloque_guia,
    competencias_especificas, contenidos_texto_original, indicadores_logro,
    fuente_documento, version_curricular, pagina, url_fuente,
    estado_validacion, vigente, huella
) VALUES (
    'SEC-PRI-1-MAT-020',
    'Primario',
    'Primer Ciclo',
    1,
    'Matemática',
    'naturales como mínimo',
    'Página 302',
    'Comunicativa
Relaciona materiales y objetos físicos, imágenes y diagramas con ideas matemáticas que expresa claramente
para buscar soluciones a situaciones de problemas elementales relacionados con su entorno cotidiano.
Pensamiento Lógico, Creativo y Crítico; Competencia Resolución de Problemas; Competencia Tecnológica
y Científica
Formula y resuelve situaciones problemáticas, en forma coherente y con el apoyo de recursos manipulativos
y digitales; identificando patrones, estructuras o regularidades de forma inductiva para la explicación
matemática de situaciones cotidianas.
Ética y Ciudadana; Competencia Ambiental y de la Salud; Competencia Desarrollo Personal y Espiritual
Valora las normas de convivencia y el trabajo en equipo, respetando las ideas de compañeros para llegar a
acuerdos sobre los temas matemáticos desarrollados.',
    'Conceptos Procedimientos Actitudes y Valores
• Secuencia de números
naturales como mínimo
hasta el 99.
• Patrones de números.
• Valor de posición: unidad y
decena.
• Adición de números
naturales como mínimo
hasta el 99.
• Sustracción de números
naturales como mínimo
hasta el 99.
• Simbología de =.
• Recolección y organización
de datos no agrupados.
• Tablas de conteo.
• Pictogramas.
• Composición y descomposición de
números como mínimo hasta el 99.
• Resolución de problemas utilizando las
operaciones de adición y sustracción.
• Uso de la simbología de =.
• Recolección, organización y
clasificación de datos no agrupados.
• Elaboración de tablas de conteo, dada
una serie de objetos distintos, haciendo
una marca a medida que localiza cada
objeto del tipo que está contando.
• Elaboración e interpretación de
pictogramas elaborados con objetos de
su entorno: juguetes, lápices, alimentos.
• Lectura o interpretación de pictogramas
y tablas de datos sencillos usando
herramientas tecnológicas.
• Disfrute del trabajo
en matemática con
las operaciones de
adición y sustracción
de números naturales
mínimo hasta el 99.
• Disfrute al resolver
problemas de adición
y sustracción de
números naturales
mínimo hasta el 99.
• Actitud de esfuerzo y
perseverancia.
• Disfrute del juego en el
aula.',
    '["Demuestra comprensión del sistema de numeración decimal al relacionar los conceptos de contar, agrupar","y de valor de posición.","Construye el significado de las operaciones de adición y sustracción de números naturales hasta el 99,","modelando y discutiendo situaciones de problema.","Expresa, en forma oral y por escrito, los procesos realizados en la búsqueda de solución a problemas.","Utiliza formas de pensamiento lógico para organizar y relacionar informaciones diversas relativas a la vida","cotidiana y a la resolución de problemas en contextos cercanos.","Recoge, organiza, describe datos y los representa en tablas de conteo y pictogramas, interpretándolos de","acuerdo a su contexto escolar y familiar.","Reconoce y describe una amplia diversidad de patrones numéricos.","Trabaja de manera colaborativa respetando las diferentes ideas y puntos de vista de los demás en el","quehacer matemático de aula."]'::jsonb,
    'Guia Multigrado Matematicas',
    '2023',
    '302',
    'https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo',
    'pendiente_validacion',
    true,
    '4da51b9c73384c84315afeedb911364bbff560bc765b8cceb9109a853d2f8cd9'
) ON CONFLICT (source_id) DO NOTHING;

INSERT INTO public.curriculo_secuencias (
    source_id, nivel, ciclo, grado_num, area, tema, bloque_guia,
    competencias_especificas, contenidos_texto_original, indicadores_logro,
    fuente_documento, version_curricular, pagina, url_fuente,
    estado_validacion, vigente, huella
) VALUES (
    'SEC-PRI-2-MAT-018',
    'Primario',
    'Primer Ciclo',
    2,
    'Matemática',
    'naturales como mínimo',
    'Página 303',
    'Comunicativa
Explica sus ideas utilizando números naturales para uso del lenguaje cotidiano.
Pensamiento Lógico, Creativo y Crítico; Resolución de Problemas; Tecnológica y Científica
Resuelve problemas identificados en su comunidad.
Ética y Ciudadana; Desarrollo Personal y Espiritual; Ambiental y de la Salud
Respeta los puntos de vista y argumentos de los demás sobre situaciones que implican conocimientos
matemáticos.',
    'Conceptos Procedimientos Actitudes y Valores
• Secuencia de números
naturales como mínimo
hasta el 999.
• Valor de posición: unidad,
decena y centena.
• Símbolo =.
• Adición de números
naturales, sustracción
de números naturales
mínimo hasta el 999,
multiplicación de números
naturales (cuyos factores
sean menores que diez),
signos =, +, - y x.
• Recolección y organización
de datos en tablas.
• Gráficas de barras.
• Composición y descomposición de
números naturales con números
mínimo hasta el 999.
• Comparación y ordenamiento de
números menores que 999.
• Resolución de problemas de adición
y sustracción de números naturales
mínimo hasta el 999.
• Aplicación de los signos de =, +, - y x en
juegos en el aula y otras situaciones de
sus entornos.
• Multiplicación de números naturales
cuyos factores sean menores que diez.
• Recolección de datos.
• Resolución de problemas que
involucren la recolección, organización
y tabulación e interpretación de datos
no agrupados en tablas y en barras.
• Resolución de problemas de
organización e interpretación de datos.
• Responsabilidad en
las actuaciones y en
los compromisos
contraídos al resolver
problemas de
adición, sustracción,
mínimo hasta el 999,
y multiplicación de
números naturales
cuyos factores sean
menores que diez.
• Autonomía.
• Satisfacción al sentirse
competente.',
    '["Justifica, a partir de ideas matemáticas, procesos implicados en la"]'::jsonb,
    'Guia Multigrado Matematicas',
    '2023',
    '303',
    'https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo',
    'pendiente_validacion',
    true,
    '3f19d900cb639743f00ef43c7229b0ecba5dee5d949d0536444177b951aa137b'
) ON CONFLICT (source_id) DO NOTHING;

INSERT INTO public.curriculo_secuencias (
    source_id, nivel, ciclo, grado_num, area, tema, bloque_guia,
    competencias_especificas, contenidos_texto_original, indicadores_logro,
    fuente_documento, version_curricular, pagina, url_fuente,
    estado_validacion, vigente, huella
) VALUES (
    'SEC-PRI-3-MAT-018',
    'Primario',
    'Primer Ciclo',
    3,
    'Matemática',
    'naturales como mínimo',
    'Página 304',
    'Comunicativa
Representa, leyendo, escribiendo, interpretando y discutiendo, su comprensión de los enunciados de
problemas matemáticos y los conceptos y propiedades de las operaciones relativas a estos, para establecer
las relaciones entre ellos y con el contexto circundante.
Pensamiento Lógico, Creativo y Crítico; Resolución de Problemas; Científica y Tecnológica
Utiliza en forma sistemática estrategias de resolución de problemas, verificando e interpretando sus
resultados con relación a la situación de problema presentada, y justificando con su lenguaje cotidiano,
procesos de razonamientos propios, acerca de una justificación, un procedimiento o un resultado
matemático, de forma inductiva.
Ética y Ciudadana; Desarrollo Personal y Espiritual; Ambiental y de la Salud
Interpreta posibles soluciones a situaciones del entorno y el medioambiente a partir de sus conocimientos
matemáticos.',
    'Conceptos Procedimientos Actitudes y Valores
• Secuencia de números
naturales como mínimo
hasta el 99,999.
• Valor de posición: unidad,
decena, centena, unidad de
mil y decena de mil.
• Recta numérica.
• Cálculo mental, adición
de números naturales,
término de la adición,
propiedades de la adición,
sustracción de números
naturales, estimación de
sumas y restas.
• Multiplicación y división.
• Propiedades de la
multiplicación.
• Recolección, organización
y análisis de datos no
agrupados.
• Tablas de conteo.
• Gráficas de barras.
• Comprensión de la secuencia numérica
como mínimo hasta 99,999.
• Composición y descomposición de
números naturales a partir del valor
posicional, mínimo hasta el 99,999.
• Resolución de problemas que requieren
el manejo de números naturales.
• Cálculo de operaciones de suma y resta
de números naturales cuyo resultado
no exceda a 99,999.
• Multiplicación con números naturales
de una cifra por dos cifras y una cifra
por tres cifras.
• División con números naturales de dos
cifras entre una cifra.
• Recolección, organización, clasificación,
registro en tabla y análisis de datos no
agrupados.
• Clasificación y organización de datos de
acuerdo a criterios definidos.
• Resolución de problemas relacionados
con la recolección y organización,
análisis e interpretación de datos en
tablas de conteo, y gráficas de barras.
• Disfrute del trabajo en
matemática.
• Perseverancia en el
trabajo en matemática.
• Responsabilidad en
las actuaciones y en
los compromisos
contraídos.
• Curiosidad e interés por
el aprendizaje.
• Interés en leer tablas
de conteo, gráficas de
barras.
• Satisfacción al trabajar
con gráficos de barras.',
    '["Expresa, a partir de la lectura, escritura y traducción, ideas matemáticas sobre temáticas del contexto","escolar referidas a"]'::jsonb,
    'Guia Multigrado Matematicas',
    '2023',
    '304',
    'https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo',
    'pendiente_validacion',
    true,
    '39d67da8e1c0c12e705243ce0995cfd40aa24245073d56a907c07336b4f13874'
) ON CONFLICT (source_id) DO NOTHING;



-- 4. PERMISOS Y RECARGA DE CATALOGO POSTGREST
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.curriculo_secuencias TO service_role;
GRANT SELECT ON TABLE public.curriculo_secuencias TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.buscar_curriculo_secuencias(TEXT, SMALLINT, TEXT, TEXT, INT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.buscar_curriculo(TEXT, SMALLINT, TEXT, TEXT, INT) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
