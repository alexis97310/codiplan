/**
 * LE FORMAT D'UNE IMAGE, LU DANS SES OCTETS — jamais dans un en-tête ni une
 * extension (9EWB-PHOTOS-EN-BASE).
 *
 * `fichier.type` et le nom de fichier sont fournis par le client, donc
 * falsifiables sans effort ; un SVG renommé `.jpg` avec `Content-Type:
 * image/jpeg` les franchirait tous les deux. Les octets magiques, eux,
 * sont les premiers octets RÉELS du fichier — ce que JPEG et PNG écrivent
 * en tête de chaque fichier conforme, invariant quel que soit son nom.
 */

export type FormatImageReconnu = "image/jpeg" | "image/png";

const SIGNATURES: ReadonlyArray<{
  readonly type: FormatImageReconnu;
  readonly octets: readonly number[];
}> = [
  { type: "image/jpeg", octets: [0xff, 0xd8, 0xff] },
  {
    type: "image/png",
    octets: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  },
];

/** `null` si les octets ne commencent par aucune signature reconnue. */
export function formatImageReconnu(
  octets: Uint8Array,
): FormatImageReconnu | null {
  for (const signature of SIGNATURES) {
    if (signature.octets.every((valeur, index) => octets[index] === valeur)) {
      return signature.type;
    }
  }
  return null;
}
