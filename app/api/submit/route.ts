import { handle, json, readJson, requirePlayer } from "@/lib/api";
import { getDb } from "@/lib/db";
import { submitProof } from "@/lib/game";

export async function POST(req: Request) {
  return handle(async () => {
    const { teamId } = await requirePlayer();
    const { answer } = await readJson(req);
    await submitProof(await getDb(), teamId, typeof answer === "string" ? answer : "");
    return json({ ok: true });
  });
}
