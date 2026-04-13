/**
 * AES-256-GCM encryption for AI provider credentials.
 *
 * Authenticated encryption — provides both confidentiality and integrity.
 * Stored format: base64(iv):base64(authTag):base64(ciphertext)
 *
 * CREDENTIAL_ENCRYPTION_KEY must be a 64-char hex string (32 bytes).
 * Use different keys per environment. Never commit to source control.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16; // bytes

function getEncryptionKey(): Buffer {
  const hexKey = process.env.CREDENTIAL_ENCRYPTION_KEY;
  if (!hexKey || hexKey.length !== 64) {
    throw new Error(
      "CREDENTIAL_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). " +
        "Generate with: openssl rand -hex 32"
    );
  }
  return Buffer.from(hexKey, "hex");
}

/**
 * Encrypt a plaintext credential value.
 * Returns a safe string for database storage.
 */
export function encryptCredential(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

/**
 * Decrypt a credential value from the database.
 * Throws if the key is wrong or the ciphertext has been tampered with (GCM auth check).
 */
export function decryptCredential(stored: string): string {
  const key = getEncryptionKey();
  const parts = stored.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted credential format");
  }
  const [ivB64, tagB64, dataB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(tagB64, "base64");
  const encrypted = Buffer.from(dataB64, "base64");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(encrypted).toString("utf8") + decipher.final("utf8");
}
