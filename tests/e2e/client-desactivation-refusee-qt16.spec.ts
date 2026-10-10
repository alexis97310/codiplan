import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { libelleDestinataireCourriels } from "@/app/(back-office)/presentation";
import type { ContactPourDestinataire } from "@/lib/avertissements/planification";
import { fr } from "@/lib/i18n";
import { mot } from "@/lib/i18n/vocabulaire";
import { t } from "@/lib/i18n/fr";

import { urlAdministration } from "./setup/base";
import { ouvrirUneSession } from "./setup/session";

/**
 * QT-16 (D165, audit du 28/09/2026 ; précisions du pilote du 03/10/2026, à
 * valider par Alexis) — CLIENT INACTIF : désactivation refusée si des
 * interventions restent ouvertes, état visible sur la fiche client, sur
 * `/sites` et sur la fiche site.
 *
 * **Scène à SOI, créée par ce fichier** (jamais `SCENE.*` partagée) : deux
 * clients préfixés `QT16-`, l'un sans aucune intervention, l'autre avec une
 * intervention ouverte — exactement ce que le ticket interdit de mélanger
 * avec le semis de démonstration, sous peine de compter large comme
 * `46-SELECTEURS-1` l'a appris à ses dépens.
 */

test.describe.configure({ mode: "serial" });

const CLIENT_SANS_INTERVENTION = "e2e00000-0000-7000-8000-000000016101";
const SITE_SANS_INTERVENTION = "e2e00000-0000-7000-8000-000000016102";
const CLIENT_AVEC_INTERVENTION = "e2e00000-0000-7000-8000-000000016103";
const SITE_AVEC_INTERVENTION = "e2e00000-0000-7000-8000-000000016104";
const INTERVENTION_OUVERTE = "e2e00000-0000-7000-8000-000000016105";
const CONTACT_DONNEUR_ORDRE = "e2e00000-0000-7000-8000-000000016106";

const LIBELLE_CLIENT_SANS = "QT16- Client sans intervention";
const LIBELLE_CLIENT_AVEC = "QT16- Client avec intervention ouverte";
const LIBELLE_SITE_SANS = "QT16- Site sans intervention";
const LIBELLE_SITE_AVEC = "QT16- Site avec intervention ouverte";

test.beforeAll(async () => {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    const societe = await client.societe.findFirstOrThrow({
      where: { code: "CODIMA-NC" },
      select: { id: true },
    });
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societe.id },
      select: { id: true },
      orderBy: { code: "asc" },
    });

    await client.contact.deleteMany({
      where: { id: CONTACT_DONNEUR_ORDRE },
    });
    await client.intervention.deleteMany({
      where: { id: INTERVENTION_OUVERTE },
    });
    await client.site.deleteMany({
      where: { id: { in: [SITE_SANS_INTERVENTION, SITE_AVEC_INTERVENTION] } },
    });
    await client.client.deleteMany({
      where: {
        id: { in: [CLIENT_SANS_INTERVENTION, CLIENT_AVEC_INTERVENTION] },
      },
    });

    await client.client.create({
      data: {
        id: CLIENT_SANS_INTERVENTION,
        societe_id: societe.id,
        raison_sociale: LIBELLE_CLIENT_SANS,
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_SANS_INTERVENTION,
        societe_id: societe.id,
        client_id: CLIENT_SANS_INTERVENTION,
        agence_id: agence.id,
        libelle: LIBELLE_SITE_SANS,
        actif: true,
      },
    });

    await client.client.create({
      data: {
        id: CLIENT_AVEC_INTERVENTION,
        societe_id: societe.id,
        raison_sociale: LIBELLE_CLIENT_AVEC,
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_AVEC_INTERVENTION,
        societe_id: societe.id,
        client_id: CLIENT_AVEC_INTERVENTION,
        agence_id: agence.id,
        libelle: LIBELLE_SITE_AVEC,
        actif: true,
      },
    });
    // `statut` retombe sur son défaut (`a_planifier`) — une OUVERTE de la
    // file d'attente, exactement le cas que QT-16 bloque.
    await client.intervention.create({
      data: {
        id: INTERVENTION_OUVERTE,
        societe_id: societe.id,
        client_id: CLIENT_AVEC_INTERVENTION,
        site_id: SITE_AVEC_INTERVENTION,
        agence_id: agence.id,
        type: "curatif",
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    await client.contact.deleteMany({
      where: { id: CONTACT_DONNEUR_ORDRE },
    });
    await client.intervention.deleteMany({
      where: { id: INTERVENTION_OUVERTE },
    });
    await client.site.deleteMany({
      where: { id: { in: [SITE_SANS_INTERVENTION, SITE_AVEC_INTERVENTION] } },
    });
    await client.client.deleteMany({
      where: {
        id: { in: [CLIENT_SANS_INTERVENTION, CLIENT_AVEC_INTERVENTION] },
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

test("refuse la désactivation d'un client avec une intervention ouverte, et affiche la liste", async ({
  page,
}) => {
  // ADAPTÉ (D191, 9EF-TP-UX4-2-FICHES-1) — le formulaire d'identité vit
  // désormais derrière l'onglet Identité, jamais ouvert par défaut.
  await page.goto(`/clients/${CLIENT_AVEC_INTERVENTION}?onglet=identite`);
  await page.locator('select[name="actif"]').selectOption("false");
  await page
    .getByRole("button", { name: t("clients.action.modifier") })
    .click();

  const bandeau = page.locator(
    '[data-motif="client.refus.interventions_ouvertes"]',
  );
  await expect(bandeau).toBeVisible();
  await expect(bandeau).toContainText(t("client.refus.interventions_ouvertes"));
  await expect(
    bandeau.locator(`a[href="/interventions/${INTERVENTION_OUVERTE}"]`),
  ).toBeVisible();

  // LE REFUS N'A RIEN CHANGÉ : la fiche reste celle d'un client ACTIF — les
  // deux actions normalement offertes à ce rôle sont toujours là.
  await expect(
    page.getByRole("link", {
      name: `${t("action.ajouter")} ${mot("site")}`,
    }),
  ).toBeVisible();

  // N5 (addendum 9DN) — « Courriels de planification » reste visible sur la
  // fiche CLIENT, refus ou pas (CS45) ; aucun contact de cette scène ne porte
  // le rôle, donc le texte retombe sur la variante « aucun ».
  await expect(page.locator('[data-aide="destinataire-courriels"]')).toHaveText(
    t("clients.fiche.destinataire_courriels_aucun"),
  );

  // ET SUR LA FICHE SITE (CS27) — même donnée, même absence de contact.
  await page.goto(`/sites/${SITE_AVEC_INTERVENTION}`);
  await expect(page.locator('[data-aide="destinataire-courriels"]')).toHaveText(
    t("clients.fiche.destinataire_courriels_aucun"),
  );
});

test("désactive un client SANS intervention ouverte, montre le badge, masque les actions, et le dit sur /sites", async ({
  page,
}) => {
  // ADAPTÉ (D191, 9EF-TP-UX4-2-FICHES-1) — voir le scénario précédent.
  await page.goto(`/clients/${CLIENT_SANS_INTERVENTION}?onglet=identite`);
  await page.locator('select[name="actif"]').selectOption("false");
  await page
    .getByRole("button", { name: t("clients.action.modifier") })
    .click();

  await expect(page.locator('[data-motif="clients.modifie"]')).toBeVisible();

  // LE BADGE, EN TÊTE DE FICHE (CS15).
  await expect(
    page.getByRole("heading", { level: 1 }).getByText(t("clients.inactif")),
  ).toBeVisible();

  // LES DEUX ACTIONS DISPARAISSENT, ET LA RAISON EST EN CLAIR (CS15).
  await expect(
    page.getByRole("link", {
      name: `${t("action.ajouter")} ${mot("site")}`,
    }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", {
      name: t("clients.action.ajouter_intervention"),
    }),
  ).toHaveCount(0);
  await expect(page.locator('[data-aide="client-inactif-actions"]')).toHaveText(
    t("clients.fiche.actions_masquees_inactif"),
  );

  // LA CARTE DE /sites LE DIT AUSSI (CS27). Recherche écrite dans l'URL —
  // c'est un formulaire `GET` — plutôt qu'un remplissage de champ.
  // `sans_equipement=1` : ce site d'épreuve n'a aucun équipement, et la
  // recherche les masque par défaut (LISTES-1). `vue=inactifs`
  // (9EB-TP-UX3-2-LISTES-1) : la vue PAR DÉFAUT ne montre que les sites des
  // clients actifs depuis ce ticket, et ce client vient juste d'être
  // désactivé — sans cette vue, la carte ne serait pas MASQUÉE par erreur,
  // elle serait hors de la liste pour une tout autre raison que celle que
  // ce scénario veut mesurer.
  await page.goto(
    `/sites?q=${encodeURIComponent(LIBELLE_SITE_SANS)}&sans_equipement=1&vue=inactifs`,
  );
  const carte = page.locator("article").filter({ hasText: LIBELLE_SITE_SANS });
  await expect(carte).toHaveCount(1);
  await expect(carte.getByText(t("clients.inactif"))).toBeVisible();
});

test("le destinataire des courriels de planification, quand un interlocuteur porte le rôle, se lit à l'identique sur la fiche client ET la fiche site (9DW-SOLDE-9DR, O5)", async ({
  page,
}) => {
  // Contre-épreuve des « aucun » du premier scénario : sans elle, ce texte
  // pourrait toujours rendre « aucun », même quand un interlocuteur éligible
  // existe. Contact du CLIENT (`site_id` nul) — `destinataireClient` le rend
  // pour la fiche client ET, à défaut d'un contact propre au site, pour la
  // fiche de CE site (`lib/avertissements/planification.ts`).
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    const societe = await client.societe.findFirstOrThrow({
      where: { code: "CODIMA-NC" },
      select: { id: true },
    });
    await client.contact.create({
      data: {
        id: CONTACT_DONNEUR_ORDRE,
        societe_id: societe.id,
        client_id: CLIENT_AVEC_INTERVENTION,
        site_id: null,
        nom: fr["qt16.e2e.nom_interlocuteur"],
        email: fr["qt16.e2e.courriel_interlocuteur"],
        roles: ["donneur_ordre"],
        actif: true,
      },
    });
  } finally {
    await client.$disconnect();
  }

  // Le libellé ATTENDU se compose avec la MÊME fonction que l'écran
  // (`libelleDestinataireCourriels`, RÉUTILISÉE, jamais recopiée) : une
  // seconde implémentation du même texte n'est jamais gratuite (§9).
  const destinataireAttendu: ContactPourDestinataire = {
    id: CONTACT_DONNEUR_ORDRE,
    nom: fr["qt16.e2e.nom_interlocuteur"],
    email: fr["qt16.e2e.courriel_interlocuteur"],
    actif: true,
    roles: ["donneur_ordre"],
    site_id: null,
  };

  await page.goto(`/clients/${CLIENT_AVEC_INTERVENTION}`);
  await expect(page.locator('[data-aide="destinataire-courriels"]')).toHaveText(
    libelleDestinataireCourriels(destinataireAttendu),
  );

  await page.goto(`/sites/${SITE_AVEC_INTERVENTION}`);
  await expect(page.locator('[data-aide="destinataire-courriels"]')).toHaveText(
    libelleDestinataireCourriels(destinataireAttendu),
  );
});
