"use client";

import { useActionState, useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { generateMessagesAction, updateMessageAction, type MessageActionState } from "@/lib/messages/actions";
import { MESSAGE_CHANNELS, MESSAGE_CHANNEL_LABELS, type MessageChannel } from "@/lib/domain/constants";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/form";
import { Spinner } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/cn";

export interface MessageView {
  id: string;
  channel: string;
  subject: string | null;
  body: string;
  generator: string;
  edited: boolean;
  updatedAt: string;
  facts: { text: string; source: string }[];
}

const PLACEHOLDER = "[Tu nombre]";
const initial: MessageActionState = { error: null, notice: null };

function words(text: string) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

/** Link that opens the channel with the text pre-filled, when we have the contact. */
function sendHref(channel: MessageChannel, msg: { subject: string | null; body: string }, contact: Contact): string | null {
  if (channel === "email" && contact.email) {
    return `mailto:${contact.email}?subject=${encodeURIComponent(msg.subject ?? "")}&body=${encodeURIComponent(msg.body)}`;
  }
  if (channel === "whatsapp" && contact.whatsappNumber) {
    return `https://wa.me/${contact.whatsappNumber}?text=${encodeURIComponent(msg.body)}`;
  }
  if (channel === "linkedin" && contact.linkedinUrl) return contact.linkedinUrl;
  return null;
}

interface Contact {
  email: string | null;
  /** Digits with country code, only for numbers that can receive WhatsApp */
  whatsappNumber: string | null;
  linkedinUrl: string | null;
}

function ChannelEditor({ message, contact }: { message: MessageView; contact: Contact }) {
  const channel = message.channel as MessageChannel;
  const [state, action, pending] = useActionState(updateMessageAction.bind(null, message.id), initial);
  const [body, setBody] = useState(message.body);
  const [subject, setSubject] = useState(message.subject ?? "");
  const [copied, setCopied] = useState(false);
  const dirty = body !== message.body || (channel === "email" && subject !== (message.subject ?? ""));
  const href = sendHref(channel, { subject, body }, contact);

  async function copy() {
    const text = channel === "email" && subject ? `Asunto: ${subject}\n\n${body}` : body;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <form action={action} className="space-y-3 p-4">
      {channel === "email" && (
        <div className="space-y-1.5">
          <Label htmlFor={`subject-${message.id}`}>Asunto</Label>
          <Input id={`subject-${message.id}`} name="subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} />
        </div>
      )}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor={`body-${message.id}`}>Mensaje</Label>
          <span className="text-2xs tabular-nums text-ink-4">
            {words(body)} palabras · {body.length} caracteres
          </span>
        </div>
        <Textarea
          id={`body-${message.id}`}
          name="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={channel === "email" ? 11 : 6}
          className="text-[13px]"
        />
      </div>

      {body.includes(PLACEHOLDER) && (
        <Alert tone="warning">
          Sustituye «{PLACEHOLDER}» por tu nombre antes de enviarlo, o configura <code className="font-mono">OUTREACH_SENDER_NAME</code> en el
          archivo .env para que se rellene solo.
        </Alert>
      )}
      {state.error && <Alert tone="danger">{state.error}</Alert>}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" variant="primary" size="sm" disabled={!dirty || pending}>
          {pending && <Spinner />}
          Guardar cambios
        </Button>
        <Button size="sm" onClick={copy}>
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
          {copied ? "Copiado" : "Copiar"}
        </Button>
        {href && (
          <a href={href} target="_blank" rel="noopener noreferrer" className={buttonClasses("secondary", "sm")}>
            <ExternalLink aria-hidden />
            {channel === "email" ? "Abrir en el correo" : channel === "whatsapp" ? "Abrir WhatsApp" : "Abrir perfil de LinkedIn"}
          </a>
        )}
        {!dirty && state.notice && <span className="text-xs text-success-700">{state.notice}</span>}
      </div>

      {message.facts.length > 0 && (
        <div className="border-t border-line pt-3">
          <div className="text-2xs font-semibold uppercase tracking-wide text-ink-3">Basado en estos datos reales</div>
          <ul className="mt-1.5 space-y-1">
            {message.facts.map((f, i) => (
              <li key={i} className="flex gap-2 text-xs leading-5 text-ink-2">
                <span className="mt-2 size-1 shrink-0 rounded-full bg-ink-4" aria-hidden />
                <span className="min-w-0">
                  {f.text} <span className="text-ink-4">· {f.source}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </form>
  );
}

export function MessagesPanel({
  companyId,
  messages,
  contact,
  canGenerate,
  blockedReason,
  llmAvailable,
}: {
  companyId: string;
  messages: MessageView[];
  contact: Contact;
  canGenerate: boolean;
  blockedReason: string | null;
  llmAvailable: boolean;
}) {
  const [genState, generate, generating] = useActionState(generateMessagesAction.bind(null, companyId), initial);
  const available = MESSAGE_CHANNELS.filter((ch) => messages.some((m) => m.channel === ch));
  const [tab, setTab] = useState<MessageChannel>(available[0] ?? "email");
  const current = messages.find((m) => m.channel === tab) ?? messages[0];
  const meta = current ?? null;

  return (
    <section id="mensajes" className="scroll-mt-4 rounded-lg border border-line bg-surface shadow-xs">
      <header className="flex min-h-11 flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2">
        <div className="min-w-0">
          <h2 className="text-[13px] font-semibold text-ink">Mensajes de contacto</h2>
          <p className="text-xs text-ink-3">
            {messages.length > 0
              ? "Redactados con los datos de la investigación. Revísalos antes de enviar."
              : "Email, LinkedIn y WhatsApp a partir de la oportunidad principal."}
          </p>
        </div>
        <form action={generate}>
          <Button type="submit" size="sm" variant={messages.length > 0 ? "secondary" : "primary"} disabled={!canGenerate || generating}>
            {generating && <Spinner />}
            {generating ? "Redactando…" : messages.length > 0 ? "Volver a generar" : "Generar mensajes"}
          </Button>
        </form>
      </header>

      {genState.error && (
        <div className="px-4 pt-3">
          <Alert tone="danger">{genState.error}</Alert>
        </div>
      )}
      {genState.notice && (
        <div className="px-4 pt-3">
          <Alert tone={genState.notice.includes("reglas") ? "warning" : "info"}>{genState.notice}</Alert>
        </div>
      )}

      {messages.length === 0 ? (
        <EmptyState
          title={canGenerate ? "Todavía no hay mensajes" : "Aún no se pueden generar mensajes"}
          description={
            canGenerate
              ? `Se redactarán ${llmAvailable ? "con IA" : "con reglas (sin IA configurada)"} citando solo hechos encontrados: la reputación, la web y la oportunidad principal.`
              : blockedReason
          }
        />
      ) : (
        <>
          <div className="flex items-center justify-between gap-2 border-b border-line px-4">
            <div role="tablist" className="-mb-px flex gap-4">
              {available.map((ch) => (
                <button
                  key={ch}
                  type="button"
                  role="tab"
                  aria-selected={tab === ch}
                  onClick={() => setTab(ch)}
                  className={cn(
                    "h-9 border-b-2 text-[13px] font-medium transition-colors",
                    tab === ch ? "border-accent-600 text-ink" : "border-transparent text-ink-3 hover:text-ink",
                  )}
                >
                  {MESSAGE_CHANNEL_LABELS[ch]}
                </button>
              ))}
            </div>
            {meta && (
              <div className="flex items-center gap-1.5">
                {meta.edited && <Badge tone="outline">Editado</Badge>}
                <Badge tone={meta.generator === "llm" ? "accent" : "neutral"}>{meta.generator === "llm" ? "IA" : "Reglas"}</Badge>
              </div>
            )}
          </div>
          {current && <ChannelEditor key={current.id} message={current} contact={contact} />}
        </>
      )}
    </section>
  );
}
