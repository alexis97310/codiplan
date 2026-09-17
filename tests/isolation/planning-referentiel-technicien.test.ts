import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";
import { perimetreDuPlanning } from "@/lib/interventions/perimetre-technicien";

import { clientOwner, fermerClients, sousSocieteEtRole } from "./setup/db";
import {
  AGENCE_A,
  SOCIETE_A,
  UTILISATEUR_INTERNE_A,
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";

/**
 * R5-01 — LE RÉFÉRENTIEL DES TECHNICIENS NE SUIT PAS LE PÉRIMÈTRE PAR
 * PERSONNE TOUT SEUL, ET LA FUITE A ÉTÉ MESURÉE (17/09/2026).
 *
 * ## Le défaut, mesuré avant d'être corrigé
 *
 * `app/(back-office)/planning/page.tsx` sème un référentiel — `pourTechniciens`
 * — qui donne ses colonnes à la vue jour (depuis le 12/09) et ses lignes à la
 * vue semaine (N-06, ci-dessus). Il venait de
 * `tx.technicien.findMany({ where: { actif: true } })`, **sans lire le
 * périmètre** : sous la session RESTREINTE d'un technicien (rôle
 * `technicien`, `perimetreDuPlanning` rend `"restreint"`), cette requête
 * rendait la société ENTIÈRE.
 *
 * Mesuré sur le seed de démonstration (CODIMA-NC, 17/09/2026, avant
 * correction) : `listerPlanning` restreignait bien à 1 intervention et 1
 * personne, mais `technicien.findMany({ actif: true })` en rendait 4 — le
 * technicien connecté ET ses trois collègues. `personnesANommer` en tirait
 * l'union et résolvait les 4 noms : l'écran montrait la liste nominative de
 * toute l'équipe, et les cibles de dépôt de ses collègues, à un rôle que
 * `consulter_planning` restreint à sa propre identité.
 *
 * ## CE QUE CE FICHIER ÉTABLIT
 *
 * Le premier scénario est le TÉMOIN, et il est aussi le JUMEAU : sous le
 * contexte cloisonné du technicien, SANS la restriction applicative, la base
 * rend les DEUX techniciens actifs de la société — la RLS ne porte que le
 * cloisonnement par SOCIÉTÉ (I1), jamais la restriction par PERSONNE (R5-01,
 * qui vit dans la couche applicative). *Si ce scénario rendait 1, la mesure
 * suivante ne prouverait rien — elle constaterait une base qui filtre déjà.*
 *
 * Le second scénario rejoue EXACTEMENT le filtre que `page.tsx` pose
 * désormais — `perimetre.acces === "restreint" ? { utilisateur_id: … } : {}`
 * — et montre qu'il referme la fuite que le premier scénario a mesurée.
 */

afterAll(fermerClients);

const AUTRE_TECHNICIEN = UTILISATEUR_INTERNE_A;
const IDS_SEMES = [UTILISATEUR_PAR_ROLE.technicien, AUTRE_TECHNICIEN];

function session(role: Role, utilisateurId: string) {
  return {
    utilisateurId,
    societeId: SOCIETE_A,
    role,
    secondFacteurValide: true,
    adresseIp: null,
    clientId: null,
  };
}

const TECHNICIEN = session(Role.technicien, UTILISATEUR_PAR_ROLE.technicien);

/**
 * Amorce un SECOND technicien actif dans la société A, aux côtés de
 * `UTILISATEUR_PAR_ROLE.technicien` que les fixtures posent déjà comme rôle.
 * Aucune fixture partagée n'est touchée : ces deux lignes n'existent que
 * pour ce fichier, et sont retirées après chaque scénario.
 */
beforeEach(async () => {
  for (const utilisateurId of IDS_SEMES) {
    await clientOwner().technicien.upsert({
      where: {
        societe_id_utilisateur_id: {
          societe_id: SOCIETE_A,
          utilisateur_id: utilisateurId,
        },
      },
      create: {
        id: uuidv7(),
        societe_id: SOCIETE_A,
        utilisateur_id: utilisateurId,
        agence_id: AGENCE_A,
      },
      update: { actif: true },
    });
  }
});

afterEach(async () => {
  await clientOwner().technicien.deleteMany({
    where: { societe_id: SOCIETE_A, utilisateur_id: { in: IDS_SEMES } },
  });
});

describe("le référentiel des techniciens et le périmètre par personne", () => {
  it("TÉMOIN/JUMEAU — la base seule rend les DEUX techniciens au technicien restreint", async () => {
    const techniciens = await sousSocieteEtRole(
      SOCIETE_A,
      Role.technicien,
      (tx) =>
        tx.technicien.findMany({
          where: { societe_id: SOCIETE_A, actif: true },
          select: { utilisateur_id: true },
        }),
    );
    expect(new Set(techniciens.map((t) => t.utilisateur_id))).toEqual(
      new Set(IDS_SEMES),
    );
  });

  it("LE FILTRE DE page.tsx referme la fuite : un seul technicien reste", async () => {
    const perimetre = perimetreDuPlanning(TECHNICIEN);
    expect(perimetre).toEqual({
      acces: "restreint",
      technicienId: UTILISATEUR_PAR_ROLE.technicien,
    });

    const techniciens = await sousSocieteEtRole(
      SOCIETE_A,
      Role.technicien,
      (tx) =>
        tx.technicien.findMany({
          where: {
            societe_id: SOCIETE_A,
            actif: true,
            ...(perimetre.acces === "restreint"
              ? { utilisateur_id: perimetre.technicienId }
              : {}),
          },
          select: { utilisateur_id: true },
        }),
    );
    expect(techniciens.map((t) => t.utilisateur_id)).toEqual([
      UTILISATEUR_PAR_ROLE.technicien,
    ]);
  });

  it("un accès COMPLET ne pose aucun filtre : les deux techniciens restent visibles", async () => {
    const perimetre = perimetreDuPlanning(
      session(Role.adv, UTILISATEUR_INTERNE_A),
    );
    expect(perimetre.acces).toBe("complet");

    const techniciens = await sousSocieteEtRole(SOCIETE_A, Role.adv, (tx) =>
      tx.technicien.findMany({
        where: {
          societe_id: SOCIETE_A,
          actif: true,
          ...(perimetre.acces === "restreint"
            ? { utilisateur_id: perimetre.technicienId }
            : {}),
        },
        select: { utilisateur_id: true },
      }),
    );
    expect(new Set(techniciens.map((t) => t.utilisateur_id))).toEqual(
      new Set(IDS_SEMES),
    );
  });
});
