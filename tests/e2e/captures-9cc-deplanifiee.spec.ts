import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { ouvrirUneSession } from "./setup/session";

/**
 * CAPTURES AVANT/APRÈS — 9CC-DEPLANIFIEE-1 (constat 38 de l'audit d'ergonomie
 * du 25/09/2026).
 *
 * ## CE FICHIER DOIT COMPILER SUR L'ANCIEN CODE COMME SUR LE NOUVEAU
 *
 * `tsconfig.json` inclut `tests/`, donc `next build` (que Playwright lance
 * avant `next start`) type-vérifie CE FICHIER contre le code visé. Lancé
 * AVANT le premier commit du ticket (`git worktree`, voir la passation), la
 * clé `intervention.deplanifiee.avant` n'existe pas encore dans le
 * dictionnaire : la lire par nom, `(fr as Record<string, string>)[cle]`,
 * jamais `fr["intervention.deplanifiee.avant"]`, qui casserait LE BUILD AVANT
 * plutôt qu'une assertion.
 *
 * Ce fichier ne fait QUE POSER LA SCÈNE ET PHOTOGRAPHIER — il n'affirme rien
 * sur la présence de la mention (c'est `deplanifiee-1.spec.ts` qui l'éprouve) :
 * c'est le seul moyen qu'il reste vert AVANT le code qu'il photographie.
 */

const CLE_AVANT = "intervention.deplanifiee.avant" as const;
const DICTIONNAIRE = fr as unknown as Record<string, string>;

test.describe.configure({ mode: "serial" });

const SOCIETE_CODE = "CODIMA-NC";

let utilisateurDepl1 = "";
let utilisateurSocieteDepl1 = "";
let technicienDepl1 = "";
let clientDepl1 = "";
let siteDepl1 = "";
let interventionDepl1 = "";

function prochainLundiDansAuMoins(joursMinimum: number): Date {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + joursMinimum);
  while (date.getUTCDay() !== 1) {
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return date;
}

function jourCivil(date: Date): string {
  return date.toISOString().slice(0, 10);
}

const LUNDI = prochainLundiDansAuMoins(65);
const MARDI = new Date(LUNDI.getTime() + 24 * 60 * 60 * 1000);
const VENDREDI = new Date(LUNDI.getTime() + 4 * 24 * 60 * 60 * 1000);

const DU = jourCivil(LUNDI);
const AU = jourCivil(VENDREDI);
const DATE_PLANIFIEE = jourCivil(MARDI);
const CRENEAU_DEBUT = new Date(MARDI.getTime() - 3 * 60 * 60 * 1000);
const CRENEAU_FIN = new Date(CRENEAU_DEBUT.getTime() + 60 * 60 * 1000);

const NOM_PERSONNE = "Technicien DEPL1-CAPTURE (9CC-DEPLANIFIEE-1)";
const RAISON_SOCIALE = "Client DEPL1-CAPTURE (9CC-DEPLANIFIEE-1)";

async function nouveauClientAdministration(): Promise<PrismaClient> {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

async function effacerLaScene(): Promise<void> {
  if (utilisateurDepl1 === "") {
    return;
  }
  const client = await nouveauClientAdministration();
  try {
    await client.absence.deleteMany({
      where: { utilisateur_id: utilisateurDepl1 },
    });
    await client.intervention.deleteMany({
      where: { id: interventionDepl1 },
    });
    await client.site.deleteMany({ where: { id: siteDepl1 } });
    await client.client.deleteMany({ where: { id: clientDepl1 } });
    await client.technicien.deleteMany({ where: { id: technicienDepl1 } });
    await client.utilisateurSociete.deleteMany({
      where: { id: utilisateurSocieteDepl1 },
    });
    await client.utilisateur.deleteMany({ where: { id: utilisateurDepl1 } });
  } finally {
    await client.$disconnect();
  }
}

async function ecrireLaScene(): Promise<void> {
  utilisateurDepl1 = uuidv7();
  utilisateurSocieteDepl1 = uuidv7();
  technicienDepl1 = uuidv7();
  clientDepl1 = uuidv7();
  siteDepl1 = uuidv7();
  interventionDepl1 = uuidv7();

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
        id: utilisateurDepl1,
        nom: NOM_PERSONNE,
        email: "depl1-capture-technicien@codiplan.test",
      },
    });
    await client.utilisateurSociete.create({
      data: {
        id: utilisateurSocieteDepl1,
        utilisateur_id: utilisateurDepl1,
        societe_id: societe.id,
        role: Role.technicien,
      },
    });
    await client.technicien.create({
      data: {
        id: technicienDepl1,
        societe_id: societe.id,
        utilisateur_id: utilisateurDepl1,
        agence_id: agence.id,
        actif: true,
      },
    });

    await client.client.create({
      data: {
        id: clientDepl1,
        societe_id: societe.id,
        raison_sociale: RAISON_SOCIALE,
      },
    });
    await client.site.create({
      data: {
        id: siteDepl1,
        societe_id: societe.id,
        client_id: clientDepl1,
        agence_id: agence.id,
        libelle: "Lieu DEPL1-CAPTURE (9CC-DEPLANIFIEE-1)",
        temps_trajet_min: 10,
      },
    });

    await client.intervention.create({
      data: {
        id: interventionDepl1,
        societe_id: societe.id,
        agence_id: agence.id,
        client_id: clientDepl1,
        site_id: siteDepl1,
        technicien_id: utilisateurDepl1,
        type: "curatif",
        priorite: "p3",
        statut: "planifiee",
        date_planifiee: new Date(`${DATE_PLANIFIEE}T00:00:00.000Z`),
        creneau_debut: CRENEAU_DEBUT,
        creneau_fin: CRENEAU_FIN,
        duree_estimee_min: 60,
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
      },
    });

    const enBase = await client.intervention.count({
      where: { id: interventionDepl1 },
    });
    expect(enBase).toBe(1);
  } finally {
    await client.$disconnect();
  }
}

test.beforeAll(ecrireLaScene);
test.afterAll(effacerLaScene);

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/9CC-DEPLANIFIEE-1/captures",
);

test("pose l'absence, puis photographie la file, la fiche et le texte de levée", async ({
  page,
}) => {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 1000 });

  // ── LA POSE ────────────────────────────────────────────────────────────
  await page.goto("/absences");
  await page.locator("#absence-personne").selectOption(utilisateurDepl1);
  await page.locator("#absence-du").fill(DU);
  await page.locator("#absence-au").fill(AU);
  await page
    .getByRole("button", { name: DICTIONNAIRE["absences.apercu_action"] })
    .click();
  await page.waitForLoadState("networkidle");
  const apercu = page.getByRole("status");
  await apercu
    .getByRole("button", { name: DICTIONNAIRE["absences.declarer_action"] })
    .click();
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveURL(/\/absences\?rendues=/);

  // ── LA FILE « À PLANIFIER » ──────────────────────────────────────────────
  await page.goto(`/planning?q=${encodeURIComponent("DEPL1-CAPTURE")}`);
  await page.waitForLoadState("networkidle");
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, "planning-file-a-planifier-apres-1280.png"),
    fullPage: true,
  });

  // ── LA FICHE ───────────────────────────────────────────────────────────
  await page.goto(`/interventions/${interventionDepl1}`);
  await page.waitForLoadState("networkidle");
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, "fiche-intervention-apres-1280.png"),
    fullPage: true,
  });

  // ── LE TEXTE DE LEVÉE ──────────────────────────────────────────────────
  await page.goto("/absences");
  await page.waitForLoadState("networkidle");
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, "absences-texte-levee-apres-1280.png"),
    fullPage: true,
  });

  // Témoin, pour la passation : la clé existe (ou non) dans ce dictionnaire.
  expect(typeof DICTIONNAIRE[CLE_AVANT]).toBe(
    CLE_AVANT in DICTIONNAIRE ? "string" : "undefined",
  );
});
