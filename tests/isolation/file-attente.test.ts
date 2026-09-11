import { afterAll, afterEach, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";
import { listerPlanning } from "@/lib/interventions/depot";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  AGENCE_A,
  CLIENT_A1,
  SITE_A1_S1,
  SOCIETE_A,
  UTILISATEUR_INTERNE_A,
} from "./setup/fixtures";

/**
 * LA FILE D'ATTENTE À PLANIFIER — TRIÉE PAR URGENCE (L3-03).
 *
 * ## Le défaut, mesuré avant d'écrire une ligne
 *
 * Toutes les lignes de la file ont `date_planifiee` et `creneau_debut` **nuls**
 * — c'est ce qui les y met. Or c'étaient les deux seuls critères de tri : la
 * file entière était donc **ex æquo**, et PostgreSQL rend les ex æquo dans
 * l'ordre qu'il veut.
 *
 * *Mesuré le 11/09/2026 sur la base d'isolation :*
 *
 * | Ce qui a été observé | Résultat |
 * |---|---|
 * | l'ordre affiché | **p1, p1, p3, p2, p2** — pas par urgence |
 * | après un `UPDATE` sur la première ligne | elle passe **en fin de file** |
 *
 * La seconde mesure est la plus parlante : *un `UPDATE` réécrit le tuple à la
 * fin du tas, et la file suivait le tas.* **Le planificateur voyait sa file se
 * réordonner à chaque modification, sans qu'aucune règle le décide.**
 *
 * **Elle n'est PAS reproductible depuis un scénario, et c'est écrit plutôt que
 * tu** : PostgreSQL ne renvoie le tuple en fin de tas que si sa page est pleine,
 * et le scénario qui la rejoue reste vert sans le tri (mesuré par son jumeau).
 * Ce qui prouve le tri est la population adverse des trois premiers scénarios.
 *
 * ## Ce que ce fichier mesure, et que rien d'autre ne mesurerait
 *
 * Un ordre ne se prouve pas par une lecture : *une lecture qui rend le bon
 * ordre par hasard le rend aussi bien qu'une lecture qui le garantit.* Ce qui
 * le prouve est une **population adverse** — des lignes écrites dans l'ordre
 * INVERSE de celui qu'on attend —, si bien qu'un tri absent rendrait exactement
 * l'ordre d'écriture, et l'assertion tomberait.
 */

afterAll(fermerClients);

const SESSION = {
  utilisateurId: UTILISATEUR_INTERNE_A,
  societeId: SOCIETE_A,
  role: Role.adv,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

/** La fenêtre du planning — large, la file n'a de toute façon pas de date. */
const DU = new Date("2026-09-01T00:00:00.000Z");
const AU = new Date("2026-09-30T00:00:00.000Z");

const posees: string[] = [];

/**
 * Une intervention SANS date — donc dans la file —, avec sa priorité et son
 * instant de création.
 */
async function enAttente(priorite: string, creeLe: string): Promise<string> {
  const id = uuidv7();
  posees.push(id);
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "intervention" ("id", "societe_id", "client_id", "site_id",
       "agence_id", "type", "statut", "priorite", "cree_le", "modifie_le")
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif',
             'a_planifier', $6::"PrioriteIntervention", $7::timestamp, now())`,
    id,
    SOCIETE_A,
    CLIENT_A1,
    SITE_A1_S1,
    AGENCE_A,
    priorite,
    creeLe,
  );
  return id;
}

afterEach(async () => {
  for (const id of posees.splice(0)) {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "id" = $1::uuid`,
      id,
    );
  }
});

/** La file, dans l'ordre où l'écran la reçoit. */
async function file(): Promise<readonly string[]> {
  const lignes = await listerPlanning(SESSION, DU, AU, clientApp());
  return lignes
    .filter((l) => l.date_planifiee === null && posees.includes(l.id))
    .map((l) => l.id);
}

describe("la file d'attente à planifier", () => {
  it("L'URGENCE D'ABORD — et la population est écrite à L'ENVERS", async () => {
    // **La population est adverse, et c'est ce qui rend l'assertion utile** :
    // les lignes sont écrites de la moins urgente à la plus urgente. Un tri
    // absent rendrait l'ordre d'écriture, c'est-à-dire l'inverse exact de
    // l'attendu — le scénario ne peut pas passer par hasard.
    const basse = await enAttente("p4", "2026-09-01T08:00:00");
    const normale = await enAttente("p3", "2026-09-01T08:00:01");
    const haute = await enAttente("p2", "2026-09-01T08:00:02");
    const critique = await enAttente("p1", "2026-09-01T08:00:03");

    expect(await file()).toEqual([critique, haute, normale, basse]);
  });

  it("À URGENCE ÉGALE, LA PLUS ANCIENNE PASSE DEVANT — et ce n'est PAS l'échéance", async () => {
    // *Le ticket dit « urgence et échéance ».* **Aucune échéance n'existe** :
    // elle naît d'un contrat (RG-CON-01), et `contrat` est au lot 4. Ce second
    // rang est l'ANCIENNETÉ, et il est nommé pour ce qu'il est — ranger
    // `cree_le` sous le nom d'« échéance » serait inventer une règle métier
    // (§8).
    const recente = await enAttente("p2", "2026-09-03T08:00:00");
    const ancienne = await enAttente("p2", "2026-09-01T08:00:00");

    expect(await file()).toEqual([ancienne, recente]);
  });

  it("L'URGENCE PRIME SUR L'ANCIENNETÉ — le cas qui sépare les deux rangs", async () => {
    // *Sans lui, un tri par la seule ancienneté passerait le scénario
    // précédent.* La plus ancienne est ici la MOINS urgente : les deux critères
    // se contredisent, et c'est la seule configuration qui dit lequel décide.
    const vieilleEtBasse = await enAttente("p4", "2026-01-01T08:00:00");
    const neuveEtCritique = await enAttente("p1", "2026-09-10T08:00:00");

    expect(await file()).toEqual([neuveEtCritique, vieilleEtBasse]);
  });

  it("UN `UPDATE` NE RÉORDONNE PLUS RIEN — et ce scénario NE prouve pas le tri à lui seul", async () => {
    // **C'est la mesure qui a ouvert le ticket** : sur la base d'isolation, un
    // `UPDATE` sur la première ligne l'a envoyée en FIN de file, le tuple étant
    // réécrit à la fin du tas.
    //
    // **Et son jumeau l'a démenti comme PREUVE** *(mesuré le 11/09/2026)* : le
    // tri retiré, ce scénario reste VERT. PostgreSQL réécrit le tuple dans la
    // même page quand elle a de la place, et ne le renvoie en fin de tas que
    // lorsqu'elle n'en a pas — **je ne sais pas forcer ce cas depuis un
    // scénario.** Il est donc écrit pour ce qu'il est : *la propriété qu'on
    // veut tenir, pas la démonstration qu'on la tient.* Ce qui la démontre est
    // la population ADVERSE des trois scénarios ci-dessus, qui rougissent tous
    // les trois dès que le tri disparaît.
    //
    // *Un scénario qui reste vert sans le verrou qu'il croit mesurer est le
    // défaut du §9 (11/09) — la direction permissive, celle qui ne produit
    // aucun signal. On ne le supprime pas : on écrit ce qu'il ne prouve pas.*
    const premiere = await enAttente("p1", "2026-09-01T08:00:00");
    const seconde = await enAttente("p1", "2026-09-02T08:00:00");
    expect(await file()).toEqual([premiere, seconde]);

    await clientOwner().$executeRawUnsafe(
      `UPDATE "intervention" SET "modifie_le" = now() WHERE "id" = $1::uuid`,
      premiere,
    );
    expect(await file()).toEqual([premiere, seconde]);
  });

  it("L'ORDRE EST TOTAL — deux lignes créées au MÊME instant ne se départagent pas au hasard", async () => {
    // Le dernier rang, `id`. *Deux interventions créées dans la même
    // milliseconde restent possibles* — la synchronisation hors ligne en
    // remontera par lots —, et sans ce rang elles retomberaient dans le cas
    // qu'on vient de fermer. L'`id` est un UUID v7, ordonné dans le temps : il
    // prolonge `cree_le` au lieu de le contredire.
    //
    // **Même réserve que le scénario précédent, et elle est mesurée** : le tri
    // retiré, celui-ci reste vert — l'ordre d'écriture coïncide ici avec
    // l'ordre des `id`, les deux venant du même compteur. Il dit donc que la
    // propriété TIENT, pas qu'elle est GARDÉE. Ce qui la garde est le rang
    // `{ id: "asc" }`, et le prouver demanderait deux `id` écrits dans l'ordre
    // inverse de leur tirage — ce qu'`uuidv7` ne permet pas.
    const meme = "2026-09-05T08:00:00";
    const a = await enAttente("p2", meme);
    const b = await enAttente("p2", meme);
    const attendu = [a, b].sort();

    // Lu DEUX fois, avec une réécriture entre les deux.
    expect(await file()).toEqual(attendu);
    await clientOwner().$executeRawUnsafe(
      `UPDATE "intervention" SET "modifie_le" = now() WHERE "id" = $1::uuid`,
      attendu[0],
    );
    expect(await file()).toEqual(attendu);
  });

  it("TÉMOIN — les interventions DATÉES restent rangées par leur date, devant la file", async () => {
    // *Le ticket touche l'ordre de TOUT le planning, pas seulement de sa file.*
    // Sans ce témoin, un tri qui aurait mis l'urgence en PREMIER rang casserait
    // les deux vues du planning sans que rien ne le dise : la vue jour range
    // par heure, et une intervention de 8 h doit précéder celle de 14 h quelle
    // que soit sa priorité.
    const basse = uuidv7();
    posees.push(basse);
    await clientOwner().$executeRawUnsafe(
      `INSERT INTO "intervention" ("id", "societe_id", "client_id", "site_id",
         "agence_id", "type", "statut", "priorite", "date_planifiee",
         "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif',
               'planifiee', 'p4', DATE '2026-09-15', now())`,
      basse,
      SOCIETE_A,
      CLIENT_A1,
      SITE_A1_S1,
      AGENCE_A,
    );
    const critiqueEnAttente = await enAttente("p1", "2026-09-01T08:00:00");

    const lignes = await listerPlanning(SESSION, DU, AU, clientApp());
    const rangs = lignes.map((l) => l.id).filter((id) => posees.includes(id));
    // La DATÉE d'abord, la file ENSUITE — quelle que soit l'urgence.
    expect(rangs).toEqual([basse, critiqueEnAttente]);
  });
});
