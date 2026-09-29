import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { chargerCalendrierAgence } from "@/lib/calendar/agence";
import { jourDe, jourSuivant, maintenant } from "@/lib/calendar/fuseau";
import { prochainJourOuvert, type Calendrier } from "@/lib/calendar";
import { fr } from "@/lib/i18n";
import { uuidv7 } from "@/lib/db/uuid";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { cleDeJour, type ReperesDeScene } from "./setup/scene";
import { ouvrirUneSession } from "./setup/session";

/**
 * LA BARRE DE FILTRES ET LE BOUTON « AUJOURD'HUI » PERMANENT
 * (PG-C6-FILTRES-AUJOURDHUI, audit du 27/09/2026 §5).
 *
 * *Chaque scénario forge SES PROPRES interventions* (préfixe `PGC6-`) et les
 * retire en fin de test — jamais une fixture `SCENE.*` partagée.
 */

async function admin(): Promise<PrismaClient> {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

async function creerIntervention(
  reperes: ReperesDeScene,
  statut: string,
): Promise<string> {
  const id = uuidv7();
  const client = await admin();
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
    await client.intervention.create({
      data: {
        id,
        societe_id: reperes.societeId,
        agence_id: agence.id,
        client_id: site.client_id,
        site_id: site.id,
        technicien_id: reperes.technicienDucos,
        type: "curatif",
        priorite: "p2",
        statut: statut as never,
        date_planifiee: new Date(`${cleDeJour(reperes.lundi)}T00:00:00.000Z`),
        creneau_debut: new Date(`${cleDeJour(reperes.lundi)}T08:00:00.000Z`),
        creneau_fin: new Date(`${cleDeJour(reperes.lundi)}T09:00:00.000Z`),
        duree_estimee_min: 60,
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
        description: "PGC6 — intervention forgée par l'épreuve",
      },
    });
    return id;
  } finally {
    await client.$disconnect();
  }
}

async function retirerIntervention(id: string): Promise<void> {
  const client = await admin();
  try {
    await client.intervention.deleteMany({ where: { id } });
  } finally {
    await client.$disconnect();
  }
}

test("le filtre « Statut » ne montre que les cartes du statut choisi, et garde toutes les lignes de technicien", async ({
  page,
}) => {
  const reperes = await reperesDeLaScene();
  const planifiee = await creerIntervention(reperes, "planifiee");
  const terminee = await creerIntervention(reperes, "terminee");

  try {
    await ouvrirUneSession(page);
    await page.goto(
      `/planning?vue=semaine&semaine=${cleDeJour(reperes.lundi)}`,
    );

    // TÉMOIN — les deux cartes sont visibles sans filtre.
    await expect(
      page.locator(`[data-tiroir-declencheur="${planifiee}"]`).first(),
    ).toBeVisible();
    await expect(
      page.locator(`[data-tiroir-declencheur="${terminee}"]`).first(),
    ).toBeVisible();

    // SCOPÉ À LA BARRE DE FILTRES : « Filtrer » est aussi le libellé du
    // bouton de la colonne « À traiter » (PG-C2-FILE-ONGLETS) — deux
    // formulaires distincts partagent ce mot.
    const formulaireFiltres = page
      .locator("form")
      .filter({ has: page.locator('select[name="statut"]') });
    await formulaireFiltres
      .locator('select[name="statut"]')
      .selectOption("planifiee");
    await formulaireFiltres
      .getByRole("button", { name: fr["planning.filtre_appliquer"] })
      .click();

    await expect(page).toHaveURL(/statut=planifiee/);
    await expect(
      page.locator(`[data-tiroir-declencheur="${planifiee}"]`).first(),
    ).toBeVisible();
    await expect(
      page.locator(`[data-tiroir-declencheur="${terminee}"]`),
    ).toHaveCount(0);
    // LA LIGNE DU TECHNICIEN RESTE — le filtre ne retire que les cartes.
    await expect(
      page.getByRole("row", { name: /D\. Garnier/ }).first(),
    ).toBeVisible();

    // « TOUT EFFACER » REND LES DEUX CARTES.
    await page
      .getByRole("link", { name: fr["planning.filtre_tout_effacer"] })
      .click();
    await expect(page).not.toHaveURL(/statut=/);
    await expect(
      page.locator(`[data-tiroir-declencheur="${terminee}"]`).first(),
    ).toBeVisible();
  } finally {
    await retirerIntervention(planifiee);
    await retirerIntervention(terminee);
  }
});

test("« Aujourd'hui », en vue Jour, ouvre le prochain jour ouvert d'au moins une agence", async ({
  page,
}) => {
  const reperes = await reperesDeLaScene();

  // L'ORACLE — la MÊME fonction pure (`prochainJourOuvert`) sur les MÊMES
  // calendriers que la page charge (`chargerCalendrierAgence`, fériés et
  // ponts compris) : ce scénario ne fige jamais un jour de semaine
  // particulier, il compare la page à sa propre règle, jouée sur la vraie
  // base.
  const client = await admin();
  const aujourdhui = jourDe(maintenant(reperes.fuseau).local);
  let attendu: ReturnType<typeof jourDe>;
  try {
    const agences = await client.agence.findMany({
      where: { societe_id: reperes.societeId },
      select: { id: true },
    });
    const fenetre = { du: aujourdhui, au: jourSuivant(aujourdhui, 14) };
    const calendriers = (
      await Promise.all(
        agences.map((agence) =>
          chargerCalendrierAgence(client, {
            societeId: reperes.societeId,
            agenceId: agence.id,
            fenetre,
          }),
        ),
      )
    ).filter((c): c is Calendrier => c !== null);
    attendu = prochainJourOuvert(calendriers, aujourdhui);
  } finally {
    await client.$disconnect();
  }

  await ouvrirUneSession(page);
  await page.goto(`/planning?vue=jour&jour=${cleDeJour(reperes.lundi)}`);
  await page
    .getByRole("link", { name: fr["planning.aujourdhui"], exact: true })
    .click();

  await expect(page).toHaveURL(new RegExp(`jour=${cleDeJour(attendu)}`));
});
