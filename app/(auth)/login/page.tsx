/**
 * Login page — NextAuth.js v5 sign-in via Server Action.
 * Auth errors redirect here (never expose error details in URL).
 */
import { signIn } from "@/lib/auth/auth-config";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

async function loginAction(formData: FormData) {
  "use server";
  try {
    await signIn("credentials", {
      email:       formData.get("email"),
      password:    formData.get("password"),
      redirectTo:  "/notebooks",
    });
  } catch (err) {
    if (err instanceof AuthError) {
      redirect(`/login?error=invalid`);
    }
    throw err; // re-throw redirect
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; registered?: string }>;
}) {
  const { error, registered } = await searchParams;
  return (
    <main className="min-h-screen flex items-center justify-center bg-[var(--wrp-surface)]">
      <div className="w-full max-w-sm space-y-8 px-6">
        {/* WRP Logo / Wordmark */}
        <div className="text-center">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4"
            style={{ backgroundColor: "var(--wrp-primary)" }}
          >
            <span className="text-white font-bold text-xl">WRP</span>
          </div>
          <h1
            className="text-2xl font-bold"
            style={{ color: "var(--wrp-primary)" }}
          >
            WRP Knowledge Hub
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--wrp-secondary)" }}>
            Sign in to access your notebooks
          </p>
        </div>

        {registered && (
          <p className="text-sm text-center text-green-700">
            Account created — sign in below.
          </p>
        )}

        {error && (
          <p className="text-sm text-center text-red-600">
            Invalid email or password.
          </p>
        )}

        <form action={loginAction} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium mb-1"
              style={{ color: "var(--wrp-primary)" }}
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2"
              style={{ borderColor: "var(--wrp-secondary)" }}
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium mb-1"
              style={{ color: "var(--wrp-primary)" }}
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2"
              style={{ borderColor: "var(--wrp-secondary)" }}
            />
          </div>

          <button
            type="submit"
            className="w-full py-2 px-4 text-white text-sm font-medium rounded-md transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--wrp-primary)" }}
          >
            Sign in
          </button>
        </form>

        <p className="text-center text-sm" style={{ color: "var(--wrp-secondary)" }}>
          Don&apos;t have an account?{" "}
          <a href="/register" className="underline" style={{ color: "var(--wrp-primary)" }}>
            Register
          </a>
        </p>

        <p
          className="text-center text-xs"
          style={{ color: "var(--wrp-secondary)" }}
        >
          Powered by{" "}
          <a
            href="https://github.com/lfnovo/open-notebook"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Open Notebook
          </a>{" "}
          (MIT)
        </p>
      </div>
    </main>
  );
}
