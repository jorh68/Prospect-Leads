"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "../db";
import { errorMessage } from "../http";
import { generateMessagesForCompany } from "./generate";
import { NotEnoughEvidenceError } from "./compose";

export interface MessageActionState {
  error: string | null;
  notice: string | null;
}

export async function generateMessagesAction(companyId: string, _prev: MessageActionState): Promise<MessageActionState> {
  try {
    const { generator, warning } = await generateMessagesForCompany(companyId);
    revalidatePath(`/companies/${companyId}`);
    return {
      error: null,
      notice: warning ?? (generator === "llm" ? "Mensajes redactados con IA a partir de los hechos listados." : null),
    };
  } catch (e) {
    if (!(e instanceof NotEnoughEvidenceError)) console.error(`[messages] no se pudieron generar para ${companyId}:`, e);
    return { error: errorMessage(e), notice: null };
  }
}

const editSchema = z.object({
  subject: z.string().trim().max(200).optional(),
  body: z.string().trim().min(1, "El mensaje no puede estar vacío").max(5000, "Máximo 5000 caracteres"),
});

export async function updateMessageAction(messageId: string, _prev: MessageActionState, formData: FormData): Promise<MessageActionState> {
  const parsed = editSchema.safeParse({
    subject: formData.has("subject") ? String(formData.get("subject")) : undefined,
    // Browsers submit textarea line breaks as CRLF; store plain LF.
    body: String(formData.get("body") ?? "").replace(/\r\n?/g, "\n"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos no válidos", notice: null };

  try {
    const msg = await db.message.update({
      where: { id: messageId },
      data: {
        body: parsed.data.body,
        ...(parsed.data.subject !== undefined ? { subject: parsed.data.subject || null } : {}),
        edited: true,
      },
      select: { companyId: true },
    });
    revalidatePath(`/companies/${msg.companyId}`);
    return { error: null, notice: "Cambios guardados" };
  } catch (e) {
    console.error(`[messages] no se pudo guardar ${messageId}:`, e);
    return { error: `No se pudo guardar: ${errorMessage(e)}`, notice: null };
  }
}
