import { registerAction } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  email_required:    "Email address is required.",
  domain:            "Only @westernresearchparks.ca addresses may register.",
  password_short:    "Password must be at least 8 characters.",
  password_mismatch: "Passwords do not match.",
  email_taken:       "An account with that email already exists.",
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const errorMsg = error ? (ERROR_MESSAGES[error] ?? "Registration failed. Please try again.") : null;

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
            Create your WRP account
          </p>
        </div>

        {errorMsg && (
          <p className="text-sm text-center text-red-600">{errorMsg}</p>
        )}

        <form action={registerAction} className="space-y-4">
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
              className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2"
              style={{ borderColor: "var(--wrp-secondary)" }}
            />
            <p className="mt-1 text-xs" style={{ color: "var(--wrp-secondary)" }}>
              Use your @westernresearchparks.ca address
            </p>
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
              autoComplete="new-password"
              required
              minLength={8}
              className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2"
              style={{ borderColor: "var(--wrp-secondary)" }}
            />
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium mb-1"
              style={{ color: "var(--wrp-primary)" }}
            >
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
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
            Create account
          </button>
        </form>

        <p className="text-center text-sm" style={{ color: "var(--wrp-secondary)" }}>
          Already have an account?{" "}
          <a href="/login" className="underline" style={{ color: "var(--wrp-primary)" }}>
            Sign in
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
