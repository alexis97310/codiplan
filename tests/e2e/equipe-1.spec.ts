import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { COMPTE_ADMIN_SOCIETE_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * 81-ÉQUIPE-1 — DÉSACTIVER UN TECHNICIEN ANNONCE SES INTERVENTIONS À VENIR
 * (SAV-24).
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `EQU1-`
 *
 * Un technicien créé directement en base (la CRÉATION par l'écran est déjà
 * la propriété de `equipe.spec.ts` — ce fichier n'éprouve que le compte, le
 * lien et l'avertissement), avec deux interventions PLANIFIÉES à venir et une
 * CLÔTURÉE passée : le nombre exact que l'écran doit afficher (2, jamais 3),
 * et que la désactivation doit reporter. Créée et supprimée par ce fichier —
 * aucune ligne du semis ni de `SCENE.*` n'est touchée.
 *
 * ## MODE SÉRIE — la seconde épreuve désactive la première
 *
 * La bascule « actif → inactif » n'est pas réversible dans ce fichier : la
 * seconde épreuve a besoin du technicien encore ACTIF pour la déclencher,
 * donc `mode: "serial"` fixe l'ordre plutôt que de risquer une exécution
 * concurrente sous `fullyParallel`.
 */
test.describe.configure({ mode: "serial" });

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

const NOM = "EQU1-Technicien";
const COURRIEL = "equ1.technicien@codima.test";

function joursDepuisAujourdhui(delta: number): Date {
  const maintenant = new Date();
  const jour = new Date(
    Date.UTC(
      maintenant.getUTCFullYear(),
      maintenant.getUTCMonth(),
      maintenant.getUTCDate(),
    ),
  );
  jour.setUTCDate(jour.getUTCDate() + delta);
  return jour;
}

/** Marge de plusieurs jours de chaque côté — indépendante de tout fuseau. */
const DATE_A_VENIR_1 = joursDepuisAujourdhui(3);
const DATE_A_VENIR_2 = joursDepuisAujourdhui(10);
const DATE_PASSEE = joursDepuisAujourdhui(-10);

/** Le texte exact que l'écran compose pour DEUX interventions à venir. */
const DEUX_A_VENIR = `2 ${fr["equipe.interventions_a_venir.compte"]}`;

let technicienId = "";
const interventionsPosees: string[] = [];

test.beforeAll(async () => {
  const client = admin();
  try {
    const societe = await client.societe.findFirstOrThrow({
      where: { code: "CODIMA-NC" },
      select: { id: true },
    });
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societe.id },
      orderBy: { code: "asc" },
      select: { id: true },
    });
    const site = await client.site.findFirstOrThrow({
      where: { societe_id: societe.id, agence_id: agence.id },
      orderBy: { id: "asc" },
      select: { id: true, client_id: true },
    });

    technicienId = uuidv7();
    await client.utilisateur.create({
      data: { id: technicienId, nom: NOM, email: COURRIEL },
    });
    await client.utilisateurSociete.create({
      data: {
        id: uuidv7(),
        utilisateur_id: technicienId,
        societe_id: societe.id,
        role: Role.technicien,
      },
    });
    await client.technicien.create({
      data: {
        id: uuidv7(),
        societe_id: societe.id,
        utilisateur_id: technicienId,
        agence_id: agence.id,
        actif: true,
      },
    });

    const lignes: {
      readonly statut: "planifiee" | "cloturee";
      readonly date_planifiee: Date;
      readonly duree_estimee_min: number | null;
    }[] = [
      {
        statut: "planifiee",
        date_planifiee: DATE_A_VENIR_1,
        duree_estimee_min: 60,
      },
      {
        statut: "planifiee",
        date_planifiee: DATE_A_VENIR_2,
        duree_estimee_min: 60,
      },
      // CLÔTURÉE et PASSÉE — exclue par le statut ET par la date : si l'une
      // des deux exclusions disparaissait, le compte passerait à 3.
      {
        statut: "cloturee",
        date_planifiee: DATE_PASSEE,
        duree_estimee_min: null,
      },
    ];
    for (const ligne of lignes) {
      const id = uuidv7();
      await client.intervention.create({
        data: {
          id,
          societe_id: societe.id,
          client_id: site.client_id,
          site_id: site.id,
          agence_id: agence.id,
          type: "curatif",
          statut: ligne.statut,
          technicien_id: technicienId,
          date_planifiee: ligne.date_planifiee,
          duree_estimee_min: ligne.duree_estimee_min,
        },
      });
      interventionsPosees.push(id);
    }
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    if (interventionsPosees.length > 0) {
      await client.intervention.deleteMany({
        where: { id: { in: interventionsPosees } },
      });
    }
    if (technicienId !== "") {
      await client.technicien.deleteMany({
        where: { utilisateur_id: technicienId },
      });
      await client.utilisateurSociete.deleteMany({
        where: { utilisateur_id: technicienId },
      });
      await client.utilisateur.deleteMany({ where: { id: technicienId } });
    }
  } finally {
    await client.$disconnect();
  }
});

test.beforeEach(async ({ page }) => {
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
});

/** La fiche de modification de CE technicien — ouverte, comme un humain le ferait. */
async function ouvrirLaFiche(page: Page) {
  await page.goto("/parametres/equipe");
  const section = page
    .locator("details")
    .filter({ hasText: NOM })
    .filter({ has: page.locator("form") });
  await expect(section).toBeVisible();
  await section.locator("summary").click();
  return section;
}

test("LA FICHE AFFICHE « 2 interventions à venir », AVEC LE LIEN VERS LE REGISTRE DE CE TECHNICIEN", async ({
  page,
}) => {
  const section = await ouvrirLaFiche(page);

  const lien = section.locator("a", { hasText: DEUX_A_VENIR });
  await expect(lien).toBeVisible();
  await expect(lien).toHaveAttribute(
    "href",
    `/interventions?technicien=${technicienId}`,
  );

  // La note qui accompagne le lien — même mécanisme composé hors du JSX.
  await expect(
    section.getByText(fr["equipe.interventions_a_venir.note"]),
  ).toBeVisible();
});

test("DÉSACTIVER CE TECHNICIEN, ALORS QU'IL A ENCORE 2 INTERVENTIONS À VENIR, POSE L'AVERTISSEMENT", async ({
  page,
}) => {
  const section = await ouvrirLaFiche(page);
  await section.getByLabel(fr["equipe.actif"]).uncheck();
  await section.getByRole("button", { name: fr["equipe.enregistrer"] }).click();
  await page.waitForLoadState("networkidle");

  await expect(page).toHaveURL(/\/parametres\/equipe/);
  await expect(
    page.getByText(fr["equipe.avertissement.desactivation_a_venir"]),
  ).toBeVisible();

  const lienAvertissement = page.locator("a", { hasText: DEUX_A_VENIR });
  await expect(lienAvertissement).toBeVisible();
  await expect(lienAvertissement).toHaveAttribute(
    "href",
    `/interventions?technicien=${technicienId}`,
  );

  await capturer(page, "avertissement-desactivation");

  await lienAvertissement.click();
  await expect(page).toHaveURL(
    new RegExp(`/interventions\\?technicien=${technicienId}`),
  );

  // Et le technicien est bien désormais inactif, masqué par défaut — le
  // reste du comportement de `Technicien.actif` n'a pas changé.
  await page.goto("/parametres/equipe?etat=tous");
  await expect(
    page
      .locator("details")
      .filter({ hasText: NOM })
      .getByText(fr["equipe.inactif"]),
  ).toBeVisible();
});

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/81-EQUIPE-1/captures",
);

async function capturer(page: Page, nom: string): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}-1280.png`),
    fullPage: true,
  });
}
