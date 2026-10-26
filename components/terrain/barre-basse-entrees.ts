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
  /**
   * LA SECTION QU'UNE ENTRÉE ALLUME (point 2, 9G5-TERRAIN-ERGONOMIE) — même
   * champ, même raison que `EntreeNavigation.section`
   * (`lib/navigation/entrees.ts`) : sur `/terrain/<id>`, une fiche
   * d'intervention, ni « Journée » (`/terrain`) ni « Profil »
   * (`/terrain/profil`) ne s'allumait avec une égalité stricte. « Journée »
   * allume toute sa section, « Profil » n'allume que la sienne — le préfixe
   * le plus long gagne (`entreeActive`), donc `/terrain/profil` reste à
   * « Profil » et jamais à « Journée ».
   */
  readonly section?: string;
  readonly icone: NomIcone;
}[] = [
  {
    cle: "terrain.barre.journee",
    chemin: "/terrain",
    section: "/terrain",
    icone: "calendar",
  },
  { cle: "terrain.barre.profil", chemin: "/terrain/profil", icone: "user" },
];
