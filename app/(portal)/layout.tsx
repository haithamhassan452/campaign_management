import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import Nav from "@/components/Nav";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen">
      <Nav
        role={user.role}
        displayName={user.display_name}
        mustChangePassword={user.must_change_password === 1}
      />
      <main className="ml-60 px-8 py-8">{children}</main>
    </div>
  );
}
