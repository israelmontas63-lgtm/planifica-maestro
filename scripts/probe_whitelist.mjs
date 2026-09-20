import fs from "node:fs";

const whitelist = [
  "https://ministeriodeeducacion.gob.do",
  "https://educando.edu.do",
  "https://mescyt.gob.do",
  "https://inafocam.edu.do",
  "https://isfodosu.edu.do",
  "https://ideice.gob.do",
  "https://inabima.gob.do",
  "https://siie.minerd.gob.do"
];

async function probeHosts() {
  const results = [];
  for (const host of whitelist) {
    try {
      const urlObj = new URL(host);
      const res = await fetch(host, {
        method: "HEAD",
        redirect: "follow",
        headers: { "User-Agent": "PlanificaMaestro-Bot/1.0" }
      });
      const finalUrl = new URL(res.url);
      const finalHost = finalUrl.hostname;
      
      // Comprobar si la redirección se mantiene dentro de la lista blanca o subdominios de ella
      const staysInWhitelist = whitelist.some(w => {
        const allowedHost = new URL(w).hostname;
        return finalHost === allowedHost || finalHost.endsWith("." + allowedHost) || allowedHost.endsWith("." + finalHost);
      });

      results.push({
        host,
        status: res.status,
        finalUrl: res.url,
        redirectHost: finalHost,
        staysInWhitelist
      });
    } catch (err) {
      results.push({
        host,
        status: "ERROR",
        error: err.message
      });
    }
  }
  console.log(JSON.stringify(results, null, 2));
}

probeHosts();
