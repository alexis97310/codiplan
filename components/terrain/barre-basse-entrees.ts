import type { NomIcone } from "@/components/ui/icone";
import type { CleTraduction } from "@/lib/i18n/fr";

/**
 * LES ENTRÉES DE LA BARRE BASSE (QE-11, D161) — deux, et pas une de plus
 * (voir le docblock de `barre-basse.tsx`).
 *
 * **Module SANS JSX, et c'est délibéré** : `barre-basse.tsx` rend cette
 * liste par un `.map()`, et le gardien de L0-11
 * (`tests/unit/i18n/sans-chaine-visible-en-dur.test.ts`) suit un identifiant
 * CONSTANT jusqu'à son initialisation, DANS LE MÊME FICHIER, pour juger si
 * un littéral atteint l'écran — une liste déclarée ICI, importée là-bas,
 * casse cette chaîne : `cle`, `chemin` et `icone` sont des VALEURS DE
 * CONFIGURATION (une clé de dictionnaire, une route, un nom d'icône),
 * jamais du texte visible par elles-mêmes — exactement ce que
 * `lib/navigation/entrees.ts` est déjà pour `ENTREES_TERRAIN`, dans un
 * fichier à part pour la même raison.
 */
export const ENTREES_BARRE_BASSE: readonly {
  readonly cle: CleTraduction;
  readonly chemin: string;
  readonly icone: NomIcone;
}[] = [
  { cle: "terrain.barre.journee", chemin: "/terrain", icone: "calendar" },
  { cle: "terrain.barre.profil", chemin: "/terrain/profil", icone: "user" },
];
