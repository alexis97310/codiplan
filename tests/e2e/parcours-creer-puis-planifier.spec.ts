import { PrismaClient } from "@prisma/client";
import { expect, test, type Locator, type Page } from "@playwright/test";

import { jourSuivant } from "@/lib/calendar/fuseau";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { glisser } from "./setup/glisser";
import { reperesDeLaScene } from "./setup/reperes";
import { MARDI, cleDeJour, jourDeLaScene } from "./setup/scene";
import { ouvrirUneSession } from "./setup/session";

/**
 * PARCOURS-1 — CRÉER UNE DEMANDE, PUIS PLANIFIER : DEUX GESTES, DANS CET
 * ORDRE (23/09/2026, arbitrage Alexis).
 *
 * > *« Lors de la création d'intervention, on ne peut pas décider ni de la
 * > date d'intervention, ni du technicien affecté : il doit y avoir un ordre
 * > précis — Créer demande d'intervention → Planifier et qualifier
 * > l'intervention. »*
 *
 * Ce fichier éprouve LE PARCOURS, à travers l'écran :
 *
 *   1. CRÉER ne porte ni date, ni heure, ni technicien — seulement le lieu, la
 *      panne signalée (obligatoire) et au plus une machine. L'intervention
 *      née est `a_planifier`, et paraît dans la file d'attente du planning.
 *   2. PLANIFIER exige les QUATRE valeurs — date, heure, durée, technicien —
 *      ENSEMBLE : incomplet, il refuse en nommant ce qui manque ; complet, il
 *      accepte et l'intervention paraît dans la grille de la vue jour.
 *   3. LE GLISSER-DÉPOSER D'UNE CARTE « À PLANIFIER » N'EST PAS UN
 *      CONTOURNEMENT : déposée sur une case de la vue semaine — qui ne porte
 *      ni heure ni durée —, la même règle refuse, avec la MÊME route que le
 *      formulaire de la fiche (R2-19, « même route, même décision »).
 */

test.describe.configure({ mode: "serial" });

async function siteDeDucos(
  ordre: "asc" | "desc" = "asc",
): Promise<{
  readonly siteId: string;
  readonly clientId: string;
}> {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    const societe = await client.societe.findFirstOrThrow({
      where: { code: "CODIMA-NC" },
      select: { id: true },
    });
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societe.id, code: "DUCOS" },
      select: { id: true },
    });
    const site = await client.site.findFirstOrThrow({
      where: {
        societe_id: societe.id,
        agence_id: agence.id,
        client: { actif: true },
      },
      select: { id: true, client_id: true },
      orderBy: { libelle: ordre },
    });
    return { siteId: site.id, clientId: site.client_id };
  } finally {
    await client.$disconnect();
  }
}

function formulairePlanifier(page: Page): Locator {
  return page.locator("form", {
    has: page.getByRole("heading", {
      name: fr["intervention.action.planifier"],
    }),
  });
}

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

test("CRÉER ne demande ni date, ni heure, ni technicien — seulement le lieu et la panne", async ({
  page,
}) => {
  const { siteId, clientId } = await siteDeDucos();
  await page.goto("/interventions/nouvelle");

  // LES CHAMPS RETIRÉS N'EXISTENT PLUS DU TOUT (PARCOURS-1).
  await expect(page.locator('input[name="date_planifiee"]')).toHaveCount(0);
  await expect(page.locator('[name="technicien_id"]')).toHaveCount(0);
  await expect(page.locator('input[name="creneau_debut"]')).toHaveCount(0);

  // LA PANNE EST OBLIGATOIRE : soumettre sans elle est refusé par le
  // navigateur lui-même (`required`), et par le serveur si on le contourne.
  await page
    .locator('select[name="site"]')
    .selectOption(`${clientId}:${siteId}`);
  const panne = page.locator('textarea[name="description"]');
  await expect(panne).toHaveAttribute("required", "");

  await panne.fill("Le compresseur ne démarre plus — épreuve PARCOURS-1");
  await page
    .getByRole("button", { name: fr["intervention.action.creer"] })
    .click();
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveURL(/\/interventions\/[0-9a-f-]+$/);

  // LE STATUT RÉSULTANT EST « À PLANIFIER », et la fiche le dit.
  await expect(
    page.locator("dd", { hasText: fr["statut.a_planifier"] }).first(),
  ).toBeVisible();

  // ELLE PARAÎT DANS LA FILE D'ATTENTE DU PLANNING.
  const id = new URL(page.url()).pathname.split("/").pop();
  await page.goto("/planning");
  await expect(page.locator(`[data-bloc="${id}"]`)).toBeVisible();
});

test("PLANIFIER refuse sans les quatre valeurs, nomme ce qui manque, et accepte complet", async ({
  page,
}) => {
  // SA PROPRE SCÈNE, LE SITE (REPRISE-3, mesuré) — `siteDeDucos()` en ordre
  // ASCENDANT rend le PREMIER site visible de tout l'écran `/sites`, exactement
  // celui que `premierLieu()` (`tests/e2e/habilitations.spec.ts`) ouvre pour
  // EXIGER puis RETIRER une habilitation. Mesuré en tête de cette REPRISE : la
  // planification refusait avec « Ce technicien ne détient pas les
  // habilitations exigées ici » — le technicien pris (`options.first()`) ne
  // détenait pas l'habilitation qu'`habilitations.spec.ts` venait de poser sur
  // ce MÊME site, sous `fullyParallel`, avant de la retirer. L'ordre DESCENDANT
  // vise le second site Ducos (« Atelier sous contrat (démonstration) »),
  // qu'aucun autre scénario du dépôt ne touche.
  const { siteId, clientId } = await siteDeDucos("desc");
  await page.goto("/interventions/nouvelle");
  await page
    .locator('select[name="site"]')
    .selectOption(`${clientId}:${siteId}`);
  await page
    .locator('textarea[name="description"]')
    .fill("Épreuve PARCOURS-1 — planifier");
  await page
    .getByRole("button", { name: fr["intervention.action.creer"] })
    .click();
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveURL(/\/interventions\/[0-9a-f-]+$/);

  const formulaire = formulairePlanifier(page);
  await expect(formulaire).toBeVisible();
  // LES QUATRE CHAMPS SONT MARQUÉS OBLIGATOIRES.
  await expect(
    formulaire.locator('input[name="date_planifiee"]'),
  ).toHaveAttribute("required", "");
  await expect(formulaire.locator('input[name="heure_debut"]')).toHaveAttribute(
    "required",
    "",
  );
  await expect(formulaire.locator('input[name="duree_min"]')).toHaveAttribute(
    "required",
    "",
  );
  await expect(
    formulaire.locator('select[name="technicien_id"]'),
  ).toHaveAttribute("required", "");

  // ── REFUS : la date et l'heure sont données, la durée et le technicien
  // manquent — contourner le `required` du navigateur pour éprouver le
  // REFUS DU SERVEUR, pas seulement l'ergonomie du formulaire.
  //
  // SA PROPRE SCÈNE, LA DATE (REPRISE-3) — mesure secondaire, par prudence :
  // le MARDI ordinaire est aussi celui que `captures-parcours-1.spec.ts`
  // (09:00) écrit sur le même site Ducos. +49 jours (multiple de 7, donc
  // encore un mardi) reste à l'écart des décalages déjà pris par les
  // fichiers voisins (0, +21, +35, +63 — voir plus bas dans ce même
  // fichier). La cause RÉELLE, mesurée, de l'instabilité était le SITE
  // partagé (voir le commentaire au-dessus de `siteDeDucos("desc")`),
  // pas la date — mais un site ISOLÉ à une date qui ne l'est pas resterait
  // fragile au premier fichier qui s'y ajouterait.
  const reperes = await reperesDeLaScene();
  const mardi = jourSuivant(jourDeLaScene(reperes, MARDI), 49);
  await formulaire
    .locator('input[name="date_planifiee"]')
    .fill(cleDeJour(mardi));
  await formulaire.locator('input[name="heure_debut"]').fill("11:00");
  await formulaire.evaluate((form) => {
    for (const nom of ["duree_min", "technicien_id"]) {
      const champ = form.querySelector(`[name="${nom}"]`);
      champ?.removeAttribute("required");
    }
  });
  await formulaire
    .getByRole("button", { name: fr["intervention.action.planifier"] })
    .click();
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveURL(
    /\/interventions\/[0-9a-f-]+\?motif=intervention\.refus\.planification_duree_manquante/,
  );
  await expect(page.getByRole("status")).toContainText(
    fr["intervention.refus.planification_duree_manquante"],
  );
  // L'INTERVENTION EST TOUJOURS « À PLANIFIER » — le refus est réel.
  await expect(
    page.locator("dd", { hasText: fr["statut.a_planifier"] }).first(),
  ).toBeVisible();

  // ── ACCEPTE, complet ─────────────────────────────────────────────────────
  const formulaireComplet = formulairePlanifier(page);
  await formulaireComplet
    .locator('input[name="date_planifiee"]')
    .fill(cleDeJour(mardi));
  await formulaireComplet.locator('input[name="heure_debut"]').fill("11:00");
  await formulaireComplet.locator('input[name="duree_min"]').fill("60");
  const options = formulaireComplet.locator(
    'select[name="technicien_id"] option:not([value=""])',
  );
  await expect(options.first()).toBeAttached();
  const technicien = await options.first().getAttribute("value");
  await formulaireComplet
    .locator('select[name="technicien_id"]')
    .selectOption(technicien ?? "");
  await formulaireComplet
    .getByRole("button", { name: fr["intervention.action.planifier"] })
    .click();
  // LE SIGNAL DE FIN RÉEL (REPRISE-3) — `networkidle` seul ne garantit pas
  // que le rafraîchissement serveur a atteint le DOM : l'apparition du
  // formulaire « Affecter » EST la preuve que la planification a réussi et
  // que l'écran a fini de se redessiner. On l'attend avant d'affirmer la
  // disparition du formulaire « Planifier », plutôt que de les vérifier dans
  // le même instant.
  await expect(page.locator('form[action$="/affecter"]')).toBeVisible();

  const id = new URL(page.url()).pathname.split("/").pop();
  // LE STATUT N'EST PLUS « À PLANIFIER », et le bloc « Planifier » a disparu
  // au profit d'« Affecter »/« Déplacer ».
  await expect(formulairePlanifier(page)).toHaveCount(0);

  // ELLE PARAÎT DANS LA GRILLE DE LA VUE JOUR, au jour planifié.
  await page.goto(`/planning?vue=jour&jour=${cleDeJour(mardi)}`);
  await expect(page.locator(`[data-bloc="${id}"]`)).toBeVisible();
});

test("le glisser-déposer d'une carte « à planifier » n'est pas un contournement", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const { siteId, clientId } = await siteDeDucos();
  const reperes = await reperesDeLaScene();
  // NEUF SEMAINES PLUS LOIN, ET C'EST UNE MESURE — le MARDI ordinaire porte
  // déjà les rendez-vous posés par le scénario voisin de ce même fichier
  // (« PLANIFIER refuse... », 11:00), et `intervention-technicien-select.
  // spec.ts` réserve pour les siens le mardi +21 jours (même raisonnement,
  // même fichier voisin) : la case grandit avec ce qu'elle contient, et une
  // case gonflée par d'autres blocs peut déborder du haut de la page une fois
  // défilée vers la carte source, plus haut. +63 jours reste un mardi
  // (multiple de 7), ouvert comme le premier, mais VIDE de tout scénario de
  // ce dépôt.
  const mardi = jourSuivant(jourDeLaScene(reperes, MARDI), 63);

  // Une intervention À PLANIFIER, créée par le formulaire.
  await page.goto("/interventions/nouvelle");
  await page
    .locator('select[name="site"]')
    .selectOption(`${clientId}:${siteId}`);
  await page
    .locator('textarea[name="description"]')
    .fill("Épreuve PARCOURS-1 — glisser-déposer");
  await page
    .getByRole("button", { name: fr["intervention.action.creer"] })
    .click();
  await page.waitForLoadState("networkidle");
  const id = new URL(page.url()).pathname.split("/").pop();

  // LA VUE SEMAINE NE PORTE NI HEURE NI DURÉE — un dépôt là-dessus ne peut
  // donc jamais réunir les quatre valeurs que PLANIFIER exige. LA CASE VISÉE
  // EST CELLE DU MARDI, DE LA PREMIÈRE PERSONNE DE LA GRILLE — peu importe
  // laquelle, seule la règle est en jeu ; viser la première ligne la garde
  // proche du haut de page quel que soit le nombre d'interventions déjà
  // posées par d'autres scénarios (§9, 01/09 : un scénario ne doit pas
  // dépendre d'une position que la donnée déplace).
  // LA SEMAINE VISÉE EST CELLE DU MARDI LOINTAIN, PAS LA SEMAINE COURANTE —
  // sans `?semaine=`, `/planning` affiche la semaine d'aujourd'hui, où la
  // case du mardi lointain n'existe pas.
  const lundiVise = jourSuivant(mardi, -1);
  await page.goto(`/planning?vue=semaine&semaine=${cleDeJour(lundiVise)}`);
  const carte = page.locator(`[data-bloc="${id}"]`);
  await expect(carte).toBeVisible();
  const caseCible = page
    .locator(`td[data-depot-jour="${cleDeJour(mardi)}"][data-depot-technicien]`)
    .first();
  await expect(caseCible).toBeAttached();

  await glisser(page, carte, caseCible);

  // LE REFUS S'AFFICHE — la carte reste dans la file d'attente, jamais
  // silencieusement « planifiée » à moitié.
  const refus = page.locator("[data-refus]");
  await expect(refus).toBeVisible();
  await expect(refus).toHaveAttribute(
    "data-refus",
    "intervention.refus.planification_duree_manquante",
  );
  await expect(
    page
      .locator('[data-maquette-bloc="cartes-dossier-file"]')
      .locator(`[data-bloc="${id}"]`),
  ).toBeVisible();
});
