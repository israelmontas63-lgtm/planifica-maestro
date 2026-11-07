-- Búsqueda híbrida (texto completo + vectores) para el currículo. Embeddings: @cf/baai/bge-m3 = 1024 dimensiones.
create extension if not exists vector with schema extensions;

create table if not exists public.curriculo_embeddings (
  secuencia_id text primary key,
  contenido text not null,
  embedding vector(1024) not null,
  actualizado_en timestamptz not null default now()
);

create index if not exists curriculo_embeddings_hnsw on public.curriculo_embeddings using hnsw (embedding vector_cosine_ops);
create index if not exists curriculo_embeddings_fts on public.curriculo_embeddings using gin (to_tsvector('spanish', contenido));

-- Solo el service role (el worker) accede: sin políticas para anon ni authenticated.
alter table public.curriculo_embeddings enable row level security;

create or replace function public.buscar_curriculo_hibrido(
  query_text text,
  query_embedding vector(1024),
  match_count int default 8,
  filtro_grado int default null,
  filtro_area text default null
)
returns table (secuencia_id text, contenido text, score double precision)
language sql
stable
set search_path = public, extensions
as $$
  with base as (
    select e.secuencia_id, e.contenido, e.embedding
    from public.curriculo_embeddings e
    join public.curriculo_secuencias s on s.id::text = e.secuencia_id
    where (filtro_grado is null or s.grado_num = filtro_grado)
      and (filtro_area is null or s.area = filtro_area)
  ),
  texto as (
    select b.secuencia_id,
           row_number() over (order by ts_rank_cd(to_tsvector('spanish', b.contenido), websearch_to_tsquery('spanish', query_text)) desc) as r
    from base b
    where to_tsvector('spanish', b.contenido) @@ websearch_to_tsquery('spanish', query_text)
    order by r
    limit 50
  ),
  vec as (
    select b.secuencia_id,
           row_number() over (order by b.embedding <=> query_embedding) as r
    from base b
    order by b.embedding <=> query_embedding
    limit 50
  )
  select b.secuencia_id,
         b.contenido,
         (coalesce(1.0 / (60 + t.r), 0) + coalesce(1.0 / (60 + v.r), 0))::double precision as score
  from base b
  left join texto t on t.secuencia_id = b.secuencia_id
  left join vec v on v.secuencia_id = b.secuencia_id
  where t.r is not null or v.r is not null
  order by score desc
  limit match_count;
$$;

revoke all on function public.buscar_curriculo_hibrido(text, vector, int, int, text) from public, anon, authenticated;
grant execute on function public.buscar_curriculo_hibrido(text, vector, int, int, text) to service_role;
