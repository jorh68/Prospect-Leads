import type { ScoreFactor } from "@/lib/domain/types";
import { cn } from "@/lib/cn";

function pts(n: number) {
  const r = Math.round(n * 10) / 10;
  return `${r > 0 ? "+" : ""}${r.toLocaleString("es-ES")}`;
}

/** "¿Por qué esta nota?" — every factor, its weight and what it contributed. */
export function ScoreBreakdown({ total, breakdown }: { total: number; breakdown: ScoreFactor[] }) {
  const factors = [...breakdown].sort((a, b) => b.weight - a.weight);
  return (
    <div>
      <div className="flex items-end gap-3 border-b border-line px-4 py-3">
        <div className="text-3xl font-semibold tabular-nums tracking-tight text-ink">{total}</div>
        <div className="pb-1 text-xs leading-4 text-ink-3">
          sobre 100 · puntuación heurística de prioridad comercial.
          <br />
          Orienta el orden de contacto; no es una medición científica.
        </div>
      </div>
      {factors.length === 0 ? (
        <p className="px-4 py-3 text-[13px] text-ink-3">El análisis no guardó el desglose de esta puntuación.</p>
      ) : (
        <ul className="divide-y divide-line">
          {factors.map((f) => (
            <li key={f.factor} className="grid grid-cols-[minmax(0,1fr)_3.5rem] gap-x-4 gap-y-1.5 px-4 py-2.5 sm:grid-cols-[minmax(0,1fr)_8rem_3.5rem]">
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-ink">
                  {f.label} <span className="font-normal text-ink-4">· peso {Math.round(f.weight * 100)} %</span>
                </div>
                <p className="mt-0.5 text-xs leading-5 text-ink-3">{f.explanation}</p>
              </div>
              <div className="col-span-2 row-start-2 flex items-center sm:col-span-1 sm:row-start-auto">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-subtle" aria-label={`Valor ${Math.round(f.value * 100)} %`}>
                  <div className="h-full rounded-full bg-accent-600" style={{ width: `${Math.max(0, Math.min(1, f.value)) * 100}%` }} />
                </div>
              </div>
              <div
                className={cn(
                  "col-start-2 row-start-1 text-right text-[13px] font-medium tabular-nums sm:col-start-auto sm:row-start-auto",
                  f.points < 0 ? "text-danger-600" : "text-ink",
                )}
              >
                {pts(f.points)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
