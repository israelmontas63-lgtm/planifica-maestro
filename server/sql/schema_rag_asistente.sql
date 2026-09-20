-- =====================================================================
-- ESQUEMA SQL: RAG CURRICULAR MINERD, AGENTE INVESTIGADOR Y DATOS DOCENTE
-- Planifica Maestro - Base de Datos en Supabase con pgvector y RLS Estricto
-- =====================================================================
-- NOTA: Este archivo es solo para revisión local. NO se ejecuta en Supabase
-- hasta recibir la aprobación expresa del usuario por secciones.
-- =====================================================================

-- 1. Habilitar extensión vectorial pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Tabla de Documentos Oficiales y Universitarios
CREATE TABLE IF NOT EXISTS public.curriculo_documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  institucion TEXT NOT NULL DEFAULT 'MINERD',
  nivel TEXT NOT NULL, -- 'inicial', 'primario', 'secundario', 'superior'
  ciclo TEXT,          -- '1er_ciclo', '2do_ciclo'
  grado TEXT,          -- Vocabulario controlado normalizado (ej. '1ro_prim', '2do_prim')
  area TEXT,           -- Vocabulario controlado normalizado (ej. 'Lengua Española', 'Matemática')
  tipo_documento TEXT NOT NULL, -- 'adecuacion_curricular', 'diseno_curricular', 'guia_con_base', 'ordenanza', 'calendario_escolar', 'programa_universitario'
  anio INTEGER NOT NULL,
  version TEXT NOT NULL,        -- ej. '2023_oficial_final', '2016_version_revisada'
  url_fuente TEXT,
  es_oficial BOOLEAN NOT NULL DEFAULT true,
  es_vigente BOOLEAN NOT NULL DEFAULT true, -- Filtro de vigencia oficial
  requiere_ocr BOOLEAN NOT NULL DEFAULT false,
  docente_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- NULL si es oficial; UUID si es universitario
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Tabla de Fragmentos Curriculares (Chunks)
CREATE TABLE IF NOT EXISTS public.curriculo_fragmentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id UUID NOT NULL REFERENCES public.curriculo_documentos(id) ON DELETE CASCADE,
  contenido TEXT NOT NULL,
  pagina INTEGER NOT NULL DEFAULT 1,
  seccion TEXT,        -- 'competencias_especificas', 'contenidos_conceptuales', 'indicadores_logro', etc.
  nivel TEXT NOT NULL,
  grado TEXT NOT NULL, -- Vocabulario controlado obligatorio (no nulo)
  area TEXT NOT NULL,  -- Vocabulario controlado obligatorio (no nulo)
  tipo_documento TEXT NOT NULL,
  metadatos JSONB NOT NULL DEFAULT '{}'::jsonb,
  embedding VECTOR(768), -- Gemini text-embedding-004 L2 normalizado
  tsv TSVECTOR GENERATED ALWAYS AS (to_tsvector('spanish', contenido)) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Índices para Búsqueda Vectorial y Léxica
CREATE INDEX IF NOT EXISTS idx_curriculo_fragmentos_embedding 
  ON public.curriculo_fragmentos 
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_curriculo_fragmentos_tsv 
  ON public.curriculo_fragmentos USING gin (tsv);

CREATE INDEX IF NOT EXISTS idx_curriculo_fragmentos_filtros 
  ON public.curriculo_fragmentos (nivel, grado, area);

CREATE INDEX IF NOT EXISTS idx_curriculo_documentos_vigente 
  ON public.curriculo_documentos (es_vigente, es_oficial);

-- 5. Función de Búsqueda Híbrida con Reciprocal Rank Fusion (RRF) Optimizado
CREATE OR REPLACE FUNCTION public.buscar_curriculo_hibrido(
  query_text TEXT,
  query_embedding VECTOR(768),
  match_count INT DEFAULT 8,
  filtro_nivel TEXT DEFAULT NULL,
  filtro_grado TEXT DEFAULT NULL,
  filtro_area TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  documento_id UUID,
  contenido TEXT,
  pagina INT,
  seccion TEXT,
  nivel TEXT,
  grado TEXT,
  area TEXT,
  documento_titulo TEXT,
  documento_anio INT,
  documento_version TEXT,
  score_rrf FLOAT
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  k_const CONSTANT FLOAT := 60.0;
BEGIN
  RETURN QUERY
  WITH vector_subquery AS (
    SELECT f.id AS sub_frag_id
    FROM public.curriculo_fragmentos f
    JOIN public.curriculo_documentos d ON f.documento_id = d.id
    WHERE d.es_vigente = true
      AND (d.es_oficial = true OR (v_user_id IS NOT NULL AND d.docente_id = v_user_id))
      AND (filtro_nivel IS NULL OR f.nivel = filtro_nivel)
      AND (filtro_grado IS NULL OR f.grado = filtro_grado)
      AND (filtro_area IS NULL OR f.area = filtro_area)
    ORDER BY f.embedding <=> query_embedding
    LIMIT match_count * 3
  ),
  vector_ranks AS (
    SELECT sub_frag_id AS frag_id, ROW_NUMBER() OVER () AS r_vector
    FROM vector_subquery
  ),
  text_subquery AS (
    SELECT f.id AS sub_frag_id
    FROM public.curriculo_fragmentos f
    JOIN public.curriculo_documentos d ON f.documento_id = d.id
    WHERE d.es_vigente = true
      AND (d.es_oficial = true OR (v_user_id IS NOT NULL AND d.docente_id = v_user_id))
      AND (filtro_nivel IS NULL OR f.nivel = filtro_nivel)
      AND (filtro_grado IS NULL OR f.grado = filtro_grado)
      AND (filtro_area IS NULL OR f.area = filtro_area)
      AND f.tsv @@ websearch_to_tsquery('spanish', query_text)
    ORDER BY ts_rank_cd(f.tsv, websearch_to_tsquery('spanish', query_text)) DESC
    LIMIT match_count * 3
  ),
  text_ranks AS (
    SELECT sub_frag_id AS frag_id, ROW_NUMBER() OVER () AS r_text
    FROM text_subquery
  ),
  fused_scores AS (
    SELECT 
      COALESCE(vr.frag_id, tr.frag_id) AS frag_id,
      (COALESCE(1.0 / (k_const + vr.r_vector), 0.0) + 
       COALESCE(1.0 / (k_const + tr.r_text), 0.0))::FLOAT AS rrf_score
    FROM vector_ranks vr
    FULL OUTER JOIN text_ranks tr ON vr.frag_id = tr.frag_id
  )
  SELECT 
    f.id,
    f.documento_id,
    f.contenido,
    f.pagina,
    f.seccion,
    f.nivel,
    f.grado,
    f.area,
    d.titulo AS documento_titulo,
    d.anio AS documento_anio,
    d.version AS documento_version,
    fs.rrf_score AS score_rrf
  FROM fused_scores fs
  JOIN public.curriculo_fragmentos f ON fs.frag_id = f.id
  JOIN public.curriculo_documentos d ON f.documento_id = d.id
  ORDER BY fs.rrf_score DESC
  LIMIT match_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.buscar_curriculo_hibrido FROM anon, public;
GRANT EXECUTE ON FUNCTION public.buscar_curriculo_hibrido TO authenticated, service_role;

-- 6. Tablas de Datos del Docente (Aislamiento Estricto por user_id)

-- Planes generados
CREATE TABLE IF NOT EXISTS public.planes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  nivel TEXT NOT NULL,
  grado TEXT NOT NULL,
  area TEXT NOT NULL,
  periodo TEXT NOT NULL,
  datos_planificacion JSONB NOT NULL,
  fuentes JSONB NOT NULL DEFAULT '[]'::jsonb,
  confianza_curricular JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Proyectos pedagógicos
CREATE TABLE IF NOT EXISTS public.proyectos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  nivel TEXT NOT NULL,
  grado TEXT NOT NULL,
  duracion_semanas INT NOT NULL DEFAULT 4,
  fases JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Horarios escolares
CREATE TABLE IF NOT EXISTS public.horarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ano_lectivo TEXT NOT NULL DEFAULT '2024-2025',
  tanda TEXT NOT NULL DEFAULT 'matutina',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Clases del horario
CREATE TABLE IF NOT EXISTS public.clases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  horario_id UUID NOT NULL REFERENCES public.horarios(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dia TEXT NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fin TIME NOT NULL,
  grado TEXT NOT NULL,
  seccion TEXT NOT NULL DEFAULT 'A',
  asignatura TEXT NOT NULL,
  aula TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Eventos del calendario docente
CREATE TABLE IF NOT EXISTS public.eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  fecha DATE NOT NULL,
  hora TIME,
  tipo TEXT NOT NULL DEFAULT 'pedagogico',
  descripcion TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Recordatorios pedagógicos
CREATE TABLE IF NOT EXISTS public.recordatorios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mensaje TEXT NOT NULL,
  fecha_limite TIMESTAMPTZ NOT NULL,
  prioridad TEXT NOT NULL DEFAULT 'normal',
  completado BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Conversaciones del chat
CREATE TABLE IF NOT EXISTS public.conversaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL DEFAULT 'Nueva conversación',
  mensajes JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Preferencias del docente
CREATE TABLE IF NOT EXISTS public.preferencias_docente (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  nivel_preferido TEXT DEFAULT 'primario',
  periodo_preferido TEXT DEFAULT 'diaria',
  voz_activa BOOLEAN DEFAULT true,
  estilo_pedagogico TEXT DEFAULT 'participativo',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cola de revisión del propietario (Hallazgos de investigación web)
CREATE TABLE IF NOT EXISTS public.cola_revision (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consulta TEXT NOT NULL,
  dato_extraido TEXT NOT NULL,
  cita_textual TEXT NOT NULL,
  url_fuente TEXT NOT NULL,
  institucion TEXT NOT NULL,
  anio INTEGER,
  nivel TEXT,
  grado TEXT,
  area TEXT,
  nivel_confianza TEXT NOT NULL,
  estado_revision TEXT NOT NULL DEFAULT 'pendiente',
  revisado_por UUID REFERENCES auth.users(id),
  revisado_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Caché corta de investigaciones (Sanitizada de datos personales, TTL 7 días)
CREATE TABLE IF NOT EXISTS public.cache_investigacion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hash_consulta TEXT NOT NULL UNIQUE,
  consulta_sanitizada TEXT NOT NULL,
  resultado JSONB NOT NULL,
  fuentes JSONB NOT NULL,
  nivel_confianza TEXT NOT NULL,
  expira_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tareas asíncronas del asistente
CREATE TABLE IF NOT EXISTS public.tareas_asistente (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL DEFAULT 'investigacion_web',
  estado TEXT NOT NULL DEFAULT 'en_progreso',
  progreso INT NOT NULL DEFAULT 0,
  mensaje_estado TEXT,
  resultado JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Políticas de Seguridad RLS Estrictas (Aislamiento Garantizado)

ALTER TABLE public.curriculo_documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curriculo_fragmentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proyectos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.horarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recordatorios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preferencias_docente ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cola_revision ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cache_investigacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tareas_asistente ENABLE ROW LEVEL SECURITY;

-- Curriculo: documentos oficiales públicos para autenticados; universitarios solo su autor
CREATE POLICY "Lectura curricular para autenticados"
  ON public.curriculo_documentos FOR SELECT TO authenticated
  USING (es_oficial = true OR auth.uid() = docente_id);

CREATE POLICY "Lectura fragmentos para autenticados"
  ON public.curriculo_fragmentos FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.curriculo_documentos d 
      WHERE d.id = curriculo_fragmentos.documento_id 
      AND (d.es_oficial = true OR auth.uid() = d.docente_id)
    )
  );

-- Programas universitarios propios
CREATE POLICY "Escritura programas universitarios"
  ON public.curriculo_documentos FOR ALL TO authenticated
  USING (auth.uid() = docente_id)
  WITH CHECK (auth.uid() = docente_id AND es_oficial = false);

-- Aislamiento de datos del docente: cada usuario SOLO ve y modifica sus propios datos
CREATE POLICY "Aislamiento planes" ON public.planes FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Aislamiento proyectos" ON public.proyectos FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Aislamiento horarios" ON public.horarios FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Aislamiento clases" ON public.clases FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Aislamiento eventos" ON public.eventos FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Aislamiento recordatorios" ON public.recordatorios FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Aislamiento conversaciones" ON public.conversaciones FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Aislamiento preferencias" ON public.preferencias_docente FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Aislamiento tareas_asistente" ON public.tareas_asistente FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Cola de revisión: solo propietarios autenticados con is_owner en app_metadata
CREATE POLICY "Acceso cola revision propietarios" ON public.cola_revision FOR ALL TO authenticated
  USING (coalesce((auth.jwt() -> 'app_metadata' ->> 'is_owner')::boolean, false) = true);

-- Cache de investigación: lectura si no ha expirado
CREATE POLICY "Lectura cache investigaciones" ON public.cache_investigacion FOR SELECT TO authenticated
  USING (expira_at > NOW());
