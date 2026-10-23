import { afterAll, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";
import { engendrerJetonQr } from "@/lib/machines/qr";

import { resolutionScanBureau } from "@/components/machines/scan-qr-bureau";
import { resolutionScanTerrain } from "@/components/machines/scan-qr-terrain";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  AGENCE_A,
  CLIENT_A1,
  MACHINE_A1,
  QR_A1,
  QR_B1,
  SITE_A1_S1,
  SOCIETE_A,
  UTILISATEUR_INTERNE_A,
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";

/**
 * LA RÉSOLUTION D'UN SCAN, CÔTÉ BUREAU ET CÔTÉ TERRAIN (9G10-SCANNER-QR-APPLI,
 * D144 d'Alexis). `tests/isolation/resolution-qr.test.ts` éprouve déjà
 * `resoudreParJeton` — le chemin que les deux fonctions d'ICI appellent
 * toutes les deux. Ce fichier éprouve ce qu'ELLES ajoutent par-dessus : la
 * garde de rôle, et — côté terrain — la destination (l'intervention en
 * cours), jamais rejouées depuis une variante écrite pour l'occasion.
 *
 * `resolutionScanBureau`/`resolutionScanTerrain` sont les moitiés qui
 * prennent un `ContexteActif` directement (L1-02d) — `resoudreScanBureau`/
 * `resoudreScanTerrain`, elles, lisent `headers()`, qui lève hors d'une
 * requête Next.js.
 */
describe("résolution d'un scan — bureau et terrain (9G10)", () => {
  const idsACreer: string[] = [];

  afterAll(async () => {
    if (idsACreer.length > 0) {
      await clientOwner().intervention.deleteMany({
        where: { id: { in: idsACreer } },
      });
    }
    await fermerClients();
  });

  const BUREAU_A = {
    utilisateurId: UTILISATEUR_PAR_ROLE[Role.admin_societe],
    societeId: SOCIETE_A,
    role: Role.admin_societe,
    secondFacteurValide: true,
    adresseIp: null,
    clientId: null,
  };

  const TECHNICIEN_A = {
    utilisateurId: UTILISATEUR_PAR_ROLE[Role.technicien],
    societeId: SOCIETE_A,
    role: Role.technicien,
    secondFacteurValide: true,
    adresseIp: null,
    clientId: null,
  };

  describe("resolutionScanBureau", () => {
    it("un rôle de bureau ouvre directement la fiche", async () => {
      const resultat = await resolutionScanBureau(BUREAU_A, QR_A1, clientApp());
      expect(resultat).toEqual({
        suite: "rediriger",
        url: `/parc/${MACHINE_A1}`,
      });
    });

    it("un technicien n'ouvre rien par ce chemin — même rejoué sur un jeton valide", async () => {
      // La garde rejoue `consulter_parc_complet` au niveau COMPLET (même
      // capacité que /parc) : un rôle RESTREINT n'y a jamais accès, quel
      // que soit le jeton.
      const resultat = await resolutionScanBureau(
        TECHNICIEN_A,
        QR_A1,
        clientApp(),
      );
      expect(resultat).toEqual({ suite: "introuvable" });
    });

    it("le jeton d'une autre société rend le même refus qu'un jeton inconnu", async () => {
      const inconnu = engendrerJetonQr();
      expect(await resolutionScanBureau(BUREAU_A, QR_B1, clientApp())).toEqual({
        suite: "introuvable",
      });
      expect(
        await resolutionScanBureau(BUREAU_A, inconnu, clientApp()),
      ).toEqual({ suite: "introuvable" });
    });
  });

  describe("resolutionScanTerrain", () => {
    it("un rôle de bureau n'ouvre rien par ce chemin — réservé au technicien", async () => {
      const resultat = await resolutionScanTerrain(
        BUREAU_A,
        QR_A1,
        clientApp(),
      );
      expect(resultat).toEqual({ suite: "introuvable" });
    });

    it("sans intervention en cours sur cette machine, le refus ne dit jamais pourquoi", async () => {
      // QR_A1 (MACHINE_A1) est bien de SA société, et le jeton est valide —
      // mais aucune intervention `affectee`/`en_cours`/`suspendue` n'y est
      // affectée à CE technicien dans le harnais : le même refus que « hors
      // de son périmètre » (D35, D50), jamais un `null` qui distinguerait
      // les deux.
      const resultat = await resolutionScanTerrain(
        TECHNICIEN_A,
        QR_A1,
        clientApp(),
      );
      expect(resultat).toEqual({ suite: "hors_perimetre" });
    });

    it("l'intervention AFFECTEE à UN AUTRE technicien sur la même machine ne fuite jamais", async () => {
      const interventionDAutrui = uuidv7();
      idsACreer.push(interventionDAutrui);
      await clientOwner().$executeRawUnsafe(
        `INSERT INTO "intervention"
             ("id", "societe_id", "client_id", "site_id", "agence_id", "type",
              "statut", "technicien_id", "duree_estimee_min", "modifie_le")
           VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif',
                   'affectee', $6::uuid, 60, now())`,
        interventionDAutrui,
        SOCIETE_A,
        CLIENT_A1,
        SITE_A1_S1,
        AGENCE_A,
        UTILISATEUR_INTERNE_A,
      );
      await clientOwner().$executeRawUnsafe(
        `INSERT INTO "intervention_machine"
             ("id", "societe_id", "intervention_id", "machine_id", "modifie_le")
           VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, now())`,
        uuidv7(),
        SOCIETE_A,
        interventionDAutrui,
        MACHINE_A1,
      );

      // CE technicien n'a encore AUCUNE intervention à lui sur la
      // machine : le refus reste `hors_perimetre`, jamais l'intervention
      // d'un collègue. (Le test suivant lui en pose une à LUI, sur la même
      // machine — l'ordre compte : celui-ci doit rester vrai alors que
      // l'intervention d'autrui existe déjà.)
      const resultat = await resolutionScanTerrain(
        TECHNICIEN_A,
        QR_A1,
        clientApp(),
      );
      expect(resultat).toEqual({ suite: "hors_perimetre" });
    });

    it("une intervention AFFECTEE à ce technicien sur la machine ouvre sa fiche", async () => {
      const interventionId = uuidv7();
      idsACreer.push(interventionId);
      await clientOwner().$executeRawUnsafe(
        `INSERT INTO "intervention"
             ("id", "societe_id", "client_id", "site_id", "agence_id", "type",
              "statut", "technicien_id", "duree_estimee_min", "modifie_le")
           VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif',
                   'affectee', $6::uuid, 60, now())`,
        interventionId,
        SOCIETE_A,
        CLIENT_A1,
        SITE_A1_S1,
        AGENCE_A,
        TECHNICIEN_A.utilisateurId,
      );
      await clientOwner().$executeRawUnsafe(
        `INSERT INTO "intervention_machine"
             ("id", "societe_id", "intervention_id", "machine_id", "modifie_le")
           VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, now())`,
        uuidv7(),
        SOCIETE_A,
        interventionId,
        MACHINE_A1,
      );

      const resultat = await resolutionScanTerrain(
        TECHNICIEN_A,
        QR_A1,
        clientApp(),
      );
      expect(resultat).toEqual({
        suite: "rediriger",
        url: `/terrain/${interventionId}`,
      });
    });

    it("le jeton d'une autre société rend le même refus qu'un jeton inconnu", async () => {
      const inconnu = engendrerJetonQr();
      expect(
        await resolutionScanTerrain(TECHNICIEN_A, QR_B1, clientApp()),
      ).toEqual({ suite: "introuvable" });
      expect(
        await resolutionScanTerrain(TECHNICIEN_A, inconnu, clientApp()),
      ).toEqual({ suite: "introuvable" });
    });
  });
});
