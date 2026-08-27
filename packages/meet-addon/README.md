# Daily Race · Meet Add-on

Frontend Next.js que se incrusta en Google Meet como add-on de side panel y main stage. Consume el endpoint `GET /api/live-race/current` del backend de Daily Race vía polling cada 2.5s.

## Rutas

| Ruta | Para que sirve |
|---|---|
| `/` | Landing publica (no usada por Meet, marketing/dev) |
| `/sidepanel` | Side panel privado por participante. Estado IDLE / LIVE |
| `/mainstage` | Main stage compartido cuando alguien lanza la actividad |

## Desarrollo

```bash
cp .env.example .env.local
# Editar NEXT_PUBLIC_BACKEND_URL apuntando al backend
npm install
npm run dev
```

Next.js arranca en `https://localhost:3002` (HTTPS obligatorio para que Meet lo embeba en iframe). Acepta el certificado autofirmado en el browser la primera vez.

Para probar dentro de Meet: registra `https://localhost:3002` en `addOnOrigins` del manifest y haz un deployment de staging en Google Cloud Marketplace SDK.

## Build estatico

```bash
npm run build
```

Genera `out/` listo para servir en cualquier CDN (Vercel, Cloudflare Pages, GitHub Pages).

## Variables de entorno

| Variable | Para que |
|---|---|
| `NEXT_PUBLIC_BACKEND_URL` | URL del backend Daily Race (`http://localhost:3001` en dev) |
| `NEXT_PUBLIC_MEET_CLOUD_PROJECT_NUMBER` | Cloud Project Number del proyecto GCP donde esta registrado el Meet Add-on. Si esta vacio, la UI funciona pero no se conecta con el SDK de Meet (modo standalone) |
| `NEXT_PUBLIC_GIS_CLIENT_ID` | Client ID de Google Identity Services para One Tap (V2) |

Ver `docs/meet-addon-setup.md` para el setup completo en GCP + Marketplace.
