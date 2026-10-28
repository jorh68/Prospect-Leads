/**
 * Shared vocabulary for the whole app. Database columns store the keys;
 * the UI shows the Spanish labels. Add values here (never inline strings)
 * so every module, filter and badge stays in sync.
 */

// ── CRM ──────────────────────────────────────────────────────────

export const CRM_STATUSES = [
  "new",
  "analyzed",
  "priority",
  "contacted",
  "replied",
  "meeting",
  "proposal",
  "won",
  "lost",
] as const;
export type CrmStatus = (typeof CRM_STATUSES)[number];

export const CRM_STATUS_LABELS: Record<CrmStatus, string> = {
  new: "Nueva",
  analyzed: "Analizada",
  priority: "Prioritaria",
  contacted: "Contactada",
  replied: "Respondió",
  meeting: "Reunión",
  proposal: "Propuesta",
  won: "Ganada",
  lost: "Perdida",
};

/** Statuses that count as "open pipeline" (not closed). */
export const CRM_OPEN_STATUSES: CrmStatus[] = [
  "new",
  "analyzed",
  "priority",
  "contacted",
  "replied",
  "meeting",
  "proposal",
];

// ── Discovery ────────────────────────────────────────────────────

export const PROVIDERS = ["google_places", "osm", "website"] as const;
export type Provider = (typeof PROVIDERS)[number];

export const PROVIDER_LABELS: Record<Provider, string> = {
  google_places: "Google Places",
  osm: "OpenStreetMap",
  website: "Web de la empresa",
};

export const SEARCH_STATUSES = ["pending", "running", "completed", "partial", "failed"] as const;
export type SearchStatus = (typeof SEARCH_STATUSES)[number];

export const SEARCH_STATUS_LABELS: Record<SearchStatus, string> = {
  pending: "En cola",
  running: "Buscando",
  completed: "Completada",
  partial: "Parcial",
  failed: "Error",
};

export const MAX_SEARCH_COUNT = 200;

// ── Analysis ─────────────────────────────────────────────────────

export const ANALYSIS_STATUSES = ["none", "queued", "running", "completed", "failed"] as const;
export type AnalysisStatus = (typeof ANALYSIS_STATUSES)[number];

export const ANALYSIS_STATUS_LABELS: Record<AnalysisStatus, string> = {
  none: "Sin analizar",
  queued: "En cola",
  running: "Analizando",
  completed: "Analizada",
  failed: "Error",
};

export const FINDING_CATEGORIES = [
  "website",
  "contact",
  "booking",
  "lead_capture",
  "technical",
  "mobile",
  "social",
  "reputation",
  "content",
] as const;
export type FindingCategory = (typeof FINDING_CATEGORIES)[number];

export const FINDING_CATEGORY_LABELS: Record<FindingCategory, string> = {
  website: "Web",
  contact: "Contacto",
  booking: "Reservas",
  lead_capture: "Captación",
  technical: "Técnico",
  mobile: "Móvil",
  social: "Redes",
  reputation: "Reputación",
  content: "Contenido",
};

export const FINDING_KINDS = ["positive", "neutral", "issue"] as const;
export type FindingKind = (typeof FINDING_KINDS)[number];

export const SEVERITIES = ["info", "low", "medium", "high"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const SEVERITY_LABELS: Record<Severity, string> = {
  info: "Info",
  low: "Baja",
  medium: "Media",
  high: "Alta",
};

export const IMPACT_LEVELS = ["low", "medium", "high"] as const;
export type ImpactLevel = (typeof IMPACT_LEVELS)[number];

export const IMPACT_LABELS: Record<ImpactLevel, string> = {
  low: "Bajo",
  medium: "Medio",
  high: "Alto",
};

// ── Services we can offer ────────────────────────────────────────
// Opportunities point to one of these; dashboards and filters group by them.

export const SERVICES = {
  ai_receptionist: {
    label: "Recepcionista IA / gestión de llamadas",
    description: "Atiende llamadas y mensajes fuera de horario, cualifica y agenda.",
  },
  whatsapp_automation: {
    label: "WhatsApp Business automatizado",
    description: "Canal de WhatsApp con respuestas inmediatas, recordatorios y seguimiento.",
  },
  online_booking: {
    label: "Reserva online",
    description: "Sistema de citas integrado en la web con confirmaciones automáticas.",
  },
  lead_capture: {
    label: "Captación de leads",
    description: "Formularios optimizados, llamadas a la acción claras y respuesta inmediata.",
  },
  lead_followup: {
    label: "Seguimiento automático de leads",
    description: "Secuencias de seguimiento para no perder contactos que no cierran.",
  },
  lead_reactivation: {
    label: "Reactivación de clientes antiguos",
    description: "Campañas para recuperar leads y clientes inactivos.",
  },
  crm_setup: {
    label: "Implantación de CRM",
    description: "Centralizar contactos, oportunidades y seguimiento comercial.",
  },
  review_management: {
    label: "Gestión de reseñas",
    description: "Pedir reseñas a clientes satisfechos y responder a todas a tiempo.",
  },
  chatbot: {
    label: "Chat / asistente web",
    description: "Asistente en la web que resuelve dudas y capta contactos 24/7.",
  },
  website_improvement: {
    label: "Mejora de web y conversión",
    description: "Propuesta clara, velocidad, experiencia móvil y conversión.",
  },
  process_automation: {
    label: "Automatización de procesos",
    description: "Eliminar tareas manuales repetitivas (altas, recordatorios, informes).",
  },
} as const;
export type ServiceKey = keyof typeof SERVICES;
export const SERVICE_KEYS = Object.keys(SERVICES) as ServiceKey[];

// ── Outreach ─────────────────────────────────────────────────────

export const MESSAGE_CHANNELS = ["email", "linkedin", "whatsapp"] as const;
export type MessageChannel = (typeof MESSAGE_CHANNELS)[number];

export const MESSAGE_CHANNEL_LABELS: Record<MessageChannel, string> = {
  email: "Email",
  linkedin: "LinkedIn",
  whatsapp: "WhatsApp",
};

/** How a piece of text was produced. Shown to the user for transparency. */
export const GENERATORS = ["rules", "llm"] as const;
export type Generator = (typeof GENERATORS)[number];

// ── Social ───────────────────────────────────────────────────────

export const SOCIAL_PLATFORMS = [
  "facebook",
  "instagram",
  "linkedin",
  "x",
  "tiktok",
  "youtube",
  "whatsapp",
  "other",
] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export const SOCIAL_PLATFORM_LABELS: Record<SocialPlatform, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  x: "X / Twitter",
  tiktok: "TikTok",
  youtube: "YouTube",
  whatsapp: "WhatsApp",
  other: "Otra",
};

// ── Activity log ─────────────────────────────────────────────────

export const ACTIVITY_TYPES = [
  "search_created",
  "search_completed",
  "search_failed",
  "company_discovered",
  "analysis_completed",
  "analysis_failed",
  "status_changed",
  "note_added",
  "followup_set",
  "owner_changed",
  "message_generated",
  "report_generated",
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

// ── Jobs ─────────────────────────────────────────────────────────

export const JOB_TYPES = ["discovery", "analysis"] as const;
export type JobType = (typeof JOB_TYPES)[number];

export const JOB_STATUSES = ["queued", "running", "completed", "failed"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];
