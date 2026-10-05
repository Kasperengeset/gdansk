import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { GameError, getTeamState } from "@/lib/game";
import { getPlayerSession } from "@/lib/session";
import { Game } from "./Game";

export default async function SpillPage() {
  const session = await getPlayerSession();
  if (!session) redirect("/");

  let state;
  try {
    state = await getTeamState(await getDb(), session.teamId, session.playerId);
  } catch (err) {
    // Laget eller spilleren er slettet: logg ut og start på nytt.
    if (err instanceof GameError && (err.status === 401 || err.status === 404)) redirect("/logg-ut");
    throw err;
  }

  return <Game initialState={state} />;
}
