import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { fr } from "@/lib/i18n";
import { fermeAuTechnicienParD221 } from "@/lib/navigation/redirection-technicien";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { COMPTE_TECHNICIEN_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * 9G8F-DECLARATION-ABSENCE-FORMULAIRE-SEUL — LE DERNIER CHEMIN DE D221,
 * FERMÉ PAR LE CONTENU (suite de 9G8E-NAV-TECHNICIEN-SANS-ENTREES-BUREAU).
 *
 * 9G8E avait vidé le CHROME (barre, colonne, tiroir, menu « Créer ») des
 * liens qu'un technicien ne doit pas précharger — mais le CONTENU de
 * `/absences?declarer=1` restait la page bureau ENTIÈRE (tableau, cartes,
 * onglets, calendrier) avec le volet de déclaration ouvert par-dessus,
 * portant elle-même des `<Link>` vers des routes que D221 ferme (carte
 * « Planning », registre des interventions, fiches d'intervention). Décision
 * d'Alexis du 25/10/2026 : « formulaire seul » — ce rôle ne voit plus RIEN
 * d'autre que le formulaire.
 *
 * La MESURE directe (compter les `<a href>` de la page et les confronter à
 * `fermeAuTechnicienParD221`, la même fonction que `template.tsx`) est
 * délibérément préférée à un clic chronométré sur la fenêtre de préchargement
 * de `<Link>` (le bogue mesuré par 9G8D/9G8E) : un DOM qui ne porte aucun lien
 * fermé ne peut, par construction, jamais offrir cette fenêtre — et la carte
 * « Planning » que 9G8D mesurait n'existe plus du tout dans ce rendu.
 */

test.describe.configure({ mode: "serial" });

const DU = "2031-03-10";
const AU = "2031-03-11";

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

test.afterAll(async () => {
  const reperes = await reperesDeLaScene();
  const client = admin();
  try {
    await client.absence.deleteMany({
      where: {
        utilisateur_id: reperes.technicienDucos,
        du: new Date(`${DU}T00:00:00.000Z`),
      },
    });
  } finally {
    await client.$disconnect();
  }
});

/** Les hrefs de la page, hors ceux menant à `/terrain` — HORS du segment
 * `(back-office)` que D221 garde, jamais soumis à ce garde (voir le docblock
 * de `fermeAuTechnicienParD221`) ; fermer, annuler ou enregistrer y mènent
 * tous délibérément pour ce rôle. */
async function hrefsHorsTerrain(
  page: import("@playwright/test").Page,
): Promise<string[]> {
  const hrefs = await page
    .locator("a[href]")
    .evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("href") ?? ""),
    );
  return hrefs.filter((href) => {
    // LE LIEN D'ÉVITEMENT DU GABARIT (`#contenu`, `app/(back-office)/
    // layout.tsx`) EST UNE ANCRE DE PAGE, JAMAIS UNE NAVIGATION — hors du
    // domaine que `fermeAuTechnicienParD221` juge.
    if (href.startsWith("#")) {
      return false;
    }
    const url = new URL(href, "http://localhost");
    return !url.pathname.startsWith("/terrain");
  });
}

test("technicien — /absences?declarer=1 n'affiche que le formulaire : aucun lien vers une route fermée par D221", async ({
  page,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
  await page.goto("/absences?declarer=1");
  await expect(page.getByRole("dialog")).toBeVisible();

  const candidats = await hrefsHorsTerrain(page);
  const liensFermes = candidats.filter((href) => {
    const url = new URL(href, "http://localhost");
    return fermeAuTechnicienParD221(url.pathname, url.search.slice(1));
  });
  expect(liensFermes).toEqual([]);

  // AUCUN TABLEAU, AUCUNE CARTE, AUCUN ONGLET — le volet est tout ce que la
  // page rend.
  await expect(page.getByRole("table")).toHaveCount(0);
  await expect(page.getByRole("tablist")).toHaveCount(0);
});

test("technicien — déclare son absence de bout en bout (aperçu puis pose), et revient à /terrain", async ({
  page,
}) => {
  const reperes = await reperesDeLaScene();
  await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
  await page.goto("/absences?declarer=1");

  await page.locator("#absence-personne").selectOption(reperes.technicienDucos);
  await page.locator("#absence-du").fill(DU);
  await page.locator("#absence-au").fill(AU);
  await page
    .getByRole("button", { name: fr["absences.apercu_action"] })
    .click();
  await page.waitForLoadState("networkidle");

  // L'APERÇU PRÉSERVE `declarer=1` — sinon le second filet de D221 renvoie
  // déjà à `/terrain` ici, avant que l'impact n'ait jamais pu s'afficher.
  await expect(page).toHaveURL(/declarer=1/);
  await expect(page.getByRole("dialog")).toBeVisible();

  await page
    .getByRole("status")
    .getByRole("button", { name: fr["absences.declarer_action"] })
    .click();
  await expect(page).toHaveURL(/\/terrain$/);

  const verif = admin();
  try {
    const compte = await verif.absence.count({
      where: {
        utilisateur_id: reperes.technicienDucos,
        du: new Date(`${DU}T00:00:00.000Z`),
      },
    });
    expect(compte).toBe(1);
  } finally {
    await verif.$disconnect();
  }
});

test("technicien — annuler la déclaration (vrai clic) renvoie à /terrain, sans poser l'absence", async ({
  page,
}) => {
  const reperes = await reperesDeLaScene();
  await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
  await page.goto("/absences?declarer=1");

  await page.locator("#absence-personne").selectOption(reperes.technicienDucos);
  // UNE AUTRE PÉRIODE que l'épreuve de pose, bien distincte — pour ne pas lui
  // disputer la même ligne sous `fullyParallel`.
  await page.locator("#absence-du").fill("2031-04-20");
  await page.locator("#absence-au").fill("2031-04-21");
  await page
    .getByRole("button", { name: fr["absences.apercu_action"] })
    .click();
  await page.waitForLoadState("networkidle");

  await page
    .getByRole("status")
    .getByRole("link", { name: fr["absences.annuler"] })
    .click();
  await expect(page).toHaveURL(/\/terrain$/);

  const verif = admin();
  try {
    const compte = await verif.absence.count({
      where: {
        utilisateur_id: reperes.technicienDucos,
        du: new Date("2031-04-20T00:00:00.000Z"),
      },
    });
    expect(compte).toBe(0);
  } finally {
    await verif.$disconnect();
  }
});
