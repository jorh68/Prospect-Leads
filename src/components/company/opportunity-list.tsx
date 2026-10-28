import { ChevronRight } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { IMPACT_LABELS, type ImpactLevel } from "@/lib/domain/constants";
import { confidenceLabel } from "@/lib/reports/priority";
import { serviceLabel } from "@/lib/reports/services";

const IMPACT_TONES: Record<string, BadgeTone> = { high: "accent", medium: "neutral", low: "outline" };

export function ImpactBadge({ impact }: { impact: string }) {
  return <Badge tone={IMPACT_TONES[impact] ?? "neutral"}>Impacto {IMPACT_LABELS[impact as ImpactLevel]?.toLowerCase() ?? impact}</Badge>;
}

export function ConfidenceText({ confidence }: { confidence: number }) {
  return (
    <span className="whitespace-nowrap text-2xs text-ink-3" title={`Confianza estimada ${Math.round(confidence * 100)} %`}>
      Confianza {confidenceLabel(confidence).toLowerCase()}
    </span>
  );
}

interface OpportunityRow {
  id: string;
  title: string;
  problem: string;
  evidence: string;
  consequence: string;
  solution: string;
  serviceKey: string;
  impact: string;
  impactNote: string | null;
  confidence: number;
}

function Part({ label, children, evidence = false }: { label: string; children: string; evidence?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-2xs font-semibold uppercase tracking-wide text-ink-3">{label}</div>
      <p
        className={
          evidence
            ? "mt-1 break-words rounded-sm border border-line bg-subtle/70 px-2 py-1.5 text-xs leading-5 text-ink-2"
            : "mt-1 text-[13px] leading-5 text-ink-2"
        }
      >
        {children}
      </p>
    </div>
  );
}

/** Problem → evidence → consequence → solution, most valuable first. */
export function OpportunityList({ opportunities, openCount = 3 }: { opportunities: OpportunityRow[]; openCount?: number }) {
  return (
    <ol className="divide-y divide-line">
      {opportunities.map((o, i) => (
        <li key={o.id}>
          <details open={i < openCount} className="group">
            <summary className="flex cursor-pointer list-none items-start gap-2 px-4 py-3 hover:bg-subtle/50 [&::-webkit-details-marker]:hidden">
              <ChevronRight className="mt-0.5 size-4 shrink-0 text-ink-4 transition-transform group-open:rotate-90" aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium text-ink">{o.title}</div>
                <div className="mt-0.5 text-xs text-ink-3">{serviceLabel(o.serviceKey)}</div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-2">
                <ConfidenceText confidence={o.confidence} />
                <ImpactBadge impact={o.impact} />
              </div>
            </summary>
            <div className="grid gap-x-6 gap-y-3 px-4 pb-4 pl-10 md:grid-cols-2">
              <Part label="Problema">{o.problem}</Part>
              <Part label="Evidencia" evidence>
                {o.evidence}
              </Part>
              <Part label="Consecuencia">{o.consequence}</Part>
              <Part label="Solución propuesta">{o.solution}</Part>
              {o.impactNote && (
                <div className="md:col-span-2">
                  <Part label="Impacto estimado">{o.impactNote}</Part>
                </div>
              )}
            </div>
          </details>
        </li>
      ))}
    </ol>
  );
}
