"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={signOut}
      style={{ fontSize: 12, fontWeight: 700, color: "var(--muted-2)" }}
      title="Sign out"
    >
      Sign out
    </button>
  );
}
