import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { COMPTE_TECHNICIEN_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * SES DEUX PROPRES INTERVENTIONS, ET POURQUOI (51-STABILITE-1, 24/09/2026).
 *
 * Les deux scénarios plus bas qui posent une écriture REFUSÉE (« annuler »,
 * « clôturer l'intervention d'un collègue ») visaient, avant ce lot,
 * `client.intervention.findFirstOrThrow` — UNE INTERVENTION ARBITRAIRE de
 * toute la société. Sous `fullyParallel`, cette ligne pouvait être une
 * fixture qu'un AUTRE fichier fait avancer concurremment (`rapport-terrain.
 * spec.ts` la fait passer à `terminee`, `glisser-deposer.spec.ts` la
 * déplace…) : la comparaison AVANT/APRÈS de ce fichier-ci mesurait alors le
 * geste d'un autre fichier, pas le refus qu'il éprouve lui-même — mesuré
 * flaky (`porte-capacites.spec.ts`, constat du 24/09/2026, 20h15).
 *
 * Chacun des deux scénarios pose donc SA PROPRE ligne, à un identifiant
 * fixe, que rien d'autre ne lit ni ne modifie.
 *
 * ## SÉRIE, ET IDEMPOTENT (STABILITE-2, 25/09/2026)
 *
 * Mesuré le 25/09/2026, deux nuits de suite : sous `fullyParallel` sans
 * `test.describe.configure`, `beforeAll` tourne une fois PAR WORKER qui
 * reçoit un test de ce fichier — deux workers exécutaient concurremment
 * `deleteMany` puis `create` sur le MÊME identifiant fixe, et le second
 * `create` heurtait la ligne que l'autre venait de poser
 * (`Unique constraint failed on the fields: (id)`). La série (le même
 * modèle qu'`avertissements-1.spec.ts`, `contacts.spec.ts`,
 * `fiche-360-1.spec.ts`…) ramène ce fichier à un seul worker ; l'écriture
 * elle-même devient un `INSERT … ON CONFLICT ("id") DO UPDATE`, pour
 * qu'un rejeu du même identifiant ne casse jamais rien, série ou pas.
 */
test.describe.configure({ mode: "serial" });

const INTERVENTION_A_ANNULER = "01a0f400-0000-7000-8000-000000000001";
const INTERVENTION_DU_COLLEGUE = "01a0f400-0000-7000-8000-000000000002";

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    const ducos = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "DUCOS" },
      select: { id: true },
    });
    const site = await client.site.findFirstOrThrow({
      where: { societe_id: reperes.societeId, agence_id: ducos.id },
      select: { id: true, client_id: true },
      orderBy: { libelle: "asc" },
    });
    for (const [id, technicienId] of [
      [INTERVENTION_A_ANNULER, reperes.technicienDucos],
      // LE COLLÈGUE — un technicien RÉEL, mais jamais celui de l'épreuve
      // (`COMPTE_TECHNICIEN_EPREUVE` = `technicienDucos`).
      [INTERVENTION_DU_COLLEGUE, reperes.technicienKone],
    ] as const) {
      await client.$executeRawUnsafe(
        `DELETE FROM "segment_travail" WHERE "intervention_id" = $1::uuid`,
        id,
      );
      // `intervention_planifiee_a_sa_duree` (PARCOURS-1, 23/09/2026) :
      // `planifiee` exige une durée prévue.
      await client.$executeRawUnsafe(
        `INSERT INTO "intervention"
           ("id", "societe_id", "agence_id", "client_id", "site_id",
            "technicien_id", "type", "priorite", "statut", "date_planifiee",
            "duree_estimee_min", "mode_valorisation", "devise_code", "modifie_le")
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6::uuid,
                 'curatif', 'p3', 'planifiee'::"StatutIntervention", now()::date,
                 60, 'temps_passe', 'XPF', now())
         ON CONFLICT ("id") DO UPDATE SET
           "societe_id" = EXCLUDED."societe_id",
           "agence_id" = EXCLUDED."agence_id",
           "client_id" = EXCLUDED."client_id",
           "site_id" = EXCLUDED."site_id",
           "technicien_id" = EXCLUDED."technicien_id",
           "type" = EXCLUDED."type",
           "priorite" = EXCLUDED."priorite",
           "statut" = EXCLUDED."statut",
           "date_planifiee" = EXCLUDED."date_planifiee",
           "duree_estimee_min" = EXCLUDED."duree_estimee_min",
           "mode_valorisation" = EXCLUDED."mode_valorisation",
           "devise_code" = EXCLUDED."devise_code",
           "modifie_le" = now()`,
        id,
        reperes.societeId,
        ducos.id,
        site.client_id,
        site.id,
        technicienId,
      );
    }
  } finally {
    await client.$disconnect();
  }
});

/**
 * D-12 — LA PORTE, ÉPROUVÉE PAR LE CAS QUI A MOTIVÉ LE TICKET.
 *
 * ## Ce que ce fichier mesure, et que rien d'autre ne mesure
 *
 * `tests/unit/auth/porte.test.ts` éprouve `exigerCapacite` en isolation, avec
 * une session fabriquée. Il ne peut pas prouver qu'un `technicien` RÉEL,
 * connecté par l'écran, qui forge un `POST` vers une route de la matrice, est
 * bien refusé PAR LA ROUTE — c'est-à-dire par la chaîne entière : session,
 * porte, dépôt.
 *
 * ## Le cas exact du ticket
 *
 * Un `technicien` poste sur `/api/habilitations/attributions/creer` en se
 * désignant LUI-MÊME (`utilisateur_id` = son propre identifiant) pour une
 * habilitation qui existe réellement. Sans D-12, RG-PLA-04 le tiendrait
 * ensuite pour qualifié — le verrou d'affectation resterait techniquement
 * clos et deviendrait socialement vide.
 *
 * **La vérification porte sur la BASE, pas seulement sur la réponse** : un
 * refus qui écrirait quand même serait pire qu'un refus absent.
 */
test("un technicien ne peut pas se désigner lui-même une habilitation", async ({
  page,
}) => {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    const technicien = await client.utilisateur.findFirstOrThrow({
      where: { email: COMPTE_TECHNICIEN_EPREUVE },
      select: { id: true },
    });
    const societe = await client.societe.findFirstOrThrow({
      where: { code: "CODIMA-NC" },
      select: { id: true },
    });
    // Une habilitation RÉELLE de la société — l'amorçage de L1-04 en pose
    // plusieurs à l'ouverture de chaque société, jamais de la démonstration.
    const habilitation = await client.habilitation.findFirstOrThrow({
      where: { societe_id: societe.id },
      select: { id: true },
    });

    const compte = () =>
      client.technicienHabilitation.count({
        where: {
          utilisateur_id: technicien.id,
          habilitation_id: habilitation.id,
        },
      });
    const avant = await compte();

    await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);

    const reponse = await page.request.post(
      "/api/habilitations/attributions/creer",
      {
        form: {
          utilisateur_id: technicien.id,
          habilitation_id: habilitation.id,
          date_obtention: "2024-01-15",
        },
        maxRedirects: 0,
      },
    );

    // Le même refus qu'une session absente — la porte ne dit pas pourquoi.
    expect(reponse.status()).toBe(303);
    expect(reponse.headers()["location"] ?? "").toContain("auth.refus");

    // ET RIEN N'A ÉTÉ ÉCRIT — la vérification qui compte le plus.
    expect(await compte()).toBe(avant);
  } finally {
    await client.$disconnect();
  }
});

/**
 * D130 — LA PORTE POSÉE SUR « CRÉER UN CLIENT », ÉPROUVÉE PAR LE MÊME MOYEN.
 *
 * Le §5.2 ne portait aucune ligne pour ce geste ; D130 le tranche : ADV,
 * direction, administrateur de société — **pas** le technicien, malgré son
 * accès complet à la machine et au planning (la fiche client est du
 * référentiel commercial, pas de l'exploitation).
 *
 * **La vérification porte sur la BASE, pas seulement sur la réponse** : même
 * raisonnement que le cas ci-dessus.
 */
test("un technicien ne peut pas créer de fiche client", async ({ page }) => {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    const societe = await client.societe.findFirstOrThrow({
      where: { code: "CODIMA-NC" },
      select: { id: true },
    });

    // Compte la fiche forgée par SON nom, pas toutes les fiches de la
    // société — une scène e2e parallèle qui crée des clients (fullyParallel)
    // ferait sinon rougir ce test sans rapport avec ce qu'il éprouve.
    const compte = () =>
      client.client.count({
        where: {
          societe_id: societe.id,
          raison_sociale: "Fiche forgée par un technicien",
        },
      });
    const avant = await compte();

    await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);

    const reponse = await page.request.post("/api/clients/creer", {
      form: { raison_sociale: "Fiche forgée par un technicien" },
      maxRedirects: 0,
    });

    // Le même refus qu'une session absente — la porte ne dit pas pourquoi.
    expect(reponse.status()).toBe(303);
    expect(reponse.headers()["location"] ?? "").toContain("auth.refus");

    // ET AUCUNE FICHE CLIENT N'A ÉTÉ CRÉÉE.
    expect(await compte()).toBe(avant);
  } finally {
    await client.$disconnect();
  }
});

/**
 * D131 — LA PORTE POSÉE SUR « ANNULER », ÉPROUVÉE PAR LE MÊME MOYEN.
 *
 * Mesuré le 23/09/2026 sur `main` (`0ae8011`) : la route appelait
 * `contexteCourant()`, qui ne lit aucun rôle — n'importe quel compte pouvait
 * annuler n'importe quelle intervention, technicien compris. `annuler_intervention`
 * ne porte AUCUN `○` (D131) : une annulation est une décision commerciale du
 * bureau, jamais un geste terrain, quelle que soit l'intervention visée — la
 * chaîne entière (session, porte, dépôt) refuse donc avant même de juger un
 * périmètre.
 */
test("un technicien ne peut pas annuler une intervention", async ({ page }) => {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);

    const reponse = await page.request.post(
      `/api/interventions/${INTERVENTION_A_ANNULER}/annuler`,
      {
        form: { motif: "Annulation forgée par un technicien" },
        maxRedirects: 0,
      },
    );

    // Le même refus qu'une session absente — la porte ne dit pas pourquoi.
    expect(reponse.status()).toBe(303);
    expect(reponse.headers()["location"] ?? "").toContain("auth.refus");

    // ET LE STATUT N'A PAS CHANGÉ.
    const apres = await client.intervention.findUniqueOrThrow({
      where: { id: INTERVENTION_A_ANNULER },
      select: { statut: true },
    });
    expect(apres.statut).toBe("planifiee");
  } finally {
    await client.$disconnect();
  }
});

/**
 * D131 — LE ○ DE « CLÔTURER » EST SCOPÉ : le technicien réel, connecté par
 * l'écran, est refusé sur l'intervention D'UN COLLÈGUE — jamais seulement
 * mesuré sur une session fabriquée (`tests/unit/auth/porte.test.ts`) ni sur le
 * dépôt appelé directement (`tests/isolation/droits-cycle-de-vie.test.ts`),
 * mais par la CHAÎNE ENTIÈRE : session, porte, dépôt.
 */
test("un technicien ne peut pas clôturer l'intervention d'un collègue", async ({
  page,
}) => {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    // `INTERVENTION_DU_COLLEGUE` — affectée à `technicienKone`, jamais au
    // technicien de l'épreuve (`technicienDucos`) : hors de SON périmètre.
    await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);

    const reponse = await page.request.post(
      `/api/interventions/${INTERVENTION_DU_COLLEGUE}/cloturer`,
      { form: { temps_valide_min: "60" }, maxRedirects: 0 },
    );

    // Le refus est celui d'une intervention hors périmètre — le MÊME que
    // « introuvable » (D35, D50) : distinguer les deux dirait à un technicien
    // qu'une intervention d'un collègue existe.
    expect(reponse.status()).toBe(303);
    expect(reponse.headers()["location"] ?? "").toContain(
      "intervention.refus.inconnue",
    );

    const apres = await client.intervention.findUniqueOrThrow({
      where: { id: INTERVENTION_DU_COLLEGUE },
      select: { statut: true },
    });
    expect(apres.statut).toBe("planifiee");
  } finally {
    await client.$disconnect();
  }
});
