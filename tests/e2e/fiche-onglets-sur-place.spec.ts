import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { COMPTE_RS_EPREUVE, MOT_DE_PASSE_EPREUVE } from "./setup/scene";
import { ouvrirUneSession } from "./setup/session";

/**
 * 9EE-TP-UX4-1-FICHE-INTERVENTION-2 — LES ONGLETS, LA CARTE « SUR PLACE » ET
 * « CRÉÉE DEPUIS » (addendum recalage 2 du pilote, R1-R10).
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `9EE2-`
 *
 * Un client, un site complet (adresse, horaires lun.–ven., consignes, une
 * exigence bloquante), un contact donneur d'ordre (mobile ET téléphone, pour
 * éprouver les deux liens `tel:`), une demande d'origine et UNE intervention
 * `a_planifier` qui les rassemble — créés en `beforeAll`, supprimés en
 * `afterAll`. Jamais `tests/e2e/setup/scene.ts` : aucune ligne du semis ne
 * porte cette combinaison.
 *
 * ## CE QUE CE FICHIER N'ÉPROUVE PAS
 *
 * Ni le masquage des montants par rôle (déjà éprouvé,
 * `montants-par-role.spec.ts`), ni le régime des actions de l'aside (déjà
 * éprouvé, `fiche-actions.spec.ts`, `blocage-agenda-visible.spec.ts`,
 * `intervention-technicien-select.spec.ts` — inchangé par ce lot, R1).
 */
test.describe.configure({ mode: "serial" });

const CLIENT_9EE2 = "00000000-0000-7000-8000-00000000ee40";
const SITE_9EE2 = "00000000-0000-7000-8000-00000000ee41";
const CONTACT_9EE2 = "00000000-0000-7000-8000-00000000ee42";
const HABILITATION_9EE2 = "00000000-0000-7000-8000-00000000ee43";
const EXIGENCE_9EE2 = "00000000-0000-7000-8000-00000000ee44";
const DEMANDE_9EE2 = "00000000-0000-7000-8000-00000000ee45";
const INTERVENTION_9EE2 = "00000000-0000-7000-8000-00000000ee46";

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  const client = admin();
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "DUCOS" },
      select: { id: true },
    });

    await client.client.create({
      data: {
        id: CLIENT_9EE2,
        societe_id: reperes.societeId,
        raison_sociale: "9EE2 — client de l'épreuve",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_9EE2,
        societe_id: reperes.societeId,
        client_id: CLIENT_9EE2,
        agence_id: agence.id,
        libelle: "9EE2 — site de l'épreuve",
        adresse: { rue: fr["9ee2.e2e.rue"] },
        commune: "Nouméa",
        consignes_acces: fr["9ee2.e2e.consignes"],
        horaires: [1, 2, 3, 4, 5].map((jour_semaine) => ({
          jour_semaine,
          debut_minutes: 360,
          fin_minutes: 840,
        })),
      },
    });
    await client.contact.create({
      data: {
        id: CONTACT_9EE2,
        societe_id: reperes.societeId,
        client_id: CLIENT_9EE2,
        site_id: SITE_9EE2,
        nom: fr["9ee2.e2e.contact_nom"],
        fonction: "Responsable technique",
        telephone: "687000001",
        mobile: "687000002",
        email: "9ee2-donneur-ordre@exemple.test",
        roles: ["donneur_ordre"],
        canaux: ["email"],
        actif: true,
      },
    });
    await client.habilitation.create({
      data: {
        id: HABILITATION_9EE2,
        societe_id: reperes.societeId,
        code: fr["9ee2.e2e.habilitation_code"],
        libelle: "9EE2 — habilitation de l'épreuve",
        actif: true,
      },
    });
    await client.siteHabilitationRequise.create({
      data: {
        id: EXIGENCE_9EE2,
        societe_id: reperes.societeId,
        site_id: SITE_9EE2,
        habilitation_id: HABILITATION_9EE2,
        bloquant: true,
      },
    });
    await client.$executeRawUnsafe(
      `INSERT INTO "demande"
         ("id", "societe_id", "source", "client_id", "site_id", "agence_id",
          "description", "depose_le", "compteur_accuse_le", "modifie_le")
       VALUES ($1::uuid, $2::uuid, 'appel', $3::uuid, $4::uuid, $5::uuid,
               '9EE2 — demande de l''épreuve', now(), now(), now())`,
      DEMANDE_9EE2,
      reperes.societeId,
      CLIENT_9EE2,
      SITE_9EE2,
      agence.id,
    );
    await client.$executeRawUnsafe(
      `INSERT INTO "intervention"
         ("id", "societe_id", "client_id", "site_id", "agence_id", "contact_id",
          "demande_id", "type", "priorite", "statut", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6::uuid,
               $7::uuid, 'curatif', 'p3', 'a_planifier', now())`,
      INTERVENTION_9EE2,
      reperes.societeId,
      CLIENT_9EE2,
      SITE_9EE2,
      agence.id,
      CONTACT_9EE2,
      DEMANDE_9EE2,
    );
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "client_id" = $1::uuid`,
      CLIENT_9EE2,
    );
    await client.$executeRawUnsafe(
      `DELETE FROM "demande" WHERE "id" = $1::uuid`,
      DEMANDE_9EE2,
    );
    await client.siteHabilitationRequise.deleteMany({
      where: { id: EXIGENCE_9EE2 },
    });
    await client.habilitation.deleteMany({ where: { id: HABILITATION_9EE2 } });
    await client.contact.deleteMany({ where: { id: CONTACT_9EE2 } });
    await client.site.deleteMany({ where: { client_id: CLIENT_9EE2 } });
    await client.client.deleteMany({ where: { id: CLIENT_9EE2 } });
  } finally {
    await client.$disconnect();
  }
});

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/9EE-TP-UX4-1-FICHE-INTERVENTION-2/captures",
);

async function capturer(page: Page, nom: string): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  for (const largeur of [1280, 375]) {
    await page.setViewportSize({ width: largeur, height: 900 });
    await page.screenshot({
      path: join(DOSSIER_CAPTURES, `${nom}-${largeur}.png`),
      fullPage: true,
    });
  }
}

test.describe("sous le rôle ADV", () => {
  test.beforeEach(async ({ page }) => {
    await ouvrirUneSession(page);
  });

  test("les cinq onglets naviguent, et chacun marque aria-current", async ({
    page,
  }) => {
    await page.goto(`/interventions/${INTERVENTION_9EE2}`);
    const nav = page.locator('nav[data-nav="onglets-fiche"]');
    await expect(nav).toBeVisible();

    const lienResume = nav.getByRole("link", {
      name: fr["intervention.onglet.resume"],
    });
    await expect(lienResume).toHaveAttribute("aria-current", "page");

    const lienTemps = nav.getByRole("link", {
      name: fr["intervention.onglet.temps"],
    });
    await lienTemps.click();
    await expect(page).toHaveURL(/onglet=temps/);
    await expect(lienTemps).toHaveAttribute("aria-current", "page");
    await expect(
      page.getByRole("heading", {
        name: fr["intervention.realisation.segments_titre"],
        level: 3,
      }),
    ).toBeVisible();

    const lienRapport = nav.getByRole("link", {
      name: fr["intervention.onglet.rapport"],
    });
    await lienRapport.click();
    await expect(page).toHaveURL(/onglet=rapport/);
    await expect(lienRapport).toHaveAttribute("aria-current", "page");
    await expect(
      page.getByRole("heading", {
        name: fr["intervention.realisation.prestations_titre"],
        level: 3,
      }),
    ).toBeVisible();

    const lienValorisation = nav.getByRole("link", {
      name: fr["intervention.onglet.valorisation"],
    });
    await lienValorisation.click();
    await expect(page).toHaveURL(/onglet=valorisation/);
    await expect(lienValorisation).toHaveAttribute("aria-current", "page");
    await expect(
      page.getByText(fr["intervention.mode_valorisation"]),
    ).toBeVisible();
    await expect(
      page.getByText(fr["intervention.forfait_deplacement"]),
    ).toBeVisible();

    const lienHistorique = nav.getByRole("link", {
      name: fr["intervention.onglet.historique"],
    });
    await lienHistorique.click();
    await expect(page).toHaveURL(/onglet=historique/);
    await expect(lienHistorique).toHaveAttribute("aria-current", "page");
    await expect(
      page.getByRole("heading", { name: fr["intervention.chronologie.titre"] }),
    ).toBeVisible();

    await capturer(page, "fiche-onglets");
  });

  test("« Sur place » montre l'adresse, les horaires, un lien tel:, les consignes et l'habilitation bloquante", async ({
    page,
  }) => {
    await page.goto(`/interventions/${INTERVENTION_9EE2}`);
    const surPlace = page
      .locator("section", { hasText: fr["intervention.sur_place.titre"] })
      .first();
    await expect(surPlace).toBeVisible();
    await expect(surPlace).toContainText(fr["9ee2.e2e.rue"]);
    await expect(surPlace).toContainText(
      fr["intervention.resume.jour_abrege.lundi"],
    );
    await expect(surPlace).toContainText(
      fr["intervention.resume.jour_abrege.vendredi"],
    );
    await expect(surPlace).toContainText(fr["9ee2.e2e.contact_nom"]);
    await expect(surPlace.locator('a[href^="tel:"]')).toHaveCount(2);
    await expect(surPlace).toContainText(fr["9ee2.e2e.consignes"]);
    await expect(surPlace).toContainText(fr["9ee2.e2e.habilitation_code"]);
    await expect(surPlace).toContainText(fr["habilitations.site.bloquant"]);

    await capturer(page, "fiche-sur-place");
  });

  test("« Créée depuis » mène à la demande d'origine", async ({ page }) => {
    await page.goto(`/interventions/${INTERVENTION_9EE2}`);
    const lien = page.getByRole("link", {
      name: fr["intervention.cree_depuis.demande"],
    });
    await expect(lien).toHaveAttribute("href", `/demandes/${DEMANDE_9EE2}`);
  });
});

test("rôle responsable SAV : les mêmes onglets et la même carte « Sur place »", async ({
  page,
}) => {
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(COMPTE_RS_EPREUVE);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await expect(page).toHaveURL(/\/planning/);

  await page.goto(`/interventions/${INTERVENTION_9EE2}`);
  await expect(page.locator('nav[data-nav="onglets-fiche"]')).toBeVisible();
  await expect(
    page.locator("section", { hasText: fr["intervention.sur_place.titre"] }),
  ).toContainText(fr["9ee2.e2e.rue"]);

  await page.goto(`/interventions/${INTERVENTION_9EE2}?onglet=valorisation`);
  await capturer(page, "fiche-valorisation-resp-sav");
});
