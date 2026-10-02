import { describe, expect, it } from "vitest";

import { fichiersSource, sansCommentaires } from "../outils/fichiers-source";

/**
 * GARDIEN (9CT-RETOUCHES-5) — AUCUN `envoyerCourriel(` NE S'APPELLE SOUS
 * `avecContexteApplicatif`/`avecContexteRls` DANS `lib/avertissements/`.
 *
 * **Le défaut que ce gardien ferme.** `DELAI_ENVOI_MS`
 * (`lib/courriel/resend.ts`) vaut 10 secondes ; une transaction Prisma ouverte
 * sans `delais` explicite retombe sur les défauts de Prisma — 5 000 ms pour
 * toute la transaction (`lib/db/rls.ts`). Avant ce ticket, `envoyerCourriel`
 * s'appelait DANS la transaction de lecture : un seul envoi lent — ou
 * plusieurs envoyés en série, comme le récapitulatif groupé — la faisait
 * ÉCHOUER, et la route n'avait pas de filet (`app/api/interventions/
 * transmettre/route.ts`) : une transmission déjà validée en base devenait un
 * 500 pour l'écran. La réparation (la scission lecture/envoi, `PlanEnvoi` et
 * `envoyerPlan`) est structurelle ; ce gardien tient qu'elle ne se défait pas
 * au fil d'un lot suivant.
 *
 * **Pourquoi un gardien plutôt qu'un seul test dynamique.** Un envoi lent se
 * simule (voir le garde-fou dans
 * `tests/isolation/avertissements-transmission-groupee.test.ts`), mais seul
 * un test STATIQUE prouve qu'AUCUN appel de ce module, présent ou futur, ne
 * reproduit le défaut — même un appel qu'aucun scénario ne pense à ralentir.
 */

const REPERTOIRE = "lib/avertissements";

/**
 * LES RÉGIONS DE TEXTE OUVERTES PAR UN APPEL À `nom(` — de sa parenthèse
 * ouvrante à la parenthèse fermante qui lui correspond, comptée par
 * profondeur. Un appel imbriqué (une fonction fléchée passée en argument,
 * elle-même pleine de parenthèses) reste correctement borné.
 */
function regionsDAppel(contenu: string, nom: string): readonly string[] {
  const regions: string[] = [];
  const motif = new RegExp(`\\b${nom}\\s*\\(`, "g");
  let correspondance: RegExpExecArray | null;
  while ((correspondance = motif.exec(contenu)) !== null) {
    const depart = correspondance.index + correspondance[0].length - 1;
    let profondeur = 0;
    let i = depart;
    for (; i < contenu.length; i++) {
      if (contenu[i] === "(") {
        profondeur++;
      } else if (contenu[i] === ")") {
        profondeur--;
        if (profondeur === 0) {
          break;
        }
      }
    }
    regions.push(contenu.slice(depart, i + 1));
  }
  return regions;
}

const MOTIF_ENVOI = /\benvoyerCourriel\s*\(/;

function regionsDeTransaction(contenu: string): readonly string[] {
  return [
    ...regionsDAppel(contenu, "avecContexteApplicatif"),
    ...regionsDAppel(contenu, "avecContexteRls"),
  ];
}

describe("aucun envoyerCourriel( sous une transaction, dans lib/avertissements/", () => {
  const fichiers = fichiersSource([REPERTOIRE]).map((fichier) => ({
    chemin: fichier.chemin,
    contenu: sansCommentaires(fichier.contenu),
  }));

  it("parcourt bien des fichiers — sinon le gardien serait vide", () => {
    expect(fichiers.length).toBeGreaterThan(0);
  });

  it("aucune région avecContexteApplicatif/avecContexteRls ne contient envoyerCourriel(", () => {
    const fautifs = fichiers
      .flatMap((fichier) =>
        regionsDeTransaction(fichier.contenu).map((region) => ({
          chemin: fichier.chemin,
          region,
        })),
      )
      .filter(({ region }) => MOTIF_ENVOI.test(region))
      .map(({ chemin }) => chemin);

    expect(
      fautifs,
      "un envoi de courriel SOUS la transaction de lecture peut la faire " +
        "échouer si l'envoi est lent (DELAI_ENVOI_MS = 10 s > le défaut " +
        "Prisma de 5 s) : composer un PlanEnvoi dans la transaction, " +
        "envoyer avec envoyerPlan APRÈS qu'elle s'est refermée.",
    ).toEqual([]);
  });

  it("le gardien détecte réellement un appel fabriqué à l'intérieur", () => {
    const fautif = `
      await avecContexteApplicatif(contexte, async (tx) => {
        const envoi = await envoyerCourriel({ destinataire, sujet, texte });
        return envoi;
      });
    `;
    const regions = regionsDeTransaction(fautif);
    expect(regions.some((region) => MOTIF_ENVOI.test(region))).toBe(true);
  });

  it("le gardien laisse passer un envoi composé dans la transaction et envoyé après", () => {
    const licite = `
      const plan = await avecContexteApplicatif(contexte, async (tx) => {
        return { type: "a_envoyer", destinataire, sujet, texte };
      });
      const envoi = await envoyerCourriel({ destinataire: plan.destinataire });
    `;
    const regions = regionsDeTransaction(licite);
    expect(regions.some((region) => MOTIF_ENVOI.test(region))).toBe(false);
  });
});
