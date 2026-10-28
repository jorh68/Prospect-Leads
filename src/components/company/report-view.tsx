import type { ReactNode } from "react";
import { IMPACT_LABELS, SEVERITY_LABELS, type ImpactLevel, type Severity } from "@/lib/domain/constants";
import { confidenceLabel } from "@/lib/reports/priority";
import type { ReportContent } from "@/lib/reports/schema";
import { displayUrl, formatDate } from "@/lib/format";

/*
 * HTML rendering of a report snapshot, laid out like the PDF
 * (src/lib/reports/pdf.tsx) so what you review is what the client gets.
 */

function Section({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="mt-9 break-inside-avoid-page">
      <h2 className="flex items-baseline gap-2.5 border-b border-line pb-1.5 text-base font-semibold text-ink">
        <span className="text-xs font-semibold tabular-nums text-accent-600">{String(n).padStart(2, "0")}</span>
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Tag({ children, accent = false }: { children: ReactNode; accent?: boolean }) {
  return (
    <span className={accent ? "rounded-sm bg-accent-50 px-1.5 py-0.5 text-2xs text-accent-700" : "rounded-sm bg-subtle px-1.5 py-0.5 text-2xs text-ink-2"}>
      {children}
    </span>
  );
}

function KV({ label, children, evidence = false }: { label: string; children: ReactNode; evidence?: boolean }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:gap-3">
      <div className="pt-0.5 text-2xs font-semibold uppercase tracking-wide text-ink-3">{label}</div>
      <div className={evidence ? "break-words rounded-sm bg-subtle px-2 py-1.5 text-xs leading-5 text-ink-2" : "text-[13px] leading-5 text-ink-2"}>
        {children}
      </div>
    </div>
  );
}

export function ReportView({ content }: { content: ReportContent }) {
  const c = content.company;
  let n = 0;
  const next = () => ++n;

  return (
    <article className="mx-auto w-full max-w-[52rem] rounded-lg border border-line bg-surface px-5 py-8 shadow-xs sm:px-12 sm:py-12 print:border-0 print:shadow-none">
      <div className="text-2xs font-semibold uppercase tracking-[0.14em] text-accent-600">Informe comercial</div>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">{c.name}</h1>
      <p className="mt-1 text-[13px] text-ink-3">{[c.category, c.address ?? c.city].filter(Boolean).join(" · ")}</p>
      <div className="mt-5 h-0.5 w-10 bg-accent-600" />
      <dl className="mt-5 flex flex-wrap gap-x-10 gap-y-3 text-[13px]">
        <div>
          <dt className="text-2xs uppercase tracking-wide text-ink-3">Fecha</dt>
          <dd className="text-ink">{formatDate(content.generatedAt)}</dd>
        </div>
        {content.preparedBy && (
          <div>
            <dt className="text-2xs uppercase tracking-wide text-ink-3">Preparado por</dt>
            <dd className="text-ink">{content.preparedBy}</dd>
          </div>
        )}
        {content.analysis.url && (
          <div>
            <dt className="text-2xs uppercase tracking-wide text-ink-3">Web revisada</dt>
            <dd className="text-ink">{displayUrl(content.analysis.url)}</dd>
          </div>
        )}
      </dl>

      <Section n={next()} title="Situación actual">
        <p className="text-[13px] leading-6 text-ink-2">{content.situation.summary}</p>
        <dl className="mt-3 divide-y divide-line border-y border-line">
          {content.situation.facts.map((f) => (
            <div key={f.label} className="grid grid-cols-[8rem_minmax(0,1fr)] gap-3 py-1.5 text-[13px]">
              <dt className="text-ink-3">{f.label}</dt>
              <dd className="break-words text-ink">{f.value}</dd>
            </div>
          ))}
        </dl>
      </Section>

      {content.strengths.length > 0 && (
        <Section n={next()} title="Lo que ya funciona">
          <ul className="space-y-2">
            {content.strengths.map((f, i) => (
              <li key={i} className="text-[13px]">
                <span className="font-medium text-ink">{f.title}</span>
                <span className="block text-xs text-ink-3">{f.evidence}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section n={next()} title="Problemas detectados">
        {content.problems.length === 0 ? (
          <p className="text-[13px] text-ink-3">No se han detectado problemas con la información disponible.</p>
        ) : (
          <div className="space-y-2.5">
            {content.problems.map((f, i) => (
              <div key={i} className="space-y-2 rounded-md border border-line p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-[13px] font-semibold text-ink">{f.title}</h3>
                  <Tag>Prioridad {SEVERITY_LABELS[f.severity as Severity]?.toLowerCase() ?? f.severity}</Tag>
                </div>
                <KV label="Evidencia" evidence>
                  {f.evidence}
                </KV>
                {f.interpretation && <KV label="Por qué importa">{f.interpretation}</KV>}
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section n={next()} title="Oportunidades">
        {content.opportunities.length === 0 ? (
          <p className="text-[13px] text-ink-3">No hemos identificado oportunidades con evidencia suficiente.</p>
        ) : (
          <div className="space-y-2.5">
            {content.opportunities.map((o) => (
              <div key={o.id} className="space-y-2 rounded-md border border-line p-3.5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="text-[13px] font-semibold text-ink">{o.title}</h3>
                  <div className="flex gap-1">
                    <Tag accent>Impacto {IMPACT_LABELS[o.impact as ImpactLevel]?.toLowerCase() ?? o.impact}</Tag>
                    <Tag>Confianza {confidenceLabel(o.confidence).toLowerCase()}</Tag>
                  </div>
                </div>
                <KV label="Problema">{o.problem}</KV>
                <KV label="Evidencia" evidence>
                  {o.evidence}
                </KV>
                <KV label="Consecuencia">{o.consequence}</KV>
                <KV label="Solución">{o.solution}</KV>
              </div>
            ))}
          </div>
        )}
      </Section>

      {content.recommendations.length > 0 && (
        <Section n={next()} title="Recomendaciones">
          <ol className="space-y-2.5">
            {content.recommendations.map((r, i) => (
              <li key={i} className="grid grid-cols-[1.25rem_minmax(0,1fr)] text-[13px]">
                <span className="font-semibold tabular-nums text-accent-600">{i + 1}.</span>
                <span>
                  <span className="block font-medium text-ink">{r.title}</span>
                  <span className="text-ink-2">{r.detail}</span>
                </span>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {content.systems.length > 0 && (
        <Section n={next()} title="Sistemas que podríamos implementar">
          <dl className="divide-y divide-line border-y border-line">
            {content.systems.map((s) => (
              <div key={s.label} className="grid gap-1 py-2 text-[13px] sm:grid-cols-[13rem_minmax(0,1fr)] sm:gap-3">
                <dt className="font-medium text-ink">{s.label}</dt>
                <dd>
                  <span className="text-ink-2">{s.description}</span>
                  <span className="mt-0.5 block text-xs text-ink-3">Resuelve: {s.addresses.join(" · ")}</span>
                </dd>
              </div>
            ))}
          </dl>
        </Section>
      )}

      <Section n={next()} title="Impacto potencial">
        <p className="text-[13px] leading-6 text-ink-2">{content.impact.overall}</p>
        {content.impact.notes.length > 0 && (
          <ul className="mt-2 space-y-1.5">
            {content.impact.notes.map((note, i) => (
              <li key={i} className="text-[13px] text-ink-2">
                <span className="font-medium text-ink">{note.title}:</span> {note.note}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <footer className="mt-10 border-t border-line pt-3 text-xs leading-5 text-ink-3">
        Fuentes: {content.sources.join(" · ") || "datos públicos del negocio"}. Este informe se basa exclusivamente en información pública observada
        en la fecha indicada; las valoraciones de impacto y confianza son estimaciones cualitativas.
      </footer>
    </article>
  );
}
