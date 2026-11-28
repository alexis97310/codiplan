import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  fichiersSource,
  RACINE,
  sansCommentaires,
} from "../outils/fichiers-source";

/**
 * AUCUN MONTANT N'ATTEINT JAMAIS LE TERRAIN (9L64-GARDIEN-AUCUN-MONTANT-
 * TERRAIN) — la matrice du §5.2 ne donne au technicien aucun
 * `voir_montants_vente` (`lib/interventions/montants-visibles.ts`), et chaque
 * écran du terrain a déjà, un par un, un commentaire qui le dit
 * (9F4H5B-JOURNEE-SANS-MONTANT, 9F4H1-HORS-RESEAU-CONSULTATION, 9I8B-
 * CONDITIONS-DE-FACTURATION-SANS-MONTANT…). **Ce gardien tient la règle en
 * général, au lieu d'un commentaire par écran** : il balaie tout ce que le
 * terrain sert — pages, routes, composants, projections — et rougit si l'un
 * des CHAMPS MONÉTAIRES du schéma s'y écrit en code, jamais sur sa seule
 * mention en prose.
 *
 * ## LA LISTE EST MESURÉE, PAS INVENTÉE
 *
 * `CHAMPS_MONETAIRES` reprend les noms EXACTS trouvés par
 * `grep -nE "^\s+(montant|majoration)[a-z_]*\s+(BigInt|Decimal)" prisma/
 * schema.prisma` (`Intervention.montant_ht`, `Forfait.montant_mineur`,
 * `TauxHoraire.montant_mineur`, `Societe.majoration_hors_ouverture_pct`), plus
 * la forme JSON de `Intervention.valorisation_figee`
 * (`ValorisationFigeeJSON`, `lib/interventions/depot.ts`) qui porte les MÊMES
 * montants sous d'autres noms (`tauxHoraire`, `mainDoeuvre`,
 * `forfaitDeplacement`, `totalHT`) une fois décodée — un gardien qui ne
 * guetterait que le nom de la colonne laisserait passer la valeur qu'elle
 * contient, décodée. Le témoin ci-dessous prouve que chaque nom vit bien
 * dans l'un de ces fichiers, jamais seulement dans ce test.
 *
 * ## CE QU'IL BALAIE, ET CE QUE ÇA NE PROUVE PAS
 *
 * `app/(mobile)`, `app/(sans-session)/terrain-hors-reseau`, `app/api/terrain`,
 * `components/terrain`, `components/interventions/photos-terrain.tsx` et
 * `lib/terrain` — tout ce que le téléphone du technicien charge, directement
 * ou par une projection dédiée. **Ne prouve pas** qu'un champ sélectionné par
 * `lib/interventions/depot.ts` (partagé avec le back-office) n'atteint
 * jamais ces fichiers par un autre chemin que son propre nom — c'est la
 * moitié que `tests/unit/gardiens/note-interne-jamais-terrain.test.ts`
 * éprouve déjà pour la note interne, et que l'isolation
 * (`tests/isolation/terrain-instantane-route.test.ts`) éprouve pour
 * `/api/terrain/instantane` en rejouant la route pour de vrai.
 *
 * ## LES COMMENTAIRES SONT RETIRÉS AVANT LA LECTURE
 *
 * Chaque fichier terrain explique DÉJÀ, en prose, qu'il exclut ces champs —
 * en les nommant. Un gardien qui lirait le texte brut échouerait sur sa
 * propre documentation, et la seule façon de le faire passer serait de
 * l'appauvrir (même motif que L0-08, `sansCommentaires`). Seul ce qui reste
 * après le retrait des commentaires compte comme une violation.
 */

const REPERTOIRES_TERRAIN = [
  "app/(mobile)",
  "app/(sans-session)/terrain-hors-reseau",
  "app/api/terrain",
  "components/terrain",
  "lib/terrain",
] as const;

/** Des fichiers précis, pas des répertoires — lus à part (voir plus bas). */
const FICHIERS_SUPPLEMENTAIRES = [
  "components/interventions/photos-terrain.tsx",
] as const;

/** Mesuré sur le schéma et sur la forme JSON de `valorisation_figee` — voir le docblock. */
const CHAMPS_MONETAIRES = [
  "montant_ht",
  "montant_mineur",
  "montantMineur",
  "valorisation_figee",
  "valorisationFigee",
  "majoration_hors_ouverture_pct",
  "majorationHorsOuverturePct",
  "tauxHoraire",
  "mainDoeuvre",
  "forfaitDeplacement",
  "totalHT",
] as const;

/** Les fichiers « sources de vérité » où chaque nom doit être mesuré (témoin). */
const SOURCES_DE_VERITE = [
  "prisma/schema.prisma",
  "lib/interventions/depot.ts",
  "lib/tarification/valorisation.ts",
  "lib/tarification/taux-initial.ts",
  "app/api/portail/tarifs/route.ts",
] as const;

type Violation = { readonly fichier: string; readonly champ: string };

function violationsDeMontant(
  fichiers: readonly { readonly chemin: string; readonly contenu: string }[],
  champs: readonly string[],
): Violation[] {
  const violations: Violation[] = [];
  for (const fichier of fichiers) {
    const code = sansCommentaires(fichier.contenu);
    for (const champ of champs) {
      if (new RegExp(`\\b${champ}\\b`).test(code)) {
        violations.push({ fichier: fichier.chemin, champ });
      }
    }
  }
  return violations;
}

describe("témoin — chaque champ monétaire est mesuré, jamais inventé", () => {
  const texteDesSources = SOURCES_DE_VERITE.map((chemin) =>
    readFileSync(join(RACINE, chemin), "utf8"),
  ).join("\n");

  it.each(CHAMPS_MONETAIRES)("« %s » vit dans le dépôt réel", (champ) => {
    expect(texteDesSources).toContain(champ);
  });
});

describe("aucun champ monétaire ne s'écrit en code sur ce que le terrain sert", () => {
  const fichiers = [
    ...fichiersSource([...REPERTOIRES_TERRAIN]),
    ...FICHIERS_SUPPLEMENTAIRES.map((chemin) => ({
      chemin,
      contenu: readFileSync(join(RACINE, chemin), "utf8"),
    })),
  ];

  it("TÉMOIN — la population balayée n'est pas vide", () => {
    expect(fichiers.length).toBeGreaterThan(10);
  });

  it("aucune violation sur le dépôt réel", () => {
    const violations = violationsDeMontant(fichiers, CHAMPS_MONETAIRES);
    expect(
      violations,
      violations
        .map((v) => `${v.fichier} écrit le champ monétaire « ${v.champ} »`)
        .join("\n"),
    ).toEqual([]);
  });

  it("le détecteur rougit sur un champ écrit en code (pas en commentaire)", () => {
    const violations = violationsDeMontant(
      [
        {
          chemin: "fixture.tsx",
          contenu: [
            "export function Fiche({ montant_ht }: { montant_ht: number }) {",
            "  return <p>{montant_ht}</p>;",
            "}",
          ].join("\n"),
        },
      ],
      CHAMPS_MONETAIRES,
    );
    expect(violations).toEqual([
      { fichier: "fixture.tsx", champ: "montant_ht" },
    ]);
  });

  it("le détecteur reste vert quand le champ n'apparaît que dans un commentaire", () => {
    const violations = violationsDeMontant(
      [
        {
          chemin: "fixture.tsx",
          contenu: [
            "// Aucun montant ici : `montant_ht` n'est jamais lu par ce fichier.",
            "export function Fiche() {",
            "  return null;",
            "}",
          ].join("\n"),
        },
      ],
      CHAMPS_MONETAIRES,
    );
    expect(violations).toEqual([]);
  });
});
