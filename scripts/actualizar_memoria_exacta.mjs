import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(url, key);

async function main() {
  await supabase.from('docente_memoria_largo_plazo')
    .update({ valor: "Primaria Multigrado (1.º y 2.º grado, Primer Ciclo)", actualizado_en: new Date().toISOString() })
    .eq('clave', 'modalidad');

  await supabase.from('docente_memoria_largo_plazo')
    .update({ valor: "Adecuación Curricular MINERD (Ley 66-97) y Programa CON BASE", actualizado_en: new Date().toISOString() })
    .eq('clave', 'enfoque_oficial');

  const { data } = await supabase.from('docente_memoria_largo_plazo').select('*');
  console.log("ACTUALIZADO:", JSON.stringify(data, null, 2));
}

main();
