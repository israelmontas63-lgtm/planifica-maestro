CREATE TABLE IF NOT EXISTS public.chat_mensajes (
    id BIGSERIAL PRIMARY KEY,
    sesion_id UUID NOT NULL,
    rol TEXT NOT NULL CHECK (rol IN ('user', 'model')),
    contenido TEXT NOT NULL,
    creado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_mensajes_sesion_tiempo 
ON public.chat_mensajes (sesion_id, creado_en ASC);

CREATE OR REPLACE FUNCTION public.obtener_historial_sesion(p_sesion_id UUID, p_limite INT DEFAULT 8)
RETURNS TABLE (rol TEXT, contenido TEXT) AS $$ 
BEGIN 
    RETURN QUERY 
    SELECT m.rol, m.contenido 
    FROM ( 
        SELECT rol, contenido, creado_en 
        FROM public.chat_mensajes 
        WHERE sesion_id = p_sesion_id 
        ORDER BY creado_en DESC 
        LIMIT p_limite 
    ) m 
    ORDER BY m.creado_en ASC; 
END; 
$$ LANGUAGE plpgsql SECURITY DEFINER;
