import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { RACINE, sansCommentaires } from "../outils/fichiers-source";

/**
 * LE PLANCHER DE 12 PX DANS LES PAGES ET LES DEUX COMPOSANTS RATTACHÉS
 * (D138, TP-UX1-2).
 *
 * D138 (`docs/arbitrages.md:4997-5025`, 29/09/2026) : « Rien, dans le
 * produit, ne s'affiche en dessous de 12 px — quelle que soit la maquette qui
 * fixe la taille à cet endroit » (:5011). Ce gardien tient la même commande
 * que `plancher-typographique.test.ts` (TP-UX1-1, `components/ui/` et la
 * navigation) — la même regex du plan
 * (`docs/propositions/ergonomie-2026-09-28/lots-ux.md`) —, appliquée cette
 * fois au territoire de TP-UX1-2 : les pages d'`app/` touchées par le lot et
 * deux composants métier qui lui sont rattachés
 * (`components/planning/fenetre-pose.tsx`, `components/planning/tiroir.tsx`).
 *
 * **La population est une LISTE EXPLICITE, pas un répertoire entier** :
 * `app/` porte aussi des fichiers hors de ce ticket (5 classes restantes,
 * territoire de 9BW — `components/planning/pose.tsx`,
 * `components/interventions/trouver-creneau.tsx`), et un répertoire entier
 * ferait rougir ce gardien sur un territoire qu'il ne couvre pas. La liste
 * grandit à chaque commit de ce ticket ; elle ne rétrécit jamais.
 *
 * `existsSync` sur chaque chemin garde le gardien HONNÊTE si un fichier de la
 * liste est renommé : un chemin mort ne doit jamais se lire comme un fichier
 * sans classe fautive.
 */

const CLASSE_SOUS_LE_PLANCHER = /text-\[(9|1[01])(\.[0-9])?px\]/;

const FICHIERS = [
  // G1 — planning, fenêtre de pose et tiroir
  "app/(back-office)/planning/page.tsx",
  "components/planning/fenetre-pose.tsx",
  "components/planning/tiroir.tsx",
  // G2 — interventions, demandes, absences, tableau de bord, arrivée, contacts
  "app/(back-office)/interventions/[id]/page.tsx",
  "app/(back-office)/interventions/[id]/bon/page.tsx",
  "app/(back-office)/interventions/nouvelle/page.tsx",
  "app/(back-office)/interventions/page.tsx",
  "components/interventions/site-et-machines.tsx",
  "app/(back-office)/demandes/[id]/page.tsx",
  "app/(back-office)/absences/page.tsx",
  "app/(back-office)/tableau-de-bord/page.tsx",
  "app/(back-office)/arrivee/composants.tsx",
  "app/(back-office)/contacts/presentation.tsx",
  // G3 — clients, sites, parc, VGP
  "app/(back-office)/clients/[id]/page.tsx",
  "app/(back-office)/clients/page.tsx",
  "app/(back-office)/clients/nouveau/page.tsx",
  "app/(back-office)/sites/[id]/page.tsx",
  "app/(back-office)/sites/page.tsx",
  "app/(back-office)/sites/nouveau/page.tsx",
  "app/(back-office)/parc/page.tsx",
  "app/(back-office)/parc/[id]/page.tsx",
  "components/parc/formulaire-machine.tsx",
  "app/(back-office)/vgp/page.tsx",
  // G4 — paramètres et imports
  "app/(back-office)/parametres/equipe/page.tsx",
  "app/(back-office)/parametres/materiel/page.tsx",
  "app/(back-office)/parametres/prestations/page.tsx",
  "app/(back-office)/parametres/trajets/page.tsx",
  "app/(back-office)/parametres/agences/[id]/page.tsx",
  "app/(back-office)/parametres/agences/nouvelle/page.tsx",
  "app/(back-office)/parametres/agences/[id]/modifier/page.tsx",
  "app/(back-office)/parametres/agences/page.tsx",
  "app/(back-office)/parametres/forfaits/page.tsx",
  "app/(back-office)/parametres/forfaits/[id]/page.tsx",
  "app/(back-office)/parametres/habilitations/page.tsx",
  "app/(back-office)/parametres/societe/page.tsx",
  "app/(back-office)/imports/[id]/page.tsx",
  "app/(back-office)/imports/page.tsx",
  // G5 — terrain et portail
  "app/(mobile)/terrain/page.tsx",
  "app/(mobile)/terrain/[id]/page.tsx",
  "app/(portail)/portail/page.tsx",
];

describe("plancher de 12 px — pages de TP-UX1-2 (D138)", () => {
  it("a réellement une liste à éprouver — le témoin de non-vacuité", () => {
    expect(FICHIERS.length).toBeGreaterThan(0);
  });

  it("chaque fichier de la liste existe encore", () => {
    const manquants = FICHIERS.filter(
      (chemin) => !existsSync(join(RACINE, chemin)),
    );
    expect(
      manquants,
      "un chemin renommé ne doit jamais se relire comme un fichier propre",
    ).toEqual([]);
  });

  it("aucune classe sous 12 px (9, 9.5, 10, 10.5, 11, 11.5 px) ne subsiste", () => {
    const fautifs = FICHIERS.filter((chemin) => {
      const contenu = readFileSync(join(RACINE, chemin), "utf8");
      return CLASSE_SOUS_LE_PLANCHER.test(sansCommentaires(contenu));
    });

    expect(
      fautifs,
      "D138 (docs/arbitrages.md, 29/09/2026) : plancher de 12 px — aucune " +
        "page de ce territoire ne descend en dessous",
    ).toEqual([]);
  });
});
