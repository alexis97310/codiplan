import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { ouvrirUneSession } from "./setup/session";

/**
 * 9I7-BON-INTERVENTION-EN-TUILES — L'ORDRE DES TUILES SUIT LA NATURE DE
 * L'INTERVENTION (point 2 bis, demande d'Alexis du 29/10/2026 ~20:50).
 *
 * `tests/unit/interventions/profil-bon.test.ts` éprouve `profilDuBon` en
 * isolation, une fonction pure. Ce fichier éprouve que LA PAGE lit bien son
 * verdict : un bon préventif avance « Prestations » juste après « Machine »,
 * un bon curatif garde l'ordre de base — « Commentaires et photos » juste
 * après « Intervention ».
 *
 * MÊME SITE/CLIENT QUE `bon-intervention.spec.ts` (celui de Ducos, « Atelier
 * principal ») — SA PROPRE PAIRE DE LIGNES D'INTERVENTION, jamais celle de
 * ce fichier (AFFICHAGE-MATERIEL-1, même raison : le bon n'existe que pour
 * `terminee`/`cloturee`, et dix autres fichiers lisent déjà `obstacle`).
 */
test.describe.configure({ mode: "serial" });

const BON_CURATIF = "01a0f200-0000-7000-8000-0000000009c1";
const BON_PREVENTIF = "01a0f200-0000-7000-8000-0000000009c2";

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  const client = admin();
  try {
    const ducos = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "DUCOS" },
      select: { id: true },
    });
    const site = await client.site.findFirstOrThrow({
      where: {
        societe_id: reperes.societeId,
        agence_id: ducos.id,
        client: { actif: true },
        // Le site SEMÉ de Ducos, par son libellé (9ER) — même site que
        // `bon-intervention.spec.ts`.
        libelle: "Atelier principal",
      },
      select: { id: true, client_id: true },
    });
    await client.intervention.deleteMany({
      where: { id: { in: [BON_CURATIF, BON_PREVENTIF] } },
    });
    for (const [id, type] of [
      [BON_CURATIF, "curatif"],
      [BON_PREVENTIF, "preventif_contrat"],
    ] as const) {
      await client.$executeRawUnsafe(
        `INSERT INTO "intervention" ("id", "societe_id", "agence_id", "client_id", "site_id",
           "technicien_id", "type", "priorite", "statut", "date_planifiee",
           "mode_valorisation", "devise_code", "modifie_le")
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6::uuid,
                 $7::"TypeIntervention", 'p3', 'terminee'::"StatutIntervention",
                 now()::date, 'temps_passe', 'XPF', now())`,
        id,
        reperes.societeId,
        ducos.id,
        site.client_id,
        site.id,
        reperes.technicienDucos,
        type,
      );
    }
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.intervention.deleteMany({
      where: { id: { in: [BON_CURATIF, BON_PREVENTIF] } },
    });
  } finally {
    await client.$disconnect();
  }
});

/** Les titres des tuiles, dans l'ordre de lecture — la version CLIENT (par défaut). */
async function titresDesTuiles(page: Page, id: string): Promise<string[]> {
  await page.goto(`/interventions/${id}/bon`);
  return page.locator(".zone-impression-bon h2").allTextContents();
}

const ORDRE_BASE = [
  fr["intervention.client"],
  fr["intervention.machine"],
  fr["intervention.titre"],
  fr["intervention.commentaires_photos.titre"],
  fr["intervention.bon.prestations_titre"],
  fr["intervention.bon.suite_titre"],
  fr["intervention.bon.signature_titre"],
];

const ORDRE_PREVENTIF = [
  fr["intervention.client"],
  fr["intervention.machine"],
  fr["intervention.bon.prestations_titre"],
  fr["intervention.titre"],
  fr["intervention.commentaires_photos.titre"],
  fr["intervention.bon.suite_titre"],
  fr["intervention.bon.signature_titre"],
];

test("curatif : l'ordre de base — Commentaires et photos juste après Intervention", async ({
  page,
}) => {
  await ouvrirUneSession(page);
  const titres = await titresDesTuiles(page, BON_CURATIF);
  expect(titres).toEqual(ORDRE_BASE);
});

test("préventif sous contrat : Prestations avancée juste après Machine", async ({
  page,
}) => {
  await ouvrirUneSession(page);
  const titres = await titresDesTuiles(page, BON_PREVENTIF);
  expect(titres).toEqual(ORDRE_PREVENTIF);
});

test("le titre du document porte la nature de l'intervention", async ({
  page,
}) => {
  await ouvrirUneSession(page);
  await page.goto(`/interventions/${BON_PREVENTIF}/bon`);
  await expect(
    page.getByText(
      `${fr["intervention.bon.titre"]}${fr["ponctuation.separateur"]}${fr["type_intervention.preventif_contrat"]}`,
      { exact: false },
    ),
  ).toBeVisible();
});

test("l'impression isole chaque tuile de toute coupure de page, sans débordement horizontal", async ({
  page,
}) => {
  await ouvrirUneSession(page);
  await page.goto(`/interventions/${BON_PREVENTIF}/bon`);

  // MÊME CLASSE QUE `ActionsBonIntervention` AVANT `window.print()` — posée
  // ici directement, jamais en cliquant le bouton (qui ouvrirait une boîte
  // de dialogue native que Playwright ne pilote pas).
  await page.evaluate(() => document.body.classList.add("print-bon"));
  await page.emulateMedia({ media: "print" });

  const ruptures = await page
    .locator(".zone-impression-bon section")
    .evaluateAll((sections) =>
      sections.map((section) => getComputedStyle(section).breakInside),
    );
  expect(ruptures.length).toBeGreaterThan(0);
  for (const rupture of ruptures) {
    expect(rupture).toBe("avoid");
  }

  const debordement = await page.evaluate(() => {
    const zone = document.querySelector(".zone-impression-bon");
    return zone === null ? null : zone.scrollWidth - zone.clientWidth;
  });
  expect(debordement).toBeLessThanOrEqual(0);

  await page.evaluate(() => document.body.classList.remove("print-bon"));
  await page.emulateMedia({ media: null });
});
