import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { urlAdministration } from "./setup/base";
import { COMPTE_TECHNICIEN_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

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
    const societe = await client.societe.findFirstOrThrow({
      where: { code: "CODIMA-NC" },
      select: { id: true },
    });
    const intervention = await client.intervention.findFirstOrThrow({
      where: { societe_id: societe.id, statut: { not: "annulee" } },
      select: { id: true, statut: true },
    });

    await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);

    const reponse = await page.request.post(
      `/api/interventions/${intervention.id}/annuler`,
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
      where: { id: intervention.id },
      select: { statut: true },
    });
    expect(apres.statut).toBe(intervention.statut);
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
    const technicien = await client.utilisateur.findFirstOrThrow({
      where: { email: COMPTE_TECHNICIEN_EPREUVE },
      select: { id: true },
    });
    const societe = await client.societe.findFirstOrThrow({
      where: { code: "CODIMA-NC" },
      select: { id: true },
    });
    // Une intervention affectée à QUELQU'UN D'AUTRE que le technicien de
    // l'épreuve — ou à personne : les deux sont hors de SON périmètre.
    const intervention = await client.intervention.findFirstOrThrow({
      where: {
        societe_id: societe.id,
        statut: { notIn: ["annulee", "cloturee"] },
        technicien_id: { not: technicien.id },
      },
      select: { id: true, statut: true },
    });

    await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);

    const reponse = await page.request.post(
      `/api/interventions/${intervention.id}/cloturer`,
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
      where: { id: intervention.id },
      select: { statut: true },
    });
    expect(apres.statut).toBe(intervention.statut);
  } finally {
    await client.$disconnect();
  }
});
