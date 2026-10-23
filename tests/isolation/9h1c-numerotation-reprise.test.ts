import { afterAll, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { avecContexteApplicatif } from "@/lib/db/client";
import { uuidv7 } from "@/lib/db/uuid";
import { creerInterventionsRepriseEnLot } from "@/lib/interventions/depot-reprise";

import { clientApp, fermerClients } from "./setup/db";
import {
  AGENCE_A,
  CLIENT_A1,
  SITE_A1_S1,
  SOCIETE_A,
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";

/**
 * 9H1C-MIGRATIONS-SOUS-RLS — point 3 : LA REPRISE NUMÉROTE À LA CRÉATION.
 *
 * `creerInterventionsRepriseEnLot` (`lib/interventions/depot-reprise.ts`)
 * créait ses lignes sans `numero` ni `annee` — exactement l'état que
 * `20261023073000_numerotation_interventions_demandes_9h2` rattrape sur
 * l'EXISTANT, mais un chemin de création qui continue à naître sans numéro
 * retomberait dans ce défaut à chaque nouvel import. Ce fichier prouve que ce
 * n'est plus le cas : chaque ligne du lot reçoit un numéro du MÊME compteur
 * (`compteur_numerotation`, `(societe_id, 'intervention', annee)`) que
 * `creerIntervention` (`depot.ts`), de façon contiguë au sein d'un même lot
 * et continue entre deux lots successifs.
 *
 * Les valeurs ABSOLUES ne sont jamais affirmées : le compteur est partagé par
 * toute la suite d'isolation (`fileParallelism: false`, mais un AUTRE fichier
 * exécuté avant celui-ci a pu créer des interventions pour SOCIETE_A). Seule
 * la PROGRESSION relative, à l'intérieur de ce fichier, est éprouvée — même
 * doctrine que `tests/isolation/numerotation.test.ts`.
 */

const ADMIN_A = {
  utilisateurId: UTILISATEUR_PAR_ROLE[Role.admin_societe],
  societeId: SOCIETE_A,
  role: Role.admin_societe,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};
const creees: string[] = [];

afterAll(async () => {
  if (creees.length > 0) {
    await clientApp().intervention.deleteMany({
      where: { id: { in: creees } },
    });
  }
  await fermerClients();
});

function ligne(objet: string) {
  return {
    date: new Date("2019-05-14T00:00:00.000Z"),
    type_document: "BI" as const,
    numero_document: `BI-9H1C-${objet}`,
    client_id: CLIENT_A1,
    site_id: SITE_A1_S1,
    agence_id: AGENCE_A,
    machine_id: null,
    reference_or: null,
    technicien: null,
    objet: `Reprise d'archive — épreuve 9H1C ${objet}`,
    montant_ht: null,
    devise_code: null,
  };
}

describe("creerInterventionsRepriseEnLot numérote ses lignes à la création", () => {
  it("un lot de plusieurs lignes reçoit des numéros CONTIGUS, même compteur que la planification", async () => {
    const ids = [uuidv7(), uuidv7(), uuidv7()];
    creees.push(...ids);

    await avecContexteApplicatif(
      ADMIN_A,
      (tx) =>
        creerInterventionsRepriseEnLot(
          tx,
          SOCIETE_A,
          ids.map((id, index) => ({ id, saisie: ligne(`lot-${index}`) })),
        ),
      clientApp(),
    );

    const lignes = await avecContexteApplicatif(
      ADMIN_A,
      (tx) =>
        tx.intervention.findMany({
          where: { id: { in: ids } },
          select: { id: true, numero: true, annee: true },
          orderBy: { numero: "asc" },
        }),
      clientApp(),
    );

    expect(lignes).toHaveLength(3);
    const annee = lignes[0]!.annee;
    for (const l of lignes) {
      expect(l.numero, l.id).not.toBeNull();
      expect(l.annee, l.id).toBe(annee);
    }
    const numeros = lignes.map((l) => l.numero as number);
    // CONTIGUS : trois appels séquentiels sur la MÊME ligne de compteur, dans
    // la MÊME transaction — aucune autre transaction ne peut s'y interposer
    // tant que celle-ci tient le verrou de ligne.
    expect(numeros[1]).toBe(numeros[0]! + 1);
    expect(numeros[2]).toBe(numeros[0]! + 2);
  });

  it("deux lots successifs continuent le MÊME compteur, sans jamais rejouer un numéro", async () => {
    const premier = uuidv7();
    creees.push(premier);
    await avecContexteApplicatif(
      ADMIN_A,
      (tx) =>
        creerInterventionsRepriseEnLot(tx, SOCIETE_A, [
          { id: premier, saisie: ligne("continu-1") },
        ]),
      clientApp(),
    );
    const [ligne1] = await avecContexteApplicatif(
      ADMIN_A,
      (tx) =>
        tx.intervention.findMany({
          where: { id: premier },
          select: { numero: true },
        }),
      clientApp(),
    );

    const second = uuidv7();
    creees.push(second);
    await avecContexteApplicatif(
      ADMIN_A,
      (tx) =>
        creerInterventionsRepriseEnLot(tx, SOCIETE_A, [
          { id: second, saisie: ligne("continu-2") },
        ]),
      clientApp(),
    );
    const [ligne2] = await avecContexteApplicatif(
      ADMIN_A,
      (tx) =>
        tx.intervention.findMany({
          where: { id: second },
          select: { numero: true },
        }),
      clientApp(),
    );

    expect(ligne2!.numero).toBe(ligne1!.numero! + 1);
  });
});
