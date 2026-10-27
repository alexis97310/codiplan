import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { creerAuth } from "@/lib/auth/config";
import { Role } from "@/lib/auth/roles";
import { avecContexteRls } from "@/lib/db/rls";
import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { MOT_DE_PASSE_EPREUVE } from "./setup/scene";
import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE 9H5-CORRECTIFS-9G6 — AVANT/APRÈS, même recette que
 * `zz-captures-9g6-formulaires.spec.ts` : ce fichier est lancé une fois sur
 * `origin/main` (AVANT, avec la régression), une fois sur le code livré
 * (APRÈS). Captures en VIEWPORT (pas `fullPage`), à 375 et 1280 px.
 *
 * DEUX ÉCRANS : « Nouvelle intervention » ouverte DEPUIS la fiche client (fil
 * d'ariane et « Annuler » visibles, point 2), et l'écran d'enrôlement (point
 * 3 — le champ mot de passe, autoComplete invisible à l'œil, mais l'écran
 * reste le témoin demandé par le ticket).
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9H5 ?? "";
const PHASE = process.env.CAPTURES_9H5_PHASE === "avant" ? "avant" : "apres";

async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  if (DOSSIER === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER, `${nom}-${PHASE}-${largeur}.png`),
    fullPage: false,
  });
}

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

function urlApplicative(): string {
  const url = new URL(urlAdministration());
  url.username = "codiplan_app";
  url.password = "";
  return url.toString();
}

/**
 * SA PROPRE IDENTITÉ, JAMAIS ENRÔLÉE (même piège que
 * `enrolement-secrets-hors-url.spec.ts`) — `admin.societe@` est enrôlée une
 * fois pour tout le run par `setup/global.ts`, et ce fichier a besoin d'une
 * identité qui voit encore l'étape « mot de passe » de `/enrolement`.
 */
const EMAIL_ENROLEMENT = "9h5.capture@codima.test";
const NOM_ENROLEMENT = "9H5 Capture";
let utilisateurIdEnrolement = "";

test.beforeAll(async () => {
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
    datasources: { db: { url: urlApplicative() } },
  });
  try {
    const authAdmin = creerAuth(applicatif, {
      societeId,
      role: Role.direction,
    });
    const cree = await authAdmin.api.signUpEmail({
      body: {
        email: EMAIL_ENROLEMENT,
        password: MOT_DE_PASSE_EPREUVE,
        name: NOM_ENROLEMENT,
      },
    });
    utilisateurIdEnrolement = cree.user.id;
    await avecContexteRls(
      applicatif,
      { societeId, role: Role.direction },
      (tx) =>
        tx.$executeRawUnsafe(
          `INSERT INTO "utilisateur_societe" ("id","utilisateur_id","societe_id","role")
             VALUES ($1::uuid, $2::uuid, $3::uuid, $4::"Role")`,
          uuidv7(),
          utilisateurIdEnrolement,
          societeId,
          Role.direction,
        ),
    );
  } finally {
    await applicatif.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.journalAcces.deleteMany({
      where: { utilisateur_id: utilisateurIdEnrolement },
    });
    await client.utilisateurSociete.deleteMany({
      where: { utilisateur_id: utilisateurIdEnrolement },
    });
    await client.utilisateur.delete({ where: { id: utilisateurIdEnrolement } });
  } finally {
    await client.$disconnect();
  }
});

for (const largeur of [1280, 375] as const) {
  test(`capture — Nouvelle intervention depuis la fiche client, à ${largeur}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 900 });
    await ouvrirUneSession(page);
    await page.goto("/clients");
    const premiereFiche = page
      .locator('a[href^="/clients/"]:not([href="/clients/nouveau"])')
      .first();
    await expect(premiereFiche).toBeVisible();
    await premiereFiche.click();
    await expect(page).toHaveURL(/\/clients\/[^/]+$/);

    const bouton = page.getByRole("link", {
      name: fr["clients.action.ajouter_intervention"],
    });
    if ((await bouton.count()) === 0) {
      // Aucun client actif habilité dans cette scène (AVANT, sur
      // `origin/main`, sème sa propre base) — rien à capturer.
      return;
    }
    await bouton.first().click();
    await page.waitForURL(/\/interventions\/nouvelle\?/);
    await expect(page.locator("main")).toBeVisible();
    // LE FIL D'ARIANE ET « ANNULER » DOIVENT ÊTRE VISIBLES ENSEMBLE — le
    // formulaire dépasse 900px de haut, et « Annuler » n'est ni collé ni
    // sticky (seul `BarreActionCollee`, autour du bouton « Créer », l'est,
    // et seulement sous 901px) : la hauteur du viewport s'ajuste à la
    // hauteur RÉELLE du contenu plutôt que de couper l'un des deux.
    const hauteurContenu = await page.evaluate(
      () => document.body.scrollHeight,
    );
    await page.setViewportSize({
      width: largeur,
      height: Math.min(hauteurContenu, 3000),
    });
    await capturer(page, "nouvelle-intervention-depuis-client", largeur);
  });

  test(`capture — Enrôlement, à ${largeur}px`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: 900 });
    await page.goto("/connexion");
    await page.getByLabel(fr["connexion.email"]).fill(EMAIL_ENROLEMENT);
    await page
      .getByLabel(fr["connexion.mot_de_passe"])
      .fill(MOT_DE_PASSE_EPREUVE);
    await page.getByRole("button", { name: fr["connexion.valider"] }).click();
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/enrolement$/);
    await capturer(page, "enrolement", largeur);
  });
}
