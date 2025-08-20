# Encuesta (frontend + backend + stats)

Despliegue único (Web Service) en Render.

## Variables de entorno
- `STATS_USER` y `STATS_PASS` → credenciales para acceder a `/stats.html` y `/api/stats/*`.
- (opcional) `DATA_DIR` → ruta de datos (por defecto `./data`), en Render usa un Persistent Disk montado en `/opt/render/project/src/data`.
- `RENDER_EXTERNAL_URL` → Render la define automáticamente; se usa para generar URLs absolutas de imágenes compartidas.

## Comandos
```
npm install
npm start    # http://localhost:3000
```
Abre `http://localhost:3000` para la encuesta pública.
Abre `http://localhost:3000/stats.html` (te pedirá usuario/contraseña) para ver estadísticas.

## Estructura
```
/public
  ├─ index.html     (encuesta)
  ├─ stats.html     (gráficas)
  └─ img/           (iconos opcionales 1.png..20.png)
server.js
schema.sql
package.json
.gitignore
```

## Notas
- Cada vez que alguien usa **Compartir**, se registra un evento con sus selecciones y porcentaje.
- El botón **Descargar imagen** genera un PNG con “Soy un X% facha, ¿y tú?”.
- Las estadísticas usan **solo eventos de compartir**.
