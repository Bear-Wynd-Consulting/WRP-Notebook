/**
 * Login page — custom NextAuth.js v5 sign-in form.
 * Auth errors redirect here (never expose error details in URL).
 */
export default function LoginPage() {
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
          <p className="mt-1 text-sm" style={{ color: "var(--wrp-text-muted)" }}>
            Sign in to access your notebooks
          </p>
        </div>

        {/* Sign-in form — wire up NextAuth signIn() action */}
        <form
          className="space-y-4"
          action="/api/auth/signin/credentials"
          method="POST"
        >
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium mb-1"
              style={{ color: "var(--wrp-text)" }}
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none"
              style={{ borderColor: "var(--wrp-secondary)" }}
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium mb-1"
              style={{ color: "var(--wrp-text)" }}
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none"
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

        <p
          className="text-center text-xs"
          style={{ color: "var(--wrp-text-muted)" }}
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
