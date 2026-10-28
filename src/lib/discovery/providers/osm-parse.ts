import type { SocialPlatform } from "../../domain/constants";
import type { DiscoveredBusiness, SearchArea } from "../../domain/types";
import { isOwnWebsite, normalizeEmail, normalizePhone, normalizeUrl, socialPlatformFromUrl } from "../../text";

export interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

const SOCIAL_TAGS: Record<string, { platform: SocialPlatform; base: string }> = {
  "contact:facebook": { platform: "facebook", base: "https://www.facebook.com/" },
  facebook: { platform: "facebook", base: "https://www.facebook.com/" },
  "contact:instagram": { platform: "instagram", base: "https://www.instagram.com/" },
  instagram: { platform: "instagram", base: "https://www.instagram.com/" },
  "contact:linkedin": { platform: "linkedin", base: "https://www.linkedin.com/company/" },
  "contact:twitter": { platform: "x", base: "https://x.com/" },
  twitter: { platform: "x", base: "https://x.com/" },
  "contact:youtube": { platform: "youtube", base: "https://www.youtube.com/" },
  "contact:tiktok": { platform: "tiktok", base: "https://www.tiktok.com/@" },
  "contact:whatsapp": { platform: "whatsapp", base: "https://wa.me/" },
};

const CATEGORY_KEYS = ["healthcare", "amenity", "shop", "office", "craft", "leisure", "tourism"];

/** Spanish names for the OSM tag values we search for; others are humanised. */
const CATEGORY_LABELS: Record<string, string> = {
  dentist: "Dentista",
  physiotherapist: "Fisioterapeuta",
  clinic: "Clínica",
  doctors: "Consulta médica",
  psychotherapist: "Psicoterapeuta",
  psychologist: "Psicólogo",
  optician: "Óptica",
  optometrist: "Optometrista",
  pharmacy: "Farmacia",
  veterinary: "Veterinario",
  hairdresser: "Peluquería",
  beauty: "Centro de belleza",
  spa: "Spa",
  fitness_centre: "Gimnasio",
  sports_centre: "Centro deportivo",
  restaurant: "Restaurante",
  cafe: "Cafetería",
  bar: "Bar",
  pub: "Pub",
  hotel: "Hotel",
  hostel: "Hostal",
  guest_house: "Casa de huéspedes",
  apartment: "Apartamento turístico",
  lawyer: "Abogado",
  accountant: "Asesoría contable",
  tax_advisor: "Asesor fiscal",
  consulting: "Consultoría",
  estate_agent: "Inmobiliaria",
  insurance: "Seguros",
  architect: "Arquitecto",
  car_repair: "Taller mecánico",
  tyres: "Neumáticos",
  car: "Concesionario",
  driving_school: "Autoescuela",
  language_school: "Academia de idiomas",
  training: "Centro de formación",
  prep_school: "Academia",
  music_school: "Escuela de música",
  kindergarten: "Escuela infantil",
  florist: "Floristería",
  bakery: "Panadería",
  pastry: "Pastelería",
  confectionery: "Confitería",
  furniture: "Tienda de muebles",
  interior_decoration: "Decoración",
  kitchen: "Cocinas",
  plumber: "Fontanero",
  electrician: "Electricista",
  builder: "Construcción",
  carpenter: "Carpintería",
  tiler: "Alicatador",
  painter: "Pintor",
  construction_company: "Constructora",
  locksmith: "Cerrajero",
  travel_agency: "Agencia de viajes",
  photographer: "Fotógrafo",
  photo: "Fotografía",
  pet: "Tienda de animales",
  pet_grooming: "Peluquería canina",
  coworking_space: "Coworking",
  coworking: "Coworking",
  advertising_agency: "Agencia de publicidad",
  marketing: "Marketing",
  funeral_directors: "Funeraria",
  funeral_hall: "Tanatorio",
};

export function osmCategoryLabel(value: string): string {
  const label = CATEGORY_LABELS[value];
  if (label) return label;
  const text = value.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function socialUrl(value: string, base: string, platform: SocialPlatform): string | null {
  const v = value.trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v) || v.includes(".")) return normalizeUrl(v);
  if (platform === "whatsapp") {
    const digits = v.replace(/\D/g, "");
    return digits.length >= 6 ? `${base}${digits}` : null;
  }
  return `${base}${v.replace(/^@/, "")}`;
}

/** Shortest meaningful name of the searched area, e.g. "Madrid". */
function areaCity(area: SearchArea | null): string | null {
  return area?.displayName.split(",")[0]?.trim() || null;
}

export function parseOverpassElement(el: OverpassElement, area: SearchArea | null): DiscoveredBusiness | null {
  const t = el.tags ?? {};
  const name = t.name?.trim();
  if (!name) return null;
  // Skip places that OSM marks as closed
  if (Object.keys(t).some((k) => k.startsWith("disused:") || k.startsWith("was:"))) return null;

  const lat = el.lat ?? el.center?.lat ?? null;
  const lon = el.lon ?? el.center?.lon ?? null;

  const socials: DiscoveredBusiness["socials"] = [];
  const pushSocial = (platform: SocialPlatform, url: string | null) => {
    if (url && !socials.some((s) => s.url === url)) socials.push({ platform, url });
  };
  for (const [tag, def] of Object.entries(SOCIAL_TAGS)) {
    if (t[tag]) pushSocial(def.platform, socialUrl(t[tag], def.base, def.platform));
  }

  let website = normalizeUrl(t.website ?? t["contact:website"] ?? t.url ?? null);
  if (website && !isOwnWebsite(website)) {
    const platform = socialPlatformFromUrl(website);
    if (platform) pushSocial(platform, website);
    website = null;
  }

  const street = t["addr:street"] ? [t["addr:street"], t["addr:housenumber"]].filter(Boolean).join(", ") : null;
  const postalCode = t["addr:postcode"] ?? null;
  const city = t["addr:city"] ?? areaCity(area);
  const address = [street, [postalCode, city].filter(Boolean).join(" ")].filter((s) => s && s.trim()).join(", ") || null;

  const categoryKey = CATEGORY_KEYS.find((k) => t[k]);
  const category = categoryKey ? osmCategoryLabel(t[categoryKey]!.split(";")[0]!) : null;

  return {
    provider: "osm",
    externalId: `${el.type}/${el.id}`,
    name,
    category,
    website,
    phone: normalizePhone(t.phone ?? t["contact:phone"] ?? t["contact:mobile"] ?? null),
    email: normalizeEmail(t.email ?? t["contact:email"] ?? null),
    street,
    postalCode,
    city,
    region: t["addr:province"] ?? t["addr:state"] ?? null,
    country: t["addr:country"] ?? area?.countryCode ?? null,
    address,
    latitude: lat,
    longitude: lon,
    openingHours: t.opening_hours ?? null,
    rating: null,
    reviewCount: null,
    mapsUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`,
    description: t.description ?? null,
    businessStatus: "unknown",
    socials,
    raw: el,
  };
}

/** How much usable contact data a record has; used to rank OSM results. */
export function completeness(b: DiscoveredBusiness): number {
  return (
    (b.website ? 3 : 0) +
    (b.phone ? 2 : 0) +
    (b.email ? 1 : 0) +
    (b.openingHours ? 1 : 0) +
    (b.street ? 1 : 0) +
    (b.socials.length > 0 ? 1 : 0)
  );
}

export function parseOverpassElements(elements: OverpassElement[], area: SearchArea | null): DiscoveredBusiness[] {
  const seen = new Set<string>();
  const out: DiscoveredBusiness[] = [];
  for (const el of elements) {
    const b = parseOverpassElement(el, area);
    if (!b || seen.has(b.externalId)) continue;
    seen.add(b.externalId);
    out.push(b);
  }
  // Stable sort: most complete first (OSM has no relevance order of its own)
  return out
    .map((b, i) => ({ b, i, c: completeness(b) }))
    .sort((x, y) => y.c - x.c || x.i - y.i)
    .map((x) => x.b);
}
