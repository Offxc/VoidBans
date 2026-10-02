import { randomBytes } from "crypto";

// Crockford base32 minus ambiguous chars, no 0/O/1/I/L, kept short but
// still >40 bits of entropy, so IDs aren't guessable or enumerable.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
const LENGTH = 8;

export function generatePublicBanId(): string {
  const bytes = randomBytes(LENGTH);
  let id = "";
  for (let i = 0; i < LENGTH; i++) {
    id += ALPHABET[bytes[i]! % ALPHABET.length];
  }
  return `VB-${id}`;
}

const BAN_ID_PATTERN = /^VB-[23456789ABCDEFGHJKMNPQRSTVWXYZ]{8}$/;

export function isValidBanIdFormat(value: string): boolean {
  return BAN_ID_PATTERN.test(value);
}
