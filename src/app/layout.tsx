import type { Metadata } from "next";
import { Sidebar } from "@/components/shell/sidebar";
import { authConfig, authMode } from "@/lib/auth/session";
import "./globals.css";

// Every page reads live data from the database.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Prospect Leads", template: "%s · Prospect Leads" },
  description: "Inteligencia comercial: descubre, analiza y prioriza empresas.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-dvh">
        <Sidebar canLogout={authMode(authConfig()) === "enabled"} />
        <main className="min-w-0 lg:pl-56">{children}</main>
      </body>
    </html>
  );
}
