import type { ReactNode } from "react";
import { Document, Font, Link, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";
import { IMPACT_LABELS, SEVERITY_LABELS, type ImpactLevel, type Severity } from "../domain/constants";
import { displayUrl, formatDate } from "../format";
import { confidenceLabel } from "./priority";
import type { ReportContent } from "./schema";

/*
 * Client-ready PDF of a report snapshot, rendered on the server with
 * @react-pdf/renderer (no browser binary needed). Built-in Helvetica covers
 * Spanish accents, "ñ" and "€". Layout mirrors the HTML view in
 * src/components/company/report-view.tsx.
 */

// Spanish words split by the default English hyphenation look wrong; never hyphenate.
Font.registerHyphenationCallback((word) => [word]);

const C = {
  ink: "#111113",
  ink2: "#3f3f46",
  ink3: "#71717a",
  line: "#e4e4e7",
  subtle: "#f4f4f5",
  accent: "#1d5bd6",
  accentSoft: "#eef4ff",
};

const s = StyleSheet.create({
  page: { paddingTop: 48, paddingBottom: 56, paddingHorizontal: 48, fontFamily: "Helvetica", fontSize: 9.5, color: C.ink2, lineHeight: 1.45 },
  eyebrow: { fontSize: 8, letterSpacing: 1.2, color: C.accent, fontFamily: "Helvetica-Bold" },
  title: { fontSize: 22, lineHeight: 1.2, fontFamily: "Helvetica-Bold", color: C.ink, marginTop: 6 },
  subtitle: { fontSize: 10, color: C.ink3, marginTop: 6 },
  rule: { height: 2, backgroundColor: C.accent, width: 36, marginTop: 14, marginBottom: 18 },
  metaRow: { flexDirection: "row", gap: 24, marginBottom: 6 },
  metaLabel: { fontSize: 7.5, color: C.ink3, textTransform: "uppercase", letterSpacing: 0.6 },
  metaValue: { fontSize: 9.5, color: C.ink, marginTop: 1 },
  section: { marginTop: 18 },
  h2Row: { flexDirection: "row", alignItems: "baseline", gap: 8, borderBottomWidth: 1, borderBottomColor: C.line, paddingBottom: 4, marginBottom: 8 },
  h2Num: { fontSize: 9, color: C.accent, fontFamily: "Helvetica-Bold" },
  h2: { fontSize: 12, fontFamily: "Helvetica-Bold", color: C.ink },
  p: { marginBottom: 6 },
  factRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: C.line, paddingVertical: 4 },
  factLabel: { width: 110, color: C.ink3 },
  factValue: { flex: 1, color: C.ink },
  block: { borderWidth: 0.75, borderColor: C.line, borderRadius: 3, padding: 10, marginBottom: 8 },
  blockHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 6 },
  blockTitle: { fontSize: 10.5, fontFamily: "Helvetica-Bold", color: C.ink, flex: 1 },
  tag: { fontSize: 7.5, paddingHorizontal: 5, paddingVertical: 1.5, borderRadius: 2, backgroundColor: C.subtle, color: C.ink2 },
  tagAccent: { fontSize: 7.5, paddingHorizontal: 5, paddingVertical: 1.5, borderRadius: 2, backgroundColor: C.accentSoft, color: C.accent },
  kv: { flexDirection: "row", marginTop: 3 },
  kvLabel: { width: 96, fontSize: 8, color: C.ink3, textTransform: "uppercase", letterSpacing: 0.4, paddingTop: 1 },
  kvValue: { flex: 1 },
  evidence: { backgroundColor: C.subtle, padding: 6, borderRadius: 2, marginTop: 2, color: C.ink2, fontSize: 8.5 },
  small: { fontSize: 8, color: C.ink3 },
  listRow: { flexDirection: "row", marginBottom: 6, gap: 8 },
  listNum: { width: 16, fontFamily: "Helvetica-Bold", color: C.accent },
  // Anchored from the top (A4 = 841.89pt): react-pdf 4.9 drops fixed `render` texts anchored with `bottom`.
  footer: { position: "absolute", top: 806, fontSize: 7.5, color: C.ink3 },
  link: { color: C.accent, textDecoration: "none" },
});

function Section({ n, title, children, breakable = true }: { n: number; title: string; children: ReactNode; breakable?: boolean }) {
  return (
    <View style={s.section} wrap={breakable}>
      <View style={s.h2Row} minPresenceAhead={60}>
        <Text style={s.h2Num}>{String(n).padStart(2, "0")}</Text>
        <Text style={s.h2}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function KV({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={s.kv}>
      <Text style={s.kvLabel}>{label}</Text>
      <View style={s.kvValue}>{typeof children === "string" ? <Text>{children}</Text> : children}</View>
    </View>
  );
}

export function ReportPdf({ content }: { content: ReportContent }) {
  const c = content.company;
  let n = 0;
  const next = () => ++n;

  return (
    <Document title={`Informe comercial · ${c.name}`} author={content.preparedBy ?? undefined} subject="Informe comercial" language="es-ES">
      <Page size="A4" style={s.page}>
        <Text style={s.eyebrow}>INFORME COMERCIAL</Text>
        <Text style={s.title}>{c.name}</Text>
        <Text style={s.subtitle}>{[c.category, c.address ?? c.city].filter(Boolean).join(" · ")}</Text>
        <View style={s.rule} />
        <View style={s.metaRow}>
          <View>
            <Text style={s.metaLabel}>Fecha</Text>
            <Text style={s.metaValue}>{formatDate(content.generatedAt)}</Text>
          </View>
          {content.preparedBy && (
            <View>
              <Text style={s.metaLabel}>Preparado por</Text>
              <Text style={s.metaValue}>{content.preparedBy}</Text>
            </View>
          )}
          {content.analysis.url && (
            <View>
              <Text style={s.metaLabel}>Web revisada</Text>
              <Text style={s.metaValue}>{displayUrl(content.analysis.url)}</Text>
            </View>
          )}
        </View>

        <Section n={next()} title="Situación actual">
          <Text style={s.p}>{content.situation.summary}</Text>
          <View style={{ marginTop: 4 }}>
            {content.situation.facts.map((f) => (
              <View key={f.label} style={s.factRow}>
                <Text style={s.factLabel}>{f.label}</Text>
                <Text style={s.factValue}>{f.value}</Text>
              </View>
            ))}
          </View>
        </Section>

        {content.strengths.length > 0 && (
          <Section n={next()} title="Lo que ya funciona">
            {content.strengths.map((f, i) => (
              <View key={i} style={s.listRow} wrap={false}>
                <Text style={s.listNum}>·</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.ink, fontFamily: "Helvetica-Bold" }}>{f.title}</Text>
                  <Text style={s.small}>{f.evidence}</Text>
                </View>
              </View>
            ))}
          </Section>
        )}

        <Section n={next()} title="Problemas detectados">
          {content.problems.length === 0 ? (
            <Text>No se han detectado problemas con la información disponible.</Text>
          ) : (
            content.problems.map((f, i) => (
              <View key={i} style={s.block} wrap={false}>
                <View style={s.blockHead}>
                  <Text style={s.blockTitle}>{f.title}</Text>
                  <Text style={s.tag}>Prioridad {SEVERITY_LABELS[f.severity as Severity]?.toLowerCase() ?? f.severity}</Text>
                </View>
                <KV label="Evidencia">
                  <Text style={s.evidence}>{f.evidence}</Text>
                </KV>
                {f.interpretation && <KV label="Por qué importa">{f.interpretation}</KV>}
              </View>
            ))
          )}
        </Section>

        <Section n={next()} title="Oportunidades">
          {content.opportunities.length === 0 ? (
            <Text>No hemos identificado oportunidades con evidencia suficiente.</Text>
          ) : (
            content.opportunities.map((o) => (
              <View key={o.id} style={s.block} wrap={false}>
                <View style={s.blockHead}>
                  <Text style={s.blockTitle}>{o.title}</Text>
                  <View style={{ flexDirection: "row", gap: 4 }}>
                    <Text style={s.tagAccent}>Impacto {IMPACT_LABELS[o.impact as ImpactLevel]?.toLowerCase() ?? o.impact}</Text>
                    <Text style={s.tag}>Confianza {confidenceLabel(o.confidence).toLowerCase()}</Text>
                  </View>
                </View>
                <KV label="Problema">{o.problem}</KV>
                <KV label="Evidencia">
                  <Text style={s.evidence}>{o.evidence}</Text>
                </KV>
                <KV label="Consecuencia">{o.consequence}</KV>
                <KV label="Solución">{o.solution}</KV>
              </View>
            ))
          )}
        </Section>

        {content.recommendations.length > 0 && (
          <Section n={next()} title="Recomendaciones">
            {content.recommendations.map((r, i) => (
              <View key={i} style={s.listRow} wrap={false}>
                <Text style={s.listNum}>{i + 1}.</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.ink, fontFamily: "Helvetica-Bold" }}>{r.title}</Text>
                  <Text>{r.detail}</Text>
                </View>
              </View>
            ))}
          </Section>
        )}

        {content.systems.length > 0 && (
          <Section n={next()} title="Sistemas que podríamos implementar">
            {content.systems.map((sys) => (
              <View key={sys.label} style={s.factRow} wrap={false}>
                <Text style={[s.factLabel, { width: 150, color: C.ink, fontFamily: "Helvetica-Bold" }]}>{sys.label}</Text>
                <View style={s.factValue}>
                  <Text>{sys.description}</Text>
                  <Text style={s.small}>Resuelve: {sys.addresses.join(" · ")}</Text>
                </View>
              </View>
            ))}
          </Section>
        )}

        <Section n={next()} title="Impacto potencial">
          <Text style={s.p}>{content.impact.overall}</Text>
          {content.impact.notes.map((note, i) => (
            <View key={i} style={s.listRow} wrap={false}>
              <Text style={s.listNum}>·</Text>
              <Text style={{ flex: 1 }}>
                <Text style={{ color: C.ink, fontFamily: "Helvetica-Bold" }}>{note.title}: </Text>
                {note.note}
              </Text>
            </View>
          ))}
        </Section>

        <View style={[s.section, { borderTopWidth: 0.5, borderTopColor: C.line, paddingTop: 8 }]} wrap={false}>
          <Text style={s.small}>
            Fuentes: {content.sources.join(" · ") || "datos públicos del negocio"}. Este informe se basa exclusivamente en información pública
            observada en la fecha indicada; las valoraciones de impacto y confianza son estimaciones cualitativas.
          </Text>
          {c.website && (
            <Link src={c.website} style={[s.small, s.link]}>
              {displayUrl(c.website)}
            </Link>
          )}
        </View>

        {/* Two fixed Texts instead of a fixed row View, which react-pdf 4.9 does not render */}
        <Text style={[s.footer, { left: 48 }]} fixed>
          {c.name} · Informe comercial · {formatDate(content.generatedAt)}
        </Text>
        <Text style={[s.footer, { left: 48, right: 48, textAlign: "right" }]} fixed render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
      </Page>
    </Document>
  );
}

export function renderReportPdf(content: ReportContent): Promise<Buffer> {
  return renderToBuffer(<ReportPdf content={content} />);
}
