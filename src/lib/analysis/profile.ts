/**
 * Business-model profile inferred from the niche/category. It decides which
 * gaps matter (a dental clinic without online booking is a real problem; a
 * law firm without it is not) and feeds the "economic potential" factor.
 * Heuristic by design — the score explanation says so.
 */
import { normalizeText } from "../text";

export type BusinessModel =
  | "health"
  | "beauty"
  | "fitness_education"
  | "hospitality"
  | "professional"
  | "home_services"
  | "retail"
  | "generic";

export interface BusinessProfile {
  model: BusinessModel;
  label: string;
  /** Sector as it reads inside a sentence: "En {inSector} muchos clientes…" */
  inSector: string;
  /** Customers normally book a time slot (appointments, tables, rooms, classes) */
  bookingExpected: boolean;
  /** Customers come back (check-ups, treatments, memberships): reactivation pays off */
  repeatBusiness: boolean;
  /** 0..1 — typical value of a new customer, relative to other niches */
  economicValue: number;
}

const PROFILES: Record<BusinessModel, Omit<BusinessProfile, "model">> = {
  health: { label: "Salud / clínica", inSector: "el sector salud", bookingExpected: true, repeatBusiness: true, economicValue: 0.9 },
  beauty: { label: "Belleza y cuidado personal", inSector: "belleza y cuidado personal", bookingExpected: true, repeatBusiness: true, economicValue: 0.6 },
  fitness_education: { label: "Deporte / formación", inSector: "deporte y formación", bookingExpected: true, repeatBusiness: true, economicValue: 0.6 },
  hospitality: { label: "Hostelería y alojamiento", inSector: "hostelería", bookingExpected: true, repeatBusiness: true, economicValue: 0.5 },
  professional: { label: "Servicios profesionales", inSector: "servicios profesionales", bookingExpected: false, repeatBusiness: false, economicValue: 0.85 },
  home_services: { label: "Servicios para el hogar", inSector: "servicios para el hogar", bookingExpected: false, repeatBusiness: false, economicValue: 0.75 },
  retail: { label: "Comercio", inSector: "comercio", bookingExpected: false, repeatBusiness: true, economicValue: 0.4 },
  generic: { label: "Negocio local", inSector: "un negocio local", bookingExpected: false, repeatBusiness: false, economicValue: 0.5 },
};

const RULES: [BusinessModel, RegExp][] = [
  [
    "health",
    /\b(dental|dentist\w*|odontolog\w*|ortodonc\w*|clinica\w*|clinic\w*|medic\w*|doctor\w*|fisio\w*|physio\w*|psicolog\w*|psychol\w*|podolog\w*|optic\w*|optica\w*|veterinari\w*|vet|nutricion\w*|dietist\w*|fertilidad|oftalmolog\w*|dermatolog\w*|estetica medica|cirugia|audiolog\w*|osteopat\w*|logoped\w*|hospital\w*|pharmacy|farmacia)\b/,
  ],
  [
    "beauty",
    /\b(peluquer\w*|barber\w*|hair\w*|beauty|belleza|estetica|unas|nail\w*|spa|masaj\w*|massage|tattoo|tatuaj\w*|depilaci\w*|cosmetic\w*)\b/,
  ],
  [
    "fitness_education",
    /\b(gimnasio\w*|gym|fitness|yoga|pilates|crossfit|entrenador\w*|academia\w*|autoescuela\w*|escuela\w*|school|idiomas|danza|dance|clases)\b/,
  ],
  [
    "hospitality",
    /\b(restaurante\w*|restaurant\w*|bar|bares|cafe|cafeteria\w*|hotel\w*|hostal\w*|apartamento\w*|alojamiento\w*|catering|pizzeria\w*|marisqueria\w*|asador\w*|guest ?house|hostel)\b/,
  ],
  [
    "professional",
    /\b(abogad\w*|lawyer\w*|law firm|asesor\w*|gestor\w*|consultor\w*|consulting|arquitect\w*|inmobiliari\w*|real estate|notari\w*|seguros?|insurance|contab\w*|accountant\w*|agencia\w*|marketing|ingenier\w*)\b/,
  ],
  [
    "home_services",
    /\b(reforma\w*|fontaner\w*|plumb\w*|electricist\w*|electric\w*|cerrajer\w*|locksmith|climatizaci\w*|aire acondicionado|pintor\w*|carpinter\w*|limpieza|cleaning|jardiner\w*|mudanza\w*|taller\w*|mecanic\w*|car repair|instalador\w*|solar|placas solares|construcci\w*|tejad\w*)\b/,
  ],
  ["retail", /\b(tienda\w*|shop|store|boutique|floristeria\w*|libreria\w*|ferreteria\w*|supermercado\w*|joyeria\w*|zapateria\w*)\b/],
];

export function businessProfile(...labels: (string | null | undefined)[]): BusinessProfile {
  const text = normalizeText(labels.filter(Boolean).join(" ").replace(/_/g, " "));
  for (const [model, re] of RULES) {
    if (re.test(text)) return { model, ...PROFILES[model] };
  }
  return { model: "generic", ...PROFILES.generic };
}
