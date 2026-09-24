import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { referenceAffichee } from "@/app/(back-office)/interventions/presentation";
import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { ouvrirUneSession } from "./setup/session";

/**
 * 65-ABSENCES-3 — LES RÉFÉRENCES RENDUES SONT DES LIENS (SAV-12, suite de
 * 59-ABSENCES-2).
 *
 * Le bandeau « rendues à la file » et l'aperçu affichaient déjà les
 * références des interventions déplanifiées, en TEXTE : l'exploitant devait
 * ensuite aller les rechercher à la main dans le registre pour les
 * réaffecter. Ce fichier prouve que chaque référence est désormais un LIEN
 * vers sa fiche (`/interventions/{id}`), où « Affecter » existe déjà.
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `ABS3-` — jamais `tests/e2e/setup/scene.ts`
 *
 * Un technicien FORGÉ, un client et un site à soi, DEUX interventions
 * planifiées sur une période dédiée — jamais celle d'`absences-2.spec.ts`
 * (14–18 janvier 2030), pour ne pas dépendre d'un fichier voisin sous
 * `fullyParallel` (§9, même piège que `blocage-agenda-visible.spec.ts`).
 *
 * **Les identifiants sont engendrés par `uuidv7()`, jamais écrits en dur** —
 * le gardien L0-11 résoudrait une constante littérale jusqu'au texte rendu
 * (`Local-<6 caractères>`, I10) ; engendrés à l'exécution, ils échappent à
 * cette résolution, comme dans `absences-2.spec.ts`.
 */

test.describe.configure({ mode: "serial" });

const SOCIETE_CODE = "CODIMA-NC";

let utilisateurAbs3 = "";
let utilisateurSocieteAbs3 = "";
let technicienAbs3 = "";
let clientAbs3 = "";
let siteAbs3 = "";

let interventionA = "";
let interventionB = "";

const DU = "2030-02-11";
const AU = "2030-02-13";

/** La référence affichée, LUE depuis la même fonction que l'écran (I10). */
function reference(id: string): string {
  return referenceAffichee({ id, numero: null });
}

async function nouveauClientAdministration(): Promise<PrismaClient> {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

async function effacerLaScene(): Promise<void> {
  if (utilisateurAbs3 === "") {
    return;
  }
  const client = await nouveauClientAdministration();
  try {
    await client.absence.deleteMany({
      where: { utilisateur_id: utilisateurAbs3 },
    });
    await client.intervention.deleteMany({
      where: { id: { in: [interventionA, interventionB] } },
    });
    await client.site.deleteMany({ where: { id: siteAbs3 } });
    await client.client.deleteMany({ where: { id: clientAbs3 } });
    await client.technicien.deleteMany({ where: { id: technicienAbs3 } });
    await client.utilisateurSociete.deleteMany({
      where: { id: utilisateurSocieteAbs3 },
    });
    await client.utilisateur.deleteMany({ where: { id: utilisateurAbs3 } });
  } finally {
    await client.$disconnect();
  }
}

async function ecrireLaScene(): Promise<void> {
  utilisateurAbs3 = uuidv7();
  utilisateurSocieteAbs3 = uuidv7();
  technicienAbs3 = uuidv7();
  clientAbs3 = uuidv7();
  siteAbs3 = uuidv7();
  interventionA = uuidv7();
  interventionB = uuidv7();

  const client = await nouveauClientAdministration();
  try {
    const societe = await client.societe.findFirstOrThrow({
      where: { code: SOCIETE_CODE },
      select: { id: true },
    });
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societe.id },
      select: { id: true },
      orderBy: { code: "asc" },
    });

    await client.utilisateur.create({
      data: {
        id: utilisateurAbs3,
        nom: "Technicien ABS3- (épreuve ABSENCES-3)",
        email: "abs3-technicien@codiplan.test",
      },
    });
    await client.utilisateurSociete.create({
      data: {
        id: utilisateurSocieteAbs3,
        utilisateur_id: utilisateurAbs3,
        societe_id: societe.id,
        role: Role.technicien,
      },
    });
    await client.technicien.create({
      data: {
        id: technicienAbs3,
        societe_id: societe.id,
        utilisateur_id: utilisateurAbs3,
        agence_id: agence.id,
        actif: true,
      },
    });

    await client.client.create({
      data: {
        id: clientAbs3,
        societe_id: societe.id,
        raison_sociale: "Client ABS3- (épreuve ABSENCES-3)",
      },
    });
    await client.site.create({
      data: {
        id: siteAbs3,
        societe_id: societe.id,
        client_id: clientAbs3,
        agence_id: agence.id,
        libelle: "Lieu ABS3- (épreuve ABSENCES-3)",
        temps_trajet_min: 10,
      },
    });

    const base = {
      societe_id: societe.id,
      agence_id: agence.id,
      client_id: clientAbs3,
      site_id: siteAbs3,
      technicien_id: utilisateurAbs3,
      type: "curatif" as const,
      priorite: "p3" as const,
      statut: "planifiee" as const,
      duree_estimee_min: 60,
      mode_valorisation: "temps_passe" as const,
      devise_code: "XPF",
    };

    // DEUX interventions DANS la période — les deux bornes, comprises
    // (RG-PLA-06).
    await client.intervention.create({
      data: {
        id: interventionA,
        ...base,
        date_planifiee: new Date(`${DU}T00:00:00.000Z`),
      },
    });
    await client.intervention.create({
      data: {
        id: interventionB,
        ...base,
        date_planifiee: new Date(`${AU}T00:00:00.000Z`),
      },
    });

    const enBase = await client.intervention.count({
      where: { id: { in: [interventionA, interventionB] } },
    });
    expect(enBase).toBe(2);
  } finally {
    await client.$disconnect();
  }
}

test.beforeAll(ecrireLaScene);
test.afterAll(effacerLaScene);

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

/** Remplit le formulaire de blocage, demande l'aperçu puis confirme la pose. */
async function poserLAbsence(page: Page): Promise<void> {
  await page.goto("/absences");
  await page.locator("#absence-personne").selectOption(utilisateurAbs3);
  await page.locator("#absence-du").fill(DU);
  await page.locator("#absence-au").fill(AU);
  await page
    .getByRole("button", { name: fr["absences.apercu_action"] })
    .click();
  await page.waitForLoadState("networkidle");

  const apercu = page.getByRole("status");
  await apercu
    .getByRole("button", { name: fr["absences.declarer_action"] })
    .click();
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveURL(/\/absences\?rendues=/);
}

test("le bandeau « rendues à la file » porte un lien par intervention, et un lien vers le registre", async ({
  page,
}) => {
  await poserLAbsence(page);

  const bandeau = page.getByRole("status").filter({
    hasText: fr["absences.rendues_titre"],
  });
  await expect(bandeau).toHaveCount(1);

  // LE LIEN VERS LE REGISTRE, EN TÊTE DU BANDEAU.
  const lienRegistre = bandeau.getByRole("link", {
    name: fr["absences.rendues_lien_registre"],
  });
  await expect(lienRegistre).toHaveAttribute(
    "href",
    "/interventions?vue=a_planifier",
  );

  // UN LIEN PAR INTERVENTION RENDUE — DEUX, PAS DU TEXTE.
  const lienA = bandeau.getByRole("link", { name: reference(interventionA) });
  const lienB = bandeau.getByRole("link", { name: reference(interventionB) });
  await expect(lienA).toHaveAttribute(
    "href",
    `/interventions/${interventionA}`,
  );
  await expect(lienB).toHaveAttribute(
    "href",
    `/interventions/${interventionB}`,
  );

  // Le bandeau ne porte AUCUN autre lien que ces trois-là (le registre, et
  // une référence par intervention rendue).
  await expect(bandeau.getByRole("link")).toHaveCount(3);

  // CLIQUER LA PREMIÈRE RÉFÉRENCE OUVRE LA FICHE DE CETTE INTERVENTION,
  // À STATUT « À PLANIFIER » — c'est là qu'« Affecter » existe déjà.
  await lienA.click();
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveURL(`/interventions/${interventionA}`);
  await expect(
    page.getByText(reference(interventionA), { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText(fr["statut.a_planifier"], { exact: false }),
  ).toBeVisible();
});

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/65-ABSENCES-3/captures",
);

test("capture — le bandeau « rendues à la file » avec ses liens", async ({
  page,
}) => {
  await poserLAbsence(page);
  const bandeau = page.getByRole("status").filter({
    hasText: fr["absences.rendues_titre"],
  });
  await expect(
    bandeau.getByRole("link", { name: reference(interventionA) }),
  ).toBeVisible();

  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, "bandeau-rendues-liens-1280.png"),
    fullPage: true,
  });
});
