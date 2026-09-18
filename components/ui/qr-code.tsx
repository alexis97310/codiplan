import qrcode from "qrcode-generator";

import { QR_ENCRE, QR_FOND } from "@/lib/theme/qr";

/**
 * LE QR CODE — SVG, rendu CÔTÉ SERVEUR, sans `<canvas>` ni CDN (N-11).
 *
 * ## La bibliothèque retenue, et pourquoi
 *
 * Trois candidates mesurées, aucune couche de compatibilité :
 *
 * | Paquet | Dépendances | Dernière publication | Types TypeScript |
 * |---|---|---|---|
 * | `qrcode` | 3 transitives (`dijkstrajs`, `pngjs`, `yargs`) | — | via `@types` |
 * | `qrcode-svg` | 0 | 2022-06-25 (3 ans) | via `@types/qrcode-svg` (communautaire) |
 * | **`qrcode-generator`** | **0** | **2025-08-07** | **livrés par le paquet lui-même** |
 *
 * `qrcode` est écartée d'emblée : la contrainte du ticket est explicite —
 * « sans dépendance transitive » — et elle en porte trois. Entre les deux
 * paquets à zéro dépendance, `qrcode-generator` est retenue : elle est
 * maintenue activement (contre trois ans de silence pour l'autre) et fournit
 * ses propres `.d.ts`, quand `qrcode-svg` dépend d'un paquet `@types` tiers
 * susceptible de retard — un projet vendu (chapitre 22) n'a pas intérêt à
 * fonder son typage sur une communauté distincte de son fournisseur.
 *
 * ## Pourquoi ce fichier ne rend PAS `createSvgTag()`
 *
 * La bibliothèque sait déjà produire un `<svg>` complet en chaîne — mais une
 * chaîne s'injecte par `dangerouslySetInnerHTML`, une porte qu'on n'ouvre pas
 * quand elle peut s'éviter (même sans donnée utilisateur dans le résultat :
 * *une porte qu'on n'a pas besoin d'ouvrir ne s'ouvre pas*). `getModuleCount()`
 * et `isDark(ligne, colonne)` sont l'API bas niveau du même paquet — aussi
 * stable, et elle rend un `<svg>` en JSX ordinaire, sans chaîne à faire
 * confiance.
 *
 * ## Le SECRET n'entre jamais dans le DOM en clair
 *
 * `valeur` (le jeton, D71) ne devient que des rectangles noirs et blancs —
 * aucun texte, aucun attribut ne le restitue. L'appelant choisit `titre`
 * (l'`aria-label`) sans jamais y recopier `valeur` : *le jeton ne s'écrit
 * jamais en clair à l'écran* (N-11, §4).
 *
 * ## Noir sur blanc, jamais la charte
 *
 * `QR_ENCRE`/`QR_FOND` viennent de `lib/theme/qr.ts`, jamais d'ici : voir ce
 * fichier pour le motif — un contraste de lecteur de code-barres n'est pas un
 * choix d'apparence.
 *
 * ## La marge de silence, MESURÉE sur le même geste que la maquette
 *
 * `docs/maquette/codiplan-maquette-complete.html` (`drawQr()`) pose
 * `quiet=4` — quatre modules de marge blanche de chaque côté, la convention
 * de la spécification QR. Reprise ici à l'identique.
 */
const MARGE_SILENCE = 4;

export function QrCode({
  valeur,
  taille,
  titre,
}: Readonly<{
  /** Ce que le QR encode. Un secret y entre, il n'en ressort jamais en texte. */
  valeur: string;
  /** Le côté du carré rendu, en pixels CSS — le SVG est vectoriel, borné par cette taille. */
  taille: number;
  /** `aria-label` de l'image — jamais `valeur` recopiée (D71). */
  titre: string;
}>) {
  const qr = qrcode(0, "M");
  qr.addData(valeur);
  qr.make();
  const modules = qr.getModuleCount();
  const cote = modules + MARGE_SILENCE * 2;

  const cases: React.ReactNode[] = [];
  for (let ligne = 0; ligne < modules; ligne++) {
    for (let colonne = 0; colonne < modules; colonne++) {
      if (qr.isDark(ligne, colonne)) {
        cases.push(
          <rect
            key={`${ligne}-${colonne}`}
            x={colonne + MARGE_SILENCE}
            y={ligne + MARGE_SILENCE}
            width={1}
            height={1}
          />,
        );
      }
    }
  }

  return (
    <svg
      role="img"
      aria-label={titre}
      viewBox={`0 0 ${cote} ${cote}`}
      width={taille}
      height={taille}
      className="mx-auto block"
    >
      <rect x={0} y={0} width={cote} height={cote} fill={QR_FOND} />
      <g fill={QR_ENCRE}>{cases}</g>
    </svg>
  );
}
