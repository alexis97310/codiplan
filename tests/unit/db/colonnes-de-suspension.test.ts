import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  INTERVENTIONS_DEMONSTRATION,
  colonnesDeSuspension,
  type InterventionDemoSeed,
} from "../../../prisma/seed-data";

/**
 * LES QUATRE COLONNES DE SUSPENSION DU SEMIS (D104, RG-INT-06).
 *
 * ## La panne rejouée, et ce qu'elle a appris
 *
 * Le semis échouait en **`23514`** sur `intervention_suspension_a_sa_date`, à
 * l'étape « interventions replacées ». *Reproduit le 12/09/2026 sur un
 * PostgreSQL jetable, dans l'état exact de la production* — la contrainte
 * retirée, les quatre colonnes vidées sur les lignes suspendues, la contrainte
 * reposée `NOT VALID` : c'est ainsi que l'état est NÉ, une ligne antérieure à
 * la règle. Le semis d'avant échouait ; le semis réparé passe et rend les deux
 * lignes conformes.
 *
 * **Ce n'était pas un défaut de D104 : c'était D104 qui fonctionne.** Les
 * contraintes `NOT VALID` ne relisent pas les lignes d'avant, mais **toute
 * ligne qu'on TOUCHE doit se mettre en règle**. Le replacement touchait la
 * ligne sans renseigner sa suspension.
 *
 * ## Ce que ce fichier mesure, et ce qu'il ne mesure pas
 *
 * Il mesure **la règle** (le fait) et **son câblage** (le geste), et les deux
 * sont nommés séparément parce qu'ils ne se remplacent pas. *Ce qu'aucun des
 * deux ne mesure : qu'un semis joué contre une base réellement vieillie
 * aboutisse* — cela demande une base dont une ligne précède la contrainte, donc
 * un retrait de contrainte, et la preuve en a été faite à la main avec sa
 * mesure. La limite est écrite plutôt que tue.
 */

const modele = (
  parts: Partial<InterventionDemoSeed> = {},
): InterventionDemoSeed => ({
  rang: 1,
  type: "curatif",
  priorite: "p2",
  statut: "planifiee",
  joursDepuisLundi: 0,
  debutMinutes: 480,
  dureeMin: 60,
  temps_reel_min: null,
  ...parts,
});

const CRENEAU = new Date("2026-09-09T21:00:00Z");
const DISPO = new Date("2026-09-16T00:00:00Z");

describe("les quatre colonnes de suspension", () => {
  it("une intervention SUSPENDUE les porte toutes les quatre", () => {
    const colonnes = colonnesDeSuspension(
      modele({
        statut: "suspendue",
        motifSuspension: "Attente de pièce fournisseur",
        pieceAttendueRef: "CMP-4417-B",
      }),
      CRENEAU,
      DISPO,
    );

    expect(colonnes).toEqual({
      motif_suspension: "Attente de pièce fournisseur",
      piece_attendue_ref: "CMP-4417-B",
      date_dispo_prevue: DISPO,
      suspendue_le: CRENEAU,
    });
  });

  // LE CAS QUI DOIT RESTER « TOUT NUL » POUR SA PROPRE RAISON (§9, 11/09) : les
  // contraintes sont des ÉQUIVALENCES, dans les deux sens. Un motif posé sur
  // une intervention qui suit son cours dit qu'elle est arrêtée alors qu'elle
  // ne l'est pas — et la base le refuse aussi.
  it("une intervention NON suspendue les rend toutes NULLES", () => {
    const colonnes = colonnesDeSuspension(
      modele({ statut: "planifiee" }),
      CRENEAU,
      DISPO,
    );

    expect(colonnes).toEqual({
      motif_suspension: null,
      piece_attendue_ref: null,
      date_dispo_prevue: null,
      suspendue_le: null,
    });
  });

  // `suspendue_le` SUIT le créneau, il ne se lit pas à l'horloge : la
  // démonstration montre une attente qui a un ÂGE. Un créneau qui se déplace
  // déplace donc l'âge avec lui — et c'est ce que le replacement fait.
  it("`suspendue_le` suit le créneau qu'on lui donne", () => {
    const autre = new Date("2026-09-10T21:00:00Z");
    const colonnes = colonnesDeSuspension(
      modele({ statut: "suspendue", motifSuspension: "Attente" }),
      autre,
      null,
    );

    expect(colonnes.suspendue_le).toBe(autre);
  });

  // Une suspension SANS créneau rend `null` — et la base la REFUSE alors, par
  // `intervention_suspension_a_sa_date`. *C'est le bon sens de défaillance : le
  // verrou dit ce qui manque, plutôt qu'un instant inventé qui passerait
  // inaperçu.* Aucune horloge n'est lue ici (L0-08).
  it("une suspension SANS créneau rend une date NULLE, jamais un instant inventé", () => {
    const colonnes = colonnesDeSuspension(
      modele({
        statut: "suspendue",
        motifSuspension: "Attente",
        joursDepuisLundi: null,
        debutMinutes: null,
      }),
      null,
      null,
    );

    expect(colonnes.suspendue_le).toBeNull();
    expect(colonnes.motif_suspension).toBe("Attente");
  });

  // Une référence de pièce EXIGE son horizon, et l'inverse (RG-INT-06). Le
  // modèle porte les deux ou aucun ; ce scénario mesure que la règle ne casse
  // jamais la paire.
  it("la référence de pièce et son horizon ne se séparent jamais", () => {
    for (const demo of INTERVENTIONS_DEMONSTRATION) {
      const colonnes = colonnesDeSuspension(
        demo,
        demo.debutMinutes === null ? null : CRENEAU,
        demo.pieceDispoJoursDepuisLundi === undefined ? null : DISPO,
      );
      expect(
        (colonnes.piece_attendue_ref !== null) ===
          (colonnes.date_dispo_prevue !== null),
        `rang ${demo.rang} : référence et horizon se séparent`,
      ).toBe(true);
    }
  });

  // TÉMOIN : le jeu de démonstration porte bien une suspension. Sans elle, tous
  // les scénarios ci-dessus mesureraient le cas « non suspendue », et la file
  // « en attente de pièce » ne serait démontrée nulle part.
  it("le jeu de démonstration porte au moins une suspension, motif compris", () => {
    const suspendues = INTERVENTIONS_DEMONSTRATION.filter(
      (d) => d.statut === "suspendue",
    );
    expect(suspendues.length).toBeGreaterThan(0);
    for (const demo of suspendues) {
      expect(demo.motifSuspension, `rang ${demo.rang}`).toBeDefined();
      expect(
        demo.debutMinutes,
        `rang ${demo.rang} sans créneau`,
      ).not.toBeNull();
    }
  });
});

/**
 * LE CÂBLAGE — et la POPULATION vient du FICHIER, jamais d'une liste.
 *
 * `colonnesDeSuspension` rend **toujours les quatre** colonnes, nulles
 * comprises : une écriture qui l'étale est donc complète par construction. Le
 * risque qui reste est qu'un chemin d'écriture OUBLIE de l'étaler — c'est
 * exactement ce qui s'est passé.
 *
 * Ce contrôle est un contrôle de GESTE, et il est annoncé comme tel (§9, 09/09).
 * Il ne prouve pas que le semis aboutit ; il refuse qu'un chemin d'écriture
 * d'intervention naisse demain sans ses colonnes de suspension.
 */
describe("le câblage du semis", () => {
  const source = readFileSync(join(process.cwd(), "prisma", "seed.ts"), "utf8");

  it("CHAQUE écriture d'intervention du semis étale les quatre colonnes", () => {
    // La population est DÉRIVÉE : toute création ou modification
    // d'intervention, où qu'elle soit écrite dans le fichier.
    const ecritures = [
      ...source.matchAll(/tx\.intervention\.(create|update|upsert)\(/g),
    ];
    // TÉMOIN : un motif devenu aveugle rendrait un vert sur zéro écriture.
    expect(ecritures.length).toBeGreaterThanOrEqual(2);

    const appels = [...source.matchAll(/\.\.\.colonnesDeSuspension\(/g)];
    expect(
      appels.length,
      `${ecritures.length} écriture(s) d'intervention pour ${appels.length} ` +
        "appel(s) à colonnesDeSuspension : une écriture qui touche une " +
        "intervention suspendue sans renseigner ses quatre colonnes est " +
        "refusée par la base (23514), et c'est la panne du 12/09/2026.",
    ).toBe(ecritures.length);
  });
});
