import { createOTP } from "@better-auth/utils/otp";
import { base32 } from "@better-auth/utils/base32";
import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { creerAuth } from "@/lib/auth/config";
import { Role } from "@/lib/auth/roles";
import { avecContexteRls } from "@/lib/db/rls";
import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { MOT_DE_PASSE_EPREUVE } from "./setup/scene";

/**
 * 9EDZ-DEMANDES-CONNEXION-MAQUETTE, partie 6 (D188) — /connexion/code AU
 * GABARIT DE LA MAQUETTE DU 28/09 : six cases, « ← Retour à la connexion »,
 * le pli de secours.
 *
 * Même patron que `tests/e2e/enrolement-secrets-hors-url.spec.ts` (sa
 * propre identité, préfixe `9edz6.`, créée par `signUpEmail` sous un
 * contexte administratif, jamais le semis ni `SCENE.*`) : il faut une
 * identité qui n'a jamais vu `/enrolement` pour atteindre `/connexion/code`
 * par le chemin normal.
 */
test.describe.configure({ mode: "serial" });

const dictionnaire = fr as Record<string, string>;

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

const EMAIL = "9edz6.direction@codima.test";
const NOM = "9EDZ6 Direction";

let utilisateurId = "";
let cleBrute = "";
let codesSecours: string[] = [];

test.beforeAll(async () => {
  const proprietaire = admin();
  let societeId = "";
  try {
    const societe = await proprietaire.societe.findFirstOrThrow({
      where: { code: "CODIMA-NC" },
      select: { id: true },
    });
    societeId = societe.id;
  } finally {
    await proprietaire.$disconnect();
  }

  const applicatif = new PrismaClient({
    datasources: { db: { url: urlApplicative() } },
  });
  try {
    const authAdmin = creerAuth(applicatif, {
      societeId,
      role: Role.admin_societe,
    });
    const cree = await authAdmin.api.signUpEmail({
      body: { email: EMAIL, password: MOT_DE_PASSE_EPREUVE, name: NOM },
    });
    utilisateurId = cree.user.id;
    await avecContexteRls(
      applicatif,
      { societeId, role: Role.admin_societe },
      (tx) =>
        tx.$executeRawUnsafe(
          `INSERT INTO "utilisateur_societe" ("id","utilisateur_id","societe_id","role")
             VALUES ($1::uuid, $2::uuid, $3::uuid, $4::"Role")`,
          uuidv7(),
          utilisateurId,
          societeId,
          Role.direction,
        ),
    );
  } finally {
    await applicatif.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.journalAcces.deleteMany({
      where: { utilisateur_id: utilisateurId },
    });
    await client.utilisateurSociete.deleteMany({
      where: { utilisateur_id: utilisateurId },
    });
    await client.utilisateur.delete({ where: { id: utilisateurId } });
  } finally {
    await client.$disconnect();
  }
});

async function seConnecter(page: Page): Promise<void> {
  await page.goto("/connexion");
  await page.getByLabel(dictionnaire["connexion.email"]).fill(EMAIL);
  await page
    .getByLabel(dictionnaire["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page
    .getByRole("button", { name: dictionnaire["connexion.valider"] })
    .click();
  await page.waitForLoadState("networkidle");
}

async function codeCourant(secret: string): Promise<string> {
  return createOTP(secret, { digits: 6, period: 30 }).totp();
}

test("l'enrôlement porte la demi-session jusqu'à /connexion/code", async ({
  page,
}) => {
  await seConnecter(page);
  await expect(page).toHaveURL(/\/enrolement$/);

  // Étape 1 — le mot de passe révèle la clé et les codes de secours (TR-36).
  await page.fill('input[name="motDePasse"]', MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["enrolement.reveler"] }).click();
  await page.waitForLoadState("networkidle");

  const affichee = (await page.locator("code").first().innerText()).replace(
    /\s+/g,
    "",
  );
  cleBrute = new TextDecoder().decode(base32.decode(affichee));
  codesSecours = await page.locator("ul li").allInnerTexts();
  expect(codesSecours.length).toBeGreaterThan(0);

  await page.fill('input[name="code"]', await codeCourant(cleBrute));
  await page.getByRole("button", { name: fr["enrolement.confirmer"] }).click();
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveURL(/\/connexion\?motif=/);

  await seConnecter(page);
  await expect(page).toHaveURL(/\/connexion\/code$/);
});

test("six cases visuelles, UN SEUL vrai champ « code »", async ({ page }) => {
  await seConnecter(page);
  await expect(page).toHaveURL(/\/connexion\/code$/);

  const forme = page.locator('form[action="/api/session/code"]');
  await expect(forme.locator('input[name="code"]')).toHaveCount(1);
  // SIX cases décoratives, en plus de l'unique vrai champ.
  await expect(forme.locator('[aria-hidden="true"] > span')).toHaveCount(6);

  await forme.locator('input[name="code"]').fill(await codeCourant(cleBrute));
  await forme
    .getByRole("button", { name: dictionnaire["connexion.code.verifier"] })
    .click();
  await page.waitForLoadState("networkidle");
  await expect(page).not.toHaveURL(/\/connexion\/code/);
});

test("un code faux affiche le message de la maquette, et reste sur /connexion/code", async ({
  page,
}) => {
  await seConnecter(page);
  await expect(page).toHaveURL(/\/connexion\/code$/);

  await page
    .locator('form[action="/api/session/code"] input[name="code"]')
    .fill("000000");
  await page
    .getByRole("button", { name: dictionnaire["connexion.code.verifier"] })
    .click();
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveURL(/\/connexion\/code\?motif=/);
  await expect(
    page.getByText(dictionnaire["connexion.code.refus"]),
  ).toBeVisible();
});

test("« ← Retour à la connexion » est PREMIER dans l'ordre du DOM, détruit la demi-session, sans boucle", async ({
  page,
}) => {
  await seConnecter(page);
  await expect(page).toHaveURL(/\/connexion\/code$/);

  // PREMIER dans l'ordre du DOM de la PAGE ELLE-MÊME — la marque (`a[href=
  // "/"]`), commune à tous les écrans sans session, précède tout le
  // contenu propre à cette page et n'entre pas dans cette comparaison.
  const retour = page.getByRole("button", {
    name: dictionnaire["connexion.code.retour"],
  });
  const titre = page.getByRole("heading", {
    name: dictionnaire["connexion.code.titre_page"],
  });
  const ordre = await page.evaluate(
    ([retourTexte, titreTexte]) => {
      const tous = Array.from(document.querySelectorAll("button, h1"));
      const r = tous.find((n) => n.textContent === retourTexte);
      const h = tous.find((n) => n.textContent === titreTexte);
      if (r === undefined || h === undefined) return null;
      return (
        (r.compareDocumentPosition(h) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
      );
    },
    [
      dictionnaire["connexion.code.retour"],
      dictionnaire["connexion.code.titre_page"],
    ],
  );
  expect(ordre).toBe(true);
  await expect(retour).toBeVisible();
  await expect(titre).toBeVisible();

  await page
    .getByRole("button", { name: dictionnaire["connexion.code.retour"] })
    .click();
  await expect(page).toHaveURL(/\/connexion$/);

  // Session MORTE : /planning renvoie vers /connexion, pas vers le défi —
  // aucune boucle de redirection.
  await page.goto("/planning");
  await expect(page).toHaveURL(/\/connexion/);
});

test("le pli de secours : aide et placeholder lus, un code de secours valide ouvre la session, un code déjà utilisé est refusé", async ({
  page,
}) => {
  await seConnecter(page);
  await expect(page).toHaveURL(/\/connexion\/code$/);

  await page.getByText(dictionnaire["connexion.code.secours.repli"]).click();
  const champSecours = page.getByLabel(
    dictionnaire["connexion.code.secours.champ"],
  );
  await expect(champSecours).toHaveAttribute(
    "placeholder",
    dictionnaire["connexion.code.secours.placeholder"],
  );
  await expect(
    page.getByText(dictionnaire["connexion.code.secours.aide"]),
  ).toBeVisible();

  const code = codesSecours[0] ?? "";
  expect(code.length).toBeGreaterThan(0);
  await champSecours.fill(code);
  await page
    .getByRole("button", {
      name: dictionnaire["connexion.code.secours.utiliser"],
    })
    .click();
  await page.waitForLoadState("networkidle");
  await expect(page).not.toHaveURL(/\/connexion\/code/);

  // LE MÊME CODE, REJOUÉ : déjà utilisé, refusé — même message que le code
  // d'application refusé (écart nommé, D188 : les deux routes partagent le
  // même motif). La session complète qui vient de s'ouvrir doit être
  // détruite d'abord, sans quoi /connexion renverrait ailleurs qu'au
  // formulaire.
  await page.request.post("/api/session/deconnexion");
  await seConnecter(page);
  await expect(page).toHaveURL(/\/connexion\/code$/);
  await page.getByText(dictionnaire["connexion.code.secours.repli"]).click();
  await page
    .getByLabel(dictionnaire["connexion.code.secours.champ"])
    .fill(code);
  await page
    .getByRole("button", {
      name: dictionnaire["connexion.code.secours.utiliser"],
    })
    .click();
  await page.waitForLoadState("networkidle");
  await expect(
    page.getByText(dictionnaire["connexion.code.refus"]),
  ).toBeVisible();
});
