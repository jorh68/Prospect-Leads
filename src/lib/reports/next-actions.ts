import { formatDate } from "../format";

/**
 * Suggested next steps for a company, derived only from its real state
 * (analysis, opportunities, contact data, CRM fields). Rules, not AI.
 */
export interface NextActionInput {
  crmStatus: string;
  nextAction: string | null;
  followUpAt: Date | null;
  analysisStatus: string;
  hasAnalysis: boolean;
  opportunityCount: number;
  hasMessages: boolean;
  hasReport: boolean;
  email: string | null;
  phone: string | null;
  hasLinkedin: boolean;
  businessStatus: string | null;
  now?: Date;
}

export interface NextAction {
  label: string;
  detail?: string;
  tone: "default" | "warning";
  /** In-page anchor or route the action points to */
  href?: string;
}

/** Spanish mobile numbers (6xx / 7xx) can receive WhatsApp. */
export function isSpanishMobile(phone: string | null): boolean {
  if (!phone) return false;
  const digits = phone.replace(/\D/g, "");
  const local = digits.length === 11 && digits.startsWith("34") ? digits.slice(2) : digits;
  return local.length === 9 && /^[67]/.test(local);
}

const NOT_CONTACTED = new Set(["new", "analyzed", "priority"]);

export function deriveNextActions(input: NextActionInput): NextAction[] {
  const now = input.now ?? new Date();
  const actions: NextAction[] = [];

  if (input.businessStatus === "closed_permanently" || input.businessStatus === "closed_temporarily") {
    actions.push({
      tone: "warning",
      label: input.businessStatus === "closed_permanently" ? "La fuente indica cierre definitivo" : "La fuente indica cierre temporal",
      detail: "Confírmalo antes de dedicarle tiempo.",
    });
  }

  if (input.nextAction || input.followUpAt) {
    const overdue = input.followUpAt != null && input.followUpAt.getTime() < now.getTime();
    actions.push({
      tone: overdue ? "warning" : "default",
      label: input.nextAction ?? "Seguimiento programado",
      detail: input.followUpAt
        ? overdue
          ? `Seguimiento vencido desde el ${formatDate(input.followUpAt)}`
          : `Seguimiento el ${formatDate(input.followUpAt)}`
        : "Sin fecha de seguimiento",
    });
  } else if (input.crmStatus === "contacted") {
    actions.push({ tone: "default", label: "Programar un seguimiento", detail: "Ya está contactada y no tiene fecha de seguimiento." });
  }

  switch (input.analysisStatus) {
    case "queued":
    case "running":
      actions.push({ tone: "default", label: "Análisis en curso", detail: "La ficha se actualizará al terminar.", href: "#analisis" });
      break;
    case "failed":
      actions.push({ tone: "warning", label: "Revisar el error del análisis y reintentar", href: "#analisis" });
      break;
    default:
      if (!input.hasAnalysis) {
        actions.push({ tone: "default", label: "Analizar la web y la presencia digital", detail: "Necesario para detectar oportunidades.", href: "#analisis" });
      }
  }

  if (input.hasAnalysis) {
    if (input.opportunityCount === 0) {
      actions.push({
        tone: "default",
        label: "Sin oportunidades claras",
        detail: "Valora descartarla o revisa la web manualmente.",
      });
    } else if (!input.hasMessages) {
      actions.push({ tone: "default", label: "Preparar el mensaje de contacto", detail: "Basado en la oportunidad principal.", href: "#mensajes" });
    } else if (NOT_CONTACTED.has(input.crmStatus)) {
      const channel = input.email
        ? "por email"
        : isSpanishMobile(input.phone)
          ? "por WhatsApp"
          : input.hasLinkedin
            ? "por LinkedIn"
            : input.phone
              ? "por teléfono"
              : null;
      if (channel) {
        actions.push({ tone: "default", label: `Enviar el primer contacto ${channel}`, detail: "El mensaje está preparado.", href: "#mensajes" });
      }
    }
  }

  if ((input.crmStatus === "replied" || input.crmStatus === "meeting") && !input.hasReport && input.hasAnalysis) {
    actions.push({ tone: "default", label: "Generar el informe para la reunión", href: "#informes" });
  }

  if (!input.email && !input.phone) {
    actions.push({ tone: "warning", label: "Buscar un contacto directo", detail: "No hay email ni teléfono en las fuentes consultadas." });
  }

  return actions;
}
