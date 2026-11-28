import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { lireFuseau, maintenant, jourSuivant } from "@/lib/calendar/fuseau";
import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { cleDeJour, COMPTE_TECHNICIEN_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible, ouvrirUneSession } from "./setup/session";

/**
 * 9L61-PRET-2-ECRANS-BUREAU (D287) — LES ÉCRANS DU BUREAU DU PRÊT
 * D'ÉQUIPEMENT, SUR LE SOCLE DE 9L60.
 *
 * Quatre faits du cadrage, chacun son scénario : création d'un appareil au
 * parc, sortie puis retour depuis la fiche intervention, la carte « Prêts en
 * retard » du tableau de bord, et l'absence de tout geste de prêt pour un
 * technicien (D287, décision 1 : le bureau seul). Série, le cycle
 * sortie→retour dépendant de l'état laissé par la création.
 */
test.describe.configure({ mode: "serial" });

const CLIENT_9L61 = uuidv7();
const SITE_9L61 = uuidv7();
const INTERVENTION_RONDE = uuidv7();
const INTERVENTION_RETARD = uuidv7();
const APPAREIL_RETARD = uuidv7();
const PRET_RETARD = uuidv7();

/**
 * LES DÉSIGNATIONS CRÉÉES PAR CHAQUE CYCLE (une par largeur) — un UUID, SANS
 * AUCUN PRÉFIXE LISIBLE : `getByText` interroge l'écran (L0-11), et tout
 * littéral qui y arriverait — fût-ce un simple préfixe — ferait rougir le
 * gardien `tests/unit/i18n/sans-chaine-visible-en-dur.test.ts`. Le nettoyage
 * les retrouve donc par cette liste, jamais par un motif de nom.
 */
const DESIGNATIONS_CREEES: string[] = [];

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  const client = admin();
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "DUCOS" },
      select: { id: true },
    });

    await client.client.create({
      data: {
        id: CLIENT_9L61,
        societe_id: reperes.societeId,
        raison_sociale: "9L61 client prêt",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_9L61,
        societe_id: reperes.societeId,
        client_id: CLIENT_9L61,
        agence_id: agence.id,
        libelle: "9L61 site prêt",
        adresse: { rue: "1 rue de l'épreuve" },
        commune: "Nouméa",
      },
    });

    // UNE INTERVENTION « RONDE » — la création d'un appareil, sa sortie et
    // son retour s'y jouent, un cycle par largeur.
    await client.intervention.create({
      data: {
        id: INTERVENTION_RONDE,
        societe_id: reperes.societeId,
        agence_id: agence.id,
        client_id: CLIENT_9L61,
        site_id: SITE_9L61,
        technicien_id: reperes.technicienDucos,
        type: "curatif",
        priorite: "p3",
        statut: "planifiee",
        duree_estimee_min: 60,
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
        description: "9L61-capture-pret-ronde",
      },
    });

    // UNE INTERVENTION « EN RETARD » — un prêt déjà posé, retour prévu
    // DANS LE PASSÉ (calculé depuis `Date.now()`, jamais un calendrier en
    // dur — leçon du ticket). Affectée au MÊME technicien, pour que le
    // scénario 3 (« aucun geste de prêt ») la visite aussi.
    await client.intervention.create({
      data: {
        id: INTERVENTION_RETARD,
        societe_id: reperes.societeId,
        agence_id: agence.id,
        client_id: CLIENT_9L61,
        site_id: SITE_9L61,
        technicien_id: reperes.technicienDucos,
        type: "curatif",
        priorite: "p3",
        statut: "planifiee",
        duree_estimee_min: 60,
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
        description: "9L61-capture-pret-retard",
      },
    });
    await client.appareilPret.create({
      data: {
        id: APPAREIL_RETARD,
        societe_id: reperes.societeId,
        designation: "9L61 appareil en retard",
        statut: "prete",
      },
    });
    const fuseau = lireFuseau(reperes.fuseau);
    const aujourdhui = maintenant(fuseau).local;
    await client.pretEquipement.create({
      data: {
        id: PRET_RETARD,
        societe_id: reperes.societeId,
        appareil_id: APPAREIL_RETARD,
        intervention_id: INTERVENTION_RETARD,
        client_id: CLIENT_9L61,
        site_id: SITE_9L61,
        date_sortie: new Date(
          Date.UTC(
            jourSuivant(aujourdhui, -10).annee,
            jourSuivant(aujourdhui, -10).mois - 1,
            jourSuivant(aujourdhui, -10).jour,
          ),
        ),
        date_retour_prevue: new Date(
          Date.UTC(
            jourSuivant(aujourdhui, -3).annee,
            jourSuivant(aujourdhui, -3).mois - 1,
            jourSuivant(aujourdhui, -3).jour,
          ),
        ),
        etat_depart: "Bon état (9L61)",
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    // LES BONS FIGÉS (9L62-PRET-3-BON-SIGNE) — chaque sortie réussie pose
    // désormais un `document` (`bon_document_id`), référencé par
    // `document_societe_id_intervention_id_fkey` : il doit disparaître
    // AVANT l'intervention qui le porte, et le prêt AVANT le document
    // (`pret_equipement_societe_id_bon_document_id_fkey`, `ON DELETE
    // RESTRICT` dans les deux sens).
    const prets = await client.pretEquipement.findMany({
      where: { client_id: CLIENT_9L61 },
      select: { id: true, bon_document_id: true },
    });
    await client.pretEquipement.deleteMany({
      where: { id: { in: prets.map((p) => p.id) } },
    });
    const documentIds = prets
      .map((p) => p.bon_document_id)
      .filter((id): id is string => id !== null);
    if (documentIds.length > 0) {
      await client.document.deleteMany({ where: { id: { in: documentIds } } });
    }
    await client.appareilPret.deleteMany({
      where: { id: { in: [APPAREIL_RETARD] } },
    });
    await client.appareilPret.deleteMany({
      where: { designation: { in: DESIGNATIONS_CREEES } },
    });
    await client.intervention.deleteMany({
      where: { client_id: CLIENT_9L61 },
    });
    await client.site.deleteMany({ where: { id: SITE_9L61 } });
    await client.client.deleteMany({ where: { id: CLIENT_9L61 } });
  } finally {
    await client.$disconnect();
  }
});

/**
 * LA LIGNE D'UN APPAREIL, AU TABLEAU (≥ 901 px) OU À LA CARTE (≤ 900 px) —
 * les deux rendent le MÊME contenu, mais l'un des deux est TOUJOURS masqué
 * par CSS (`max-[900px]:hidden`/`min-[901px]:hidden`), jamais retiré du DOM.
 * `:visible` seul ne suffit pas à choisir UNE ligne : il faudrait encore
 * filtrer par désignation, donc autant choisir le bon conteneur ici.
 */
function ligneAppareilPret(
  page: import("@playwright/test").Page,
  designation: string,
  largeur: number,
) {
  return largeur >= 901
    ? page.locator("tr", { hasText: designation }).first()
    : page.locator("li", { hasText: designation }).first();
}

for (const largeur of [1280, 375] as const) {
  test(`à ${largeur} px — créer un appareil, le prêter depuis l'intervention, puis enregistrer son retour`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 1000 });
    await ouvrirUneSession(page);

    const designation = uuidv7();
    DESIGNATIONS_CREEES.push(designation);

    // 1. CRÉER L'APPAREIL AU PARC DE PRÊT.
    await page.goto("/parametres/prets");
    await page.getByRole("link", { name: fr["prets.creer_action"] }).click();
    await page.getByLabel(fr["prets.champ_designation"]).fill(designation);
    await page.getByRole("button", { name: fr["prets.enregistrer"] }).click();
    await expect(
      page.getByText(designation).and(page.locator(":visible")).first(),
    ).toBeVisible();
    await expect(
      ligneAppareilPret(page, designation, largeur).getByText(
        fr["prets.statut.disponible"],
      ),
    ).toBeVisible();

    // 2. LE PRÊTER DEPUIS LA FICHE INTERVENTION.
    const reperes = await reperesDeLaScene();
    const fuseau = lireFuseau(reperes.fuseau);
    const aujourdhui = maintenant(fuseau).local;
    const dansCinqJours = jourSuivant(aujourdhui, 5);

    await page.goto(`/interventions/${INTERVENTION_RONDE}`);
    await page
      .getByLabel(fr["intervention.pret.champ_appareil"])
      .selectOption({ label: designation });
    await page
      .getByLabel(fr["intervention.pret.champ_date_sortie"])
      .fill(cleDeJour(aujourdhui));
    await page
      .getByLabel(fr["intervention.pret.champ_retour_prevu"])
      .fill(cleDeJour(dansCinqJours));
    await page
      .getByLabel(fr["intervention.pret.champ_etat_depart"])
      .fill("Bon état");
    // LA REMISE AU CLIENT (9L62-PRET-3-BON-SIGNE) — ajoutée à CE formulaire
    // par le lot suivant, DANS LE MÊME GESTE que la sortie (voir son
    // docblock) : sans elle, le serveur refuse désormais la saisie
    // (signature OU motif, jamais aucun des deux). Ce scénario continue de
    // prouver « prêter un appareil depuis la fiche », pas la remise elle-même
    // — remplie au plus simple, un motif, pour que la sortie aboutisse
    // toujours (la remise SIGNÉE a son propre scénario,
    // `9l62-pret-bon-signe.spec.ts`).
    await page
      .getByLabel(fr["intervention.pret.champ_motif_absence_signature"])
      .fill("Client absent (épreuve 9L61).");
    await page
      .getByRole("button", { name: fr["intervention.pret.preter_action"] })
      .click();

    await expect(
      page.getByRole("heading", { name: fr["intervention.pret.titre"] }),
    ).toBeVisible();
    await expect(
      page.getByText(designation).and(page.locator(":visible")).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: fr["intervention.pret.retour_action"],
      }),
    ).toBeVisible();

    // L'APPAREIL EST MAINTENANT « PRÊTÉ » AU PARC, et verrouillé.
    await page.goto("/parametres/prets");
    const ligneAppareil = ligneAppareilPret(page, designation, largeur);
    await expect(
      ligneAppareil.getByText(fr["prets.statut.prete"]),
    ).toBeVisible();
    await expect(
      ligneAppareil.getByRole("button", {
        name: fr["prets.passer_en_revision"],
      }),
    ).toHaveCount(0);

    // 3. ENREGISTRER LE RETOUR, DEPUIS LA FICHE.
    await page.goto(`/interventions/${INTERVENTION_RONDE}`);
    await page
      .getByLabel(fr["intervention.pret.champ_date_retour"])
      .fill(cleDeJour(aujourdhui));
    await page
      .getByLabel(fr["intervention.pret.champ_etat_retour"])
      .fill("Bon état au retour");
    await page
      .getByRole("button", { name: fr["intervention.pret.retour_action"] })
      .click();

    // LE PRÊT N'EST PLUS « EN COURS » — le formulaire de sortie reprend sa
    // place (aucun geste de retour n'est plus proposé pour celui-ci).
    await expect(
      page.getByRole("button", {
        name: fr["intervention.pret.retour_action"],
      }),
    ).toHaveCount(0);

    // L'APPAREIL EST REDEVENU « DISPONIBLE ».
    await page.goto("/parametres/prets");
    const ligneApresRetour = ligneAppareilPret(page, designation, largeur);
    await expect(
      ligneApresRetour.getByText(fr["prets.statut.disponible"]),
    ).toBeVisible();

    // L'HISTORIQUE SE RETROUVE SUR LA FICHE CLIENT, MARQUÉ « RETOURNÉ ».
    await page.goto(`/clients/${CLIENT_9L61}`);
    await expect(
      page.getByRole("heading", { name: fr["client.prets.titre"] }),
    ).toBeVisible();
    await expect(
      page.getByText(designation).and(page.locator(":visible")).first(),
    ).toBeVisible();
    await expect(
      page.getByText(fr["client.prets.retourne"]).first(),
    ).toBeVisible();
  });

  test(`à ${largeur} px — la carte « Prêts en retard » du tableau de bord`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 1000 });
    await ouvrirUneSession(page);
    await page.goto("/tableau-de-bord");
    await expect(
      page.getByRole("heading", {
        name: fr["tableau_de_bord.prets_en_retard.titre"],
      }),
    ).toBeVisible();
    const lien = page.getByRole("link", {
      name: new RegExp("9L61 appareil en retard"),
    });
    await expect(lien).toBeVisible();
    await lien.click();
    await expect(page).toHaveURL(new RegExp(INTERVENTION_RETARD));
  });

  test(`à ${largeur} px — un technicien ne voit aucun geste de prêt`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 1000 });
    await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
    await page.goto(`/interventions/${INTERVENTION_RETARD}`);
    await expect(
      page.getByRole("button", {
        name: fr["intervention.pret.preter_action"],
      }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", {
        name: fr["intervention.pret.retour_action"],
      }),
    ).toHaveCount(0);
  });
}
