import { handle, json, requirePlayer } from "@/lib/api";
import { getDb } from "@/lib/db";
import { getTeamState } from "@/lib/game";

export async function GET() {
  return handle(async () => {
    const { teamId, playerId } = await requirePlayer();
    return json(await getTeamState(await getDb(), teamId, playerId));
  });
}
