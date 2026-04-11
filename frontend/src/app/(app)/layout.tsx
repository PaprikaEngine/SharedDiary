import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const isDemo = process.env.NEXT_PUBLIC_SUPABASE_URL === "https://demo.supabase.co";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isDemo) {
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        redirect("/login");
      }
    } catch (e) {
      if ((e as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) throw e;
    }
  }

  return <>{children}</>;
}
