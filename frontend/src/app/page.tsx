import { redirect } from "next/navigation";

// The app opens on the Saved Spots map; planning happens in Loopie's chat there.
export default function Home() {
  redirect("/saved");
}
