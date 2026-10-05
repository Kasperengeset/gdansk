import { handle, json, requirePlayer } from "@/lib/api";
import { getDb } from "@/lib/db";
import { deletePhoto, GameError } from "@/lib/game";
import { getPlayerSession, isAdmin } from "@/lib/session";

const UUID = /^[0-9a-f-]{36}$/i;

/** Bildet vises for laget som tok det, og for admin. */
export async function GET(_req: Request, ctx: RouteContext<"/api/photos/[id]">) {
  return handle(async () => {
    const { id } = await ctx.params;
    if (!UUID.test(id)) throw new GameError("Fant ikke bildet.", 404);
    const db = await getDb();
    const [photo] = await db.query<{ team_id: string; mime: string; data: Uint8Array }>(
      "select team_id, mime, data from photos where id = $1",
      [id],
    );
    if (!photo) throw new GameError("Fant ikke bildet.", 404);
    const session = await getPlayerSession();
    if (session?.teamId !== photo.team_id && !(await isAdmin())) throw new GameError("Ingen tilgang.", 403);
    return new Response(new Uint8Array(photo.data), {
      headers: { "content-type": photo.mime, "cache-control": "private, max-age=31536000, immutable" },
    });
  });
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/photos/[id]">) {
  return handle(async () => {
    const { teamId } = await requirePlayer();
    const { id } = await ctx.params;
    if (!UUID.test(id)) throw new GameError("Fant ikke bildet.", 404);
    await deletePhoto(await getDb(), teamId, id);
    return json({ ok: true });
  });
}
