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
 * 9CW-TP-S6 — LES SECRETS DU SECOND FACTEUR HORS DE L'URL, LE QR, LA
 * DÉCONNEXION, LE CODE DE SECOURS.
 *
 * ## Pourquoi SA PROPRE identité, jamais `admin.societe@` (PIÈGE CONNU du lot)
 *
 * `admin.societe@codima.test` est enrôlée UNE FOIS par
 * `tests/e2e/setup/global.ts`, avant tout worker, précisément pour que les
 * AUTRES fichiers n'aient jamais à traverser `/enrolement` elles-mêmes. Ce
 * fichier-ci éprouve l'enrôlement LUI-MÊME — la seule façon est un compte qui
 * n'a JAMAIS vu la sienne. Il la crée donc lui-même (préfixe `9cw.`), par
 * `auth.api.signUpEmail` sous un contexte ADMINISTRATIF — exactement le
 * chemin que `tests/isolation/*.test.ts` emploient pour la même raison, et
 * que `tests/unit/auth/amorcage-retrait.test.ts` exclut explicitement de son
 * périmètre (« un scénario qui appelle `signUpEmail` n'est pas un chemin
 * d'ouverture de compte ») — et la supprime à la fin. Aucune ligne du semis
 * ni de `SCENE.*` n'est touchée.
 *
 * ## Pourquoi `direction`, et pas `admin_societe`
 *
 * Les deux exigent un second facteur (RG-DRO-05) ; `direction` n'est portée
 * par AUCUNE identité existante de la scène, ce qui exclut toute collision de
 * nom ou d'état avec `admin.societe@`.
 *
 * ## Une seule identité, un seul fichier SÉRIALISÉ
 *
 * Chaque étape dépend de l'état que la précédente a laissé en base
 * (préparation en attente, puis enrôlée) : le mode série fixe l'ordre, et
 * chaque `test()` relance sa propre connexion par l'écran plutôt que de
 * garder la page ouverte d'un test à l'autre.
 */
test.describe.configure({ mode: "serial" });

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

const EMAIL = "9cw.direction@codima.test";
const NOM = "9CW Direction";

let utilisateurId = "";
/** Les codes de secours affichés à la préparation — un seul fichier les voit. */
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
    // Chaque connexion de l'épreuve a laissé une ligne au journal d'accès
    // (L0-10) — sans clause de cascade (I8, le journal n'oublie rien de son
    // propre chef). Elle doit partir AVANT l'identité qu'elle désigne.
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

/** Soumet le mot de passe de connexion, comme un humain le ferait. */
async function seConnecter(page: Page): Promise<void> {
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(EMAIL);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await page.waitForLoadState("networkidle");
}

/** La clé BRUTE lue sur l'écran — le PREMIER `<code>` de la page (le piège connu). */
async function cleAffichee(page: Page): Promise<string> {
  const affichee = (await page.locator("code").first().innerText()).replace(
    /\s+/g,
    "",
  );
  return new TextDecoder().decode(base32.decode(affichee));
}

async function codeCourant(secret: string): Promise<string> {
  return createOTP(secret, { digits: 6, period: 30 }).totp();
}

test("LE MOT DE PASSE OUVRE LA PRÉPARATION, SANS SECRET DANS L'URL, AVEC LE QR", async ({
  page,
}) => {
  await seConnecter(page);
  await expect(page).toHaveURL(/\/enrolement$/);

  // Étape 1 — mot de passe. Le refus d'une « déconnexion » ici est traité par
  // le test suivant, qui a besoin de ce même point de départ.
  await page.fill('input[name="motDePasse"]', MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["enrolement.reveler"] }).click();
  await page.waitForLoadState("networkidle");

  // TR-36 — AUCUN secret dans l'URL.
  const url = page.url();
  expect(url).not.toContain("cle=");
  expect(url).not.toContain("secours=");
  expect(url).not.toContain("uri=");
  expect(url).toMatch(/\/enrolement$/);

  // La clé est affichée (premier `<code>`), et le QR porte son titre accessible.
  const cle = await cleAffichee(page);
  expect(cle.length).toBeGreaterThan(0);
  await expect(
    page.getByRole("img", { name: fr["enrolement.qr.titre"] }),
  ).toBeVisible();

  // Les codes de secours, mémorisés pour le dernier scénario de ce fichier.
  codesSecours = await page.locator("ul li").allInnerTexts();
  expect(codesSecours.length).toBeGreaterThan(0);
});

test("UN CODE FAUX LAISSE LA CLÉ AFFICHÉE — TR-39", async ({ page }) => {
  await seConnecter(page);
  // La préparation de l'épreuve précédente est toujours en attente : pas de
  // mot de passe à redonner.
  await expect(page).toHaveURL(/\/enrolement$/);
  const cleAvant = await cleAffichee(page);

  await page.fill('input[name="code"]', "000000");
  await page.getByRole("button", { name: fr["enrolement.confirmer"] }).click();
  await page.waitForLoadState("networkidle");

  await expect(page).toHaveURL(/\/enrolement\?motif=/);
  await expect(page.getByText(fr["enrolement.code_invalide"])).toBeVisible();
  // La clé reste EXACTEMENT la même — rien n'a été réinitialisé par le refus.
  expect(await cleAffichee(page)).toBe(cleAvant);

  // LE CODE JUSTE achève l'enrôlement, et renvoie vers la connexion.
  await page.fill('input[name="code"]', await codeCourant(cleAvant));
  await page.getByRole("button", { name: fr["enrolement.confirmer"] }).click();
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveURL(/\/connexion\?motif=/);
  await expect(page.getByText(fr["connexion.apres_enrolement"])).toBeVisible();
});

test("LA CONNEXION SUIVANTE PROPOSE LE CODE, LE LIEN DE SECOURS, ET « ← RETOUR À LA CONNEXION »", async ({
  page,
}) => {
  await seConnecter(page);
  await expect(page).toHaveURL(/\/connexion\/code$/);

  // 9EDZ-DEMANDES-CONNEXION-MAQUETTE, partie 6 (D188) — « ← Retour à la
  // connexion » remplace le pied « Se déconnecter » sur CETTE page, même
  // geste (POST /api/session/deconnexion), même session détruite.
  await expect(
    page.getByText(fr["connexion.code.secours.repli"]),
  ).toBeVisible();

  const retour = page.getByRole("button", {
    name: fr["connexion.code.retour"],
  });
  await expect(retour).toBeVisible();
  await retour.click();
  await expect(page).toHaveURL(/\/connexion$/);

  // La session est bien MORTE : retour direct à la connexion, pas au défi.
  await page.goto("/planning");
  await expect(page).toHaveURL(/\/connexion/);
});

test("UN CODE DE SECOURS VALIDE OUVRE LA SESSION", async ({ page }) => {
  await seConnecter(page);
  await expect(page).toHaveURL(/\/connexion\/code$/);

  await page.getByText(fr["connexion.code.secours.repli"]).click();
  const code = codesSecours[0] ?? "";
  expect(code.length).toBeGreaterThan(0);
  await page.getByLabel(fr["connexion.code.secours.champ"]).fill(code);
  await page
    .getByRole("button", { name: fr["connexion.code.secours.utiliser"] })
    .click();
  await page.waitForLoadState("networkidle");

  await expect(page).toHaveURL(/\/planning/);
});
