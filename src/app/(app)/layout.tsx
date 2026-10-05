import { requireProfile } from "@/lib/auth";
import { allowedMenus, getMenuAccess } from "@/lib/menuAccess";
import { Sidebar } from "@/components/layout/Sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Menus outside the role's matrix are not rendered at all (PRD FR-5.7);
  // their pages answer 404 via requireMenu().
  const [profile, access] = await Promise.all([requireProfile(), getMenuAccess()]);
  const menus = allowedMenus(profile, access);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <Sidebar profile={profile} menus={menus} />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl px-6 py-6 lg:px-8 lg:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
