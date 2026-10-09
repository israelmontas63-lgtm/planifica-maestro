const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) results = results.concat(walk(full));
    else results.push(full);
  }
  return results;
}

const files = walk('client/dist');
console.log('Total files checked in client/dist:', files.length);

const patterns = ['service_role', 'sb_secret', 'sb_publishable', 'eyJhbGciOi'];
for (const f of files) {
  const content = fs.readFileSync(f, 'utf8');
  for (const p of patterns) {
    if (content.includes(p)) {
      console.log(`[COINCIDENCIA] Patrón: "${p}" en archivo: ${f}`);
      const idx = content.indexOf(p);
      const snippet = content.slice(Math.max(0, idx - 30), Math.min(content.length, idx + 80));
      // Enmascarar cualquier valor largo dejando solo 4 primeros y 4 últimos
      const masked = snippet.replace(/(sb_publishable_[A-Za-z0-9_-]{4})[A-Za-z0-9_-]+([A-Za-z0-9_-]{4})/g, '$1...$2')
                            .replace(/(eyJhbGciOi[A-Za-z0-9_-]{4})[A-Za-z0-9_-]+([A-Za-z0-9_-]{4})/g, '$1...$2');
      console.log('Contexto enmascarado:', masked);
    }
  }
}
