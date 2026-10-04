import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, type Page, test } from "@playwright/test";

import { creerAuth } from "@/lib/auth/config";
import { Role } from "@/lib/auth/roles";
import { avecContexteRls } from "@/lib/db/rls";
import { uuidv7 } from "@/lib/db/uuid";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { MOT_DE_PASSE_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible, ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE A5 (9DX-RETOUCHES-11) — AVANT/APRÈS, NON PRISES PAR 9DH.
 *
 * Six écrans de paramétrage (taux horaire, forfaits, matériel, prestations,
 * trajets, agences), vus par la DIRECTION et par l'ADV, à 375 et 1280 px.
 * `0` écriture n'est demandée ici — ce sont des lectures, la mesure même de
 * D153 (le `○` de la direction devient LECTURE SEULE).
 *
 * **Rien n'est écrit sans la variable d'environnement qui nomme le dossier**
 * (`CAPTURES_9DX`), pour que `pnpm test:e2e` ordinaire n'écrive jamais de
 * fichier — même recette que `captures-9dca-droits-terrain-demandes.spec.ts`.
 *
 * **AUCUN COMPTE N'EST AJOUTÉ À LA SCÈNE.** L'ADV emprunte le compte déjà
 * connectable de l'épreuve (`ouvrirUneSession`, scene.ts). La direction
 * n'a AUCUNE identité connectable dans la scène — `tests/e2e/setup/global.ts`
 * n'enrôle que `adv`, `garnier` (technicien) et `admin.societe` — ce fichier
 * crée donc SA PROPRE identité `direction`, préfixée, par `signUpEmail` sous
 * un contexte administratif (même chemin que
 * `tests/e2e/enrolement-secrets-hors-url.spec.ts`, qui a la même contrainte
 * pour la même raison), et la supprime en fin. Aucune ligne de `scene.ts` ni
 * de `SCENE.*` n'est touchée.
 *
 * **AVANT/APRÈS se prend en rejouant ce fichier deux fois** : une fois depuis
 * un worktree temporaire posé sur `9a2f6ed` (avant D153 et avant A1 de ce
 * lot), une fois sur le code livré — recette de
 * `docs/propositions/.../captures-avant-apres` (voir mémoire de session).
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9DX ?? "";
const ETAPE = process.env.CAPTURES_9DX_ETAPE ?? "avant";

const PREFIXE = "9dx11-retouches-11-direction";
const EMAIL_DIRECTION = `${PREFIXE}@codima.test`;
const NOM_DIRECTION = "9DX11 Direction";

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

let utilisateurDirectionId = "";

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  const applicatif = new PrismaClient({
    datasources: { db: { url: urlApplicative() } },
  });
  try {
    const authAdmin = creerAuth(applicatif, {
      societeId: reperes.societeId,
      role: Role.admin_societe,
    });
    const cree = await authAdmin.api.signUpEmail({
      body: {
        email: EMAIL_DIRECTION,
        password: MOT_DE_PASSE_EPREUVE,
        name: NOM_DIRECTION,
      },
    });
    utilisateurDirectionId = cree.user.id;
    await avecContexteRls(
      applicatif,
      { societeId: reperes.societeId, role: Role.admin_societe },
      (tx) =>
        tx.$executeRawUnsafe(
          `INSERT INTO "utilisateur_societe" ("id","utilisateur_id","societe_id","role")
             VALUES ($1::uuid, $2::uuid, $3::uuid, $4::"Role")`,
          uuidv7(),
          utilisateurDirectionId,
          reperes.societeId,
          Role.direction,
        ),
    );
  } finally {
    await applicatif.$disconnect();
  }
});

test.afterAll(async () => {
  if (utilisateurDirectionId === "") return;
  const client = admin();
  try {
    await client.journalAcces.deleteMany({
      where: { utilisateur_id: utilisateurDirectionId },
    });
    await client.utilisateurSociete.deleteMany({
      where: { utilisateur_id: utilisateurDirectionId },
    });
    await client.utilisateur.delete({ where: { id: utilisateurDirectionId } });
  } finally {
    await client.$disconnect();
  }
});

async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  if (DOSSIER === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER, `${nom}-${ETAPE}-${largeur}.png`),
    fullPage: true,
  });
}

async function ouvrirSessionDirection(page: Page): Promise<void> {
  await ouvrirLaSessionSensible(page, EMAIL_DIRECTION);
}

const ECRANS: ReadonlyArray<{
  readonly slug: string;
  readonly chemin: string;
}> = [
  { slug: "taux-horaire", chemin: "/parametres/taux-horaire" },
  { slug: "forfaits", chemin: "/parametres/forfaits" },
  { slug: "materiel", chemin: "/parametres/materiel" },
  { slug: "prestations", chemin: "/parametres/prestations" },
  { slug: "trajets", chemin: "/parametres/trajets" },
  { slug: "agences", chemin: "/parametres/agences" },
];

for (const largeur of [1280, 375] as const) {
  for (const ecran of ECRANS) {
    test(`capture — ${ecran.slug} vu par la direction, à ${largeur}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: largeur, height: 1200 });
      await ouvrirSessionDirection(page);
      await page.goto(ecran.chemin);
      await expect(page.locator("main")).toBeVisible();
      await capturer(page, `${ecran.slug}-direction`, largeur);
    });

    test(`capture — ${ecran.slug} vu par l'ADV, à ${largeur}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: largeur, height: 1200 });
      await ouvrirUneSession(page);
      await page.goto(ecran.chemin);
      await expect(page.locator("main")).toBeVisible();
      await capturer(page, `${ecran.slug}-adv`, largeur);
    });
  }
}
