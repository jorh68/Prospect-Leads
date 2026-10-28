import { Building2, Gauge, KanbanSquare, Search, Settings } from "lucide-react";

/** Primary navigation. Each module owns the pages under its href. */
export const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: Gauge, exact: true },
  { href: "/searches", label: "Búsquedas", icon: Search },
  { href: "/companies", label: "Empresas", icon: Building2 },
  { href: "/pipeline", label: "Pipeline", icon: KanbanSquare },
] as const;

export const SECONDARY_NAV_ITEMS = [{ href: "/settings", label: "Ajustes", icon: Settings }] as const;
