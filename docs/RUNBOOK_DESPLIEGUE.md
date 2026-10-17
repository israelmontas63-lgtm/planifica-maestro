# RUNBOOK: Procedimiento de Despliegue (Staging y Producción)

Este documento describe la política y el protocolo estricto de despliegue para **Planifica Maestro**.

---

## ⚠️ Regla Inmutable de Operaciones
> **PROHIBIDO desplegar a producción sin la autorización explícita e inequívoca del Dueño.**
> Todo cambio debe verificarse previamente en local (`npm test`, `npm run guardia`) y opcionalmente en el entorno de `staging`.

---

## 1. Configuración de Secretos en Staging

Antes del primer despliegue a Staging, configura las credenciales requeridas en Cloudflare Workers:

```bash
# Clave del servidor de IA (Google Gemini)
npx wrangler secret put GEMINI_API_KEY --env staging

# Claves de conexión con Supabase (Currículo MINERD)
npx wrangler secret put SUPABASE_URL --env staging
npx wrangler secret put SUPABASE_ANON_KEY --env staging

# Clave de acceso institucional / de prueba
npx wrangler secret put APP_ACCESS_KEY --env staging
```

---

## 2. Compilación y Despliegue a Staging

El entorno de staging está definido en `wrangler.toml` bajo `[env.staging]` como `planifica-maestro-staging`.

1. Construir la aplicación cliente (PWA):
   ```bash
   npm run build
   ```

2. Ejecutar la guardia y las pruebas locales:
   ```bash
   npm test
   npm run guardia
   ```

3. Desplegar a Staging:
   ```bash
   npx wrangler deploy --env staging
   ```

---

## 3. Protocolo de Validación en Staging

Una vez desplegado en Staging:
1. Probar salud del endpoint:
   ```bash
   curl -s https://planifica-maestro-staging.<tu-subdominio>.workers.dev/api/health
   ```
2. Ejecutar el script de verificación con la URL de Staging:
   ```bash
   $env:VITE_API_URL = "https://planifica-maestro-staging.<tu-subdominio>.workers.dev"
   node scripts/verificar_cerebro.mjs --real
   ```
3. Verificar manualmente en navegador la instalación de la PWA y la respuesta del asistente pedagógico.

---

## 4. Despliegue a Producción (Solo con Aprobación del Dueño)

Cuando el Dueño emita la orden de despliegue:

```bash
# 1. Asegurar integridad 100% verde
npm run guardia

# 2. Desplegar worker y assets a producción
npx wrangler deploy
```
