import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { decompte } from "@/app/(back-office)/presentation";
import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { ouvrirUneSession } from "./setup/session";

/**
 * 57-REGISTRE-2 — LE FILTRE TECHNICIEN DU REGISTRE DES INTERVENTIONS.
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `REG2-`
 *
 * Créée en `beforeAll`, supprimée en `afterAll` — AUCUNE ligne n'est ajoutée
 * au semis, même geste que `tests/e2e/interventions-2.spec.ts`. **Les DEUX
 * techniciens sont FORGÉS ici**, plutôt que de reprendre les deux identités
 * partagées du semis (`reperesDeLaScene().technicienKone/Ducos`) : ce fichier
 * tourne sous `fullyParallel`, et une affectation posée sur une identité
 * partagée serait visible — et comptée — par n'importe quel autre spécimen du
 * même run. Une identité forgée, prefixée, n'appartient qu'à cette épreuve.
 *
 * ## LE TEXTE `REG2-` BORNE LA POPULATION AVANT LE FILTRE TECHNICIEN
 *
 * Les trois interventions posées portent toutes le même client, nommé
 * `REG2 — Client de l'épreuve` : la recherche `q=REG2-` (AT-07) les isole déjà
 * de tout le reste du parc — semis compris, et les scènes des autres specs
 * exécutées en parallèle. Le filtre technicien n'a plus, ensuite, qu'à
 * distinguer les trois entre elles.
 */
test.describe.configure({ mode: "serial" });

const UTILISATEUR_A = uuidv7();
const UTILISATEUR_B = uuidv7();
const RATTACHEMENT_A = uuidv7();
const RATTACHEMENT_B = uuidv7();
const TECHNICIEN_A = uuidv7();
const TECHNICIEN_B = uuidv7();
const CLIENT_REG2 = uuidv7();
const SITE_REG2 = uuidv7();
const INTERVENTION_A1 = uuidv7();
const INTERVENTION_A2 = uuidv7();
const INTERVENTION_NON_AFFECTEE = uuidv7();

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  const societeId = reperes.societeId;

  const client = admin();
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societeId, code: "DUCOS" },
      select: { id: true },
    });

    for (const [utilisateurId, rattachementId, technicienId, nom] of [
      [
        UTILISATEUR_A,
        RATTACHEMENT_A,
        TECHNICIEN_A,
        fr["registre2.e2e.technicien_a"],
      ],
      [
        UTILISATEUR_B,
        RATTACHEMENT_B,
        TECHNICIEN_B,
        fr["registre2.e2e.technicien_b"],
      ],
    ] as const) {
      await client.utilisateur.create({
        data: {
          id: utilisateurId,
          nom,
          email: `${utilisateurId}@registre2.e2e.test`,
        },
      });
      await client.utilisateurSociete.create({
        data: {
          id: rattachementId,
          utilisateur_id: utilisateurId,
          societe_id: societeId,
          role: Role.technicien,
        },
      });
      await client.technicien.create({
        data: {
          id: technicienId,
          societe_id: societeId,
          utilisateur_id: utilisateurId,
          agence_id: agence.id,
          actif: true,
        },
      });
    }

    await client.client.create({
      data: {
        id: CLIENT_REG2,
        societe_id: societeId,
        raison_sociale: fr["registre2.e2e.client"],
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_REG2,
        societe_id: societeId,
        client_id: CLIENT_REG2,
        agence_id: agence.id,
        libelle: fr["registre2.e2e.site"],
      },
    });

    for (const [id, technicienId] of [
      [INTERVENTION_A1, UTILISATEUR_A],
      [INTERVENTION_A2, UTILISATEUR_A],
      [INTERVENTION_NON_AFFECTEE, null],
    ] as const) {
      await client.$executeRawUnsafe(
        `INSERT INTO "intervention"
           ("id", "societe_id", "client_id", "site_id", "agence_id", "type", "statut", "technicien_id", "modifie_le")
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif', 'a_planifier', $6::uuid, now())`,
        id,
        societeId,
        CLIENT_REG2,
        SITE_REG2,
        agence.id,
        technicienId,
      );
    }
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "client_id" = $1::uuid`,
      CLIENT_REG2,
    );
    await client.site.deleteMany({ where: { client_id: CLIENT_REG2 } });
    await client.client.deleteMany({ where: { id: CLIENT_REG2 } });
    await client.technicien.deleteMany({
      where: { utilisateur_id: { in: [UTILISATEUR_A, UTILISATEUR_B] } },
    });
    await client.utilisateurSociete.deleteMany({
      where: { utilisateur_id: { in: [UTILISATEUR_A, UTILISATEUR_B] } },
    });
    await client.utilisateur.deleteMany({
      where: { id: { in: [UTILISATEUR_A, UTILISATEUR_B] } },
    });
  } finally {
    await client.$disconnect();
  }
});

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/57-REGISTRE-2/captures",
);

async function capturer(page: Page, nom: string): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}-1280.png`),
    fullPage: true,
  });
}

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

test("le filtre technicien A retrouve exactement ses deux interventions, jamais la troisième", async ({
  page,
}) => {
  // LE FILTRE ATTEND `utilisateur_id` (la valeur des options du `<select>`,
  // et ce que `intervention.technicien_id` porte réellement) — PAS l'`id`
  // PROPRE de la ligne `technicien`, une seconde clé que le schéma distingue
  // exprès (voir `Technicien.id` dans `prisma/schema.prisma`).
  await page.goto(`/interventions?q=REG2-&technicien=${UTILISATEUR_A}`);
  await expect(page.locator("table tbody tr")).toHaveCount(2);
  const lignesClient = page.getByRole("cell", {
    name: fr["registre2.e2e.client"],
  });
  await expect(lignesClient).toHaveCount(2);
  await expect(
    page.getByText(
      decompte(
        2,
        fr["interventions.resultat_un"],
        fr["interventions.resultat"],
      ),
      { exact: true },
    ),
  ).toBeVisible();
  await capturer(page, "filtre-technicien-a");
});

test("« Non affectées » retrouve exactement l'intervention sans technicien", async ({
  page,
}) => {
  await page.goto("/interventions?q=REG2-&technicien=aucun");
  await expect(page.locator("table tbody tr")).toHaveCount(1);
  await expect(
    page.getByText(
      decompte(
        1,
        fr["interventions.resultat_un"],
        fr["interventions.resultat"],
      ),
      { exact: true },
    ),
  ).toBeVisible();
  await capturer(page, "filtre-technicien-non-affectees");
});

test("le filtre technicien B rend une liste vide — l'état vide s'affiche", async ({
  page,
}) => {
  await page.goto(`/interventions?q=REG2-&technicien=${UTILISATEUR_B}`);
  await expect(page.getByText(fr["interventions.vide"])).toBeVisible();
  await expect(page.locator("table tbody tr")).toHaveCount(1);
  await expect(
    page.getByText(
      decompte(
        0,
        fr["interventions.resultat_un"],
        fr["interventions.resultat"],
      ),
      { exact: true },
    ),
  ).toBeVisible();
  await capturer(page, "filtre-technicien-b-vide");
});

test("le sélecteur propose les deux techniciens forgés, nommés", async ({
  page,
}) => {
  await page.goto("/interventions?technicien=aucun");
  const select = page.locator('select[name="technicien"]');
  await expect(select).toHaveValue("aucun");
  await expect(
    select.locator("option", { hasText: fr["registre2.e2e.technicien_a"] }),
  ).toHaveCount(1);
  await expect(
    select.locator("option", { hasText: fr["registre2.e2e.technicien_b"] }),
  ).toHaveCount(1);
  await capturer(page, "filtre-technicien-aucun");
});
