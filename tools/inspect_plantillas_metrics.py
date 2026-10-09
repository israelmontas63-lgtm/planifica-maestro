import os
import zipfile
import xml.etree.ElementTree as ET

WORKSPACE = r"c:\Users\Win10\Desktop\planifica maestro\planifica-maestro"
PLANTILLAS = [
    ("Lengua Española", os.path.join(WORKSPACE, "plantillas", "Planificacion_con_guias_Lengua_Española.docx")),
    ("Matemática", os.path.join(WORKSPACE, "plantillas", "Plan Guia Matematica.docx")),
    ("Esquema con Guías", os.path.join(WORKSPACE, "plantillas", "Esquema de planificacion con guias.docx"))
]

NAMESPACES = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}

def inspect_metrics(label, path):
    print(f"\n=======================================================")
    print(f"PLANTILLA: {label} ({os.path.basename(path)})")
    print(f"=======================================================")
    if not os.path.exists(path):
        print(f"ERROR: No existe {path}")
        return
    with zipfile.ZipFile(path, 'r') as z:
        xml_content = z.read('word/document.xml')
        root = ET.fromstring(xml_content)
        
        # 1. Margins
        pgMar = root.find('.//w:pgMar', NAMESPACES)
        if pgMar is not None:
            top = pgMar.attrib.get(f'{{{NAMESPACES["w"]}}}top')
            bottom = pgMar.attrib.get(f'{{{NAMESPACES["w"]}}}bottom')
            left = pgMar.attrib.get(f'{{{NAMESPACES["w"]}}}left')
            right = pgMar.attrib.get(f'{{{NAMESPACES["w"]}}}right')
            print(f"Márgenes (dxa): top={top}, bottom={bottom}, left={left}, right={right}")
            print(f"Márgenes (cm): top={int(top)/567:.2f}cm, bottom={int(bottom)/567:.2f}cm, left={int(left)/567:.2f}cm, right={int(right)/567:.2f}cm")

        # 2. Fonts
        rFonts = root.findall('.//w:rFonts', NAMESPACES)
        fonts = set()
        for rf in rFonts:
            ascii_f = rf.attrib.get(f'{{{NAMESPACES["w"]}}}ascii')
            hAnsi = rf.attrib.get(f'{{{NAMESPACES["w"]}}}hAnsi')
            if ascii_f: fonts.add(ascii_f)
            if hAnsi: fonts.add(hAnsi)
        print(f"Fuentes encontradas: {list(fonts)}")

        # 3. Tables & gridCols
        tables = root.findall('.//w:tbl', NAMESPACES)
        print(f"Número de tablas: {len(tables)}")
        for t_idx, tbl in enumerate(tables):
            gridCols = tbl.findall('.//w:tblGrid/w:gridCol', NAMESPACES)
            col_widths = [gc.attrib.get(f'{{{NAMESPACES["w"]}}}w') for gc in gridCols]
            rows = tbl.findall('./w:tr', NAMESPACES)
            print(f"  Tabla {t_idx+1}: {len(rows)} filas | Columnas grid: {col_widths}")
            # Cell widths in row 2 and moments header
            for r_idx, row in enumerate(rows):
                if r_idx in [0, 1, 2, 8, 9, 10]:
                    cells = row.findall('./w:tc', NAMESPACES)
                    tc_widths = []
                    for c in cells:
                        tcW = c.find('.//w:tcW', NAMESPACES)
                        w_val = tcW.attrib.get(f'{{{NAMESPACES["w"]}}}w') if tcW is not None else 'N/A'
                        tc_widths.append(w_val)
                    print(f"    Fila {r_idx+1} ({len(cells)} celdas): anchos tcW={tc_widths}")

for label, p in PLANTILLAS:
    inspect_metrics(label, p)
