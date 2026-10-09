import zipfile
import xml.etree.ElementTree as ET
import os
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

docx_path = "muestras_word/Muestra_CON_BASE_Multigrado_1erCiclo.docx"
print(f"=== Inspeccionando archivo: {docx_path} ===")

if not os.path.exists(docx_path):
    print("Error: archivo no encontrado")
    sys.exit(1)

with zipfile.ZipFile(docx_path, 'r') as z:
    xml_content = z.read('word/document.xml')
    tree = ET.fromstring(xml_content)
    ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}

    # 1. Verificar orientación y dimensiones de página
    sectPr = tree.find('.//w:sectPr', ns)
    pgSz = sectPr.find('w:pgSz', ns) if sectPr is not None else None
    pgMar = sectPr.find('w:pgMar', ns) if sectPr is not None else None

    orient = pgSz.attrib.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}orient') if pgSz is not None else None
    w = pgSz.attrib.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}w') if pgSz is not None else None
    h = pgSz.attrib.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}h') if pgSz is not None else None

    print(f"Orientacion: {orient} (Esperado: landscape)")
    print(f"Dimensiones: {w} x {h} dxa (Esperado: 16838 x 11906 dxa - A4 Horizontal)")

    # 2. Verificar celdas, colores y textos
    celdas_totales = 0
    celdas_vacias = 0
    errores_sanitizacion = []
    shading_colors = set()

    for tbl in tree.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}tbl'):
        for row in tbl.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}tr'):
            for tc in row.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}tc'):
                celdas_totales += 1
                
                # Check shading
                shd = tc.find('.//w:shd', ns)
                if shd is not None:
                    fill = shd.attrib.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}fill')
                    if fill:
                        shading_colors.add(fill.upper())

                # Check text
                textos = [t.text for t in tc.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t') if t.text]
                cell_text = "".join(textos).strip()
                if not cell_text:
                    celdas_vacias += 1
                if "undefined" in cell_text:
                    errores_sanitizacion.append(f"Celda con 'undefined': {cell_text[:50]}")
                if "null" in cell_text:
                    errores_sanitizacion.append(f"Celda con 'null': {cell_text[:50]}")
                if cell_text == "---":
                    errores_sanitizacion.append(f"Celda con '---'")
                if "&amp;" in cell_text:
                    errores_sanitizacion.append(f"Celda con '&amp;': {cell_text[:50]}")
                if "Ã" in cell_text or "ï¿½" in cell_text:
                    errores_sanitizacion.append(f"Celda con mojibake: {cell_text[:50]}")

    print(f"\nTotal celdas analizadas: {celdas_totales}")
    print(f"Celdas vacias: {celdas_vacias} (Esperado: 0)")
    print(f"Colores de sombreado detectados: {shading_colors} (Esperado: CDEEF6, NADA de F8FAFC)")
    print(f"Errores de sanitizacion: {len(errores_sanitizacion)}")

    if errores_sanitizacion:
        for err in errores_sanitizacion:
            print("  -", err)

    # 3. Extraer texto completo del documento
    print("\n" + "="*80)
    print("TEXTO COMPLETO EXTRAIDO DEL DOCUMENTO DE MUESTRA (DOCX):")
    print("="*80)
    for p in tree.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p'):
        textos = [t.text for t in p.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t') if t.text]
        pt = "".join(textos).strip()
        if pt:
            print(pt)
