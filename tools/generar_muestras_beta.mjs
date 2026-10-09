import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const rootDir = 'c:/Users/Win10/Desktop/planifica maestro/planifica-maestro';
const clientModuleUrl = pathToFileURL(path.join(rootDir, 'client/src/services/generadorWordConBase.js')).href;
const docxModuleUrl = pathToFileURL(path.join(rootDir, 'client/node_modules/docx/dist/index.cjs')).href;
const { construirDocumentoWordOficial } = await import(clientModuleUrl);
const { Packer } = await import(docxModuleUrl);

const dirMuestras = path.join(rootDir, 'muestras_word');

if (!fs.existsSync(dirMuestras)) {
  fs.mkdirSync(dirMuestras, { recursive: true });
}

// ─────────────────────────────────────────────────────────────
// MUESTRA 1: Lengua Española 1.º y 2.º Multigrado
// ─────────────────────────────────────────────────────────────
const plan1 = {
  titulo: 'Secuencia 1: Mi Identidad y Mi Nombre',
  area: 'Lengua Española',
  grado: '1.º y 2.º de Primaria (Multigrado)',
  grados: ['1.º', '2.º'],
  seccion: 'A - Multigrado',
  secuencia: 'Secuencia Didáctica 1: La autobiografía y la tarjeta de identidad',
  bloque: '1',
  actividad: 'Actividad 1: Presentación y escritura del nombre propio',
  intencionPedagogica: 'Que los estudiantes de 1.º y 2.º reconozcan y escriban su nombre propio y apellidos, compartiendo sus datos de identidad personal.',
  estrategias: 'Presentación de papelógrafo de aprendizajes, lectura modélica de autobiografía, indagación dialógica y trabajo diferenciado por ciclo.',
  competenciasFundamentales: 'Competencia Comunicativa, Competencia de Pensamiento Lógico, Creativo y Crítico, Competencia Ética y Ciudadana.',
  competenciasEspecificas: 'Expresa y comprende oralmente y por escrito datos de su identidad personal y familiar, utilizando soportes textuales y gráficos apropiados.',
  momentos: [
    {
      nombre: 'Momento 1: Inicio / Escucha atenta y motivación',
      descripcion: 'El docente presenta y lee de forma articulada su autobiografía en la pizarra. Los estudiantes de 1.º y 2.º comentan qué palabras clave escucharon e identifican los nombres y fechas mencionados.',
      tiempo: '15 min',
      recursos: 'Pizarra, marcadores, papelógrafo con la autobiografía modelo'
    },
    {
      nombre: 'Momento 2: Desarrollo / Presentación del papelógrafo de aprendizajes',
      descripcion: 'Presentación del papelógrafo de aprendizajes del programa CON BASE. Se analizan colectivamente las metas del mes para 1.º y 2.º grado, distinguiendo letras de números en tarjetas de nombres.',
      tiempo: '20 min',
      recursos: 'Papelógrafo de aprendizajes CON BASE, tarjetas léxicas de nombres, cinta adhesiva'
    },
    {
      nombre: 'Momento 3: Práctica diferenciada en el fascículo',
      descripcion: 'Trabajo por grado: Primer grado completa las frases "Mi nombre es..." y copia su nombre usando su tarjeta de referencia. Segundo grado escribe su nombre, primer apellido y el nombre de su docente en el cuaderno.',
      tiempo: '25 min',
      recursos: 'Fascículo del estudiante CON BASE, tarjetas personales de identidad, cuadernos de trabajo y lápices'
    },
    {
      nombre: 'Momento 4: Cierre metacognitivo y tarea formativa',
      descripcion: 'Reflexión guiada: ¿Qué aprendimos hoy sobre nuestro nombre? ¿Qué letras nuevas identificamos? Asignación de tarea: preguntar en casa el significado de su nombre y traerlo anotado.',
      tiempo: '15 min',
      recursos: 'Cuaderno de Lengua Española, lista de cotejo formativa'
    }
  ],
  evaluacion: 'Evaluación formativa mediante observación directa, revisión de producciones escritas en el cuaderno y lista de cotejo sobre reconocimiento del nombre propio.',
  actividadesDiferenciadas: 'Para estudiantes que requieren refuerzo en 1.º: modelado con letras móviles de madera y trazado guiado. Para estudiantes avanzados en 2.º: redacción de dos oraciones completas sobre sus gustos y familia.'
};

const perfil1 = {
  nombre: 'Prof. Israel Montés',
  escuela: 'Escuela Básica Batey Piñones',
  regional: '10',
  distrito: '10-01',
  tanda: 'Jornada Escolar Extendida (JEE)',
  seccion: 'A'
};

// ─────────────────────────────────────────────────────────────
// MUESTRA 2: Matemática 3.º
// ─────────────────────────────────────────────────────────────
const plan2 = {
  titulo: 'Secuencia 4: Organización y Análisis de Datos en Gráficas de Barras',
  area: 'Matemática',
  grado: '3.º de Primaria',
  seccion: 'B',
  secuencia: 'Secuencia 4: ¿A qué jugamos? Estadística y gráficos de barras',
  bloque: '2',
  actividad: 'Actividad 1: Recolección de datos y tabla de frecuencias',
  intencionPedagogica: 'Que los estudiantes recopilen, clasifiquen y organicen datos cuantitativos sobre sus juegos favoritos construyendo una gráfica de barras vertical.',
  estrategias: 'Resolución de problemas de la vida cotidiana, manipulación de material concreto, socialización en parejas y modelado gráfico.',
  competenciasFundamentales: 'Competencia de Resolución de Problemas, Competencia Científica y Tecnológica, Competencia de Pensamiento Lógico, Creativo y Crítico.',
  competenciasEspecificas: 'Recolecta, organiza y representa datos cualitativos y cuantitativos discretos en tablas de frecuencia y gráficos de barras, interpretando sus resultados.',
  momentos: [
    {
      nombre: 'Momento 1: Inicio / Planteamiento del reto matemático',
      descripcion: 'Planteamiento de la situación: ¿Cómo podemos saber de forma clara cuál es el juego tradicional preferido por todos en el aula? Lluvia de ideas y votación rápida a mano alzada.',
      tiempo: '15 min',
      recursos: 'Pizarra, marcadores de colores, tabla de conteo inicial'
    },
    {
      nombre: 'Momento 2: Desarrollo / Organización de datos en tabla de frecuencias',
      descripcion: 'Los estudiantes organizan el conteo en sus cuadernos utilizando marcas de tarja (palotes) y asignan la frecuencia numérica a cada juego (pelota, rayuela, escondite).',
      tiempo: '25 min',
      recursos: 'Cuaderno cuadriculado de Matemática, regla graduada, fascículo CON BASE'
    },
    {
      nombre: 'Momento 3: Construcción de la gráfica de barras',
      descripcion: 'Elaboración guiada de la gráfica de barras en papelógrafo milimetrado: definición del eje horizontal (categorías) y eje vertical (escala de 1 en 1). Pintado de barras por equipos.',
      tiempo: '25 min',
      recursos: 'Papelógrafo milimetrado, reglas, lápices de colores, cinta adhesiva'
    },
    {
      nombre: 'Momento 4: Cierre / Interpretación de datos y metacognición',
      descripcion: 'Análisis colectivo de la gráfica: ¿Cuál fue la moda? ¿Qué juego obtuvo menos votos? Reflexión sobre la utilidad de las gráficas en la vida diaria.',
      tiempo: '15 min',
      recursos: 'Registro de grado, escala de valoración formativa'
    }
  ],
  evaluacion: 'Evaluación formativa continua: precisión en el conteo, exactitud en la escala de la gráfica y rúbrica de interpretación estadística.',
  actividadesDiferenciadas: 'Para estudiantes con dudas en la escala: apoyo con bloques multibase y conteo uno a uno. Para estudiantes con dominio rápido: calcular la diferencia matemática entre la barra más alta y la más baja.'
};

const perfil2 = {
  nombre: 'Prof. Carmen Reyes',
  escuela: 'Centro Educativo República de Panamá',
  regional: '15',
  distrito: '15-03',
  tanda: 'Jornada Escolar Extendida (JEE)',
  seccion: 'B'
};

// ─────────────────────────────────────────────────────────────
// MUESTRA 3: Ciencias Sociales 5.º
// ─────────────────────────────────────────────────────────────
const plan3 = {
  titulo: 'Secuencia 2: Relieve y Zonas Geográficas de la República Dominicana',
  area: 'Ciencias Sociales',
  grado: '5.º de Primaria',
  seccion: 'Única',
  secuencia: 'Secuencia Didáctica 2: Espacio geográfico y sistemas montañosos de nuestra isla',
  bloque: '1',
  actividad: 'Actividad 2: Cordilleras, sierras y valles de la República Dominicana',
  intencionPedagogica: 'Que los estudiantes ubiquen y caractericen las principales cordilleras y valles del país, reconociendo su impacto en el clima y la agricultura.',
  estrategias: 'Indagación cartográfica, análisis de mapas físicos, trabajo cooperativo y síntesis en organizadores gráficos.',
  competenciasFundamentales: 'Competencia Ambiental y de la Salud, Competencia Científica y Tecnológica, Competencia Ética y Ciudadana.',
  competenciasEspecificas: 'Identifica y localiza los principales elementos del relieve dominicano, argumentando sobre su aprovechamiento sostenible y conservación ecológica.',
  momentos: [
    {
      nombre: 'Momento 1: Inicio / Exploración cartográfica',
      descripcion: 'Activación de saberes previos observando el mapa físico de la isla de Santo Domingo: ¿Cuáles son las partes más altas? ¿Dónde se encuentra el Pico Duarte? Los estudiantes señalan en el mapa.',
      tiempo: '15 min',
      recursos: 'Mapa mural físico de la República Dominicana, globo terráqueo, puntero'
    },
    {
      nombre: 'Momento 2: Desarrollo / Identificación de cordilleras y sierras',
      descripcion: 'Lectura comentada del texto informativo sobre la Cordillera Central, Septentrional y Oriental. Por parejas, completan un cuadro comparativo con alturas y provincias que atraviesan.',
      tiempo: '25 min',
      recursos: 'Libro de texto oficial MINERD, cuadernos de trabajo, atlas geográfico'
    },
    {
      nombre: 'Momento 3: Aplicación práctica en mapa mudo',
      descripcion: 'Cada estudiante colorea y rotula en su mapa físico mudo las tres cordilleras y los valles del Cibao y San Juan, utilizando la leyenda cromática estándar de relieve.',
      tiempo: '25 min',
      recursos: 'Mapas físicos mudos fotocopiados, lápices de colores, regla'
    },
    {
      nombre: 'Momento 4: Cierre / Puesta en común y conclusiones ecológicas',
      descripcion: 'Socialización grupal de mapas terminados. Conclusión sobre la importancia de las cordilleras como fuentes de nacimiento de ríos (madres de las aguas). Preguntas de autoevaluación.',
      tiempo: '15 min',
      recursos: 'Pizarra, lista de cotejo cartográfica, cuaderno de notas'
    }
  ],
  evaluacion: 'Evaluación formativa basada en la precisión de la localización en el mapa mudo y la sustentación oral de las características del relieve en la lista de cotejo.',
  actividadesDiferenciadas: 'Para estudiantes con dificultades visuales o motrices: uso de mapa en relieve texturizado con plastilina. Para estudiantes avanzados: investigar las principales cuencas hidrográficas que nacen en la Cordillera Central.'
};

const perfil3 = {
  nombre: 'Prof. Manuel Alcántara',
  escuela: 'Escuela Primaria Salomé Ureña',
  regional: '04',
  distrito: '04-02',
  tanda: 'Matutina',
  seccion: 'Única'
};

async function generarTodas() {
  console.log('Iniciando generación de 3 muestras Word...');

  const doc1 = await construirDocumentoWordOficial({ datos: plan1, perfil: perfil1, titulo: plan1.titulo });
  const buf1 = await Packer.toBuffer(doc1);
  const p1 = path.join(dirMuestras, 'Muestra_1_Lengua_Espanola_Multigrado_1ro_y_2do.docx');
  fs.writeFileSync(p1, buf1);
  console.log(`✓ Muestra 1 generada con éxito (${buf1.length} bytes): ${p1}`);

  const doc2 = await construirDocumentoWordOficial({ datos: plan2, perfil: perfil2, titulo: plan2.titulo });
  const buf2 = await Packer.toBuffer(doc2);
  const p2 = path.join(dirMuestras, 'Muestra_2_Matematica_3ro.docx');
  fs.writeFileSync(p2, buf2);
  console.log(`✓ Muestra 2 generada con éxito (${buf2.length} bytes): ${p2}`);

  const doc3 = await construirDocumentoWordOficial({ datos: plan3, perfil: perfil3, titulo: plan3.titulo });
  const buf3 = await Packer.toBuffer(doc3);
  const p3 = path.join(dirMuestras, 'Muestra_3_Ciencias_Sociales_5to.docx');
  fs.writeFileSync(p3, buf3);
  console.log(`✓ Muestra 3 generada con éxito (${buf3.length} bytes): ${p3}`);
}

generarTodas().catch(err => {
  console.error('Error generando muestras:', err);
  process.exit(1);
});
