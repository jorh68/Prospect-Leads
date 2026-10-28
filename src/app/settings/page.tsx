import type { Metadata } from "next";
import { env, integrations, overpassUrls } from "@/lib/env";
import { authConfig, authMode } from "@/lib/auth/session";
import { PageBody, PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Ajustes" };

export default function SettingsPage() {
  const access = authMode(authConfig());
  const rows = [
    {
      name: "Acceso con contraseña",
      variable: "APP_PASSWORD (AUTH_SECRET opcional)",
      active: access === "enabled",
      note:
        access === "enabled"
          ? "La app pide contraseña antes de mostrar cualquier dato. Cambiar la contraseña cierra todas las sesiones."
          : "Sin contraseña la app queda abierta en desarrollo y bloqueada en producción.",
    },
    {
      name: "OpenStreetMap (Nominatim + Overpass)",
      variable: "OSM_CONTACT_EMAIL (recomendado)",
      active: true,
      note: `Sin clave. Nombre, web, teléfono, email, dirección, horarios y redes cuando están mapeados. Endpoints: ${overpassUrls().length}.`,
    },
    {
      name: "Google Places API (New)",
      variable: "GOOGLE_PLACES_API_KEY",
      active: integrations.googlePlaces(),
      note: "Añade valoraciones, número de reseñas, horarios y mejor cobertura (máx. 60 resultados por búsqueda).",
    },
    {
      name: "Anthropic (IA)",
      variable: "ANTHROPIC_API_KEY",
      active: integrations.anthropic(),
      note: `Interpretación del análisis y redacción de mensajes. Sin clave se usan reglas. Modelo: ${env().ANTHROPIC_MODEL}.`,
    },
    {
      name: "Google PageSpeed Insights",
      variable: "PAGESPEED_API_KEY",
      active: integrations.pageSpeed(),
      note: "Métricas reales de rendimiento móvil (Lighthouse) en cada análisis. Sin clave, la velocidad se estima por el tiempo de descarga del HTML.",
    },
    {
      name: "Remitente de mensajes e informes",
      variable: "OUTREACH_SENDER_NAME, OUTREACH_SENDER_COMPANY",
      active: Boolean(env().OUTREACH_SENDER_NAME),
      note: `Firma de los mensajes y "Preparado por" de los informes${env().OUTREACH_SENDER_NAME ? ` (${[env().OUTREACH_SENDER_NAME, env().OUTREACH_SENDER_COMPANY].filter(Boolean).join(", ")})` : ""}. Sin nombre, los mensajes llevan «[Tu nombre]» para rellenar.`,
    },
  ];

  return (
    <>
      <PageHeader title="Ajustes" description="Integraciones y fuentes de datos. Las claves se configuran como variables de entorno (.env)." />
      <PageBody>
        <Panel title="Integraciones">
          <TableContainer>
            <Table>
              <THead>
                <tr>
                  <TH>Integración</TH>
                  <TH>Estado</TH>
                  <TH>Variable</TH>
                  <TH>Qué aporta</TH>
                </tr>
              </THead>
              <TBody>
                {rows.map((r) => (
                  <TR key={r.name}>
                    <TD className="font-medium text-ink">{r.name}</TD>
                    <TD>
                      {r.active ? <Badge tone="success" dot>Activa</Badge> : <Badge tone="warning" dot>Sin configurar</Badge>}
                    </TD>
                    <TD className="font-mono text-xs">{r.variable}</TD>
                    <TD className="min-w-64 text-ink-3">{r.note}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableContainer>
        </Panel>
      </PageBody>
    </>
  );
}
