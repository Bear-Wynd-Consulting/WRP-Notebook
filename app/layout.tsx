import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WRP Knowledge Hub",
  description:
    "Western Research Parks knowledge management platform — powered by AI",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
