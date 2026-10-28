"use server";

import { revalidatePath } from "next/cache";
import { analysisAvailable } from "../analysis";
import { enqueueAnalysis } from "../jobs/queue";
import { errorMessage } from "../http";
import { CrmNotFoundError, addNote, deleteNote, setCrmStatus, setCrmStatusBulk, updateCrmDetails, updateNote } from "./mutations";
import { bulkIdsSchema, companyIdSchema, crmDetailsSchema, crmStatusSchema, noteBodySchema } from "./schemas";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

/** Dashboard, list, pipeline and company pages all show CRM data. */
function refreshViews() {
  revalidatePath("/", "layout");
}

function failure(scope: string, e: unknown): ActionResult {
  if (e instanceof CrmNotFoundError) return { ok: false, error: e.message };
  console.error(`[crm] ${scope}:`, e);
  return { ok: false, error: `No se pudo guardar: ${errorMessage(e)}` };
}

export async function setCrmStatusAction(companyId: string, status: string): Promise<ActionResult> {
  const id = companyIdSchema.safeParse(companyId);
  const s = crmStatusSchema.safeParse(status);
  if (!id.success || !s.success) return { ok: false, error: "Estado no válido" };
  try {
    await setCrmStatus(id.data, s.data);
    refreshViews();
    return { ok: true };
  } catch (e) {
    return failure("cambiar estado", e);
  }
}

export async function bulkSetCrmStatusAction(companyIds: string[], status: string): Promise<ActionResult> {
  const ids = bulkIdsSchema.safeParse(companyIds);
  const s = crmStatusSchema.safeParse(status);
  if (!ids.success) return { ok: false, error: ids.error.issues[0].message };
  if (!s.success) return { ok: false, error: "Estado no válido" };
  try {
    const changed = await setCrmStatusBulk(ids.data, s.data);
    refreshViews();
    return { ok: true, message: `${changed} ${changed === 1 ? "empresa actualizada" : "empresas actualizadas"}` };
  } catch (e) {
    return failure("cambiar estado en bloque", e);
  }
}

export async function bulkAnalyzeAction(companyIds: string[]): Promise<ActionResult> {
  if (!analysisAvailable) return { ok: false, error: "El análisis de empresas todavía no está disponible." };
  const ids = bulkIdsSchema.safeParse(companyIds);
  if (!ids.success) return { ok: false, error: ids.error.issues[0].message };
  try {
    let queued = 0;
    for (const id of new Set(ids.data)) if (await enqueueAnalysis(id)) queued++;
    refreshViews();
    const skipped = ids.data.length - queued;
    return {
      ok: true,
      message: `${queued} análisis en cola${skipped > 0 ? ` · ${skipped} ya estaban en cola` : ""}`,
    };
  } catch (e) {
    return failure("encolar análisis", e);
  }
}

export interface CrmDetailsState {
  error: string | null;
  fieldErrors: Partial<Record<"owner" | "nextAction" | "followUpAt", string>>;
  /** Increments on every successful save so the form can show "Guardado". */
  savedCount: number;
}

export async function updateCrmDetailsAction(
  companyId: string,
  prev: CrmDetailsState,
  formData: FormData,
): Promise<CrmDetailsState> {
  if (!companyIdSchema.safeParse(companyId).success) return { ...prev, error: "Empresa no válida", fieldErrors: {} };
  const parsed = crmDetailsSchema.safeParse({
    owner: String(formData.get("owner") ?? ""),
    nextAction: String(formData.get("nextAction") ?? ""),
    followUpAt: String(formData.get("followUpAt") ?? ""),
  });
  if (!parsed.success) {
    const fieldErrors: CrmDetailsState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof CrmDetailsState["fieldErrors"];
      fieldErrors[key] ??= issue.message;
    }
    return { ...prev, error: null, fieldErrors };
  }
  try {
    await updateCrmDetails(companyId, parsed.data);
    refreshViews();
    return { error: null, fieldErrors: {}, savedCount: prev.savedCount + 1 };
  } catch (e) {
    const r = failure("guardar seguimiento", e);
    return { ...prev, error: r.ok ? null : r.error, fieldErrors: {} };
  }
}

export async function addNoteAction(companyId: string, body: string): Promise<ActionResult> {
  const id = companyIdSchema.safeParse(companyId);
  const b = noteBodySchema.safeParse(body);
  if (!id.success) return { ok: false, error: "Empresa no válida" };
  if (!b.success) return { ok: false, error: b.error.issues[0].message };
  try {
    await addNote(id.data, b.data);
    refreshViews();
    return { ok: true };
  } catch (e) {
    return failure("añadir nota", e);
  }
}

export async function updateNoteAction(noteId: string, body: string): Promise<ActionResult> {
  const b = noteBodySchema.safeParse(body);
  if (!b.success) return { ok: false, error: b.error.issues[0].message };
  try {
    await updateNote(noteId, b.data);
    refreshViews();
    return { ok: true };
  } catch (e) {
    return failure("editar nota", e);
  }
}

export async function deleteNoteAction(noteId: string): Promise<ActionResult> {
  try {
    await deleteNote(noteId);
    refreshViews();
    return { ok: true };
  } catch (e) {
    return failure("eliminar nota", e);
  }
}
