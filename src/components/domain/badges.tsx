import { Badge, type BadgeTone } from "@/components/ui/badge";
import {
  ANALYSIS_STATUS_LABELS,
  CRM_STATUS_LABELS,
  PROVIDER_LABELS,
  SEARCH_STATUS_LABELS,
  type AnalysisStatus,
  type CrmStatus,
  type Provider,
  type SearchStatus,
} from "@/lib/domain/constants";

const CRM_TONES: Record<CrmStatus, BadgeTone> = {
  new: "neutral",
  analyzed: "outline",
  priority: "accent",
  contacted: "accent",
  replied: "accent",
  meeting: "warning",
  proposal: "warning",
  won: "success",
  lost: "danger",
};

export function CrmStatusBadge({ status }: { status: string }) {
  const s = status as CrmStatus;
  return (
    <Badge tone={CRM_TONES[s] ?? "neutral"} dot>
      {CRM_STATUS_LABELS[s] ?? status}
    </Badge>
  );
}

const SEARCH_TONES: Record<SearchStatus, BadgeTone> = {
  pending: "neutral",
  running: "accent",
  completed: "success",
  partial: "warning",
  failed: "danger",
};

export function SearchStatusBadge({ status }: { status: string }) {
  const s = status as SearchStatus;
  return (
    <Badge tone={SEARCH_TONES[s] ?? "neutral"} dot>
      {SEARCH_STATUS_LABELS[s] ?? status}
    </Badge>
  );
}

const ANALYSIS_TONES: Record<AnalysisStatus, BadgeTone> = {
  none: "outline",
  queued: "neutral",
  running: "accent",
  completed: "success",
  failed: "danger",
};

export function AnalysisStatusBadge({ status }: { status: string }) {
  const s = status as AnalysisStatus;
  return <Badge tone={ANALYSIS_TONES[s] ?? "neutral"}>{ANALYSIS_STATUS_LABELS[s] ?? status}</Badge>;
}

export function ProviderBadge({ provider }: { provider: string }) {
  return <Badge tone="outline">{PROVIDER_LABELS[provider as Provider] ?? provider}</Badge>;
}

/**
 * Priority score (0–100, heuristic). Null means not analysed yet.
 * Bands: ≥70 high, 40–69 medium, <40 low.
 */
export function ScoreBadge({ score }: { score: number | null | undefined }) {
  if (score == null) return <span className="text-ink-4">—</span>;
  const tone: BadgeTone = score >= 70 ? "accent" : score >= 40 ? "neutral" : "outline";
  return (
    <Badge tone={tone} className="min-w-8 justify-center tabular-nums">
      {score}
    </Badge>
  );
}
