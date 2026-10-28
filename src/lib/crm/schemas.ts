import { z } from "zod";
import { CRM_STATUSES } from "../domain/constants";
import { parseDateInput } from "./dates";

export const companyIdSchema = z.string().min(1).max(64);
export const crmStatusSchema = z.enum(CRM_STATUSES, { error: "Estado no válido" });

/** Empty strings become null so a cleared field is stored as "no value". */
const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label}: máximo ${max} caracteres`)
    .transform((v) => (v === "" ? null : v));

export const crmDetailsSchema = z.object({
  owner: optionalText(80, "Responsable"),
  nextAction: optionalText(300, "Próxima acción"),
  followUpAt: z
    .string()
    .trim()
    .refine((v) => v === "" || parseDateInput(v) != null, "Fecha no válida")
    .transform((v) => parseDateInput(v)),
});
export type CrmDetailsInput = z.infer<typeof crmDetailsSchema>;

export const noteBodySchema = z
  .string()
  .trim()
  .min(1, "La nota está vacía")
  .max(5000, "La nota es demasiado larga (máximo 5000 caracteres)");

export const bulkIdsSchema = z.array(companyIdSchema).min(1, "No hay empresas seleccionadas").max(500);
