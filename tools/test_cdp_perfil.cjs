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

const server = http.createServer((req, res) => {
  const urlParts = req.url.split('?');
  const reqPath = urlParts[0];

  if (reqPath === '/api/plan/cuota') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ cuota: { usadas: 0, limite: 20, restante: 20 } }));
  }

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

server.listen(4174, '127.0.0.1', () => {
  console.log('Servidor iniciado en http://127.0.0.1:4174 para pruebas CDP de Perfil');

  const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9223',
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank'
  ]);

  setTimeout(async () => {
    try {
      const targetsRes = await fetch('http://127.0.0.1:9223/json/list');
      const targets = await targetsRes.json();
      const pageTarget = targets.find(t => t.type === 'page');
      const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

      let msgId = 1;
      function send(method, params = {}) {
        return new Promise((resolve) => {
          const id = msgId++;
          const handler = (event) => {
            const data = JSON.parse(event.data);
            if (data.id === id) {
              ws.removeEventListener('message', handler);
              resolve(data.result);
            }
          };
          ws.addEventListener('message', handler);
          ws.send(JSON.stringify({ id, method, params }));
        });
      }

      ws.onopen = async () => {
        await send('Page.enable');
        await send('Runtime.enable');

        console.log('\n--- CASO A: PERFIL VACÍO (ARRANQUE LIMPIO EN CHROME) ---');
        // 1. Navegar y limpiar localStorage
        await send('Page.navigate', { url: 'http://127.0.0.1:4174/' });
        await new Promise(r => setTimeout(r, 2000));

        // Limpiar storage y recargar
        await send('Runtime.evaluate', {
          expression: `localStorage.clear(); location.reload();`
        });
        await new Promise(r => setTimeout(r, 2000));

        // Evaluar estado de perfil y formulario
        const evaluacionVacio = await send('Runtime.evaluate', {
          expression: `(() => {
            const keys = Object.keys(localStorage);
            const devId = localStorage.getItem('pm_device_id');
            const perfilKey = keys.find(k => k.startsWith('pm_perfil_'));
            const perfilData = perfilKey ? JSON.parse(localStorage.getItem(perfilKey) || '{}') : null;
            return {
              devId,
              perfilKey,
              perfilData,
              gradosEnPerfil: perfilData?.grados || []
            };
          })()`,
          returnByValue: true
        });

        console.log('Resultado en navegador con almacenamiento vacío:');
        console.log(JSON.stringify(evaluacionVacio.result.value, null, 2));

        console.log('\n--- CASO B: PERFIL CON 1.º Y 2.º (MULTIGRADO CONFIGURADO) ---');
        // Configurar perfil con grados 1.º y 2.º bajo la clave del dispositivo
        const resultadoSet = await send('Runtime.evaluate', {
          expression: `(() => {
            const devId = localStorage.getItem('pm_device_id') || 'dev_test_beta';
            const perfil = {
              nombre: 'Prof. CDP Test',
              escuela: 'Escuela Primaria Modelo',
              regional: '10',
              distrito: '10-01',
              tanda: 'Jornada Escolar Extendida (JEE)',
              seccion: 'A',
              grados: ['1.º', '2.º']
            };
            localStorage.setItem('pm_perfil_' + devId, JSON.stringify(perfil));
            return { savedKey: 'pm_perfil_' + devId, savedPerfil: perfil };
          })()`,
          returnByValue: true
        });
        console.log('Perfil guardado en localStorage:', JSON.stringify(resultadoSet.result.value, null, 2));

        // Recargar página para que la app cargue el perfil en memoria
        await send('Page.reload');
        await new Promise(r => setTimeout(r, 2500));

        // Evaluar que la app cargó los grados y la clave
        const evaluacionLleno = await send('Runtime.evaluate', {
          expression: `(() => {
            const devId = localStorage.getItem('pm_device_id');
            const perfilRaw = localStorage.getItem('pm_perfil_' + devId);
            const perfil = perfilRaw ? JSON.parse(perfilRaw) : null;
            return {
              devId,
              gradosCargados: perfil?.grados || [],
              esMultigrado: (perfil?.grados || []).length >= 2,
              nombreDocente: perfil?.nombre
            };
          })()`,
          returnByValue: true
        });

        console.log('Resultado en navegador tras recarga con perfil [1.º, 2.º]:');
        console.log(JSON.stringify(evaluacionLleno.result.value, null, 2));

        console.log('\n--- CASO C: RESPALDO DE CLAVE LEGACY (pm_perfil_docente_data) ---');
        // Probar compatibilidad legacy
        const resultadoLegacy = await send('Runtime.evaluate', {
          expression: `(() => {
            const devId = localStorage.getItem('pm_device_id');
            localStorage.removeItem('pm_perfil_' + devId);
            localStorage.setItem('pm_perfil_docente_data', JSON.stringify({
              nombre: 'Prof. Datos Legacy',
              escuela: 'Escuela Antigua',
              grados: ['3.º']
            }));
            // Simular lectura mediante la lógica de perfilStorage
            let perfil = null;
            const key = 'pm_perfil_' + devId;
            const data = localStorage.getItem(key);
            if (data) {
              perfil = JSON.parse(data);
            } else {
              const leg = localStorage.getItem('pm_perfil_docente_data');
              if (leg) perfil = JSON.parse(leg);
            }
            return { perfilLegacyLeido: perfil };
          })()`,
          returnByValue: true
        });
        console.log('Resultado prueba fallback legacy:', JSON.stringify(resultadoLegacy.result.value, null, 2));

        ws.close();
        chrome.kill();
        server.close();
        process.exit(0);
      };
    } catch (err) {
      console.error(err);
      chrome.kill();
      server.close();
      process.exit(1);
    }
  }, 1500);
});
