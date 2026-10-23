import { afterAll, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";
import { creerIntervention } from "@/lib/interventions/depot";
import { schemaCreation } from "@/lib/interventions/saisie";

import { clientApp, clientOwner, fermerClients } from "./setup/db";

/**
 * 9H1C-MIGRATIONS-SOUS-RLS — point 4 : LA COURSE DU PREMIER NUMÉRO.
 *
 * `tests/isolation/numerotation.test.ts` éprouve déjà 20 créations
 * concurrentes, mais sur `SOCIETE_A` — dont le compteur `(SOCIETE_A,
 * 'intervention', <année en cours>)` existe déjà avant que ce fichier ne
 * s'exécute (d'autres scénarios de la suite y ont déjà créé des lignes). Il
 * ne peut donc PAS exercer la course sur un compteur ABSENT — exactement le
 * cas que la revue a nommé : « au premier numéro de l'année, create du
 * compteur puis, sur P2002, nouvel appel DANS la même transaction : sous
 * PostgreSQL l'erreur d'unicité avorte la transaction (25P02) sans point de
 * sauvegarde → deux créations simultanées un 1er janvier (ou pour une société
 * NEUVE) : l'une échoue. »
 *
 * Ce fichier pose une société FRAÎCHE — dont AUCUNE ligne de
 * `compteur_numerotation` n'existe encore pour aucune nature ni aucune
 * année — puis lance ses créations concurrentes directement contre elle.
 */

const SOCIETE_NEUVE = uuidv7();
const CALENDRIER = uuidv7();
const AGENCE = uuidv7();
const CLIENT = uuidv7();
const SITE = uuidv7();
const UTILISATEUR = uuidv7();

const idsCrees: string[] = [];

afterAll(async () => {
  const owner = clientOwner();
  if (idsCrees.length > 0) {
    await owner.$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "id" = ANY($1::uuid[])`,
      idsCrees,
    );
  }
  await owner.$executeRawUnsafe(
    `DELETE FROM "compteur_numerotation" WHERE "societe_id" = $1::uuid`,
    SOCIETE_NEUVE,
  );
  await owner.$executeRawUnsafe(
    `DELETE FROM "site" WHERE "id" = $1::uuid`,
    SITE,
  );
  await owner.$executeRawUnsafe(
    `DELETE FROM "client" WHERE "id" = $1::uuid`,
    CLIENT,
  );
  await owner.$executeRawUnsafe(
    `DELETE FROM "agence" WHERE "id" = $1::uuid`,
    AGENCE,
  );
  await owner.$executeRawUnsafe(
    `DELETE FROM "calendrier" WHERE "id" = $1::uuid`,
    CALENDRIER,
  );
  await owner.$executeRawUnsafe(
    `DELETE FROM "societe" WHERE "id" = $1::uuid`,
    SOCIETE_NEUVE,
  );
  await fermerClients();
});

describe("20 créations concurrentes sur une société NEUVE, compteur absent", () => {
  it("réussissent toutes les vingt, numéros distincts et consécutifs, aucune erreur", async () => {
    const owner = clientOwner();
    await owner.$executeRawUnsafe(
      `INSERT INTO "societe" ("id", "code", "raison_sociale", "pays", "territoire",
                              "fuseau_horaire", "devise_code",
                              "majoration_hors_ouverture_pct", "langue")
       VALUES ($1::uuid, '9H1C-COURSE', 'Société neuve — épreuve 9H1C', 'NC', 'NC',
               'Pacific/Noumea', 'XPF', 50, 'fr')`,
      SOCIETE_NEUVE,
    );
    await owner.$executeRawUnsafe(
      `INSERT INTO "calendrier" ("id", "societe_id", "code", "libelle")
       VALUES ($1::uuid, $2::uuid, '9H1C-CAL', 'Calendrier — épreuve 9H1C')`,
      CALENDRIER,
      SOCIETE_NEUVE,
    );
    await owner.$executeRawUnsafe(
      `INSERT INTO "agence" ("id", "societe_id", "code", "libelle", "territoire", "calendrier_id")
       VALUES ($1::uuid, $2::uuid, '9H1C-AG', 'Agence — épreuve 9H1C', 'NC', $3::uuid)`,
      AGENCE,
      SOCIETE_NEUVE,
      CALENDRIER,
    );
    await owner.$executeRawUnsafe(
      `INSERT INTO "client" ("id", "societe_id", "raison_sociale")
       VALUES ($1::uuid, $2::uuid, 'Client — épreuve 9H1C')`,
      CLIENT,
      SOCIETE_NEUVE,
    );
    await owner.$executeRawUnsafe(
      `INSERT INTO "site" ("id", "societe_id", "client_id", "agence_id", "libelle")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, 'Site — épreuve 9H1C')`,
      SITE,
      SOCIETE_NEUVE,
      CLIENT,
      AGENCE,
    );

    // TÉMOIN : le compteur de cette société n'existe vraiment pas encore —
    // sans ce témoin, un reliquat d'une exécution précédente rendrait cette
    // épreuve muette sur la course qu'elle doit exercer.
    const avant = await owner.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*)::bigint AS n FROM "compteur_numerotation" WHERE "societe_id" = $1::uuid`,
      SOCIETE_NEUVE,
    );
    expect(Number(avant[0]!.n)).toBe(0);

    const session = {
      utilisateurId: UTILISATEUR,
      societeId: SOCIETE_NEUVE,
      role: Role.adv,
      secondFacteurValide: true,
      adresseIp: null,
      clientId: null,
    };

    const NOMBRE = 20;
    const resultats = await Promise.all(
      Array.from({ length: NOMBRE }, async (_, index) => {
        const saisie = schemaCreation.parse({
          id: uuidv7(),
          client_id: CLIENT,
          site_id: SITE,
          type: "curatif",
          description: `Épreuve 9H1C — course du premier numéro ${index}`,
        });
        return creerIntervention(session, saisie, clientApp());
      }),
    );

    // AUCUNE ERREUR, AUCUN REFUS — c'est le point du ticket : avant le
    // correctif, une partie de ces 20 promesses ÉCHOUAIT (25P02).
    for (const resultat of resultats) {
      expect(resultat.accepte, JSON.stringify(resultat)).toBe(true);
      if (resultat.accepte) idsCrees.push(resultat.fiche.id);
    }

    const numeros = resultats
      .filter((r) => r.accepte)
      .map((r) => (r.accepte ? r.fiche.numero : null));
    expect(numeros.every((n) => n !== null)).toBe(true);

    const distincts = new Set(numeros);
    expect(distincts.size).toBe(NOMBRE);

    const tries = [...(numeros as number[])].sort((a, b) => a - b);
    expect(tries[0]).toBe(1);
    expect(tries[tries.length - 1]).toBe(NOMBRE);
  });
});
