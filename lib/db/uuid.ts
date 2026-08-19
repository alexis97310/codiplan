import { randomBytes } from "node:crypto";

/**
 * Génère un UUID version 7 (I10).
 *
 * L'invariant I10 impose un `id` UUID v7 : les 48 bits de poids fort portent
 * l'horodatage, ce qui rend les clés triables dans le temps et générables sur
 * l'appareil, y compris hors ligne. Node n'expose que `randomUUID` (v4) ; on
 * implémente donc v7 à la main plutôt que d'ajouter une dépendance (CLAUDE.md §2).
 */
export function uuidv7(): string {
  const octets = randomBytes(16);

  // 48 bits de timestamp en millisecondes, du plus fort au plus faible.
  // `Date.now()` (~2^41) reste très en deçà de l'entier sûr (2^53) : on extrait
  // chaque octet par division, sans BigInt (la cible TypeScript est ES2017).
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

  const hex = octets.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
