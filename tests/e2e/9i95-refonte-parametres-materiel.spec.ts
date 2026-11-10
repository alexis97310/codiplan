import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import {
  COMPTE_ADMIN_SOCIETE_EPREUVE,
  COMPTE_TECHNICIEN_EPREUVE,
} from "./setup/scene";
import { ouvrirLaSessionSensible, ouvrirUneSession } from "./setup/session";

/**
 * 9I95-REFONTE-PARAMETRES-MATERIEL — l'écran en deux onglets, un volet pour
 * créer ET modifier, une recherche et un filtre d'activité par onglet.
 *
 * Trois gênes nommées par Alexis (« Trop long, tout mélangé », « Créer et
 * modifier, pas clair », « Lecture des tableaux ») — chaque groupe de tests
 * ci-dessous en éprouve une.
 *
 * SA PROPRE SCÈNE, PRÉFIXÉE `9I95-` : une famille active, une famille
 * inactive, un modèle de la famille active — créés en `beforeAll`, effacés en
 * `afterAll`, aucune ligne du semis touchée (même discipline que
 * `visuel-2.spec.ts`). Les familles et modèles créés PAR les tests eux-mêmes
 * (volet « Ajouter ») sont retrouvés par leur code/référence et effacés au
 * même endroit.
 */
test.describe.configure({ mode: "serial" });

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

const FAMILLE_ACTIVE = uuidv7();
const FAMILLE_INACTIVE = uuidv7();
const MODELE = uuidv7();

const CODE_ACTIVE = "9I95A";
const CODE_INACTIVE = "9I95I";
const LIBELLE_ACTIVE = "9I95-FamilleActive";
const LIBELLE_INACTIVE = "9I95-FamilleInactive";
const MARQUE = "9I95-Marque";
const REFERENCE = "9I95-Ref1";

const CODE_CREE = "9I95NOUV";
const LIBELLE_CREE = "9I95-FamilleNouvelle";
const LIBELLE_MODIFIE = "9I95-FamilleModifiee";
const MARQUE_CREE = "9I95-MarqueNouvelle";
const REFERENCE_CREE = "9I95-RefNouvelle";

test.beforeAll(async () => {
  const client = admin();
  try {
    const societe = await client.societe.findFirstOrThrow({
      where: { code: "CODIMA-NC" },
      select: { id: true },
    });
    await client.familleMateriel.create({
      data: {
        id: FAMILLE_ACTIVE,
        societe_id: societe.id,
        code: CODE_ACTIVE,
        libelle: LIBELLE_ACTIVE,
        actif: true,
      },
    });
    await client.familleMateriel.create({
      data: {
        id: FAMILLE_INACTIVE,
        societe_id: societe.id,
        code: CODE_INACTIVE,
        libelle: LIBELLE_INACTIVE,
        actif: false,
      },
    });
    await client.modeleMateriel.create({
      data: {
        id: MODELE,
        societe_id: societe.id,
        famille_id: FAMILLE_ACTIVE,
        marque: MARQUE,
        reference: REFERENCE,
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.modeleMateriel.deleteMany({
      where: { reference: { in: [REFERENCE, REFERENCE_CREE] } },
    });
    await client.familleMateriel.deleteMany({
      where: { code: { in: [CODE_ACTIVE, CODE_INACTIVE, CODE_CREE] } },
    });
  } finally {
    await client.$disconnect();
  }
});

async function connexionAdmin(page: Page): Promise<void> {
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
}

test("les deux onglets séparent familles et modèles, et l'onglet actif se lit dans l'URL", async ({
  page,
}) => {
  await connexionAdmin(page);
  await page.goto("/parametres/materiel");

  const nav = page.locator('nav[data-nav="materiel"]');
  await expect(
    nav.getByRole("link", { name: fr["materiel.familles"] }),
  ).toHaveAttribute("aria-current", "page");

  const tableFamilles = page.locator("table").first();
  await expect(
    tableFamilles.locator("tr", { hasText: LIBELLE_ACTIVE }),
  ).toHaveCount(1);

  await nav.getByRole("link", { name: fr["materiel.modeles"] }).click();
  await expect(page).toHaveURL(/\/parametres\/materiel\?onglet=modeles$/);
  await expect(
    nav.getByRole("link", { name: fr["materiel.modeles"] }),
  ).toHaveAttribute("aria-current", "page");

  const tableModeles = page.locator("table").first();
  await expect(tableModeles.locator("tr", { hasText: REFERENCE })).toHaveCount(
    1,
  );
});

test("la recherche filtre par code ou libellé, sans distinction de casse, et dit « aucun résultat »", async ({
  page,
}) => {
  await connexionAdmin(page);
  await page.goto("/parametres/materiel");

  await page
    .getByLabel(fr["materiel.recherche_familles"])
    .fill("familleactive");
  await page.getByRole("button", { name: fr["materiel.rechercher"] }).click();

  const table = page.locator("table").first();
  await expect(table.locator("tr", { hasText: LIBELLE_ACTIVE })).toHaveCount(1);
  await expect(table.locator("tr", { hasText: LIBELLE_INACTIVE })).toHaveCount(
    0,
  );

  await page.getByLabel(fr["materiel.recherche_familles"]).fill("zzz-aucune");
  await page.getByRole("button", { name: fr["materiel.rechercher"] }).click();
  await expect(
    page.getByText(fr["materiel.recherche_aucun_resultat_titre"]),
  ).toBeVisible();
});

test("le filtre d'activité montre les familles inactives seulement sur demande", async ({
  page,
}) => {
  await connexionAdmin(page);
  await page.goto("/parametres/materiel");

  const table = page.locator("table").first();
  await expect(table.locator("tr", { hasText: LIBELLE_INACTIVE })).toHaveCount(
    0,
  );

  await page.getByLabel(fr["materiel.activite"]).selectOption("tous");
  await expect(page).toHaveURL(/etat=tous/);
  await expect(table.locator("tr", { hasText: LIBELLE_INACTIVE })).toHaveCount(
    1,
  );
  await expect(table.locator("tr", { hasText: LIBELLE_ACTIVE })).toHaveCount(1);

  await page.getByLabel(fr["materiel.activite"]).selectOption("inactifs");
  await expect(page).toHaveURL(/etat=inactifs/);
  await expect(table.locator("tr", { hasText: LIBELLE_INACTIVE })).toHaveCount(
    1,
  );
  await expect(table.locator("tr", { hasText: LIBELLE_ACTIVE })).toHaveCount(0);
});

test("« Ajouter une famille » puis « Modifier » cette famille depuis le volet, valeur relue en base", async ({
  page,
}) => {
  await connexionAdmin(page);
  await page.goto("/parametres/materiel");

  await page.getByRole("link", { name: fr["materiel.creer_famille"] }).click();
  const volet = page.getByRole("dialog");
  await expect(
    volet.getByRole("heading", { name: fr["materiel.creer_famille"] }),
  ).toBeVisible();

  await volet.getByLabel(fr["materiel.code"]).fill(CODE_CREE);
  await volet.getByLabel(fr["materiel.libelle"]).fill(LIBELLE_CREE);
  await volet
    .getByRole("button", { name: fr["materiel.creer_action"] })
    .click();

  // 9K18A-MATERIEL-RETOUR-ONGLET — la ligne créée est repérée (`?ligne=`).
  await expect(page).toHaveURL(/\/parametres\/materiel\?ligne=/);
  const table = page.locator("table").first();
  await expect(table.locator("tr", { hasText: LIBELLE_CREE })).toHaveCount(1);

  const ligneCreee = table.locator("tr", { hasText: CODE_CREE });
  await ligneCreee.getByRole("link", { name: fr["materiel.modifier"] }).click();

  const voletModifier = page.getByRole("dialog");
  await expect(voletModifier.getByLabel(fr["materiel.code"])).toHaveValue(
    CODE_CREE,
  );
  await expect(voletModifier.getByLabel(fr["materiel.libelle"])).toHaveValue(
    LIBELLE_CREE,
  );

  await voletModifier.getByLabel(fr["materiel.libelle"]).fill(LIBELLE_MODIFIE);
  await voletModifier
    .getByRole("button", { name: fr["materiel.enregistrer"] })
    .click();

  await expect(page).toHaveURL(/\/parametres\/materiel\?ligne=/);
  await expect(table.locator("tr", { hasText: LIBELLE_MODIFIE })).toHaveCount(
    1,
  );
  await expect(table.locator("tr", { hasText: LIBELLE_CREE })).toHaveCount(0);
});

test("« Voir ses modèles » depuis une famille ouvre l'onglet Modèles filtré, « Tout afficher » l'enlève", async ({
  page,
}) => {
  await connexionAdmin(page);
  await page.goto("/parametres/materiel");

  const table = page.locator("table").first();
  const ligne = table.locator("tr", { hasText: LIBELLE_ACTIVE });
  await ligne.getByRole("link", { name: /modèle/ }).click();

  await expect(page).toHaveURL(
    new RegExp(
      `/parametres/materiel\\?onglet=modeles&famille=${FAMILLE_ACTIVE}$`,
    ),
  );
  await expect(
    page.getByRole("heading", { name: new RegExp(LIBELLE_ACTIVE) }),
  ).toBeVisible();
  const tableModeles = page.locator("table").first();
  await expect(tableModeles.locator("tr", { hasText: REFERENCE })).toHaveCount(
    1,
  );

  await page.getByRole("link", { name: fr["materiel.tout_afficher"] }).click();
  await expect(page).toHaveURL(/\/parametres\/materiel\?onglet=modeles$/);
  await expect(tableModeles.locator("tr", { hasText: REFERENCE })).toHaveCount(
    1,
  );
});

test("« Ajouter un modèle » depuis l'onglet Modèles — revient sur Modèles, pas sur Familles (9K18A, le cas d'Alexis)", async ({
  page,
}) => {
  await connexionAdmin(page);
  await page.goto("/parametres/materiel?onglet=modeles");

  await page.getByRole("link", { name: fr["materiel.creer_modele"] }).click();
  const volet = page.getByRole("dialog");
  await expect(
    volet.getByRole("heading", { name: fr["materiel.creer_modele"] }),
  ).toBeVisible();

  await volet
    .getByLabel(fr["materiel.famille"])
    .selectOption({ label: LIBELLE_ACTIVE });
  await volet.getByLabel(fr["materiel.marque"]).fill(MARQUE_CREE);
  await volet.getByLabel(fr["materiel.reference"]).fill(REFERENCE_CREE);
  await volet
    .getByRole("button", { name: fr["materiel.creer_action"] })
    .click();

  // 9K18A-MATERIEL-RETOUR-ONGLET — le MÊME onglet (Modèles), jamais Familles
  // (le défaut), et la ligne créée est repérée.
  await expect(page).toHaveURL(/\/parametres\/materiel\?onglet=modeles&ligne=/);
  const table = page.locator("table").first();
  await expect(table.locator("tr", { hasText: REFERENCE_CREE })).toHaveCount(1);
  await expect(table.locator("tr", { hasText: REFERENCE_CREE })).toHaveClass(
    /ligne-reperee-active/,
  );
});

test("un compte sans « parametrer_societe » complet ne voit aucun bouton d'écriture", async ({
  page,
}) => {
  await ouvrirUneSession(page);
  await page.goto("/parametres/materiel");

  await expect(
    page.getByRole("link", { name: fr["materiel.creer_famille"] }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: fr["materiel.modifier"] }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: fr["materiel.desactiver"] }),
  ).toHaveCount(0);

  const table = page.locator("table").first();
  await expect(
    table
      .locator("tr", { hasText: LIBELLE_ACTIVE })
      .getByText(fr["materiel.active"]),
  ).toBeVisible();

  await page.goto("/parametres/materiel?onglet=modeles");
  await expect(
    page.getByRole("link", { name: fr["materiel.creer_modele"] }),
  ).toHaveCount(0);
});

// LE SEGMENT ENTIER EST FERMÉ AU TECHNICIEN AVANT D'ATTEINDRE CETTE PAGE
// (D221, `app/(back-office)/layout.tsx`) — inchangé par ce lot : le refus
// nommé que ce fichier portait encore (`RefusAcces`, `session.contexte.role
// === Role.technicien`) n'est plus jamais atteint en pratique, exactement
// comme documenté dans `components/ui/refus-acces.tsx`. Ce test éprouve donc
// ce qui se passe RÉELLEMENT : la redirection vers `/terrain`.
test("un technicien reste refusé, inchangé — redirigé vers /terrain avant d'atteindre la page", async ({
  page,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
  await page.goto("/parametres/materiel");
  await expect(page).toHaveURL(/\/terrain/);
});
