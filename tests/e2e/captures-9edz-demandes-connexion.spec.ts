import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { base32 } from "@better-auth/utils/base32";
import { createOTP } from "@better-auth/utils/otp";
import { PrismaClient } from "@prisma/client";
import { test, type Page } from "@playwright/test";

import { creerAuth } from "@/lib/auth/config";
import { Role } from "@/lib/auth/roles";
import { avecContexteRls } from "@/lib/db/rls";
import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { MOT_DE_PASSE_EPREUVE } from "./setup/scene";
import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE 9EDZ-DEMANDES-CONNEXION-MAQUETTE — même recette que
 * `captures-9ek-creations-1.spec.ts` : rien n'est écrit sans la variable
 * d'environnement qui nomme le dossier, pour que `pnpm test:e2e` ordinaire
 * n'écrive jamais de fichier. `CAPTURES_9EDZ_PHASE` (`avant`/`apres`) nomme
 * la phase dans le fichier écrit — la même spec sert les deux, rejouée sur
 * deux commits différents (voir la passation pour ce qui a été rejoué, et
 * ce qui ne l'a pas été).
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9EDZ ?? "";
const PHASE = process.env.CAPTURES_9EDZ_PHASE ?? "apres";

const PREFIXE = "9EDZ-CAP-";

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

async function capturer(
  page: Page,
  nom: string,
  largeur: number,
  pleine = true,
): Promise<void> {
  if (DOSSIER === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER, `${nom}-${PHASE}-${largeur}.png`),
    fullPage: pleine,
  });
}

const CLIENT_ID = "9edca000-0000-7000-8000-00000000ca01";
const SITE_ID = "9edca000-0000-7000-8000-00000000ca02";
const DEMANDE_SIMPLE = "9edca000-0000-7000-8000-00000000ca03";
const DEMANDE_EN_RETARD = "9edca000-0000-7000-8000-00000000ca04";
const DEMANDE_TRANSFORMEE = "9edca000-0000-7000-8000-00000000ca05";
const INTERVENTION_ISSUE = "9edca000-0000-7000-8000-00000000ca06";

async function nettoyer(client: PrismaClient): Promise<void> {
  await client.intervention.deleteMany({ where: { id: INTERVENTION_ISSUE } });
  await client.demande.deleteMany({
    where: {
      id: { in: [DEMANDE_SIMPLE, DEMANDE_EN_RETARD, DEMANDE_TRANSFORMEE] },
    },
  });
  await client.site.deleteMany({ where: { id: SITE_ID } });
  await client.client.deleteMany({ where: { id: CLIENT_ID } });
}

test.beforeAll(async () => {
  if (DOSSIER === "") return;
  const client = admin();
  try {
    await nettoyer(client);
    const societe = await client.societe.findFirstOrThrow({
      where: { code: "CODIMA-NC" },
      select: { id: true },
    });
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societe.id },
      select: { id: true },
      orderBy: { code: "asc" },
    });
    await client.client.create({
      data: {
        id: CLIENT_ID,
        societe_id: societe.id,
        raison_sociale: `${PREFIXE}Client`,
      },
    });
    await client.site.create({
      data: {
        id: SITE_ID,
        societe_id: societe.id,
        client_id: CLIENT_ID,
        agence_id: agence.id,
        libelle: `${PREFIXE}Lieu`,
      },
    });
    const commun = {
      societe_id: societe.id,
      source: "appel" as const,
      client_id: CLIENT_ID,
      site_id: SITE_ID,
      agence_id: agence.id,
      urgence: "p3" as const,
    };
    await client.demande.create({
      data: {
        ...commun,
        id: DEMANDE_SIMPLE,
        description: `${PREFIXE}Description simple`,
        depose_le: new Date(),
        compteur_accuse_le: new Date(),
      },
    });
    await client.demande.create({
      data: {
        ...commun,
        id: DEMANDE_EN_RETARD,
        description: `${PREFIXE}Demande en retard`,
        depose_le: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        compteur_accuse_le: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      },
    });
    await client.demande.create({
      data: {
        ...commun,
        id: DEMANDE_TRANSFORMEE,
        description: `${PREFIXE}Demande transformée`,
        statut: "transformee",
        depose_le: new Date(),
        compteur_accuse_le: new Date(),
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION_ISSUE,
        societe_id: societe.id,
        client_id: CLIENT_ID,
        site_id: SITE_ID,
        agence_id: agence.id,
        type: "curatif",
        statut: "a_planifier",
        demande_id: DEMANDE_TRANSFORMEE,
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  if (DOSSIER === "") return;
  const client = admin();
  try {
    await nettoyer(client);
  } finally {
    await client.$disconnect();
  }
});

test.beforeEach(async ({ page }) => {
  if (DOSSIER === "") return;
  await ouvrirUneSession(page);
});

test("/demandes — 1280 et 375", async ({ page }) => {
  if (DOSSIER === "") return;
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/demandes");
  await capturer(page, "demandes", 1280);
  await page.setViewportSize({ width: 375, height: 800 });
  await capturer(page, "demandes", 375);
});

test("/demandes/:id — une demande transformée (Suite donnée) — 1280 et 375", async ({
  page,
}) => {
  if (DOSSIER === "") return;
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/demandes/${DEMANDE_TRANSFORMEE}`);
  await capturer(page, "demandes-id", 1280);
  await page.setViewportSize({ width: 375, height: 800 });
  await capturer(page, "demandes-id", 375);
});

test("/connexion — 1280 et 375", async ({ page }) => {
  if (DOSSIER === "") return;
  await page.context().clearCookies();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/connexion");
  await capturer(page, "connexion", 1280);
  await page.setViewportSize({ width: 375, height: 800 });
  await capturer(page, "connexion", 375);
});

test("/mot-de-passe-oublie — 1280 et 375", async ({ page }) => {
  if (DOSSIER === "") return;
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/mot-de-passe-oublie");
  await capturer(page, "mot-de-passe-oublie", 1280);
  await page.setViewportSize({ width: 375, height: 800 });
  await capturer(page, "mot-de-passe-oublie", 375);
});

test("le volet « Nouvelle demande » ouvert — 1280 et 375, et après un refus", async ({
  page,
}) => {
  if (DOSSIER === "") return;
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/demandes?nouvelle=1");
  await capturer(page, "demandes-volet-ouvert", 1280);
  await page.setViewportSize({ width: 375, height: 800 });
  await capturer(page, "demandes-volet-ouvert", 375);

  // APRÈS UN REFUS — motif forgé, écran rouvert avec le bandeau rouge.
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/demandes?nouvelle=1&motif=demande.refus.machine_hors_lieu");
  await capturer(page, "demandes-volet-refus", 1280);
});

test("la liste avec le message de succès, et la pastille allumée", async ({
  page,
}) => {
  if (DOSSIER === "") return;
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/demandes?creee=${DEMANDE_SIMPLE}`);
  await capturer(page, "demandes-creee", 1280);

  // LA PASTILLE — le jeu partagé peut déjà l'allumer pour d'autres
  // raisons ; DEMANDE_EN_RETARD suffit à la garantir ici.
  await page.goto("/demandes");
  await capturer(page, "demandes-pastille", 1280);
});

/**
 * /connexion/code — UNE IDENTITÉ À SOI, jamais enrôlée (même patron que
 * `tests/e2e/9edz-connexion-code.spec.ts`) : c'est le seul chemin normal
 * pour atteindre cette étape.
 */
const EMAIL_CODE = `${PREFIXE.toLowerCase().replace(/-/g, "")}.direction@codima.test`;
let utilisateurIdCode = "";

async function urlApplicative(): Promise<string> {
  const url = new URL(urlAdministration());
  url.username = "codiplan_app";
  url.password = "";
  return url.toString();
}

test.beforeAll(async () => {
  if (DOSSIER === "") return;
  const proprietaire = admin();
  let societeId = "";
  try {
    const societe = await proprietaire.societe.findFirstOrThrow({
      where: { code: "CODIMA-NC" },
      select: { id: true },
    });
    societeId = societe.id;
  } finally {
    await proprietaire.$disconnect();
  }

  const applicatif = new PrismaClient({
    datasources: { db: { url: await urlApplicative() } },
  });
  try {
    const authAdmin = creerAuth(applicatif, {
      societeId,
      role: Role.admin_societe,
    });
    const cree = await authAdmin.api.signUpEmail({
      body: {
        email: EMAIL_CODE,
        password: MOT_DE_PASSE_EPREUVE,
        name: "9EDZ CAP Direction",
      },
    });
    utilisateurIdCode = cree.user.id;
    await avecContexteRls(
      applicatif,
      { societeId, role: Role.admin_societe },
      (tx) =>
        tx.$executeRawUnsafe(
          `INSERT INTO "utilisateur_societe" ("id","utilisateur_id","societe_id","role")
             VALUES ($1::uuid, $2::uuid, $3::uuid, $4::"Role")`,
          uuidv7(),
          utilisateurIdCode,
          societeId,
          Role.direction,
        ),
    );
  } finally {
    await applicatif.$disconnect();
  }
});

test.afterAll(async () => {
  if (DOSSIER === "" || utilisateurIdCode === "") return;
  const client = admin();
  try {
    await client.journalAcces.deleteMany({
      where: { utilisateur_id: utilisateurIdCode },
    });
    await client.utilisateurSociete.deleteMany({
      where: { utilisateur_id: utilisateurIdCode },
    });
    await client.utilisateur.delete({ where: { id: utilisateurIdCode } });
  } finally {
    await client.$disconnect();
  }
});

test("/connexion/code — 1280 et 375", async ({ page }) => {
  if (DOSSIER === "") return;
  // `beforeEach` vient d'ouvrir la session de l'épreuve ordinaire : ce
  // scénario a besoin d'une page ANONYME pour se connecter sous SA PROPRE
  // identité.
  await page.context().clearCookies();
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(EMAIL_CODE);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await page.waitForLoadState("networkidle");
  // Première connexion : l'enrôlement. On l'achève pour retrouver /connexion
  // à la connexion SUIVANTE, celle qui porte le défi du code.
  await page.fill('input[name="motDePasse"]', MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["enrolement.reveler"] }).click();
  await page.waitForLoadState("networkidle");
  const affichee = (await page.locator("code").first().innerText()).replace(
    /\s+/g,
    "",
  );
  const cle = new TextDecoder().decode(base32.decode(affichee));
  await page.fill(
    'input[name="code"]',
    await createOTP(cle, { digits: 6, period: 30 }).totp(),
  );
  await page.getByRole("button", { name: fr["enrolement.confirmer"] }).click();
  await page.waitForLoadState("networkidle");

  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(EMAIL_CODE);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await page.waitForLoadState("networkidle");

  await page.setViewportSize({ width: 1280, height: 900 });
  await capturer(page, "connexion-code", 1280);
  await page.setViewportSize({ width: 375, height: 800 });
  await capturer(page, "connexion-code", 375);
});
