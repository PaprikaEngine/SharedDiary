/** Beta gate — passphrase-based access control */

export const GATE_COOKIE = "gate_token";

/** Hash passphrase to create a verifiable cookie token */
export async function hashPassphrase(passphrase: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(passphrase + ":shareddiary-gate-salt");
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
