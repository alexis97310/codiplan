import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Locator, type Page } from "@playwright/test";

import {
  instantDuJour,
  jourDe,
  jourSuivant,
  maintenant,
  type JourLocal,
} from "@/lib/calendar/fuseau";
import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { FICHIER_COURRIELS_CAPTURES } from "./setup/courriel-captures";
import { reperesDeLaScene } from "./setup/reperes";
import {
  cleDeJour,
  COMPTE_TECHNICIEN_EPREUVE,
  MOT_DE_PASSE_EPREUVE,
} from "./setup/scene";
import { choisirResultatParTexte } from "./setup/selecteur-recherche";
import { ouvrirUneSession } from "./setup/session";

/**
 * AVERTISSEMENTS-1 (24/09/2026) — LA PLANIFICATION PRÉVIENT LE CLIENT ET LE
 * TECHNICIEN, DE BOUT EN BOUT.
 *
 * ## Ce que les tests unitaires et d'isolation ne peuvent pas prouver
 *
 * `tests/unit/avertissements/*` éprouvent la composition, pure ; l'isolation
 * éprouve le cloisonnement et le garde applicatif du badge. Ni l'un ni
 * l'autre ne prouve qu'un ADV qui clique « Planifier » voit réellement le
 * bandeau, ni qu'un technicien voit réellement son badge « Nouveau »
 * disparaître à l'ouverture de sa fiche. C'est ce que ce fichier joue, à
 * travers l'écran.
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `AV1-`
 *
 * Créée en `beforeAll`, supprimée en `afterAll` — AUCUNE ligne n'est ajoutée
 * au semis (`prisma/seed.ts`, `prisma/seed-data.ts`). Le technicien, lui, est
 * une identité DU SEMIS (`guerin@codima.test`, Ducos) : il faut un compte
 * dont on connaisse le mot de passe pour se connecter côté terrain, et
 * `COMPTE_TECHNICIEN_EPREUVE` est exactement ça.
 *
 * ## LE COURRIEL EST DOUBLÉ, AU NIVEAU DU SERVEUR
 *
 * `playwright.config.ts` charge `tests/e2e/setup/double-courriel.cjs` avant
 * le serveur de test : les appels vers `api.resend.com` sont interceptés,
 * jamais réels, et chaque corps intercepté est ajouté à
 * `FICHIER_COURRIELS_CAPTURES` — c'est le seul moyen de mesurer, depuis le
 * PROCESSUS Playwright, ce que le PROCESSUS serveur a composé.
 *
 * ## SÉRIEL — les scénarios s'enchaînent sur les mêmes fiches
 */
test.describe.configure({ mode: "serial" });

const CLIENT_AVEC = uuidv7();
const SITE_AVEC = uuidv7();
const CONTACT_DONNEUR_ORDRE = uuidv7();
const CLIENT_SANS = uuidv7();
const SITE_SANS = uuidv7();
const INTERVENTION_BADGE = uuidv7();

const COURRIEL_DONNEUR_ORDRE = "donneur-ordre@av1.e2e.test";

let societeId = "";
let agenceDucosId = "";
let technicienId = "";
let interventionPrincipaleId = "";

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  societeId = reperes.societeId;
  technicienId = reperes.technicienDucos;

  const client = admin();
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societeId, code: "DUCOS" },
      select: { id: true },
    });
    agenceDucosId = agence.id;

    await client.client.create({
      data: {
        id: CLIENT_AVEC,
        societe_id: societeId,
        raison_sociale: fr["avertissements.e2e.client"],
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_AVEC,
        societe_id: societeId,
        client_id: CLIENT_AVEC,
        agence_id: agenceDucosId,
        libelle: fr["avertissements.e2e.site"],
      },
    });
    await client.contact.create({
      data: {
        id: CONTACT_DONNEUR_ORDRE,
        societe_id: societeId,
        client_id: CLIENT_AVEC,
        site_id: SITE_AVEC,
        nom: fr["avertissements.e2e.contact_donneur_ordre"],
        roles: ["donneur_ordre"],
        canaux: ["email"],
        email: COURRIEL_DONNEUR_ORDRE,
        actif: true,
      },
    });

    await client.client.create({
      data: {
        id: CLIENT_SANS,
        societe_id: societeId,
        raison_sociale: fr["avertissements.e2e.client_sans_contact"],
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_SANS,
        societe_id: societeId,
        client_id: CLIENT_SANS,
        agence_id: agenceDucosId,
        libelle: fr["avertissements.e2e.site_sans_contact"],
      },
    });

    // LE BADGE SE MESURE SUR LA JOURNÉE DU TECHNICIEN, DONC AUJOURD'HUI DANS
    // LE FUSEAU DE LA SOCIÉTÉ (STABILITE-2, 25/09/2026) — posée directement,
    // sans passer par l'écran : ce que ce scénario éprouve est l'effacement
    // du badge, pas la planification elle-même (déjà jouée par les
    // scénarios 1 à 3). `CURRENT_DATE` est le jour civil UTC de PostgreSQL,
    // pas celui de Nouméa (UTC+11) : entre 00h00 et 11h00 heure locale,
    // `/terrain` (qui lit `instantDuJour(jourDe(maintenant(fuseau).local))`)
    // montre la journée de la VEILLE au sens UTC, et la carte du badge
    // n'apparaissait plus. Même règle ici que sur l'écran.
    const aujourdHui = jourDe(maintenant(reperes.fuseau).local);
    await client.$executeRawUnsafe(
      `INSERT INTO "intervention"
         ("id", "societe_id", "client_id", "site_id", "agence_id", "type",
          "statut", "technicien_id", "date_planifiee", "creneau_debut",
          "creneau_fin", "duree_estimee_min", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif',
               'planifiee', $6::uuid, $7::date, now(), now() + interval '1 hour',
               60, now())`,
      INTERVENTION_BADGE,
      societeId,
      CLIENT_AVEC,
      SITE_AVEC,
      agenceDucosId,
      technicienId,
      instantDuJour(aujourdHui),
    );

    if (existsSync(FICHIER_COURRIELS_CAPTURES)) {
      writeFileSync(FICHIER_COURRIELS_CAPTURES, "");
    }
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "client_id" IN ($1::uuid, $2::uuid)`,
      CLIENT_AVEC,
      CLIENT_SANS,
    );
    await client.contact.deleteMany({ where: { client_id: CLIENT_AVEC } });
    await client.site.deleteMany({
      where: { client_id: { in: [CLIENT_AVEC, CLIENT_SANS] } },
    });
    await client.client.deleteMany({
      where: { id: { in: [CLIENT_AVEC, CLIENT_SANS] } },
    });
  } finally {
    await client.$disconnect();
  }
});

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/47-AVERTISSEMENTS-1/captures",
);

/** Les deux largeurs demandées par le ticket, mobile puis bureau. */
async function capturer(page: Page, nom: string): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  for (const largeur of [375, 1280]) {
    await page.setViewportSize({ width: largeur, height: 900 });
    await page.screenshot({
      path: join(DOSSIER_CAPTURES, `${nom}-${largeur}.png`),
      fullPage: true,
    });
  }
}

function formulaire(page: Page, titre: string): Locator {
  return page.locator("form", {
    has: page.getByRole("heading", { name: titre }),
  });
}

/** Les lignes JSON du journal des envois interceptés, dans l'ordre. */
function courrielsCaptures(): unknown[] {
  if (!existsSync(FICHIER_COURRIELS_CAPTURES)) {
    return [];
  }
  return readFileSync(FICHIER_COURRIELS_CAPTURES, "utf8")
    .split("\n")
    .filter((ligne) => ligne.trim().length > 0)
    .map((ligne) => JSON.parse(ligne) as unknown);
}

async function planifier(
  page: Page,
  jour: JourLocal,
  heure: string,
): Promise<void> {
  const form = formulaire(page, fr["intervention.action.planifier"]);
  await form.locator('input[name="date_planifiee"]').fill(cleDeJour(jour));
  await form.locator('input[name="heure_debut"]').fill(heure);
  await form.locator('input[name="duree_min"]').fill("60");
  await form.locator('select[name="technicien_id"]').selectOption(technicienId);
  await form
    .getByRole("button", { name: fr["intervention.action.planifier"] })
    .click();
  await page.waitForLoadState("networkidle");
}

test("planifier avec un donneur d'ordre du site : le bandeau dit « parti »", async ({
  page,
}) => {
  await ouvrirUneSession(page);
  await page.goto("/interventions/nouvelle");
  // LE SITE CHERCHE SUR LE SERVEUR (SELECTEURS-1) — la mise en scène change,
  // l'assertion (le bandeau « parti ») ne change pas.
  await choisirResultatParTexte(
    page,
    "site",
    fr["avertissements.e2e.site"],
    fr["avertissements.e2e.site"],
  );
  await page
    .locator('textarea[name="description"]')
    .fill(fr["avertissements.e2e.panne"]);
  await page
    .getByRole("button", { name: fr["intervention.action.creer"] })
    .click();
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveURL(/\/interventions\/[0-9a-f-]+$/);
  interventionPrincipaleId =
    new URL(page.url()).pathname.split("/").pop() ?? "";

  const reperes = await reperesDeLaScene();
  const jour = jourSuivant(reperes.lundi, 91);
  const avant = courrielsCaptures().length;
  await planifier(page, jour, "09:00");

  await expect(
    page.locator(
      '[data-avertissement="intervention.avertissement.courriel_client_parti"]',
    ),
  ).toBeVisible();
  await expect(
    page.locator(
      '[data-avertissement="intervention.avertissement.courriel_technicien_parti"]',
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 1 }).getByText(fr["statut.planifiee"]),
  ).toBeVisible();
  await capturer(page, "bandeau-parti");

  // TÉMOIN — le double a réellement intercepté DEUX envois, pas zéro : sans
  // lui, un bandeau « parti » qui ne partirait de rien passerait pour juste.
  expect(courrielsCaptures().length).toBe(avant + 2);
});

test("déplacer une intervention déjà planifiée : les deux courriels disent « déplacée du … au … »", async ({
  page,
}) => {
  await ouvrirUneSession(page);
  await page.goto(`/interventions/${interventionPrincipaleId}`);
  const reperes = await reperesDeLaScene();
  const jour = jourSuivant(reperes.lundi, 91);

  const avant = courrielsCaptures().length;
  // « Déplacer » N'EST PLUS L'ACTION PRINCIPALE UNE FOIS PLANIFIÉE
  // (93-FICHE-ACTIONS, constat 19) — replié dans un `<details>`, il faut
  // d'abord ouvrir son `<summary>` avant d'atteindre ses champs.
  const deplacerDetails = page.locator("details", {
    has: page.locator("summary", {
      hasText: fr["intervention.action.deplacer"],
    }),
  });
  await deplacerDetails.locator("summary").click();
  const form = deplacerDetails.locator("form");
  await form.locator('input[name="date_planifiee"]').fill(cleDeJour(jour));
  await form.locator('input[name="heure_debut"]').fill("13:00");
  await form.locator('input[name="duree_min"]').fill("60");
  await form
    .getByRole("button", { name: fr["intervention.action.deplacer"] })
    .click();
  await page.waitForLoadState("networkidle");

  await expect(
    page.locator(
      '[data-avertissement="intervention.avertissement.courriel_client_parti"]',
    ),
  ).toBeVisible();
  await expect(
    page.locator(
      '[data-avertissement="intervention.avertissement.courriel_technicien_parti"]',
    ),
  ).toBeVisible();

  await capturer(page, "bandeau-deplacement");

  const captures = courrielsCaptures() as { text?: string }[];
  const nouvelles = captures.slice(avant);
  expect(nouvelles).toHaveLength(2);
  for (const envoi of nouvelles) {
    expect(envoi.text ?? "").toContain("déplacée du");
    expect(envoi.text ?? "").toContain("09:00");
    expect(envoi.text ?? "").toContain("13:00");
  }
});

test("sans donneur d'ordre : avertissement affiché, planification quand même faite", async ({
  page,
}) => {
  await ouvrirUneSession(page);
  await page.goto("/interventions/nouvelle");
  await choisirResultatParTexte(
    page,
    "site",
    fr["avertissements.e2e.site_sans_contact"],
    fr["avertissements.e2e.site_sans_contact"],
  );
  await page
    .locator('textarea[name="description"]')
    .fill(fr["avertissements.e2e.panne"]);
  await page
    .getByRole("button", { name: fr["intervention.action.creer"] })
    .click();
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveURL(/\/interventions\/[0-9a-f-]+$/);

  const reperes = await reperesDeLaScene();
  const jour = jourSuivant(reperes.lundi, 92);
  await planifier(page, jour, "09:00");

  await expect(
    page.locator(
      '[data-avertissement="intervention.avertissement.courriel_client_sans_destinataire"]',
    ),
  ).toBeVisible();
  await expect(
    page.locator(
      '[data-avertissement="intervention.avertissement.courriel_technicien_parti"]',
    ),
  ).toBeVisible();
  // L'AVERTISSEMENT NE BLOQUE RIEN : la planification a bien eu lieu.
  await expect(
    page.getByRole("heading", { level: 1 }).getByText(fr["statut.planifiee"]),
  ).toBeVisible();
  await capturer(page, "bandeau-sans-destinataire");
});

test("le badge « Nouveau » se voit, puis s'efface à l'ouverture par le technicien affecté", async ({
  page,
}) => {
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(COMPTE_TECHNICIEN_EPREUVE);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await expect(page).toHaveURL(/\/arrivee/);

  await page.goto("/terrain");
  const carte = page.locator(`a[href="/terrain/${INTERVENTION_BADGE}"]`);
  await expect(carte).toContainText(fr["terrain.badge_nouveau"]);
  await capturer(page, "badge-nouveau-avant");

  await carte.click();
  await expect(page).toHaveURL(`/terrain/${INTERVENTION_BADGE}`);

  await page.goto("/terrain");
  const carteApres = page.locator(`a[href="/terrain/${INTERVENTION_BADGE}"]`);
  await expect(carteApres).not.toContainText(fr["terrain.badge_nouveau"]);
  await capturer(page, "badge-nouveau-apres");
});
