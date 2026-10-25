import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";
import { DEFAUTS_TRAJET_ZONE } from "@/lib/sites/trajet-zone";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { ouvrirUneSession } from "./setup/session";

/**
 * 9G2B-FINITIONS-CARTES-375 — DEUX DÉFAUTS DE 9G2/9G2A À 375 PX.
 *
 * ## Le premier défaut : un identifiant en double sur `/parametres/trajets`
 *
 * `LigneZone` (tableau, masqué sous 900 px) et `CarteZone` (carte, masquée
 * au-dessus) rendaient chacune un `<input id="trajet-${zone}">` pour la MÊME
 * zone — à 375 px, le `<label>` de la carte VISIBLE visait l'input du
 * tableau MASQUÉ : le seul champ de l'écran perdait son nom accessible, et
 * le document portait un identifiant en double.
 *
 * ## Le second défaut : l'ancre `#modeles` morte sous 900 px
 *
 * `/parametres/materiel` posait `id="modeles"` sur la seule `<Carte>` du
 * tableau (`max-[900px]:hidden`) : les liens « N modèles » (même écran) et
 * « Décider » (`/vgp/a-determiner`) visent cette ancre, et sous 900 px elle
 * pointait sur un élément `display:none` — la navigation n'atterrissait
 * nulle part, et le titre de la carte comme le filtre « Tout afficher »
 * disparaissaient avec elle.
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `G2B-`
 *
 * Une famille matériel « à déterminer » et un modèle, créés en `beforeAll`,
 * effacés en `afterAll` — aucune ligne du semis n'est touchée (même
 * discipline que `visuel-2.spec.ts`).
 */
test.describe.configure({ mode: "serial" });

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

const FAMILLE = uuidv7();
const MODELE = uuidv7();
const CODE_FAMILLE = "G2BFAM";
const LIBELLE_FAMILLE = "G2B-Famille à déterminer";
const MARQUE = "G2B-Marque";
const REFERENCE = "G2B-Reference";

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  const client = admin();
  try {
    await client.familleMateriel.create({
      data: {
        id: FAMILLE,
        societe_id: reperes.societeId,
        code: CODE_FAMILLE,
        libelle: LIBELLE_FAMILLE,
      },
    });
    await client.modeleMateriel.create({
      data: {
        id: MODELE,
        societe_id: reperes.societeId,
        famille_id: FAMILLE,
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
    await client.modeleMateriel.deleteMany({ where: { famille_id: FAMILLE } });
    await client.familleMateriel.deleteMany({ where: { id: FAMILLE } });
  } finally {
    await client.$disconnect();
  }
});

/** Le compte des occurrences de chaque `id` du document. */
async function idsEnDouble(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const compte = new Map<string, number>();
    for (const element of document.querySelectorAll("[id]")) {
      const id = element.id;
      compte.set(id, (compte.get(id) ?? 0) + 1);
    }
    return [...compte.entries()].filter(([, n]) => n > 1).map(([id]) => id);
  });
}

test("à 375 px, le champ de réglage d'une zone a un nom accessible, et aucun id n'est dupliqué", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await ouvrirUneSession(page);
  await page.goto("/parametres/trajets");

  const defautCoteEst = DEFAUTS_TRAJET_ZONE.cote_est;
  if (defautCoteEst.nature !== "minutes") {
    throw new Error("La Côte Est doit admettre une estimation (D107).");
  }

  // Les deux présentations (tableau masqué, carte visible) rendent chacune
  // une instance du champ : la carte de la zone « Côte Est » se retrouve par
  // son libellé, et c'est EN SON SEIN que le champ et son `<label>` doivent
  // se répondre — la preuve que `htmlFor`/`id` ne visent plus l'input de
  // l'AUTRE présentation, masquée.
  const carteCoteEst = page
    .locator("li")
    .filter({ hasText: fr["zone.cote_est"] });
  const champ = carteCoteEst.locator("input[name=minutes]");
  await expect(champ).toBeVisible();
  await expect(champ).toHaveValue(String(defautCoteEst.minutes));

  const idChamp = await champ.getAttribute("id");
  expect(idChamp).not.toBeNull();
  const label = carteCoteEst.locator("label");
  await expect(label).toHaveAttribute("for", idChamp ?? "");
  // Le `<label>` cible CE champ par `for`/`id` ET porte un texte non vide :
  // la preuve que le champ a un nom accessible, sans recomposer ici le texte
  // du libellé (`etiquetteChamp`, dans l'écran, le fait déjà).
  const texteLabel = await label.innerText();
  expect(texteLabel.trim().length).toBeGreaterThan(0);

  expect(await idsEnDouble(page)).toEqual([]);
});

test("à 375 px, « Décider » depuis le registre amène à une section visible des modèles, filtrée, avec « Tout afficher »", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await ouvrirUneSession(page);
  await page.goto("/vgp/a-determiner");

  const carteFamille = page.locator("li").filter({ hasText: LIBELLE_FAMILLE });
  const lienDecider = carteFamille.getByRole("link", {
    name: fr["vgp.indetermines.decider"],
  });
  await expect(lienDecider).toBeVisible();
  await lienDecider.click();

  await expect(page).toHaveURL(
    new RegExp(`/parametres/materiel\\?famille=${FAMILLE}#modeles`),
  );

  const sectionModeles = page.locator("#modeles");
  await expect(sectionModeles).toBeVisible();

  const titreVisible = sectionModeles.locator(":visible", {
    hasText: LIBELLE_FAMILLE,
  });
  await expect(titreVisible.first()).toBeVisible();

  const lienToutAfficher = sectionModeles
    .getByRole("link", { name: fr["materiel.tout_afficher"] })
    .and(page.locator(":visible"));
  await expect(lienToutAfficher).toBeVisible();

  const carteModele = sectionModeles
    .locator("li", { hasText: REFERENCE })
    .and(page.locator(":visible"));
  await expect(carteModele.first()).toBeVisible();

  expect(await idsEnDouble(page)).toEqual([]);

  await lienToutAfficher.click();
  await expect(page).toHaveURL(/\/parametres\/materiel#modeles$/);
});
