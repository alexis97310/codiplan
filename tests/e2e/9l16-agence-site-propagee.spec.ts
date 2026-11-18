import { randomUUID } from "node:crypto";

import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { ouvrirUneSession } from "./setup/session";

/**
 * AGENCE-SITE-PROPAGEE — quand un site change d'agence, ses interventions
 * OUVERTES suivent la nouvelle agence ; les CLÔTURÉES gardent l'ancienne
 * (décision d'Alexis du 10/11/2026, option 1). Le compte-rendu
 * (`texteAgencePropagee`, `app/(back-office)/sites/presentation.ts`) est le
 * livrable que cette scène éprouve : combien ont suivi, et quelle intervention
 * déjà posée tombe hors des horaires de la nouvelle agence.
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `9L16-`
 *
 * Deux agences, un client, un site et trois interventions créés directement
 * en base en `beforeAll` (même discipline que `agences-choix-sites.spec.ts`),
 * supprimés en `afterAll`. Aucune ligne du semis n'est touchée.
 *
 * La CIBLE n'a AUCUN calendrier (`calendrier_id` omis, nullable au schéma) :
 * `chargerCalendrierAgence` y rend `null`, et `verdictOuverture` refuse toute
 * ligne déjà posée — ce qui sert ici à éprouver le signalement sans dépendre
 * d'un jour férié réel.
 */
test.describe.configure({ mode: "serial" });

const PREFIXE = "9L16-";
const RAISON_SOCIALE = `${PREFIXE}Client (agence propagée)`;
const LIBELLE_SITE = `${PREFIXE}Site (agence propagée)`;

const AGENCE_DEPART_ID = randomUUID();
const AGENCE_CIBLE_ID = randomUUID();
const CLIENT_ID = randomUUID();
const SITE_ID = randomUUID();
const INTERVENTION_OUVERTE_ID = randomUUID();
const INTERVENTION_SIGNALEE_ID = randomUUID();
const INTERVENTION_CLOTUREE_ID = randomUUID();
// Un couple (société, année) hors de toute séquence réelle — aucune autre
// ligne ne peut déjà porter ces numéros.
const ANNEE_EPREUVE = 2099;
const NUMERO_OUVERTE = 910001;
const NUMERO_SIGNALEE = 910002;
const NUMERO_CLOTUREE = 910003;
// LES DEUX OUVERTES DE CETTE SCÈNE (à planifier, planifiée) — la clôturée
// n'y entre pas.
const NOMBRE_OUVERTES_SUIVIES = 2;

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

async function nettoyer(client: PrismaClient): Promise<void> {
  await client.intervention.deleteMany({ where: { site_id: SITE_ID } });
  await client.site.deleteMany({ where: { id: SITE_ID } });
  await client.client.deleteMany({ where: { id: CLIENT_ID } });
  await client.agence.deleteMany({
    where: { id: { in: [AGENCE_DEPART_ID, AGENCE_CIBLE_ID] } },
  });
}

test.beforeAll(async () => {
  const client = admin();
  try {
    await nettoyer(client);

    const societe = await client.societe.findFirstOrThrow({
      where: { code: "CODIMA-NC" },
      select: { id: true },
    });

    await client.agence.create({
      data: {
        id: AGENCE_DEPART_ID,
        societe_id: societe.id,
        code: `${PREFIXE}DEPART`,
        libelle: `${PREFIXE}Agence de départ`,
        territoire: "NC",
        actif: true,
      },
    });
    await client.agence.create({
      data: {
        id: AGENCE_CIBLE_ID,
        societe_id: societe.id,
        code: `${PREFIXE}CIBLE`,
        libelle: `${PREFIXE}Agence cible`,
        territoire: "NC",
        actif: true,
      },
    });
    await client.client.create({
      data: {
        id: CLIENT_ID,
        societe_id: societe.id,
        raison_sociale: RAISON_SOCIALE,
      },
    });
    await client.site.create({
      data: {
        id: SITE_ID,
        societe_id: societe.id,
        client_id: CLIENT_ID,
        agence_id: AGENCE_DEPART_ID,
        libelle: LIBELLE_SITE,
        temps_trajet_min: 10,
      },
    });
    // OUVERTE, sans créneau — compte parmi les « suivies », jamais signalée.
    await client.intervention.create({
      data: {
        id: INTERVENTION_OUVERTE_ID,
        societe_id: societe.id,
        annee: ANNEE_EPREUVE,
        numero: NUMERO_OUVERTE,
        client_id: CLIENT_ID,
        site_id: SITE_ID,
        agence_id: AGENCE_DEPART_ID,
        type: "curatif",
        statut: "a_planifier",
      },
    });
    // OUVERTE, DÉJÀ POSÉE — compte parmi les « suivies » ET est signalée, la
    // CIBLE n'ayant aucun calendrier.
    await client.intervention.create({
      data: {
        id: INTERVENTION_SIGNALEE_ID,
        societe_id: societe.id,
        annee: ANNEE_EPREUVE,
        numero: NUMERO_SIGNALEE,
        client_id: CLIENT_ID,
        site_id: SITE_ID,
        agence_id: AGENCE_DEPART_ID,
        type: "curatif",
        statut: "planifiee",
        date_planifiee: new Date("2027-03-15T00:00:00.000Z"),
        creneau_debut: new Date("2027-03-14T21:00:00.000Z"),
        creneau_fin: new Date("2027-03-14T22:00:00.000Z"),
        duree_estimee_min: 60,
      },
    });
    // CLÔTURÉE — garde l'ANCIENNE agence, jamais comptée ni signalée.
    await client.intervention.create({
      data: {
        id: INTERVENTION_CLOTUREE_ID,
        societe_id: societe.id,
        annee: ANNEE_EPREUVE,
        numero: NUMERO_CLOTUREE,
        client_id: CLIENT_ID,
        site_id: SITE_ID,
        agence_id: AGENCE_DEPART_ID,
        type: "curatif",
        statut: "cloturee",
        temps_valide_min: 60,
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await nettoyer(client);
  } finally {
    await client.$disconnect();
  }
});

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

test("le changement d'agence du site déplace les ouvertes, signale la déjà-posée, et garde la clôturée sur l'ancienne", async ({
  page,
}) => {
  await page.goto(`/sites/${SITE_ID}?edition=site`);
  await page.locator('select[name="agence_id"]').selectOption(AGENCE_CIBLE_ID);
  await page.locator('input[name="temps_trajet_min"]').fill("15");
  await page.getByRole("button", { name: fr["sites.action.modifier"] }).click();
  await expect(page).toHaveURL(new RegExp(`/sites/${SITE_ID}(\\?|$)`));

  // LE COMPTE-RENDU : DEUX ouvertes ont suivi (à planifier, planifiée), la
  // clôturée n'entre pas dans ce compte. AUCUN littéral de chaîne dans la
  // requête d'écran (L0-11, `tests/unit/i18n/sans-chaine-visible-en-dur.
  // test.ts`) : le nombre attendu est une CONSTANTE, jamais écrit en dur
  // dans le gabarit, et le préfixe vient du dictionnaire.
  await expect(
    page.getByText(
      `${NOMBRE_OUVERTES_SUIVIES} ${fr["sites.agence_propagee.ouvertes_pluriel_prefixe"]}`,
      { exact: false },
    ),
  ).toBeVisible();
  // LA SIGNALÉE : nommée par son NUMÉRO, jamais déplacée d'office sur son
  // créneau — ce test ne porte que sur le signalement, pas sur une correction
  // de date qui n'existe pas.
  const numero = fr["sites.agence_propagee.numero_prefixe"];
  await expect(
    page.getByText(`${numero}${NUMERO_SIGNALEE}`),
  ).toBeVisible();
  await expect(page.getByText(`${numero}${NUMERO_OUVERTE}`)).toHaveCount(0);
  await expect(page.getByText(`${numero}${NUMERO_CLOTUREE}`)).toHaveCount(0);

  const client = admin();
  try {
    const lignes = await client.intervention.findMany({
      where: { site_id: SITE_ID },
      select: { id: true, agence_id: true },
    });
    const agenceDe = (id: string) =>
      lignes.find((ligne) => ligne.id === id)?.agence_id;
    expect(agenceDe(INTERVENTION_OUVERTE_ID)).toBe(AGENCE_CIBLE_ID);
    expect(agenceDe(INTERVENTION_SIGNALEE_ID)).toBe(AGENCE_CIBLE_ID);
    // LA FIGÉE GARDE L'ANCIENNE — l'historique ne se réécrit pas.
    expect(agenceDe(INTERVENTION_CLOTUREE_ID)).toBe(AGENCE_DEPART_ID);
  } finally {
    await client.$disconnect();
  }
});
