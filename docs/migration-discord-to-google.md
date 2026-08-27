# Migracion · Discord -> Google Workspace

Documento vivo del estado de la migracion desde notificaciones por Discord webhook a la combinacion **Google Chat App** (notificaciones) + **Google Meet Add-on** (vista live inmersiva dentro de Meet).

Diseno UX completo: `docs/ux-design-google.md`.
Setup tecnico paso a paso: `docs/google-chat-setup.md`, `docs/meet-addon-setup.md`.

## Estado actual

| Componente | Estado | Notas |
|---|---|---|
| Investigacion Cards V2 | ✅ | Hallazgos en docs/ux-design-google.md |
| Investigacion Meet Add-on SDK | ✅ | Hallazgos en docs/ux-design-google.md |
| Diseno UX Cards V2 | ✅ | Wireframes ASCII en design doc |
| Diseno UX Meet Add-on | ✅ | Wireframes side panel + main stage |
| Refactor formatter helpers | ✅ | infrastructure/formatting/ con utilidades reusables |
| GoogleChatModule + ChatAppAdapter | ✅ | Service Account + scope chat.bot, edita mensajes con cardsV2 |
| NotificationModule + Multicast | ✅ | switch por env, dual-write tolerante a fallos |
| Endpoint backend live-race | ✅ | GET /api/live-race/current con CORS configurable |
| Paquete meet-addon (Next.js 15) | ✅ | / · /sidepanel · /mainstage, build estatico, typecheck verde |
| Tests | ✅ | 155 tests passing en backend |
| Documentacion setup | ✅ | docs/google-chat-setup.md, docs/meet-addon-setup.md |
| Solicitud al admin · scope chat.bot | ⏳ | Pendiente |
| Solicitud al admin · verificacion dominio + Marketplace | ⏳ | Pendiente |
| Spaces de Chat (race-day, championship) | ⏳ | Pendiente |
| Deploy frontend meet-addon a dominio | ⏳ | Pendiente |
| Activar dual-write en produccion | ⏳ | Pendiente |
| Apagar Discord | ⏳ | Tras 2 semanas de dual sin issues |
| Limpieza modulo Discord | ⏳ | Tras apagado validado |

## Roadmap por fases

### Track 1 · Chat App (camino critico)

- **F0 · Solicitud al admin**: scope `chat.bot` para la SA actual + crear los 2 spaces (race-day, championship) + space de prueba.
  - Criterio de exito: la SA hace `POST` a un space de prueba via `curl` sin error.
- **F1 · Codigo mergeable inactivo**: ✅ COMPLETADO. Backend listo, tests verdes, produccion sigue con `NOTIFICATION_PROVIDER=discord`.
- **F2 · Dual-write a space de prueba**: 1-2 semanas con `NOTIFICATION_PROVIDER=dual` apuntando a un space del equipo tecnico.
  - Criterio: 5 dias laborables sin errores; live edit funciona; estetica F1 legible en mobile.
- **F3 · Dual-write a spaces reales del equipo**: 2-3 semanas con feedback del equipo.
  - Criterio: feedback positivo, cero peticiones de rollback.
- **F4 · Apagar Discord**: `NOTIFICATION_PROVIDER=google-chat`. Discord queda inactivo pero compilado para rollback inmediato.
  - Criterio: 2 semanas sin necesidad de rollback.
- **F5 · Limpieza**: eliminar `infrastructure/discord/`, `MulticastNotificationAdapter`, env vars obsoletas, GitHub Secrets.

### Track 2 · Meet Add-on (paralelo)

- **A0 · Verificacion dominio + Marketplace**: paralelo a F0, no bloquea Track 1.
- **A1 · Spike**: prototipo local en localhost dentro de Meet. ✅ COMPLETADO (frontend listo).
- **A2 · Endpoint backend**: ✅ COMPLETADO (`GET /api/live-race/current`).
- **A3 · MVP funcional**: deploy del frontend a `daily-race.secture.com`, install en cuentas de prueba.
  - Criterio: dos personas en una llamada de Meet ven el grid actualizandose.
- **A4 · Publicacion privada**: visibility Private en Marketplace, admin instala para todo el dominio.
  - Criterio: cualquier `@secture.com` ve "Daily Race" en Activities -> Add-ons.
- **A5 · Pulido (opcional)**: One Tap para identidad del usuario, animaciones podio, main stage anyadido al podio final.

## Conmutacion sin downtime

```
NOTIFICATION_PROVIDER=discord       (default actual, F0-F1)
                  ↓
NOTIFICATION_PROVIDER=dual          (F2-F3, ambos a la vez)
                  ↓
NOTIFICATION_PROVIDER=google-chat   (F4, Discord queda compilado pero inactivo)
```

Cambio entre fases:
- Editar `.env` en `/srv/www/daily-race/` del servidor.
- `make restart`.
- Sin redeploy. Rollback inmediato cambiando la variable + restart.

## Riesgos abiertos

| Riesgo | Mitigacion |
|---|---|
| Admin tarda en autorizar `chat.bot` | F0 lanzado el dia 1; F1 puede mergearse igualmente con producción inactiva |
| Admin tarda en verificar dominio Marketplace | No bloquea Track 1; A4 espera sin urgencia |
| Renderizado monospace inconsistente en Chat mobile | Validado: el formatter usa `decoratedText` por fila, NO bloques monospace |
| Render mobile distinto de desktop | Validar visualmente en F2 y ajustar `truncateName` si los nombres se cortan |

## Cronologia

- **2026-04-28** Plan creado, codigo backend + frontend escrito y probado, tests verdes (155).
- **TBD** Solicitud al admin lanzada (Track 1 F0 + Track 2 A0).
- **TBD** Activacion `dual` en prod (Track 1 F2).
- **TBD** Apagado Discord (Track 1 F4).
- **TBD** Add-on disponible en Meet (Track 2 A4).

## Referencias

- `docs/ux-design-google.md` · sistema de diseño y wireframes.
- `docs/google-chat-setup.md` · setup paso a paso de la Chat App.
- `docs/meet-addon-setup.md` · setup paso a paso del Meet Add-on.
