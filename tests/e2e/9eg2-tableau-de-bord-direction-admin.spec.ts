import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { creerAuth } from "@/lib/auth/config";
import { Role } from "@/lib/auth/roles";
import {
  instantDuJour,
  jourDe,
  jourSuivant,
  maintenant,
} from "@/lib/calendar/fuseau";
import { avecContexteRls } from "@/lib/db/rls";
import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import {
  COMPTE_ADMIN_SOCIETE_EPREUVE,
  MOT_DE_PASSE_EPREUVE,
} from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * 9EG2-TP-UX6-TABLEAU-DE-BORD-2 — LA DIRECTION ET L'ADMINISTRATEUR DE
 * SOCIÉTÉ, SUR UNE FIXTURE PROPRE (9EG-TP-UX6-TABLEAU-DE-BORD-2, D189).
 *
 * SA PROPRE SCÈNE, préfixée `9EG2-` — jamais `SCENE.*` : un technicien sans
 * accès, deux habilitations (une expirée, une à renouveler sous 60 jours),
 * un client, un site, une P1 à planifier, une intervention clôturée ce mois,
 * un lot d'import en contrôle. L'administrateur réutilise le compte déjà posé
 * par la scène partagée (`COMPTE_ADMIN_SOCIETE_EPREUVE`) ; la direction est
 * une identité CRÉÉE PAR CE FICHIER (modèle `captures-9dx-retouches-11-
 * parametres.spec.ts`), jamais une identité de `scene.ts`.
 *
 * Les comptages sont RELATIFS : chaque tuile et chaque décompte sont
 * comparés au contenu de la liste que leur lien ouvre, jamais à un nombre
 * absolu sur la société partagée (piège connu, `fullyParallel`).
 */
test.describe.configure({ mode: "serial" });

const SOCIETE_CODE = "CODIMA-NC";
const PREFIXE = "9EG2-";
const EMAIL_DIRECTION = `${PREFIXE.toLowerCase()}direction@codima.test`;
const NOM_DIRECTION = "9EG2- Direction de l'épreuve";
const NOM_TECHNICIEN = "9EG2- Technicien sans accès";
const CODE_HAB_EXPIREE = "9EG2-EXP";
const CODE_HAB_J60 = "9EG2-J60";

let societeId = "";
let fuseau = "Pacific/Noumea";

let utilisateurDirectionId = "";

let utilisateurTechnicienId = "";
let utilisateurSocieteTechnicienId = "";
let technicienId = "";

let habilitationExpireeId = "";
let habilitationJ60Id = "";
let attributionExpireeId = "";
let attributionJ60Id = "";

let clientId = "";
let siteId = "";
let idP1APlanifier = "";
let idClotureeCeMois = "";
let idSuspendueAvecPiece = "";

let lotId = "";

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

function urlApplicative(): string {
  const url = new URL(urlAdministration());
  url.username = "codiplan_app";
  url.password = "";
  return url.toString();
}

async function creerDirection(): Promise<void> {
  const applicatif = new PrismaClient({
    datasources: { db: { url: urlApplicative() } },
  });
  try {
    const authAdmin = creerAuth(applicatif, {
      societeId,
      role: Role.admin_societe,
    });
    const cree = await authAdmin.api.signUpEmail({
      body: {
        email: EMAIL_DIRECTION,
        password: MOT_DE_PASSE_EPREUVE,
        name: NOM_DIRECTION,
      },
    });
    utilisateurDirectionId = cree.user.id;
    await avecContexteRls(
      applicatif,
      { societeId, role: Role.admin_societe },
      (tx) =>
        tx.$executeRawUnsafe(
          `INSERT INTO "utilisateur_societe" ("id","utilisateur_id","societe_id","role")
             VALUES ($1::uuid, $2::uuid, $3::uuid, $4::"Role")`,
          uuidv7(),
          utilisateurDirectionId,
          societeId,
          Role.direction,
        ),
    );
  } finally {
    await applicatif.$disconnect();
  }
}

async function ecrireLaScene(): Promise<void> {
  const client = admin();
  try {
    const societe = await client.societe.findFirstOrThrow({
      where: { code: SOCIETE_CODE },
      select: { id: true, fuseau_horaire: true },
    });
    societeId = societe.id;
    fuseau = societe.fuseau_horaire;
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societeId },
      select: { id: true },
      orderBy: { code: "asc" },
    });

    const { local } = maintenant(fuseau);
    const jour = jourDe(local);
    const debutDuMois = instantDuJour({ ...jour, jour: 1 });
    const finDuMois = instantDuJour(jourSuivant({ ...jour, jour: 1 }, 1));

    utilisateurTechnicienId = uuidv7();
    utilisateurSocieteTechnicienId = uuidv7();
    technicienId = uuidv7();
    await client.utilisateur.create({
      data: {
        id: utilisateurTechnicienId,
        nom: NOM_TECHNICIEN,
        email: `${PREFIXE.toLowerCase()}technicien@codima.test`,
      },
    });
    await client.utilisateurSociete.create({
      data: {
        id: utilisateurSocieteTechnicienId,
        utilisateur_id: utilisateurTechnicienId,
        societe_id: societeId,
        role: Role.technicien,
      },
    });
    await client.technicien.create({
      data: {
        id: technicienId,
        societe_id: societeId,
        utilisateur_id: utilisateurTechnicienId,
        agence_id: agence.id,
        actif: true,
      },
    });

    habilitationExpireeId = uuidv7();
    habilitationJ60Id = uuidv7();
    await client.habilitation.create({
      data: {
        id: habilitationExpireeId,
        societe_id: societeId,
        code: CODE_HAB_EXPIREE,
        libelle: "9EG2- Habilitation expirée",
        actif: true,
      },
    });
    await client.habilitation.create({
      data: {
        id: habilitationJ60Id,
        societe_id: societeId,
        code: CODE_HAB_J60,
        libelle: "9EG2- Habilitation à renouveler",
        actif: true,
      },
    });

    const hier = instantDuJour(jourSuivant(jour, -1));
    const dansTrenteJours = instantDuJour(jourSuivant(jour, 30));
    attributionExpireeId = uuidv7();
    attributionJ60Id = uuidv7();
    await client.technicienHabilitation.create({
      data: {
        id: attributionExpireeId,
        societe_id: societeId,
        utilisateur_id: utilisateurTechnicienId,
        habilitation_id: habilitationExpireeId,
        date_obtention: new Date("2020-01-01T00:00:00.000Z"),
        date_expiration: hier,
      },
    });
    await client.technicienHabilitation.create({
      data: {
        id: attributionJ60Id,
        societe_id: societeId,
        utilisateur_id: utilisateurTechnicienId,
        habilitation_id: habilitationJ60Id,
        date_obtention: new Date("2020-01-01T00:00:00.000Z"),
        date_expiration: dansTrenteJours,
      },
    });

    clientId = uuidv7();
    siteId = uuidv7();
    await client.client.create({
      data: {
        id: clientId,
        societe_id: societeId,
        raison_sociale: "9EG2- Client de l'épreuve",
      },
    });
    await client.site.create({
      data: {
        id: siteId,
        societe_id: societeId,
        client_id: clientId,
        agence_id: agence.id,
        libelle: "9EG2- Lieu de l'épreuve",
      },
    });

    const baseIntervention = {
      societe_id: societeId,
      agence_id: agence.id,
      client_id: clientId,
      site_id: siteId,
      type: "curatif" as const,
      mode_valorisation: "temps_passe" as const,
      devise_code: "XPF",
    };

    idP1APlanifier = uuidv7();
    await client.intervention.create({
      data: {
        ...baseIntervention,
        id: idP1APlanifier,
        priorite: "p1",
        statut: "a_planifier",
        description: "9EG2- panne P1",
        cree_le: new Date("2020-01-01T00:00:00.000Z"),
      },
    });

    idClotureeCeMois = uuidv7();
    await client.intervention.create({
      data: {
        ...baseIntervention,
        id: idClotureeCeMois,
        priorite: "p3",
        statut: "cloturee",
        description: "9EG2- clôturée ce mois",
        date_planifiee: debutDuMois,
        cloturee_le: new Date(
          Math.min(Date.now(), finDuMois.getTime() - 60_000),
        ),
      },
    });

    idSuspendueAvecPiece = uuidv7();
    await client.intervention.create({
      data: {
        ...baseIntervention,
        id: idSuspendueAvecPiece,
        priorite: "p3",
        statut: "suspendue",
        duree_estimee_min: 60,
        motif_suspension: "piece",
        piece_attendue_ref: "9EG2-PIECE",
        date_dispo_prevue: instantDuJour(jourSuivant(jour, 5)),
        suspendue_le: instantDuJour(jourSuivant(jour, -2)),
      },
    });

    lotId = uuidv7();
    await client.importLot.create({
      data: {
        id: lotId,
        societe_id: societeId,
        type_import: "9eg2_type",
        version_modele: 1,
        utilisateur_id: utilisateurTechnicienId,
        nom_fichier: "9eg2-lot-de-l-epreuve.xlsx",
        statut: "controle",
      },
    });
  } finally {
    await client.$disconnect();
  }
  await creerDirection();
}

async function effacerLaScene(): Promise<void> {
  const client = admin();
  try {
    if (utilisateurDirectionId !== "") {
      await client.journalAcces.deleteMany({
        where: { utilisateur_id: utilisateurDirectionId },
      });
      await client.utilisateurSociete.deleteMany({
        where: { utilisateur_id: utilisateurDirectionId },
      });
      await client.utilisateur.delete({
        where: { id: utilisateurDirectionId },
      });
    }
    if (lotId !== "") {
      await client.importLot.deleteMany({ where: { id: lotId } });
    }
    await client.intervention.deleteMany({
      where: {
        id: {
          in: [idP1APlanifier, idClotureeCeMois, idSuspendueAvecPiece].filter(
            Boolean,
          ),
        },
      },
    });
    await client.site.deleteMany({ where: { id: siteId } });
    await client.client.deleteMany({ where: { id: clientId } });
    await client.technicienHabilitation.deleteMany({
      where: {
        id: { in: [attributionExpireeId, attributionJ60Id].filter(Boolean) },
      },
    });
    await client.habilitation.deleteMany({
      where: {
        id: { in: [habilitationExpireeId, habilitationJ60Id].filter(Boolean) },
      },
    });
    await client.technicien.deleteMany({ where: { id: technicienId } });
    await client.utilisateurSociete.deleteMany({
      where: { id: utilisateurSocieteTechnicienId },
    });
    await client.utilisateur.deleteMany({
      where: { id: utilisateurTechnicienId },
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

async function connecterDirection(page: Page): Promise<void> {
  await ouvrirLaSessionSensible(page, EMAIL_DIRECTION);
}

async function connecterAdmin(page: Page): Promise<void> {
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
}

/**
 * LES CAPTURES — APRÈS SEULEMENT, même recette que `captures-9eg1-tableau-
 * de-bord.spec.ts` : rien n'est écrit sans `CAPTURES_9EG2=<dossier>`, et la
 * scène est celle de CE fichier (fixture propre, jamais le semis) puisque
 * direction/administrateur ont besoin des lignes qu'elle pose (technicien
 * sans accès, habilitations, lot en contrôle).
 */
const DOSSIER_CAPTURES = process.env.CAPTURES_9EG2 ?? "";

async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  if (DOSSIER_CAPTURES === "") return;
  await page.setViewportSize({ width: largeur, height: 900 });
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}-${largeur}.png`),
    fullPage: true,
  });
}

test.describe("direction", () => {
  test.beforeEach(async ({ page }) => {
    await connecterDirection(page);
    await page.goto("/tableau-de-bord");
  });

  test("la tuile « Clôturé en <mois> » ouvre le registre, qui contient la fiche clôturée de l'épreuve", async ({
    page,
  }) => {
    const tuile = page.locator('[data-bloc="kpi-cloture-en-mois"]');
    await expect(tuile).toBeVisible();
    await tuile.locator("a").click();
    await page.waitForURL(/\/interventions\?/);
    await expect(
      page.locator(`[href*="${idClotureeCeMois}"]`).first(),
    ).toBeVisible();
  });

  test("le bloc du mois affiche « Créées » et « Clôturées »", async ({
    page,
  }) => {
    await expect(
      page.getByText(fr["tableau_de_bord.bloc_mois_creees"], { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(fr["tableau_de_bord.bloc_mois_cloturees"], {
        exact: true,
      }),
    ).toBeVisible();
  });

  test("la bande « P1 à planifier » ouvre le planning, dont la file « à planifier » contient la P1 de l'épreuve", async ({
    page,
  }) => {
    // ÉCART NOMMÉ (D189, passation) : `/planning?priorite=p1&statut=a_planifier`
    // n'applique PAS ces deux paramètres à la file « à planifier »
    // (`cartesFile` = `attenteParZone`, filtrée par zone/recherche
    // seulement — mesuré sur `app/(back-office)/planning/page.tsx:1124-1152`)
    // : le CHIFFRE de la bande (P1 seules) et la LONGUEUR de cette file
    // (toute priorité) ne disent donc PAS le même nombre. Cette épreuve se
    // borne à ce qui est VRAI quel que soit l'écart : le lien mène bien à
    // l'écran, et la fiche P1 de l'épreuve y est bien présente.
    const lien = page.locator(
      'a[href*="priorite=p1"][href*="statut=a_planifier"]',
    );
    await expect(lien.first()).toBeVisible();
    await lien.first().click();
    await page.waitForURL(/\/planning\?/);
    await expect(
      page.locator(`[data-bloc="${idP1APlanifier}"]`).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("« Priorités opérationnelles » n'a que Urgences, Retards, Pièces", async ({
    page,
  }) => {
    const options = await page.locator("#priorite option").allTextContents();
    const texte = options.join(" ");
    expect(texte).toContain(fr["tableau_de_bord.categorie_urgent"]);
    expect(texte).toContain(fr["tableau_de_bord.categorie_retard"]);
    expect(texte).toContain(fr["tableau_de_bord.categorie_piece"]);
    expect(texte).not.toContain(fr["tableau_de_bord.categorie_planning"]);
    expect(texte).not.toContain(fr["tableau_de_bord.categorie_qualite"]);
  });

  test("« Charge des 4 prochaines semaines » est visible pour la direction", async ({
    page,
  }) => {
    await expect(
      page.getByText(fr["tableau_de_bord.bloc_charge4_titre"]),
    ).toBeVisible();
  });

  test("« Journal d'aujourd'hui » est visible (consulter_journal_audit)", async ({
    page,
  }) => {
    await expect(
      page.getByText(fr["tableau_de_bord.journal_titre"]),
    ).toBeVisible();
  });

  test("ni l'alerte P1 ni « Interventions sans durée » ne sont rendues pour la direction", async ({
    page,
  }) => {
    await expect(
      page.getByText(fr["tableau_de_bord.alerte_p1_bouton"]),
    ).toHaveCount(0);
    await expect(
      page.getByText(fr["tableau_de_bord.interventions_sans_duree_titre"]),
    ).toHaveCount(0);
  });

  test("capture — après (1280 et 375 px)", async ({ page }) => {
    await capturer(page, "apres-direction", 1280);
    await capturer(page, "apres-direction", 375);
  });
});

test.describe("administrateur de société", () => {
  test.beforeEach(async ({ page }) => {
    await connecterAdmin(page);
    await page.goto("/tableau-de-bord");
  });

  test("la tuile « Accès à ouvrir » ouvre l'équipe filtrée, qui contient le technicien de l'épreuve", async ({
    page,
  }) => {
    const tuile = page.locator('[data-bloc="kpi-acces-a-ouvrir"]');
    await expect(tuile).toBeVisible();
    await tuile.locator("a").click();
    await page.waitForURL(/\/parametres\/equipe\?acces=a-ouvrir/);
    await expect(page.getByText(NOM_TECHNICIEN).first()).toBeVisible();
  });

  test("le bloc « Accès à ouvrir » nomme le technicien et porte un bouton « Envoyer le lien »", async ({
    page,
  }) => {
    const ligne = page
      .locator('[data-bloc="acces-a-ouvrir-liste"] > div')
      .filter({ hasText: NOM_TECHNICIEN });
    await expect(ligne).toBeVisible();
    await expect(
      ligne.getByText(fr["tableau_de_bord.acces_aucun_lien"]),
    ).toBeVisible();
    await expect(
      ligne.getByRole("button", {
        name: fr["tableau_de_bord.acces_envoyer"],
        exact: true,
      }),
    ).toBeVisible();
  });

  test("la tuile « Import en contrôle » ouvre les imports filtrés, qui contiennent le lot de l'épreuve", async ({
    page,
  }) => {
    const tuile = page.locator('[data-bloc="kpi-import-en-controle"]');
    await expect(tuile).toBeVisible();
    await tuile.locator("a").click();
    await page.waitForURL(/\/imports\?vue=a-appliquer/);
    await expect(page.locator(`[href*="${lotId}"]`).first()).toBeVisible();
  });

  test("« Mise en route » montre une jauge « N sur 8 » et huit lignes cliquables", async ({
    page,
  }) => {
    const bloc = page.locator('[data-bloc="mise-en-route-liste"]');
    await expect(bloc).toBeVisible();
    await expect(page.getByText(/\d sur 8/)).toBeVisible();
    await expect(bloc.locator("a")).toHaveCount(8);
  });

  test("l'étape « Identité de la société » de « Mise en route » ouvre /parametres", async ({
    page,
  }) => {
    const bloc = page.locator('[data-bloc="mise-en-route-liste"]');
    await bloc.locator("a").first().click();
    await page.waitForURL(/\/parametres$/);
  });

  test("aucune carte « Priorités opérationnelles » pour l'administrateur", async ({
    page,
  }) => {
    await expect(
      page.getByText(fr["tableau_de_bord.priorites_titre"]),
    ).toHaveCount(0);
  });

  test("la bande nomme les habilitations expirées et à renouveler de l'épreuve", async ({
    page,
  }) => {
    const lienExpiree = page.locator('a[href*="echeance=expiree"]');
    await expect(lienExpiree.first()).toBeVisible();
    await lienExpiree.first().click();
    await page.waitForURL(/echeance=expiree/);
    await expect(page.getByText(NOM_TECHNICIEN).first()).toBeVisible();

    await page.goto("/tableau-de-bord");
    const lienJ60 = page.locator('a[href*="echeance=j60"]');
    await expect(lienJ60.first()).toBeVisible();
    await lienJ60.first().click();
    await page.waitForURL(/echeance=j60/);
    await expect(page.getByText(NOM_TECHNICIEN).first()).toBeVisible();
  });

  test("capture — après (1280 et 375 px) : tableau de bord, équipe filtrée, imports filtrés", async ({
    page,
  }) => {
    await page.goto("/tableau-de-bord");
    await capturer(page, "apres-administrateur", 1280);
    await capturer(page, "apres-administrateur", 375);

    await page.goto("/parametres/equipe?acces=a-ouvrir");
    await capturer(page, "apres-equipe-acces-a-ouvrir", 1280);
    await capturer(page, "apres-equipe-acces-a-ouvrir", 375);

    await page.goto("/imports?vue=a-appliquer");
    await capturer(page, "apres-imports-a-appliquer", 1280);
    await capturer(page, "apres-imports-a-appliquer", 375);
  });
});
