import type { NomIcone } from "@/components/ui/icone";
import type { CleTraduction } from "@/lib/i18n/fr";

/**
 * LES QUATRE DESTINATIONS DE LA BARRE BASSE DU BUREAU, AU TÉLÉPHONE (QE-6a,
 * 9DV-TP-NAV4-TELEPHONE-GLOSSAIRE) — Accueil, Planning, Interventions, Parc,
 * dans cet ordre (maquette du 28/09, `maquette-toutes-pages.html:1961`). Une
 * cinquième entrée, « Plus », ouvre le tiroir complet (`barre-basse-bureau.tsx`)
 * — ce n'est jamais une destination, elle n'a donc pas sa place ici.
 *
 * **Module SANS JSX, et c'est délibéré** — même discipline que
 * `components/terrain/barre-basse-entrees.ts` : le gardien de L0-11
 * (`tests/unit/i18n/sans-chaine-visible-en-dur.test.ts`) suit un identifiant
 * CONSTANT jusqu'à son initialisation, DANS LE MÊME FICHIER, pour juger si un
 * littéral atteint l'écran — une liste déclarée ici, rendue là-bas, casse
 * cette chaîne. `cleCapacite`, `cleLibelle`, `chemin` et `icone` sont des
 * VALEURS DE CONFIGURATION, jamais du texte visible par elles-mêmes.
 *
 * `cleCapacite` NOMME LA CLÉ DE `lib/navigation/entrees.ts` DONT LA CAPACITÉ
 * GOUVERNE CETTE DESTINATION — jamais une seconde matrice de rôles : c'est
 * exactement la clé que `CAPACITE_REQUISE` y porte déjà pour le même écran,
 * relue par `entreeVisible`. `cleLibelle` est distincte parce que la barre
 * basse nomme « Accueil » ce que la barre latérale nomme « Tableau de bord »
 * (voir `nav.barre_basse.accueil` dans `lib/i18n/fr.ts`) ; pour les trois
 * autres, les deux clés coïncident.
 */
export const ENTREES_BARRE_BASSE_BUREAU: readonly {
  readonly cleCapacite: CleTraduction;
  readonly cleLibelle: CleTraduction;
  readonly chemin: string;
  readonly icone: NomIcone;
}[] = [
  {
    cleCapacite: "nav.tableau_de_bord",
    cleLibelle: "nav.barre_basse.accueil",
    chemin: "/tableau-de-bord",
    icone: "home",
  },
  {
    cleCapacite: "nav.planning",
    cleLibelle: "nav.planning",
    chemin: "/planning",
    icone: "calendar",
  },
  {
    cleCapacite: "nav.interventions",
    cleLibelle: "nav.interventions",
    chemin: "/interventions",
    icone: "clipboard",
  },
  {
    cleCapacite: "nav.parc_machines",
    cleLibelle: "nav.parc_machines",
    chemin: "/parc",
    icone: "machine",
  },
];
