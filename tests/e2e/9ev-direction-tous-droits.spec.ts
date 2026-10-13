import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, type Page, test } from "@playwright/test";

import { creerAuth } from "@/lib/auth/config";
import { Role } from "@/lib/auth/roles";
import { avecContexteRls } from "@/lib/db/rls";
import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { MOT_DE_PASSE_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * 9EV-DIRECTION-TOUS-DROITS — LA DIRECTION, À TRAVERS UN NAVIGATEUR (D199,
 * décision n° 85 d'Alexis, 13/10/2026).
 *
 * `tests/isolation/droits-ecrans-tp-s3.test.ts` et `tests/unit/auth/
 * habilitations.test.ts` prouvent la matrice et les routes, hors écran. Ce
 * fichier prouve que trois écrans RÉELS s'ouvrent désormais en écriture à la
 * direction : Équipe (le volet « Ajouter une personne », côté technicien),
 * les agences, et les taux horaires — les trois mêmes que `captures-9dx-
 * retouches-11-parametres.spec.ts` avait capturés en LECTURE SEULE sous
 * D153/PA-02, avant ce lot.
 *
 * **SA PROPRE IDENTITÉ, préfixée `9ev-`** (modèle `captures-9dx-retouches-
 * 11-parametres.spec.ts`) : la direction n'a aucune identité connectable
 * dans la scène partagée (`tests/e2e/setup/scene.ts`, hors territoire de ce
 * lot), ce fichier crée donc la sienne par `signUpEmail` sous un contexte
 * administratif, et la supprime en fin.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = join(
  process.cwd(),
  "docs/propositions/9EV-DIRECTION-TOUS-DROITS/captures",
);

const PREFIXE = "9ev-direction-tous-droits";
const EMAIL_DIRECTION = `${PREFIXE}@codima.test`;
const NOM_DIRECTION = "9EV Direction";

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

async function ouvrirSessionDirection(page: Page): Promise<void> {
  await ouvrirLaSessionSensible(page, EMAIL_DIRECTION);
}

async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER, `${nom}-${largeur}.png`),
    fullPage: true,
  });
}

test("D199 — la direction ouvre Équipe sans refus, et le volet « Ajouter une personne » propose le formulaire technicien", async ({
  page,
}) => {
  await ouvrirSessionDirection(page);
  await page.goto("/parametres/equipe");
  await expect(page.getByText(fr["auth.refus_droit"])).not.toBeVisible();
  await expect(
    page.getByRole("link", { name: fr["equipe.ajouter_personne"] }),
  ).toBeVisible();

  await page.goto("/parametres/equipe?ajouter=1&type=technicien");
  const formulaire = page.locator('form[action="/api/techniciens/creer"]');
  await expect(formulaire).toBeVisible();
  await expect(formulaire.getByLabel(fr["equipe.nom"])).toBeVisible();
});

test("D199 — la direction ouvre les agences, et « Nouvel établissement » est présent", async ({
  page,
}) => {
  await ouvrirSessionDirection(page);
  await page.goto("/parametres/agences");
  await expect(page.getByText(fr["auth.refus_droit"])).not.toBeVisible();
  await expect(
    page.getByRole("link", { name: fr["agence.creer"] }),
  ).toBeVisible();
});

test("D199 — la direction ouvre les taux horaires, et le formulaire d'écriture est présent", async ({
  page,
}) => {
  await ouvrirSessionDirection(page);
  await page.goto("/parametres/taux-horaire");
  await expect(page.getByText(fr["auth.refus_droit"])).not.toBeVisible();
  await expect(page.getByText(fr["taux_horaire.poser"])).toBeVisible();
  await expect(
    page.locator('form[action="/api/parametres/taux-horaire/creer"]'),
  ).toBeVisible();
});

const CAPTURES: ReadonlyArray<{
  readonly slug: string;
  readonly chemin: string;
}> = [
  { slug: "equipe", chemin: "/parametres/equipe?ajouter=1&type=technicien" },
  { slug: "agences", chemin: "/parametres/agences" },
  { slug: "taux-horaire", chemin: "/parametres/taux-horaire" },
];

for (const largeur of [1280, 375] as const) {
  for (const ecran of CAPTURES) {
    test(`capture — ${ecran.slug} vu par la direction, à ${largeur}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: largeur, height: 1200 });
      await ouvrirSessionDirection(page);
      await page.goto(ecran.chemin);
      await expect(page.locator("main")).toBeVisible();
      await capturer(page, `${ecran.slug}-direction`, largeur);
    });
  }
}
