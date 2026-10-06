import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

// Crockford base32 minus ambiguous chars (no 0/O/1/I/L) so an ID read off a
// screen is hard to mistype. Six characters is about 29 bits: short enough to
// type from a kick screen, and with lookups rate limited per IP and a lookup
// showing nothing but the reason and dates, guessing one isn't worth it.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
const LENGTH = 6;

export function generatePublicBanId(): string {
  const bytes = randomBytes(LENGTH);
  let id = "";
  for (let i = 0; i < LENGTH; i++) {
    id += ALPHABET[bytes[i]! % ALPHABET.length];
  }
  return id;
}

/** Generates an ID and makes sure nothing already uses it. */
export async function generateUniquePublicBanId(): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const id = generatePublicBanId();
    const taken = await prisma.punishment.findUnique({ where: { publicBanId: id }, select: { id: true } });
    if (!taken) return id;
  }
  throw new Error("Could not generate a unique punishment ID");
}

// IDs issued before the change were "VB-" plus eight characters. They are
// still in the database and still printed in old messages, so they keep working.
const ID_PATTERN = new RegExp(`^(?:[${ALPHABET}]{${LENGTH}}|VB-[${ALPHABET}]{8})$`);

export function isValidBanIdFormat(value: string): boolean {
  return ID_PATTERN.test(value);
}
