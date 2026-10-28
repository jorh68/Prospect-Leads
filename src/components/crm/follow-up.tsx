import { cn } from "@/lib/cn";
import { describeFollowUp, followUpState, formatFollowUp } from "@/lib/crm/dates";

const tones = {
  overdue: "text-danger-700 font-medium",
  today: "text-warning-700 font-medium",
  soon: "text-ink-2",
  later: "text-ink-3",
} as const;

/** Follow-up day with its urgency: overdue in red, today in amber. */
export function FollowUpDate({ date, className }: { date: Date | string | null | undefined; className?: string }) {
  const state = followUpState(date);
  if (!date || !state) return <span className={cn("text-ink-4", className)}>—</span>;
  return (
    <time suppressHydrationWarning dateTime={new Date(date).toISOString().slice(0, 10)} title={formatFollowUp(date)} className={cn("whitespace-nowrap", tones[state], className)}>
      {describeFollowUp(date)}
    </time>
  );
}
