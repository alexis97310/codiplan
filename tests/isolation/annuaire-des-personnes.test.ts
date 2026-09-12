import { afterAll, describe, expect, it } from "vitest";

import { nomsDesPersonnes } from "@/lib/auth/annuaire";

import {
  avecPortail,
  fermerClients,
  observerSousProprietaire,
  sousSociete,
} from "./setup/db";
import {
  CLIENT_A1,
  SITE_A1_S1,
  SOCIETE_A,
  UTILISATEUR_INTERNE_A,
  UTILISATEUR_INTERNE_B,
} from "./setup/fixtures";

/**
 * L'ANNUAIRE DES PERSONNES, ÉPROUVÉ PLUTÔT QUE MESURÉ UNE FOIS À LA MAIN
 * (R2-11 ; L1-02c, D10).
 *
 * ## CE QUE CE FICHIER REMPLACE
 *
 * L'en-tête de `lib/auth/annuaire.ts` porte un tableau de mesures *faites à la
 * main le 11/09/2026* : interne sous contexte → 4 identités, compte portail au
 * même instant → 0. **C'était juste, et ce n'était pas un gardien.** Une mesure
 * écrite dans un commentaire ne rougit pas le jour où la politique change ;
 * elle vieillit, et *une prescription qui ne se vérifie pas est une intention*
 * (§9, 31/08).
 *
 * ## POURQUOI CE MODULE MÉRITE UN GARDIEN À LUI SEUL
 *
 * Il lit `utilisateur` **SANS AUCUNE CLAUSE DE SOCIÉTÉ**, en s'en remettant
 * entièrement à la politique `utilisateur_lecture`. C'est délibéré — *une
 * comparaison écrite au-dessus serait une seconde lecture d'un même critère* —,
 * mais cela veut dire que **rien dans ce fichier ne protège quoi que ce soit**.
 * Le jour où la branche « rattachement » de la politique serait retirée ou
 * élargie, ce module rendrait des noms d'une autre société **sans changer d'une
 * ligne**.
 *
 * ## LE COMPORTEMENT GARDÉ
 *
 * *Quand il reçoit les identifiants de DEUX sociétés sous le contexte de
 * l'une, seuls les noms de celle-là reviennent* — et **zéro sous un compte
 * portail**, quel que soit ce qu'on lui demande.
 */

afterAll(fermerClients);

/** Les deux identités demandées ensemble : une de chaque société. */
const LES_DEUX = [UTILISATEUR_INTERNE_A, UTILISATEUR_INTERNE_B];

const PORTAIL_RESTREINT = {
  societeId: SOCIETE_A,
  clientId: CLIENT_A1,
  perimetreSites: [SITE_A1_S1],
} as const;

describe("le TÉMOIN PRÉALABLE — les deux identités existent vraiment", () => {
  it("la base en porte bien deux, une par société", () => {
    // §9, 07/09 : *un résultat qui vous surprend en bien est un soupçon sur la
    // mesure avant d'être un fait sur le monde.* Sans ce témoin, « une seule
    // revient » serait aussi bien la preuve que la seconde n'existe pas.
    return observerSousProprietaire(
      "compter les deux identités demandées : sans elles, le filtrage " +
        "mesuré plus bas ne filtrerait rien.",
    )
      .$queryRawUnsafe<Array<{ n: bigint }>>(
        `SELECT count(*) AS "n" FROM "utilisateur" WHERE "id" = ANY($1::uuid[])`,
        LES_DEUX,
      )
      .then((lignes) => {
        expect(Number(lignes[0]?.n)).toBe(2);
      });
  });
});

describe("sous le contexte d'UNE société, seuls ses noms reviennent", () => {
  it("l'identité de l'autre société est ABSENTE de la réponse", async () => {
    const noms = await sousSociete(SOCIETE_A, (tx) =>
      nomsDesPersonnes(tx, LES_DEUX),
    );

    // *Une absence est un refus* — c'est le contrat du module, et il ne lève
    // pas : un planning affiche alors la ligne sans nom plutôt que de tomber.
    expect(noms.has(UTILISATEUR_INTERNE_A)).toBe(true);
    expect(noms.has(UTILISATEUR_INTERNE_B)).toBe(false);
    expect(noms.size).toBe(1);
  });

  it("et le nom rendu n'est pas vide — le filtre ne rend pas des coquilles", async () => {
    const noms = await sousSociete(SOCIETE_A, (tx) =>
      nomsDesPersonnes(tx, [UTILISATEUR_INTERNE_A]),
    );
    expect((noms.get(UTILISATEUR_INTERNE_A) ?? "").length).toBeGreaterThan(0);
  });
});

describe("un compte PORTAIL ne lit AUCUN nom, même le sien de société", () => {
  it("zéro, quel que soit ce qu'on lui demande", async () => {
    // D10 : la branche « rattachement » de `utilisateur_lecture` exclut
    // nommément un compte portail. *En cas de doute entre montrer et cacher,
    // on cache* — et un annuaire des salariés de CODIMA n'a rien à faire chez
    // un client.
    const noms = await avecPortail(PORTAIL_RESTREINT, (tx) =>
      nomsDesPersonnes(tx, LES_DEUX),
    );
    expect(noms.size).toBe(0);
  });
});

describe("ce qu'il ne fait pas, et qui se mesure aussi", () => {
  it("une liste VIDE n'ouvre aucune requête et rend une carte vide", async () => {
    // *Aucune requête plutôt qu'un `IN ()`* : c'est un aller-retour de moins
    // sous 190 ms de latence vers Sydney (§9, 23/08). Le contrat rendu doit
    // rester le même — une carte vide, jamais `null`.
    const noms = await sousSociete(SOCIETE_A, (tx) => nomsDesPersonnes(tx, []));
    expect(noms.size).toBe(0);
  });

  it("les doublons sont dédupliqués sans changer le résultat", async () => {
    const noms = await sousSociete(SOCIETE_A, (tx) =>
      nomsDesPersonnes(tx, [
        UTILISATEUR_INTERNE_A,
        UTILISATEUR_INTERNE_A,
        UTILISATEUR_INTERNE_A,
      ]),
    );
    expect(noms.size).toBe(1);
  });
});
