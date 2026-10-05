import { NextResponse } from "next/server";
import { clearPlayerSession } from "@/lib/session";

async function logout(req: Request) {
  await clearPlayerSession();
  return NextResponse.redirect(new URL("/", req.url), 303);
}

// GET brukes når økten peker på et lag som er slettet; POST fra logg ut-knappen.
export const GET = logout;
export const POST = logout;
