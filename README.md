# Prospect Leads

Aplicación de inteligencia comercial: encuentra negocios reales por nicho y
ubicación, los investiga, detecta oportunidades concretas, los prioriza y
ayuda a preparar el contacto. Toda la información se guarda en una base de
datos local.

Flujo: **Búsquedas** (nicho + ubicación + nº de empresas) → descubrimiento en
fuentes reales → análisis automático de cada web (hallazgos con evidencia,
oportunidades y puntuación heurística explicada) → **ficha de empresa** con
mensajes de contacto (email, LinkedIn, WhatsApp) e informe comercial en PDF →
**CRM/Pipeline** y **Dashboard**. Arquitectura y módulos en
[ARCHITECTURE.md](./ARCHITECTURE.md).

## Requisitos

- Node.js 20.19 o superior (probado con 22).
- Acceso a internet para las fuentes de datos. Detrás de un proxy corporativo,
  arranca con `HTTPS_PROXY`/`HTTP_PROXY` y `NODE_USE_ENV_PROXY=1` (Node ≥ 22.21),
  porque el `fetch` de Node ignora el proxy si no se activa.

## Puesta en marcha

```bash
npm install                 # instala dependencias y genera el cliente de Prisma
cp .env.example .env        # en Windows: copy .env.example .env
npm run db:deploy           # crea la base de datos SQLite (prisma/dev.db)
npm run dev                 # http://localhost:3000
```

Para producción: `npm run build && npm start`.

## Acceso con contraseña

Con `APP_PASSWORD` definida, la aplicación pide esa contraseña antes de
mostrar cualquier página, acción o API (`src/proxy.ts`). La sesión dura 30
días en una cookie firmada; cambiar la contraseña (o `AUTH_SECRET`) cierra
todas las sesiones. Sin `APP_PASSWORD` la app queda abierta en desarrollo y
**bloqueada en producción**. `/api/health` es la única ruta pública.

## Publicar en internet (Railway)

La app se publica como un único contenedor (`Dockerfile`, `railway.json`):
servidor Next.js + worker de trabajos en el mismo proceso + SQLite en un
volumen persistente montado en `/data`. Debe haber **una sola instancia**
(SQLite y el worker en memoria no admiten réplicas).

1. Proyecto en Railway con un servicio desplegado desde este repositorio
   (o `railway up`).
2. Volumen montado en `/data` (la base de datos es
   `file:/data/prospect-leads.db`, valor por defecto del `Dockerfile`).
3. Variables del servicio: `APP_PASSWORD` (obligatoria), `AUTH_SECRET`
   (recomendada, valor aleatorio largo), `GOOGLE_PLACES_API_KEY`,
   `OSM_CONTACT_EMAIL` y el resto de claves opcionales de `.env.example`.
   Las claves solo se guardan en el panel de Railway, nunca en el repositorio.
4. Dominio público en *Settings → Networking → Generate domain*.

Al arrancar, el contenedor aplica las migraciones pendientes
(`prisma migrate deploy`). Railway comprueba `/api/health` antes de dar el
despliegue por bueno.

## Fuentes de datos y claves

| Fuente | Clave | Qué aporta |
| --- | --- | --- |
| OpenStreetMap (Nominatim + Overpass) | No necesita. Recomendado `OSM_CONTACT_EMAIL` | Nombre, categoría, web, teléfono, email, dirección, horarios y redes cuando están mapeados. **No tiene valoraciones ni reseñas.** |
| Google Places API (New) | `GOOGLE_PLACES_API_KEY` | Valoración, número de reseñas, horarios, ficha de Maps y mejor cobertura (hasta 60 resultados por búsqueda). |
| Anthropic | `ANTHROPIC_API_KEY` (opcional) | Interpretación del análisis y redacción de mensajes. Sin clave se usan reglas. |
| Google PageSpeed Insights | `PAGESPEED_API_KEY` (opcional) | Métricas reales de rendimiento móvil (Lighthouse) en cada análisis. Sin clave, la velocidad se estima por el tiempo de descarga del HTML y se indica así. |
| Remitente | `OUTREACH_SENDER_NAME`, `OUTREACH_SENDER_COMPANY` (opcionales) | Firma de los mensajes y "Preparado por" de los informes. Sin ellas, los mensajes llevan «[Tu nombre]» para rellenar. |

El estado de cada integración se ve en **Ajustes** dentro de la aplicación.
Nunca se muestran datos inventados: si una fuente no aporta un dato, aparece
como "No disponible".

Nota sobre Google Places: sus condiciones limitan el almacenamiento prolongado
del contenido de Places; la aplicación guarda el identificador del lugar y
refresca valoración, reseñas y horarios cada vez que una búsqueda vuelve a
encontrar la empresa.

## Scripts

| Comando | Uso |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` / `npm start` | Build y servidor de producción |
| `npm test` | Tests (unitarios + integración con SQLite temporal) |
| `npm run lint` / `npm run typecheck` | Calidad de código |
| `npm run db:migrate` | Crear una migración tras cambiar `prisma/schema.prisma` |
| `npm run db:deploy` | Aplicar migraciones |
| `npm run db:studio` | Explorar la base de datos |
