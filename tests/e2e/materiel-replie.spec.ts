import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { COMPTE_ADMIN_SOCIETE_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * 9AM-GR17-M11 — LE FORMULAIRE « MODIFIER » DU RÉFÉRENTIEL MATÉRIEL N'EST
 * JAMAIS DÉPLIÉ DANS LA LISTE (audit GR du 26/09, constat M11).
 *
 * **ADAPTÉ PAR 9I95-REFONTE-PARAMETRES-MATERIEL** : `/parametres/materiel`
 * repliait jusqu'ici un formulaire de modification par ligne (`<details>`),
 * comme `/parametres/equipe` avant ERGO-1. Ce lot le remplace par un volet
 * latéral, ouvert par un bouton « Modifier » plutôt que par un `<summary>` —
 * mais la preuve que ce test porte N'A PAS CHANGÉ : *le formulaire de
 * modification n'est pas rendu dans le flux de la liste*, et un geste
 * explicite le découvre, avec les mêmes valeurs. Seul le geste change
 * (navigation vers `?volet=…&id=…` plutôt que `<details open>`).
 *
 * Scène propre, préfixée `ERGO11-`, créée et supprimée par cette épreuve :
 * aucune ligne du semis n'est touchée.
 *
 * **LE COMPTE EST L'ADMINISTRATEUR DE SOCIÉTÉ, PAS L'ADV (D153, 03/10/2026,
 * TP-S3).** Cette épreuve ouvrait jusqu'ici une session ADV
 * (`ouvrirUneSession`) et trouvait les formulaires repliés — un hasard, pas
 * un droit : la route `/api/parametres/materiel/.../modifier` exige
 * `parametrer_societe` au niveau ● (`exigerCapaciteComplete`), que l'ADV n'a
 * jamais eu. Depuis D153, l'écran suit enfin la route : ces formulaires
 * disparaissent pour l'ADV (voir `tests/isolation/droits-ecrans-tp-s3.test.ts`,
 * qui traverse les routes elles-mêmes — aucun spec e2e dédié n'a jamais existé
 * sous le nom `menu-droits-tp-s3.spec.ts`, A4 de 9DX-RETOUCHES-11), et ce
 * scénario-ci doit se placer sur un compte qui voit encore ces formulaires.
 */
test.describe.configure({ mode: "serial" });

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

const FAMILLE_ID = uuidv7();
const MODELE_ID = uuidv7();
const CODE_FAMILLE = "ERGO11F";
const LIBELLE_FAMILLE = "ERGO11-Famille";
const MARQUE_MODELE = "ERGO11-Marque";
const REFERENCE_MODELE = "ERGO11-Reference";

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  const client = admin();
  try {
    await client.familleMateriel.create({
      data: {
        id: FAMILLE_ID,
        societe_id: reperes.societeId,
        code: CODE_FAMILLE,
        libelle: LIBELLE_FAMILLE,
      },
    });
    await client.modeleMateriel.create({
      data: {
        id: MODELE_ID,
        societe_id: reperes.societeId,
        famille_id: FAMILLE_ID,
        marque: MARQUE_MODELE,
        reference: REFERENCE_MODELE,
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.modeleMateriel.deleteMany({ where: { id: MODELE_ID } });
    await client.familleMateriel.deleteMany({ where: { id: FAMILLE_ID } });
  } finally {
    await client.$disconnect();
  }
});

test.beforeEach(async ({ page }) => {
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
});

test("le formulaire « Modifier la famille » n'est pas dans la liste, et « Modifier » l'ouvre dans un volet", async ({
  page,
}) => {
  await page.goto("/parametres/materiel");

  const formulaire = page.locator(
    `form[action="/api/parametres/materiel/familles/${FAMILLE_ID}/modifier"]`,
  );
  await expect(formulaire).toHaveCount(0);

  const ligne = page.locator("table").first().locator("tr", {
    hasText: CODE_FAMILLE,
  });
  await ligne.getByRole("link", { name: fr["materiel.modifier"] }).click();

  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(formulaire).toBeVisible();
});

test("le formulaire « Modifier le modèle » n'est pas dans la liste, et « Modifier » l'ouvre dans un volet", async ({
  page,
}) => {
  await page.goto("/parametres/materiel?onglet=modeles");

  const formulaire = page.locator(
    `form[action="/api/parametres/materiel/modeles/${MODELE_ID}/modifier"]`,
  );
  await expect(formulaire).toHaveCount(0);

  const ligne = page.locator("table").first().locator("tr", {
    hasText: REFERENCE_MODELE,
  });
  await ligne.getByRole("link", { name: fr["materiel.modifier"] }).click();

  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(formulaire).toBeVisible();
});
