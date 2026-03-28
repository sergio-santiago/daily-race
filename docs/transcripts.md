# Transcripciones

## Que son

Las transcripciones son el texto hablado durante una reunion de Google Meet, capturado automaticamente por la funcion de transcripcion de Google. Cada entrada contiene el nombre del hablante, el texto, y timestamps de inicio y fin.

## Origen de los datos

Google Meet REST API v2 expone dos endpoints para transcripciones:

```
GET /v2/conferenceRecords/{id}/transcripts
GET /v2/conferenceRecords/{id}/transcripts/{id}/entries
```

Cada entry tiene:
- **participant**: referencia al participante (se resuelve a nombre via la API de participantes)
- **text**: texto transcrito
- **startTime / endTime**: timestamps con precision sub-segundo

## Requisitos

Para que una reunion tenga transcripcion disponible:

1. **Google Workspace Business Standard** o superior (no funciona con cuentas gratuitas)
2. **Transcripcion activada** en la reunion — puede ser:
   - Manualmente por un participante durante la reunion
   - Automaticamente via configuracion del evento en Calendar
   - Globalmente por el admin de Workspace (auto-transcripcion para toda la organizacion)

Actualmente la daily de Secture NO tiene auto-transcripcion activada. Se requiere que un admin de Workspace o el organizador del evento la active.

## Persistencia

Las transcripciones se guardan automaticamente en PostgreSQL al procesar cada race. Si la reunion no tiene transcripcion, no falla — simplemente no se guardan entries.

### Esquema

```
transcript_entries
  id              UUID PK
  race_id         UUID FK → races
  speaker_name    VARCHAR (nombre del hablante)
  text            TEXT (texto transcrito)
  start_time      TIMESTAMPTZ
  end_time        TIMESTAMPTZ
  created_at      TIMESTAMPTZ
```

### Flujo

1. `ProcessRaceUseCase` procesa la race (participantes, puntos, grid)
2. Llama a `meetProvider.getTranscriptEntries()` para obtener las transcripciones
3. Si hay entries, las guarda via `transcriptRepository.saveAll()`
4. Si no hay transcripcion o falla, lo logea como warning y continua sin afectar al flujo principal

## Uso futuro

Los datos de transcripciones son la base para funcionalidades futuras:

- **Deteccion de ruina**: enviar el transcript a Gemini para identificar quien cuenta la ruina, extraer el texto literal y generar un resumen
- **Resumen automatico de la daily**: puntos clave, decisiones, proximos pasos
- **Lore de drivers**: generar perfiles humoristicos basados en el historico de ruinas contadas
- **Busqueda**: encontrar en que daily se hablo de un tema concreto

## Limitaciones

- **Retencion de 30 dias**: los conference records (y sus transcripts) se borran de la API a los 30 dias. Los datos persistidos en PostgreSQL se mantienen indefinidamente.
- **Solo usuarios con cuenta**: los participantes anonimos no se resuelven correctamente como speaker.
- **Calidad**: la transcripcion automatica de Google puede tener errores, especialmente con nombres propios o jerga interna.
