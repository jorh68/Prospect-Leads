"use client";

import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/form";

export function PipelineOwnerFilter({
  owners,
  value,
}: {
  owners: { value: string; label: string; count: number }[];
  value: string | null;
}) {
  const router = useRouter();
  if (owners.length === 0 && !value) return null;
  return (
    <Select
      aria-label="Filtrar por responsable"
      className="w-48"
      value={value ?? ""}
      onChange={(e) => router.push(e.target.value ? `/pipeline?owner=${encodeURIComponent(e.target.value)}` : "/pipeline")}
    >
      <option value="">Todos los responsables</option>
      {owners.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label} ({o.count})
        </option>
      ))}
      {value && !owners.some((o) => o.value === value) && <option value={value}>{value}</option>}
    </Select>
  );
}
