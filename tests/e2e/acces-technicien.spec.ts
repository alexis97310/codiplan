import { existsSync, readFileSync, writeFileSync } from "node:fs";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { instantDuJour, jourDe, maintenant } from "@/lib/calendar/fuseau";
import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { FICHIER_COURRIELS_CAPTURES } from "./setup/courriel-captures";
import { reperesDeLaScene } from "./setup/reperes";
import { COMPTE_ADMIN_SOCIETE_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * 9DJ-TP-ACC1-DONNER-ACCES (D162) — DONNER L'ACCÈS À UN TECHNICIEN, DE BOUT
 * EN BOUT.
 *
 * ## Ce que ce fichier mesure, et que rien d'autre ne mesure
 *
 * Les épreuves d'isolation (`tests/isolation/acces-technicien.test.ts`)
 * prouvent que `envoyerLienDAcces` écrit les bonnes lignes sous les bonnes
 * politiques. Elles ne peuvent pas prouver qu'un administrateur qui clique
 * « Envoyer le lien d'accès » depuis Équipe reçoit réellement un courriel
 * exploitable, ni que le lien qu'il porte mène, pour de vrai, un technicien
 * jusqu'à SON terrain. C'est ce que ce fichier joue, à travers un navigateur.
 *
 * ## LE COURRIEL EST DOUBLÉ, AU NIVEAU DU SERVEUR
 *
 * Même mécanique qu'`avertissements-1.spec.ts` : `double-courriel.cjs`
 * intercepte les appels vers `api.resend.com` et consigne chaque corps dans
 * `FICHIER_COURRIELS_CAPTURES` — c'est le seul moyen de lire, depuis le
 * PROCESSUS Playwright, le lien que le PROCESSUS serveur a composé.
 *
 * ## DEUX PAGES, DEUX IDENTITÉS
 *
 * La session de l'administrateur et celle du technicien ne peuvent pas
 * partager la même page : un cookie écraserait l'autre (même raison que
 * `9dd-pg-g14c-terrain-transmises.spec.ts`, « après Transmettre »).
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `9DJ-ACC`
 *
 * Créée en `beforeAll` (le client, le site, l'intervention) et par le GESTE
 * lui-même (le technicien, par Équipe) ; tout est supprimé en `afterAll`.
 * Aucune ligne de `SCENE.*` n'est ni lue ni écrite.
 */
test.describe.configure({ mode: "serial" });

const NOM_TECHNICIEN = fr["acces9dj.e2e.nom"];
// Jamais `@codima.test` ici : cette adresse ne traverse aucune requête
// d'écran (elle n'est que remplie, jamais recherchée à l'écran), et le
// gardien de D29 (`tests/unit/i18n/sans-nom-de-societe.test.ts`) ferme son
// exclusion à `equipe.e2e.courriel` — une seconde adresse CODIMA au
// dictionnaire la romprait pour rien.
const COURRIEL_TECHNICIEN = "technicien@9djacc.e2e.test";
const MOT_DE_PASSE_CHOISI = "mot-de-passe-9djacc-epreuve";

const CLIENT_ID = uuidv7();
const SITE_ID = uuidv7();
const INTERVENTION_ID = uuidv7();

let societeId = "";
let fuseau = "";
let agenceId = "";
let utilisateurId = "";

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  societeId = reperes.societeId;
  fuseau = reperes.fuseau;

  const client = admin();
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societeId, code: "DUCOS" },
      select: { id: true },
    });
    agenceId = agence.id;

    await client.client.create({
      data: {
        id: CLIENT_ID,
        societe_id: societeId,
        raison_sociale: fr["acces9dj.e2e.client"],
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_ID,
        societe_id: societeId,
        client_id: CLIENT_ID,
        agence_id: agenceId,
        libelle: fr["acces9dj.e2e.site"],
      },
    });

    if (existsSync(FICHIER_COURRIELS_CAPTURES)) {
      writeFileSync(FICHIER_COURRIELS_CAPTURES, "");
    }
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    // LE COMPTEUR (« Démarrer »/« Mettre en pause ») ÉCRIT UN SEGMENT DE
    // TRAVAIL : il nomme l'intervention par clé étrangère, et doit donc
    // partir AVANT elle.
    await client.$executeRawUnsafe(
      `DELETE FROM "segment_travail" WHERE intervention_id = $1::uuid`,
      INTERVENTION_ID,
    );
    await client.$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE id = $1::uuid`,
      INTERVENTION_ID,
    );
    await client.site.deleteMany({ where: { id: SITE_ID } });
    await client.client.deleteMany({ where: { id: CLIENT_ID } });
    if (utilisateurId !== "") {
      // DEUX TRACES NOMMENT CETTE IDENTITÉ : celles de l'ADMINISTRATEUR, qui
      // la nomment dans `detail` (voir `lib/auth/acces-technicien.ts`, D162),
      // et celle que SA PROPRE connexion écrit (bascule de société) — auteur
      // le technicien lui-même.
      await client.$executeRawUnsafe(
        `DELETE FROM "journal_acces" WHERE detail LIKE '%cible:' || $1`,
        utilisateurId,
      );
      await client.$executeRawUnsafe(
        `DELETE FROM "journal_acces" WHERE utilisateur_id = $1::uuid`,
        utilisateurId,
      );
      await client.$executeRawUnsafe(
        `DELETE FROM "session" WHERE utilisateur_id = $1::uuid`,
        utilisateurId,
      );
      await client.$executeRawUnsafe(
        `DELETE FROM "compte" WHERE utilisateur_id = $1::uuid`,
        utilisateurId,
      );
      await client.technicien.deleteMany({
        where: { utilisateur_id: utilisateurId },
      });
      await client.utilisateurSociete.deleteMany({
        where: { utilisateur_id: utilisateurId },
      });
      await client.utilisateur.deleteMany({ where: { id: utilisateurId } });
    }
  } finally {
    await client.$disconnect();
  }
});

/** Un corps de requête Resend, tel que `double-courriel.cjs` le consigne. */
type CorpsIntercepte = {
  readonly to: readonly string[];
  readonly text: string;
};

function courrielsCaptures(): CorpsIntercepte[] {
  if (!existsSync(FICHIER_COURRIELS_CAPTURES)) {
    return [];
  }
  return readFileSync(FICHIER_COURRIELS_CAPTURES, "utf8")
    .split("\n")
    .filter((ligne) => ligne.trim().length > 0)
    .map((ligne) => JSON.parse(ligne) as CorpsIntercepte);
}

function formulaireCreationTechnicien(page: Page) {
  return page.locator('form[action="/api/techniciens/creer"]');
}

test("l'administrateur donne l'accès, le technicien choisit son mot de passe et traite son intervention", async ({
  page,
  browser,
}) => {
  // ── 1. L'ADMINISTRATEUR CRÉE LE TECHNICIEN, DEPUIS ÉQUIPE ────────────────
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
  await page.goto("/parametres/equipe");

  const formulaireCreation = formulaireCreationTechnicien(page);
  await formulaireCreation.getByLabel(fr["equipe.nom"]).fill(NOM_TECHNICIEN);
  await formulaireCreation
    .getByLabel(fr["equipe.email"])
    .fill(COURRIEL_TECHNICIEN);
  const options = formulaireCreation.locator('select[name="agence_id"] option');
  await expect(options.nth(1)).toBeAttached();
  const valeurAgence = await options.nth(1).getAttribute("value");
  await formulaireCreation
    .locator('select[name="agence_id"]')
    .selectOption(valeurAgence ?? "");
  // QG-9 (D163) : le statut de ressource est obligatoire, sans valeur choisie
  // d'avance — la PREMIÈRE valeur réelle proposée (« Salarié »).
  await formulaireCreation
    .locator('select[name="statut_ressource"]')
    .selectOption("salarie");
  await formulaireCreation
    .getByRole("button", { name: fr["equipe.creer_action"] })
    .click();
  await page.waitForLoadState("networkidle");
  await expect(page.locator("[role='status']")).toHaveCount(0);

  const client = admin();
  try {
    const identite = await client.utilisateur.findFirstOrThrow({
      where: { email: COURRIEL_TECHNICIEN },
      select: { id: true },
    });
    utilisateurId = identite.id;

    // L'INTERVENTION, AFFECTÉE À CE TECHNICIEN PAR LE TEST — aujourd'hui, dans
    // le fuseau de la société (même discipline que `avertissements-1.spec.ts`).
    const aujourdHui = jourDe(maintenant(fuseau).local);
    await client.$executeRawUnsafe(
      `INSERT INTO "intervention"
         ("id", "societe_id", "client_id", "site_id", "agence_id", "type",
          "statut", "technicien_id", "date_planifiee", "duree_estimee_min",
          "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif',
               'affectee', $6::uuid, $7::date, 60, now())`,
      INTERVENTION_ID,
      societeId,
      CLIENT_ID,
      SITE_ID,
      agenceId,
      utilisateurId,
      instantDuJour(aujourdHui),
    );
  } finally {
    await client.$disconnect();
  }

  // ── 2. « ENVOYER LE LIEN D'ACCÈS » ────────────────────────────────────────
  const fiche = page
    .locator("details")
    .filter({ hasText: NOM_TECHNICIEN })
    .filter({ has: page.locator("form") });
  await expect(fiche).toBeVisible();
  await fiche.locator("summary").click();
  await fiche
    .locator(`form[action="/api/equipe/${utilisateurId}/envoyer-acces"]`)
    .getByRole("button")
    .click();
  await page.waitForLoadState("networkidle");
  await expect(page.getByText(fr["equipe.acces.envoye"])).toBeVisible();

  // ── 3. LE LIEN, RELU DANS LE FICHIER DES COURRIELS INTERCEPTÉS ───────────
  const correspondant = courrielsCaptures().find((courriel) =>
    courriel.to.includes(COURRIEL_TECHNICIEN),
  );
  expect(correspondant).toBeDefined();
  const urlPremierAcces = /https?:\/\/\S+/.exec(correspondant?.text ?? "")?.[0];
  expect(urlPremierAcces).toBeDefined();

  // ── 4. LE TECHNICIEN, SUR SA PROPRE PAGE ─────────────────────────────────
  const pageTechnicien = await browser.newPage();
  await pageTechnicien.goto(urlPremierAcces ?? "");
  await pageTechnicien
    .getByLabel(fr["premier_acces.mot_de_passe"])
    .fill(MOT_DE_PASSE_CHOISI);
  await pageTechnicien
    .getByLabel(fr["premier_acces.confirmation"])
    .fill(MOT_DE_PASSE_CHOISI);
  await pageTechnicien
    .getByRole("button", { name: fr["premier_acces.valider"] })
    .click();
  await pageTechnicien.waitForLoadState("networkidle");
  await expect(pageTechnicien).toHaveURL(/\/connexion/);
  await expect(
    pageTechnicien.getByText(fr["premier_acces.abouti"]),
  ).toBeVisible();

  // ── 5. CONNEXION, PUIS L'ARRIVÉE AU TERRAIN ──────────────────────────────
  await pageTechnicien
    .getByLabel(fr["connexion.email"])
    .fill(COURRIEL_TECHNICIEN);
  await pageTechnicien
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_CHOISI);
  await pageTechnicien
    .getByRole("button", { name: fr["connexion.valider"] })
    .click();
  await expect(pageTechnicien).toHaveURL(/\/terrain$/);

  // ── 6. L'INTERVENTION QUE LE TEST LUI A AFFECTÉE ─────────────────────────
  await pageTechnicien.goto(`/terrain/${INTERVENTION_ID}`);
  await pageTechnicien
    .getByRole("button", { name: fr["terrain.compteur.demarrer"] })
    .click();
  // LE LIBELLÉ PORTE DÉSORMAIS L'HEURE DE DÉPART (9DI-TP-TER1-JOURNEE-FICHE,
  // TR-16) — « Le compteur tourne. » devient « Le compteur tourne depuis
  // HH:MM » ; le PRÉFIXE ET l'heure sont confrontés ensemble (relecture de
  // 9DI, T1 : un préfixe seul ne prouve pas que l'heure est bien rendue).
  await expect(
    pageTechnicien.getByText(
      new RegExp(`${fr["terrain.compteur.tourne_depuis"]} \\d{2}:\\d{2}`),
    ),
  ).toBeVisible();
  await pageTechnicien
    .getByRole("button", { name: fr["terrain.compteur.pause"] })
    .click();
  await expect(
    pageTechnicien.getByText(
      new RegExp(`${fr["terrain.compteur.tourne_depuis"]} \\d{2}:\\d{2}`),
    ),
  ).toHaveCount(0);

  await pageTechnicien.close();
});
