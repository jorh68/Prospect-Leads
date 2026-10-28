import { Badge, type BadgeTone } from "@/components/ui/badge";
import { FINDING_CATEGORIES, FINDING_CATEGORY_LABELS, SEVERITY_LABELS, type FindingCategory, type Severity } from "@/lib/domain/constants";
import { severityRank } from "@/lib/reports/priority";
import { displayUrl } from "@/lib/format";

interface FindingRow {
  id: string;
  category: string;
  label: string;
  kind: string;
  severity: string;
  evidence: string;
  evidenceUrl: string | null;
  interpretation: string | null;
}

function KindBadge({ kind, severity }: { kind: string; severity: string }) {
  if (kind === "positive") return <Badge tone="success">Positivo</Badge>;
  if (kind === "neutral") return <Badge tone="outline">Observación</Badge>;
  const tone: BadgeTone = severity === "high" ? "danger" : severity === "medium" ? "warning" : "neutral";
  return <Badge tone={tone}>Problema · {SEVERITY_LABELS[severity as Severity]?.toLowerCase() ?? severity}</Badge>;
}

const KIND_ORDER: Record<string, number> = { issue: 0, neutral: 1, positive: 2 };

/** Findings grouped by category; problems first, then observations, then strengths. */
export function FindingsList({ findings }: { findings: FindingRow[] }) {
  const categories = [...FINDING_CATEGORIES, ...new Set(findings.map((f) => f.category))].filter(
    (c, i, all) => all.indexOf(c) === i && findings.some((f) => f.category === c),
  );
  return (
    <div className="divide-y divide-line">
      {categories.map((cat) => {
        const rows = findings
          .filter((f) => f.category === cat)
          .sort((a, b) => (KIND_ORDER[a.kind] ?? 1) - (KIND_ORDER[b.kind] ?? 1) || severityRank(b.severity) - severityRank(a.severity));
        return (
          <section key={cat}>
            <h3 className="bg-subtle/60 px-4 py-1.5 text-2xs font-semibold uppercase tracking-wide text-ink-3">
              {FINDING_CATEGORY_LABELS[cat as FindingCategory] ?? cat} <span className="font-normal text-ink-4">· {rows.length}</span>
            </h3>
            <ul className="divide-y divide-line">
              {rows.map((f) => (
                <li key={f.id} className="grid gap-x-4 gap-y-1.5 px-4 py-2.5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[13px] font-medium text-ink">{f.label}</span>
                      <KindBadge kind={f.kind} severity={f.severity} />
                    </div>
                    {f.interpretation && <p className="mt-1 text-xs leading-5 text-ink-3">{f.interpretation}</p>}
                  </div>
                  <div className="min-w-0 text-xs leading-5 text-ink-2">
                    <span className="break-words">{f.evidence}</span>
                    {f.evidenceUrl && (
                      <a
                        href={f.evidenceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-0.5 block truncate text-accent-700 hover:underline"
                      >
                        {displayUrl(f.evidenceUrl)}
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
