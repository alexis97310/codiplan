import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  fichiersSource,
  RACINE,
  sansCommentaires,
} from "../outils/fichiers-source";

/**
 * LE GARDE-FOU DE `Carte` — une page de `app/(back-office)/**` ne recopie
 * plus `rounded-lg border` + fond blanc à la main (audit du 21/10/2026,
 * 9G9A, point 7).
 *
 * ## CE QU'IL DÉTECTE
 *
 * La même forme de classes que `components/ui/carte.tsx` lui-même porte —
 * `bg-app-surface` + `border-app-bord` + `rounded-lg border`, les trois dans
 * UN MÊME attribut `className` — posée à la main sur un `<section>` ou un
 * `<div>` plutôt que confiée à `Carte`. C'est exactement la faute nommée par
 * l'audit : « ~60 fichiers recopient `rounded-lg border` ».
 *
 * ## LA LISTE EST FERMÉE DANS LES DEUX SENS (même discipline que I8,
 * `scripts/lib/perimetre-audit.ts`, et que `chemins-de-depot.test.ts`)
 *
 * Elle contient aujourd'hui CHAQUE fichier de `app/(back-office)/**` qui
 * porte encore ce motif — mesuré, jamais deviné. Un fichier qui le porte et
 * n'y figure pas fait rougir ce gardien : c'est la régression qu'il existe
 * pour refuser. Un fichier de la liste qui NE LE PORTE PLUS fait rougir
 * AUSSI : une exemption qui ne protège plus rien doit sortir de la liste, ou
 * elle finit par couvrir une fausse promesse (§9, 01/09).
 *
 * **Pourquoi la liste est longue plutôt que vide.** Ce lot (9G9A) a converti
 * les points 1, 2, 3, 5 et 6 de l'audit, et une partie du point 4 (les
 * titres de section, à 14px partout) — mais PAS la conversion complète des
 * fiches intervention/client/site/demande et des écrans de paramétrage vers
 * `Carte`, hors de son budget de temps (voir la passation du lot). Chaque
 * entrée ci-dessous est donc un écran encore À CONVERTIR, pas un écran
 * approuvé pour toujours : un prochain lot qui le migre vers `Carte` RETIRE
 * sa ligne, il ne l'y laisse pas.
 */

const MOTIF =
  /bg-app-surface[^"]*border-app-bord[^"]*rounded-lg border|border-app-bord[^"]*bg-app-surface[^"]*rounded-lg border/;

/** Chaque entrée est encore à convertir vers `Carte` — voir la note de tête. */
const ECRANS_PAS_ENCORE_CONVERTIS = [
  "app/(back-office)/interventions/[id]/bon/page.tsx",
  "app/(back-office)/parametres/equipe/page.tsx",
  "app/(back-office)/parametres/habilitations/page.tsx",
  "app/(back-office)/parametres/materiel/page.tsx",
  "app/(back-office)/parc/[id]/page.tsx",
  "app/(back-office)/planning/page.tsx",
  "app/(back-office)/planning/statistiques.tsx",
  "app/(back-office)/sites/[id]/page.tsx",
  "app/(back-office)/vgp/page.tsx",
] as const;

const EXEMPTES = new Set<string>(ECRANS_PAS_ENCORE_CONVERTIS);

function porteLeMotif(chemin: string): boolean {
  const contenu = readFileSync(join(RACINE, chemin), "utf8");
  return MOTIF.test(sansCommentaires(contenu));
}

describe("Carte n'est pas recopiée à la main (audit du 21/10/2026, 9G9A, point 7)", () => {
  it("a réellement une liste à éprouver — le témoin de non-vacuité", () => {
    expect(ECRANS_PAS_ENCORE_CONVERTIS.length).toBeGreaterThan(0);
  });

  it("aucun fichier hors de la liste ne recopie bg-app-surface + border-app-bord + rounded-lg border", () => {
    const fautifs = fichiersSource(["app/(back-office)"], [".tsx"])
      .filter((fichier) => !EXEMPTES.has(fichier.chemin))
      .filter((fichier) => MOTIF.test(sansCommentaires(fichier.contenu)))
      .map((fichier) => fichier.chemin);

    expect(
      fautifs,
      "une carte à en-tête recopiée à la main au lieu d'utiliser " +
        "components/ui/carte.tsx — ou bien utiliser Carte, ou bien ajouter " +
        "la ligne à ECRANS_PAS_ENCORE_CONVERTIS avec sa raison",
    ).toEqual([]);
  });

  it("chaque exemption protège encore quelque chose — aucune ligne morte", () => {
    const mortes = ECRANS_PAS_ENCORE_CONVERTIS.filter(
      (chemin) => !porteLeMotif(chemin),
    );

    expect(
      mortes,
      "un écran converti vers Carte doit sortir de la liste, pas y dormir",
    ).toEqual([]);
  });
});
