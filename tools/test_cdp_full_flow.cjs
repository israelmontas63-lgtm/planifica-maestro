const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

const distDir = path.resolve('client/dist');
const mimeTypes = {
  '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.woff2': 'font/woff2', '.woff': 'font/woff'
};

// Servidor que sirve los estáticos compilados de client/dist y atiende /api/ simulando el backend local
const server = http.createServer((req, res) => {
  const urlParts = req.url.split('?');
  const reqPath = urlParts[0];

  // Rutas de API
  if (reqPath === '/api/plan/cuota') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ cuota: { usadas: 0, limite: 20, restante: 20 } }));
  }

  if (reqPath === '/api/plan/generate' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        mensaje_chat: 'Planificación de prueba generada correctamente.',
        plan_completado: true,
        datos_planificacion: {
          area: 'Lengua Española',
          tema: 'El cuento infantil',
          actividades: 'Lectura y comprensión guiada'
        },
        cuota: { usadas: 1, limite: 20, restante: 19 }
      }));
    });
    return;
  }

  // Archivos estáticos SPA
  let filePath = path.join(distDir, reqPath === '/' ? 'index.html' : reqPath);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    fs.createReadStream(path.join(distDir, 'index.html')).pipe(res);
  }
});

server.listen(4173, '127.0.0.1', () => {
  console.log('Servidor de prueba iniciado en http://127.0.0.1:4173 (sirviendo client/dist + mock de API)');

  const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank'
  ]);

  setTimeout(async () => {
    try {
      const targetsRes = await fetch('http://127.0.0.1:9222/json/list');
      const targets = await targetsRes.json();
      const pageTarget = targets.find(t => t.type === 'page');
      const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

      const logsPorFase = {
        'FASE 1 (Carga Inicial)': [],
        'FASE 2 (Generación de Planificación)': [],
        'FASE 3 (Recarga de Página)': []
      };

      let faseActual = 'FASE 1 (Carga Inicial)';
      const responsesMap = new Map();

      ws.onopen = () => {
        ws.send(JSON.stringify({ id: 1, method: 'Network.enable' }));
        ws.send(JSON.stringify({ id: 2, method: 'Page.enable' }));
        ws.send(JSON.stringify({ id: 3, method: 'Runtime.enable' }));
        // Navegar explícitamente para registrar la Fase 1
        ws.send(JSON.stringify({ id: 4, method: 'Page.navigate', params: { url: 'http://127.0.0.1:4173/' } }));
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);

        if (msg.method === 'Network.responseReceived') {
          const reqId = msg.params.requestId;
          const status = msg.params.response.status;
          responsesMap.set(reqId, status);
        }

        if (msg.method === 'Network.requestWillBeSent') {
          const reqId = msg.params.requestId;
          const entry = {
            id: reqId,
            method: msg.params.request.method,
            url: msg.params.request.url,
            status: null
          };
          logsPorFase[faseActual].push(entry);
        }
      };

      // 1. Esperar fin de carga inicial
      setTimeout(() => {
        console.log('--- Iniciando FASE 2: Generación de Planificación ---');
        faseActual = 'FASE 2 (Generación de Planificación)';

        // Simular petición de generación en el contexto del navegador llamando a fetch a /api/plan/generate
        ws.send(JSON.stringify({
          id: 10,
          method: 'Runtime.evaluate',
          params: {
            expression: `fetch('/api/plan/generate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ prompt: 'Planifica Lengua Española 1ro y 2do' })
            }).then(r => r.json())`,
            awaitPromise: true
          }
        }));

        // 2. Esperar respuesta de generación y luego ejecutar FASE 3
        setTimeout(() => {
          console.log('--- Iniciando FASE 3: Recarga de Página ---');
          faseActual = 'FASE 3 (Recarga de Página)';
          ws.send(JSON.stringify({ id: 20, method: 'Page.reload' }));

          // 3. Esperar finalización de recarga y presentar reporte
          setTimeout(() => {
            console.log('\n========================================================================');
            console.log('REGISTRO DE RED REAL EN GOOGLE CHROME HEADLESS (CDP)');
            console.log('========================================================================\n');

            let totalSupabase = 0;

            for (const [fase, peticiones] of Object.entries(logsPorFase)) {
              console.log(`### ${fase}`);
              console.log(`Total peticiones en esta fase: ${peticiones.length}`);
              let sbFase = 0;

              peticiones.forEach((p, idx) => {
                const status = responsesMap.get(p.id) || '200 (en curso)';
                const esSupabase = p.url.includes('supabase.co');
                if (esSupabase) {
                  sbFase++;
                  totalSupabase++;
                }
                console.log(`  [${p.method}] HTTP ${status} | ${p.url}`);
              });

              console.log(`  -> Peticiones a *.supabase.co en ${fase}: ${sbFase}\n`);
            }

            console.log('========================================================================');
            console.log(`TOTAL GLOBAL PETICIONES A *.SUPABASE.CO: ${totalSupabase}`);
            console.log('========================================================================');

            ws.close();
            chrome.kill();
            server.close();
            process.exit(0);
          }, 3000);
        }, 3000);
      }, 3000);

    } catch (err) {
      console.error(err);
      chrome.kill();
      server.close();
      process.exit(1);
    }
  }, 1500);
});
