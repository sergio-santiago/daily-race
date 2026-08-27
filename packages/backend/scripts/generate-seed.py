#!/usr/bin/env python3
"""Genera un seed anonimizado a partir de la base de datos local cargada con un
snapshot de produccion. Conserva intactos todos los tiempos, posiciones y puntos,
y sustituye unicamente los datos personales y los identificadores de Google."""
import hashlib
import pathlib
import subprocess
import sys

# ── Nombres sinteticos ────────────────────────────────────────────────
# Pool determinista de nombres espanoles con los mismos glifos acentuados
# que los reales, para que la medicion de texto se ejercite igual.
NOMBRES = [
    'Adri', 'Agus', 'Aitor', 'Alba', 'Ale', 'Alicia', 'Alvaro', 'Ana', 'Andres', 'Angela',
    'Aroa', 'Asier', 'Beatriz', 'Belen', 'Bruno', 'Candela', 'Carla', 'Carmen', 'Cesar',
    'Chema', 'Clara', 'Diego', 'Elena', 'Elisa', 'Emilio', 'Enrique', 'Eva', 'Fatima',
    'Felipe', 'Gema', 'Gonzalo', 'Guillem', 'Hector', 'Hugo', 'Ines', 'Irene', 'Iker',
    'Izan', 'Jaime', 'Javi', 'Joaquin', 'Jorge', 'Julia', 'Leire', 'Lucia', 'Luis',
    'Manu', 'Marcos', 'Marta', 'Mateo', 'Mireia', 'Nacho', 'Naiara', 'Nerea', 'Noelia',
    'Nuria', 'Olalla', 'Oscar', 'Pablo', 'Paula', 'Pilar', 'Quique', 'Rocio', 'Rodrigo',
    'Ruben', 'Sandra', 'Saul', 'Silvia', 'Sonia', 'Teo', 'Tono', 'Unai', 'Vega',
    'Vicente', 'Victor', 'Yaiza', 'Ximo', 'Zoe',
    'Angel', 'Ainhoa', 'Ivan', 'Jesus', 'Joel', 'Ramon', 'Raul', 'Ruth', 'Ines',
]
APELLIDOS = [
    'Abad', 'Acosta', 'Aguilar', 'Alonso', 'Amaya', 'Arribas', 'Bautista', 'Benitez',
    'Bermudez', 'Blanco', 'Bravo', 'Bustos', 'Caballero', 'Calvo', 'Campos', 'Cano',
    'Carrasco', 'Castano', 'Cespedes', 'Cordero', 'Cuesta', 'Delgado', 'Dominguez',
    'Duran', 'Escudero', 'Esteban', 'Fabregas', 'Ferrer', 'Fuentes', 'Gallardo',
    'Garrido', 'Gimeno', 'Guerrero', 'Herranz', 'Hidalgo', 'Higueras', 'Ibanez',
    'Iglesias', 'Izaguirre', 'Jimenez', 'Lamela', 'Lastra', 'Lozano', 'Maldonado',
    'Marquez', 'Mena', 'Merino', 'Millan', 'Montero', 'Mora', 'Moreno', 'Munoz',
    'Nadal', 'Navarrete', 'Nieto', 'Nunez', 'Olmedo', 'Ordonez', 'Ortega', 'Pardo',
    'Pastor', 'Pena', 'Pereira', 'Prieto', 'Quesada', 'Quintana', 'Ramirez', 'Redondo',
    'Reyes', 'Rincon', 'Robledo', 'Roldan', 'Rueda', 'Salazar', 'Saldana', 'Sanchez',
    'Santamaria', 'Sarmiento', 'Segura', 'Sepulveda', 'Serrano', 'Sierra', 'Solana',
    'Tejedor', 'Tirado', 'Toledano', 'Trujillo', 'Ureña', 'Valcarcel', 'Valdivia',
    'Vallejo', 'Vaquero', 'Vargas', 'Vazquez', 'Vela', 'Ventura', 'Verdugo', 'Vidal',
    'Villalba', 'Villanueva', 'Zamora', 'Zapata', 'Zurita',
]
# Acentos reales, para que la medicion de texto se ejercite con los mismos glifos
# que aparecen en los datos de produccion.
ACENTOS = {
    'Alvaro': 'Álvaro', 'Andres': 'Andrés', 'Angela': 'Ángela', 'Angel': 'Ángel',
    'Belen': 'Belén', 'Cesar': 'César', 'Fatima': 'Fátima', 'Hector': 'Héctor',
    'Ines': 'Inés', 'Joaquin': 'Joaquín', 'Jesus': 'Jesús', 'Lucia': 'Lucía',
    'Nacho': 'Nacho', 'Oscar': 'Óscar', 'Ramon': 'Ramón', 'Raul': 'Raúl',
    'Rocio': 'Rocío', 'Ruben': 'Rubén', 'Saul': 'Saúl', 'Tono': 'Toño',
    'Victor': 'Víctor', 'Ivan': 'Iván',
    'Benitez': 'Benítez', 'Bermudez': 'Bermúdez', 'Castano': 'Castaño',
    'Cespedes': 'Céspedes', 'Dominguez': 'Domínguez', 'Duran': 'Durán',
    'Fabregas': 'Fábregas', 'Ibanez': 'Ibáñez', 'Izaguirre': 'Izaguirre',
    'Jimenez': 'Jiménez', 'Marquez': 'Márquez', 'Millan': 'Millán',
    'Munoz': 'Muñoz', 'Navarrete': 'Navarrete', 'Nunez': 'Núñez',
    'Ordonez': 'Ordóñez', 'Pena': 'Peña', 'Ramirez': 'Ramírez',
    'Rincon': 'Rincón', 'Roldan': 'Roldán', 'Saldana': 'Saldaña',
    'Sanchez': 'Sánchez', 'Santamaria': 'Santamaría', 'Sepulveda': 'Sepúlveda',
    'Valcarcel': 'Valcárcel', 'Vazquez': 'Vázquez',
}

def acentuar(palabra: str) -> str:
    return ACENTOS.get(palabra, palabra)

def pool():
    """Todas las combinaciones posibles, agrupadas por longitud."""
    from collections import defaultdict
    por_longitud = defaultdict(list)
    for i, n in enumerate(NOMBRES):
        nn = acentuar(n)
        for j, a1 in enumerate(APELLIDOS):
            aa1 = acentuar(a1)
            # nombre + un apellido
            por_longitud[len(nn) + 1 + len(aa1)].append(f'{nn} {aa1}')
            # nombre + dos apellidos, para las longitudes largas
            a2 = APELLIDOS[(i * 7 + j * 13) % len(APELLIDOS)]
            if a2 != a1:
                aa2 = acentuar(a2)
                por_longitud[len(nn) + 1 + len(aa1) + 1 + len(aa2)].append(f'{nn} {aa1} {aa2}')
    for k in por_longitud:
        por_longitud[k] = sorted(set(por_longitud[k]))
    return por_longitud

# ── Generacion ────────────────────────────────────────────────────────
PSQL = ['docker', 'compose', 'exec', '-T', 'db', 'psql', '-U', 'dailyrace', '-d', 'dailyrace',
        '-t', '-A', '-F', '\t', '--no-align', '-c']
# packages/backend/scripts/ -> raiz del repo
ROOT = pathlib.Path(__file__).resolve().parents[3]


def query(sql: str):
    out = subprocess.run(PSQL + [sql], cwd=str(ROOT), capture_output=True, text=True, check=True).stdout
    return [line.split('\t') for line in out.strip('\n').split('\n') if line]


def uuid_from(seed: str) -> str:
    h = hashlib.sha256(('daily-race-seed/' + seed).encode()).hexdigest()
    # version 4 y variante RFC 4122, para que sea un uuid valido de verdad
    b = list(h[:32])
    b[12] = '4'
    b[16] = '8'
    s = ''.join(b)
    return f'{s[0:8]}-{s[8:12]}-{s[12:16]}-{s[16:20]}-{s[20:32]}'


def main():
    por_longitud = pool()
    longitudes = sorted(por_longitud)

    drivers = query('select id, google_id, display_name, created_at, updated_at '
                    'from drivers order by created_at, id')
    races = query('select id, conference_record_name, meeting_code, green_light, end_time, '
                  'status, processed_at, created_at from races order by green_light, id')
    entries = query('select id, race_id, driver_id, position, start_time, green_light, points, '
                    'is_false_start, is_worst_on_grid from starting_grid_entries '
                    'order by race_id, position')

    # ── Pilotos ────────────────────────────────────────────────────────────
    usados = set()
    driver_map = {}
    driver_rows = []
    for i, (rid, _google, nombre, created, updated) in enumerate(drivers):
        objetivo = len(nombre)
        candidatos = None
        # busca la longitud exacta y, si no hay hueco libre, la mas cercana
        for delta in range(0, 12):
            for L in (objetivo - delta, objetivo + delta):
                if L in por_longitud:
                    libres = [c for c in por_longitud[L] if c not in usados]
                    if libres:
                        candidatos = libres
                        break
            if candidatos:
                break
        if not candidatos:
            sys.exit(f'sin candidatos para longitud {objetivo}')
        elegido = candidatos[int(hashlib.sha256(f'{i}:{objetivo}'.encode()).hexdigest(), 16) % len(candidatos)]
        usados.add(elegido)
        nuevo_id = uuid_from(f'driver/{i}')
        driver_map[rid] = nuevo_id
        # google_id sintetico, 21 digitos como los de Google pero deterministas y falsos
        gid = str(int(hashlib.sha256(f'gid/{i}'.encode()).hexdigest()[:16], 16))[:21].ljust(21, '0')
        driver_rows.append([nuevo_id, gid, elegido, created, updated])

    # ── Carreras ───────────────────────────────────────────────────────────
    race_map = {}
    race_rows = []
    for i, (rid, _conf, meet, green, end, status, processed, created) in enumerate(races):
        nuevo_id = uuid_from(f'race/{i}')
        race_map[rid] = nuevo_id
        conf = 'conferenceRecords/seed-' + hashlib.sha256(f'conf/{i}'.encode()).hexdigest()[:24]
        race_rows.append([nuevo_id, conf, meet, green, end, status,
                          processed if processed else r'\N', created])

    # ── Entradas ───────────────────────────────────────────────────────────
    entry_rows = []
    for i, (eid, race_id, driver_id, pos, start, green, points, false_start, worst) in enumerate(entries):
        entry_rows.append([uuid_from(f'entry/{i}'), race_map[race_id], driver_map[driver_id],
                           pos, start, green, points, false_start, worst])

    salida = [
        '-- Seed de desarrollo de Daily Race.',
        '--',
        '-- Datos derivados de un snapshot de produccion del 26 de agosto de 2026:',
        f'-- {len(race_rows)} carreras, {len(driver_rows)} pilotos y {len(entry_rows)} entradas de parrilla.',
        '--',
        '-- Todos los tiempos, posiciones, puntos, salidas en falso y flags son los reales, sin tocar.',
        '-- Lo unico sustituido son los datos personales y los identificadores de Google:',
        '--   display_name           nombres sinteticos que conservan la distribucion de longitudes',
        '--                          y los mismos glifos acentuados (tildes, enye) que los reales',
        '--   google_id              21 digitos deterministas, falsos',
        '--   conference_record_name identificador sintetico con prefijo seed-',
        '--   uuid de las tres tablas  regenerados de forma determinista',
        '--',
        '-- El meeting_code SI es el real de la daily, el mismo que ya esta en el repo como',
        '-- default de DAILY_MEETING_CODE, porque el seed tiene que cuadrar con la',
        '-- configuracion local para que el monitor reconozca las carreras. No es un dato',
        '-- personal, pero si es un enlace a la sala.',
        '--',
        '-- Se regenera con packages/backend/scripts/generate-seed.py partiendo de una copia de',
        '-- produccion. Requiere que las migraciones esten aplicadas.',
        '',
        'BEGIN;',
        '',
        'TRUNCATE starting_grid_entries, races, drivers CASCADE;',
        '',
        'COPY drivers (id, google_id, display_name, created_at, updated_at) FROM stdin;',
    ]
    salida += ['\t'.join(map(str, r)) for r in driver_rows]
    salida += ['\\.', '',
               'COPY races (id, conference_record_name, meeting_code, green_light, end_time, status, processed_at, created_at) FROM stdin;']
    salida += ['\t'.join(map(str, r)) for r in race_rows]
    salida += ['\\.', '',
               'COPY starting_grid_entries (id, race_id, driver_id, position, start_time, green_light, points, is_false_start, is_worst_on_grid) FROM stdin;']
    salida += ['\t'.join(map(str, r)) for r in entry_rows]
    salida += ['\\.', '', 'COMMIT;', '']

    destino = ROOT / 'packages' / 'backend' / 'db' / 'seed.sql'
    destino.parent.mkdir(parents=True, exist_ok=True)
    with open(destino, 'w', encoding='utf-8') as fh:
        fh.write('\n'.join(salida))
    print(f'escrito {destino}: {len(driver_rows)} pilotos, {len(race_rows)} carreras, {len(entry_rows)} entradas')

    # comprobacion de que la distribucion de longitudes se ha conservado
    reales = sorted(len(d[2]) for d in drivers)
    nuevos = sorted(len(r[2]) for r in driver_rows)
    print(f'longitudes reales  min={reales[0]} max={reales[-1]} media={sum(reales)/len(reales):.1f}')
    print(f'longitudes nuevas  min={nuevos[0]} max={nuevos[-1]} media={sum(nuevos)/len(nuevos):.1f}')
    peor = max(abs(a - b) for a, b in zip(reales, nuevos))
    print(f'desviacion maxima de longitud: {peor} caracteres')


if __name__ == '__main__':
    main()
