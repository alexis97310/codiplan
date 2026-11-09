import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { type ContexteSession } from "@/lib/auth/contexte";
import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";
import {
  enregistrerAccord,
  marquerDevisEnvoye,
  marquerPieceRecue,
  qualifierSuite,
} from "@/lib/suite-a-donner/depot";

import { urlAdministration, urlApplicative } from "./setup/base";
import { ouvrirUneSession } from "./setup/session";

/**
 * 9K07-SUITES-A-DONNER-RELANCES — même recette que
 * `captures-9k05-suites-a-donner-debloquees.spec.ts` (mémoire « captures-
 * avant-apres-e2e ») : sa propre scène jetable, posée dans `beforeAll`,
 * effacée dans `afterAll`, jamais celle de `tests/e2e/setup/scene.ts`.
 *
 * **Trois dossiers, trois chemins vers les trois événements** :
 *   A — `qualifiee`, `qualifiee_le` reculée au-delà du délai : la VISITE du
 *       registre pose « devis_en_retard » (FLX-2, ce ticket).
 *   B — `accord_attendu`, `modifie_le` reculée au-delà du délai : la MÊME
 *       visite pose « accord_attendu_en_retard » (FLX-3, ce ticket).
 *   C — mené jusqu'à `marquerPieceRecue`, qui pose « piece_recue » dans la
 *       même transaction (FLX-8, 9K05) — aucune relance, un témoin du
 *       troisième libellé.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9K07 ?? "";

const MOTIF_A = "9K07 — groupe électrogène A (devis sans réponse).";
const MOTIF_B = "9K07 — groupe électrogène B (accord en attente).";
const MOTIF_C = "9K07 — groupe électrogène C (pièce reçue).";

let societeId = "";
let delaiAvant: number | null = null;
let interventionAId = "";
let interventionBId = "";
let interventionCId = "";
let suiteAId = "";
let suiteBId = "";
let suiteCId = "";

async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  if (DOSSIER === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  await page.setViewportSize({ width: largeur, height: 1200 });
  await page.screenshot({
    path: join(DOSSIER, `${nom}-${largeur}.png`),
    fullPage: true,
  });
}

async function preparerLaScene(): Promise<void> {
  const admin = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    const utilisateur = await admin.utilisateur.findFirstOrThrow({
      where: { email: "adv@codima.test" },
      select: { id: true },
    });
    const utilisateurSociete = await admin.utilisateurSociete.findFirstOrThrow({
      where: { utilisateur_id: utilisateur.id },
      select: { societe_id: true },
    });
    societeId = utilisateurSociete.societe_id;
    const agence = await admin.agence.findFirstOrThrow({
      where: { societe_id: societeId, code: "DUCOS" },
      select: { id: true },
    });
    const site = await admin.site.findFirstOrThrow({
      where: { societe_id: societeId, agence_id: agence.id },
      select: { id: true, client_id: true },
      orderBy: { libelle: "asc" },
    });

    const societeAvant = await admin.societe.findUniqueOrThrow({
      where: { id: societeId },
      select: { delai_relance_suite_jours: true },
    });
    delaiAvant = societeAvant.delai_relance_suite_jours;
    await admin.societe.update({
      where: { id: societeId },
      data: { delai_relance_suite_jours: 5 },
    });

    async function creerInterventionCloturee(motif: string): Promise<string> {
      const id = uuidv7();
      await admin.$executeRawUnsafe(
        `INSERT INTO "intervention"
           ("id", "societe_id", "client_id", "site_id", "agence_id", "type", "statut", "suite_a_donner", "modifie_le", "cloturee_le")
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif', 'cloturee', $6, now(), now())`,
        id,
        societeId,
        site.client_id,
        site.id,
        agence.id,
        motif,
      );
      return id;
    }

    interventionAId = await creerInterventionCloturee(MOTIF_A);
    interventionBId = await creerInterventionCloturee(MOTIF_B);
    interventionCId = await creerInterventionCloturee(MOTIF_C);

    const applicatif = new PrismaClient({
      datasources: { db: { url: urlApplicative() } },
    });
    const contexte: ContexteSession = {
      utilisateurId: utilisateur.id,
      societeId,
      role: Role.adv,
      secondFacteurValide: true,
      adresseIp: null,
      clientId: null,
    };
    try {
      suiteAId = await qualifierSuite(contexte, interventionAId, applicatif);
      await admin.$executeRawUnsafe(
        `UPDATE "suite_a_donner" SET "qualifiee_le" = now() - interval '10 days' WHERE "id" = $1::uuid`,
        suiteAId,
      );

      suiteBId = await qualifierSuite(contexte, interventionBId, applicatif);
      await marquerDevisEnvoye(contexte, suiteBId, applicatif);
      await admin.$executeRawUnsafe(
        `UPDATE "suite_a_donner" SET "modifie_le" = now() - interval '10 days' WHERE "id" = $1::uuid`,
        suiteBId,
      );

      suiteCId = await qualifierSuite(contexte, interventionCId, applicatif);
      await marquerDevisEnvoye(contexte, suiteCId, applicatif);
      await enregistrerAccord(
        contexte,
        suiteCId,
        {
          reponse: "accord_recu",
          pieceAttendueRef: "GROUPE-9K07",
          dateDispoPrevue: new Date("2026-12-20"),
        },
        applicatif,
      );
      await marquerPieceRecue(contexte, suiteCId, applicatif);
    } finally {
      await applicatif.$disconnect();
    }
  } finally {
    await admin.$disconnect();
  }
}

async function effacerLaScene(): Promise<void> {
  const admin = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    for (const id of [suiteAId, suiteBId, suiteCId]) {
      if (id !== "") {
        await admin.$executeRawUnsafe(
          `DELETE FROM "notification" WHERE "suite_a_donner_id" = $1::uuid`,
          id,
        );
        await admin.$executeRawUnsafe(
          `DELETE FROM "suite_a_donner" WHERE "id" = $1::uuid`,
          id,
        );
      }
    }
    for (const id of [interventionAId, interventionBId, interventionCId]) {
      if (id !== "") {
        await admin.$executeRawUnsafe(
          `DELETE FROM "intervention" WHERE "id" = $1::uuid`,
          id,
        );
      }
    }
    if (societeId !== "") {
      await admin.societe.update({
        where: { id: societeId },
        data: { delai_relance_suite_jours: delaiAvant },
      });
    }
  } finally {
    await admin.$disconnect();
  }
}

test.beforeAll(async () => {
  await preparerLaScene();
});

test.afterAll(async () => {
  await effacerLaScene();
});

test("ouvrir le registre pose les relances « devis » et « accord » en retard (FLX-2/FLX-3)", async ({
  page,
}) => {
  await ouvrirUneSession(page);
  // LA VISITE DU REGISTRE, ET RIEN D'AUTRE, DOIT DÉCLENCHER LA RELANCE —
  // c'est tout ce que ce test mesure avant d'aller lire /notifications.
  await page.goto("/interventions/suites-a-donner");
  await expect(
    page.getByRole("heading", { name: fr["suites_a_donner.titre"] }),
  ).toBeVisible();
});

for (const largeur of [1280, 375] as const) {
  test(`« Devis sans réponse », « Accord en attente de réponse » et « Pièce reçue » sur /notifications, à ${largeur}px`, async ({
    page,
  }) => {
    await ouvrirUneSession(page);
    await page.goto("/notifications");
    await expect(
      page.getByText(fr["notifications.evenement.devis_en_retard"]),
    ).toBeVisible();
    await expect(
      page.getByText(fr["notifications.evenement.accord_attendu_en_retard"]),
    ).toBeVisible();
    await expect(
      page.getByText(fr["notifications.evenement.piece_recue"]),
    ).toBeVisible();
    await capturer(page, "notifications", largeur);
  });
}

test("ouvrir le registre une seconde fois ne double aucune notification (idempotence, FLX-2/FLX-3)", async ({
  page,
}) => {
  await ouvrirUneSession(page);
  await page.goto("/interventions/suites-a-donner");
  await page.goto("/interventions/suites-a-donner");

  const admin = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    const notifsA = await admin.notification.findMany({
      where: { suite_a_donner_id: suiteAId, evenement: "devis_en_retard" },
    });
    expect(notifsA).toHaveLength(1);
    const notifsB = await admin.notification.findMany({
      where: {
        suite_a_donner_id: suiteBId,
        evenement: "accord_attendu_en_retard",
      },
    });
    expect(notifsB).toHaveLength(1);
  } finally {
    await admin.$disconnect();
  }
});
