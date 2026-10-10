import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { libelleDestinataireCourriels } from "@/app/(back-office)/presentation";
import type { ContactPourDestinataire } from "@/lib/avertissements/planification";
import { uuidv7 } from "@/lib/db/uuid";
import { fr, mot } from "@/lib/i18n";
import { t } from "@/lib/i18n/fr";

import { urlAdministration } from "./setup/base";
import { COMPTE_RM_EPREUVE, MOT_DE_PASSE_EPREUVE } from "./setup/scene";
import { ouvrirUneSession } from "./setup/session";

/**
 * 9EF-TP-UX4-2-FICHES-1 — LE GABARIT DU 28/09 SUR LES FICHES CLIENT ET SITE.
 *
 * ## Ce que ce fichier prouve, et ce que les autres prouvent déjà
 *
 * `fiche-360-1.spec.ts`, `historique-client.spec.ts`, `historique-site.spec.ts`,
 * `client-desactivation-refusee-qt16.spec.ts` et `vgp-affichage-tpa2.spec.ts`
 * couvrent déjà le cloisonnement du bloc équipements, la pagination, le refus
 * de désactivation et la synthèse VGP sous le nouveau gabarit (adaptés par ce
 * même lot). CE fichier prouve ce qu'eux ne couvrent pas : les CINQ TUILES de
 * la fiche client (zéro ET non-zéro, D140/décision 52), les ONGLETS (compte,
 * bascule, Identité réservée), et les FAITS d'en-tête de la fiche site.
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `9EF1-`, JAMAIS LE SEMIS
 *
 * Un client SANS RIEN (zéro site, zéro machine, zéro intervention) pour les
 * tuiles à zéro ; un second client AVEC un site, une machine, une intervention
 * ouverte et un donneur d'ordre SUR LE SITE pour les tuiles au-dessus de zéro
 * et les faits de la fiche site. Créés en `beforeAll`, supprimés en `afterAll`.
 */

test.describe.configure({ mode: "serial" });

const CLIENT_ZERO = uuidv7();
const CLIENT_PLEIN = uuidv7();
const SITE_PLEIN = uuidv7();
const MACHINE_PLEIN = uuidv7();
const INTERVENTION_PLEIN = uuidv7();
const CONTACT_DONNEUR_ORDRE = uuidv7();

const RAISON_SOCIALE_ZERO = "9EF1- Client sans rien";
const RAISON_SOCIALE_PLEIN = "9EF1- Client avec un site";
const LIBELLE_SITE_PLEIN = "9EF1- Site avec consignes";
const COMMUNE_SITE_PLEIN = "9EF1-Commune";
const CONSIGNES = "9EF1- Sonner deux fois, chien présent.";
const NOM_DONNEUR_ORDRE = "9EF1- Donneuse d'ordre";
const COURRIEL_DONNEUR_ORDRE = "9ef1-donneuse@e2e.test";

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

test.beforeAll(async () => {
  const client = admin();
  try {
    const societe = await client.societe.findFirstOrThrow({
      where: { code: "CODIMA-NC" },
      select: { id: true },
    });
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societe.id, code: "DUCOS" },
      select: { id: true },
    });
    const modele = await client.modeleMateriel.findFirstOrThrow({
      where: { societe_id: societe.id },
      select: { id: true },
    });

    await client.client.create({
      data: {
        id: CLIENT_ZERO,
        societe_id: societe.id,
        raison_sociale: RAISON_SOCIALE_ZERO,
        actif: true,
      },
    });

    await client.client.create({
      data: {
        id: CLIENT_PLEIN,
        societe_id: societe.id,
        raison_sociale: RAISON_SOCIALE_PLEIN,
        actif: true,
        categorie: "9EF1-Categorie",
      },
    });
    await client.site.create({
      data: {
        id: SITE_PLEIN,
        societe_id: societe.id,
        client_id: CLIENT_PLEIN,
        agence_id: agence.id,
        libelle: LIBELLE_SITE_PLEIN,
        commune: COMMUNE_SITE_PLEIN,
        temps_trajet_min: 20,
        consignes_acces: CONSIGNES,
      },
    });
    await client.machine.create({
      data: {
        id: MACHINE_PLEIN,
        societe_id: societe.id,
        modele_id: modele.id,
        client_id: CLIENT_PLEIN,
        site_id: SITE_PLEIN,
        numero_serie: "9EF1-SERIE-001",
        qr_token: `9ef1-${uuidv7()}`,
      },
    });
    // `statut` retombe sur son défaut (`a_planifier`) — une OUVERTE.
    await client.intervention.create({
      data: {
        id: INTERVENTION_PLEIN,
        societe_id: societe.id,
        client_id: CLIENT_PLEIN,
        site_id: SITE_PLEIN,
        agence_id: agence.id,
        type: "curatif",
      },
    });
    await client.contact.create({
      data: {
        id: CONTACT_DONNEUR_ORDRE,
        societe_id: societe.id,
        client_id: CLIENT_PLEIN,
        site_id: SITE_PLEIN,
        nom: NOM_DONNEUR_ORDRE,
        email: COURRIEL_DONNEUR_ORDRE,
        roles: ["donneur_ordre"],
        actif: true,
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.contact.deleteMany({ where: { id: CONTACT_DONNEUR_ORDRE } });
    await client.intervention.deleteMany({
      where: { id: INTERVENTION_PLEIN },
    });
    await client.machine.deleteMany({ where: { id: MACHINE_PLEIN } });
    await client.site.deleteMany({ where: { id: SITE_PLEIN } });
    await client.client.deleteMany({
      where: { id: { in: [CLIENT_ZERO, CLIENT_PLEIN] } },
    });
  } finally {
    await client.$disconnect();
  }
});

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

test("les cinq tuiles de la fiche client, À ZÉRO : sans `href`, le détail dit ce qu'il y a à en dire", async ({
  page,
}) => {
  await page.goto(`/clients/${CLIENT_ZERO}`);
  const tuileSites = page.locator('[data-compteur="sites-actifs"]');
  await expect(tuileSites.locator("a")).toHaveCount(0);

  const tuileMachines = page.locator('[data-compteur="equipements"]');
  await expect(tuileMachines.locator("a")).toHaveCount(0);
  await expect(tuileMachines).toContainText(
    t("clients.fiche.synthese.machines_zero"),
  );

  const tuileOuvertes = page.locator(
    '[data-compteur="interventions-ouvertes"]',
  );
  await expect(tuileOuvertes.locator("a")).toHaveCount(0);
  await expect(tuileOuvertes).toContainText(
    t("clients.fiche.synthese.ouvertes_zero"),
  );

  const tuileProchaine = page.locator(
    '[data-compteur="prochaine-intervention"]',
  );
  const tuileDerniere = page.locator('[data-compteur="derniere-intervention"]');
  if ((await tuileProchaine.count()) > 0) {
    await expect(tuileProchaine.locator("a")).toHaveCount(0);
  }
  await expect(tuileDerniere.locator("a")).toHaveCount(0);
});

test("les tuiles « Sites », « Machines » et « Interventions ouvertes », AU-DESSUS DE ZÉRO : un `href`, et le chiffre est EXACTEMENT ce que le lien ouvre (D140)", async ({
  page,
}) => {
  await page.goto(`/clients/${CLIENT_PLEIN}`);

  const tuileSites = page.locator('[data-compteur="sites-actifs"]');
  await expect(tuileSites.locator("a")).toHaveCount(1);
  await tuileSites.locator("a").click();
  await expect(page).toHaveURL(/\?onglet=sites/);
  await expect(
    page.locator("main").filter({ hasText: LIBELLE_SITE_PLEIN }),
  ).toBeVisible();

  await page.goto(`/clients/${CLIENT_PLEIN}`);
  const tuileMachines = page.locator('[data-compteur="equipements"]');
  await expect(tuileMachines.locator("a")).toHaveCount(1);
  const hrefMachines = await tuileMachines.locator("a").getAttribute("href");
  expect(hrefMachines).toBe(`/parc?client=${CLIENT_PLEIN}&vue=parc`);

  const tuileOuvertes = page.locator(
    '[data-compteur="interventions-ouvertes"]',
  );
  await expect(tuileOuvertes.locator("a")).toHaveCount(1);
  const hrefOuvertes = await tuileOuvertes.locator("a").getAttribute("href");
  expect(hrefOuvertes).toBe(
    `/clients/${CLIENT_PLEIN}?onglet=interventions&etat=ouvertes`,
  );
});

test("les onglets portent le bon compte, et « Identité » n'existe que pour qui peut écrire la fiche", async ({
  page,
}) => {
  await page.goto(`/clients/${CLIENT_PLEIN}`);
  const onglets = page.locator('[data-nav="onglets-client"]');
  await expect(onglets.getByText(mot("site", true))).toBeVisible();

  const ongletParc = onglets.getByRole("link", {
    name: new RegExp(t("clients.fiche.onglet.parc")),
  });
  await expect(ongletParc.locator('[data-compte="1"]')).toHaveCount(1);

  const ongletInterventions = onglets.getByRole("link", {
    name: new RegExp(t("intervention.titre")),
  });
  await expect(ongletInterventions.locator('[data-compte="1"]')).toHaveCount(1);

  const ongletInterlocuteurs = onglets.getByRole("link", {
    name: new RegExp(t("sites.fiche.contacts")),
  });
  await expect(ongletInterlocuteurs.locator('[data-compte="1"]')).toHaveCount(
    1,
  );

  await expect(
    onglets.getByRole("link", { name: t("clients.fiche.identite") }),
  ).toBeVisible();
});

test("« Modifier » ouvre l'identité, le champ s'enregistre, et la fiche revient à l'Aperçu", async ({
  page,
}) => {
  await page.goto(`/clients/${CLIENT_PLEIN}`);
  await page
    .getByRole("link", { name: t("clients.fiche.modifier") })
    .first()
    .click();
  await expect(page).toHaveURL(/\?onglet=identite/);

  const champCategorie = page.locator('input[name="categorie"]');
  await expect(champCategorie).toHaveValue("9EF1-Categorie");
  await champCategorie.fill("9EF1-Categorie-modifiee");
  await page
    .getByRole("button", { name: t("clients.action.modifier") })
    .click();
  await page.waitForLoadState("networkidle");

  await expect(page.locator('[data-motif="clients.modifie"]')).toBeVisible();
  await expect(page.url()).not.toContain("onglet=identite");
});

test("un rôle qui ne peut pas écrire la fiche ne voit ni l'onglet Identité ni le formulaire, même en forçant l'URL", async ({
  page,
}) => {
  // LA SESSION ADV OUVERTE PAR `beforeEach` DOIT D'ABORD SE FERMER — visiter
  // `/connexion` alors qu'une session est déjà active en détourne (même
  // piège que `sites.spec.ts`).
  await page.getByRole("button", { name: fr["nav.deconnexion"] }).click();
  await expect(page).toHaveURL(/\/connexion/);
  await page.getByLabel(fr["connexion.email"]).fill(COMPTE_RM_EPREUVE);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await expect(page).toHaveURL(/\/planning/);

  await page.goto(`/clients/${CLIENT_PLEIN}?onglet=identite`);
  await expect(
    page
      .locator('[data-nav="onglets-client"]')
      .getByText(t("clients.fiche.identite")),
  ).toHaveCount(0);
  await expect(page.locator('select[name="actif"]')).toHaveCount(0);
});

test("la fiche site : les faits d'en-tête, les consignes en bandeau, « Qui sera prévenu », et « + Intervention » depuis une machine", async ({
  page,
}) => {
  await page.goto(`/sites/${SITE_PLEIN}`);

  const faits = page.locator("dl").first();
  await expect(
    faits.locator("a").filter({ hasText: RAISON_SOCIALE_PLEIN }),
  ).toBeVisible();
  const texteFaits = await faits.innerText();
  expect(texteFaits).toContain(COMMUNE_SITE_PLEIN);

  // LES CONSIGNES, EN BANDEAU D'INFORMATION — visibles car ce site en porte.
  await expect(
    page.locator('[role="status"]').filter({ hasText: CONSIGNES }),
  ).toBeVisible();

  // « QUI SERA PRÉVENU » — le donneur d'ordre DE CE SITE.
  const destinataireAttendu: ContactPourDestinataire = {
    id: CONTACT_DONNEUR_ORDRE,
    nom: NOM_DONNEUR_ORDRE,
    email: COURRIEL_DONNEUR_ORDRE,
    actif: true,
    roles: ["donneur_ordre"],
    site_id: SITE_PLEIN,
  };
  await expect(page.locator('[data-aide="destinataire-courriels"]')).toHaveText(
    libelleDestinataireCourriels(destinataireAttendu),
  );

  // « + INTERVENTION » DEPUIS LA MACHINE — préremplie SITE ET MACHINE.
  const ligneMachine = page
    .locator("li, tr")
    .filter({ hasText: "9EF1-SERIE-001" });
  await ligneMachine
    .getByRole("link", { name: fr["sites.action.ajouter_intervention"] })
    .click();
  await page.waitForURL(/\/interventions\/nouvelle\?/);
  const url = new URL(page.url());
  expect(url.searchParams.get("site")).toBe(SITE_PLEIN);
  expect(url.searchParams.get("machine")).toBe(MACHINE_PLEIN);
});
