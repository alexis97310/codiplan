import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { Role } from "@/lib/auth/roles";
import {
  instantDuJour,
  jourDe,
  jourSuivant,
  maintenant,
} from "@/lib/calendar/fuseau";
import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import {
  COMPTE_RM_EPREUVE,
  COMPTE_RS_EPREUVE,
  MOT_DE_PASSE_EPREUVE,
} from "./setup/scene";
import { ouvrirUneSession } from "./setup/session";

/**
 * 9EG1-TP-UX6-TABLEAU-DE-BORD-1 — LE TABLEAU DE BORD SELON LE RÔLE, SUR UNE
 * FIXTURE PROPRE (9EG-TP-UX6-TABLEAU-DE-BORD-1, D185).
 *
 * SA PROPRE SCÈNE, préfixée `9EG1-` — jamais `SCENE.*` : un technicien, un
 * client, un site, sept interventions et une signature, hors des fenêtres
 * comptées par les autres épreuves (créées puis supprimées dans ce fichier
 * seul). ADV réutilise `COMPTE_EPREUVE` (`ouvrirUneSession`) ; responsable
 * matériel et responsable SAV réutilisent les comptes déjà posés par la
 * scène partagée (`COMPTE_RM_EPREUVE`/`COMPTE_RS_EPREUVE`), jamais une
 * identité créée ici (modèle `droits-rm-rs.spec.ts`).
 *
 * Les comptages sont RELATIFS : chaque tuile est comparée au nombre de
 * lignes que SON lien ouvre, lu dans le MÊME passage — jamais un nombre
 * absolu sur la société partagée (piège connu, `fullyParallel`).
 */
test.describe.configure({ mode: "serial" });

const SOCIETE_CODE = "CODIMA-NC";
const NOM_TECHNICIEN = fr["tableau_de_bord.e2e.nom_technicien"];

let utilisateurId = "";
let utilisateurSocieteId = "";
let technicienId = "";
let clientId = "";
let siteId = "";

let idP1APlanifier = "";
let idPasDemarree = "";
let idATransmettre = "";
let idEnRetard = "";
let idSuspendue = "";
let idTerminee = "";
let idSansDuree = "";
let idSignature = "";

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

async function effacerLaScene(): Promise<void> {
  if (utilisateurId === "") {
    return;
  }
  const client = admin();
  try {
    await client.interventionSignature.deleteMany({
      where: { id: idSignature },
    });
    await client.intervention.deleteMany({
      where: {
        id: {
          in: [
            idP1APlanifier,
            idPasDemarree,
            idATransmettre,
            idEnRetard,
            idSuspendue,
            idTerminee,
            idSansDuree,
          ],
        },
      },
    });
    await client.site.deleteMany({ where: { id: siteId } });
    await client.client.deleteMany({ where: { id: clientId } });
    await client.technicien.deleteMany({ where: { id: technicienId } });
    await client.utilisateurSociete.deleteMany({
      where: { id: utilisateurSocieteId },
    });
    await client.utilisateur.deleteMany({ where: { id: utilisateurId } });
  } finally {
    await client.$disconnect();
  }
}

async function ecrireLaScene(): Promise<void> {
  utilisateurId = uuidv7();
  utilisateurSocieteId = uuidv7();
  technicienId = uuidv7();
  clientId = uuidv7();
  siteId = uuidv7();
  idP1APlanifier = uuidv7();
  idPasDemarree = uuidv7();
  idATransmettre = uuidv7();
  idEnRetard = uuidv7();
  idSuspendue = uuidv7();
  idTerminee = uuidv7();
  idSansDuree = uuidv7();
  idSignature = uuidv7();

  const client = admin();
  try {
    const societe = await client.societe.findFirstOrThrow({
      where: { code: SOCIETE_CODE },
      select: { id: true, fuseau_horaire: true },
    });
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societe.id },
      select: { id: true },
      orderBy: { code: "asc" },
    });

    const { instant, local } = maintenant(societe.fuseau_horaire);
    const jour = jourDe(local);
    const debutDuJour = instantDuJour(jour);
    const hier = instantDuJour(jourSuivant(jour, -1));
    const dansCinqJours = instantDuJour(jourSuivant(jour, 5));
    const ilYADeuxJours = instantDuJour(jourSuivant(jour, -2));
    const creneauPasse = new Date(instant.getTime() - 60 * 60 * 1000);
    const creneauFuture = new Date(instant.getTime() + 3 * 60 * 60 * 1000);

    await client.utilisateur.create({
      data: {
        id: utilisateurId,
        nom: NOM_TECHNICIEN,
        email: "9eg1-technicien@codiplan.test",
      },
    });
    await client.utilisateurSociete.create({
      data: {
        id: utilisateurSocieteId,
        utilisateur_id: utilisateurId,
        societe_id: societe.id,
        role: Role.technicien,
      },
    });
    await client.technicien.create({
      data: {
        id: technicienId,
        societe_id: societe.id,
        utilisateur_id: utilisateurId,
        agence_id: agence.id,
        actif: true,
      },
    });
    await client.client.create({
      data: {
        id: clientId,
        societe_id: societe.id,
        raison_sociale: "9EG1- Client de l'épreuve",
      },
    });
    await client.site.create({
      data: {
        id: siteId,
        societe_id: societe.id,
        client_id: clientId,
        agence_id: agence.id,
        libelle: "9EG1- Lieu de l'épreuve",
      },
    });

    const base = {
      societe_id: societe.id,
      agence_id: agence.id,
      client_id: clientId,
      site_id: siteId,
      type: "curatif" as const,
      mode_valorisation: "temps_passe" as const,
      devise_code: "XPF",
    };

    // URGENCES — « P1 à planifier » : dans la file, sans date. `cree_le`
    // fixé dans le passé pour être, À COUP SÛR, la plus ancienne P1 de la
    // société partagée — l'alerte nomme la plus ancienne (§9, 01/09 : un
    // comptage relatif, jamais un ordre supposé face au semis).
    await client.intervention.create({
      data: {
        ...base,
        id: idP1APlanifier,
        priorite: "p1",
        statut: "a_planifier",
        description: "9EG1- panne P1",
        cree_le: new Date("2020-01-01T00:00:00.000Z"),
      },
    });

    // URGENCES — « Pas démarrée » : affectée, créneau déjà passé.
    await client.intervention.create({
      data: {
        ...base,
        id: idPasDemarree,
        priorite: "p3",
        statut: "affectee",
        technicien_id: technicienId,
        date_planifiee: debutDuJour,
        creneau_debut: creneauPasse,
        creneau_fin: new Date(creneauPasse.getTime() + 60 * 60 * 1000),
        duree_estimee_min: 60,
      },
    });

    // À PLANIFIER OU TRANSMETTRE — « À transmettre » : planifiée aujourd'hui, pas encore affectée.
    await client.intervention.create({
      data: {
        ...base,
        id: idATransmettre,
        priorite: "p3",
        statut: "planifiee",
        technicien_id: technicienId,
        date_planifiee: debutDuJour,
        creneau_debut: creneauFuture,
        creneau_fin: new Date(creneauFuture.getTime() + 60 * 60 * 1000),
        duree_estimee_min: 60,
      },
    });

    // RETARDS — planifiée hier, jamais démarrée, aucun segment.
    await client.intervention.create({
      data: {
        ...base,
        id: idEnRetard,
        priorite: "p3",
        statut: "affectee",
        technicien_id: technicienId,
        date_planifiee: hier,
        creneau_debut: new Date(hier.getTime() + 9 * 60 * 60 * 1000),
        creneau_fin: new Date(hier.getTime() + 10 * 60 * 60 * 1000),
        duree_estimee_min: 60,
      },
    });

    // PIÈCES — suspendue, en attente d'une pièce.
    await client.intervention.create({
      data: {
        ...base,
        id: idSuspendue,
        priorite: "p3",
        statut: "suspendue",
        duree_estimee_min: 60,
        motif_suspension: "piece",
        piece_attendue_ref: "9EG1-PIECE",
        date_dispo_prevue: dansCinqJours,
        suspendue_le: ilYADeuxJours,
      },
    });

    // CONTRÔLE — terminée, client absent à la signature.
    await client.intervention.create({
      data: {
        ...base,
        id: idTerminee,
        priorite: "p3",
        statut: "terminee",
        technicien_id: technicienId,
        date_planifiee: hier,
      },
    });
    await client.interventionSignature.create({
      data: {
        id: idSignature,
        societe_id: societe.id,
        intervention_id: idTerminee,
        issue: "client_absent",
        motif: "9EG1- motif de l'épreuve",
      },
    });

    // SANS DURÉE — dans la file, sans durée estimée (seuls `planifiee` et
    // `affectee` sont contraints par `intervention_planifiee_a_sa_duree`).
    await client.intervention.create({
      data: {
        ...base,
        id: idSansDuree,
        priorite: "p3",
        statut: "a_planifier",
      },
    });
  } finally {
    await client.$disconnect();
  }
}

test.beforeAll(async () => {
  await ecrireLaScene();
});

test.afterAll(async () => {
  await effacerLaScene();
});

async function connecterRole(page: Page, email: string): Promise<void> {
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(email);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await expect(page).toHaveURL(/\/planning/);
}

test.describe("ADV", () => {
  test.beforeEach(async ({ page }) => {
    await ouvrirUneSession(page);
    await page.goto("/tableau-de-bord");
  });

  test("la tuile « À planifier » ouvre le registre, qui contient la P1 de l'épreuve", async ({
    page,
  }) => {
    const tuile = page.locator('[data-bloc="kpi-a-planifier"]');
    await expect(tuile).toBeVisible();
    await tuile.locator("a").click();
    await page.waitForURL(/\/interventions\?vue=a_planifier/);
    await expect(
      page.locator(`[href*="${idP1APlanifier}"]`).first(),
    ).toBeVisible();
  });

  test("l'alerte P1 nomme le client de l'épreuve et mène au planning", async ({
    page,
  }) => {
    // Deux `role="alert"` sur la page : le bandeau de refus ET l'annonceur de
    // route de Next.js (`__next-route-announcer__`) — celui-ci filtré par le
    // texte du client de l'épreuve, jamais par position.
    const alerte = page
      .getByRole("alert")
      .filter({ hasText: "9EG1- Client de l'épreuve" });
    await expect(alerte).toBeVisible();
    await expect(
      alerte.getByText(fr["tableau_de_bord.alerte_p1_bouton"]),
    ).toBeVisible();
  });

  test("« Priorités opérationnelles » liste la P1, la pas démarrée, le retard et la pièce de l'épreuve", async ({
    page,
  }) => {
    // FILTRÉ PAR CATÉGORIE (D122) — le seuil de 7 lignes (décision 24,
    // LIGNES_PRIORITES) coupe la liste « Tous les besoins » bien avant la
    // ligne de l'épreuve sur la société partagée ; chaque catégorie, filtrée,
    // en a trop peu pour que ça arrive.
    await page.goto("/tableau-de-bord?priorite=urgent");
    const urgences = page.locator('[data-bloc="priorites-liste"]');
    await expect(urgences.locator(`a[href*="${idP1APlanifier}"]`)).toHaveCount(
      1,
    );
    await expect(urgences.locator(`a[href*="${idPasDemarree}"]`)).toHaveCount(
      1,
    );

    // « Retards » DÉPASSE LES 7 LIGNES SUR LA SOCIÉTÉ PARTAGÉE (le semis de
    // démonstration en porte à lui seul une quinzaine) : la carte filtrée ne
    // suffit pas à retrouver une ligne précise au-delà du seuil (décision 24,
    // LIGNES_PRIORITES). La tuile « En retard » ouvre la MÊME population,
    // sans ce plafond — c'est elle qui prouve l'inclusion.
    const tuileEnRetard = page.locator('[data-bloc="kpi-en-retard"]');
    await tuileEnRetard.locator("a").click();
    await page.waitForURL(/\/interventions\?vue=en_retard/);
    await expect(page.locator(`[href*="${idEnRetard}"]`).first()).toBeVisible();

    await page.goto("/tableau-de-bord?priorite=piece");
    await expect(
      page
        .locator('[data-bloc="priorites-liste"]')
        .locator(`a[href*="${idSuspendue}"]`),
    ).toHaveCount(1);
  });

  test("la bande compte l'intervention à transmettre de l'épreuve", async ({
    page,
  }) => {
    await expect(
      page.locator(`[href*="statut=planifiee"]`).first(),
    ).toBeVisible();
  });

  test("« Interventions sans durée » liste la ligne de l'épreuve", async ({
    page,
  }) => {
    await expect(
      page.locator(`a[href*="${idSansDuree}"]`).first(),
    ).toBeVisible();
  });
});

test.describe("responsable matériel", () => {
  test.beforeEach(async ({ page }) => {
    await connecterRole(page, COMPTE_RM_EPREUVE);
    await page.goto("/tableau-de-bord");
  });

  test("la tuile « Suspendues » ouvre le registre, qui contient la fiche de l'épreuve", async ({
    page,
  }) => {
    const tuile = page.locator('[data-bloc="kpi-suspendues"]');
    await expect(tuile).toBeVisible();
    await tuile.locator("a").click();
    await page.waitForURL(/\/interventions\?vue=bloquees/);
    await expect(
      page.locator(`[href*="${idSuspendue}"]`).first(),
    ).toBeVisible();
  });

  test("« Aujourd'hui, par technicien » nomme le technicien de l'épreuve", async ({
    page,
  }) => {
    await expect(page.getByText(NOM_TECHNICIEN).first()).toBeVisible();
  });

  test("« Charge des 4 prochaines semaines » est visible, sans tuile « Réserves VGP »", async ({
    page,
  }) => {
    await expect(
      page.getByText(fr["tableau_de_bord.bloc_charge4_titre"]),
    ).toBeVisible();
    await expect(page.locator('[data-bloc="kpi-reserves-vgp"]')).toHaveCount(0);
  });

  test("« Priorités opérationnelles » n'a pas la catégorie Contrôle", async ({
    page,
  }) => {
    const options = await page.locator("#priorite option").allTextContents();
    expect(options.join(" ")).not.toContain(
      fr["tableau_de_bord.categorie_qualite"],
    );
  });
});

test.describe("responsable SAV", () => {
  test.beforeEach(async ({ page }) => {
    await connecterRole(page, COMPTE_RS_EPREUVE);
    await page.goto("/tableau-de-bord");
  });

  test("la tuile « À contrôler » ouvre le registre, qui contient la fiche terminée de l'épreuve", async ({
    page,
  }) => {
    const tuile = page.locator('[data-bloc="kpi-a-controler"]');
    await expect(tuile).toBeVisible();
    await tuile.locator("a").click();
    await page.waitForURL(/\/interventions\?vue=a_controler/);
    await expect(page.locator(`[href*="${idTerminee}"]`).first()).toBeVisible();
  });

  test("« Terminées : valider le rapport, puis clôturer » nomme le client absent de l'épreuve", async ({
    page,
  }) => {
    await expect(
      page.getByText(fr["tableau_de_bord.bloc_controle_absent"]).first(),
    ).toBeVisible();
    await expect(
      page.locator(`a[href*="${idTerminee}"]`).first(),
    ).toBeVisible();
  });

  test("« Priorités opérationnelles » a la catégorie Contrôle, pas « À planifier ou transmettre »", async ({
    page,
  }) => {
    const options = await page.locator("#priorite option").allTextContents();
    expect(options.join(" ")).toContain(
      fr["tableau_de_bord.categorie_qualite"],
    );
    expect(options.join(" ")).not.toContain(
      fr["tableau_de_bord.categorie_planning"],
    );
  });
});
