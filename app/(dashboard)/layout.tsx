/**
 * Dashboard layout — protected by NextAuth.js session.
 * All (dashboard)/* routes require authentication.
 */
import { auth } from "@/lib/auth/auth-config";
import { redirect } from "next/navigation";
import { getNotebooksForUser } from "@/lib/db/scoped-queries";
import { Sidebar } from "@/components/navigation/Sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const notebooks = await getNotebooksForUser(session.user.id);

  return (
    <div className="flex min-h-screen">
      {/* Left sidebar */}
      <Sidebar notebooks={notebooks} />

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Navigation bar */}
        <nav
          className="sticky top-0 z-50 px-6 py-3 flex items-center justify-between shadow-sm"
          style={{ backgroundColor: "var(--wrp-primary)" }}
        >
          <a href="/" className="flex items-center gap-3 no-underline">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/20">
              <span className="text-white font-bold text-sm">WRP</span>
            </div>
            <span className="text-white font-semibold">Knowledge Hub</span>
          </a>

          <div className="flex items-center gap-4">
            <span className="text-white/80 text-sm">
              {session.user.email}
            </span>
            {session.user.role === "admin" && (
              <a
                href="/settings/api-keys"
                className="text-white/80 hover:text-white text-sm transition-colors"
              >
                API Keys
              </a>
            )}
            <a
              href="/api/auth/signout"
              className="text-white/80 hover:text-white text-sm transition-colors"
            >
              Sign out
            </a>
          </div>
        </nav>

        {/* Page content */}
        <main className="flex-1 px-6 py-8 max-w-5xl w-full">
          {children}
        </main>

        {/* Footer */}
        <footer
          className="py-4 text-center text-xs border-t"
          style={{
            color: "var(--wrp-text-muted)",
            borderColor: "var(--wrp-accent)",
          }}
        >
          WRP Knowledge Hub &mdash; Powered by{" "}
          <a
            href="https://github.com/lfnovo/open-notebook"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Open Notebook
          </a>{" "}
          (MIT)
        </footer>
      </div>
    </div>
  );
}
