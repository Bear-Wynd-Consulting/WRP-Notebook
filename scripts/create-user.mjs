import bcrypt from "bcryptjs";
import { PrismaClient } from "../app/generated/prisma/client/index.js";

const EMAIL = "someone@email.com";
const PASSWORD = "changeme";
const ROLE = "admin"; // "admin" or "viewer"

const hash = await bcrypt.hash(PASSWORD, 12);
const prisma = new PrismaClient();

try {
  const user = await prisma.user.create({
    data: { email: EMAIL, passwordHash: hash, role: ROLE },
  });
  console.log("Created:", user.email, "| role:", user.role);
} catch (err) {
  if (err.code === "P2002") {
    console.log("User already exists:", EMAIL);
  } else {
    console.error(err.message);
  }
} finally {
  await prisma.$disconnect();
}
