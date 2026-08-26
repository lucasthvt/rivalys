"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

type GapStatus = Database["public"]["Tables"]["detected_gaps"]["Row"]["status"];

export type GapActionResult = { ok: true } | { ok: false; error: string };

async function updateGapStatus(gapId: string, status: GapStatus): Promise<GapActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Session expirée. Reconnecte-toi." };
  }

  // RLS already scopes this update to the caller's own rows; the explicit
  // user_id filter is kept for readability and defense in depth.
  const { error } = await supabase
    .from("detected_gaps")
    .update({ status })
    .eq("id", gapId)
    .eq("user_id", user.id);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/tasks");
  revalidatePath("/dashboard");

  return { ok: true };
}

export async function markGapDone(gapId: string): Promise<GapActionResult> {
  return updateGapStatus(gapId, "done");
}

export async function dismissGap(gapId: string): Promise<GapActionResult> {
  return updateGapStatus(gapId, "dismissed");
}
