/**
 * Findings → commercial opportunities for an AI / automation consultancy.
 * An opportunity is created only when specific findings support it; its
 * evidence is the evidence of those findings. Confidence reflects how strong
 * that evidence is (an absence seen without running JavaScript is weaker
 * than a sentence quoted from the site).
 */
import type { FindingInput, OpportunityInput } from "../domain/types";
import type { ImpactLevel } from "../domain/constants";
import { OPPORTUNITY_TYPES, type FindingKey, type OpportunityType } from "./catalog";
import type { CompanyContext } from "./collect";
import { fmtPhone, type Facts } from "./facts";
import type { AnalysisSignals } from "./signals";

const IMPACT_WEIGHT: Record<ImpactLevel, number> = { high: 1, medium: 0.6, low: 0.3 };

export function opportunityWeight(o: Pick<OpportunityInput, "impact" | "confidence">): number {
  return IMPACT_WEIGHT[o.impact] * o.confidence;
}

const clamp = (v: number, lo = 0.2, hi = 0.95) => Math.round(Math.min(hi, Math.max(lo, v)) * 100) / 100;

export function buildOpportunities(
  ctx: CompanyContext,
  s: AnalysisSignals,
  f: Facts,
  findings: FindingInput[],
): OpportunityInput[] {
  if (f.closed === "permanently") return [];

  const byKey = new Map(findings.map((x) => [x.key, x]));
  const has = (k: FindingKey) => byKey.has(k);
  const ev = (...keys: FindingKey[]) =>
    keys
      .map((k) => byKey.get(k)?.evidence)
      .filter(Boolean)
      .join(" ");
  const out: OpportunityInput[] = [];
  const add = (type: OpportunityType, o: Omit<OpportunityInput, "type" | "title" | "serviceKey">) => {
    const def = OPPORTUNITY_TYPES[type];
    out.push({ type, title: def.title, serviceKey: def.serviceKey, ...o, confidence: clamp(o.confidence) });
  };

  // Absences are less certain when a tag manager may inject widgets, or few pages were readable.
  const absencePenalty = (f.hiddenScriptsPossible ? 0.1 : 0) + (f.pagesChecked < 2 ? 0.05 : 0);
  const busy = (ctx.reviewCount ?? 0) >= 50;
  const valuable = f.profile.economicValue >= 0.75;
  const hours = f.hoursText ? ` Horario publicado: ${f.hoursText}.` : "";

  // ── No usable website ──
  if (has("no_website") || has("website_social_only")) {
    add("no_website", {
      problem: has("no_website")
        ? `${ctx.name} no tiene página web registrada en ninguna fuente.`
        : `${ctx.name} usa un perfil de terceros como web.`,
      evidence: ev("no_website", "website_social_only"),
      consequence:
        "Los clientes que comparan opciones en Google no encuentran información, precios ni una forma de reservar o escribir; el negocio depende solo de llamadas y del boca a boca.",
      solution:
        "Web sencilla orientada a conversión: propuesta clara, botón de llamada y WhatsApp, formulario o reserva online y medición de contactos.",
      impact: busy || valuable ? "high" : "medium",
      impactNote: busy ? `Tiene ${ctx.reviewCount} reseñas: hay demanda que hoy no se aprovecha online.` : null,
      confidence: has("no_website") ? 0.7 : 0.8,
    });
  } else if (
    has("website_unreachable") ||
    has("website_invalid_certificate") ||
    has("website_http_error") ||
    has("website_parked") ||
    has("website_under_construction")
  ) {
    // Network failures and 5xx responses are often temporary outages; 4xx/parked pages are not.
    const transient = has("website_unreachable") || (has("website_http_error") && (s.website.httpStatus ?? 0) >= 500);
    add("website_down", {
      problem: has("website_invalid_certificate")
        ? "La web del negocio abre con un aviso de seguridad del navegador."
        : has("website_parked")
          ? "El dominio de la web muestra una página de dominio aparcado, no la web del negocio."
          : "La web del negocio no está operativa.",
      evidence: ev("website_unreachable", "website_invalid_certificate", "website_http_error", "website_parked", "website_under_construction"),
      consequence: has("website_parked")
        ? "Quien llega desde Google o la ficha del mapa no encuentra nada del negocio y busca otra opción."
        : "Quien llega desde Google o la ficha del mapa encuentra un error o una página vacía y busca otra opción.",
      solution: "Recuperar o rehacer la web con lo básico para convertir: servicios, teléfono clicable, WhatsApp y formulario o reserva.",
      impact: "high",
      impactNote: transient ? "Puede ser una caída temporal: verificar antes de contactar." : null,
      confidence: transient ? 0.55 : 0.85,
    });
  }

  // ── Booking ──
  if (has("phone_only_booking")) {
    add("manual_phone_booking", {
      problem: "Las citas dependen de que alguien atienda el teléfono.",
      evidence: ev("phone_only_booking"),
      consequence:
        "Las llamadas que llegan con la línea ocupada, durante una consulta o fuera de horario no se convierten en cita y rara vez se devuelven.",
      solution:
        "Recepcionista IA que atiende llamadas y mensajes 24/7, resuelve dudas frecuentes y agenda directamente en el calendario del negocio.",
      impact: "high",
      impactNote: hours ? hours.trim() : null,
      confidence: 0.8,
    });
  }
  if (has("no_online_booking")) {
    add("missing_online_booking", {
      problem: "No se puede reservar ni pedir cita desde la web.",
      evidence: ev("no_online_booking", "phone_only_booking"),
      consequence: `En ${f.profile.inSector} muchos clientes reservan fuera del horario de atención; si solo pueden llamar, una parte reserva con la competencia.`,
      solution: "Sistema de reserva online integrado en la web y en la ficha de Google, con confirmación y recordatorios automáticos para reducir ausencias.",
      impact: ["health", "beauty", "hospitality"].includes(f.profile.model) ? "high" : "medium",
      impactNote: busy ? `${ctx.reviewCount} reseñas indican un volumen de clientes en el que la reserva online ahorra muchas llamadas.` : null,
      confidence: 0.7 - absencePenalty,
    });
  }

  // ── Instant channels ──
  if (has("no_whatsapp")) {
    add("missing_whatsapp", {
      problem: "La web no ofrece WhatsApp como canal de contacto.",
      evidence: ev("no_whatsapp"),
      consequence:
        "Las consultas rápidas («¿tenéis hueco mañana?», «¿cuánto cuesta…?») de quien no quiere llamar no llegan, o llegan tarde por email.",
      solution:
        "WhatsApp Business conectado a la web con respuestas automáticas a preguntas frecuentes, captura del contacto y aviso al equipo.",
      impact: f.profile.bookingExpected ? "medium" : "low",
      impactNote: f.isMobilePhone && f.knownPhone ? `El número ${fmtPhone(f.knownPhone)} es un móvil: podría activarse con poco esfuerzo.` : null,
      confidence: 0.65 - absencePenalty,
    });
  }
  if (has("no_instant_channel") && (f.leadForms.length > 0 || s.contact.emails.length > 0 || f.phoneOnSite)) {
    const phoneHeavy = !f.leadForms.length && Boolean(f.phoneOnSite);
    add("no_instant_response", {
      problem: "Nadie responde al momento a quien contacta por la web.",
      evidence: ev("no_instant_channel") + hours,
      consequence:
        "Un lead que espera horas una respuesta suele haber contactado ya con otro negocio; la velocidad de respuesta es de lo que más influye en convertir una consulta.",
      solution: phoneHeavy
        ? "Asistente de voz/IA que atiende llamadas no contestadas y fuera de horario, y responde por SMS o WhatsApp."
        : "Asistente en la web y en WhatsApp que responde al instante, cualifica la consulta y pasa al equipo solo lo que requiere una persona.",
      impact: "medium",
      impactNote: null,
      confidence: 0.6 - absencePenalty,
    });
    if (phoneHeavy) out[out.length - 1]!.serviceKey = "ai_receptionist";
  }

  // ── Lead capture ──
  if (has("no_clear_cta") || has("no_contact_form")) {
    const both = has("no_clear_cta") && has("no_contact_form");
    add("weak_lead_capture", {
      problem: both
        ? "La web no invita a dar el siguiente paso ni permite dejar los datos."
        : has("no_clear_cta")
          ? "La página de inicio no tiene una llamada a la acción clara."
          : "No hay forma de dejar los datos en la web.",
      evidence: ev("no_clear_cta", "no_contact_form"),
      consequence: "La web recibe visitas pero no las convierte en contactos; el visitante interesado tiene que esforzarse para dar el paso.",
      solution:
        "Botones visibles (reservar, llamar, WhatsApp) en cada página y un formulario corto con respuesta automática inmediata.",
      impact: both ? "high" : "medium",
      impactNote: null,
      confidence: 0.7 - absencePenalty / 2,
    });
  }
  if (has("long_form")) {
    add("form_friction", {
      problem: "El formulario de contacto pide demasiados datos.",
      evidence: ev("long_form"),
      consequence: "Cada campo adicional hace que menos personas lo terminen; se pierden contactos que ya estaban interesados.",
      solution: "Formulario de 3–4 campos (nombre, teléfono, motivo) y cualificación posterior automatizada por WhatsApp o email.",
      impact: "low",
      impactNote: null,
      confidence: 0.7,
    });
  }

  // ── Follow-up and CRM ──
  if (has("runs_paid_ads") && (!f.hasInstantChannel || has("no_crm_signals"))) {
    add("paid_traffic_leak", {
      problem: "Paga por atraer visitas pero no se ve un sistema que responda y haga seguimiento de los contactos.",
      evidence: ev("runs_paid_ads", "no_instant_channel", "no_crm_signals"),
      consequence: "Parte del presupuesto en publicidad se pierde en leads que no reciben respuesta rápida ni seguimiento.",
      solution: "Respuesta automática inmediata a cada lead (WhatsApp/email), secuencia de seguimiento y registro en CRM para medir el retorno de los anuncios.",
      impact: "high",
      impactNote: "La inversión en anuncios indica presupuesto de marketing y facilita justificar el retorno.",
      confidence: 0.6 - absencePenalty,
    });
  }
  if (has("no_crm_signals")) {
    add("no_crm_followup", {
      problem: "No se ve ninguna herramienta para gestionar y seguir los contactos que llegan.",
      evidence: ev("no_crm_signals", "has_contact_form"),
      consequence: "Los contactos del formulario quedan en el buzón; sin recordatorios ni estados, los que no cierran en la primera respuesta se olvidan.",
      solution: "CRM sencillo conectado a la web y al WhatsApp, con estados, recordatorios y seguimiento automático.",
      impact: "medium",
      impactNote: "Confianza baja: un CRM puede usarse sin dejar rastro en la web; confirmar en la conversación.",
      confidence: 0.4,
    });
  }
  if (has("no_email_capture") && f.profile.repeatBusiness) {
    add("no_reactivation", {
      problem: "No construye una base de contactos para volver a atraer a clientes y leads antiguos.",
      evidence: ev("no_email_capture"),
      consequence:
        "Clientes que vinieron una vez y leads que no cerraron no vuelven a saber del negocio; en un negocio de clientes recurrentes es ingreso que se deja pasar.",
      solution: "Campañas automáticas de reactivación (revisiones, recordatorios, ofertas) por WhatsApp/email sobre la base de clientes existente.",
      impact: "medium",
      impactNote: null,
      confidence: 0.45,
    });
  }

  // ── Reputation ──
  if (has("low_rating")) {
    add("reputation_recovery", {
      problem: "La valoración media está por debajo de lo que los clientes suelen aceptar.",
      evidence: ev("low_rating"),
      consequence: "Al comparar en el mapa, una nota inferior a 4 hace que muchos descarten el negocio sin llegar a la web.",
      solution: "Pedir reseña automáticamente a clientes satisfechos tras cada servicio, detectar insatisfechos antes de que publiquen y responder a todas las reseñas.",
      impact: "high",
      impactNote: null,
      confidence: 0.85,
    });
  } else if (has("few_reviews")) {
    add("review_generation", {
      problem: "Tiene pocas reseñas para competir en el mapa.",
      evidence: ev("few_reviews"),
      consequence: "Los negocios con más reseñas aparecen antes y generan más confianza; con pocas, la ficha convierte menos.",
      solution: "Solicitud automática de reseñas por WhatsApp/SMS después de cada visita, con enlace directo a la ficha de Google.",
      impact: f.profile.bookingExpected ? "medium" : "low",
      impactNote: null,
      confidence: 0.8,
    });
  }

  // ── Website experience ──
  if (has("not_mobile_friendly") || has("poor_mobile_performance") || has("slow_response")) {
    const severe = byKey.get("not_mobile_friendly")?.severity === "high" || byKey.get("poor_mobile_performance")?.severity === "high";
    add("mobile_experience", {
      problem: has("not_mobile_friendly") ? "La web no está adaptada al móvil." : "La web carga lenta en móvil.",
      evidence: ev("not_mobile_friendly", "poor_mobile_performance", "slow_response"),
      consequence: "La mayoría de búsquedas de negocios locales se hacen desde el móvil; si la web se ve mal o tarda, el visitante vuelve atrás.",
      solution: "Rediseño o optimización móvil con botones de llamada y WhatsApp siempre visibles.",
      impact: severe ? "high" : "medium",
      impactNote: has("slow_response") && !has("poor_mobile_performance") ? "Velocidad estimada sin navegador: confirmar con PageSpeed." : null,
      confidence: has("poor_mobile_performance") || byKey.get("not_mobile_friendly")?.severity === "high" ? 0.8 : 0.5,
    });
  }
  if (has("unclear_value_proposition") && !out.some((o) => o.type === "weak_lead_capture" && o.impact === "high")) {
    add("unclear_offer", {
      problem: "La página de inicio no explica claramente qué ofrece y por qué elegir al negocio.",
      evidence: ev("unclear_value_proposition"),
      consequence: "El visitante tarda en entender si está en el sitio correcto y una parte abandona antes de contactar.",
      solution: "Titular con el servicio principal y la zona, beneficios concretos y una llamada a la acción visible.",
      impact: "low",
      impactNote: null,
      confidence: 0.55,
    });
  }

  if (f.closed === "temporarily") for (const o of out) o.impactNote = [o.impactNote, "Negocio cerrado temporalmente."].filter(Boolean).join(" ");

  return out.sort((a, b) => opportunityWeight(b) - opportunityWeight(a));
}
