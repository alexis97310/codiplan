import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { referenceAffichee } from "@/app/(back-office)/interventions/presentation";
import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";
import { fermeAuTechnicienParD221 } from "@/lib/navigation/redirection-technicien";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { COMPTE_TECHNICIEN_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible, ouvrirUneSession } from "./setup/session";

/**
 * 9G8G-DECLARATION-SANS-LIEN-BUREAU — FIN DE D221 SUR LA DÉCLARATION
 * D'ABSENCE (suite de 9G8F-DECLARATION-ABSENCE-FORMULAIRE-SEUL).
 *
 * 9G8F mesurait l'absence de lien fermé AVANT l'aperçu, et déclarait sur une
 * période de 2031 sans aucune intervention : l'aperçu ne portait donc jamais
 * les liens de `ListeLiensInterventions` (`app/(back-office)/absences/
 * page.tsx`), qui visaient `/interventions/<id>` — une route que D221 ferme
 * au technicien. Ce fichier pose SA PROPRE intervention, affectée au même
 * technicien, sur une période déclarée, et mesure APRÈS l'aperçu.
 *
 * Même mesure directe que 9G8F (confronter les `<a href>` du DOM à
 * `fermeAuTechnicienParD221`) plutôt qu'un clic chronométré sur la fenêtre de
 * préchargement — voir son en-tête.
 */

test.describe.configure({ mode: "serial" });

const DU = "2031-06-10";
const AU = "2031-06-11";
const JOUR_INTERVENTION = "2031-06-10";

let intervention9g8g = "";

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

/** La référence affichée, LUE depuis la même fonction que l'écran (I10). */
function reference(id: string): string {
  return referenceAffichee({ id, numero: null, annee: null });
}

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  const client = admin();
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "DUCOS" },
      select: { id: true },
    });
    const site = await client.site.findFirstOrThrow({
      where: { societe_id: reperes.societeId, agence_id: agence.id },
      select: { id: true, client_id: true },
      orderBy: { libelle: "asc" },
    });
    const posee = await client.intervention.create({
      data: {
        id: uuidv7(),
        societe_id: reperes.societeId,
        agence_id: agence.id,
        client_id: site.client_id,
        site_id: site.id,
        technicien_id: reperes.technicienDucos,
        type: "curatif",
        priorite: "p3",
        statut: "planifiee",
        duree_estimee_min: 60,
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
        date_planifiee: new Date(`${JOUR_INTERVENTION}T00:00:00.000Z`),
      },
      select: { id: true },
    });
    intervention9g8g = posee.id;
  } finally {
    await client.$disconnect();
  }
});

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
    if (intervention9g8g !== "") {
      await client.intervention.deleteMany({
        where: { id: intervention9g8g },
      });
    }
  } finally {
    await client.$disconnect();
  }
});

/** Les hrefs de la page, hors ceux menant à `/terrain` — même filet que 9G8F. */
async function hrefsHorsTerrain(page: Page): Promise<string[]> {
  const hrefs = await page
    .locator("a[href]")
    .evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("href") ?? ""),
    );
  return hrefs.filter((href) => {
    if (href.startsWith("#")) {
      return false;
    }
    const url = new URL(href, "http://localhost");
    return !url.pathname.startsWith("/terrain");
  });
}

test("technicien — l'aperçu d'une absence qui touche une intervention affectée ne porte aucun lien vers une route fermée par D221", async ({
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

  const panneauImpact = page.getByRole("status");
  await expect(panneauImpact).toContainText(reference(intervention9g8g));

  const candidats = await hrefsHorsTerrain(page);
  const liensFermes = candidats.filter((href) => {
    const url = new URL(href, "http://localhost");
    return fermeAuTechnicienParD221(url.pathname, url.search.slice(1));
  });
  expect(liensFermes).toEqual([]);

  // LA RÉFÉRENCE EST UN LIEN VERS LA FICHE TERRAIN — jamais perdue par le
  // retrait du lien bureau, l'intervention lui étant affectée.
  await expect(
    panneauImpact.getByRole("link", { name: reference(intervention9g8g) }),
  ).toHaveAttribute("href", `/terrain/${intervention9g8g}`);
});

test("technicien — ni le bouton de recherche globale ni ses raccourcis ne sont présents sur /absences?declarer=1", async ({
  page,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
  await page.goto("/absences?declarer=1");
  await expect(page.getByRole("dialog")).toBeVisible();

  await expect(
    page.getByRole("button", { name: fr["recherche.indice"] }),
  ).toHaveCount(0);
  await expect(page.getByPlaceholder(fr["recherche.indice"])).toHaveCount(0);

  await page.keyboard.press("Control+k");
  await expect(
    page.getByRole("dialog", { name: fr["nav.rechercher"] }),
  ).toHaveCount(0);

  // LE VOLET DE DÉCLARATION, SEUL DIALOGUE DU RÔLE, RESTE EN PLACE — la
  // frappe ci-dessus ne devait rien y changer.
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("bureau — la recherche globale reste rendue et active (rôle inchangé, D221)", async ({
  page,
}) => {
  await ouvrirUneSession(page);

  await expect(
    page.getByRole("button", { name: fr["recherche.indice"] }),
  ).toHaveCount(1);
});
