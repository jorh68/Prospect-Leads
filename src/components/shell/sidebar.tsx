"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { NAV_ITEMS, SECONDARY_NAV_ITEMS } from "./nav";

function isActive(pathname: string, href: string, exact?: boolean) {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const item = (it: (typeof NAV_ITEMS)[number] | (typeof SECONDARY_NAV_ITEMS)[number]) => {
    const active = isActive(pathname, it.href, "exact" in it ? it.exact : false);
    const Icon = it.icon;
    return (
      <Link
        key={it.href}
        href={it.href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium transition-colors",
          active ? "bg-subtle text-ink" : "text-ink-3 hover:bg-subtle/70 hover:text-ink",
        )}
      >
        <Icon className={cn("size-4", active ? "text-accent-600" : "text-ink-4")} aria-hidden />
        {it.label}
      </Link>
    );
  };
  return (
    <nav className="flex flex-1 flex-col gap-0.5 px-2" aria-label="Principal">
      {NAV_ITEMS.map(item)}
      <div className="mt-auto pt-4">{SECONDARY_NAV_ITEMS.map(item)}</div>
    </nav>
  );
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2 px-4 text-[14px] font-semibold tracking-tight text-ink">
      <span className="grid size-6 place-items-center rounded-md bg-ink text-[11px] font-bold text-white">PL</span>
      Prospect Leads
    </Link>
  );
}

export function Sidebar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop */}
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-56 flex-col border-r border-line bg-surface py-4 lg:flex">
        <Brand />
        <div className="mt-6 flex flex-1 flex-col">
          <NavLinks />
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="no-print sticky top-0 z-30 flex h-12 items-center justify-between border-b border-line bg-surface pr-2 lg:hidden">
        <Brand />
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="grid size-9 place-items-center rounded-md text-ink-2 hover:bg-subtle"
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={open}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>
      {open && (
        <div className="no-print fixed inset-x-0 top-12 bottom-0 z-30 flex flex-col border-t border-line bg-surface py-3 lg:hidden">
          <NavLinks onNavigate={() => setOpen(false)} />
        </div>
      )}
    </>
  );
}
