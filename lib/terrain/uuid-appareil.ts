/**
 * UUID v7, FABRIQUÉ SUR L'APPAREIL (I10) — `lib/db/uuid.ts` fait la même
 * chose mais avec `node:crypto`, absent du navigateur ; cette version
 * reprend la même construction (48 bits de poids fort = l'horodatage) avec
 * `crypto.getRandomValues` (Web Crypto, disponible hors ligne) plutôt que
 * de rendre `lib/db/uuid.ts` importable côté client.
 */
export function uuidv7Appareil(): string {
  const octets = new Uint8Array(16);
  crypto.getRandomValues(octets);

  const ms = Date.now();
  octets[0] = Math.floor(ms / 2 ** 40) % 256;
  octets[1] = Math.floor(ms / 2 ** 32) % 256;
  octets[2] = Math.floor(ms / 2 ** 24) % 256;
  octets[3] = Math.floor(ms / 2 ** 16) % 256;
  octets[4] = Math.floor(ms / 2 ** 8) % 256;
  octets[5] = ms % 256;

  // Version 7 sur les 4 bits de poids fort de l'octet 6.
  octets[6] = (octets[6] & 0x0f) | 0x70;
  // Variante RFC 4122 sur les 2 bits de poids fort de l'octet 8.
  octets[8] = (octets[8] & 0x3f) | 0x80;

  const hex = Array.from(octets, (octet) =>
    octet.toString(16).padStart(2, "0"),
  ).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
