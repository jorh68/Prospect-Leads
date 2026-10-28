import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "info" | "warning" | "danger" | "success";

const tones: Record<Tone, string> = {
  info: "border-accent-200 bg-accent-50 text-accent-800",
  warning: "border-warning-600/25 bg-warning-50 text-warning-700",
  danger: "border-danger-600/25 bg-danger-50 text-danger-700",
  success: "border-success-600/25 bg-success-50 text-success-700",
};

export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("rounded-md border px-3 py-2.5 text-[13px]", tones[tone], className)}>
      {title && <p className="font-medium">{title}</p>}
      {children && <div className={cn(title ? "mt-0.5" : null, "opacity-90")}>{children}</div>}
    </div>
  );
}
