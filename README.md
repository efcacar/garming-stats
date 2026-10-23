# Garmin Stats

Panel personal para ver tus estadísticas de entrenamiento de Garmin Connect: actividades, mapas, zonas de FC, fitness (CTL/ATL/TSB), récords y más.

Los datos se descargan de tu cuenta de Garmin a archivos locales en tu ordenador. La app los lee desde ahí; no hay servidor en la nube ni base de datos.

---

## Qué necesitas antes de empezar

Instala estas dos cosas si no las tienes ya:


| Programa                      | Para qué sirve            | Cómo comprobarlo                             |
| ----------------------------- | ------------------------- | -------------------------------------------- |
| **Node.js** (v18 o superior)  | Ejecutar la app web       | Abre una terminal y escribe `node --version` |
| **Python** (v3.10 o superior) | Descargar datos de Garmin | Escribe `python3 --version`                  |


También necesitas una **cuenta de Garmin Connect** (la misma que usas en la app del móvil o en [connect.garmin.com](https://connect.garmin.com)).

> **¿No tienes Node.js o Python?**
>
> - Node.js: [https://nodejs.org](https://nodejs.org) → descarga la versión LTS.
> - Python: [https://python.org/downloads](https://python.org/downloads) → en Mac/Linux suele venir instalado.

---

## Guía paso a paso

### 1. Descargar el proyecto

Si ya tienes la carpeta `garmin-stats` en tu ordenador, ábrela en la terminal:

```bash
cd ruta/donde/está/garmin-stats
```

(Sustituye `ruta/donde/está/garmin-stats` por la ruta real, por ejemplo `/Users/tu-usuario/Documents/garmin-stats`.)

---

### 2. Configurar tus credenciales de Garmin

La app necesita tu email y contraseña de Garmin Connect para descargar tus actividades. **Nunca subas este archivo a internet.**

1. Copia el archivo de ejemplo:
  ```bash
   cp .env.example .env
  ```
2. Abre `.env` con cualquier editor de texto y rellena tus datos:
  ```
   GARMIN_EMAIL=tu@email.com
   GARMIN_PASSWORD=tu_contraseña
  ```
   Usa el mismo email y contraseña con los que entras en Garmin Connect.

---

### 3. Crear entorno virtual e instalar dependencias de Python (sincronización)

Desde la carpeta raíz del proyecto, crea un entorno virtual y instala las librerías ahí:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r fetch/requirements.txt
```

> En macOS con Python de Homebrew, esto evita el error de entorno gestionado externamente (PEP 668).

---

### 4. Descargar tus actividades de Garmin

Desde la carpeta raíz del proyecto (`garmin-stats`):

```bash
source .venv/bin/activate
python fetch/sync.py --limit N
```

**Qué hace este comando:**

- Inicia sesión en Garmin Connect con tu `.env`
- Descarga la lista de actividades y los detalles de cada una
- El detalle muestra altimetría, ritmo, frecuencia cardíaca y potencia en dos columnas (una en móvil). Las gráficas comparten el tiempo de las muestras originales de Garmin: al pasar el ratón, se marca el mismo instante en todas y su posición GPS en el mapa, si existe. Los datos ausentes no se interpolan. La sincronización completa las series en actividades ya descargadas.
- El resumen del detalle incluye la temperatura media registrada por Garmin en °C; si no está disponible, se muestra un guion. Se consulta el resumen individual de la actividad (`summaryDTO.averageTemperature`), ya que el listado general solo proporciona mínima y máxima. La sincronización completa este dato en actividades ya descargadas y lo conserva para no repetir la consulta; `--force` lo actualiza.
- El listado conserva las temperaturas ya descargadas desde el inicio de la sincronización y guarda las nuevas conforme se consultan, sin esperar a que termine todo el historial.
- En el detalle, los parciales conservan la clasificación original de Garmin (`WARMUP`, `ACTIVE`, `REST`, `COOLDOWN`, etc.), sin deducir fases ni asumir que cada tramo sea un kilómetro o una vuelta manual. Una sincronización normal completa estas etiquetas en las actividades ya descargadas.
- La columna de elevación de los parciales muestra ascenso y descenso juntos (`+6 / −3 m`), tanto en bloques de entrenamiento como en parciales por distancia. La sincronización completa el descenso en actividades ya descargadas; si Garmin no lo proporciona, se muestra un guion en lugar de asumir cero.
- Al actualizar las actividades tras sincronizar, se invalida la caché de detalles y se recarga el detalle abierto para mostrar los datos recién descargados.
- Los tramos de entrenamiento se muestran como bloques desplegables utilizando la agrupación original de Garmin (`typedsplits` y `lapIndexes`). Cada bloque muestra su resumen y sus parciales por distancia, incluyendo las fracciones de kilómetro, sin fusionar bloques de la misma intensidad ni interpolar kilómetros que Garmin no proporciona. La siguiente sincronización completa estos bloques en actividades ya descargadas.
- Descarga también sueño, equipo y peso/composición corporal
- Guarda el material asociado a cada actividad para mostrarlo en su detalle, con las estadísticas acumuladas del equipo y su vida útil cuando estén disponibles.
- Guarda todo en `public/data/` (archivos JSON)

La primera vez puede tardar **varios minutos** si tienes muchas actividades. Verás el progreso en la terminal.

**Opciones útiles:**

```bash
# Solo las 20 actividades más recientes (para probar)
python fetch/sync.py --limit 20

# Solo actividades desde una fecha
python fetch/sync.py --since 2024-01-01

# Más rápido, sin descargar rutas GPS
python fetch/sync.py --no-gpx
```

> **Importante:** vuelve a ejecutar `python fetch/sync.py` cuando quieras actualizar los datos con entrenamientos nuevos. Las actividades ya descargadas no se vuelven a pedir a Garmin, salvo para completar datos pendientes como el material asociado. Para actualizar asociaciones de material modificadas en Garmin, utiliza `--force` (puedes combinarlo con `--limit 20`).

---

### 5. Instalar dependencias de la app web

En la carpeta raíz del proyecto:

```bash
npm install
```

Solo hace falta hacerlo **una vez** (o cuando cambien las dependencias del proyecto).

---

### 6. Abrir la app

```bash
npm run dev
```

Verás algo como:

```
  ➜  Local:   http://localhost:5173/
```

Abre ese enlace en el navegador (Chrome, Firefox, Safari…).

Para **cerrar** la app, vuelve a la terminal y pulsa `Ctrl + C`.

---

## Resumen rápido (cuando ya lo hayas hecho una vez)

Cada vez que quieras usar la app con datos actualizados:

```bash
# 1. Sincronizar datos nuevos de Garmin
source .venv/bin/activate
python fetch/sync.py

# 2. Arrancar la app
npm run dev
```

Luego abre [http://localhost:5173](http://localhost:5173) en el navegador.

---

## Ajustes dentro de la app

En el menú lateral, entra en **Ajustes** para configurar:

- FC máxima
- FTP (ciclismo)
- FC y ritmo en umbral (running)

Estos valores se guardan en tu navegador y afectan a los cálculos de zonas, TSS y fitness.

---

## Problemas frecuentes

### "ERROR: Set GARMIN_EMAIL and GARMIN_PASSWORD in .env"

No existe el archivo `.env` o está vacío. Repite el **paso 2**.

### "Authentication failed" al sincronizar

- Comprueba que el email y la contraseña en `.env` son correctos.
- Si tienes verificación en dos pasos (2FA) en Garmin, puede que falle el login automático. Prueba a desactivarla temporalmente o revisa la documentación de la librería `garminconnect`.

### "No se encontró /data/activities.json" en la app

Aún no has sincronizado datos. Ejecuta primero:

```bash
source .venv/bin/activate
python fetch/sync.py
```

### La terminal dice que `node` o `npm` no existen

Instala Node.js desde [nodejs.org](https://nodejs.org) y vuelve a abrir la terminal.

### La sincronización va muy lenta

Es normal: hay una pausa entre peticiones para no saturar la API de Garmin. Para una prueba rápida usa `--limit 20` o `--no-gpx`.

### Puerto 5173 ya en uso

Cierra otras ventanas de terminal donde tengas `npm run dev` corriendo, o Vite te propondrá otro puerto (por ejemplo 5174).

---

## Comandos extra (opcional)


| Comando           | Descripción                                                |
| ----------------- | ---------------------------------------------------------- |
| `npm run build`   | Genera una versión optimizada en la carpeta `dist/`        |
| `npm run preview` | Previsualiza la versión de producción (después de `build`) |
| `npm run lint`    | Revisa el código con el linter                             |


---

## Estructura del proyecto (referencia)

```
garmin-stats/
├── .env                 ← Tus credenciales (no compartir)
├── fetch/
│   ├── sync.py          ← Script que descarga datos de Garmin
│   └── requirements.txt ← Dependencias de Python
├── public/data/         ← Datos descargados (JSON: actividades, sueño, equipo, peso...)
└── src/                 ← Código de la app web (React)
```

---

## Privacidad y qué NO subir a GitHub

Estos archivos contienen datos personales o credenciales. El `.gitignore` ya los excluye, pero conviene conocerlos:

| Archivo / carpeta | Qué contiene | Riesgo |
|-------------------|--------------|--------|
| `.env` | Email y contraseña de Garmin Connect | Acceso total a tu cuenta |
| `public/data/` | Actividades, estadísticas y rutas GPS | Ubicación exacta, salud, hábitos |
| `dist/data/` | Copia de los datos al hacer `npm run build` | Igual que arriba |
| `~/.garth/` (en tu home) | Tokens de sesión de Garmin | Acceso a la API sin contraseña |

**Datos sensibles dentro de los JSON:**
- Coordenadas GPS de cada entrenamiento (pueden revelar dónde vives o entrenas)
- Ciudades en los títulos de actividades
- FC, VO2max, calorías, ritmos y patrones horarios

**Seguro para publicar:**
- `.env.example` (solo tiene placeholders)
- Todo el código en `src/` y `fetch/`

**Antes de hacer `git push`**, comprueba que no se cuelen datos:

```bash
git status
```

No deberían aparecer `.env` ni archivos dentro de `public/data/`. Si alguna vez los añadiste por error:

```bash
git rm -r --cached public/data/
git rm --cached .env
```

Luego haz commit de la eliminación. Si ya los subiste a GitHub, **cambia tu contraseña de Garmin** y considera borrar el historial del repositorio.
