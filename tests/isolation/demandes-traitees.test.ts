import { afterAll, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import {
  compterDemandesTraitees,
  demandesTraitees,
} from "@/lib/demandes/depot";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  AGENCE_A,
  AGENCE_B,
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
 * L'ONGLET « TRAITÉES » (TP-DEM, IN-40, D164).
 *
 * `demandesTraitees`/`compterDemandesTraitees` (`lib/demandes/depot.ts`) sont
 * le complément EXACT de `demandesOuvertes`, déjà confronté par
 * `tests/isolation/demande.test.ts` — ce fichier ne reprend pas ce
 * cloisonnement « parc » (société, portail, périmètre de sites), il confronte
 * uniquement ce que ce lot AJOUTE : le filtre de statut (`transformee` /
 * `close_sans_suite`, rien d'autre) et l'ordre (la plus RÉCENTE d'abord,
 * l'inverse de `demandesOuvertes`).
 *
 * Les demandes sont posées directement par `INSERT` — le déclencheur
 * `demande_cycle_de_vie` ne garde que l'`UPDATE` (migration
 * `20260913140000_demande_l2_06`) — jamais sur une fixture partagée, et
 * nettoyées en `afterAll`.
 */

afterAll(fermerClients);

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

const RECENTE = "aaaaaaaa-1111-7000-8000-00000000d1a1";
const ANCIENNE = "aaaaaaaa-1111-7000-8000-00000000d1a2";
const CLOSE_A = "aaaaaaaa-1111-7000-8000-00000000d1a3";
const NOUVELLE_A = "aaaaaaaa-1111-7000-8000-00000000d1a4";
const QUALIFIEE_A = "aaaaaaaa-1111-7000-8000-00000000d1a5";
const TRANSFORMEE_B = "bbbbbbbb-1111-7000-8000-00000000d1b1";

async function poser(
  id: string,
  options: {
    societeId: string;
    clientId: string;
    siteId: string;
    agenceId: string;
    statut: "nouvelle" | "qualifiee" | "transformee" | "close_sans_suite";
    deposeLe: Date;
  },
): Promise<void> {
  if (options.statut === "close_sans_suite") {
    await clientOwner().$executeRawUnsafe(
      `INSERT INTO "demande" ("id", "societe_id", "source", "client_id", "site_id",
         "agence_id", "description", "statut", "motif_cloture", "depose_le",
         "compteur_accuse_le", "close_le", "modifie_le")
       VALUES ('${id}', '${options.societeId}', 'appel', '${options.clientId}',
         '${options.siteId}', '${options.agenceId}', 'Épreuve TP-DEM', 'close_sans_suite',
         'doublon', '${options.deposeLe.toISOString()}', now(), now(), now())`,
    );
    return;
  }
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "demande" ("id", "societe_id", "source", "client_id", "site_id",
       "agence_id", "description", "statut", "depose_le", "compteur_accuse_le",
       "modifie_le")
     VALUES ('${id}', '${options.societeId}', 'appel', '${options.clientId}',
       '${options.siteId}', '${options.agenceId}', 'Épreuve TP-DEM', '${options.statut}',
       '${options.deposeLe.toISOString()}', now(), now())`,
  );
}

async function nettoyer(): Promise<void> {
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "demande" WHERE "id" IN
      ('${RECENTE}', '${ANCIENNE}', '${CLOSE_A}', '${NOUVELLE_A}', '${QUALIFIEE_A}', '${TRANSFORMEE_B}')`,
  );
}

describe("demandesTraitees / compterDemandesTraitees (TP-DEM, IN-40, D164)", () => {
  it("ne rend que TRANSFORMÉE et CLOSE SANS SUITE, de la société du contexte, la plus RÉCENTE d'abord", async () => {
    const maintenant = new Date();
    const hier = new Date(maintenant.getTime() - 24 * 60 * 60 * 1000);
    const avantToutes = await compterDemandesTraitees(SESSION_A, clientApp());
    try {
      await poser(ANCIENNE, {
        societeId: SOCIETE_A,
        clientId: CLIENT_A1,
        siteId: SITE_A1_S1,
        agenceId: AGENCE_A,
        statut: "transformee",
        deposeLe: hier,
      });
      await poser(RECENTE, {
        societeId: SOCIETE_A,
        clientId: CLIENT_A1,
        siteId: SITE_A1_S1,
        agenceId: AGENCE_A,
        statut: "transformee",
        deposeLe: maintenant,
      });
      await poser(CLOSE_A, {
        societeId: SOCIETE_A,
        clientId: CLIENT_A1,
        siteId: SITE_A1_S1,
        agenceId: AGENCE_A,
        statut: "close_sans_suite",
        deposeLe: maintenant,
      });
      // RIEN DE « À TRAITER » (nouvelle/qualifiee) NE DOIT APPARAÎTRE —
      // mêmes société/client/site que les trois ci-dessus, pour que seul le
      // STATUT explique l'absence.
      await poser(NOUVELLE_A, {
        societeId: SOCIETE_A,
        clientId: CLIENT_A1,
        siteId: SITE_A1_S1,
        agenceId: AGENCE_A,
        statut: "nouvelle",
        deposeLe: maintenant,
      });
      await poser(QUALIFIEE_A, {
        societeId: SOCIETE_A,
        clientId: CLIENT_A1,
        siteId: SITE_A1_S1,
        agenceId: AGENCE_A,
        statut: "qualifiee",
        deposeLe: maintenant,
      });
      // RIEN D'UNE AUTRE SOCIÉTÉ — transformée elle aussi, pour que seule la
      // société explique l'absence sous `SESSION_A`.
      await poser(TRANSFORMEE_B, {
        societeId: SOCIETE_B,
        clientId: CLIENT_B1,
        siteId: SITE_B1_S1,
        agenceId: AGENCE_B,
        statut: "transformee",
        deposeLe: maintenant,
      });

      const apresTrois = await compterDemandesTraitees(SESSION_A, clientApp());
      expect(apresTrois).toBe(avantToutes + 3);

      const lignes = await demandesTraitees(
        SESSION_A,
        { page: 1 },
        clientApp(),
      );
      const ids = lignes.map((l) => l.id);
      expect(ids).toContain(RECENTE);
      expect(ids).toContain(ANCIENNE);
      expect(ids).toContain(CLOSE_A);
      expect(ids).not.toContain(NOUVELLE_A);
      expect(ids).not.toContain(QUALIFIEE_A);
      expect(ids).not.toContain(TRANSFORMEE_B);

      // TOUTE LIGNE RENDUE EST TRANSFORMÉE OU CLOSE SANS SUITE — jamais un
      // troisième statut qui se serait glissé par un autre chemin.
      for (const ligne of lignes) {
        expect(["transformee", "close_sans_suite"]).toContain(ligne.statut);
      }

      // LA PLUS RÉCENTE D'ABORD — l'inverse de `demandesOuvertes`
      // (`parLaPlusAncienne`, côté écran) : parmi NOS deux lignes, l'index de
      // la récente précède celui de l'ancienne.
      const indexRecente = ids.indexOf(RECENTE);
      const indexAncienne = ids.indexOf(ANCIENNE);
      expect(indexRecente).toBeGreaterThanOrEqual(0);
      expect(indexAncienne).toBeGreaterThan(indexRecente);
    } finally {
      await nettoyer();
    }
  });

  it("une société B qui pose une demande traitée n'apparaît jamais sous le contexte de la société A", async () => {
    const maintenant = new Date();
    try {
      await poser(TRANSFORMEE_B, {
        societeId: SOCIETE_B,
        clientId: CLIENT_B1,
        siteId: SITE_B1_S1,
        agenceId: AGENCE_B,
        statut: "transformee",
        deposeLe: maintenant,
      });

      const vuesSousB = await demandesTraitees(
        SESSION_B,
        { page: 1 },
        clientApp(),
      );
      expect(vuesSousB.map((l) => l.id)).toContain(TRANSFORMEE_B);

      const vuesSousA = await demandesTraitees(
        SESSION_A,
        { page: 1 },
        clientApp(),
      );
      expect(vuesSousA.map((l) => l.id)).not.toContain(TRANSFORMEE_B);
    } finally {
      await nettoyer();
    }
  });
});
