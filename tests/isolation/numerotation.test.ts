import { afterAll, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";
import { creerIntervention } from "@/lib/interventions/depot";
import { schemaCreation } from "@/lib/interventions/saisie";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  CLIENT_A1,
  CLIENT_B1,
  SITE_A1_S1,
  SITE_B1_S1,
  SOCIETE_A,
  SOCIETE_B,
  UTILISATEUR_INTERNE_A,
  UTILISATEUR_INTERNE_B,
} from "./setup/fixtures";

/**
 * 9H2-NUMEROTATION-INTERVENTIONS, point 4 — LE COMPTEUR TIENT SOUS DEUX
 * ÉPREUVES QU'AUCUN SCÉNARIO UNITAIRE NE PEUT POSER : DEUX SOCIÉTÉS, ET LA
 * VRAIE CONCURRENCE.
 *
 * **Ce fichier ne suppose JAMAIS que son compteur démarre à 1.** Le projet
 * `isolation` partage une base entre tous ses fichiers (`fileParallelism:
 * false`, `globalSetup` unique) : un autre fichier a pu créer des
 * interventions pour SOCIETE_A avant celui-ci. La propriété éprouvée est donc
 * toujours RELATIVE — « le numéro avance d'exactement N », jamais « le
 * numéro vaut N ».
 */

/**
 * LES LIGNES CRÉÉES ICI SONT RÉELLES, DANS LA BASE PARTAGÉE DU PROJET
 * `isolation` — et d'AUTRES fichiers supposent une population CLOSE pour
 * SOCIETE_A/SOCIETE_B (listes exactes d'interventions, formes RLS). Chaque
 * ligne posée par ce fichier est donc EFFACÉE en fin de suite, par son
 * `id` — jamais un `DELETE` large, qui emporterait les fixtures du harnais.
 */
const IDS_CREES: string[] = [];

afterAll(async () => {
  if (IDS_CREES.length > 0) {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "id" = ANY($1::uuid[])`,
      IDS_CREES,
    );
  }
  await fermerClients();
});

const SESSION_A = {
  utilisateurId: UTILISATEUR_INTERNE_A,
  societeId: SOCIETE_A,
  role: Role.adv,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const SESSION_B = {
  utilisateurId: UTILISATEUR_INTERNE_B,
  societeId: SOCIETE_B,
  role: Role.adv,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

async function creerDans(
  session: typeof SESSION_A,
  clientId: string,
  siteId: string,
  description: string,
): Promise<{ readonly numero: number | null; readonly annee: number | null }> {
  const saisie = schemaCreation.parse({
    id: uuidv7(),
    client_id: clientId,
    site_id: siteId,
    type: "curatif",
    description,
  });
  const resultat = await creerIntervention(session, saisie, clientApp());
  if (!resultat.accepte) {
    throw new Error(`Création refusée : ${resultat.cle}`);
  }
  IDS_CREES.push(resultat.fiche.id);
  return { numero: resultat.fiche.numero, annee: resultat.fiche.annee };
}

describe("deux sociétés, deux compteurs indépendants", () => {
  it("la société B n'avance pas le compteur de la société A", async () => {
    const a1 = await creerDans(
      SESSION_A,
      CLIENT_A1,
      SITE_A1_S1,
      "Épreuve 9H2 — numérotation A1",
    );
    expect(a1.numero).not.toBeNull();
    expect(a1.annee).not.toBeNull();

    // SOCIETE_B crée dans l'INTERVALLE — son fuseau est Europe/Paris
    // (`FUSEAU_SOCIETE_B`), jamais celui de Nouméa : si l'année était encore
    // lue d'un territoire en dur, ce serait ICI que la divergence se verrait.
    await creerDans(
      SESSION_B,
      CLIENT_B1,
      SITE_B1_S1,
      "Épreuve 9H2 — numérotation B1",
    );

    const a2 = await creerDans(
      SESSION_A,
      CLIENT_A1,
      SITE_A1_S1,
      "Épreuve 9H2 — numérotation A2",
    );

    // LE CAS QUI DOIT RESTER ROUGE si un jour les deux compteurs se
    // mélangeaient : A2 == A1 + 1, jamais A1 + 2 (ce que la création
    // intercalée de B produirait si elle partageait le compteur de A).
    expect(a2.numero).toBe((a1.numero as number) + 1);
    expect(a2.annee).toBe(a1.annee);
  });
});

describe("20 créations concurrentes → 20 numéros distincts et consécutifs", () => {
  it("aucune collision, aucun trou, sous la même transaction de compteur", async () => {
    const NOMBRE = 20;
    const resultats = await Promise.all(
      Array.from({ length: NOMBRE }, (_, index) =>
        creerDans(
          SESSION_A,
          CLIENT_A1,
          SITE_A1_S1,
          `Épreuve 9H2 — concurrence ${index}`,
        ),
      ),
    );

    const numeros = resultats.map((r) => r.numero);
    expect(numeros.every((n) => n !== null)).toBe(true);

    const distincts = new Set(numeros);
    expect(distincts.size).toBe(NOMBRE);

    const tries = [...(numeros as number[])].sort((a, b) => a - b);
    const minimum = tries[0] as number;
    const maximum = tries[tries.length - 1] as number;
    // 20 valeurs distinctes dont l'écart min/max vaut exactement 19 ne
    // peuvent être qu'une suite CONSÉCUTIVE — une collision en aurait réduit
    // le nombre de distincts, un trou aurait élargi cet écart au-delà de 19.
    expect(maximum - minimum).toBe(NOMBRE - 1);

    // LES 20 PORTENT LA MÊME ANNÉE — même instant, même société.
    const annees = new Set(resultats.map((r) => r.annee));
    expect(annees.size).toBe(1);
  });
});
