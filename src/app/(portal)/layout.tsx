import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="flex h-screen bg-[#F8F9FB]">
      <Sidebar user={session.user as any} />
      <main className="flex-1 overflow-y-auto bg-white p-8">
        {children}
      </main>
    </div>
  );
}
