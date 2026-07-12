"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/client";

export async function registerAction(formData: FormData) {
  const email    = ((formData.get("email")           as string) ?? "").toLowerCase().trim();
  const password = ((formData.get("password")        as string) ?? "");
  const confirm  = ((formData.get("confirmPassword") as string) ?? "");

  if (!email)                                        redirect("/register?error=email_required");
  if (!email.endsWith("@westernresearchparks.ca"))   redirect("/register?error=domain");
  if (password.length < 8)                           redirect("/register?error=password_short");
  if (password !== confirm)                          redirect("/register?error=password_mismatch");

  const hash  = await bcrypt.hash(password, 12);
  const count = await prisma.user.count();
  const role  = count === 0 ? "admin" : "viewer";

  try {
    await prisma.user.create({ data: { email, passwordHash: hash, role } });
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "P2002") redirect("/register?error=email_taken");
    throw err;
  }

  redirect("/login?registered=1");
}
