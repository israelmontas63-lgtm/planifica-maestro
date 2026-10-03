# INFORME DE LA BIBLIOTECA CURRICULAR OFICIAL (MINERD / CON BASE)
**Planifica Maestro — Sistema Curricular por Capas Sincronizadas**  
**Fecha de corte:** 2 de octubre de 2026  
**Estado general de validación:** Pendiente de validación por experto  

---

## 1. Resumen Ejecutivo
Se ha estructurado la **Biblioteca Curricular Oficial** en `server/curriculo/` mediante una arquitectura de 5 capas independientes y sincronizadas más una capa de novedades. El objetivo central es erradicar alucinaciones curriculares, garantizando que el asistente de IA cite con precisión quirúrgica el documento, grado, área y número de página real de las fuentes oficiales de la República Dominicana (MINERD / CON BASE).

Todos los datos procesados mantienen de forma estricta la etiqueta **"pendiente de validación por experto"**. Ningún registro ha sido marcado como "validada", y bajo ninguna circunstancia se han inventado o rellenado datos faltantes en las matrices curriculares.

---

## 2. Inventario de Documentos Incorporados (Capa 1)

| Título Oficial | Nivel | Grado | Área | URL de Origen | Tamaño (Bytes / MB) | Hash SHA-256 | Estado |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Guía Didáctica de Matemática Multigrado** | Primario | Multigrado (1er Ciclo) | Matemática | [ministeriodeeducacion.gob.do](https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo) | 29,530,257 B (28.16 MB) | `3d377468e36ceb91e611393fe240e6683f1c95c2b8170a5d316ad4f22b07f22a` | Pendiente de validación por experto |
| **Guía Didáctica de Lengua Española Multigrado** | Primario | Multigrado (1er Ciclo) | Lengua Española | [ministeriodeeducacion.gob.do](https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo) | 5,264,096 B (5.02 MB) | `a2f64b35c24b27e2db1a7bbed1ad1ba3feaddb37e4e3254c1cbe87a3b2608c52` | Pendiente de validación por experto |
| **Guía Didáctica de Matemática (Primer Ciclo)** | Primario | 1er Ciclo (1ro, 2do, 3ro) | Matemática | [ministeriodeeducacion.gob.do](https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo) | 20,909,468 B (19.94 MB) | `1c5f1af7eb1ad495016f11fe8b9f4f762b7668592f4b1c57bcca4c54b8bbe48d` | Pendiente de validación por experto |

*Total espacio documental en Capa 1:* **55,703,821 bytes (~53.12 MB)**.

---

## 3. Análisis de Descarga, Robots.txt y Términos de Uso

- **Origen de los documentos:** Los 3 documentos PDF originales fueron aportados al repositorio del proyecto y provienen de las publicaciones oficiales del Ministerio de Educación de la República Dominicana (MINERD) en colaboración con UNICEF para el programa "Construyendo la Base de los Aprendizajes" (CON BASE, 2023).
- **Inspección de `robots.txt`:** Se verificó la directiva en `https://ministeriodeeducacion.gob.do/robots.txt`:
  ```txt
  User-agent: *
  Disallow:
  ```
  El portal del MINERD permite el acceso público de rastreo (`Disallow:` vacío para todos los user-agents).
- **Términos de uso:** Los documentos curriculares del MINERD son materiales educativos de acceso público bajo la Ley General de Libre Acceso a la Información Pública (Ley 200-04 de la República Dominicana). Su propósito es eminentemente pedagógico y no comercial.
- **Documentos que no se pudieron descargar o están ausentes:**
  1. *Adecuación Curricular Nivel Primario (Segundo Ciclo: 4to, 5to, 6to):* No descargado aún; requiere descarga o aprovisionamiento manual del portal MINERD.
  2. *Adecuación Curricular Nivel Secundario (1ro a 6to):* No descargado aún.
  3. *Diseño Curricular Nivel Inicial (Maternal, Kínder, Pre-primario):* No descargado aún.
  4. *Áreas curriculares complementarias (Ciencias de la Naturaleza, Ciencias Sociales, Artística, Educación Física, FIHR, Lenguas Extranjeras):* No contempladas en el programa CON BASE de 1er ciclo, por lo que no están incorporadas actualmente.

---

## 4. Estado Detallado por Capas

| Capa | Nombre | Contenido / Archivos | Cantidad de Registros | Estado |
| :--- | :--- | :--- | :--- | :--- |
| **Capa 1** | Originales y Manifiesto | 3 archivos PDF originales + `manifiesto_originales.json` | 3 documentos oficiales (53.12 MB) con hash SHA-256 verificado | Pendiente de validación por experto |
| **Capa 2** | Texto Limpio por Página | 3 archivos JSON de texto por página + `manifiesto_texto.json` | 944 páginas con marcadores de página real (`-- X of Y --`) | Pendiente de validación por experto |
| **Capa 3** | Datos Estructurados | `curriculo_estructurado.json` + `manifiesto_estructurados.json` + `registro_problemas.json` | **78 registros estructurados válidos**, 6 omitidos por campos faltantes | Pendiente de validación por experto |
| **Capa 4** | Índice y Motor de Búsqueda | `indice_curriculo.json` + `manifiesto_indice.json` + `buscadorCurricular.js` | **998 fragmentos indexados** (78 matrices + 920 fragmentos de páginas) | Pendiente de validación por experto |
| **Capa 5** | Validador de Estructura | `validadorEstructura.js` | Valida 5 bloques obligatorios MINERD + sección Fuentes con página real | Operativo |
| **Novedades** | Detector de Integridad | `detectar_novedades_curriculo.js` + `registro_novedades.json` | 3 documentos verificados intactos, 0 alterados, 0 en cola | Operativo |

---

## 5. Ejemplo Real de Registro en Capa 3 (`curriculo_estructurado.json`)

```json
{
  "id": "matriz_lengua_secuencia_1_primero",
  "tipo": "matriz_secuencia_curricular",
  "institucion": "MINERD / CON BASE",
  "nivel": "primario",
  "grado": "1er grado",
  "area": "Lengua Española",
  "tema": "Secuencia 1: Tarjeta de identidad / Documento de identidad / Autobiografia",
  "bloque_guia": "Secuencia Didáctica 1",
  "documento_fuente": "Guía Didáctica de Lengua Española (MINERD / CON BASE)",
  "pagina_referencia": "63-64",
  "url_fuente": "https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo",
  "estado_validacion": "pendiente de validación por experto",
  "competencias_especificas": [
    "Comunicativa. Expresa y comprende, de forma oral y escrita en diferentes contextos,",
    "textos funcionales y literarios muy sencillos y de estructura sintáctica simple, mediante el uso de medios",
    "y recursos apropiados, demostrando avance progresivo en sus procesos de lectura y escritura."
  ],
  "contenidos": {
    "texto_original": "CONCEPTUALES PROCEDIMENTALES ACTITUDINALES Y VALORES\n• La tarjeta de identidad\n• Estructura (nombre y apellido).\n• Función del nombre propio.\n• Identificación de palabras que riman con los nombres.\n• Conteo de las sílabas, identificación de la sílaba inicial/final de los nombres...",
    "items": [
      "CONCEPTUALES PROCEDIMENTALES ACTITUDINALES Y VALORES",
      "La tarjeta de",
      "identidad",
      "Estructura (nombre y",
      "apellido).",
      "Función del nombre",
      "propio."
    ]
  },
  "indicadores_logro": [
    "Comunica sus ideas de forma oral y escrita, de acuerdo con sus conocimientos mediante un tipo de texto.",
    "Lee convencionalmente textos sencillos funcionales.",
    "Muestra respeto ante las opiniones de los demás.",
    "Expresa valores que lo identifican culturalmente, mediante textos sencillos que lee y escribe."
  ]
}
```

---

## 6. Niveles y Áreas Sin Cobertura Actual

1. **Nivel Inicial:** Completo (Maternal, Kínder, Pre-primario).
2. **Nivel Primario (Segundo Ciclo):** 4to, 5to y 6to Grado en todas las áreas.
3. **Nivel Secundario:** Completo (1ro a 6to de Secundaria en Modalidad General, Técnico Profesional y Artes).
4. **Áreas Curriculares del Primer Ciclo de Primaria:**
   - Ciencias de la Naturaleza
   - Ciencias Sociales
   - Educación Artística
   - Educación Física
   - Formación Integral Humana y Religiosa (FIHR)
   - Lenguas Extranjeras (Inglés y Francés)

---

## 7. Registro de Problemas e Incidencias en Estructuración (`registro_problemas.json`)

Para cumplir con la política estricta de no inventar datos ni rellenar huecos artificialmente, se evaluaron los campos obligatorios de cada candidato. Se descartaron 6 registros por carecer de campos requeridos en la fuente oficial, registrándose en `server/curriculo/capa3_estructurados/registro_problemas.json`:

1. `matriz_lengua_secuencia_5_segundo`: Descartado por faltar `pagina_referencia`, `competencias_especificas`, `contenidos` e `indicadores_logro` (en el documento fuente este bloque es texto orientativo didáctico y no una tabla de inserción curricular).
2. `matriz_lengua_secuencia_5_tercero`: Descartado por faltar `competencias_especificas`, `contenidos` e `indicadores_logro`.
3. `Guia_Didactica_LenguaEsp__Multigrado_WEB_pag_8`: Descartado por carecer de desglose de competencias e indicadores.
4. `Guia_Didactica_LenguaEsp__Multigrado_WEB_pag_20`: Descartado por carecer de desglose de competencias e indicadores.
5. `Guia_Matematica_WEB_pag_10`: Descartado por carecer de especificación de grado y contenidos formales.
6. `Guia_Multigrado_Matematicas_pag_10`: Descartado por carecer de competencias formales y contenidos.
