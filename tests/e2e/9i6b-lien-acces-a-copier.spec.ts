import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { COMPTE_ADMIN_SOCIETE_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible, ouvrirUneSession } from "./setup/session";

/**
 * 9I6B-LIEN-ACCES-A-COPIER (D170, 29/10/2026) — « COPIER LE LIEN D'ACCÈS »,
 * DE BOUT EN BOUT.
 *
 * ## Pourquoi ce fichier existe, et ce que lui seul mesure
 *
 * Sans nom de domaine, Resend refuse les courriels adressés à quiconque
 * n'est pas Alexis (`tests/e2e/acces-technicien.spec.ts` double le courriel
 * pour le prouver EN LE LISANT) : CE fichier prouve le chemin de secours —
 * l'administrateur COPIE le lien lui-même, par un vrai clic, un vrai
 * presse-papiers, et le transmet. Les épreuves d'isolation
 * (`tests/isolation/acces-technicien.test.ts`,
 * `tests/isolation/acces-bureau.test.ts`) prouvent déjà que la fonction
 * refuse les bons rôles et les bonnes sociétés ; ce fichier prouve que le
 * BOUTON, le PRESSE-PAPIERS et la PAGE DE PREMIER ACCÈS s'enchaînent pour de
 * vrai, et qu'aucune réponse ni aucune page ne montre jamais le lien copié
 * en clair après le fait.
 *
 * ## CE QUE CE FICHIER NE REJOUE PAS
 *
 * La création d'un technicien par le volet « Ajouter une personne » est déjà
 * prouvée par `tests/e2e/acces-technicien.spec.ts` et
 * `tests/e2e/equipe.spec.ts` — ce fichier crée directement sa propre
 * identité en base (même geste que `creerTechnicienDeB` des épreuves
 * d'isolation), pour aller plus vite au geste qui lui est propre : copier.
 *
 * ## LE REFUS D'UN ADMIN D'UNE AUTRE SOCIÉTÉ (requête forgée)
 *
 * Mesuré au niveau isolation (`tests/isolation/acces-technicien.test.ts`,
 * « une requête forgée depuis une AUTRE société »), PAS ici : la route
 * (`app/api/equipe/[id]/copier-lien/route.ts`) n'ajoute RIEN à
 * `exigerCapacite` puis l'appel direct de `copierLienDAcces` — l'épreuve
 * d'isolation EST la requête forgée, au même titre qu'un appel HTTP avec un
 * cookie d'une autre société. Rejouer un second compte `admin_societe` ici
 * n'aurait prouvé rien de plus, pour le prix d'une seconde société à
 * enrôler dans ce harnais. Voir la passation.
 */
test.describe.configure({ mode: "serial" });

const NOM_TECHNICIEN = fr["acces9i6b.e2e.nom"];
const COURRIEL_TECHNICIEN = "technicien@9i6b.e2e.test";
const MOT_DE_PASSE_CHOISI = "mot-de-passe-9i6b-epreuve";

let societeId = "";
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

  const client = admin();
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societeId, code: "DUCOS" },
      select: { id: true },
    });
    agenceId = agence.id;

    utilisateurId = uuidv7();
    await client.utilisateur.create({
      data: {
        id: utilisateurId,
        nom: NOM_TECHNICIEN,
        email: COURRIEL_TECHNICIEN,
      },
    });
    await client.utilisateurSociete.create({
      data: {
        id: uuidv7(),
        utilisateur_id: utilisateurId,
        societe_id: societeId,
        role: "technicien",
      },
    });
    await client.technicien.create({
      data: {
        id: uuidv7(),
        societe_id: societeId,
        utilisateur_id: utilisateurId,
        agence_id: agenceId,
        actif: true,
        statut_ressource: "salarie",
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  if (utilisateurId === "") {
    return;
  }
  const client = admin();
  try {
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
  } finally {
    await client.$disconnect();
  }
});

/** La fiche de CE technicien, dans l'onglet Techniciens — même repère que `acces-technicien.spec.ts`. */
function ficheDuTechnicien(page: Page) {
  return page
    .locator("details")
    .filter({ hasText: NOM_TECHNICIEN })
    .filter({ has: page.locator("form") });
}

test("l'administrateur copie le lien, le technicien choisit son mot de passe ailleurs et se connecte", async ({
  page,
  browser,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
  // LE PRESSE-PAPIERS DU NAVIGATEUR — accordé AVANT le clic, jamais après :
  // `navigator.clipboard.writeText` échouerait sans cette permission, et le
  // bouton basculerait sur son repli (champ en lecture seule) plutôt que de
  // prouver le chemin principal.
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);

  await page.goto("/parametres/equipe");
  const fiche = ficheDuTechnicien(page);
  await expect(fiche).toBeVisible();
  await fiche.locator("summary").click();

  await fiche
    .getByRole("button", { name: fr["equipe.acces.copier_lien"], exact: true })
    .click();
  await expect(fiche.getByText(fr["equipe.acces.lien_copie"])).toBeVisible();

  const urlCopiee = await page.evaluate(() => navigator.clipboard.readText());
  expect(urlCopiee).toMatch(/^https?:\/\//);

  // AUCUNE PAGE NE MONTRE JAMAIS LE LIEN COPIÉ EN CLAIR — ni la page qui
  // vient de le copier, une fois rechargée, ni aucune autre réponse de ce
  // scénario.
  await page.reload();
  await expect(page.locator("body")).not.toContainText(urlCopiee);

  // ── LE TECHNICIEN, SUR SA PROPRE PAGE, DANS UN AUTRE CONTEXTE ────────────
  //
  // Deux pages, deux identités (même raison que `acces-technicien.spec.ts`) :
  // un cookie écraserait l'autre si elles partageaient la même page.
  const pageTechnicien = await browser.newPage();
  await pageTechnicien.goto(urlCopiee);
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

  await pageTechnicien.close();
});

test("un rôle sans droit (ADV) est refusé par la route elle-même — requête forgée", async ({
  browser,
}) => {
  const pageAdv = await browser.newPage();
  await ouvrirUneSession(pageAdv);

  const reponse = await pageAdv.request.post(
    `/api/equipe/${utilisateurId}/copier-lien`,
  );
  expect(reponse.status()).toBe(403);
  expect(await reponse.json()).toEqual({ erreur: "acces_refuse" });

  await pageAdv.close();
});
