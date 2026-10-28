/**
 * Priority score (0–100): how worthwhile it looks to contact this company
 * first. It is a HEURISTIC, not a measurement — a weighted sum of six
 * factors, each normalised to 0..1 and explained in plain Spanish so the
 * company page can show "¿Por qué esta nota?".
 *
 *   opportunities      35 %  impact × confidence of the detected opportunities
 *   size_activity      20 %  review volume / rating (or indirect signals)
 *   digital_gap        15 %  how much of the basic digital toolkit is missing
 *   reachability       15 %  phone, email, WhatsApp, form, socials available
 *   economic_potential 10 %  typical customer value in this kind of business
 *   confidence          5 %  how complete the data behind the analysis is
 */
import type { OpportunityInput, ScoreFactor } from "../domain/types";
import type { CompanyContext } from "./collect";
import { listEs, type Facts } from "./facts";
import { opportunityWeight } from "./opportunities";
import type { AnalysisSignals } from "./signals";

export const SCORE_WEIGHTS = {
  opportunities: 0.35,
  size_activity: 0.2,
  digital_gap: 0.15,
  reachability: 0.15,
  economic_potential: 0.1,
  confidence: 0.05,
} as const;

export const SCORE_DISCLAIMER =
  "Puntuación heurística de prioridad comercial (0–100): combina factores ponderados a partir de los datos encontrados. Sirve para ordenar empresas, no es una medida exacta.";

const round1 = (n: number) => Math.round(n * 10) / 10;
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const pct = (n: number) => `${Math.round(n * 100)} %`;

function factor(key: keyof typeof SCORE_WEIGHTS, label: string, value: number, explanation: string): ScoreFactor {
  const weight = SCORE_WEIGHTS[key];
  const v = Math.round(clamp01(value) * 1000) / 1000;
  return { factor: key, label, weight, value: v, points: round1(weight * v * 100), explanation };
}

export function computeScore(
  ctx: CompanyContext,
  s: AnalysisSignals,
  f: Facts,
  opportunities: OpportunityInput[],
): { total: number; breakdown: ScoreFactor[] } {
  const breakdown: ScoreFactor[] = [];

  // 1. Opportunities: two strong, well-evidenced opportunities fill the factor.
  const oppSum = opportunities.reduce((n, o) => n + opportunityWeight(o), 0);
  const high = opportunities.filter((o) => o.impact === "high").length;
  breakdown.push(
    factor(
      "opportunities",
      "Oportunidades detectadas",
      oppSum / 2,
      opportunities.length === 0
        ? "No se detectaron oportunidades con evidencia suficiente."
        : `${opportunities.length} oportunidad(es), ${high} de impacto alto. Se suma impacto × confianza de cada una (2,0 = máximo); suma actual ${oppSum.toLocaleString("es-ES", { maximumFractionDigits: 2 })}.`,
    ),
  );

  // 2. Size / activity: review volume on a log scale (500 reviews ≈ max).
  if (ctx.reviewCount != null) {
    const volume = Math.log10(ctx.reviewCount + 1) / Math.log10(500);
    const ratingBoost = ctx.rating != null && ctx.rating >= 4 ? 0.1 : 0;
    breakdown.push(
      factor(
        "size_activity",
        "Tamaño y actividad aparente",
        volume + ratingBoost,
        `${ctx.reviewCount} reseñas${ctx.rating != null ? ` (nota ${ctx.rating.toLocaleString("es-ES")})` : ""} en ${f.reviewSourceLabel}. Escala logarítmica: ~500 reseñas = máximo. Las reseñas son un indicador indirecto del volumen de clientes.`,
      ),
    );
  } else {
    const signals: [string, number, boolean][] = [
      ["web operativa", 0.1, f.reachable],
      [`${f.socialPlatforms.length} redes sociales`, 0.1, f.socialPlatforms.length >= 2],
      ["web con contenido amplio", 0.05, s.content.wordCount > 500 || s.pages.length >= 4],
      ["invierte en publicidad", 0.1, s.tracking.adPixels.length > 0],
    ];
    const present = signals.filter(([, , ok]) => ok);
    const proxies = present.map(([label]) => label);
    const v = 0.2 + present.reduce((n, [, w]) => n + w, 0);
    breakdown.push(
      factor(
        "size_activity",
        "Tamaño y actividad aparente",
        Math.min(v, 0.55),
        `Sin datos de reseñas: valor estimado con señales indirectas${proxies.length ? ` (${listEs(proxies)})` : ""}. Limitado al 55 % por falta de datos.`,
      ),
    );
  }

  // 3. Digital gap: share of the basic toolkit that is missing.
  if (!f.hasOwnSite || !f.reachable) {
    const known = f.blocked || Boolean(s.website.mismatch);
    breakdown.push(
      factor(
        "digital_gap",
        "Margen de mejora digital",
        known ? 0.5 : 1,
        known
          ? s.website.mismatch
            ? "La web registrada parece de otro negocio: margen desconocido, se asigna un valor neutro (50 %)."
            : "La web bloquea el análisis: margen desconocido, se asigna un valor neutro (50 %)."
          : "Sin web operativa: falta todo el kit digital básico.",
      ),
    );
  } else {
    const checks: [string, boolean][] = [
      ["HTTPS", s.website.https === true],
      ["adaptada a móvil", s.mobile.responsive],
      ["llamada a la acción", f.strongCtas.length > 0],
      ["formulario o captura de datos", f.capturesData],
      ["WhatsApp o chat", f.hasInstantChannel],
      ["analítica", s.tracking.analytics.length > 0],
      ["CRM / email marketing", s.tracking.crmMarketing.length > 0],
      ["redes sociales", f.socialPlatforms.length > 0],
    ];
    if (f.profile.bookingExpected) checks.push(["reserva online", f.hasBooking]);
    const missing = checks.filter(([, ok]) => !ok).map(([n]) => n);
    breakdown.push(
      factor(
        "digital_gap",
        "Margen de mejora digital",
        missing.length / checks.length,
        missing.length === 0
          ? `Tiene los ${checks.length} elementos básicos revisados: poco margen evidente.`
          : `Le faltan ${missing.length} de ${checks.length} elementos básicos: ${listEs(missing)}.`,
      ),
    );
  }

  // 4. Reachability: can we actually start a conversation?
  const channels: [string, number, boolean][] = [
    ["teléfono", 0.35, Boolean(f.knownPhone)],
    ["email", 0.3, Boolean(ctx.email || s.contact.emails.length)],
    ["móvil/WhatsApp", 0.15, f.isMobilePhone || f.hasWhatsapp],
    ["formulario", 0.1, f.capturesData],
    ["redes sociales", 0.1, f.socialPlatforms.length > 0],
  ];
  const reach = channels.reduce((n, [, w, ok]) => n + (ok ? w : 0), 0);
  const available = channels.filter(([, , ok]) => ok).map(([n]) => n);
  breakdown.push(
    factor(
      "reachability",
      "Facilidad de contacto",
      reach,
      available.length ? `Canales disponibles: ${listEs(available)}.` : "No se encontró ningún canal de contacto directo.",
    ),
  );

  // 5. Economic potential of the niche.
  breakdown.push(
    factor(
      "economic_potential",
      "Potencial económico del sector",
      f.profile.economicValue,
      `Sector «${f.profile.label}»: valor típico de cliente estimado en ${pct(f.profile.economicValue)} respecto a otros sectores. Estimación general, no del negocio concreto.`,
    ),
  );

  // 6. Confidence: how much real data supports this analysis.
  const parts: [string, number, boolean][] = [
    ["web revisada", 0.5, f.reachable || !f.hasOwnSite],
    ["datos de reseñas", 0.25, ctx.reviewCount != null || ctx.rating != null],
    ["varias páginas", 0.15, f.pagesChecked >= 2 || !f.hasOwnSite],
    ["métricas PageSpeed", 0.1, s.technical.pageSpeed != null],
  ];
  const conf = parts.reduce((n, [, w, ok]) => n + (ok ? w : 0), 0);
  const missingData = parts.filter(([, , ok]) => !ok).map(([n]) => n);
  breakdown.push(
    factor(
      "confidence",
      "Confianza en el análisis",
      conf,
      missingData.length ? `Faltan: ${listEs(missingData)}.` : "Análisis con todas las fuentes de datos disponibles.",
    ),
  );

  let total = breakdown.reduce((n, x) => n + x.points, 0);

  if (f.closed) {
    const penalty = f.closed === "permanently" ? total : total / 2;
    breakdown.push({
      factor: "business_status",
      label: "Estado del negocio",
      weight: 0,
      value: 0,
      points: -round1(penalty),
      explanation:
        f.closed === "permanently"
          ? "Las fuentes lo marcan como cerrado permanentemente: la prioridad se anula."
          : "Las fuentes lo marcan como cerrado temporalmente: la prioridad se reduce a la mitad.",
    });
    total -= penalty;
  }

  return { total: Math.max(0, Math.min(100, Math.round(total))), breakdown };
}
