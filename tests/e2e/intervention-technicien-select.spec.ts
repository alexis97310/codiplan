import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { jourSuivant } from "@/lib/calendar/fuseau";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { choisirPremierResultat } from "./setup/selecteur-recherche";
import {
  COMPTE_TECHNICIEN_EPREUVE,
  MARDI,
  MOT_DE_PASSE_EPREUVE,
  cleDeJour,
  jourDeLaScene,
} from "./setup/scene";
import { ouvrirUneSession } from "./setup/session";

/**
 * TROIS SEMAINES PLUS LOIN, ET C'EST UNE MESURE (PARCOURS-1) — le MARDI
 * ordinaire (`jourDeLaScene`) porte déjà les rendez-vous du semis pour
 * plusieurs techniciens ; +21 jours reste un mardi (multiple de 7), ouvert
 * comme le premier, mais hors de portée du semis et des autres scénarios de
 * ce fichier qui visent tous le même technicien.
 */
function mardiLoin(reperes: Awaited<ReturnType<typeof reperesDeLaScene>>) {
  return jourSuivant(jourDeLaScene(reperes, MARDI), 21);
}

/** Crée une intervention sans technicien ni date — le geste CRÉER (PARCOURS-1). */
async function creerUneIntervention(page: Page): Promise<void> {
  await page.goto("/interventions/nouvelle");
  await choisirPremierResultat(page, "site");
  await page
    .locator('textarea[name="description"]')
    .fill("Épreuve — sélecteur technicien");
  await page
    .getByRole("button", { name: fr["intervention.action.creer"] })
    .click();
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveURL(/\/interventions\/[0-9a-f-]+$/);
}

/**
 * PLANIFIE l'intervention ouverte avec le technicien d'option `option`, date
 * et durée plausibles — le geste PLANIFIER (PARCOURS-1), qui exige les
 * quatre valeurs ensemble. Rend le NOM affiché par l'option choisie.
 */
async function planifierAvecTechnicien(
  page: Page,
  option: number,
  // UNE HEURE DISTINCTE PAR APPELANT (PARCOURS-1) — chaque scénario de ce
  // fichier crée SA PROPRE intervention, mais tous visent le même technicien
  // (« la seconde option ») et le même jour (MARDI) : sans heures
  // distinctes, le second appel chevaucherait le premier et RG-PLA
  // refuserait un chevauchement réel, jamais une maladresse d'épreuve.
  heure: string,
): Promise<string> {
  const formulaire = page.locator("form", {
    has: page.getByRole("heading", {
      name: fr["intervention.action.planifier"],
    }),
  });
  const options = formulaire.locator('select[name="technicien_id"] option');
  await expect(options.nth(option)).toBeAttached();
  const nom = ((await options.nth(option).textContent()) ?? "").trim();
  const valeur = await options.nth(option).getAttribute("value");
  await formulaire
    .locator('select[name="technicien_id"]')
    .selectOption(valeur ?? "");
  const reperes = await reperesDeLaScene();
  const mardi = mardiLoin(reperes);
  await formulaire
    .locator('input[name="date_planifiee"]')
    .fill(cleDeJour(mardi));
  await formulaire.locator('input[name="heure_debut"]').fill(heure);
  await formulaire.locator('input[name="duree_min"]').fill("60");
  await formulaire
    .getByRole("button", { name: fr["intervention.action.planifier"] })
    .click();
  await page.waitForLoadState("networkidle");
  return nom;
}

/**
 * LE CHAMP TECHNICIEN, DE L'INPUT NU AU SÉLECTEUR DE NOMS (chantier TECH-1,
 * 20/09/2026).
 *
 * ## Le défaut que ce fichier mesure
 *
 * Trois occurrences d'un `<input type="text" name="technicien_id">` — la
 * création, et les DEUX formulaires de la fiche (« Affecter », « Déplacer »)
 * — demandaient de TAPER un UUID. Rien n'empêchait d'en inventer un, ni de
 * deviner celui d'un technicien qu'on n'a pas le droit de nommer (le
 * cloisonnement filtre ce que l'ANNUAIRE rend, pas ce qu'un formulaire
 * accepte de recevoir).
 *
 * Ce fichier éprouve les DEUX écrans touchés : la création, et le sélecteur
 * de la fiche (« Affecter »), qui a demandé une extension du composant
 * `Saisie` plutôt qu'un second champ.
 *
 * ## LE TROISIÈME SCÉNARIO — la LISTE n'est plus rendue à qui ne peut pas
 * affecter (revue Codex de la PR #267, 20/09/2026)
 *
 * *Mesuré : le champ — et la liste NOMINATIVE des techniciens qu'il
 * portait — était rendu à TOUTE session de société active, y compris un
 * technicien (accès restreint) qui y voyait ses collègues, et un compte
 * portail (`creer_demande` inclut le rôle client) qui pouvait la voir et
 * soumettre un `technicien_id`.* Le critère retenu est `qualifier_affecter`,
 * lu depuis la matrice (`lib/auth/habilitations.ts`), et un technicien ne
 * l'a pas.
 *
 * ## LE QUATRIÈME — la MÊME fuite existait sur la FICHE (extension de mon
 * initiative, 20/09/2026)
 *
 * Les DEUX sélecteurs de `/interventions/[id]` — « Affecter », « Déplacer » —
 * ont été introduits par ce même chantier, sur du code que cette revue
 * touchait déjà : ce n'était donc pas un défaut préexistant hors périmètre.
 * « Affecter » n'a qu'un champ, celui qui fuyait : un rôle sans
 * `qualifier_affecter` voit désormais l'action ENTIÈRE refusée, comme un
 * refus de statut. « Déplacer » garde trois champs utiles sans technicien
 * (date, heure, durée) : seul CE champ disparaît pour un rôle sans
 * `modifier_planning`.
 *
 * ## ADAPTÉ PAR PARCOURS-1 (23/09/2026, arbitrage Alexis)
 *
 * La création ne porte plus AUCUN technicien — *« ni la date, ni le
 * technicien affecté »* ne se décident plus à la création. Le technicien se
 * nomme désormais par le geste PLANIFIER, sur la fiche d'une intervention
 * `a_planifier`, qui remplace « Affecter » ET « Déplacer » pour ce statut-là
 * et exige les quatre valeurs ensemble. « Affecter » seul réapparaît une fois
 * l'intervention planifiée — c'est lui qui RÉAFFECTE, pas qui affecte la
 * première fois.
 */

async function utilisateurIdDuTechnicienDeLEpreuve(): Promise<string> {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    const utilisateur = await client.utilisateur.findFirstOrThrow({
      where: { email: COMPTE_TECHNICIEN_EPREUVE },
      select: { id: true },
    });
    return utilisateur.id;
  } finally {
    await client.$disconnect();
  }
}

async function ouvrirLaSessionDuTechnicien(page: Page): Promise<void> {
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(COMPTE_TECHNICIEN_EPREUVE);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await expect(page).toHaveURL(/\/arrivee/);
}

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

test("PLANIFIER affiche des NOMS de technicien, et affecte", async ({
  page,
}) => {
  await creerUneIntervention(page);
  const nomTechnicien = await planifierAvecTechnicien(page, 1, "08:00");
  expect(nomTechnicien.length).toBeGreaterThan(0);
  // Ce n'est PAS un identifiant technique (UUID) — c'est très exactement le
  // défaut que le chantier TECH-1 corrigeait, et que PLANIFIER hérite.
  expect(nomTechnicien).not.toMatch(/^[0-9a-f]{8}-[0-9a-f-]{27}$/i);

  // La fiche affiche le MÊME nom — jamais l'identifiant.
  await expect(
    page.locator("dd").filter({ hasText: nomTechnicien }),
  ).toBeVisible();
});

test("le sélecteur « Affecter » RÉAFFECTE une intervention déjà planifiée, par des NOMS", async ({
  page,
}) => {
  // Une intervention PLANIFIÉE d'abord — « Affecter » ne réapparaît qu'une
  // fois sortie de `a_planifier` (PARCOURS-1) : c'est PLANIFIER qui nomme la
  // première fois.
  await creerUneIntervention(page);
  await planifierAvecTechnicien(page, 1, "13:00");

  const formulaireAffecter = page.locator('form[action$="/affecter"]');
  await expect(formulaireAffecter).toBeVisible();
  const options = formulaireAffecter.locator(
    'select[name="technicien_id"] option',
  );
  // La PREMIÈRE option réelle (au-delà de l'option vide) — le même
  // technicien qui vient d'être planifié : ce scénario prouve que « Affecter »
  // liste des NOMS et affecte, pas que la personne change.
  await expect(options.nth(1)).toBeAttached();
  const nomTechnicien = ((await options.nth(1).textContent()) ?? "").trim();
  expect(nomTechnicien.length).toBeGreaterThan(0);
  expect(nomTechnicien).not.toMatch(/^[0-9a-f]{8}-[0-9a-f-]{27}$/i);
  const valeurTechnicien = await options.nth(1).getAttribute("value");

  await formulaireAffecter
    .locator('select[name="technicien_id"]')
    .selectOption(valeurTechnicien ?? "");
  await formulaireAffecter
    .getByRole("button", { name: fr["intervention.action.affecter"] })
    .click();
  await page.waitForLoadState("networkidle");

  // Scopé au `<dd>` de la fiche — les `<select>` « Affecter » et
  // « Déplacer » portent tous deux une `<option selected>` avec le MÊME
  // nom une fois le technicien affecté, et `getByText` seul violerait le
  // mode strict (plusieurs éléments correspondent au texte).
  await expect(
    page.locator("dd").filter({ hasText: nomTechnicien }),
  ).toBeVisible();
});

test("la création n'a PLUS AUCUN champ technicien, pour AUCUN rôle (PARCOURS-1)", async ({
  page,
}) => {
  // La session ADV du `beforeEach` est écartée : `/connexion` redirige tout
  // compte déjà authentifié vers `/arrivee` sans montrer le formulaire.
  await page.context().clearCookies();
  await ouvrirLaSessionDuTechnicien(page);

  await page.goto("/interventions/nouvelle");
  // `creer_demande` reste accessible à un technicien (matrice §5.2) : l'écran
  // se rend bel et bien, ce n'est PAS un refus de page.
  await expect(
    page.getByRole("button", { name: fr["intervention.action.creer"] }),
  ).toBeVisible();

  // AUCUN champ technicien — depuis PARCOURS-1, ce n'est plus une distinction
  // de rôle (`qualifier_affecter`) : PERSONNE ne décide du technicien à la
  // création, quel que soit son rôle. Le geste PLANIFIER, sur la fiche, est
  // désormais le seul endroit qui pose ce champ.
  await expect(page.locator('[name="technicien_id"]')).toHaveCount(0);
});

test("sur la FICHE d'un technicien, « Affecter » est refusé en entier et « Déplacer » perd son champ technicien", async ({
  page,
}) => {
  const utilisateurIdTechnicien = await utilisateurIdDuTechnicienDeLEpreuve();

  // Créée par l'ADV du `beforeEach`, puis PLANIFIÉE et affectée à CE
  // technicien précisément (PARCOURS-1 : le geste unique qui pose la date,
  // l'heure, la durée et le technicien ensemble) — sinon sa fiche lui serait
  // invisible (périmètre restreint, R5-01).
  await creerUneIntervention(page);
  const formulaire = page.locator("form", {
    has: page.getByRole("heading", {
      name: fr["intervention.action.planifier"],
    }),
  });
  await formulaire
    .locator('select[name="technicien_id"]')
    .selectOption(utilisateurIdTechnicien);
  const reperes = await reperesDeLaScene();
  const mardi = mardiLoin(reperes);
  await formulaire
    .locator('input[name="date_planifiee"]')
    .fill(cleDeJour(mardi));
  await formulaire.locator('input[name="heure_debut"]').fill("15:00");
  await formulaire.locator('input[name="duree_min"]').fill("60");
  await formulaire
    .getByRole("button", { name: fr["intervention.action.planifier"] })
    .click();
  await page.waitForLoadState("networkidle");
  // `?avertissement=…` PEUT SUIVRE (AVERTISSEMENTS-1) : la planification
  // prévient désormais le client et le technicien, et ce compte-rendu voyage
  // par ce même paramètre — sans rapport avec ce que CE scénario éprouve.
  await expect(page).toHaveURL(/\/interventions\/([0-9a-f-]+)(\?.*)?$/);
  const idIntervention = new URL(page.url()).pathname.split("/").pop();

  await page.context().clearCookies();
  await ouvrirLaSessionDuTechnicien(page);
  await page.goto(`/interventions/${idIntervention}`);

  // « AFFECTER » : l'action ENTIÈRE est refusée — jamais un champ vide.
  const formulaireAffecter = page.locator('form[action$="/affecter"]');
  await expect(formulaireAffecter).toHaveCount(0);
  await expect(
    page.getByText(fr["intervention.refus.qualification_requise"]),
  ).toBeVisible();

  // « DÉPLACER » reste utilisable — date, heure, durée —, mais SANS le champ
  // technicien ni sa liste nominative.
  const formulaireDeplacer = page.locator('form[action$="/deplacer"]');
  await expect(formulaireDeplacer).toBeVisible();
  await expect(
    formulaireDeplacer.locator('[name="technicien_id"]'),
  ).toHaveCount(0);
  await expect(
    formulaireDeplacer.locator('[name="date_planifiee"]'),
  ).toBeVisible();
});
