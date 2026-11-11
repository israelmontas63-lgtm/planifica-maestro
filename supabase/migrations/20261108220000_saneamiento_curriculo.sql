-- Poblar grado_num en curriculo_paginas desde el texto
UPDATE public.curriculo_paginas
SET grado_num = CASE
  WHEN texto ~* '(1er|primer|1.°|1ro)\s+grado' THEN 1
  WHEN texto ~* '(2do|segundo|2.°)\s+grado' THEN 2
  WHEN texto ~* '(3er|tercer|3.°|3ro)\s+grado' THEN 3
  WHEN texto ~* '(4to|cuarto|4.°)\s+grado' THEN 4
  WHEN texto ~* '(5to|quinto|5.°)\s+grado' THEN 5
  WHEN texto ~* '(6to|sexto|6.°)\s+grado' THEN 6
  ELSE grado_num
END
WHERE grado_num IS NULL;

-- Corregir cruce temático en SEC-PRI-4-ESP-004
UPDATE public.curriculo_secuencias
SET tema = 'Textos funcionales: La biografía'
WHERE source_id = 'SEC-PRI-4-ESP-004' 
  AND contenidos_texto_original ILIKE '%La biografía: función%';
