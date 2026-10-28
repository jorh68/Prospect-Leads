import type { Metadata } from "next";
import { env, integrations, overpassUrls } from "@/lib/env";
import { PageBody, PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Ajustes" };

export default function SettingsPage() {
  const rows = [
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
