# Daily Race · Sistema de diseño para Google Workspace

Documento maestro de diseño para la migración de Daily Race a Google Chat (Cards V2) y Google Meet (Add-on SDK). Define el sistema visual, los layouts y la arquitectura de la experiencia para ambas superficies, manteniendo coherencia con la identidad F1 ya consolidada.

> Este documento es la guía conjunta que firma diseñador y programador. Cada decisión está justificada contra las limitaciones reales investigadas (Cards V2 reference, Meet Add-on SDK 1.2.0).

---

## 1. Principios de diseño

1. **F1 ante todo**. La metáfora es coherente: parrilla, semáforo, podio, vuelta, busted. La estética debe transmitir velocidad, precisión, pista. Ninguna decisión visual contradice la metáfora.
2. **Mobile-first en Chat**. Cards V2 colapsa columnas <=480px y rompe la alineación monospace en Android. Diseñamos para vertical, monoespaciado opcional, no estructural.
3. **Information density con jerarquía**. La parrilla muestra mucho dato por fila pero con una jerarquía clarísima: posición → nombre → puntos → diff. El ojo encuentra al ganador en <1 segundo.
4. **Live ≠ Final ≠ Championship**. Cada estado tiene un código de color, un emoji marcador y un tono distintos. El usuario no debe poder confundirlos ni en mobile reducido.
5. **Acciones, nunca decoración**. Cada botón tiene una intención (abrir championship, ver historial, compartir en main stage). No hay botones de adorno.
6. **Coherencia entre Chat y Meet**. La parrilla en el side panel del Meet Add-on debe parecer la misma parrilla que el usuario ve en Chat, solo adaptada al canal. Mismas tipografías, mismos colores, mismos iconos.

---

## 2. Sistema visual unificado

### 2.1 Paleta de color (F1 oficial-inspired)

```
Identidad
─────────
Live · rojo Ferrari        #E10600   (era 0xe74c3c — más auténtico F1)
Race · azul pista          #0066CC   (era 0x3498db — Williams blue)
Championship · oro         #FFD700   (igual que actual)

Posiciones
──────────
Oro · podio P1             #FFD700
Plata · podio P2           #C0C0C0
Bronce · podio P3          #CD7F32
Busted · negro asfalto     #1C1C1E
False start · gris alarma  #FF6B35
Rezagado · ámbar           #FFB300

Surfaces (Meet Add-on)
──────────────────────
Background asfalto         #15151E   (negro pista F1)
Surface card               #1E1E2E
Surface elevada            #2A2A3E
Border sutil               #383850

Texto
─────
Primary                    #FFFFFF
Secondary                  #B8BAC9
Tertiary / disabled        #6E708A
Diff positivo (tarde)      #FF6B35   (entrada tardía)
Diff negativo (false)      #FF3030   (false start)
Points positivo            #2ECC71
Points negativo            #E74C3C
```

### 2.2 Tipografía

| Rol | Familia | Uso |
|---|---|---|
| Display | **Titillium Web** 700 | Títulos grandes en Meet main stage, logo "DAILY RACE" |
| UI | **Inter** 400/500/600 | Side panel, labels, body |
| Mono | **JetBrains Mono** 500 | Tiempos, diffs, números (kerning consistente) |

En Cards V2 no se puede importar fuente custom (renderiza con la del cliente Chat). Usamos Material/Roboto por defecto y reforzamos jerarquía con tamaños relativos en HTML (`<b>`, `<font color>`). En el Meet Add-on (web propia) sí cargamos las tres.

### 2.3 Iconografía

**Emojis Unicode (mantener, ya consolidados)**:
- 🏁 Bandera a cuadros · race header
- 🏆 🥈 🥉 · podios P1 / P2 / P3
- 🐢 · rezagado (último 10%)
- 💀 · busted (peor del día)
- 🚫 · false start no busted
- 🚥 · semáforo (green light)
- 🏎️ · contador de pilotos
- 🚨 · contador de false starts
- 🔴 · marcador EN DIRECTO
- 🏆 · championship

**Material Icons (Cards V2 + Meet Add-on)**:
- `emoji_events` · trofeo (header de podio)
- `military_tech` · medalla (podio individual)
- `speed` · velocímetro (live)
- `flag` · meta (race finalizada)
- `timer` · cronómetro (tiempo total)
- `trending_up` / `trending_down` · subió o bajó posición vs ayer
- `bolt` · pole
- `warning` · false starts
- `looks_one ... looks_6` + `filter_7 ... filter_9` · dígitos circulares para posiciones
- `sentiment_very_dissatisfied` · busted (alternativo a 💀)

**Avatares**:
- Si `driver.email` está disponible y la app tiene scope para Google People API → foto Google.
- Fallback: avatar generado con iniciales sobre fondo HSL determinista del hash del email/displayName. SVG inline, 64x64 PNG/CIRCLE.

### 2.4 Espaciado y radios

```
Spacing  · 4 / 8 / 12 / 16 / 24 / 32 / 48
Radius   · sm 4px · md 8px · lg 16px · pill 999px
```

---

## 3. Google Chat · Cards V2

### 3.1 Arquitectura de cada estado

Tres tipos de mensaje, cada uno con su semántica visual y comportamiento:

| Estado | Color tema | Trigger | Operación API |
|---|---|---|---|
| **Live Race** | rojo `#E10600` | scheduler detecta meeting activo, edita cada 5s mientras dura | `messages.create` + `messages.patch` con `updateMask=cardsV2,text` |
| **Race finalizada** | azul `#0066CC` | meeting termina (o batch de carrera pasada) | edita el live message a estado FINAL (mismo messageId) o nuevo `messages.create` |
| **Championship** | oro `#FFD700` | tras cada finalización + on-demand (CLI) | siempre `messages.create` (mensaje nuevo en space distinto) |

### 3.2 Live Race · estructura completa de la card

```
┌────────────────────────────────────────────────────────┐
│  [logo F1 circular]                                    │
│  EN DIRECTO · Daily Race                               │
│  lunes 28 de abril · 09:30:15                          │
├────────────────────────────────────────────────────────┤
│ SECTION 1 · Resumen (siempre visible)                  │
│                                                        │
│  ⛳  GREEN LIGHT       09:30:00                         │
│  🏎️  PARTICIPANTES    5                               │
│  🚨  SALIDAS EN FALSO 1                                │
├────────────────────────────────────────────────────────┤
│ SECTION 2 · Podio (grid widget, solo top 3)            │
│                                                        │
│   ┌────────┐ ┌────────┐ ┌────────┐                    │
│   │ [foto] │ │ [foto] │ │ [foto] │                    │
│   │ ALICE  │ │  BOB   │ │CHARLIE │                    │
│   │ 1🏆 25 │ │ 2🥈 18 │ │ 3🥉 15 │                    │
│   │ +1.234 │ │ +3.100 │ │ +5.000 │                    │
│   └────────┘ └────────┘ └────────┘                    │
├────────────────────────────────────────────────────────┤
│ SECTION 3 · Parrilla (decoratedText por fila)          │
│   ───────                                              │
│   colapsable: visible top 3 + busted siempre          │
│                                                        │
│   1🏆  Alice          25 pts        +1.234 ↑          │
│   2🥈  Bob            18 pts        +3.100 ↑          │
│   3🥉  Charlie        15 pts        +5.000 →          │
│   ────────  Show more (2) ────────                    │
│   4   Diana           12 pts        +6.500 ↓          │
│   18💀 Eve (FS)       -5 pts       -15.000 ↓          │
├────────────────────────────────────────────────────────┤
│ SECTION 4 · Stats                                      │
│   💀 Busted · Eve  ·  −15.000s                         │
│   🚥 Pole · Alice  ·  +1.234s del verde                │
├────────────────────────────────────────────────────────┤
│ SECTION 5 · Footer (mini, pegado abajo)                │
│                                                        │
│   <font size="-1" color="#6E708A">                     │
│   Daily Race · Secture · Actualizado 09:30:42 🔴       │
│   </font>                                              │
└────────────────────────────────────────────────────────┘
```

#### JSON anotado del live card (esqueleto)

```jsonc
{
  "header": {
    "title": "<font color=\"#E10600\"><b>EN DIRECTO</b></font> · Daily Race",
    "subtitle": "lunes 28 de abril · 09:30:15",
    "imageUrl": "https://daily-race.secture.com/assets/f1-live.png",
    "imageType": "CIRCLE",
    "imageAltText": "Daily Race en directo"
  },
  "sectionDividerStyle": "SOLID_DIVIDER",
  "sections": [
    {
      "header": "RESUMEN",
      "widgets": [
        {
          "decoratedText": {
            "topLabel": "GREEN LIGHT",
            "text": "<b>09:30:00</b>",
            "startIcon": { "materialIcon": { "name": "traffic", "weight": 500 } }
          }
        },
        {
          "decoratedText": {
            "topLabel": "PARTICIPANTES",
            "text": "<b>5</b>",
            "startIcon": { "materialIcon": { "name": "directions_car", "weight": 500 } }
          }
        },
        {
          "decoratedText": {
            "topLabel": "SALIDAS EN FALSO",
            "text": "<b><font color=\"#FF6B35\">1</font></b>",
            "startIcon": { "materialIcon": { "name": "warning", "weight": 500 } }
          }
        }
      ]
    },
    {
      "header": "PODIO",
      "widgets": [
        {
          "grid": {
            "columnCount": 3,
            "borderStyle": { "type": "NO_BORDER" },
            "items": [
              {
                "title": "Alice",
                "subtitle": "🏆 25 pts · +1.234s",
                "image": {
                  "imageUri": "https://daily-race.secture.com/avatar/alice.png",
                  "altText": "Alice",
                  "cropStyle": { "type": "CIRCLE" }
                },
                "layout": "TEXT_BELOW"
              },
              { /* Bob */ },
              { /* Charlie */ }
            ]
          }
        }
      ]
    },
    {
      "header": "PARRILLA",
      "collapsible": true,
      "uncollapsibleWidgetsCount": 4,
      "widgets": [
        {
          "decoratedText": {
            "startIcon": { "materialIcon": { "name": "looks_one", "weight": 700, "fill": 1 } },
            "topLabel": "<font color=\"#2ECC71\"><b>+25 pts</b></font>",
            "text": "<b>Alice</b>",
            "bottomLabel": "+1.234s desde green",
            "endIcon": { "materialIcon": { "name": "trending_up" } }
          }
        }
        // ... resto de pilotos
      ]
    },
    {
      "header": "ESTADÍSTICAS",
      "widgets": [
        {
          "decoratedText": {
            "startIcon": { "materialIcon": { "name": "sentiment_very_dissatisfied" } },
            "topLabel": "BUSTED",
            "text": "<b>Eve</b>",
            "bottomLabel": "−15.000s del green light"
          }
        },
        {
          "decoratedText": {
            "startIcon": { "materialIcon": { "name": "bolt" } },
            "topLabel": "POLE",
            "text": "<b>Alice</b>",
            "bottomLabel": "+1.234s · puntual"
          }
        }
      ]
    },
    {
      "widgets": [
        {
          "textParagraph": {
            "text": "<font color=\"#6E708A\">Daily Race · Secture · Actualizado 09:30:42 🔴 EN DIRECTO</font>"
          }
        }
      ]
    }
  ]
}
```

#### Decisiones clave Live Race

- **Header con imagen circular F1**. Logo único reutilizable en todas las cards (un PNG 256×256 alojado en el frontend del proyecto).
- **Ningún bloque monospace para la tabla principal**. Eliminado el patrón Discord porque rompe en Android. Cada fila es un `decoratedText`.
- **Sección PODIO con `grid` de 3 items**. Top 3 con avatar circular, nombre, puntos, diff. Layout `TEXT_BELOW`. Si `grid.length < 3`, se muestra solo lo disponible.
- **Sección PARRILLA colapsable**. `uncollapsibleWidgetsCount: 4` para ver siempre top 3 + busted. El resto detrás de "Show more". Esto cumple el límite de 100 widgets aunque haya 25 pilotos.
- **Color condicional en topLabel**:
  - Puntos positivos: `<font color="#2ECC71">+25 pts</font>`
  - Puntos negativos (false start): `<font color="#E74C3C">−5 pts</font>`
  - Diff positivo (tardío): `<font color="#FF6B35">`
- **endIcon trending**:
  - `trending_up` si su diff vs ayer mejoró (cuando tengamos championship histórico).
  - `trending_down` si empeoró.
  - `trending_flat` (alias `→`) si es su primer día.
  - V1 lo dejamos sin endIcon hasta tener el cálculo histórico; lo añadimos en iteración posterior.
- **Footer simulado** con un `textParagraph` final en color secundario y emoji 🔴 que indica "vivo".
- **Fila Busted siempre visible**: si la fila busted no entra en el top 4, hacemos un truco — dentro de `widgets` ponemos primero las primeras 3 + busted y después el resto colapsado.

### 3.3 Race finalizada · estructura

Mismo layout que Live, con estos cambios:

- Header: title `<b>DAILY RACE</b>` (sin "EN DIRECTO"), color azul `#0066CC` en lugar de rojo.
- Imagen circular: `f1-final.png` (bandera a cuadros).
- Footer: emoji 🏁 en lugar de 🔴, y texto "Carrera finalizada".
- Section ESTADÍSTICAS expandida: añade "Mejor entrada", "Mayor remontada vs día anterior" si tenemos histórico.
- **buttonList al final** con dos botones (`type: FILLED`, color hex F1):
  - `Ver mi carrera` → `openLink` al frontend `/me/races/{raceId}` (cuando exista). V1 deshabilitado.
  - `Ver clasificación` → `openLink` al frontend `/championship`. V1 oculto si no hay frontend.

### 3.4 Championship · estructura

```
┌────────────────────────────────────────────────────────┐
│  [trofeo dorado circular]                              │
│  CHAMPIONSHIP · 28 de abril                            │
│  10 carreras · 15 pilotos                              │
├────────────────────────────────────────────────────────┤
│ SECTION 1 · Top 3 (grid widget)                        │
│                                                        │
│   ┌────────┐ ┌────────┐ ┌────────┐                    │
│   │ [foto] │ │ [foto] │ │ [foto] │                    │
│   │ ALICE  │ │  BOB   │ │CHARLIE │                    │
│   │290 pts │ │250 pts │ │210 pts │                    │
│   │1W · 3🏆│ │0W · 2🏆│ │0W · 2🏆│                    │
│   └────────┘ └────────┘ └────────┘                    │
├────────────────────────────────────────────────────────┤
│ SECTION 2 · Clasificación completa                     │
│   colapsable: top 5 visibles                           │
│                                                        │
│   1🏆  Alice          290 pts                          │
│        ▸ 10 GP · 1 W · 3 podios                       │
│                                                        │
│   2🥈  Bob            250 pts                          │
│        ▸ 10 GP · 0 W · 2 podios                       │
│                                                        │
│   3🥉  Charlie        210 pts                          │
│        ▸ 10 GP · 0 W · 2 podios                       │
│   ────────  Show more (12) ────────                   │
│   ...                                                  │
├────────────────────────────────────────────────────────┤
│ SECTION 3 · Leyenda (colapsable, oculta default)       │
│   GP grandes premios · W victorias · PD podios         │
├────────────────────────────────────────────────────────┤
│ SECTION 4 · Footer                                     │
│   Daily Race · Secture · Championship                  │
└────────────────────────────────────────────────────────┘
```

Decisiones:
- **`bottomLabel` con leyenda inline**: en vez de tener una columna GP/W/PD difícil de alinear, cada fila tiene `text` con nombre y `bottomLabel` con "10 GP · 1 W · 3 podios". Más legible en mobile.
- **Sección leyenda colapsable** (`uncollapsibleWidgetsCount: 0`): nadie la mira el segundo día, pero está disponible.
- **Si standings.length > 20**: cortamos visualmente a top 20 con un "Ver clasificación completa" → openLink al frontend (V1 sin frontend, mostramos los 20 sin botón).

### 3.5 Reglas de implementación Cards V2

- **Tamaño total < 25KB** (margen del cap 32KB).
- **Total widgets < 80** (margen del cap 100). Si standings o grid superan, partir en 2 mensajes consecutivos con delay 1.1s (rate limit Chat: 1 req/s/space).
- **Truncar nombres a 26 chars** (más holgura que Discord porque las filas no son monoespaciadas pero los avatares + texto requieren brevedad).
- **Avatares**: PNG 128×128 servidos por el frontend con `Cache-Control: public, max-age=86400`. Cuando el frontend no exista (V1), usar avatar SVG generado embebido como data URI o una URL pública con CDN-friendly. Workaround V1: Material Icon `account_circle` como `startIcon` del decoratedText hasta tener avatares reales.
- **Mensaje de fallback en `text`**: junto al `cardsV2`, mandar siempre un `text` plano resumen ("Alice gana la Daily Race del 28 abril con 25 puntos") para clientes que no soporten cards (notification preview, smartwatch).

---

## 4. Google Meet Add-on

### 4.1 Arquitectura general

Dos superficies, una experiencia:

```
   Daily Race Meet Add-on
   ───────────────────────
   ┌─────────────────────────────────────────────────────┐
   │  Meet ventana                                       │
   │                                                     │
   │  ┌───────────────────────────────┐  ┌────────────┐ │
   │  │                               │  │            │ │
   │  │   MAIN STAGE                  │  │   SIDE     │ │
   │  │   (compartido entre todos     │  │   PANEL    │ │
   │  │    los que aceptan activity)  │  │            │ │
   │  │                               │  │  (privado  │ │
   │  │   - Parrilla F1 panorámica    │  │   por      │ │
   │  │   - Podio animado             │  │   usuario) │ │
   │  │   - Marcador grande           │  │            │ │
   │  │                               │  │  - Tu      │ │
   │  │                               │  │    posic.  │ │
   │  │                               │  │  - Lista   │ │
   │  │                               │  │  - Acción  │ │
   │  │                               │  │    "lanzar │ │
   │  │                               │  │     a main │ │
   │  │                               │  │     stage" │ │
   │  └───────────────────────────────┘  └────────────┘ │
   └─────────────────────────────────────────────────────┘
```

**Side panel**: privado, "tu copiloto". Cada usuario ve el panel cuando lo abre. No requiere coordinación.

**Main stage**: compartido. Solo aparece cuando alguien hace `startActivity()`. Todos los participantes que aceptan ven la misma página.

**Estado vivo**: viene del backend Daily Race vía polling REST cada 2.5s. El SDK no provee sync entre participantes (Co-Doing API cerrada a nuevos signups).

**Identidad del usuario**: el SDK NO da email/displayName. Resolvemos con Google Identity Services (One Tap) dentro del iframe — los usuarios `@secture.com` ya están logueados, no hay fricción.

### 4.2 Estados del side panel

#### Estado A · Idle / fuera de horario
> Antes de las 9:25 o después de las 11:00, sin daily detectada.

```
┌──────────────────────────────────┐
│  [logo F1]                       │
│  Daily Race                      │
│                                  │
│  ───────────                     │
│                                  │
│   Próxima daily                  │
│   ┌─────────────────────────┐   │
│   │   ⏱  09:30 mañana        │   │
│   │   Lunes 28 abr           │   │
│   └─────────────────────────┘   │
│                                  │
│   ÚLTIMA CARRERA                 │
│   Viernes 25 abr · Alice 🏆      │
│   25 pts · +1.234s               │
│                                  │
│   [ Ver championship ]           │
│                                  │
└──────────────────────────────────┘
```

#### Estado B · Pre-race (esperando green light)
> Entre 09:25 y green light, daily detectada pero no empezada.

```
┌──────────────────────────────────┐
│  ⏱  GREEN LIGHT EN                │
│                                  │
│       0 0 : 0 2 : 1 5            │
│       (countdown gigante)        │
│                                  │
│  Lunes 28 abr · 09:30:00         │
│  ───────────                     │
│                                  │
│   PILOTOS YA EN PISTA   3/?      │
│   ●  Alice                       │
│   ●  Bob                         │
│   ●  Charlie                     │
│                                  │
│  ────────────                    │
│   ⚠️  Si entras antes del         │
│      semáforo, false start       │
│                                  │
└──────────────────────────────────┘
```

#### Estado C · Live (durante la daily)
> Después del green light, mientras la reunión esté activa.

```
┌──────────────────────────────────┐
│  🔴 EN DIRECTO    09:31:42       │
│  Daily Race · 28 abr             │
│  ───────────                     │
│                                  │
│  ┌────────────────────────────┐  │
│  │  TU POSICIÓN               │  │
│  │                            │  │
│  │  ┌──┐                      │  │
│  │  │ 4│  Sergio              │  │
│  │  └──┘                      │  │
│  │  +6.500s · 12 pts          │  │
│  │  ▲ 2 vs media              │  │
│  └────────────────────────────┘  │
│                                  │
│   PARRILLA                       │
│  ──────────                      │
│   1🏆  Alice         +1.234 ─ 25│
│   2🥈  Bob           +3.100 ─ 18│
│   3🥉  Charlie       +5.000 ─ 15│
│  ▌4    Sergio        +6.500 ─ 12│  ← tú resaltado
│   5    Diana         +8.000 ─ 10│
│   ...                            │
│  18💀  Eve   (FS)   -15.000 ─ -5│
│                                  │
│  [ 📺 Compartir en pantalla       │
│       principal ]                 │
└──────────────────────────────────┘
```

#### Estado D · Post-race (carrera finalizada)
> En cuanto la reunión termina y se procesa.

```
┌──────────────────────────────────┐
│  🏁 FINAL                         │
│  Daily Race · 28 abr             │
│  ───────────                     │
│                                  │
│  ┌────────────────────────────┐  │
│  │  TU RESULTADO              │  │
│  │  Sergio · P4 · 12 pts      │  │
│  │  ▲ subes al P3 del champ.  │  │
│  └────────────────────────────┘  │
│                                  │
│   PODIO                          │
│   🥇 Alice    25  +1.234         │
│   🥈 Bob      18  +3.100         │
│   🥉 Charlie  15  +5.000         │
│                                  │
│   STATS                          │
│   💀 Busted · Eve · −15.000      │
│   🚥 Pole · Alice · +1.234       │
│                                  │
│  [ Ver championship ]            │
│  [ Mi historial ]                │
└──────────────────────────────────┘
```

### 4.3 Estados del main stage

#### Estado A · Pre-race (countdown shared)
> Activado vía `startActivity()` antes del green light.

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│                                                          │
│              GREEN LIGHT EN                              │
│                                                          │
│            ╔══════════════════╗                          │
│            ║                  ║                          │
│            ║   00:02:15       ║                          │
│            ║                  ║                          │
│            ╚══════════════════╝                          │
│                                                          │
│            Lunes 28 abr · 09:30:00                       │
│                                                          │
│     ●●●  3 pilotos ya en pista                           │
│                                                          │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

#### Estado B · Live (during the race)
> Durante la daily, después del green light.

```
┌────────────────────────────────────────────────────────────────────┐
│  🔴 EN DIRECTO         DAILY RACE         09:31:42                  │
│                        28 abr 2026                                  │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│   PARRILLA                              │  PODIO PROVISIONAL       │
│   ─────────                             │  ───────────────         │
│                                         │                          │
│   ┌──┐                                  │     ┌────────┐          │
│   │ 1│ ALICE          +1.234s    25 pts │     │   2🥈  │          │
│   ├──┤                                  │  ┌──┴────────┴──┐       │
│   │ 2│ BOB            +3.100s    18 pts │  │   1🏆 ALICE  │       │
│   ├──┤                                  │  │              │       │
│   │ 3│ CHARLIE        +5.000s    15 pts │  │   25 pts     │       │
│   ├──┤                                  │  │   +1.234s    │       │
│   │ 4│ SERGIO         +6.500s    12 pts │  └──────────────┘       │
│   ├──┤                                  │     ┌────────┐          │
│   │ 5│ DIANA          +8.000s    10 pts │     │   3🥉  │          │
│   ├──┤                                  │     └────────┘          │
│   │..│                                  │                          │
│   ├──┤                                  │  STATS                  │
│   │18│ EVE (FS)      -15.000s    -5 pts│  💀 Eve −15.000s         │
│   └──┘                                  │  🚥 Alice +1.234s        │
│                                         │  🏎️  18 pilotos          │
│   18 pilotos · 1 false start            │  🚨 1 false start        │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

#### Estado C · Final (podio animado)
> Tras el cierre de la reunión.

```
┌────────────────────────────────────────────────────────────────────┐
│                                                                    │
│                       🏁  DAILY RACE  🏁                            │
│                       Lunes 28 abr 2026                            │
│                                                                    │
│                                                                    │
│                          🏆                                         │
│                       ╔═════╗                                      │
│                       ║  1  ║                                      │
│                       ║     ║                                      │
│                ╔═════╗║ALICE║╔═════╗                              │
│                ║  2  ║╚═════╝║  3  ║                              │
│                ║ BOB ║       ║CHAR.║                              │
│                ╚═════╝       ╚═════╝                              │
│                                                                    │
│                                                                    │
│             [ Cerrar ]   [ Ver clasificación ]                     │
└────────────────────────────────────────────────────────────────────┘
```

### 4.4 Decisiones clave Meet Add-on

- **Side panel siempre disponible** (`getFrameOpenReason: OPEN_ADDON`). Cada usuario abre cuando quiere su panel personal.
- **Main stage solo on-demand**. Si alguien quiere "broadcast" el grid, pulsa "Compartir en pantalla principal" en el side panel → `startActivity({ mainStageUrl, additionalData: JSON.stringify({raceId, greenLight}) })`.
- **Frame-to-frame messaging**: usado solo para reflejar **filtros personales** del usuario en su propio main stage (ej. modo claro/oscuro toggle, resaltar a un piloto). NO sincroniza entre usuarios.
- **Polling 2.5s** al backend (`GET /api/live-race/current`). Cuando la respuesta dice `status: 'IDLE'`, el panel muestra estado A. Cuando dice `LIVE`, estado C. Etc.
- **Identidad del usuario** vía Google Identity Services. Para resaltar "tu fila" en la parrilla y mostrar "tu posición" arriba.
- **Animaciones moderadas**: transición al cambiar posición (200ms ease-in-out), pulse en green light (2s), confeti CSS solo al cargar estado FINAL en main stage. Sin overflow.
- **Dark mode default**: el background del Meet ya es oscuro. Nuestra paleta `#15151E` armoniza.
- **Responsive**: el side panel se diseña para 320px efectivos (mobile-safe). El main stage para 1280px+ pero con grid CSS que escala.
- **Logo PNG 256×256 sin padding**, dark/light variant.

### 4.5 Estructura de rutas del paquete `meet-addon`

```
packages/meet-addon/
├── app/
│   ├── layout.tsx           # Provider del Meet SDK + temas + One Tap
│   ├── page.tsx             # / · landing pública (no usada por Meet, marketing)
│   ├── sidepanel/
│   │   └── page.tsx         # /sidepanel · entrada del side panel
│   ├── mainstage/
│   │   └── page.tsx         # /mainstage · entrada del main stage
│   └── api/                 # opcional: proxy al backend para CORS
├── lib/
│   ├── meet-sdk.ts          # wrapper sobre @googleworkspace/meet-addons
│   ├── api-client.ts        # cliente del endpoint /api/live-race/current
│   ├── auth.ts              # Google Identity Services
│   └── theme.ts             # tokens de diseño (colores, spacing, fuentes)
├── components/
│   ├── grid/
│   │   ├── GridRow.tsx
│   │   ├── PodiumCard.tsx
│   │   └── DriverAvatar.tsx
│   ├── sidepanel/
│   │   ├── IdleState.tsx
│   │   ├── PreRaceState.tsx
│   │   ├── LiveState.tsx
│   │   └── PostRaceState.tsx
│   ├── mainstage/
│   │   ├── LiveGrid.tsx
│   │   └── FinalPodium.tsx
│   └── ui/
│       ├── Countdown.tsx
│       └── DiffBadge.tsx
├── public/
│   ├── logo-light.png
│   ├── logo-dark.png
│   ├── f1-live.png
│   ├── f1-final.png
│   └── trophy.png
├── manifest.json            # manifest del Marketplace add-on
├── package.json
├── tsconfig.json
└── next.config.mjs
```

---

## 5. Coordinación entre Chat y Meet

| Concepto | Google Chat (Cards V2) | Meet Add-on |
|---|---|---|
| Identidad visual | Header con logo F1 + paleta unificada | Header con logo F1 + paleta unificada |
| Tipografía | Sistema (no custom) | Inter + JetBrains Mono + Titillium Web |
| Color "live" | rojo `#E10600` aplicado en title via `<font color>` | `bg-live` token CSS = `#E10600` |
| Color "final" | azul `#0066CC` | `bg-final` token CSS |
| Color "championship" | oro `#FFD700` | `bg-champ` token |
| Iconografía | Material Icons + emojis Unicode | Material Symbols (web) + emojis Unicode |
| Avatares | PNG 128×128 servidos por backend | mismo PNG, fetch directo |
| Acciones | `buttonList` con `openLink` al frontend | `<button>` HTML |
| Dato fuente | `NotificationPort` (push) | `GET /api/live-race/current` (pull) |

**Trazabilidad**: el backend es la única fuente de verdad. La misma `Race` y `ChampionshipStanding` que renderiza Cards V2 es la que sirve el endpoint REST al add-on. Cero divergencia posible.

---

## 6. Decisiones arquitectónicas finales

### 6.1 Backend

```
packages/backend/src/
├── core/ports/notification.port.ts        # SIN CAMBIOS contractuales
├── infrastructure/
│   ├── formatting/                         # NUEVO
│   │   ├── grid-text.builder.ts            # helpers reusables (formatDiff, truncate, position labels)
│   │   ├── color-tokens.ts                 # paleta hex compartida
│   │   └── __tests__/grid-text.builder.spec.ts
│   ├── google-chat/                        # NUEVO
│   │   ├── google-chat.module.ts
│   │   ├── chat-app.adapter.ts             # NotificationPort vía Service Account + scope chat.bot
│   │   ├── chat-formatter.service.ts       # construye Cards V2 según diseño
│   │   ├── chat-card.types.ts              # tipos TS para Cards V2
│   │   └── __tests__/...
│   ├── notification/                       # NUEVO
│   │   ├── notification.module.ts          # switch por env
│   │   ├── multicast.adapter.ts            # fan-out con messageId compuesto
│   │   └── __tests__/...
│   └── discord/                            # se mantiene durante la transición
└── api/
    └── live-race.controller.ts             # NUEVO · GET /api/live-race/current
```

### 6.2 Nuevo paquete frontend

```
packages/meet-addon/                        # NUEVO paquete del workspace
```

### 6.3 Paquete shared opcional

Tipos compartidos backend ↔ add-on. **V1: no lo creamos**. Para evitar over-engineering, el frontend hace `fetch` y duplica los tipos del DTO localmente (5-10 campos, low cost). Si el contrato crece, en V2 extraemos a `packages/shared`.

### 6.4 Variables de entorno nuevas

```
# Backend
NOTIFICATION_PROVIDER=discord            # discord | google-chat | dual
GOOGLE_CHAT_SPACE_RACE_DAY=              # spaces/AAAAAA
GOOGLE_CHAT_SPACE_CHAMPIONSHIP=          # spaces/BBBBBB
GOOGLE_CHAT_AUTH_MODE=service-account    # service-account | oauth
LIVE_RACE_API_ALLOWED_ORIGINS=           # CORS para el add-on, CSV

# Meet add-on (frontend)
NEXT_PUBLIC_BACKEND_URL=                 # URL del backend
NEXT_PUBLIC_MEET_CLOUD_PROJECT_NUMBER=   # GCP project number del Meet add-on
NEXT_PUBLIC_GIS_CLIENT_ID=               # Client ID de Google Identity Services
```

### 6.5 Plan de implementación (orden estricto)

1. **Refactor formatter helpers** a `infrastructure/formatting/`. Null-op funcional. Discord y tests intactos.
2. **`ChatFormatterService`** y `chat-card.types.ts`. Tests del JSON producido.
3. **`ChatAppAdapter`** (Service Account + scope `chat.bot`). Tests con `fetch` mockeado.
4. **`GoogleChatModule`** y CLI `dev-preview-race-chat`.
5. **`NotificationModule`** con switch + `MulticastNotificationAdapter`. Tests del fan-out.
6. **Wire** en `application.module.ts`: `DiscordModule` → `NotificationModule`.
7. **Endpoint** `GET /api/live-race/current` exponiendo `MonitorLiveRaceUseCase.liveState`.
8. **Paquete `meet-addon`**: scaffold Next.js 15 + estados + componentes + manifest.
9. **Documentación**: `docs/google-chat-setup.md`, `docs/meet-addon-setup.md`, README, `.env.example`.

### 6.6 Garantías

- **Cero downtime**: Discord sigue activo en `NOTIFICATION_PROVIDER=discord` por defecto. El nuevo código se mergea inactivo.
- **Tests verdes en cada paso**: ningún commit deja la suite roja.
- **Hooks pre-commit**: respetados (gitleaks, lint, typecheck).
- **Compatibilidad con el deploy actual**: no toca workflow de GitHub Actions ni Dockerfile.

---

## 7. Roadmap de iteración estética post-V1

Cosas que quedan fuera de la primera implementación pero están en el design system para futura iteración:

- Avatares reales con foto de Google (requiere scope `userinfo.profile` + service propio).
- `endIcon trending_up/down` con cálculo histórico vs día anterior.
- Confeti/fireworks en main stage cuando entras al podio.
- Sonido opcional de semáforo F1 al green light (solo en main stage).
- Modo compacto del side panel cuando hay >25 pilotos.
- Localización i18n (en/es) — todo está en español ahora.
- Botón "Compartir resultado en redes" generando OG image dinámica.
- Slash command `/dailyrace standings` en el space (requiere endpoint Chat App como bot, no webhook).

---

## 8. Referencias y decisiones del runbook

- Cards V2 reference: https://developers.google.com/workspace/chat/api/reference/rest/v1/cards
- Format messages (HTML support): https://developers.google.com/workspace/chat/format-messages
- Best practices Chat: https://developers.google.com/workspace/chat/design-components-card-dialog
- Meet Add-on overview: https://developers.google.com/workspace/meet/add-ons/guides/overview
- Best practices Meet: https://developers.google.com/workspace/meet/add-ons/guides/best-practices
- Sample Next.js: https://github.com/googleworkspace/meet/tree/main/addons-web-sdk/samples/animation-next-js
- Issue Android monospace alignment: https://issuetracker.google.com/issues/381127666
- Co-Doing/Co-Watching cerrados a nuevos partners (sept 2024).

---

> **Versión**: 1.0 · 28 abril 2026
> **Autores**: diseño + ingeniería coordinados
> **Estado**: aprobado para implementación
