// Uso: node scripts/tabla_bateria.mjs antes.txt despues.txt  (las salidas de la batería guardadas como UTF-8)
import fs from 'node:fs';
const leer = (p) => {
  const m = new Map();
  let id = null;
  for (const l of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const a = /^=== \[([^\]]+)\]/.exec(l);
    if (a) id = a[1];
    const b = /^RESULTADO: (PASÓ|FALLÓ)/.exec(l);
    if (b && id) { m.set(id, b[1]); id = null; }
  }
  return m;
};
const [a, d] = [leer(process.argv[2]), leer(process.argv[3])];
console.log('id\tANTES\tDESPUÉS');
for (const id of new Set([...a.keys(), ...d.keys()])) console.log(`${id}\t${a.get(id) ?? '—'}\t${d.get(id) ?? '—'}`);
const cuenta = (m) => `${[...m.values()].filter((v) => v === 'PASÓ').length}/${m.size}`;
console.log(`ANTES ${cuenta(a)} · DESPUÉS ${cuenta(d)}`);
