import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { Role } from "@/lib/auth/roles";
import { fr } from "@/lib/i18n";
import { uuidv7 } from "@/lib/db/uuid";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { COMPTE_ADMIN_SOCIETE_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * 9EY-EQUIPE-ALERTE-TOUT-ENVOYER — l'alerte « N personnes ne peuvent pas
 * encore se connecter », « Tout envoyer », « Renouveler <CODE> ».
 *
 * SA PROPRE SCÈNE, PRÉFIXÉE `zz9EY-` — deux techniciens sans accès créés en
 * `beforeAll`, un troisième porteur d'une habilitation EXPIRÉE ; tout est
 * supprimé en `afterAll`. Jamais `SCENE.*` modifiée.
 *
 * **La scène PARTAGÉE porte déjà, par d'autres spécifications, un nombre
 * INCONNU de personnes sans accès actif** — ce fichier n'affirme donc JAMAIS
 * un total exact (« 2 personnes »), seulement que NOS deux techniciens
 * apparaissent dans la liste.
 *
 * ## CE QUE CE FICHIER NE COUVRE PAS, ET POURQUOI (budget de temps, et sûreté
 * de la scène partagée)
 *
 * Le scénario (b) N'ACTIONNE PAS le clic final « Envoyer les N liens » —
 * mesuré : la route calcule sa population sur TOUTE la société active (par
 * construction, point 1), jamais filtrée sur nos deux fixtures. La jouer
 * enverrait aussi un lien à CHAQUE AUTRE personne sans accès actif de la
 * scène PARTAGÉE au moment où cette épreuve tourne — dont des fixtures
 * d'autres spécifications (mesuré : casse
 * `9eg2-tableau-de-bord-direction-admin.spec.ts`, qui suppose son propre
 * technicien « sans accès actif » intact). L'envoi réel (succès, échec
 * partiel, décompte du bandeau de retour) est couvert sans aucun effet de
 * bord par `tests/unit/equipe/envoyer-acces-tous.test.ts`. Un scénario
 * d'envoi PARTIELLEMENT raté exigerait en plus de forcer un canal courriel en
 * échec pour UNE seule cible — également hors du budget de ce lot, et
 * couvert par le même fichier unitaire. L'isolement inter-société de la
 * population de « Tout envoyer » est couvert au niveau unitaire (même
 * fichier, « la population est calculée par la route ») et au niveau du
 * dépôt (`tests/isolation/acces-technicien.test.ts`,
 * `tests/isolation/acces-bureau.test.ts`).
 */
test.describe.configure({ mode: "serial" });

const PREFIXE = "zz9EY-";
const EMAIL_1 = `${PREFIXE.toLowerCase()}un@codima.test`;
const EMAIL_2 = `${PREFIXE.toLowerCase()}deux@codima.test`;
const NOM_1 = `${PREFIXE}Technicien sans accès 1`;
const NOM_2 = `${PREFIXE}Technicien sans accès 2`;
const EMAIL_RENOUVELER = `${PREFIXE.toLowerCase()}renouveler@codima.test`;
const NOM_RENOUVELER = `${PREFIXE}Technicien à renouveler`;
const CODE_HABILITATION = `${PREFIXE}REN`;

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

let societeId = "";
let agenceId = "";
let utilisateurId1 = "";
let utilisateurId2 = "";
let utilisateurIdRenouveler = "";
let habilitationId = "";
let attributionId = "";

async function creerTechnicienSansAcces(
  client: PrismaClient,
  nom: string,
  email: string,
): Promise<string> {
  const utilisateur = await client.utilisateur.create({
    data: { id: uuidv7(), nom, email },
    select: { id: true },
  });
  await client.utilisateurSociete.create({
    data: {
      id: uuidv7(),
      utilisateur_id: utilisateur.id,
      societe_id: societeId,
      role: Role.technicien,
    },
  });
  await client.technicien.create({
    data: {
      id: uuidv7(),
      societe_id: societeId,
      utilisateur_id: utilisateur.id,
      agence_id: agenceId,
      actif: true,
      statut_ressource: "salarie",
    },
  });
  return utilisateur.id;
}

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  societeId = reperes.societeId;

  const client = admin();
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societeId, actif: true },
      select: { id: true },
    });
    agenceId = agence.id;

    utilisateurId1 = await creerTechnicienSansAcces(client, NOM_1, EMAIL_1);
    utilisateurId2 = await creerTechnicienSansAcces(client, NOM_2, EMAIL_2);
    utilisateurIdRenouveler = await creerTechnicienSansAcces(
      client,
      NOM_RENOUVELER,
      EMAIL_RENOUVELER,
    );

    const hier = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const ilYA2Ans = new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000);
    const habilitation = await client.habilitation.create({
      data: {
        id: uuidv7(),
        societe_id: societeId,
        code: CODE_HABILITATION,
        libelle: `Habilitation ${CODE_HABILITATION}`,
        actif: true,
      },
      select: { id: true },
    });
    habilitationId = habilitation.id;
    const attribution = await client.technicienHabilitation.create({
      data: {
        id: uuidv7(),
        societe_id: societeId,
        utilisateur_id: utilisateurIdRenouveler,
        habilitation_id: habilitationId,
        date_obtention: ilYA2Ans,
        date_expiration: hier,
      },
      select: { id: true },
    });
    attributionId = attribution.id;
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    if (attributionId !== "") {
      await client.technicienHabilitation.deleteMany({
        where: { id: attributionId },
      });
    }
    if (habilitationId !== "") {
      await client.habilitation.deleteMany({ where: { id: habilitationId } });
    }
    for (const utilisateurId of [
      utilisateurId1,
      utilisateurId2,
      utilisateurIdRenouveler,
    ]) {
      if (utilisateurId === "") continue;
      await client.$executeRawUnsafe(
        `DELETE FROM "journal_acces" WHERE detail LIKE '%cible:' || $1 OR utilisateur_id = $1::uuid`,
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

test("(a) l'alerte liste nos deux techniciens, et « Voir les » ouvre `?acces=a-ouvrir`", async ({
  page,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
  await page.goto("/parametres/equipe");

  const alerte = page.getByText(/ne peu(t|vent) pas encore se connecter\./);
  await expect(alerte).toBeVisible();

  const lienVoir = page.getByRole("link", { name: /^Voir/ }).first();
  await lienVoir.click();
  await expect(page).toHaveURL(/acces=a-ouvrir/);
  const tableau = page.getByRole("table");
  await expect(tableau.locator("tr", { hasText: NOM_1 })).toBeVisible();
  await expect(tableau.locator("tr", { hasText: NOM_2 })).toBeVisible();
});

test("(b) « Tout envoyer » liste nos deux techniciens, prêts à recevoir un lien", async ({
  page,
}) => {
  // LE CLIC SUR « ENVOYER LES N LIENS » N'EST PAS JOUÉ ICI — la population
  // est calculée CÔTÉ SERVEUR sur TOUTE la société active (par construction,
  // voir le point 1), jamais filtrée sur nos deux fixtures : le jouer
  // enverrait aussi un lien à CHAQUE AUTRE personne sans accès actif de la
  // scène PARTAGÉE à l'instant où cette épreuve tourne (dont des fixtures
  // d'autres spécifications), et romprait leurs propres hypothèses d'état
  // pristine. L'envoi réel (succès, échec partiel, décompte du bandeau de
  // retour) est éprouvé au niveau unitaire, sans effet de bord possible
  // (`tests/unit/equipe/envoyer-acces-tous.test.ts`).
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
  await page.goto("/parametres/equipe");

  await page
    .getByRole("button", { name: fr["equipe.alerte.tout_envoyer"] })
    .click();
  const dialogue = page.getByRole("dialog");
  await expect(dialogue).toBeVisible();
  await expect(dialogue.locator("li", { hasText: NOM_1 })).toBeVisible();
  await expect(dialogue.locator("li", { hasText: NOM_2 })).toBeVisible();
  await expect(
    dialogue.getByRole("button", { name: /^Envoyer/ }),
  ).toBeVisible();
});

test("(d) « Renouveler <CODE> » d'une habilitation expirée la rend neutre, « jusqu'au … »", async ({
  page,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
  await page.goto("/parametres/equipe");

  const ligne = page.locator("tr", { hasText: NOM_RENOUVELER });
  await expect(
    ligne.getByText(fr["equipe.tableau.habilitation.expiree_prefixe"], {
      exact: false,
    }),
  ).toBeVisible();

  await ligne
    .locator("button", { hasText: `Renouveler ${CODE_HABILITATION}` })
    .click();
  const dialogue = page.getByRole("dialog");
  await expect(dialogue).toBeVisible();
  await dialogue.locator('input[name="date_obtention"]').fill("2026-01-01");
  await dialogue.locator('input[name="date_expiration"]').fill("2030-01-01");
  await dialogue
    .getByRole("button", { name: fr["habilitations.enregistrer"] })
    .click();
  await page.waitForLoadState("networkidle");

  const ligneApres = page.locator("tr", { hasText: NOM_RENOUVELER });
  await expect(
    ligneApres.getByText(fr["equipe.tableau.habilitation.jusquau_prefixe"], {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    ligneApres.getByText(fr["equipe.tableau.habilitation.expiree_prefixe"], {
      exact: false,
    }),
  ).toHaveCount(0);
});

test("(e) à 375px : l'alerte et son dialogue restent utilisables, sans débordement horizontal", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 1200 });
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
  await page.goto("/parametres/equipe");

  await expect(
    page.getByText(/ne peu(t|vent) pas encore se connecter\./),
  ).toBeVisible();
  const largeurDocument = await page.evaluate(
    () => document.documentElement.scrollWidth,
  );
  expect(largeurDocument).toBeLessThanOrEqual(375);
});
