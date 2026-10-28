"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createSearch, searchInputSchema } from "@/lib/discovery/pipeline";
import { errorMessage } from "@/lib/http";

export interface SearchFormState {
  error: string | null;
  fieldErrors: Partial<Record<"niche" | "location" | "count", string>>;
  values: { niche: string; location: string; count: string };
}

export async function createSearchAction(_prev: SearchFormState, formData: FormData): Promise<SearchFormState> {
  const values = {
    niche: String(formData.get("niche") ?? ""),
    location: String(formData.get("location") ?? ""),
    count: String(formData.get("count") ?? ""),
  };
  const parsed = searchInputSchema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors: SearchFormState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof SearchFormState["fieldErrors"];
      fieldErrors[key] ??= issue.message;
    }
    return { error: null, fieldErrors, values };
  }

  let id: string;
  try {
    id = (await createSearch(parsed.data)).id;
  } catch (e) {
    console.error("[searches] no se pudo crear la búsqueda:", e);
    return { error: `No se pudo crear la búsqueda: ${errorMessage(e)}`, fieldErrors: {}, values };
  }
  redirect(`/searches/${id}`);
}

/** Runs a search again with the same parameters (new Search row, history kept). */
export async function repeatSearchAction(searchId: string) {
  const previous = await db.search.findUnique({ where: { id: searchId } });
  if (!previous) redirect("/searches");
  const search = await createSearch({
    niche: previous.niche,
    location: previous.location,
    count: previous.requestedCount,
  });
  redirect(`/searches/${search.id}`);
}
