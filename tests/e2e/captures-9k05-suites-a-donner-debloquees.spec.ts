import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Locator, type Page } from "@playwright/test";

import { type ContexteSession } from "@/lib/auth/contexte";
import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";
import { qualifierSuite } from "@/lib/suite-a-donner/depot";

import { urlAdministration, urlApplicative } from "./setup/base";
import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE 9K05-SUITES-A-DONNER-DEBLOQUEES — même recette que
 * `captures-9j18-suite-a-donner.spec.ts` (mémoire « captures-avant-apres-
 * e2e ») : sa propre scène jetable, posée dans `beforeAll`, effacée dans
 * `afterAll`, jamais celle de `tests/e2e/setup/scene.ts` — mémoire
 * « e2e-semis-partage-parallele ».
 *
 * **`qualifierSuite` est appelée directement**, comme bibliothèque — amener
 * trois interventions clôturées à `qualifiee` est un PRÉALABLE, déjà couvert
 * par 9J18 ; ce que CE ticket ajoute (« Devis envoyé », l'accord, « Pièce
 * reçue ») est joué ICI PAR L'ÉCRAN, clic par clic — c'est précisément ce que
 * ce lot débloque.
 *
 * Trois scénarios, sur trois suites distinctes (A, B, C), pour ne jamais
 * faire dépendre une assertion de l'état laissé par une autre :
 *   A — accord SANS pièce : saute directement à `a_replanifier`.
 *   B — accord AVEC pièce : passe par `accord_recu`, puis « Pièce reçue ».
 *   C — sans suite, avec son motif.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9K05 ?? "";

const MOTIF_A = "9K05 — compresseur A, à revoir (scénario sans pièce).";
const MOTIF_B = "9K05 — compresseur B, à revoir (scénario avec pièce).";
const MOTIF_C = "9K05 — compresseur C, à revoir (scénario sans suite).";
const MOTIF_SANS_SUITE =
  "client a vendu le site, plus d'intervention à prévoir";

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
  phase: "avant" | "apres",
): Promise<void> {
  if (DOSSIER === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  await page.setViewportSize({ width: largeur, height: 1200 });
  await page.screenshot({
    path: join(DOSSIER, `${nom}-${phase}-${largeur}.png`),
    fullPage: true,
  });
}

/** La ligne du registre portant ce motif — UNIQUE par construction (voir MOTIF_*). */
function ligneDuMotif(page: Page, motif: string): Locator {
  return page.locator("tr").filter({ hasText: motif });
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
    const societeId = utilisateurSociete.societe_id;
    const agence = await admin.agence.findFirstOrThrow({
      where: { societe_id: societeId, code: "DUCOS" },
      select: { id: true },
    });
    const site = await admin.site.findFirstOrThrow({
      where: { societe_id: societeId, agence_id: agence.id },
      select: { id: true, client_id: true },
      orderBy: { libelle: "asc" },
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
      suiteBId = await qualifierSuite(contexte, interventionBId, applicatif);
      suiteCId = await qualifierSuite(contexte, interventionCId, applicatif);
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
        // LA NOTIFICATION S'EFFACE AVANT LA SUITE (9J19-SUITE-A-DONNER-
        // NOTIFICATIONS) : le scénario B pose une notification « piece_recue »
        // référençant cette ligne (clé étrangère RESTRICT).
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

test("AVANT — les trois suites qualifiées proposent « Devis envoyé »", async ({
  page,
}) => {
  await ouvrirUneSession(page);
  await page.goto("/interventions/suites-a-donner");
  for (const motif of [MOTIF_A, MOTIF_B, MOTIF_C]) {
    await expect(
      ligneDuMotif(page, motif).getByRole("button", {
        name: fr["suites_a_donner.action.devis_envoye"],
      }),
    ).toBeVisible();
  }
  for (const largeur of [375, 1280] as const) {
    await capturer(page, "registre", largeur, "avant");
  }
});

test("« Devis envoyé » fait passer les trois suites à « Accord attendu »", async ({
  page,
}) => {
  await ouvrirUneSession(page);
  for (const motif of [MOTIF_A, MOTIF_B, MOTIF_C]) {
    await page.goto("/interventions/suites-a-donner");
    await ligneDuMotif(page, motif)
      .getByRole("button", { name: fr["suites_a_donner.action.devis_envoye"] })
      .click();
    await expect(page.getByRole("status")).toContainText(
      fr["suites_a_donner.devis_envoye"],
    );
    await expect(
      ligneDuMotif(page, motif).getByText(
        fr["suites_a_donner.statut.accord_attendu"],
      ),
    ).toBeVisible();
  }
});

test("scénario A — accord SANS pièce saute directement à « À déplacer »", async ({
  page,
}) => {
  await ouvrirUneSession(page);
  await page.goto(`/interventions/suites-a-donner/${suiteAId}/accord`);
  await expect(page).toHaveURL(/\/accord$/);
  await expect(
    page.getByRole("heading", {
      name: fr["suites_a_donner.accord.recu_titre"],
    }),
  ).toBeVisible();
  for (const largeur of [375, 1280] as const) {
    await capturer(page, "accord-formulaire", largeur, "avant");
  }

  await page
    .getByRole("button", { name: fr["suites_a_donner.accord.recu_confirmer"] })
    .click();
  await expect(page).toHaveURL(/\/interventions\/suites-a-donner\?motif=/);
  await expect(page.getByRole("status")).toContainText(
    fr["suites_a_donner.accord_recu"],
  );

  const ligne = ligneDuMotif(page, MOTIF_A);
  await expect(
    ligne.getByText(fr["suites_a_donner.statut.a_replanifier"]),
  ).toBeVisible();
  await expect(
    ligne.getByRole("link", { name: fr["suites_a_donner.action.replanifier"] }),
  ).toBeVisible();
});

test("scénario B — accord AVEC pièce reste « Accord reçu » jusqu'à « Pièce reçue »", async ({
  page,
}) => {
  await ouvrirUneSession(page);
  await page.goto(`/interventions/suites-a-donner/${suiteBId}/accord`);
  await page
    .getByLabel(fr["suites_a_donner.accord.piece_ref"])
    .fill("COURROIE-9K05");
  await page
    .getByLabel(fr["suites_a_donner.accord.piece_date"])
    .fill("2026-12-15");
  await page
    .getByRole("button", { name: fr["suites_a_donner.accord.recu_confirmer"] })
    .click();
  await expect(page).toHaveURL(/\/interventions\/suites-a-donner\?motif=/);

  let ligne = ligneDuMotif(page, MOTIF_B);
  await expect(
    ligne.getByText(fr["suites_a_donner.statut.accord_recu"]),
  ).toBeVisible();
  const boutonPieceRecue = ligne.getByRole("button", {
    name: fr["suites_a_donner.action.piece_recue"],
  });
  await expect(boutonPieceRecue).toBeVisible();

  await boutonPieceRecue.click();
  await expect(page.getByRole("status")).toContainText(
    fr["suites_a_donner.piece_recue"],
  );
  ligne = ligneDuMotif(page, MOTIF_B);
  await expect(
    ligne.getByText(fr["suites_a_donner.statut.a_replanifier"]),
  ).toBeVisible();
  await expect(
    ligne.getByRole("link", { name: fr["suites_a_donner.action.replanifier"] }),
  ).toBeVisible();
});

test("scénario C — sans suite exige et affiche le motif", async ({ page }) => {
  await ouvrirUneSession(page);
  await page.goto(`/interventions/suites-a-donner/${suiteCId}/accord`);
  await page
    .getByLabel(fr["suites_a_donner.accord.motif"])
    .fill(MOTIF_SANS_SUITE);
  await page
    .getByRole("button", {
      name: fr["suites_a_donner.accord.sans_suite_confirmer"],
    })
    .click();
  await expect(page).toHaveURL(/\/interventions\/suites-a-donner\?motif=/);
  await expect(page.getByRole("status")).toContainText(
    fr["suites_a_donner.sans_suite"],
  );

  const ligne = page.locator("tr").filter({ hasText: MOTIF_SANS_SUITE });
  await expect(
    ligne.getByText(fr["suites_a_donner.statut.sans_suite"]),
  ).toBeVisible();
  await expect(
    ligne.getByRole("button", {
      name: fr["suites_a_donner.action.devis_envoye"],
    }),
  ).toHaveCount(0);
  await expect(
    ligne.getByRole("link", { name: fr["suites_a_donner.action.replanifier"] }),
  ).toHaveCount(0);
});

test("APRÈS — le registre montre les trois issues", async ({ page }) => {
  await ouvrirUneSession(page);
  await page.goto("/interventions/suites-a-donner");
  await expect(
    ligneDuMotif(page, MOTIF_A).getByText(
      fr["suites_a_donner.statut.a_replanifier"],
    ),
  ).toBeVisible();
  await expect(
    ligneDuMotif(page, MOTIF_B).getByText(
      fr["suites_a_donner.statut.a_replanifier"],
    ),
  ).toBeVisible();
  await expect(
    page
      .locator("tr")
      .filter({ hasText: MOTIF_SANS_SUITE })
      .getByText(fr["suites_a_donner.statut.sans_suite"]),
  ).toBeVisible();
  for (const largeur of [375, 1280] as const) {
    await capturer(page, "registre", largeur, "apres");
  }
});
