import { normalizeText } from "../text";

/**
 * Maps what the user types ("clínicas dentales", "gimnasios"…) to the tags
 * OpenStreetMap uses and the Google Places primary type. Unknown niches are
 * still searched (by name in OSM, by free text in Google) — see buildOsmFilters.
 */
export interface NicheDefinition {
  id: string;
  label: string;
  /** Lowercase, accent-free keywords; singular and plural, ES and EN */
  keywords: string[];
  /** Overpass tag filters, each one is OR-ed */
  osm: string[];
  /** Google Places (New) type, used as includedType when present */
  googleType?: string;
}

export const NICHES: NicheDefinition[] = [
  { id: "dentist", label: "Clínicas dentales", keywords: ["dental", "dentista", "odontolog", "dentist", "ortodonc", "implante dental"], osm: ['["amenity"="dentist"]', '["healthcare"="dentist"]'], googleType: "dentist" },
  { id: "physio", label: "Fisioterapia", keywords: ["fisioterap", "fisio", "physiotherap", "osteopat"], osm: ['["healthcare"="physiotherapist"]', '["healthcare:speciality"~"physiotherapy"]'], googleType: "physiotherapist" },
  { id: "clinic", label: "Clínicas médicas", keywords: ["clinica medica", "centro medico", "policlinic", "medical clinic", "consulta medica"], osm: ['["amenity"="clinic"]', '["healthcare"="clinic"]', '["amenity"="doctors"]'], googleType: "medical_clinic" },
  { id: "aesthetic", label: "Medicina estética", keywords: ["estetica", "medicina estetica", "aesthetic", "cosmetic"], osm: ['["shop"="beauty"]', '["healthcare:speciality"~"plastic_surgery|dermatology"]', '["beauty"~"."]'], googleType: "beauty_salon" },
  { id: "psychologist", label: "Psicólogos", keywords: ["psicolog", "psychologist", "terapeuta", "psicoterap"], osm: ['["healthcare"="psychotherapist"]', '["healthcare:speciality"~"psychiatry|psychology"]', '["office"="psychologist"]'], googleType: "psychologist" },
  { id: "optician", label: "Ópticas", keywords: ["optica", "optician", "optometr"], osm: ['["shop"="optician"]', '["healthcare"="optometrist"]'], googleType: "optician" },
  { id: "pharmacy", label: "Farmacias", keywords: ["farmacia", "pharmacy"], osm: ['["amenity"="pharmacy"]'], googleType: "pharmacy" },
  { id: "veterinary", label: "Veterinarios", keywords: ["veterinari", "vet ", "veterinary", "clinica veterinaria"], osm: ['["amenity"="veterinary"]'], googleType: "veterinary_care" },
  { id: "hairdresser", label: "Peluquerías", keywords: ["peluquer", "hairdresser", "barberia", "barber", "salon de belleza"], osm: ['["shop"="hairdresser"]'], googleType: "hair_salon" },
  { id: "beauty", label: "Centros de belleza", keywords: ["belleza", "beauty", "unas", "manicura", "spa", "depilacion"], osm: ['["shop"="beauty"]', '["leisure"="spa"]', '["amenity"="spa"]'], googleType: "beauty_salon" },
  { id: "gym", label: "Gimnasios", keywords: ["gimnasio", "gym", "fitness", "crossfit", "entrenamiento personal"], osm: ['["leisure"="fitness_centre"]', '["sport"="fitness"]', '["leisure"="sports_centre"]["sport"~"fitness|crossfit"]'], googleType: "gym" },
  { id: "yoga", label: "Yoga y pilates", keywords: ["yoga", "pilates"], osm: ['["sport"~"yoga|pilates"]', '["leisure"="fitness_centre"]["sport"~"yoga|pilates"]'], googleType: "yoga_studio" },
  { id: "restaurant", label: "Restaurantes", keywords: ["restaurante", "restaurant", "comida", "asador", "marisqueria", "pizzeria"], osm: ['["amenity"="restaurant"]'], googleType: "restaurant" },
  { id: "cafe", label: "Cafeterías", keywords: ["cafeteria", "cafe", "coffee"], osm: ['["amenity"="cafe"]'], googleType: "cafe" },
  { id: "bar", label: "Bares", keywords: ["bar ", "bares", "pub", "cocteleria"], osm: ['["amenity"~"^(bar|pub)$"]'], googleType: "bar" },
  { id: "hotel", label: "Hoteles", keywords: ["hotel", "hostal", "alojamiento", "apartamento turistico", "hostel"], osm: ['["tourism"~"^(hotel|hostel|guest_house|apartment)$"]'], googleType: "hotel" },
  { id: "lawyer", label: "Abogados", keywords: ["abogad", "lawyer", "bufete", "despacho juridico", "legal"], osm: ['["office"="lawyer"]'], googleType: "lawyer" },
  { id: "accountant", label: "Asesorías y gestorías", keywords: ["asesoria", "gestoria", "contable", "accountant", "accounting", "fiscal"], osm: ['["office"~"^(accountant|tax_advisor|consulting)$"]'], googleType: "accounting" },
  { id: "real_estate", label: "Inmobiliarias", keywords: ["inmobiliari", "real estate", "estate agent", "agencia inmobiliaria"], osm: ['["office"="estate_agent"]', '["shop"="estate_agent"]'], googleType: "real_estate_agency" },
  { id: "insurance", label: "Seguros", keywords: ["seguro", "insurance", "correduria"], osm: ['["office"="insurance"]'], googleType: "insurance_agency" },
  { id: "architect", label: "Arquitectos", keywords: ["arquitect", "architect"], osm: ['["office"="architect"]'] },
  { id: "car_repair", label: "Talleres mecánicos", keywords: ["taller", "mecanic", "car repair", "chapa y pintura", "neumatico"], osm: ['["shop"~"^(car_repair|tyres)$"]', '["craft"="car_repair"]'], googleType: "car_repair" },
  { id: "car_dealer", label: "Concesionarios", keywords: ["concesionari", "car dealer", "coches de ocasion", "venta de coches"], osm: ['["shop"="car"]'], googleType: "car_dealer" },
  { id: "driving_school", label: "Autoescuelas", keywords: ["autoescuela", "driving school"], osm: ['["amenity"="driving_school"]'], googleType: "driving_school" },
  { id: "school", label: "Academias", keywords: ["academia", "escuela de idiomas", "idiomas", "clases particulares", "language school", "formacion"], osm: ['["amenity"~"^(language_school|training|prep_school|music_school)$"]', '["office"="educational_institution"]'], googleType: "school" },
  { id: "kindergarten", label: "Escuelas infantiles", keywords: ["guarderia", "escuela infantil", "kindergarten", "nursery"], osm: ['["amenity"="kindergarten"]'], googleType: "preschool" },
  { id: "florist", label: "Floristerías", keywords: ["floristeria", "florist", "flores"], osm: ['["shop"="florist"]'], googleType: "florist" },
  { id: "bakery", label: "Panaderías y pastelerías", keywords: ["panaderia", "pasteleria", "bakery", "obrador"], osm: ['["shop"~"^(bakery|pastry|confectionery)$"]'], googleType: "bakery" },
  { id: "furniture", label: "Tiendas de muebles", keywords: ["muebles", "furniture", "decoracion"], osm: ['["shop"~"^(furniture|interior_decoration|kitchen)$"]'], googleType: "furniture_store" },
  { id: "plumber", label: "Fontaneros", keywords: ["fontaner", "plumber"], osm: ['["craft"="plumber"]'], googleType: "plumber" },
  { id: "electrician", label: "Electricistas", keywords: ["electricista", "electrician"], osm: ['["craft"="electrician"]'], googleType: "electrician" },
  { id: "builder", label: "Reformas y construcción", keywords: ["reforma", "construccion", "constructora", "builder", "contractor"], osm: ['["craft"~"^(builder|carpenter|tiler|painter)$"]', '["office"="construction_company"]'], googleType: "general_contractor" },
  { id: "locksmith", label: "Cerrajeros", keywords: ["cerrajer", "locksmith"], osm: ['["craft"="locksmith"]', '["shop"="locksmith"]'], googleType: "locksmith" },
  { id: "travel_agency", label: "Agencias de viajes", keywords: ["agencia de viaje", "travel agency", "viajes"], osm: ['["shop"="travel_agency"]'], googleType: "travel_agency" },
  { id: "photographer", label: "Fotógrafos", keywords: ["fotograf", "photographer", "estudio de foto"], osm: ['["craft"="photographer"]', '["shop"="photo"]'] },
  { id: "pet_shop", label: "Tiendas de animales", keywords: ["tienda de animales", "pet shop", "mascotas", "peluqueria canina"], osm: ['["shop"="pet"]', '["shop"="pet_grooming"]'], googleType: "pet_store" },
  { id: "coworking", label: "Coworkings", keywords: ["coworking"], osm: ['["amenity"="coworking_space"]', '["office"="coworking"]'] },
  { id: "marketing_agency", label: "Agencias de marketing", keywords: ["agencia de marketing", "marketing", "publicidad", "agencia digital"], osm: ['["office"~"^(advertising_agency|marketing)$"]'] },
  { id: "funeral", label: "Funerarias", keywords: ["funerari", "tanatorio", "funeral"], osm: ['["shop"="funeral_directors"]', '["amenity"="funeral_hall"]'], googleType: "funeral_home" },
];

export interface NicheMatch {
  niche: NicheDefinition | null;
  /** Free-text term used when there is no exact mapping */
  term: string;
}

export function matchNiche(input: string): NicheMatch {
  const text = ` ${normalizeText(input)} `;
  let best: { niche: NicheDefinition; length: number } | null = null;
  for (const niche of NICHES) {
    for (const kw of niche.keywords) {
      const k = normalizeText(kw);
      if (!k) continue;
      // keywords ending with a space ("bar ") must match a whole word
      const hit = kw.endsWith(" ") ? text.includes(` ${k} `) : text.includes(k);
      if (hit && (!best || k.length > best.length)) best = { niche, length: k.length };
    }
  }
  return { niche: best?.niche ?? null, term: normalizeText(input) };
}

/** Escape a value for an Overpass regex inside double quotes. */
function overpassRegex(value: string): string {
  return value.replace(/[\\"]/g, "").replace(/[.*+?^${}()|[\]]/g, "\\$&");
}

/**
 * Overpass filters for a niche. Unmapped niches fall back to a
 * case-insensitive name search restricted to business-like features.
 */
export function buildOsmFilters(match: NicheMatch): string[] {
  if (match.niche) return match.niche.osm;
  const words = match.term.split(" ").filter((w) => w.length > 3);
  const stem = (words[0] ?? match.term).replace(/(es|s)$/, "");
  const re = overpassRegex(stem);
  return ["shop", "amenity", "office", "craft", "healthcare", "leisure", "tourism"].map(
    (key) => `["${key}"]["name"~"${re}",i]`,
  );
}
