import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  collectionsDeLaTransaction,
  collectionsExportees,
  collectionsHorsBudget,
  lireSource,
  transactionCloisonnee,
} from "../../../scripts/lib/budget-du-semis";
import { RACINE } from "../outils/fichiers-source";

/**
 * LE BUDGET DU SEMIS COMPTE-T-IL CE QUE LE SEMIS ÉCRIT ? (R3-10)
 *
 * *Mesuré le 13/09/2026* : il ne comptait pas les seize interventions de
 * `INTERVENTIONS_DEMONSTRATION`, écrites dans la transaction cloisonnée depuis
 * R2-12 — un `findUnique` puis un `create` chacune. **Un budget sous-évalué ne
 * rougit pas : il rassure**, et il laisse passer un semis qui expirera sur la
 * base hébergée, c'est-à-dire dans le seul environnement que rien n'exerce
 * (§9, 23/08).
 *
 * **Ce que ce gardien tient, et ce qu'il annonce ne pas tenir.** Il exige
 * qu'aucune collection parcourue par la transaction ne soit absente du budget ;
 * il ne vérifie pas l'arithmétique — *deux allers-retours par ligne plutôt
 * qu'un ne se lisent pas dans un nom*. Le budget reste un budget.
 */
const DONNEES = lireSource(join(RACINE, "prisma", "seed-data.ts"));
const SEMIS = lireSource(join(RACINE, "prisma", "seed.ts"));
const BUDGET = lireSource(join(RACINE, "prisma", "seed-delais.ts"));

describe("le budget d'allers-retours compte ce que la transaction écrit", () => {
  it("aucune collection parcourue par la transaction n'est absente du budget", () => {
    expect(
      collectionsHorsBudget(DONNEES, SEMIS, BUDGET),
      "ces collections sont écrites DANS la transaction cloisonnée et le " +
        "budget ne les compte pas. Un budget sous-évalué ne rougit pas : il " +
        "rassure, et le semis expire sur la base hébergée — le seul " +
        "environnement qu'aucune suite n'exerce. Ajouter le terme à " +
        "`allersRetoursTransaction`, ou sortir l'écriture de cette transaction.",
    ).toEqual([]);
  });

  it("LE TÉMOIN : la transaction est un vrai découpage, pas une chaîne vide", () => {
    const bloc = transactionCloisonnee(SEMIS);
    // Sans ces deux bornes, un découpage devenu creux rendrait « aucune
    // collection oubliée » — le vert par absence de mesure (§9, 30/08).
    expect(bloc.length).toBeGreaterThan(1_000);
    expect(bloc.length).toBeLessThan(SEMIS.length);
  });

  it("LE TÉMOIN : la population n'est pas vide, et elle porte les deux cas connus", () => {
    const parcourues = collectionsDeLaTransaction(DONNEES, SEMIS);
    expect(parcourues.length).toBeGreaterThan(0);
    // CE QUI DOIT ROUGIR s'il cesse d'être compté…
    expect(parcourues).toContain("INTERVENTIONS_DEMONSTRATION");
    expect(parcourues).toContain("HABILITATIONS_AMORCAGE");
  });

  it("ET LE CAS QUI DOIT RESTER VERT POUR SA PROPRE RAISON", () => {
    // `UTILISATEURS_INTERNES` est exporté comme les autres et il est écrit
    // AILLEURS — hors de la transaction cloisonnée, dans la sienne. Sans ce
    // cas, un découpage qui prendrait tout le fichier passerait pour juste.
    expect(collectionsExportees(DONNEES)).toContain("UTILISATEURS_INTERNES");
    expect(collectionsDeLaTransaction(DONNEES, SEMIS)).not.toContain(
      "UTILISATEURS_INTERNES",
    );
  });
});
