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

  // PRD FR-5.8 (v5.0): below `lg` the page scrolls as a normal document
  // under a sticky top bar and the sidebar is a drawer; from `lg` it is
  // the fixed column beside the content.
  return (
    <div className="min-h-screen w-full bg-background lg:flex">
      <Sidebar profile={profile} menus={menus} />
      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
