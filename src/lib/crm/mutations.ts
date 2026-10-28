import "server-only";
import { db } from "../db";
import { logActivity } from "../activity";
import { CRM_STATUS_LABELS, type CrmStatus } from "../domain/constants";
import { formatFollowUp } from "./dates";
import type { CrmDetailsInput } from "./schemas";

/*
 * CRM writes. Each change and its activity entry are written in one
 * transaction. Server actions (./actions.ts) validate input and call these;
 * keeping them free of Next.js APIs lets the integration tests run them.
 */

export class CrmNotFoundError extends Error {
  constructor(what: "empresa" | "nota") {
    super(what === "empresa" ? "La empresa no existe o se ha eliminado." : "La nota no existe o se ha eliminado.");
    this.name = "CrmNotFoundError";
  }
}

function statusLabel(s: string) {
  return CRM_STATUS_LABELS[s as CrmStatus] ?? s;
}

/** Returns false when the company was already in that status (nothing logged). */
export async function setCrmStatus(companyId: string, status: CrmStatus): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const company = await tx.company.findUnique({ where: { id: companyId }, select: { crmStatus: true } });
    if (!company) throw new CrmNotFoundError("empresa");
    if (company.crmStatus === status) return false;
    await tx.company.update({ where: { id: companyId }, data: { crmStatus: status } });
    await logActivity(
      {
        type: "status_changed",
        message: `Estado cambiado de ${statusLabel(company.crmStatus)} a ${statusLabel(status)}`,
        companyId,
        meta: { from: company.crmStatus, to: status },
      },
      tx,
    );
    return true;
  });
}

/** Moves several companies at once; returns how many actually changed. */
export async function setCrmStatusBulk(companyIds: string[], status: CrmStatus): Promise<number> {
  let changed = 0;
  for (const id of new Set(companyIds)) {
    try {
      if (await setCrmStatus(id, status)) changed++;
    } catch (e) {
      // A company deleted meanwhile must not block the rest of the batch.
      if (!(e instanceof CrmNotFoundError)) throw e;
    }
  }
  return changed;
}

/** Saves owner, next action and follow-up date; logs one entry per changed field. */
export async function updateCrmDetails(companyId: string, input: CrmDetailsInput): Promise<{ changed: boolean }> {
  return db.$transaction(async (tx) => {
    const c = await tx.company.findUnique({
      where: { id: companyId },
      select: { owner: true, nextAction: true, followUpAt: true },
    });
    if (!c) throw new CrmNotFoundError("empresa");

    const ownerChanged = c.owner !== input.owner;
    const actionChanged = c.nextAction !== input.nextAction;
    const dateChanged = (c.followUpAt?.getTime() ?? null) !== (input.followUpAt?.getTime() ?? null);
    if (!ownerChanged && !actionChanged && !dateChanged) return { changed: false };

    await tx.company.update({ where: { id: companyId }, data: input });

    if (ownerChanged) {
      await logActivity(
        {
          type: "owner_changed",
          message: input.owner ? `Responsable asignado: ${input.owner}` : "Responsable eliminado",
          companyId,
          meta: { from: c.owner, to: input.owner },
        },
        tx,
      );
    }
    if (actionChanged || dateChanged) {
      let message: string;
      if (!input.nextAction && !input.followUpAt) message = "Seguimiento eliminado";
      else if (input.followUpAt && input.nextAction) message = `Seguimiento para el ${formatFollowUp(input.followUpAt)}: ${input.nextAction}`;
      else if (input.followUpAt) message = `Seguimiento programado para el ${formatFollowUp(input.followUpAt)}`;
      else message = `Próxima acción: ${input.nextAction}`;
      await logActivity(
        {
          type: "followup_set",
          message,
          companyId,
          meta: { nextAction: input.nextAction, followUpAt: input.followUpAt?.toISOString() ?? null },
        },
        tx,
      );
    }
    return { changed: true };
  });
}

export async function addNote(companyId: string, body: string) {
  return db.$transaction(async (tx) => {
    const exists = await tx.company.findUnique({ where: { id: companyId }, select: { id: true } });
    if (!exists) throw new CrmNotFoundError("empresa");
    const note = await tx.note.create({ data: { companyId, body } });
    await logActivity({ type: "note_added", message: "Nota añadida", companyId, meta: { noteId: note.id } }, tx);
    return note;
  });
}

export async function updateNote(noteId: string, body: string) {
  return db.$transaction(async (tx) => {
    const note = await tx.note.findUnique({ where: { id: noteId } });
    if (!note) throw new CrmNotFoundError("nota");
    if (note.body === body) return note;
    const updated = await tx.note.update({ where: { id: noteId }, data: { body } });
    await logActivity(
      { type: "note_updated", message: "Nota editada", companyId: note.companyId, meta: { noteId } },
      tx,
    );
    return updated;
  });
}

export async function deleteNote(noteId: string) {
  return db.$transaction(async (tx) => {
    const note = await tx.note.findUnique({ where: { id: noteId } });
    if (!note) throw new CrmNotFoundError("nota");
    await tx.note.delete({ where: { id: noteId } });
    await logActivity(
      { type: "note_deleted", message: "Nota eliminada", companyId: note.companyId, meta: { noteId } },
      tx,
    );
    return note;
  });
}
