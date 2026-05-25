import { customAlphabet } from "nanoid";

// URL-safe, ambiguity-free alphabet (no 0/O/1/l/I). 16 chars ≈ 79 bits of entropy.
const alphabet = "23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
export const newId = customAlphabet(alphabet, 16);
