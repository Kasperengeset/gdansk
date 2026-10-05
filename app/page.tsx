import { redirect } from "next/navigation";
import { getPlayerSession } from "@/lib/session";
import { EntryForms } from "./EntryForms";

export default async function Home({ searchParams }: PageProps<"/">) {
  if (await getPlayerSession()) redirect("/spill");
  const { kode } = await searchParams;

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-10">
      <p className="eyebrow">Rebusløpet</p>
      <h1 className="mt-1 text-4xl font-extrabold tracking-tight">Gdańsk uten kart</h1>
      <p className="mt-3 text-muted">
        Ingen Google Maps. Ingen internett. Bare lokalbefolkningen, papir og magefølelsen.
      </p>
      <EntryForms initialCode={typeof kode === "string" ? kode.toUpperCase() : ""} />
    </main>
  );
}
