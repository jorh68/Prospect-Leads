/**
 * Stable keys and labels for findings and opportunities. Dashboards and
 * filters (module C) group by these keys, so a key's label never changes per
 * instance. Plain constants: safe to import from client and server code.
 */
import type { FindingCategory, FindingKind, ServiceKey } from "../domain/constants";

interface FindingDef {
  label: string;
  category: FindingCategory;
  kind: FindingKind;
}

export const FINDINGS = {
  // ── Website presence ──
  no_website: { label: "Sin página web", category: "website", kind: "issue" },
  website_social_only: { label: "Usa una red social como web", category: "website", kind: "issue" },
  website_unreachable: { label: "La web no responde", category: "technical", kind: "issue" },
  website_http_error: { label: "La web devuelve un error", category: "technical", kind: "issue" },
  website_blocked: { label: "La web bloquea el análisis automático", category: "technical", kind: "neutral" },
  website_parked: { label: "Dominio aparcado o en venta", category: "website", kind: "issue" },
  website_under_construction: { label: "Web en construcción", category: "website", kind: "issue" },
  website_platform: { label: "Plataforma de la web", category: "website", kind: "neutral" },
  missing_legal_pages: { label: "Faltan textos legales", category: "website", kind: "issue" },

  // ── Content / value proposition ──
  unclear_value_proposition: { label: "Propuesta de valor poco clara", category: "content", kind: "issue" },
  clear_value_proposition: { label: "Propuesta de valor visible", category: "content", kind: "positive" },
  missing_meta_description: { label: "Sin meta descripción", category: "content", kind: "issue" },
  thin_content: { label: "Poco contenido en la web", category: "content", kind: "issue" },
  outdated_site: { label: "Web aparentemente desactualizada", category: "content", kind: "issue" },
  has_testimonials: { label: "Muestra testimonios de clientes", category: "content", kind: "positive" },
  business_closed: { label: "Negocio marcado como cerrado", category: "content", kind: "issue" },

  // ── Lead capture ──
  no_clear_cta: { label: "Sin llamada a la acción clara", category: "lead_capture", kind: "issue" },
  has_clear_cta: { label: "Llamada a la acción clara", category: "lead_capture", kind: "positive" },
  no_contact_form: { label: "Sin formulario de contacto", category: "lead_capture", kind: "issue" },
  has_contact_form: { label: "Formulario de contacto", category: "lead_capture", kind: "positive" },
  long_form: { label: "Formulario largo", category: "lead_capture", kind: "issue" },
  no_crm_signals: { label: "Sin CRM ni automatización visibles", category: "lead_capture", kind: "issue" },
  has_crm_marketing: { label: "Usa herramientas de CRM / marketing", category: "lead_capture", kind: "positive" },
  no_email_capture: { label: "Sin captación de email", category: "lead_capture", kind: "issue" },
  has_lead_magnet: { label: "Ofrece un gancho de captación", category: "lead_capture", kind: "positive" },
  runs_paid_ads: { label: "Invierte en publicidad online", category: "lead_capture", kind: "neutral" },

  // ── Booking ──
  no_online_booking: { label: "Sin reserva online", category: "booking", kind: "issue" },
  phone_only_booking: { label: "Citas solo por teléfono", category: "booking", kind: "issue" },
  has_online_booking: { label: "Reserva online", category: "booking", kind: "positive" },

  // ── Contact channels ──
  no_whatsapp: { label: "Sin WhatsApp en la web", category: "contact", kind: "issue" },
  has_whatsapp: { label: "WhatsApp en la web", category: "contact", kind: "positive" },
  no_instant_channel: { label: "Sin canal de respuesta inmediata", category: "contact", kind: "issue" },
  has_chat: { label: "Chat en la web", category: "contact", kind: "positive" },
  phone_not_visible: { label: "Teléfono no visible en la web", category: "contact", kind: "issue" },
  no_click_to_call: { label: "Teléfono no clicable", category: "contact", kind: "issue" },
  has_click_to_call: { label: "Teléfono clicable", category: "contact", kind: "positive" },
  free_email_domain: { label: "Email genérico (gmail, hotmail…)", category: "contact", kind: "issue" },

  // ── Technical ──
  no_https: { label: "Sin HTTPS", category: "technical", kind: "issue" },
  has_https: { label: "HTTPS activo", category: "technical", kind: "positive" },
  no_https_redirect: { label: "HTTP no redirige a HTTPS", category: "technical", kind: "issue" },
  mixed_content: { label: "Recursos inseguros (contenido mixto)", category: "technical", kind: "issue" },
  slow_response: { label: "Carga lenta", category: "technical", kind: "issue" },
  heavy_page: { label: "Página muy pesada", category: "technical", kind: "issue" },
  broken_pages: { label: "Enlaces internos rotos", category: "technical", kind: "issue" },
  no_analytics: { label: "Sin analítica web", category: "technical", kind: "issue" },
  has_analytics: { label: "Analítica web instalada", category: "technical", kind: "positive" },
  tracking_without_consent: { label: "Seguimiento sin aviso de cookies", category: "technical", kind: "issue" },
  images_without_alt: { label: "Imágenes sin texto alternativo", category: "technical", kind: "issue" },

  // ── Mobile ──
  not_mobile_friendly: { label: "No adaptada a móvil", category: "mobile", kind: "issue" },
  mobile_viewport: { label: "Preparada para móvil (viewport)", category: "mobile", kind: "positive" },
  poor_mobile_performance: { label: "Rendimiento móvil bajo", category: "mobile", kind: "issue" },
  good_mobile_performance: { label: "Buen rendimiento móvil", category: "mobile", kind: "positive" },

  // ── Social ──
  no_social_links: { label: "Sin redes sociales enlazadas", category: "social", kind: "issue" },
  has_social_links: { label: "Redes sociales enlazadas", category: "social", kind: "positive" },

  // ── Reputation ──
  low_rating: { label: "Valoración baja", category: "reputation", kind: "issue" },
  good_rating: { label: "Buena valoración", category: "reputation", kind: "positive" },
  few_reviews: { label: "Pocas reseñas", category: "reputation", kind: "issue" },
  many_reviews: { label: "Volumen alto de reseñas", category: "reputation", kind: "positive" },
  no_review_data: { label: "Sin datos de reseñas", category: "reputation", kind: "neutral" },
  has_review_widget: { label: "Muestra reseñas en la web", category: "reputation", kind: "positive" },
} as const satisfies Record<string, FindingDef>;

export type FindingKey = keyof typeof FINDINGS;

/** Labels of the keys that represent problems ("Problema detectado" filter). */
export const FINDING_ISSUE_LABELS = Object.fromEntries(
  Object.entries(FINDINGS)
    .filter(([, d]) => d.kind === "issue")
    .map(([k, d]) => [k, d.label]),
) as Record<string, string>;

interface OpportunityDef {
  title: string;
  serviceKey: ServiceKey;
}

export const OPPORTUNITY_TYPES = {
  no_website: { title: "Crear una web que capte clientes", serviceKey: "website_improvement" },
  website_down: { title: "Recuperar una web que no funciona", serviceKey: "website_improvement" },
  missing_online_booking: { title: "Reserva online 24/7", serviceKey: "online_booking" },
  manual_phone_booking: { title: "Citas que dependen del teléfono", serviceKey: "ai_receptionist" },
  missing_whatsapp: { title: "WhatsApp como canal de captación", serviceKey: "whatsapp_automation" },
  no_instant_response: { title: "Respuesta inmediata a nuevos contactos", serviceKey: "chatbot" },
  weak_lead_capture: { title: "Captación de leads en la web", serviceKey: "lead_capture" },
  form_friction: { title: "Formulario con demasiada fricción", serviceKey: "lead_capture" },
  paid_traffic_leak: { title: "Tráfico de pago sin seguimiento", serviceKey: "lead_followup" },
  no_crm_followup: { title: "Seguimiento comercial sin CRM visible", serviceKey: "crm_setup" },
  no_reactivation: { title: "Reactivar clientes y leads antiguos", serviceKey: "lead_reactivation" },
  review_generation: { title: "Conseguir más reseñas", serviceKey: "review_management" },
  reputation_recovery: { title: "Mejorar la reputación online", serviceKey: "review_management" },
  mobile_experience: { title: "Experiencia móvil que no convierte", serviceKey: "website_improvement" },
  unclear_offer: { title: "Propuesta poco clara en la web", serviceKey: "website_improvement" },
} as const satisfies Record<string, OpportunityDef>;

export type OpportunityType = keyof typeof OPPORTUNITY_TYPES;
