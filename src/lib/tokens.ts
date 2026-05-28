/**
 * Random URL-safe token used for the per-photographer upload URL
 * (`/p/<token>`). 24 random bytes -> 32 chars of base64url. ~192 bits of
 * entropy is overkill for the use case but cheap; collisions and brute force
 * are both effectively impossible.
 */
export function generateUploadToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  let b64 = "";
  for (let i = 0; i < bytes.length; i++) b64 += String.fromCharCode(bytes[i]!);
  return btoa(b64).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
