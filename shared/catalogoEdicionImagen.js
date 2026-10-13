/**
 * shared/catalogoEdicionImagen.js
 * 
 * CATÁLOGO OFICIAL DE 480 OPERACIONES DE EDICIÓN DE IMÁGENES
 * 12 Categorías x 40 Operaciones = 480 Operaciones únicas y contextualizadas
 * para las aulas y centros educativos de la República Dominicana.
 */

export const CATEGORIAS_EDICION = [
  { id: "luz_color", nombre: "Luz y Color", icono: "☀️" },
  { id: "nitidez_limpieza", nombre: "Nitidez y Limpieza", icono: "🔍" },
  { id: "fondos", nombre: "Fondos y Entornos", icono: "🌄" },
  { id: "adornos_stickers", nombre: "Adornos y Stickers Escolares", icono: "⭐" },
  { id: "emojis_mascaras", nombre: "Emojis y Máscaras Amables", icono: "🎭" },
  { id: "ropa_prendas", nombre: "Ropa y Color de Prendas", icono: "👕" },
  { id: "texto_rotulos", nombre: "Texto y Rótulos Pedagógicos", icono: "🏷️" },
  { id: "collage_composicion", nombre: "Collage y Composición", icono: "🖼️" },
  { id: "estilos_artisticos", nombre: "Estilos Artísticos Amables", icono: "🎨" },
  { id: "material_didactico", nombre: "Material Didáctico y Fichas", icono: "📐" },
  { id: "eventos_fechas", nombre: "Eventos y Fechas Patrias RD", icono: "🇩🇴" },
  { id: "salida_formato", nombre: "Salida y Formato", icono: "💾" }
];

// ─────────────────────────────────────────────────────────────
// DEFINICIÓN DE LAS 480 OPERACIONES
// ─────────────────────────────────────────────────────────────

export const CATALOGO_OPERACIONES = [
  // ── CATEGORÍA 1: LUZ Y COLOR (40) ──
  {
    id: "luz_brillo_mas",
    nombre: "Aumentar Brillo",
    descripcion: "Aclara fotos oscuras tomadas en aulas con poca iluminación natural.",
    categoria: "luz_color",
    parametros: { factor: 1.25 },
    motor: "local",
    politica: "permitido",
    pesoCuota: 1
  },
  {
    id: "luz_brillo_menos",
    nombre: "Atenuar Brillo",
    descripcion: "Reduce el exceso de luz en fotos tomadas en el patio escolar soleado.",
    categoria: "luz_color",
    parametros: { factor: 0.8 },
    motor: "local",
    politica: "permitido",
    pesoCuota: 1
  },
  {
    id: "luz_contraste_alto",
    nombre: "Contraste Alto para Pizarra",
    descripcion: "Realza el texto de tiza blanca o marcador negro sobre pizarra.",
    categoria: "luz_color",
    parametros: { contraste: 1.4 },
    motor: "local",
    politica: "permitido",
    pesoCuota: 1
  },
  {
    id: "luz_contraste_suave",
    nombre: "Contraste Suave",
    descripcion: "Equilibra luces y sombras en fotos grupales del salón.",
    categoria: "luz_color",
    parametros: { contraste: 1.1 },
    motor: "local",
    politica: "permitido",
    pesoCuota: 1
  },
  {
    id: "luz_exposicion_auto",
    nombre: "Exposición Automática de Aula",
    descripcion: "Nivelación balanceada de histograma para espacios interiores escolares.",
    categoria: "luz_color",
    parametros: {},
    motor: "local",
    politica: "permitido",
    pesoCuota: 1
  },
  {
    id: "luz_saturacion_viva",
    nombre: "Colores Vivos de Cartulinas",
    descripcion: "Intensifica colores primarios en exposiciones y murales escolares.",
    categoria: "luz_color",
    parametros: { saturacion: 1.35 },
    motor: "local",
    politica: "permitido",
    pesoCuota: 1
  },
  {
    id: "luz_desaturar_suave",
    nombre: "Colores Neutros",
    descripcion: "Suaviza tonos chillones para documentos formales de dirección.",
    categoria: "luz_color",
    parametros: { saturacion: 0.75 },
    motor: "local",
    politica: "permitido",
    pesoCuota: 1
  },
  {
    id: "luz_temperatura_calida",
    nombre: "Calidez Escolar",
    descripcion: "Compensa la luz fría de tubos fluorescentes con un tono ámbar amable.",
    categoria: "luz_color",
    parametros: { kelvin: 5200 },
    motor: "local",
    politica: "permitido",
    pesoCuota: 1
  },
  {
    id: "luz_temperatura_fria",
    nombre: "Claridad Fresca",
    descripcion: "Corrige tintes amarillentos en capturas de cuadernos y libros.",
    categoria: "luz_color",
    parametros: { kelvin: 6800 },
    motor: "local",
    politica: "permitido",
    pesoCuota: 1
  },
  {
    id: "luz_sombras_levantar",
    nombre: "Iluminar Sombras",
    descripcion: "Recupera detalle de estudiantes sentados lejos de la ventana.",
    categoria: "luz_color",
    parametros: { recuperacion: 0.4 },
    motor: "local",
    politica: "permitido",
    pesoCuota: 1
  },
  {
    id: "luz_altas_luces_frenar",
    nombre: "Recuperar Blancos Quemados",
    descripcion: "Atenúa reflejos sobre hojas bond o pizarras acrílicas.",
    categoria: "luz_color",
    parametros: { atenuacion: 0.35 },
    motor: "local",
    politica: "permitido",
    pesoCuota: 1
  },
  {
    id: "luz_blanco_y_negro_puro",
    nombre: "Blanco y Negro para Fotocopiadora",
    descripcion: "Optimiza para fotocopiado económico sin tonos grises manchados.",
    categoria: "luz_color",
    parametros: { umbral: 128 },
    motor: "local",
    politica: "permitido",
    pesoCuota: 1
  },
  {
    id: "luz_escala_grises_tonal",
    nombre: "Escala de Grises Pedagógica",
    descripcion: "Conversión a escala tonal precisa para impresiones de exámenes.",
    categoria: "luz_color",
    parametros: {},
    motor: "local",
    politica: "permitido",
    pesoCuota: 1
  },
  {
    id: "luz_sepia_historico",
    nombre: "Tono Sepia Documental",
    descripcion: "Ambienta fotos de proyectos de Ciencias Sociales e Historia patria.",
    categoria: "luz_color",
    parametros: { intensidad: 0.6 },
    motor: "local",
    politica: "permitido",
    pesoCuota: 1
  },
  {
    id: "luz_cianotipia_ciencias",
    nombre: "Efecto Cianotipia de Laboratorio",
    descripcion: "Monocromía azul botánica para cuadernos de experimentos.",
    categoria: "luz_color",
    parametros: { tinte: "#0f4c81" },
    motor: "local",
    politica: "permitido",
    pesoCuota: 1
  },
  {
    id: "luz_invertir_colores",
    nombre: "Inversión de Alto Contraste (DUA)",
    descripcion: "Invierte colores para alumnos con baja visión o fotofobia.",
    categoria: "luz_color",
    parametros: {},
    motor: "local",
    politica: "permitido",
    pesoCuota: 1
  },
  {
    id: "luz_gamma_medio",
    nombre: "Corrección Gamma",
    descripcion: "Ajuste suave de tonos medios para hojas de trabajo escaneadas.",
    categoria: "luz_color",
    parametros: { gamma: 1.15 },
    motor: "local",
    politica: "permitido",
    pesoCuota: 1
  },
  {
    id: "luz_resaltar_rojo_correccion",
    nombre: "Resaltar Tinta de Corrección",
    descripcion: "Enfatiza notas al margen escritas en lapicero rojo docente.",
    categoria: "luz_color",
    parametros: { canal: "red" },
    motor: "local",
    politica: "permitido",
    pesoCuota: 1
  },
  {
    id: "luz_neutralizar_reflejo",
    nombre: "Neutralizar Reflejo de Flash",
    descripcion: "Disminuye el destello blanco sobre papel satinado o plastificado.",
    categoria: "luz_color",
    parametros: {},
    motor: "local",
    politica: "permitido",
    pesoCuota: 1
  },
  {
    id: "luz_balance_blancos_hoja",
    nombre: "Balance de Blancos de Hoja",
    descripcion: "Usa el fondo del papel para equilibrar el color general de la foto.",
    categoria: "luz_color",
    parametros: {},
    motor: "local",
    politica: "permitido",
    pesoCuota: 1
  },
  {
    id: "luz_tono_verano_patio",
    nombre: "Luz de Patio Matutino",
    descripcion: "Tono dorado suave típico de la izada de bandera de 8:00 AM.",
    categoria: "luz_color",
    parametros: { tono: "dorado" },
    motor: "local",
    politica: "permitido",
    pesoCuota: 1
  },
  {
    id: "luz_ecualizar_histograma",
    nombre: "Ecualización Adaptativa",
    descripcion: "Maximiza el rango dinámico en capturas con iluminación dispareja.",
    categoria: "luz_color",
    parametros: {},
    motor: "local",
    politica: "permitido",
    pesoCuota: 1
  },
  {
    id: "luz_filtro_lectura_nocturna",
    nombre: "Filtro Lectura sin Cansancio",
    descripcion: "Reduce luz azul para revisión de evidencias en la noche.",
    categoria: "luz_color",
    parametros: { calidez: 0.8 },
    motor: "local",
    politica: "permitido",
    pesoCuota: 1
  },
  {
    id: "luz_vibranza_natural",
    nombre: "Vibranza Foliar de Ciencias",
    descripcion: "Intensifica verdes en hojas y tallos sin sobrecargar rostros.",
    categoria: "luz_color",
    parametros: { factor: 1.25 },
    motor: "local",
    politica: "permitido",
    pesoCuota: 1
  },
  {
    id: "luz_matiz_uniforme",
    nombre: "Matiz Homogéneo",
    descripcion: "Uniforma la tonalidad en series de fotos del mismo día escolar.",
    categoria: "luz_color",
    parametros: {},
    motor: "local",
    politica: "permitido",
    pesoCuota: 1
  },
  {
    id: "luz_atenuar_sombras_fuertes",
    nombre: "Suavizar Sombras Duras",
    descripcion: "Mitiga sombras marcadas bajo la barbilla por el sol del mediodía.",
    categoria: "luz_color",
    parametros: {},
    motor: "local",
    politica: "permitido",
    pesoCuota: 1
  },
  {
    id: "luz_filtro_mate_pastel",
    nombre: "Acabado Mate Pastel",
    descripcion: "Estilo suave para portafolios pedagógicos de Nivel Inicial.",
    categoria: "luz_color",
    parametros: {},
    motor: "local",
    politica: "permitido",
    pesoCuota: 1
  },
  {
    id: "luz_tinte_institucional_minerd",
    nombre: "Armonía Azul Institucional",
    descripcion: "Tinte sutil acorde a la identidad gráfica educativa dominicana.",
    categoria: "luz_color",
    parametros: { azul: "#002F6C" },
    motor: "local",
    politica: "permitido",
    pesoCuota: 1
  },
  {
    id: "luz_solarizacion_artistica",
    nombre: "Solarización de Arte",
    descripcion: "Efecto plástico para clases de Educación Artística.",
    categoria: "luz_color",
    parametros: {},
    motor: "local",
    politica: "permitido",
    pesoCuota: 1
  },
  {
    id: "luz_umbral_binario_texto",
    nombre: "Binarización de Texto Puro",
    descripcion: "Separa tajantemente tinta y papel para OCR limpio.",
    categoria: "luz_color",
    parametros: { threshold: 140 },
    motor: "local",
    politica: "permitido",
    pesoCuota: 1
  },
  {
    id: "luz_degradado_suave_superior",
    nombre: "Degradado para Títulos",
    descripcion: "Atenúa la parte superior para escribir encima el nombre del centro.",
    categoria: "luz_color",
    parametros: { opacidad: 0.3 },
    motor: "local",
    politica: "permitido",
    pesoCuota: 1
  },
  {
    id: "luz_degradado_inferior_pie",
    nombre: "Degradado para Pie de Foto",
    descripcion: "Sombra inferior suave para colocar fecha y grado escolar.",
    categoria: "luz_color",
    parametros: { opacidad: 0.35 },
    motor: "local",
    politica: "permitido",
    pesoCuota: 1
  },
  {
    id: "luz_correccion_iluminacion_ia",
    nombre: "Reluz Inteligente de Aula (IA)",
    descripcion: "Reconstruye la iluminación natural de aula cerrada mediante IA generativa.",
    categoria: "luz_color",
    parametros: { prompt: "iluminación suave y clara de salón de clases" },
    motor: "ia",
    politica: "permitido",
    pesoCuota: 3
  },
  {
    id: "luz_correccion_contraluz_ia",
    nombre: "Corrección de Contraluz (IA)",
    descripcion: "Rescata rostros oscurecidos por ventanas traseras.",
    categoria: "luz_color",
    parametros: {},
    motor: "ia",
    politica: "permitido",
    pesoCuota: 3
  },
  {
    id: "luz_armonizacion_colores_ia",
    nombre: "Armonización Cromática (IA)",
    descripcion: "Alinea la paleta de colores del mural escolar con IA.",
    categoria: "luz_color",
    parametros: {},
    motor: "ia",
    politica: "permitido",
    pesoCuota: 3
  },
  {
    id: "luz_reconstruccion_tonal_ia",
    nombre: "Reconstrucción Tonal de Cuaderno (IA)",
    descripcion: "Aclara sombras de manos y teléfonos al fotografiar cuadernos.",
    categoria: "luz_color",
    parametros: {},
    motor: "ia",
    politica: "permitido",
    pesoCuota: 3
  },
  {
    id: "luz_estilo_dia_nublado",
    nombre: "Luz Difusa de Día Nublado",
    descripcion: "Luz suave sin sombras para tomas de dibujos infantiles.",
    categoria: "luz_color",
    parametros: {},
    motor: "local",
    politica: "permitido",
    pesoCuota: 1
  },
  {
    id: "luz_enfoque_tonal_centro",
    nombre: "Realce Central de Atención",
    descripcion: "Aclara el centro de la foto donde está el estudiante exponiendo.",
    categoria: "luz_color",
    parametros: { radio: 0.6 },
    motor: "local",
    politica: "permitido",
    pesoCuota: 1
  },
  {
    id: "luz_estilo_impresion_serigrafica",
    nombre: "Tono Serigráfico de Taller",
    descripcion: "Colores sólidos para proyectos de Artes y Manualidades.",
    categoria: "luz_color",
    parametros: {},
    motor: "local",
    politica: "permitido",
    pesoCuota: 1
  },
  {
    id: "luz_optimizacion_proyector",
    nombre: "Optimizar para Proyector Escolar",
    descripcion: "Aumenta la saturación y brillo para proyectores de baja potencia en el aula.",
    categoria: "luz_color",
    parametros: { gamma: 1.3, contraste: 1.25 },
    motor: "local",
    politica: "permitido",
    pesoCuota: 1
  }
];

// Helper para completar las 40 operaciones por categoría de forma estructurada y determinista
function registrarLote(catId, items) {
  for (const it of items) {
    CATALOGO_OPERACIONES.push({
      categoria: catId,
      pesoCuota: it.motor === "ia" ? 3 : it.motor === "futuro" ? 5 : 1,
      politica: it.politica || "permitido",
      parametros: it.parametros || {},
      ...it
    });
  }
}

// ── CATEGORÍA 2: NITIDEZ Y LIMPIEZA (40) ──
registrarLote("nitidez_limpieza", [
  { id: "nitidez_enfoque_suave", nombre: "Enfoque Ligero", descripcion: "Ajuste suave de nitidez para fotos ligeramente movidas.", motor: "local" },
  { id: "nitidez_enfoque_medio", nombre: "Enfoque Estándar", descripcion: "Resalta bordes de letras y figuras geométricas.", motor: "local" },
  { id: "nitidez_enfoque_fuerte", nombre: "Enfoque Intenso para Letra Cursiva", descripcion: "Define trazos de caligrafía en cuadernos de primer ciclo.", motor: "local" },
  { id: "nitidez_mascara_desenfoque", nombre: "Máscara de Enfoque Avanzada", descripcion: "Acentúa microcontrastes en esquemas y mapas conceptuales.", motor: "local" },
  { id: "nitidez_reduccion_ruido_sal", nombre: "Reducción de Grano Digital", descripcion: "Suaviza granulado en fotos nocturnas de actos escolares.", motor: "local" },
  { id: "nitidez_limpieza_manchas_fondo", nombre: "Limpiar Manchas de Mesa", descripcion: "Atenúa marcas de lápiz y manchas alrededor del cuaderno.", motor: "local" },
  { id: "nitidez_alisado_hoja_arrugada", nombre: "Aplanar Fondo de Hoja", descripcion: "Reduce sombras de dobleces en páginas de cuaderno.", motor: "local" },
  { id: "nitidez_quitar_sombra_celular", nombre: "Eliminar Sombra de Celular", descripcion: "Compensa la sombra de la mano del maestro al tomar la foto desde arriba.", motor: "local" },
  { id: "nitidez_realce_trazos_grafito", nombre: "Realzar Lápiz de Carbón", descripcion: "Hace más legible la escritura suave de niños pequeños.", motor: "local" },
  { id: "nitidez_eliminar_moare", nombre: "Eliminar Patrón Moiré", descripcion: "Quita rayas molestas al fotografiar pantallas de computadoras o tablets.", motor: "local" },
  { id: "nitidez_filtro_mediana", nombre: "Filtro Mediana Antipolvo", descripcion: "Limpia motas y puntos sucios de lentes o cristales de escáner.", motor: "local" },
  { id: "nitidez_desenfocar_fondo_suave", nombre: "Desenfoque Suave de Fondo", descripcion: "Desenfoca el fondo del aula para centrar la atención en el material expuesto.", motor: "local" },
  { id: "nitidez_desenfocar_fondo_fuerte", nombre: "Efecto Retrato Docente", descripcion: "Desenfoque óptico emulado para fotos de perfil docente.", motor: "local" },
  { id: "nitidez_destacar_bordes_sobel", nombre: "Detección de Contornos para Dibujo", descripcion: "Convierte una foto en líneas de contorno para colorear.", motor: "local" },
  { id: "nitidez_limpiar_margen_superior", nombre: "Limpiar Margen Superior", descripcion: "Borra agujeros de grapas o espirales de cuaderno.", motor: "local" },
  { id: "nitidez_limpiar_margen_izquierdo", nombre: "Limpiar Margen de Espiral", descripcion: "Recorta y limpia rebordes de hojas arrancadas de libreta.", motor: "local" },
  { id: "nitidez_claridad_mapas", nombre: "Claridad para Mapas Físicos", descripcion: "Resalta nombres de ríos, provincias y cordilleras dominicanas.", motor: "local" },
  { id: "nitidez_antidifuminado_movimiento", nombre: "Mitigar Movimiento de Niños", descripcion: "Estabiliza fotos donde los estudiantes se movieron al posar.", motor: "local" },
  { id: "nitidez_estabilizar_perspectiva", nombre: "Enderezar Perspectiva de Cuaderno", descripcion: "Corrige tomas en ángulo para que la página quede perfectamente frontal.", motor: "local" },
  { id: "nitidez_filtro_gaussiano_fondo", nombre: "Filtro Gaussiano en Pared", descripcion: "Homogeniza paredes de aula con pintura desgastada.", motor: "local" },
  { id: "nitidez_realce_tabla_filas", nombre: "Realce de Cuadrícula de Cuaderno", descripcion: "Alinea y hace visibles las líneas y cuadrículas matemáticas.", motor: "local" },
  { id: "nitidez_borrado_sombra_dedos", nombre: "Quitar Sombra de Dedos Sujetando Hoja", descripcion: "Limpia la esquina donde el maestro sujeta el examen para fotografiarlo.", motor: "local" },
  { id: "nitidez_aislar_objeto_central", nombre: "Aislar Objeto de Estudio", descripcion: "Centra nitidez en hojas, flores o insectos de la clase de Ciencias de la Naturaleza.", motor: "local" },
  { id: "nitidez_homogeneizar_papel", nombre: "Blanqueo de Fondo de Papel", descripcion: "Convierte papel amarillento en blanco limpio uniforme.", motor: "local" },
  { id: "nitidez_filtro_lineas_guia", nombre: "Resaltar Líneas de Caligrafía", descripcion: "Enfatiza el renglón para evaluar la motricidad fina y direccionalidad.", motor: "local" },
  { id: "nitidez_reduccion_brillo_vidrio", nombre: "Atenuar Reflejo de Vidrio en Cuadro", descripcion: "Reduce el reflejo sobre láminas enmarcadas o diplomas.", motor: "local" },
  { id: "nitidez_super_resolucion_ia", nombre: "Súper Resolución de Evidencia (IA)", descripcion: "Reconstruye texto borroso de fotos lejanas con IA.", motor: "ia" },
  { id: "nitidez_restaurar_foto_historica_ia", nombre: "Restaurar Foto Histórica Escolar (IA)", descripcion: "Elimina rasguños y manchas de fotos antiguas del centro educativo.", motor: "ia" },
  { id: "nitidez_desenfoque_selectivo_ia", nombre: "Desenfoque Focal Inteligente (IA)", descripcion: "Identifica el objeto pedagógico y desenfoca el aula detrás.", motor: "ia" },
  { id: "nitidez_limpieza_inteligente_manchas_ia", nombre: "Borrador Mágico de Basuritas (IA)", descripcion: "Elimina cinta adhesiva vieja y chinches del mural escolar con IA.", motor: "ia" },
  { id: "nitidez_realce_letras_borrosas_ia", nombre: "Definición Inteligente de Textos (IA)", descripcion: "Reconstruye caligrafía infantil difícil de descifrar.", motor: "ia" },
  { id: "nitidez_enfoque_ojos_grupo", nombre: "Realce de Claridad en Miradas", descripcion: "Enfoca los ojos del grupo en fotos del acto cívico sin distorsión.", motor: "local" },
  { id: "nitidez_recorte_espacio_muerto", nombre: "Recortar Techos y Paredes Vacías", descripcion: "Ajusta la composición quitando techos altos innecesarios del salón.", motor: "local" },
  { id: "nitidez_limpiar_bordes_rotos", nombre: "Biselar Bordes Rasgados", descripcion: "Empareja bordes irregulares de cartulinas recortadas por alumnos.", motor: "local" },
  { id: "nitidez_suavizado_arte_plastico", nombre: "Suavizado para Masilla y Plastilina", descripcion: "Reduce ruido en fotos de maquetas y figuras moldeadas.", motor: "local" },
  { id: "nitidez_realce_graficos_barras", nombre: "Claridad para Gráficos Estadísticos", descripcion: "Pule barras y tortas en láminas de Matemática de Primaria.", motor: "local" },
  { id: "nitidez_eliminar_aberracion_cromatica", nombre: "Quitar Halo Púrpura en Lentes Baratos", descripcion: "Limpia bordes con tinte violáceo comunes en celulares de gama baja.", motor: "local" },
  { id: "nitidez_unificar_iluminacion_cuadricula", nombre: "Luz Plana para Hojas de Cálculo", descripcion: "Equilibra la exposición a lo largo de toda la página para lectura fácil.", motor: "local" },
  { id: "nitidez_filtro_limpieza_pizarra_verde", nombre: "Restaurar Verde de Pizarra Clásica", descripcion: "Devuelve el verde uniforme a pizarras con tiza corrida.", motor: "local" },
  { id: "nitidez_filtro_limpieza_pizarra_blanca", nombre: "Eliminar Borrones de Marcador Seco", descripcion: "Quita manchas fantasmas grises en pizarras acrílicas.", motor: "local" }
]);

// ── CATEGORÍA 3: FONDOS Y ENTORNOS (40) ──
registrarLote("fondos", [
  { id: "fondos_quitar_fondo_blanco", nombre: "Fondo Blanco Puro", descripcion: "Recorta a la persona o material y coloca fondo blanco editorial.", motor: "local" },
  { id: "fondos_quitar_fondo_transparente", nombre: "Fondo Transparente PNG", descripcion: "Extrae figuras y dibujos para insertarlos sin fondo en fichas Word.", motor: "local" },
  { id: "fondos_color_azul_cielo", nombre: "Fondo Azul Cielo Educativo", descripcion: "Sustituye la pared por un color celeste suave.", motor: "local" },
  { id: "fondos_color_verde_pizarra", nombre: "Fondo Pizarra Escolar Verde", descripcion: "Pone fondo con textura pedagógica de pizarra tradicional.", motor: "local" },
  { id: "fondos_color_amarillo_calido", nombre: "Fondo Amarillo Sol", descripcion: "Fondo alegre para celebraciones y cuadros de honor de Inicial.", motor: "local" },
  { id: "fondos_difuminado_bokeh", nombre: "Fondo Difuminado Elegante", descripcion: "Desenfoca el fondo original manteniendo sus mismos tonos.", motor: "local" },
  { id: "fondos_biblioteca_escolar", nombre: "Fondo Estantes de Libros", descripcion: "Ubica la foto frente a una biblioteca escolar dominicana.", motor: "ia" },
  { id: "fondos_aula_dominicana_minerd", nombre: "Fondo Aula Escolar Moderna (IA)", descripcion: "Entorno de aula dominicana limpia con butacas y murales oficiales.", motor: "ia" },
  { id: "fondos_patio_escolar_palmeras", nombre: "Fondo Patio con Palma Real (IA)", descripcion: "Paisaje dominicano escolar con bandera y palmeras autóctonas.", motor: "ia" },
  { id: "fondos_laboratorio_ciencias", nombre: "Fondo Laboratorio de Ciencias (IA)", descripcion: "Entorno con microscopios y tubos de ensayo para proyectos científicos.", motor: "ia" },
  { id: "fondos_cancha_baloncesto_escolar", nombre: "Fondo Cancha Deportiva Escolar (IA)", descripcion: "Fondo de cancha de básquet y voleibol para Educación Física.", motor: "ia" },
  { id: "fondos_parque_nacional_rd", nombre: "Fondo Parque Nacional Los Haitises (IA)", descripcion: "Paisaje natural para actividades de Geografía Dominicana.", motor: "ia" },
  { id: "fondos_zona_colonial_rd", nombre: "Fondo Zona Colonial de Santo Domingo (IA)", descripcion: "Entorno histórico frente al Alcázar de Colón para Historia colonial.", motor: "ia" },
  { id: "fondos_valle_constanza", nombre: "Fondo Valle de Constanza (IA)", descripcion: "Paisaje agrícola de la cordillera central para proyectos de agricultura.", motor: "ia" },
  { id: "fondos_altar_de_la_patria", nombre: "Fondo Altar de la Patria (IA)", descripcion: "Mausoleo de los próceres para proyectos del mes de la Patria.", motor: "ia" },
  { id: "fondos_monumento_santiago", nombre: "Fondo Monumento de Santiago (IA)", descripcion: "Homenaje a los héroes de la Restauración.", motor: "ia" },
  { id: "fondos_playa_bahia_las_aguilas", nombre: "Fondo Bahía de las Águilas (IA)", descripcion: "Biodiversidad marina y conservación ambiental.", motor: "ia" },
  { id: "fondos_pico_duarte", nombre: "Fondo Pico Duarte (IA)", descripcion: "Cima más alta de las Antillas para clases de relieve insular.", motor: "ia" },
  { id: "fondos_jardin_botanico_sd", nombre: "Fondo Jardín Botánico Nacional (IA)", descripcion: "Flora dominicana y reloj de flores para botánica.", motor: "ia" },
  { id: "fondos_acuario_nacional_rd", nombre: "Fondo Acuario Nacional Dominicano (IA)", descripcion: "Fauna marina del mar Caribe.", motor: "ia" },
  { id: "fondos_reemplazo_pared_madera", nombre: "Fondo Pared de Madera Colonial", descripcion: "Textura rústica histórica de época.", motor: "local" },
  { id: "fondos_cuadricula_matematica", nombre: "Fondo Cuadrícula Milimetrada", descripcion: "Fondo técnico para esquemas de geometría y funciones.", motor: "local" },
  { id: "fondos_papel_antiguo_pergamino", nombre: "Fondo Pergamino Histórico", descripcion: "Simula documento antiguo para cartas de próceres.", motor: "local" },
  { id: "fondos_degradado_tricolor_suave", nombre: "Fondo Tricolor Dominicano Pastel", descripcion: "Degradado suave rojo, blanco y azul para actos institucionales.", motor: "local" },
  { id: "fondos_cielo_estrellado_ciencias", nombre: "Fondo Espacio y Estrellas", descripcion: "Para proyectos de Astronomía y Sistema Solar en Ciencias de la Naturaleza.", motor: "local" },
  { id: "fondos_globo_terraqueo_difuminado", nombre: "Fondo Mapa Mundi Esfumado", descripcion: "Ilustración cartográfica suave para Ciencias Sociales.", motor: "local" },
  { id: "fondos_notas_musicales", nombre: "Fondo Pentagrama Musical", descripcion: "Líneas musicales para la clase de Educación Artística.", motor: "local" },
  { id: "fondos_banderines_fiesta_escolar", nombre: "Fondo Banderines Festivos", descripcion: "Ambiente festivo para cumpleaños del salón y graduaciones.", motor: "local" },
  { id: "fondos_estampado_lapices", nombre: "Fondo Patrón de Útiles Escolares", descripcion: "Patrón sutil con reglas, tijeras y crayones.", motor: "local" },
  { id: "fondos_mural_arcoiris_inicial", nombre: "Fondo Arcoíris y Nubes de Inicial", descripcion: "Para carpetas de trabajo de preescolar y kínder.", motor: "local" },
  { id: "fondos_textura_corcho_mural", nombre: "Fondo Tablón de Corcho", descripcion: "Simula mural informativo del centro educativo.", motor: "local" },
  { id: "fondos_reemplazar_por_color_hex", nombre: "Fondo Color Sólido a Elección", descripcion: "Permite al docente ingresar cualquier código de color institucional.", motor: "local" },
  { id: "fondos_bosque_tropical_caribeno", nombre: "Fondo Bosque Húmedo Dominicano", descripcion: "Flora autóctona (cigua palmera, caoba, guayacán).", motor: "ia" },
  { id: "fondos_rio_yaque_del_norte", nombre: "Fondo Cuenca del Río Yaque (IA)", descripcion: "Estudio de las principales cuencas hidrográficas de RD.", motor: "ia" },
  { id: "fondos_salto_del_limon_samana", nombre: "Fondo Salto del Limón (IA)", descripcion: "Ecoturismo y recursos hídricos en Samaná.", motor: "ia" },
  { id: "fondos_cuevas_del_pomier", nombre: "Fondo Arte Rupestre Pomier (IA)", descripcion: "Patrimonio taíno y petroglifos precolombinos.", motor: "ia" },
  { id: "fondos_eliminar_personas_fondo_ia", nombre: "Limpiar Curiosos en el Fondo (IA)", descripcion: "Elimina personas que cruzaron caminando detrás del estudiante.", motor: "ia" },
  { id: "fondos_desenfocar_movimiento_fondo", nombre: "Desenfoque Radial Dinámico", descripcion: "Efecto de velocidad para fotos de carreras deportivas escolares.", motor: "local" },
  { id: "fondos_marco_circular_fondo_plano", nombre: "Viñeta Circular de Foto Escolar", descripcion: "Marco ovalado o redondo con fondo neutro tipo anuario.", motor: "local" },
  { id: "fondos_simulacion_teatro_escolar", nombre: "Fondo Telón Rojo de Teatro", descripcion: "Para dramatizaciones de literatura y oratoria.", motor: "local" }
]);

// ── CATEGORÍA 4: ADORNOS Y STICKERS ESCOLARES (40) ──
registrarLote("adornos_stickers", [
  { id: "stickers_estrella_dorada", nombre: "Sticker Estrella de Oro al Mérito", descripcion: "Reconocimiento a tareas sobresalientes.", motor: "local" },
  { id: "stickers_medalla_primer_lugar", nombre: "Sticker Medalla de 1.º Lugar", descripcion: "Para olimpíadas de lectura y matemáticas.", motor: "local" },
  { id: "stickers_trofeo_campeon", nombre: "Sticker Trofeo Deportivo", descripcion: "Para competencias intercolegiales.", motor: "local" },
  { id: "stickers_birrete_graduado", nombre: "Sticker Birrete de Graduación", descripcion: "Colocación sobre cabecera o esquina de diploma.", motor: "local" },
  { id: "stickers_diploma_enrollado", nombre: "Sticker Diploma con Cinta Roja", descripcion: "Símbolo de ciclo completado.", motor: "local" },
  { id: "stickers_bandera_dominicana_onda", nombre: "Sticker Bandera Nacional Ondulando", descripcion: "Emblema patrio para fechas cívicas.", motor: "local" },
  { id: "stickers_escudo_rd_oficial", nombre: "Sticker Escudo Nacional con Biblia", descripcion: "Escudo con lema Dios, Patria y Libertad.", motor: "local" },
  { id: "stickers_flor_rosa_de_bayahibe", nombre: "Sticker Rosa de Bayahíbe (Flor Nacional)", descripcion: "Símbolo botánico oficial dominicano.", motor: "local" },
  { id: "stickers_cigua_palmera_ave", nombre: "Sticker Cigua Palmera (Ave Nacional)", descripcion: "Símbolo ornitológico oficial para Ciencias de la Naturaleza.", motor: "local" },
  { id: "stickers_arbol_de_caoba", nombre: "Sticker Caoba (Árbol Nacional)", descripcion: "Educación ambiental y símbolos naturales de RD.", motor: "local" },
  { id: "stickers_libro_abierto_sabiduria", nombre: "Sticker Libro Abierto", descripcion: "Fomento de lectura e investigación.", motor: "local" },
  { id: "stickers_lapiz_gigante_sonriente", nombre: "Sticker Lápiz Animado", descripcion: "Motivación gráfica para escritura en Primer Ciclo.", motor: "local" },
  { id: "stickers_regla_y_escuadra", nombre: "Sticker Juego de Geometría", descripcion: "Icono de precisión matemática.", motor: "local" },
  { id: "stickers_manzana_del_maestro", nombre: "Sticker Manzana Agradecimiento Docente", descripcion: "Detalle de aprecio del Día del Maestro dominicano (30 de junio).", motor: "local" },
  { id: "stickers_reloj_despertador_puntual", nombre: "Sticker Reloj de la Puntualidad", descripcion: "Campañas de asistencia diaria escolar.", motor: "local" },
  { id: "stickers_globo_terraqueo_ciencias", nombre: "Sticker Planeta Tierra", descripcion: "Día de la Tierra y geografía mundial.", motor: "local" },
  { id: "stickers_microscopio_explorador", nombre: "Sticker Microscopio", descripcion: "Feria científica escolar.", motor: "local" },
  { id: "stickers_atomo_fisica", nombre: "Sticker Modelo Atómico", descripcion: "Física y Química para Nivel Secundario.", motor: "local" },
  { id: "stickers_tubo_ensayo_burbujeante", nombre: "Sticker Probeta de Química", descripcion: "Experimentos didácticos seguros.", motor: "local" },
  { id: "stickers_pincel_y_paleta_arte", nombre: "Sticker Paleta de Pintor", descripcion: "Educación Artística y manualidades.", motor: "local" },
  { id: "stickers_nota_musical_sol", nombre: "Sticker Clave de Sol", descripcion: "Coro escolar e himnos patrios.", motor: "local" },
  { id: "stickers_balon_baloncesto", nombre: "Sticker Balón de Básquetbol", descripcion: "Deporte escolar comunitario.", motor: "local" },
  { id: "stickers_pelota_beisbol_rd", nombre: "Sticker Pelota de Béisbol", descripcion: "Deporte rey de la República Dominicana.", motor: "local" },
  { id: "stickers_balon_voleibol", nombre: "Sticker Balón de Voleibol Femenino", descripcion: "Reinas del Caribe y deporte en las escuelas.", motor: "local" },
  { id: "stickers_ajedrez_caballo", nombre: "Sticker Caballo de Ajedrez Escolar", descripcion: "Pensamiento lógico y estratégico.", motor: "local" },
  { id: "stickers_computadora_tic", nombre: "Sticker Laptop Educativa (MINERD)", descripcion: "Integración tecnológica en el aula.", motor: "local" },
  { id: "stickers_bombillo_idea_genial", nombre: "Sticker Bombilla de Gran Idea", descripcion: "Proyectos de innovación y robótica educativa.", motor: "local" },
  { id: "stickers_corazon_buena_conducta", nombre: "Sticker Corazón de Valores Cívicos", descripcion: "Formación Integral Humana y Religiosa.", motor: "local" },
  { id: "stickers_pulgar_arriba_excelente", nombre: "Sticker Pulgar Arriba Excelente", descripcion: "Refuerzo positivo docente inmediato.", motor: "local" },
  { id: "stickers_cien_puntos", nombre: "Sticker Calificación 100%", descripcion: "Calificación perfecta en evaluación formativa.", motor: "local" },
  { id: "stickers_arcoiris_alegria", nombre: "Sticker Arcoíris Amable", descripcion: "Convivencia pacífica e inclusión escolar.", motor: "local" },
  { id: "stickers_sol_radiante_manana", nombre: "Sticker Sol Mañanero", descripcion: "Saludo del inicio de la jornada escolar.", motor: "local" },
  { id: "stickers_arbol_medio_ambiente", nombre: "Sticker Árbol Protector del Agua", descripcion: "Brigadas ecológicas del centro.", motor: "local" },
  { id: "stickers_gota_agua_cuidado", nombre: "Sticker Gota de Agua Cuídame", descripcion: "Ahorro del recurso hídrico en la escuela.", motor: "local" },
  { id: "stickers_simbolo_reciclaje_verde", nombre: "Sticker Las 3 R (Recicla)", descripcion: "Reducir, reutilizar y reciclar en el patio.", motor: "local" },
  { id: "stickers_tambora_merengue", nombre: "Sticker Tambora Folclórica", descripcion: "Instrumento autóctono del merengue tradicional.", motor: "local" },
  { id: "stickers_guira_autoctona", nombre: "Sticker Güira Dominicana", descripcion: "Ritmo y patrimonio cultural inmaterial.", motor: "local" },
  { id: "stickers_acordeon_tipico", nombre: "Sticker Acordeón Típico", descripcion: "Música folclórica de la región Cibao.", motor: "local" },
  { id: "stickers_maracas_tainas", nombre: "Sticker Maracas Taínas", descripcion: "Herencia aborigen en la cultura criolla.", motor: "local" },
  { id: "stickers_mascota_lectorcito", nombre: "Sticker Mascota Lector Feliz", descripcion: "Campañas del Plan Nacional de Fomento a la Lectura.", motor: "local" }
]);

// ── CATEGORÍA 5: EMOJIS Y MÁSCARAS AMABLES (40) ──
registrarLote("emojis_mascaras", [
  { id: "emojis_carita_feliz_privacidad", nombre: "Carita Feliz Protectora de Rostro", descripcion: "Protege la identidad del menor para publicar en redes del centro.", motor: "local" },
  { id: "emojis_guiño_amistoso", nombre: "Emoji Guiño Amable", descripcion: "Tapa cara de forma lúdica con guiño simpático.", motor: "local" },
  { id: "emojis_sonrisa_con_lentes", nombre: "Emoji Pequeño Sabio con Lentes", descripcion: "Representa dedicación y lectura.", motor: "local" },
  { id: "emojis_estrella_rostro", nombre: "Máscara de Estrella Brillante", descripcion: "Cubre rostro con estrella dorada en cuadros de honor.", motor: "local" },
  { id: "emojis_sol_sonriente_rostro", nombre: "Máscara de Sol Radiante", descripcion: "Protección de identidad para fotos grupales de Inicial.", motor: "local" },
  { id: "emojis_flor_sonriente", nombre: "Máscara de Flor Protectora", descripcion: "Ideal para eventos de primavera y día de las madres.", motor: "local" },
  { id: "emojis_corazon_amoroso", nombre: "Emoji Corazón Protector", descripcion: "Para imágenes de convivencia y afecto familiar escolar.", motor: "local" },
  { id: "emojis_angelito_inicial", nombre: "Emoji Angelito Amable", descripcion: "Tradición escolar dominicana del angelito de diciembre.", motor: "local" },
  { id: "emojis_antifaz_superheroe_lectura", nombre: "Antifaz de Superhéroe Lector", descripcion: "Cubre solo el área de ojos para juego de héroes del saber.", motor: "local" },
  { id: "emojis_antifaz_cientifico", nombre: "Gafas Protectoras de Laboratorio", descripcion: "Accesorio virtual de seguridad de ciencias.", motor: "local" },
  { id: "emojis_sombrero_cumpleanos_cono", nombre: "Gorrito Festivo de Cumpleaños", descripcion: "Coloca cono festivo sobre la cabeza para celebrar en el aula.", motor: "local" },
  { id: "emojis_corona_princesa_del_saber", nombre: "Corona de Princesa del Saber", descripcion: "Distintivo para reinados escolares de lectura.", motor: "local" },
  { id: "emojis_corona_rey_de_la_clase", nombre: "Corona de Rey de la Clase", descripcion: "Motivación al estudiante con mayor progreso.", motor: "local" },
  { id: "emojis_careta_carnaval_tautonoma", nombre: "Careta de Carnaval Vegano Amable", descripcion: "Tradición folclórica sin elementos que asusten.", motor: "local", politica: "confirmar" },
  { id: "emojis_careta_lechon_santiago", nombre: "Careta de Lechón Joyero", descripcion: "Cultura carnavalesca de Santiago de los Caballeros.", motor: "local", politica: "confirmar" },
  { id: "emojis_bigote_trinitario_teatro", nombre: "Bigote Histórico para Obra", descripcion: "Para caracterizaciones respetuosas de próceres en teatro.", motor: "local", politica: "confirmar" },
  { id: "emojis_lentes_graduado_sabio", nombre: "Gafas de Graduado", descripcion: "Accesorio festivo sobre los ojos en actos de fin de año.", motor: "local" },
  { id: "emojis_gorro_chef_nutricion", nombre: "Gorro de Chef Escolar", descripcion: "Clases de huertos escolares y alimentación saludable.", motor: "local" },
  { id: "emojis_casco_constructor_saberes", nombre: "Casco de Ingeniero Escolar", descripcion: "Proyectos STEM y construcción de maquetas.", motor: "local" },
  { id: "emojis_gorra_deportista_azul", nombre: "Gorra Deportiva Escolar", descripcion: "Protección virtual del sol para fotos en el play.", motor: "local" },
  { id: "emojis_mascara_gatito_amable", nombre: "Máscara de Gatito para Fábula", descripcion: "Dramatización de fábulas de Esopo y literatura infantil.", motor: "local" },
  { id: "emojis_mascara_leoncito_valiente", nombre: "Máscara de León de la Lectura", descripcion: "Símbolo de perseverancia y valentía escolar.", motor: "local" },
  { id: "emojis_mascara_osito_tierno", nombre: "Máscara de Osito Tierno", descripcion: "Día del abrazo y buen trato entre compañeros.", motor: "local" },
  { id: "emojis_mascara_ranita_ciencias", nombre: "Máscara de Ranita de la Biodiversidad", descripcion: "Reconocimiento de anfibios endémicos de la isla.", motor: "local" },
  { id: "emojis_mascara_pajarito_cigua", nombre: "Máscara Amable de Cigua Palmera", descripcion: "Disfraz virtual del ave nacional para actos de Inicial.", motor: "local" },
  { id: "emojis_mascara_mariposa_hermanas_mirabal", nombre: "Alas y Antifaz de Mariposa Heroica", descripcion: "Homenaje a Patria, Minerva y María Teresa Mirabal (25 de noviembre).", motor: "local" },
  { id: "emojis_sombrero_campesino_guajiro", nombre: "Sombrero de Paja Campesino", descripcion: "Homenaje al campesino dominicano y raíces rurales.", motor: "local" },
  { id: "emojis_panuelo_al_cuello_folclorico", nombre: "Pañuelo Rojo al Cuello", descripcion: "Indumentaria típica de bailes de mangulina y carabiné.", motor: "local" },
  { id: "emojis_cinta_cabeza_deportiva", nombre: "Banda Deportiva Frontal", descripcion: "Atletas del centro educativo en convivios escolares.", motor: "local" },
  { id: "emojis_diadema_flores_patria", nombre: "Diadema Trinitaria con Flores", descripcion: "Colores de la bandera nacional para actos de independencia.", motor: "local" },
  { id: "emojis_gorro_papanoel_amable", nombre: "Gorro Navideño Festivo", descripcion: "Celebración del aguinaldo escolar de diciembre.", motor: "local" },
  { id: "emojis_carita_guiño_con_estrella", nombre: "Emoji Estrella en Ojo", descripcion: "Para alumnos con talento artístico y oratoria.", motor: "local" },
  { id: "emojis_mascara_abuelo_sabio_teatro", nombre: "Caracterización de Anciano Sabio", descripcion: "Para obras sobre el valor del respeto a los adultos mayores.", motor: "local", politica: "confirmar" },
  { id: "emojis_mascara_marinero_colombino", nombre: "Gorro Marinero de Época", descripcion: "Dramatización del 12 de Octubre (Encuentro de Culturas).", motor: "local", politica: "confirmar" },
  { id: "emojis_corona_laurel_olimpico", nombre: "Corona de Laurel Olímpico", descripcion: "Ganadores de certámenes literarios y ortográficos.", motor: "local" },
  { id: "emojis_difuminador_facial_privacidad", nombre: "Difuminado Suave de Rostro Completo", descripcion: "Pixelado o desenfoque respetuoso de privacidad para publicación externa.", motor: "local" },
  { id: "emojis_mascara_astronauta_futuro", nombre: "Casco de Astronauta del Saber", descripcion: "Proyectos de exploración espacial y ciencias.", motor: "local" },
  { id: "emojis_carita_pensativa_filosofia", nombre: "Emoji Pensativo de Filosofía", descripcion: "Debates y pensamiento crítico en secundaria.", motor: "local" },
  { id: "emojis_mascara_doctorcito_salud", nombre: "Gorro Médico de la Salud Escolar", descripcion: "Campañas de vacunación e higiene bucal.", motor: "local" },
  { id: "emojis_antifaz_bandera_rd", nombre: "Antifaz Patriótico Dominicano", descripcion: "Doble función: cubre ojos para privacidad y luce colores patrios.", motor: "local" }
]);

// ── CATEGORÍA 6: ROPA Y COLOR DE PRENDAS (40) ──
registrarLote("ropa_prendas", [
  { id: "ropa_polo_azul_celeste", nombre: "Cambiar Polo a Azul Celeste MINERD", descripcion: "Color oficial del uniforme de Nivel Primario y Secundario.", motor: "local" },
  { id: "ropa_polo_azul_marino", nombre: "Cambiar Polo a Azul Marino", descripcion: "Uniforme institucional de centros técnicos y politécnicos.", motor: "local" },
  { id: "ropa_polo_amarillo_educativo", nombre: "Cambiar Polo a Amarillo Escolar", descripcion: "Color de camisa distintiva para Nivel Inicial o equipo deportivo.", motor: "local" },
  { id: "ropa_polo_verde_esperanza", nombre: "Cambiar Polo a Verde Esperanza", descripcion: "Color institucional de brigadas ambientales de la escuela.", motor: "local" },
  { id: "ropa_polo_blanco_formal", nombre: "Cambiar Camisa a Blanca de Gala", descripcion: "Uniforme de gala para actos solemnes del 27 de Febrero.", motor: "local" },
  { id: "ropa_polo_rojo_coral", nombre: "Cambiar Polo a Rojo Deportivo", descripcion: "Uniforme de la alianza roja en convivencias deportivas.", motor: "local" },
  { id: "ropa_polo_naranja_brigada", nombre: "Cambiar Polo a Naranja de Emergencias", descripcion: "Comité de Cruz Roja y Gestión de Riesgo del centro escolar.", motor: "local" },
  { id: "ropa_polo_morado_salome", nombre: "Cambiar Polo a Morado Cívico", descripcion: "Color alegórico a efemérides culturales.", motor: "local" },
  { id: "ropa_pantalon_caqui_clasico", nombre: "Ajustar Tono de Pantalón a Caqui Oficial", descripcion: "Color canónico del uniforme escolar del sistema dominicano.", motor: "local" },
  { id: "ropa_pantalon_azul_marino", nombre: "Ajustar Pantalón a Azul Oscuro", descripcion: "Variante oficial para politécnicos de artes y técnica.", motor: "local" },
  { id: "ropa_agregar_cuello_polo", nombre: "Realzar Cuello Camisero", descripcion: "Corrige dobleces en el cuello del polo para foto formal de carnet.", motor: "local" },
  { id: "ropa_eliminar_mancha_tinta_polo", nombre: "Limpiar Mancha de Lapicero en Ropa", descripcion: "Quita accidental mancha de tinta azul en la pechera del uniforme.", motor: "local" },
  { id: "ropa_eliminar_mancha_tiza_uniforme", nombre: "Limpiar Polvo de Tiza en Uniforme", descripcion: "Asea el frente de la camisa tras escribir en pizarra.", motor: "local" },
  { id: "ropa_planchado_virtual_arrugas", nombre: "Planchado Digital de Ropa", descripcion: "Suaviza arrugas pronunciadas en el uniforme escolar.", motor: "local" },
  { id: "ropa_agregar_insignia_minerd", nombre: "Insignia Escolar en el Pecho", descripcion: "Coloca escudo pequeño del centro en el bolsillo izquierdo.", motor: "local" },
  { id: "ropa_toga_graduacion_azul", nombre: "Toga de Graduando Azul Marino", descripcion: "Indumentaria solemne para graduaciones de 6.º de Secundaria.", motor: "ia" },
  { id: "ropa_toga_graduacion_blanca", nombre: "Toga de Graduando Blanca", descripcion: "Graduación formal de Nivel Primario e Inicial.", motor: "ia" },
  { id: "ropa_banda_patria_pecho", nombre: "Banda Tricolor Cruzada al Pecho", descripcion: "Distintivo para abanderados y escolta del pabellón nacional.", motor: "local" },
  { id: "ropa_chaleco_seguridad_vial", nombre: "Chaleco de Patrulla Escolar", descripcion: "Brigadas estudiantiles de tránsito frente a la escuela.", motor: "local" },
  { id: "ropa_bata_laboratorio_blanca", nombre: "Bata Blanca de Científico", descripcion: "Vestimenta reglamentaria para experimentos en laboratorio.", motor: "ia" },
  { id: "ropa_delantal_artes_plasticas", nombre: "Delantal de Pintor Escolar", descripcion: "Manualidades y témperas en talleres de arte.", motor: "local" },
  { id: "ropa_chaleco_monitores_lectura", nombre: "Chaleco de Monitor de Lectura", descripcion: "Estudiantes que apoyan las bibliotecas de aula.", motor: "local" },
  { id: "ropa_corbata_formal_negra", nombre: "Corbata Escolar Formal", descripcion: "Para concursos de oratoria y modelos de debate de Naciones Unidas.", motor: "local" },
  { id: "ropa_lazo_pelo_blanco_estudiante", nombre: "Lazo Blanco en el Cabello", descripcion: "Arreglo tradicional para las alumnas en actos patrios.", motor: "local" },
  { id: "ropa_lazo_pelo_azul", nombre: "Lazo Azul en el Cabello", descripcion: "Accesorio escolar a tono con el uniforme.", motor: "local" },
  { id: "ropa_lazo_pelo_rojo", nombre: "Lazo Rojo en el Cabello", descripcion: "Día de la Independencia y carnaval escolar.", motor: "local" },
  { id: "ropa_traje_folclorico_campesina", nombre: "Vestido Típico Folclórico Dominicano (IA)", descripcion: "Falda ancha tricolor y blusa con vuelos para bailes típicos.", motor: "ia" },
  { id: "ropa_traje_tipico_guajiro_masculino", nombre: "Traje Típico Blanco Masculino (IA)", descripcion: "Pantalón y camisa blanca con sombrero de paja para merengue.", motor: "ia" },
  { id: "ropa_chaqueta_director_formal", nombre: "Saco Formal para Directivos", descripcion: "Presentación protocolar de docentes en anuarios.", motor: "ia" },
  { id: "ropa_camiseta_deportiva_numero", nombre: "Número Dorsal en Camiseta Deportiva", descripcion: "Coloca número grande en la espalda para equipos de básquet.", motor: "local" },
  { id: "ropa_ajustar_brillo_telas", nombre: "Equilibrar Tono de Telas Dispares", descripcion: "Unifica fotos donde los niños tienen tonos de azul ligeramente distintos.", motor: "local" },
  { id: "ropa_eliminar_logos_marcas_comerciales", nombre: "Remover Marcas Comerciales de Abrigos", descripcion: "Oculta logos de ropa de calle para mantener neutralidad escolar.", motor: "local" },
  { id: "ropa_agregar_escarapela_patria", nombre: "Escarapela Tricolor en Solapa", descripcion: "Cucarda patriótica dominicana para el mes de febrero.", motor: "local" },
  { id: "ropa_cordon_escolta_mando", nombre: "Cordón Dorado de Escolta de Bandera", descripcion: "Distintivo militar-escolar para la guardia de honor.", motor: "local" },
  { id: "ropa_guantes_blancos_escolta", nombre: "Guantes Blancos de Abanderado", descripcion: "Porte protocolar para manipular el asta de la bandera.", motor: "local" },
  { id: "ropa_impermeable_amarillo_lluvia", nombre: "Capa Impermeable de Lluvia", descripcion: "Ilustración de seguridad y prevención ante tormentas tropicales.", motor: "local" },
  { id: "ropa_panuelo_explorador_scout", nombre: "Pañoleta de Grupo Guía / Scout Escolar", descripcion: "Campamentos escolares y valores de servicio comunitario.", motor: "local" },
  { id: "ropa_camisa_guayabera_dominicana", nombre: "Guayabera Blanca Dominicana (IA)", descripcion: "Prenda de gala formal caribeña para actos de graduación.", motor: "ia" },
  { id: "ropa_insignia_cuadro_honor_oro", nombre: "Pin Dorado de Excelencia Académica", descripcion: "Broche en solapa que certifica índice de 90 a 100 puntos.", motor: "local" },
  { id: "ropa_sueter_abrigo_colegio", nombre: "Suéter Institucional con Cremallera", descripcion: "Color uniforme para días de fresco en zonas montañosas.", motor: "local" }
]);

// ── CATEGORÍA 7: TEXTO Y RÓTULOS PEDAGÓGICOS (40) ──
registrarLote("texto_rotulos", [
  { id: "texto_titulo_bienvenidos_centro", nombre: "Rótulo Bienvenidos al Centro Educativo", descripcion: "Texto superior con tipografía limpia y amigable.", motor: "local" },
  { id: "texto_identificador_grado_seccion", nombre: "Rótulo Grado y Sección (ej. 3.º B)", descripcion: "Cartel en esquina con nombre del grupo.", motor: "local" },
  { id: "texto_nombre_estudiante_elegante", nombre: "Rótulo con Nombre del Estudiante", descripcion: "Cinta inferior para identificar al alumno en su portafolio.", motor: "local" },
  { id: "texto_lema_dios_patria_libertad", nombre: "Lema Nacional Dios, Patria y Libertad", descripcion: "Tipografía serif dorada tradicional.", motor: "local" },
  { id: "texto_fecha_acto_civico", nombre: "Estampa de Fecha Dominicana (DD/MM/AAAA)", descripcion: "Registra el día exacto de la evidencia de clase.", motor: "local" },
  { id: "texto_materia_ciencias_sociales", nombre: "Etiqueta Ciencias Sociales", descripcion: "Identificador temático para el registro docente.", motor: "local" },
  { id: "texto_materia_matematica", nombre: "Etiqueta Matemática", descripcion: "Con icono de signos más, menos y multiplicación.", motor: "local" },
  { id: "texto_materia_lengua_espanola", nombre: "Etiqueta Lengua Española", descripcion: "Con libro e icono de pluma estilográfica.", motor: "local" },
  { id: "texto_materia_ciencias_naturaleza", nombre: "Etiqueta Ciencias de la Naturaleza", descripcion: "Con hoja y probeta científica.", motor: "local" },
  { id: "texto_materia_educacion_artistica", nombre: "Etiqueta Educación Artística", descripcion: "Con pincel y notas musicales.", motor: "local" },
  { id: "texto_materia_educacion_fisica", nombre: "Etiqueta Educación Física", descripcion: "Con silueta deportiva.", motor: "local" },
  { id: "texto_materia_formacion_humana", nombre: "Etiqueta Formación Humana y Religiosa", descripcion: "Con paloma de la paz y manos unidas.", motor: "local" },
  { id: "texto_materia_ingles", nombre: "Etiqueta Lengua Extranjera (Inglés)", descripcion: "Con globo de diálogo bilingüe.", motor: "local" },
  { id: "texto_frase_motivadora_lectura", nombre: "Frase Quien Lee, Crece y Aprende", descripcion: "Cita motivacional de fomento a la lectura.", motor: "local" },
  { id: "texto_pensamiento_duarte_patria", nombre: "Pensamiento de Juan Pablo Duarte", descripcion: "Cita: Nunca me fue tan necesario como hoy el tener salud y corazón...", motor: "local" },
  { id: "texto_cuadro_de_honor_anual", nombre: "Encabezado Cuadro de Honor", descripcion: "Tipografía formal con laureles para calificaciones sobresalientes.", motor: "local" },
  { id: "texto_marca_de_agua_confidencial", nombre: "Marca de Agua Evaluación Confidencial", descripcion: "Texto diagonal tenue para pruebas aún no aplicadas.", motor: "local" },
  { id: "texto_marca_de_agua_borrador", nombre: "Marca de Agua Borrador Pedagógico", descripcion: "Identifica planificaciones en revisión sin alterar la lectura.", motor: "local" },
  { id: "texto_pie_de_foto_periodico_mural", nombre: "Pie de Foto Periodístico Escolar", descripcion: "Bloque estilo pie de imagen informativa del centro.", motor: "local" },
  { id: "texto_globo_dialogo_comic", nombre: "Globo de Diálogo de Historieta", descripcion: "Permite al estudiante insertar lo que dice el personaje de su cuento.", motor: "local" },
  { id: "texto_nube_de_pensamiento", nombre: "Nube de Pensamiento Creativo", descripcion: "Para expresar reflexiones personales en Ciencias Sociales.", motor: "local" },
  { id: "texto_cartel_expo_feria_ciencias", nombre: "Cartel Feria Científica y Tecnológica", descripcion: "Encabezado para paneles de proyectos de ciencias.", motor: "local" },
  { id: "texto_lema_mes_de_la_patria", nombre: "Cinta Mes de la Patria (Enero - Febrero)", descripcion: "Rótulo conmemorativo tricolor.", motor: "local" },
  { id: "texto_semana_aniversario_escuela", nombre: "Rótulo Aniversario de la Escuela", descripcion: "Celebración de años de fundación del centro educativo.", motor: "local" },
  { id: "texto_concurso_ortografia_letras", nombre: "Rótulo Olimpíadas de Ortografía", descripcion: "Distintivo para diplomas de deletreo y caligrafía.", motor: "local" },
  { id: "texto_proyecto_participativo_aula", nombre: "Rótulo Proyecto Participativo de Aula", descripcion: "Identifica la evidencia de PPA requerida por MINERD.", motor: "local" },
  { id: "texto_situacion_de_aprendizaje", nombre: "Cintillo Situación de Aprendizaje", descripcion: "Bloque textual con la pregunta problematizadora de la unidad.", motor: "local" },
  { id: "texto_indicador_de_logro", nombre: "Rótulo Indicador de Logro Evaluado", descripcion: "Asocia la foto con el código de competencia curricular.", motor: "local" },
  { id: "texto_normas_de_convivencia_aula", nombre: "Rótulo Normas del Salón de Clases", descripcion: "Respeto, escucha atenta y puntualidad.", motor: "local" },
  { id: "texto_cumpleanos_feliz_profe", nombre: "Cartel ¡Felicidades, Profe!", descripcion: "Para tarjetas colectivas de los estudiantes al maestro.", motor: "local" },
  { id: "texto_dedicatoria_dia_madres", nombre: "Dedicatoria Día de las Madres", descripcion: "Verso lírico para manualidades de mayo.", motor: "local" },
  { id: "texto_dedicatoria_dia_padres", nombre: "Dedicatoria Día de los Padres", descripcion: "Verso de reconocimiento en julio.", motor: "local" },
  { id: "texto_reglas_del_laboratorio", nombre: "Decálogo de Seguridad en Laboratorio", descripcion: "Normas de cuidado de ojos y materiales.", motor: "local" },
  { id: "texto_creditos_autoria_alumno", nombre: "Firma de Autor: Hecho por...", descripcion: "Bloque para que cada niño firme su dibujo o trabajo plástico.", motor: "local" },
  { id: "texto_numeracion_paso_a_paso", nombre: "Números Ordinales Grandes (1.º, 2.º, 3.º)", descripcion: "Secuencia visual de pasos en un experimento o receta.", motor: "local" },
  { id: "texto_marca_propiedad_biblioteca", nombre: "Sello Biblioteca Escolar (No Llevarse)", descripcion: "Identificador de patrimonio del centro.", motor: "local" },
  { id: "texto_alerta_precaucion_ciencias", nombre: "Rótulo de Precaución Científica", descripcion: "Para experimentos que requieren supervisión del maestro.", motor: "local" },
  { id: "texto_calificacion_logrado_conbase", nombre: "Sello Curricular: Logrado (L)", descripcion: "Escala valorativa oficial MINERD.", motor: "local" },
  { id: "texto_calificacion_en_proceso_conbase", nombre: "Sello Curricular: En Proceso (P)", descripcion: "Acompañamiento formativo continuo.", motor: "local" },
  { id: "texto_calificacion_iniciado_conbase", nombre: "Sello Curricular: Iniciado (I)", descripcion: "Etapa de exploración diagnóstica.", motor: "local" }
]);

// ── CATEGORÍA 8: COLLAGE Y COMPOSICIÓN (40) ──
registrarLote("collage_composicion", [
  { id: "collage_2_fotos_vertical", nombre: "Díptico Vertical (2 Fotos)", descripcion: "Antes y después de una actividad o dibujo.", motor: "local" },
  { id: "collage_2_fotos_horizontal", nombre: "Díptico Horizontal (2 Fotos)", descripcion: "Comparación lado a lado de dos experimentos.", motor: "local" },
  { id: "collage_3_fotos_triptico", nombre: "Tríptico: Inicio, Desarrollo y Cierre", descripcion: "Estructura canónica de los 3 momentos de clase MINERD.", motor: "local" },
  { id: "collage_4_fotos_cuadricula", nombre: "Cuadrícula 2x2 (4 Fotos)", descripcion: "Registro de 4 equipos de trabajo colaborativo.", motor: "local" },
  { id: "collage_6_fotos_mural", nombre: "Mural Fotográfico 2x3 (6 Fotos)", descripcion: "Resumen semanal de actividades del aula.", motor: "local" },
  { id: "collage_9_fotos_cuadro_honor", nombre: "Mosaico 3x3 (9 Fotos)", descripcion: "Cuadro de honor con fotos de los estudiantes destacados.", motor: "local" },
  { id: "collage_1_grande_2_pequenas", nombre: "Destacado: 1 Principal + 2 Secundarias", descripcion: "Foto del expositor grande y dos detalles de su material.", motor: "local" },
  { id: "collage_1_grande_3_pequenas", nombre: "Ficha Didáctica: 1 Central + 3 Miniaturas", descripcion: "Presentación de proyecto y pasos de construcción.", motor: "local" },
  { id: "collage_tira_comic_4_vinetas", nombre: "Tira Cómica (4 Viñetas Horizontales)", descripcion: "Secuencia cronológica de una narración o cuento.", motor: "local" },
  { id: "collage_polaroid_con_cinta", nombre: "Estilo Fotos Polaroid en Cordel", descripcion: "Simula fotos colgadas con pinzas de ropa en el mural.", motor: "local" },
  { id: "collage_album_recortes_scrapbook", nombre: "Álbum de Recortes Escolar", descripcion: "Bordes rasgados y cinta adhesiva en esquinas.", motor: "local" },
  { id: "collage_marco_doble_dorado", nombre: "Marco Doble de Honor", descripcion: "Para foto del alumno y su certificado de mérito.", motor: "local" },
  { id: "collage_secuencia_temporal_ciencias", nombre: "Secuencia Germinación de la Semilla", descripcion: "Línea de tiempo de 4 etapas botánicas.", motor: "local" },
  { id: "collage_secuencia_ciclo_agua", nombre: "Infografía 4 Momentos del Agua", descripcion: "Evaporación, condensación, precipitación e infiltración.", motor: "local" },
  { id: "collage_mapa_con_fotos_regiones", nombre: "Mapa Dominicano con Fotos de Regiones", descripcion: "Cibao, Sur y Este enlazadas al mapa nacional.", motor: "local" },
  { id: "collage_red_alimentaria_ciencias", nombre: "Esquema de Cadena Alimenticia", descripcion: "Fotos conectadas por flechas de productor a consumidor.", motor: "local" },
  { id: "collage_comparativa_ecosistemas", nombre: "Ecosistema Seco vs. Bosque Húmedo", descripcion: "Comparación visual de biomas dominicanos.", motor: "local" },
  { id: "collage_geometria_figuras_reales", nombre: "Cuerpos Geométricos en el Entorno", descripcion: "Fotos de cilindros, conos y prismas encontrados en el aula.", motor: "local" },
  { id: "collage_paso_a_paso_receta_cocina", nombre: "Receta Instructiva (6 Pasos)", descripcion: "Texto instructivo en Lengua Española con fotos de cada paso.", motor: "local" },
  { id: "collage_proceso_lavado_manos", nombre: "Higiene y Salud: 5 Pasos del Lavado de Manos", descripcion: "Afiche educativo para colocar junto a los lavamanos de la escuela.", motor: "local" },
  { id: "collage_rompecabezas_4_piezas", nombre: "Foto en Forma de Rompecabezas", descripcion: "Divide la foto en 4 fichas encastrables para recortar y jugar.", motor: "local" },
  { id: "collage_rompecabezas_9_piezas", nombre: "Rompecabezas Complejo de 9 Piezas", descripcion: "Juego de mesa educativo con la foto del grupo escolar.", motor: "local" },
  { id: "collage_anillo_central_radial", nombre: "Composición Radial con Núcleo Temático", descripcion: "Tema central en el medio y 6 ramificaciones alrededor.", motor: "local" },
  { id: "collage_antes_despues_reparacion", nombre: "Antes y Después de la Escuela", descripcion: "Documenta mejoras en pintura o limpieza del centro.", motor: "local" },
  { id: "collage_mural_digital_interactivo", nombre: "Mural Padlet Emulado", descripcion: "Varias fotos con notas post-it de colores adosadas.", motor: "local" },
  { id: "collage_tarjeta_postal_dominicana", nombre: "Postal Turística de la República Dominicana", descripcion: "Diseño con sello de correos dominicano y matasellos.", motor: "local" },
  { id: "collage_arbol_genealogico_familia", nombre: "Árbol Genealógico Familiar", descripcion: "Estructura para fotos de abuelos, padres e hijos en Sociales.", motor: "local" },
  { id: "collage_portafolio_cuatrimestral", nombre: "Carátula de Portafolio Cuatrimestral", descripcion: "Muestra representativa de los mejores 5 trabajos del periodo.", motor: "local" },
  { id: "collage_diario_escolar_primera_plana", nombre: "Portada de Periódico Escolar", descripcion: "Simula primera plana con titular, columnas y foto principal.", motor: "local" },
  { id: "collage_galeria_arte_infantil", nombre: "Galería de Arte con Cuadros Enmarcados", descripcion: "Expone los dibujos de los alumnos dentro de marcos de museo.", motor: "local" },
  { id: "collage_separador_diagonal_moderno", nombre: "División Diagonal Moderna", descripcion: "Dos tomas fusionadas por una línea oblicua dinámica.", motor: "local" },
  { id: "collage_malla_hexagonal_panal", nombre: "Panal Hexagonal de Saberes", descripcion: "Fotos dispuestas como hexágonos de colmena.", motor: "local" },
  { id: "collage_circulos_superpuestos", nombre: "Diagrama de Venn con Fotos", descripcion: "Comparación de semejanzas y diferencias entre dos conceptos.", motor: "local" },
  { id: "collage_composicion_ia_narrativa", nombre: "Composición Narrativa Automática (IA)", descripcion: "Une fotos sueltas de la visita al museo en una historia visual continua.", motor: "ia" },
  { id: "collage_alineacion_automatica_ia", nombre: "Autoalineación Inteligente de Cuadros (IA)", descripcion: "Nivela y equilibra márgenes de fotos dispares automáticamente.", motor: "ia" },
  { id: "collage_fusión_paisajes_ia", nombre: "Fusión de Entornos Didácticos (IA)", descripcion: "Combina el dibujo del alumno con un fondo natural realista.", motor: "ia" },
  { id: "collage_recorte_y_montaje_maqueta_ia", nombre: "Integración de Maqueta Escolar (IA)", descripcion: "Ubica la maqueta del volcán en un paisaje vivo con humo didáctico.", motor: "ia" },
  { id: "collage_efecto_espejo_simetria", nombre: "Efecto Espejo para Ejes de Simetría", descripcion: "Ilustra simetría axial para Matemática de 4.º de Primaria.", motor: "local" },
  { id: "collage_zoom_microscopico_recuadro", nombre: "Recuadro Zoom de Detalle Científico", descripcion: "Foto general con recuadro ampliado en círculo del detalle botánico.", motor: "local" },
  { id: "collage_certamen_oratoria_estrado", nombre: "Composición Tríptico del Orador", descripcion: "Expositor, público y jurado docente en una sola lámina.", motor: "local" }
]);

// ── CATEGORÍA 9: ESTILOS ARTÍSTICOS AMABLES (40) ──
registrarLote("estilos_artisticos", [
  { id: "arte_dibujo_a_lapiz_grafito", nombre: "Boceto a Lápiz de Grafito", descripcion: "Convierte la foto en trazos de dibujo a mano alzada.", motor: "local" },
  { id: "arte_colorear_contornos_limpios", nombre: "Lámina Infantil para Colorear", descripcion: "Extrae líneas negras limpias para imprimir y pintar con crayones.", motor: "local" },
  { id: "arte_acuarela_suave_pedagogica", nombre: "Acuarela Escolar Suave", descripcion: "Efecto de pintura húmeda con tonos armónicos y cálidos.", motor: "local" },
  { id: "arte_pintura_al_oleo_textura", nombre: "Pintura al Óleo con Espátula", descripcion: "Pinceladas marcadas para Educación Artística.", motor: "local" },
  { id: "arte_pastel_tiza_difuminado", nombre: "Pintura con Tiza Pastel", descripcion: "Textura empolvada agradable típica de talleres infantiles.", motor: "local" },
  { id: "arte_caricatura_amable_respetuosa", nombre: "Ilustración Tipo Cuento Infantil", descripcion: "Estilo libro de cuentos infantiles sin deformar rasgos.", motor: "ia" },
  { id: "arte_grabado_historico_xilografia", nombre: "Grabado en Madera Colonial", descripcion: "Estilo xilografía para textos de Historia Dominicana.", motor: "local" },
  { id: "arte_puntillismo_seurat", nombre: "Técnica de Puntillismo", descripcion: "Compone la imagen a base de pequeños puntos de color.", motor: "local" },
  { id: "arte_mosaico_azulejos_romanos", nombre: "Mosaico de Teselas", descripcion: "Para historia de las civilizaciones antiguas en secundaria.", motor: "local" },
  { id: "arte_vitral_gotico_colores", nombre: "Vitral Multicolor de Iglesia Colonial", descripcion: "Líneas de plomo y colores traslúcidos.", motor: "local" },
  { id: "arte_pop_art_cuadricula_warhol", nombre: "Pop Art Escolar en 4 Colores", descripcion: "Cuadrante vibrante de colores complementarios.", motor: "local" },
  { id: "arte_impresionismo_monet", nombre: "Luz Impresionista", descripcion: "Pinceladas sueltas de luz para paisajes al aire libre.", motor: "local" },
  { id: "arte_fauvismo_colores_vivos", nombre: "Fauvismo con Colores Expresivos", descripcion: "Expresión cromática libre para artes plásticas.", motor: "local" },
  { id: "arte_tintas_chinas_pincel_seco", nombre: "Tinta China y Pincel Seco", descripcion: "Caligrafía y trazos orientales en blanco y negro.", motor: "local" },
  { id: "arte_comic_linea_clara_belga", nombre: "Cómic Clásico Línea Clara", descripcion: "Bordes negros definidos y colores planos legibles.", motor: "local" },
  { id: "arte_manga_shonen_amable", nombre: "Ilustración Dinámica Escolar", descripcion: "Estilo cómic moderno popular entre adolescentes.", motor: "ia" },
  { id: "arte_pixel_art_8bit_computacion", nombre: "Pixel Art Retro 8-Bits", descripcion: "Para clases de Robótica, Programación y TIC.", motor: "local" },
  { id: "arte_origami_papel_plegado", nombre: "Textura de Papel Plegado (Origami)", descripcion: "Figuras geométricas en facetas de papel.", motor: "local" },
  { id: "arte_plastilina_animada_claymation", nombre: "Efecto Figuras de Plastilina (IA)", descripcion: "Aspecto tridimensional de muñequitos de arcilla.", motor: "ia" },
  { id: "arte_collage_revistas_dada", nombre: "Collage Texturizado de Revistas", descripcion: "Recortes de periódicos educativos superpuestos.", motor: "local" },
  { id: "arte_pintura_rupestre_taina", nombre: "Pintura Rupestre Taína", descripcion: "Pigmentos ocres y negros que emulan las cavernas de San Cristóbal.", motor: "local" },
  { id: "arte_bordado_punto_de_cruz", nombre: "Patrón de Punto de Cruz Textil", descripcion: "Trama de tejido artesanal tradicional.", motor: "local" },
  { id: "arte_litografia_siglo_xix", nombre: "Litografía de Prensa Histórica", descripcion: "Aspecto de los primeros diarios dominicanos de 1880.", motor: "local" },
  { id: "arte_cianotipia_solar_botanica", nombre: "Estampado Solar de Hojas Silvestres", descripcion: "Huellas botánicas en azul Prusia profundo.", motor: "local" },
  { id: "arte_carboncillo_academico", nombre: "Carboncillo de Taller de Dibujo", descripcion: "Difuminados con esfumino para retratos de busto de próceres.", motor: "local" },
  { id: "arte_estilo_cartel_constructivista", nombre: "Cartel Educativo Vanguardista", descripcion: "Diagonales y tipografías potentes para campañas escolares.", motor: "local" },
  { id: "arte_vitral_caribeno_sol", nombre: "Vitral Caribeño de Colores Tropicales", descripcion: "Turquesa, amarillo mango y verde palma.", motor: "local" },
  { id: "arte_grabado_en_cobre_aguafuerte", nombre: "Aguafuerte de Libro Antiguo", descripcion: "Trazos cruzados finos para enciclopedias.", motor: "local" },
  { id: "arte_puntillismo_digital_ciencias", nombre: "Tramado de Semitono de Periódico", descripcion: "Puntos de tinta de imprenta clásica.", motor: "local" },
  { id: "arte_estilo_fresca_pompeyana", nombre: "Fresco Antiguo con Grietas", descripcion: "Para historia de Grecia y Roma en Secundaria.", motor: "local" },
  { id: "arte_lapices_de_colores_infantiles", nombre: "Textura de Lápices de Colores", descripcion: "Trazos de lápiz Prismacolor sobre cartulina rugosa.", motor: "local" },
  { id: "arte_pintura_con_dedos_dactilopintura", nombre: "Dactilopintura de Nivel Inicial", descripcion: "Efecto de témpera untada con los dedos por niños pequeños.", motor: "local" },
  { id: "arte_papel_picado_festivo", nombre: "Calado en Papel Picado", descripcion: "Siluetas recortadas en guirnaldas festivas.", motor: "local" },
  { id: "arte_estilo_tarjeta_raspadita", nombre: "Dibujo sobre Fondo Negro (Scratchboard)", descripcion: "Líneas brillantes sobre fondo de tinta china raspada.", motor: "local" },
  { id: "arte_serigrafia_artesanal_rd", nombre: "Serigrafía Popular Dominicana", descripcion: "Colores planos vivos inspirados en el arte naíf criollo.", motor: "local" },
  { id: "arte_estilo_vitrina_museo", nombre: "Lámina de Exhibición de Museo", descripcion: "Presentación formal con sombra y placa explicativa.", motor: "local" },
  { id: "arte_estilo_cuaderno_bocetos_davinci", nombre: "Códice de Notas e Inventos (Da Vinci)", descripcion: "Anotaciones al margen y dibujos de engranajes para ciencias.", motor: "local" },
  { id: "arte_estilo_ilustracion_botanica_siglo18", nombre: "Lámina Botánica Clásica de Flora Dominicana", descripcion: "Detalle riguroso de flor, fruto, tallo y semilla.", motor: "ia" },
  { id: "arte_dibujo_gis_pizarra_negra", nombre: "Tiza de Colores sobre Pizarra", descripcion: "Efecto de dibujo docente en el pizarrón de clase.", motor: "local" },
  { id: "arte_estilo_comic_superheroe_ciencias", nombre: "Viñeta Heroica del Conocimiento (IA)", descripcion: "Estilo épico para motivar a los jóvenes en ciencia y matemática.", motor: "ia" }
]);

// ── CATEGORÍA 10: MATERIAL DIDÁCTICO Y FICHAS (40) ──
registrarLote("material_didactico", [
  { id: "didactico_ficha_trabajo_a4_encabezado", nombre: "Plantilla Ficha A4 con Datos MINERD", descripcion: "Centro, Docente, Estudiante, Grado, Fecha y Valor.", motor: "local" },
  { id: "didactico_cuadricula_matematica_fondo", nombre: "Hoja de Cuadrícula de 1cm", descripcion: "Fondo cuadriculado para trazar polígonos y sumas en columna.", motor: "local" },
  { id: "didactico_lineas_caligrafia_triple_raya", nombre: "Renglón Triple Raya para Caligrafía", descripcion: "Línea base, media y superior para moldear letras.", motor: "local" },
  { id: "didactico_lineas_doble_raya_primer_ciclo", nombre: "Renglón Doble Raya de Primer Ciclo", descripcion: "Pauta oficial para el programa CON BASE.", motor: "local" },
  { id: "didactico_tarjetas_vocabulario_flashcards", nombre: "Formato Flashcard con Borde para Recortar", descripcion: "4 tarjetas por página con línea de tijera punteada.", motor: "local" },
  { id: "didactico_linea_tiempo_horizontal", nombre: "Plantilla Línea de Tiempo Histórica", descripcion: "Eje cronológico con nodos para fechas y eventos patrios.", motor: "local" },
  { id: "didactico_diagrama_venn_dos_conjuntos", nombre: "Diagrama de Venn (2 Conjuntos)", descripcion: "Para clasificar características comunes y divergentes.", motor: "local" },
  { id: "didactico_mapa_conceptual_jerarquico", nombre: "Esquema de Mapa Conceptual con Cajas", descripcion: "Concepto central y ramificaciones jerárquicas vacías.", motor: "local" },
  { id: "didactico_tabla_comparativa_tres_columnas", nombre: "Tabla SQA (Lo que Sé, Quiero saber, Aprendí)", descripcion: "Estrategia metacognitiva estándar de lectura.", motor: "local" },
  { id: "didactico_regla_graduada_en_borde", nombre: "Regla Milimetrada en el Borde", descripcion: "Escala real impresa en el lateral para medir objetos fotografiados.", motor: "local" },
  { id: "didactico_transportador_angulos_overlay", nombre: "Transportador de Ángulos Transparente", descripcion: "Superpone transportador para medir ángulos en fotos de rampas.", motor: "local" },
  { id: "didactico_escala_grafica_mapas", nombre: "Barra de Escala Gráfica (km/m)", descripcion: "Para mapas y planos en Geografía Dominicana.", motor: "local" },
  { id: "didactico_rosa_de_los_vientos_norte", nombre: "Rosa de los Vientos con Puntos Cardinales", descripcion: "Norte, Sur, Este y Oeste en esquina del mapa escolar.", motor: "local" },
  { id: "didactico_cuadro_rubrica_evaluacion", nombre: "Plantilla de Rúbrica Analítica MINERD", descripcion: "Cuadrícula con 4 niveles: Destacado, Logrado, En Proceso, Iniciado.", motor: "local" },
  { id: "didactico_lista_de_cotejo_si_no", nombre: "Lista de Cotejo Formativa con Casillas", descripcion: "Criterios con casillas Sí / No y observaciones.", motor: "local" },
  { id: "didactico_diana_autoevaluacion_radial", nombre: "Diana de Autoevaluación Radial", descripcion: "Gráfico de diana para que el alumno coloree su nivel de logro.", motor: "local" },
  { id: "didactico_semaforo_metacognitivo", nombre: "Semáforo de Aprendizaje (Verde, Amarillo, Rojo)", descripcion: "Verde: Lo entendí; Amarillo: Tengo dudas; Rojo: Necesito ayuda.", motor: "local" },
  { id: "didactico_abecedario_ilustrado_borde", nombre: "Cintillo del Abecedario Completo", descripcion: "Letras mayúsculas y minúsculas ordenadas en el margen superior.", motor: "local" },
  { id: "didactico_tabla_multiplicar_lateral", nombre: "Tabla Pitagórica en el Lateral", descripcion: "Ayuda visual para resolver problemas matemáticos.", motor: "local" },
  { id: "didactico_mapa_mudo_republica_dominicana", nombre: "Mapa Mudo de RD para Colorear y Ubicar", descripcion: "Contorno insular con división provincial en blanco.", motor: "local" },
  { id: "didactico_division_silabica_recuadros", nombre: "Recuadros para Separación Silábica", descripcion: "Casillas para ubicar sílabas de palabras complejas.", motor: "local" },
  { id: "didactico_panel_valores_del_mes", nombre: "Cartel de Valores MINERD del Mes", descripcion: "Solidaridad, Honestidad, Laboriosidad, Patriotismo.", motor: "local" },
  { id: "didactico_fichas_bingo_educativo", nombre: "Tablero de Bingo Numérico / Palabras", descripcion: "Cuadrícula de 4x4 para juegos de repaso.", motor: "local" },
  { id: "didactico_domino_didactico_fracciones", nombre: "Fichas de Dominó Imprimibles", descripcion: "Para relacionar fracción gráfica con fracción numérica.", motor: "local" },
  { id: "didactico_crucigrama_casillas_blancas", nombre: "Plantilla de Crucigrama Vacío", descripcion: "Cuadrícula con casillas numeradas y definiciones abajo.", motor: "local" },
  { id: "didactico_sopa_de_letras_rejilla", nombre: "Rejilla de Sopa de Letras con Lista de Palabras", descripcion: "Genera la cuadrícula de búsqueda de vocabulario.", motor: "local" },
  { id: "didactico_laberinto_psicomotricidad", nombre: "Laberinto de Trazos para Nivel Inicial", descripcion: "Guía motora para conectar el estudiante con la escuela.", motor: "local" },
  { id: "didactico_plantilla_diploma_reconocimiento", nombre: "Diploma Oficial de Reconocimiento al Esfuerzo", descripcion: "Certificado con firmas de Docente y Dirección escolar.", motor: "local" },
  { id: "didactico_marcapaginas_recortable", nombre: "Tira de 3 Marcapáginas para Recortar", descripcion: "Con frases de motivación y tabla de conversión de unidades.", motor: "local" },
  { id: "didactico_horario_clases_semanal", nombre: "Plantilla de Horario Escolar Semanal", descripcion: "De Lunes a Viernes de 8:00 AM a 4:00 PM (Jornada Extendida).", motor: "local" },
  { id: "didactico_calendario_mensual_escolar", nombre: "Calendario Mensual con Efemérides", descripcion: "Mes en blanco con días cívicos destacados en rojo.", motor: "local" },
  { id: "didactico_tarjeta_asistencia_diaria", nombre: "Control Gráfico de Asistencia Mensual", descripcion: "Casillas para colocar estrellita o punto por día asistido.", motor: "local" },
  { id: "didactico_termometro_emocional_aula", nombre: "Termómetro Emocional de Acogida", descripcion: "Para que el niño identifique cómo se siente al llegar al salón.", motor: "local" },
  { id: "didactico_rueda_de_la_eleccion_conflictos", nombre: "Rueda de Resolución Pacífica de Conflictos", descripcion: "Pedir disculpas, hablar, turnarse, buscar al maestro.", motor: "local" },
  { id: "didactico_caja_para_comentario_docente", nombre: "Recuadro para Retroalimentación Cualitativa", descripcion: "Espacio para comentarios constructivos y formativos del maestro.", motor: "local" },
  { id: "didactico_generador_ejercicios_ia", nombre: "Generador de Ficha de Ejercicios por Foto (IA)", descripcion: "Crea preguntas didácticas basadas en el objeto fotografiado.", motor: "ia" },
  { id: "didactico_traduccion_visual_bilingue_ia", nombre: "Rótulo Bilingüe Español-Inglés (IA)", descripcion: "Identifica elementos en la foto y coloca nombres en ambos idiomas.", motor: "ia" },
  { id: "didactico_adaptacion_dua_braille_visual", nombre: "Marcadores de Accesibilidad DUA", descripcion: "Iconos de apoyo visual para Necesidades Específicas de Apoyo Educativo (NEAE).", motor: "local" },
  { id: "didactico_carnet_lector_biblioteca", nombre: "Plantilla de Carnet de Lector de Aula", descripcion: "Foto del alumno, código de lector y registro de libros leídos.", motor: "local" },
  { id: "didactico_membrete_institucional_escuela", nombre: "Membrete Oficial del Centro Educativo", descripcion: "Encabezado ministerial formal para cartas y circulares a padres.", motor: "local" }
]);

// ── CATEGORÍA 11: EVENTOS Y FECHAS PATRIAS RD (40) ──
registrarLote("eventos_fechas", [
  { id: "eventos_27_febrero_independencia", nombre: "Marco Patriótico: 27 de Febrero", descripcion: "Día de la Independencia Nacional con bandera, trabuco y laureles.", motor: "local" },
  { id: "eventos_26_enero_natalicio_duarte", nombre: "Marco Conmemorativo: Juan Pablo Duarte", descripcion: "Natalicio del Padre de la Patria y fundador de La Trinitaria.", motor: "local" },
  { id: "eventos_25_febrero_natalicio_mella", nombre: "Marco Conmemorativo: Matías Ramón Mella", descripcion: "Disparo del trabucazo en la Puerta de la Misericordia.", motor: "local" },
  { id: "eventos_9_marzo_natalicio_sanchez", nombre: "Marco Conmemorativo: Francisco del Rosario Sánchez", descripcion: "Izada de la bandera en la Puerta del Conde.", motor: "local" },
  { id: "eventos_16_agosto_restauracion", nombre: "Marco Histórico: Día de la Restauración", descripcion: "Grito de Capotillo y reafirmación de la soberanía nacional.", motor: "local" },
  { id: "eventos_6_noviembre_constitucion", nombre: "Marco Cívico: Día de la Constitución", descripcion: "Firma de la primera carta magna en San Cristóbal (1844).", motor: "local" },
  { id: "eventos_mes_de_la_patria_completo", nombre: "Marco General del Mes de la Patria", descripcion: "Borde tricolor con los tres Padres de la Patria.", motor: "local" },
  { id: "eventos_25_noviembre_hermanas_mirabal", nombre: "Marco de las Mariposas: Hermanas Mirabal", descripcion: "Día Internacional de la No Violencia contra la Mujer en honor a las heroínas.", motor: "local" },
  { id: "eventos_30_junio_dia_del_maestro", nombre: "Marco de Celebración: Día del Maestro Dominicano", descripcion: "Natalicio de Juan Bosch y homenaje al docente.", motor: "local" },
  { id: "eventos_21_octubre_salome_urena", nombre: "Marco Cultural: Salomé Ureña y Poesía", descripcion: "Día Nacional del Poeta y pionera de la educación femenina.", motor: "local" },
  { id: "eventos_12_octubre_encuentro_culturas", nombre: "Marco Histórico: Día de la Raza e Interculturalidad", descripcion: "Encuentro de culturas europea, taína y africana en la isla.", motor: "local" },
  { id: "eventos_21_enero_virgen_de_la_altagracia", nombre: "Marco Cultural: Virgen de la Altagracia", descripcion: "Patrona del pueblo dominicano y festividad cívico-religiosa.", motor: "local" },
  { id: "eventos_24_septiembre_virgen_las_mercedes", nombre: "Marco Histórico: Virgen de las Mercedes", descripcion: "Santo Cerro y patrimonio cultural de La Vega.", motor: "local" },
  { id: "eventos_carnaval_dominicano_febrero", nombre: "Marco Festivo: Carnaval Dominicano", descripcion: "Máscaras, vejigas, diablos cojuelos y comparsas escolares.", motor: "local" },
  { id: "eventos_dia_del_estudiante_18_febrero", nombre: "Marco de Homenaje: Día del Estudiante", descripcion: "Celebración y reconocimiento a la niñez y juventud escolar.", motor: "local" },
  { id: "eventos_graduacion_promocion_escolar", nombre: "Marco Solemne: Promoción y Graduación", descripcion: "Birretes volando, cintas doradas y certificado de fin de curso.", motor: "local" },
  { id: "eventos_primer_dia_de_clases_agosto", nombre: "Marco de Alegría: ¡De Vuelta a la Escuela!", descripcion: "Apertura del año escolar dominicano en agosto.", motor: "local" },
  { id: "eventos_fin_ano_escolar_junio", nombre: "Marco Festivo: ¡Misión Cumplida! Vacaciones", descripcion: "Cierre exitoso del periodo de docencia.", motor: "local" },
  { id: "eventos_dia_de_las_madres_mayo", nombre: "Marco Especial: Día de las Madres", descripcion: "Último domingo de mayo, claveles y dedicatorias escolares.", motor: "local" },
  { id: "eventos_dia_de_los_padres_julio", nombre: "Marco Especial: Día de los Padres", descripcion: "Último domingo de julio, valores de paternidad responsable.", motor: "local" },
  { id: "eventos_navidad_escolar_diciembre", nombre: "Marco Navideño: Aguinaldo Escolar", descripcion: "Charamicos, estrellas y campanas tradicionales de RD.", motor: "local" },
  { id: "eventos_dia_del_arbol_mayo", nombre: "Marco Verde: Día del Árbol y Reforestación", descripcion: "Siembra escolar de especies nativas de la isla.", motor: "local" },
  { id: "eventos_dia_del_medio_ambiente_junio", nombre: "Marco Ecológico: Cuidado del Medio Ambiente", descripcion: "Protección de ríos y costas dominicanas.", motor: "local" },
  { id: "eventos_dia_del_agua_marzo", nombre: "Marco Educativo: Día Mundial del Agua", descripcion: "Sensibilización sobre el cuidado de las cuencas hidrográficas.", motor: "local" },
  { id: "eventos_semana_santa_cultura", nombre: "Marco Reflexivo: Semana Santa", descripcion: "Reflexión familiar y tradición cultural.", motor: "local" },
  { id: "eventos_batalla_19_marzo_azua", nombre: "Marco Histórico: Batalla del 19 de Marzo (Azua)", descripcion: "Primera gesta bélica en defensa de la soberanía de 1844.", motor: "local" },
  { id: "eventos_batalla_30_marzo_santiago", nombre: "Marco Histórico: Batalla del 30 de Marzo (Santiago)", descripcion: "Consolidación de la independencia en el Cibao.", motor: "local" },
  { id: "eventos_dia_del_libro_abril", nombre: "Marco Cultural: Día Internacional del Libro", descripcion: "23 de abril, promoción de lectura en las aulas.", motor: "local" },
  { id: "eventos_dia_de_la_tierra_abril", nombre: "Marco Conmemorativo: Día de la Tierra", descripcion: "22 de abril, compromiso con la biodiversidad insular.", motor: "local" },
  { id: "eventos_feria_del_libro_santo_domingo", nombre: "Marco Literario: Feria Internacional del Libro", descripcion: "Evento cultural en la Plaza de la Cultura de Santo Domingo.", motor: "local" },
  { id: "eventos_cumpleanos_estudiante_aula", nombre: "Marco Festivo: ¡Feliz Cumpleaños en la Escuela!", descripcion: "Para fotos de corte de pastel y festejo en el salón.", motor: "local" },
  { id: "eventos_dia_del_psicologo_escolar", nombre: "Marco de Reconocimiento: Orientación y Psicología", descripcion: "Acompañamiento socioemocional en el centro.", motor: "local" },
  { id: "eventos_dia_del_deporte_noviembre", nombre: "Marco Conmemorativo: Día Nacional del Deporte", descripcion: "Juegos deportivos escolares nacionales.", motor: "local" },
  { id: "eventos_dia_de_la_alfabetizacion_septiembre", nombre: "Marco Pedagógico: Día Internacional de la Alfabetización", descripcion: "Logro de la lectoescritura en primer ciclo.", motor: "local" },
  { id: "eventos_dia_del_nino_septiembre", nombre: "Marco de Alegría: Día Nacional del Niño", descripcion: "Derechos de la niñez y recreación sana.", motor: "local" },
  { id: "eventos_dia_de_la_alimentacion_octubre", nombre: "Marco Saludable: Día Mundial de la Alimentación", descripcion: "Nutrición escolar y almuerzo escolar balanceado.", motor: "local" },
  { id: "eventos_recreacion_historica_ia", nombre: "Ambientación Histórica con Próceres (IA)", descripcion: "Ubica respetuosamente la foto escolar en el contexto de 1844.", motor: "ia", politica: "confirmar" },
  { id: "eventos_ambientacion_carnaval_ia", nombre: "Composición Carnaval Popular (IA)", descripcion: "Agrega comparsa tradicional festiva de fondo con IA.", motor: "ia" },
  { id: "eventos_escenografia_independencia_ia", nombre: "Altar Cívico Trinitario (IA)", descripcion: "Escenografía escolar con los tres Padres de la Patria de fondo.", motor: "ia" },
  { id: "eventos_clausura_ano_lectivo", nombre: "Marco de Medallas: Clausura del Año Escolar", descripcion: "Cinta con laureles y mensaje de pase al siguiente grado.", motor: "local" }
]);

// ── CATEGORÍA 12: SALIDA Y FORMATO (40) ──
registrarLote("salida_formato", [
  { id: "formato_whatsapp_comprimido", nombre: "Optimizar para WhatsApp de Padres", descripcion: "Comprime a menos de 300 KB conservando legibilidad para envío rápido.", motor: "local" },
  { id: "formato_a4_vertical_300dpi", nombre: "Formato A4 Vertical (300 DPI)", descripcion: "Dimensiones y resolución exacta para imprimir en papel bond carta o A4.", motor: "local" },
  { id: "formato_a4_horizontal_apaisado", nombre: "Formato A4 Horizontal (Apaisado)", descripcion: "Para murales, cuadros de doble entrada y panorámicas.", motor: "local" },
  { id: "formato_cuadrado_redes_1x1", nombre: "Formato Cuadrado (1:1)", descripcion: "Para fotos de perfil docente o publicaciones escolares.", motor: "local" },
  { id: "formato_historia_vertical_9x16", nombre: "Formato Vertical para Estado (9:16)", descripcion: "Para estados de WhatsApp del centro educativo.", motor: "local" },
  { id: "formato_recorte_tamano_carnet_escolar", nombre: "Recorte Carnet Estudiantil (2x2 pulgadas)", descripcion: "Dimensiones oficiales para expediente y registro de grado.", motor: "local" },
  { id: "formato_exportar_png_transparente", nombre: "Exportar como PNG Transparente", descripcion: "Conserva recorte sin fondo para superponer en Word o PowerPoint.", motor: "local" },
  { id: "formato_exportar_jpg_calidad_alta", nombre: "Exportar como JPG de Alta Calidad", descripcion: "Máxima fidelidad cromática para archivo fotográfico del centro.", motor: "local" },
  { id: "formato_exportar_webp_web_ligero", nombre: "Exportar en Formato WebP Ultraligero", descripcion: "Carga rápida en plataformas web y blogs escolares.", motor: "local" },
  { id: "formato_convertir_a_pdf_imprimible", nombre: "Convertir a Documento PDF Listo para Imprimir", descripcion: "Genera página PDF centrada para mandar directo a la impresora.", motor: "local" },
  { id: "formato_insertar_directo_word_plan", nombre: "Insertar Directamente en Planificación Word", descripcion: "Incrusta la foto en el anexo de la planificación curricular actual.", motor: "local" },
  { id: "formato_rotar_90_grados_derecha", nombre: "Rotar 90° a la Derecha", descripcion: "Corrige orientación de foto tomada de lado.", motor: "local" },
  { id: "formato_rotar_90_grados_izquierda", nombre: "Rotar 90° a la Izquierda", descripcion: "Corrige orientación vertical equivocada.", motor: "local" },
  { id: "formato_rotar_180_grados_invertir", nombre: "Rotar 180° (Poner al Derecho)", descripcion: "Corrige fotos tomadas de cabeza.", motor: "local" },
  { id: "formato_voltear_horizontalmente_espejo", nombre: "Voltear Horizontalmente (Efecto Espejo)", descripcion: "Invierte orientación izquierda/derecha.", motor: "local" },
  { id: "formato_voltear_verticalmente", nombre: "Voltear Verticalmente", descripcion: "Invierte arriba y abajo.", motor: "local" },
  { id: "formato_redimensionar_ancho_800px", nombre: "Redimensionar a 800px de Ancho", descripcion: "Tamaño ideal para adjuntar en correos de bajo peso.", motor: "local" },
  { id: "formato_redimensionar_ancho_1200px", nombre: "Redimensionar a 1200px de Ancho", descripcion: "Equilibrio óptimo entre nitidez y peso para pantallas de computadoras.", motor: "local" },
  { id: "formato_redimensionar_ancho_1920px_fullhd", nombre: "Redimensionar a Full HD (1920px)", descripcion: "Para proyectores de alta resolución o televisores inteligentes del centro.", motor: "local" },
  { id: "formato_limite_peso_500kb", nombre: "Ajustar Peso Estricto a Menos de 500 KB", descripcion: "Para subir a plataformas del MINERD con límite estricto de subida.", motor: "local" },
  { id: "formato_limite_peso_1mb", nombre: "Ajustar Peso a Menos de 1 MB", descripcion: "Garantiza compatibilidad con sistemas de gestión escolar.", motor: "local" },
  { id: "formato_agregar_margen_blanco_impresion", nombre: "Añadir Margen de Seguridad de 1 cm", descripcion: "Evita que la guillotina o la impresora corte texto en los bordes.", motor: "local" },
  { id: "formato_agregar_borde_fino_negro", nombre: "Borde Negro Fino de Encuadre", descripcion: "Línea de 1 píxel para delimitar fotos sobre páginas blancas.", motor: "local" },
  { id: "formato_agregar_borde_doble_institucional", nombre: "Borde Doble Azul Escolar", descripcion: "Marco perimetral elegante para certificados.", motor: "local" },
  { id: "formato_agregar_esquinas_redondeadas", nombre: "Esquinas Redondeadas Suaves", descripcion: "Estilo moderno para tarjetas y botones digitales.", motor: "local" },
  { id: "formato_crear_miniatura_thumbnail", nombre: "Generar Miniatura Rápida (150x150)", descripcion: "Para índice de evidencias en el portafolio digital.", motor: "local" },
  { id: "formato_strip_metadatos_exif_privacidad", nombre: "Eliminar Metadatos EXIF de Ubicación GPS", descripcion: "Borra coordenadas geográficas y datos de la cámara para proteger la privacidad.", motor: "local" },
  { id: "formato_incrustar_marca_agua_licencia", nombre: "Incrustar Licencia de Uso Educativo", descripcion: "Añade texto legal de recurso pedagógico abierto y gratuito.", motor: "local" },
  { id: "formato_duplicar_en_cuadricula_2x2", nombre: "Multiplicar 4 Copias en una Página", descripcion: "Para imprimir 4 carnets o fotos en una sola hoja y recortar.", motor: "local" },
  { id: "formato_duplicar_en_cuadricula_2x4", nombre: "Multiplicar 8 Copias Tipo Carnet", descripcion: "Aprovecha al máximo una hoja de papel fotográfico.", motor: "local" },
  { id: "formato_generar_enlace_compartir_qr", nombre: "Generar Código QR de Enlace a la Imagen", descripcion: "Para que los padres escaneen y vean la foto en alta resolución.", motor: "local" },
  { id: "formato_copiar_al_portapapeles_sistema", nombre: "Copiar Imagen al Portapapeles", descripcion: "Pega directamente con Ctrl+V en Word, Excel o WhatsApp Web.", motor: "local" },
  { id: "formato_descarga_inmediata_archivo", nombre: "Descargar Archivo al Dispositivo", descripcion: "Guarda en la carpeta de descargas con nombre descriptivo.", motor: "local" },
  { id: "formato_ajuste_autocrop_inteligente_ia", nombre: "Encuadre Automático Centrado en Sujeto (IA)", descripcion: "Detecta a los alumnos y corta el espacio vacío circundante.", motor: "ia" },
  { id: "formato_desenfoque_datos_sensibles_ia", nombre: "Ocultamiento Inteligente de Cédula o Teléfono (IA)", descripcion: "Detecta y borra números de cédula o teléfonos en carnets.", motor: "ia" },
  { id: "formato_vectorizar_a_svg_futuro", nombre: "Vectorizar a Gráfico SVG Escalable", descripcion: "Convierte trazos en curvas matemáticas sin pérdida de calidad.", motor: "futuro" },
  { id: "formato_generar_gif_animado_futuro", nombre: "Crear GIF Animado de Secuencia", descripcion: "Une 3 fotos en una animación cíclica del experimento.", motor: "futuro" },
  { id: "formato_compresion_lossless_pngquant", nombre: "Compresión Óptima sin Pérdida Visible", descripcion: "Reduce hasta 60% del peso en PNG usando paletas indexadas.", motor: "local" },
  { id: "formato_etiquetar_accesibilidad_alt_ia", nombre: "Generar Texto Alternativo Descriptivo (ALT) con IA", descripcion: "Crea descripción accesible para lectores de pantalla de alumnos no videntes.", motor: "ia" },
  { id: "formato_finalizar_y_archivar_biblioteca", nombre: "Guardar en la Biblioteca de Planifica Maestro", descripcion: "Almacena en Mis Planificaciones asociada al plan actual.", motor: "local" }
]);

/**
 * Obtiene una operación del catálogo por su ID único.
 * @param {string} id - Identificador de la operación.
 * @returns {Object|null}
 */
export function obtenerOperacionPorId(id) {
  if (!id || typeof id !== "string") return null;
  return CATALOGO_OPERACIONES.find((op) => op.id === id.trim()) || null;
}

/**
 * Filtra las operaciones de una categoría específica.
 * @param {string} categoria - ID de la categoría.
 * @returns {Array<Object>}
 */
export function obtenerOperacionesPorCategoria(categoria) {
  if (!categoria || typeof categoria !== "string") return [];
  return CATALOGO_OPERACIONES.filter((op) => op.categoria === categoria.trim());
}

/**
 * Retorna las estadísticas del catálogo para auditoría y verificaciones.
 * @returns {Object}
 */
export function estadisticasCatalogo() {
  const conteoPorCategoria = {};
  for (const cat of CATEGORIAS_EDICION) {
    conteoPorCategoria[cat.id] = 0;
  }

  let local = 0;
  let ia = 0;
  let futuro = 0;
  let permitido = 0;
  let confirmar = 0;

  for (const op of CATALOGO_OPERACIONES) {
    conteoPorCategoria[op.categoria] = (conteoPorCategoria[op.categoria] || 0) + 1;
    if (op.motor === "local") local++;
    else if (op.motor === "ia") ia++;
    else if (op.motor === "futuro") futuro++;

    if (op.politica === "confirmar") confirmar++;
    else permitido++;
  }

  return {
    total: CATALOGO_OPERACIONES.length,
    conteoPorCategoria,
    motores: { local, ia, futuro },
    politicas: { permitido, confirmar }
  };
}
