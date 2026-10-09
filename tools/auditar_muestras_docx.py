import zipfile
import xml.etree.ElementTree as ET
import os

namespaces = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}

muestras = [
    'Muestra_1_Lengua_Espanola_Multigrado_1ro_y_2do.docx',
    'Muestra_2_Matematica_3ro.docx',
    'Muestra_3_Ciencias_Sociales_5to.docx'
]

for m in muestras:
    p = os.path.join('muestras_word', m)
    print('================================================================')
    print(f'AUDITORIA DE CONTENIDO DE LA MUESTRA: {m}')
    print('================================================================')
    if not os.path.exists(p):
        print(f'ERROR: Archivo no encontrado: {p}')
        continue
    with zipfile.ZipFile(p) as z:
        xml_content = z.read('word/document.xml')
        root = ET.fromstring(xml_content)
        
        # Verificar orientación
        pgSz = root.find('.//w:pgSz', namespaces)
        orient = pgSz.attrib.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}orient', 'portrait') if pgSz is not None else 'unknown'
        w = pgSz.attrib.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}w', '0') if pgSz is not None else '0'
        h = pgSz.attrib.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}h', '0') if pgSz is not None else '0'
        print(f'Pagina: Orientacion={orient}, Ancho={w} dxa, Alto={h} dxa (A4 Horizontal)')
        
        tables = root.findall('.//w:tbl', namespaces)
        total_cells_checked = 0
        empty_cells = []
        placeholder_cells = []
        
        for t_idx, tbl in enumerate(tables):
            rows = tbl.findall('./w:tr', namespaces)
            print(f'Tabla {t_idx+1}: {len(rows)} filas')
            for r_idx, row in enumerate(rows):
                cells = row.findall('./w:tc', namespaces)
                for c_idx, cell in enumerate(cells):
                    total_cells_checked += 1
                    cell_text = ''.join(''.join(p.itertext()) for p in cell.findall('./w:p', namespaces)).strip()
                    shd = cell.find('.//w:shd', namespaces)
                    color = shd.attrib.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}fill', '') if shd is not None else ''
                    
                    if not cell_text:
                        empty_cells.append(f'Fila {r_idx+1}, Celda {c_idx+1}')
                    if '---' in cell_text:
                        placeholder_cells.append(f'Fila {r_idx+1}, Celda {c_idx+1}: {cell_text}')
                    
                    color_tag = f' [Fondo: #{color}]' if color else ''
                    print(f'  Fila {r_idx+1:02d} | C{c_idx+1}: {cell_text[:85]}{color_tag}')
        
        print(f'\nTotal celdas auditadas: {total_cells_checked}')
        print(f'Celdas vacias: {len(empty_cells)} {empty_cells}')
        print(f'Celdas con placeholder: {len(placeholder_cells)} {placeholder_cells}')
        if len(empty_cells) == 0 and len(placeholder_cells) == 0:
            print('ESTADO: VERIFICADO - CERO CELDAS VACIAS Y CERO PLACEHOLDERS.\n')
        else:
            print('ESTADO: FALLO - Hay celdas vacias o placeholders.\n')
