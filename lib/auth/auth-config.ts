/**
 * NextAuth.js v5 configuration — hardened session settings.
 *
 * Sessions are JWT-based, 8h max age (work day), httpOnly + secure cookies.
 * Admin-only routes must additionally check session.user.role === 'admin'.
 */
import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";

declare module "next-auth" {
  interface User {
    role?: string;
  }
  interface Session {
    user: {
      id: string;
      role: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

const authConfig: NextAuthConfig = {
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 hours — not the 30-day default
  },
  cookies: {
    sessionToken: {
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role ?? "viewer";
        token.sub = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.sub!;
      session.user.role = (token.role as string) ?? "viewer";
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login", // Redirect auth errors to login — never expose details
  },
  providers: [
    // Add providers here (e.g., GitHub, Google, Credentials for username/password)
    // Example Credentials provider for staff login is added in app/auth.ts
  ],
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
