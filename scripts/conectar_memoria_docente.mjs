import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Faltan variables SUPABASE_URL o clave");
  process.exit(1);
}

const supabase = createClient(url, key);

const memoriaDocente = [
  {
    categoria: "perfil_docente",
    clave: "nombre_completo",
    valor: "Israel Montás"
  },
  {
    categoria: "centro_educativo",
    clave: "escuela",
    valor: "Escuela Primaria Batey Pinos"
  },
  {
    categoria: "contexto_aula",
    clave: "modalidad_grados",
    valor: "Primaria Multigrado (1.º y 2.º grado, Primer Ciclo)"
  },
  {
    categoria: "contexto_aula",
    clave: "duracion_bloque_minutos",
    valor: "45 minutos"
  },
  {
    categoria: "marco_curricular",
    clave: "enfoque_oficial",
    valor: "Adecuación Curricular MINERD (Ley 66-97) y Programa CON BASE"
  }
];

async function main() {
  console.log("Conectando con Supabase...");
  // Verificamos si la tabla tiene columna device_id o id o es global
  const { data: cols, error: errCols } = await supabase.from('docente_memoria_largo_plazo').select('*').limit(1);
  console.log("Muestra actual:", cols, "Error:", errCols);

  for (const item of memoriaDocente) {
    const payload = {
      categoria: item.categoria,
      clave: item.clave,
      valor: item.valor,
      updated_at: new Date().toISOString()
    };
    
    // Si la tabla requiere device_id:
    // payload.device_id = 'default';
    
    const { data, error } = await supabase
      .from('docente_memoria_largo_plazo')
      .upsert(payload, { onConflict: 'categoria,clave' });
      
    if (error) {
      console.warn(`Upsert con onConflict categoria,clave falló (${error.message}). Intentando insert/update...`);
      const { data: existing } = await supabase
        .from('docente_memoria_largo_plazo')
        .select('id')
        .eq('categoria', item.categoria)
        .eq('clave', item.clave)
        .maybeSingle();

      if (existing) {
        const { error: updErr } = await supabase
          .from('docente_memoria_largo_plazo')
          .update({ valor: item.valor, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
        console.log(`Actualizado ${item.clave}:`, !updErr ? "OK" : updErr.message);
      } else {
        const { error: insErr } = await supabase
          .from('docente_memoria_largo_plazo')
          .insert({ categoria: item.categoria, clave: item.clave, valor: item.valor });
        console.log(`Insertado ${item.clave}:`, !insErr ? "OK" : insErr.message);
      }
    } else {
      console.log(`Guardado OK: ${item.categoria} -> ${item.clave} = ${item.valor}`);
    }
  }

  const { data: finalData } = await supabase.from('docente_memoria_largo_plazo').select('*');
  console.log("\n--- ESTADO FINAL DE MEMORIA PERMANENTE DOCENTE ---");
  console.log(JSON.stringify(finalData, null, 2));
}

main().catch(err => {
  console.error("Error fatal:", err);
  process.exit(1);
});
