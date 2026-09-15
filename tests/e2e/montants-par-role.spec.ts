import { createOTP } from "@better-auth/utils/otp";
import { expect, test, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";

import {
  COMPTE_ADMIN_SOCIETE_EPREUVE,
  COMPTE_EPREUVE,
  MOT_DE_PASSE_EPREUVE,
  SCENE,
} from "./setup/scene";

/**
 * LES MONTANTS DE VENTE, VUS PAR DEUX RÔLES (D37, arbitrage 3.8).
 *
 * ## Ce que ce fichier mesure, et que rien d'autre ne mesure
 *
 * Les scénarios unitaires prouvent que `accesAuxMontants` dit ce que la matrice
 * dit. **Ils ne peuvent pas prouver qu'un ÉCRAN le lit** — et c'était
 * exactement le défaut : la règle était écrite, la matrice juste, son scénario
 * vert, et *aucun écran ne l'appelait*. Une couche sans appelant est verte pour
 * toujours.
 *
 * ## LA PAIRE, ET C'EST ELLE QUI COMPTE
 *
 * La MÊME intervention, à la MÊME seconde, ouverte par deux identités. L'une
 * voit le total hors taxes, l'autre le motif à sa place. *Un seul des deux
 * scénarios ne prouverait rien* : celui du refus passerait sur un écran qui
 * n'affiche jamais de montant à personne — ce qui n'a été demandé par personne
 * —, et celui de la direction passerait sur un écran qui les affiche à tous,
 * c'est-à-dire sur le défaut lui-même (§9, 11/09 : à côté du cas qui doit
 * rougir, le cas qui doit rester vert POUR SA PROPRE RAISON).
 *
 * ## CE QU'IL N'ÉPROUVE PAS, ET C'EST ÉCRIT
 *
 * Il ne prouve **aucun contrôle d'accès** : ce qui est masqué ici est un
 * affichage, et la base ne distingue pas les deux rôles sur ces colonnes. Le
 * module le dit de lui-même ; ce fichier ne prétend pas plus.
 */
test.describe.configure({ mode: "serial" });

/**
 * LE SECOND FACTEUR, PARCE QUE `admin_societe` EST UN RÔLE SENSIBLE.
 *
 * *Mesuré plutôt que supposé* : la connexion de ce compte ne mène pas à
 * l'arrivée mais à `/enrolement` — le §2 impose la MFA sur les rôles sensibles,
 * et `admin_societe` en administre les comptes. **Le harnais ne contourne pas
 * l'enrôlement, il le traverse** : la clé est lue SUR L'ÉCRAN, là où un humain
 * la lirait, et le code à six chiffres est calculé avec la même bibliothèque
 * que la vérification. *Un harnais qui écrirait un secret en base éprouverait
 * un chemin qui n'existe pas.*
 *
 * L'écran montre la clé en BASE32, parce que c'est ce qu'une application
 * d'authentification sait lire ; la vérification calcule sur le secret BRUT.
 * Les confondre rend un code refusé sans que rien ne dise pourquoi.
 */
function base32VersBrut(base32: string): string {
  const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const caractere of base32.replace(/=+$/, "").toUpperCase()) {
    const index = ALPHABET.indexOf(caractere);
    if (index === -1) {
      throw new Error(`Clé affichée illisible : « ${caractere} » hors base32.`);
    }
    bits += index.toString(2).padStart(5, "0");
  }
  let brut = "";
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    brut += String.fromCharCode(Number.parseInt(bits.slice(i, i + 8), 2));
  }
  return brut;
}

/**
 * LA CLÉ ACTIVÉE PENDANT CETTE EXÉCUTION, s'il y en a eu une.
 *
 * Elle n'est écrite nulle part — ni fichier, ni base : elle est LUE à l'écran
 * puis gardée le temps de la session de Playwright. Les scénarios sont en mode
 * `serial`, donc une seule exécution la renseigne.
 */
let cleActivee = "";

async function seConnecter(page: Page, email: string): Promise<void> {
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(email);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await page.waitForLoadState("networkidle");
}

async function codeCourant(): Promise<string> {
  return createOTP(cleActivee, { digits: 6, period: 30 }).totp();
}

/**
 * L'ENRÔLEMENT, PUIS LA RECONNEXION — deux gestes, pas un.
 *
 * *Mesuré, et c'est ce qui a coûté la première rédaction* : activer le second
 * facteur ne mène pas à l'arrivée mais **renvoie à la connexion**
 * (`motif=connexion.apres_enrolement`). C'est juste — *une session ouverte sans
 * second facteur ne devient pas valide parce qu'on vient d'en poser un* —, et
 * le harnais suit ce chemin plutôt que de le supposer.
 */
async function ouvrirLaSession(page: Page, email: string): Promise<void> {
  await seConnecter(page, email);
  if (page.url().includes("/enrolement")) {
    await page.fill('input[name="motDePasse"]', MOT_DE_PASSE_EPREUVE);
    await page.click('button[type="submit"]');
    await page.waitForLoadState("networkidle");
    const affichee = (await page.locator("code").first().innerText()).replace(
      /\s+/g,
      "",
    );
    cleActivee = base32VersBrut(affichee);
    expect(cleActivee).not.toBe("");
    await page.fill('input[name="code"]', await codeCourant());
    await page.click('button[type="submit"]');
    await page.waitForLoadState("networkidle");
    await seConnecter(page, email);
  }
  if (page.url().includes("/connexion/code")) {
    expect(cleActivee).not.toBe("");
    await page.fill('input[name="code"]', await codeCourant());
    await page.click('button[type="submit"]');
    await page.waitForLoadState("networkidle");
  }
  await expect(page).toHaveURL(/\/arrivee/);
}

test("l'ADV voit le total hors taxes — le cas qui doit rester vert", async ({
  page,
}) => {
  await ouvrirLaSession(page, COMPTE_EPREUVE);
  await page.goto(`/planning/${SCENE.obstacle}`);
  // Le TITRE du bloc est là dans les deux cas : c'est ce qui rend l'écart
  // visible au lieu de le faire disparaître.
  await expect(
    page.getByRole("heading", { name: fr["intervention.cloture.facture"] }),
  ).toBeVisible();
  await expect(
    page.getByText(fr["intervention.cloture.total"], { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(fr["intervention.valorisation.sans_droit"]),
  ).toHaveCount(0);
});

test("`admin_societe` lit le MOTIF à la place des montants — D37", async ({
  page,
}) => {
  await ouvrirLaSession(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
  await page.goto(`/planning/${SCENE.obstacle}`);
  // Le bloc n'a pas disparu : *un bloc absent se lirait « cette intervention
  // n'a pas de montant » là où il faut lire « ce n'est pas pour vous »*.
  await expect(
    page.getByRole("heading", { name: fr["intervention.cloture.facture"] }),
  ).toBeVisible();
  await expect(
    page.getByText(fr["intervention.valorisation.sans_droit"]),
  ).toBeVisible();
  // Et le total n'y est pas — ni son libellé, ni le taux horaire.
  await expect(
    page.getByText(fr["intervention.cloture.total"], { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText(fr["intervention.cloture.taux"], { exact: true }),
  ).toHaveCount(0);
});
