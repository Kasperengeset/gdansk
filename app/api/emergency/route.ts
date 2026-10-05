import { handle, json, requirePlayer } from "@/lib/api";
import { getDb } from "@/lib/db";
import { openEmergency } from "@/lib/game";

export async function POST() {
  return handle(async () => {
    const { teamId } = await requirePlayer();
    await openEmergency(await getDb(), teamId);
    return json({ ok: true });
  });
}
