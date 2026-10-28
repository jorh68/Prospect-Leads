"use client";

import { useState, useTransition } from "react";
import { addNoteAction, deleteNoteAction, updateNoteAction } from "@/lib/crm/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form";
import { Spinner } from "@/components/ui/progress";
import { formatDateTime } from "@/lib/format";

export interface NoteView {
  id: string;
  body: string;
  createdAt: string;
  edited: boolean;
}

function NoteItem({ note }: { note: NoteView }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.body);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      const r = await updateNoteAction(note.id, draft);
      if (r.ok) setEditing(false);
      else setError(r.error);
    });

  const remove = () => {
    if (!window.confirm("¿Eliminar esta nota? No se puede deshacer.")) return;
    start(async () => {
      const r = await deleteNoteAction(note.id);
      if (!r.ok) setError(r.error);
    });
  };

  return (
    <li className="group px-4 py-3">
      <div className="flex items-baseline justify-between gap-2 text-2xs text-ink-4">
        <time dateTime={note.createdAt}>
          {formatDateTime(note.createdAt)}
          {note.edited && " · editada"}
        </time>
        {!editing && (
          <span className="flex gap-2 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-focus-within:opacity-100 [@media(hover:hover)]:group-hover:opacity-100">
            <button type="button" className="font-medium text-ink-3 hover:text-ink" onClick={() => setEditing(true)} disabled={pending}>
              Editar
            </button>
            <button type="button" className="font-medium text-ink-3 hover:text-danger-600" onClick={remove} disabled={pending}>
              Eliminar
            </button>
          </span>
        )}
      </div>
      {editing ? (
        <div className="mt-1.5 space-y-2">
          <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} aria-label="Editar nota" autoFocus maxLength={5000} />
          <div className="flex gap-2">
            <Button size="sm" variant="primary" onClick={save} disabled={pending || !draft.trim()}>
              {pending && <Spinner />}
              Guardar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditing(false);
                setDraft(note.body);
                setError(null);
              }}
              disabled={pending}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <p className="mt-1 whitespace-pre-wrap break-words text-[13px] text-ink-2">{note.body}</p>
      )}
      {error && <p className="mt-1 text-xs text-danger-600" role="alert">{error}</p>}
    </li>
  );
}

export function CrmNotes({ companyId, notes }: { companyId: string; notes: NoteView[] }) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const add = () =>
    start(async () => {
      const r = await addNoteAction(companyId, body);
      if (r.ok) {
        setBody("");
        setError(null);
      } else setError(r.error);
    });

  return (
    <div>
      <div className="flex items-center justify-between px-4 pt-3">
        <h3 className="text-2xs font-semibold uppercase tracking-wide text-ink-3">Notas</h3>
        <span className="text-2xs tabular-nums text-ink-4">{notes.length}</span>
      </div>
      <form
        className="space-y-2 px-4 pt-2 pb-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (body.trim()) add();
        }}
      >
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && body.trim()) add();
          }}
          rows={2}
          placeholder="Añade una nota (llamada, objeción, contexto…)"
          aria-label="Nueva nota"
          maxLength={5000}
        />
        {error && <p className="text-xs text-danger-600" role="alert">{error}</p>}
        <Button type="submit" size="sm" disabled={pending || !body.trim()}>
          {pending && <Spinner />}
          Añadir nota
        </Button>
      </form>
      {notes.length > 0 && (
        <ul className="divide-y divide-line border-t border-line">
          {notes.map((n) => (
            <NoteItem key={`${n.id}-${n.body}`} note={n} />
          ))}
        </ul>
      )}
    </div>
  );
}
