/**
 * Root page — redirects to the dashboard.
 * Authentication is enforced by (dashboard)/layout.tsx,
 * which redirects unauthenticated users to /login.
 */
import { redirect } from "next/navigation";

export default function RootPage() {
  // (dashboard)/page.tsx is the actual landing page after auth
  redirect("/notebooks");
}
