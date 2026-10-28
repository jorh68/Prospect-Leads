# Prospect Leads

Aplicación de inteligencia comercial: encuentra negocios reales por nicho y
ubicación, los investiga, detecta oportunidades concretas, los prioriza y
ayuda a preparar el contacto. Toda la información se guarda en una base de
datos local.

> Estado: base del proyecto (descubrimiento real de empresas, modelo de datos,
> interfaz y cola de trabajos). El análisis de webs, las fichas completas, los
> mensajes, los informes PDF, el CRM y el dashboard se construyen sobre esta
> base — ver [ARCHITECTURE.md](./ARCHITECTURE.md).

## Requisitos

- Node.js 20.19 o superior (probado con 22).
- Acceso a internet para las fuentes de datos.

## Puesta en marcha

```bash
npm install                 # instala dependencias y genera el cliente de Prisma
cp .env.example .env        # en Windows: copy .env.example .env
npm run db:deploy           # crea la base de datos SQLite (prisma/dev.db)
npm run dev                 # http://localhost:3000
```

Para producción: `npm run build && npm start`.

## Fuentes de datos y claves

| Fuente | Clave | Qué aporta |
| --- | --- | --- |
| OpenStreetMap (Nominatim + Overpass) | No necesita. Recomendado `OSM_CONTACT_EMAIL` | Nombre, categoría, web, teléfono, email, dirección, horarios y redes cuando están mapeados. **No tiene valoraciones ni reseñas.** |
| Google Places API (New) | `GOOGLE_PLACES_API_KEY` | Valoración, número de reseñas, horarios, ficha de Maps y mejor cobertura (hasta 60 resultados por búsqueda). |
| Anthropic | `ANTHROPIC_API_KEY` (opcional) | Interpretación del análisis y redacción de mensajes. Sin clave se usan reglas. |

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
