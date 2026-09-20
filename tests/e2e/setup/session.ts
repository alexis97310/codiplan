import { createOTP } from "@better-auth/utils/otp";
import { expect, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { COMPTE_EPREUVE, MOT_DE_PASSE_EPREUVE } from "./scene";

/**
 * OUVRIR UNE SESSION PAR L'ÉCRAN, jamais par un raccourci.
 *
 * Le scénario remplit le formulaire de connexion comme une personne le ferait :
 * c'est la seule façon d'éprouver la chaîne entière — la route, la
 * bibliothèque, les politiques de désignation, la pose du contexte cloisonné.
 * *Un harnais qui poserait un cookie fabriqué mesurerait le planning et rien
 * d'autre*, et le premier défaut de session lui échapperait — c'est exactement
 * ce qui est arrivé à L1-02c le 08/09/2026.
 */
export async function ouvrirUneSession(page: Page): Promise<void> {
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(COMPTE_EPREUVE);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  // Le compte de l'épreuve n'est habilité que sur UNE société : l'arrivée la
  // pose et ne propose aucun sélecteur.
  await expect(page).toHaveURL(/\/arrivee/);
}

/**
 * LA SESSION D'UN RÔLE SENSIBLE — second facteur compris (§2, MFA imposée).
 *
 * ## Ce qu'elle répare (Lot E2E-1)
 *
 * `tests/e2e/montants-par-role.spec.ts` et `tests/e2e/equipe.spec.ts`
 * ouvraient chacun leur PROPRE copie de cette fonction, avec sa propre
 * VARIABLE LOCALE pour la clé d'activation — recopiée plutôt que partagée,
 * parce que le territoire du lot ÉQUIPE-1 n'autorisait qu'un seul fichier
 * NEUF sous `tests/e2e/`. **Mesuré : la base de l'épreuve est UNE SEULE**,
 * recréée une fois pour toute l'exécution, pas par fichier. Les deux fichiers
 * ouvrent la MÊME identité — `COMPTE_ADMIN_SOCIETE_EPREUVE`, seule identité
 * `admin_societe` du semis —, et le second à s'y connecter retrouvait un
 * compte déjà activé par le premier, sans jamais avoir vu sa clé.
 *
 * ## Pourquoi une variable de module ne suffisait pas non plus
 *
 * La première réparation de ce lot posait un `Map` de module, partagé entre
 * les deux fichiers. *Relevé en revue* : un `Map` en mémoire ne vit que dans
 * UN processus. Playwright en ouvre un par fichier lors d'une exécution
 * parallèle (`fullyParallel`, hors CI) — deux fichiers sur le MÊME compte,
 * dans deux processus, retombent dans le même défaut qu'avant, chacun
 * ignorant l'activation de l'autre. Et même à un seul worker (CI) : dès
 * qu'un test échoue, Playwright **arrête ce worker** et en ouvre un NEUF pour
 * la reprise (`runner/dispatcher.js`, `worker.stop(true)` puis
 * `_createWorker`) — un second échec, sans rapport avec celui-ci, aurait
 * suffi à perdre le `Map` et à transformer une reprise en `Aucune clé
 * activée`.
 *
 * ## La correction : ENRÔLER UNE FOIS, AVANT TOUT WORKER
 *
 * `tests/e2e/setup/global.ts` traverse l'enrôlement lui-même, dans son PROPRE
 * navigateur, avant que `playwright.config.ts` ne distribue le moindre
 * fichier de test à un worker — donc avant toute parallélisation et avant
 * toute reprise. La clé qui en résulte est posée dans `process.env`, que
 * chaque worker HÉRITE à sa naissance (y compris un worker né en cours de
 * run, pour une reprise) : c'est le même principe que `SECRET_TOTP` dans
 * `scripts/captures.mts`, déplacé d'un script à l'autre. Elle n'est
 * toujours écrite ni en base ni sur disque — seulement transmise en mémoire,
 * de processus PARENT à processus ENFANT.
 *
 * Chaque fichier de scénario continue de traverser `/connexion/code` comme un
 * humain le ferait ; il lit seulement sa clé d'un endroit qui survit à la
 * parallélisation et aux reprises, plutôt que d'un `Map` qui n'y survit pas.
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
 * La variable qui porte les clés activées, par courriel — en hexadécimal,
 * parce qu'une clé brute peut contenir des octets qu'un environnement ne
 * transporte pas fidèlement telle quelle.
 */
const VARIABLE_CLES_ACTIVEES = "E2E_CLES_ACTIVEES";

function clesActivees(): Record<string, string> {
  const brut = process.env[VARIABLE_CLES_ACTIVEES];
  if (brut === undefined || brut.trim().length === 0) {
    return {};
  }
  return JSON.parse(brut) as Record<string, string>;
}

/** Mémorise une clé BRUTE pour un courriel — écrase toute clé précédente. */
function memoriserLaCle(email: string, cleBrute: string): void {
  const map = clesActivees();
  map[email] = Buffer.from(cleBrute, "latin1").toString("hex");
  process.env[VARIABLE_CLES_ACTIVEES] = JSON.stringify(map);
}

function clePourEmail(email: string): string | undefined {
  const hex = clesActivees()[email];
  return hex === undefined
    ? undefined
    : Buffer.from(hex, "hex").toString("latin1");
}

async function codeCourant(email: string): Promise<string> {
  const cle = clePourEmail(email);
  if (cle === undefined) {
    throw new Error(
      `Aucune clé activée pour ${email} : ni \`tests/e2e/setup/global.ts\` ` +
        "ni ce fichier ne l'ont encore traversée dans cette exécution.",
    );
  }
  return createOTP(cle, { digits: 6, period: 30 }).totp();
}

async function seConnecter(page: Page, email: string): Promise<void> {
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(email);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await page.waitForLoadState("networkidle");
}

/**
 * ACTIVE LE SECOND FACTEUR — `page` vient d'atterrir sur `/enrolement`.
 *
 * La clé est lue SUR L'ÉCRAN, là où un humain la lirait, puis mémorisée
 * (`memoriserLaCle`) avant d'être utilisée : un appelant qui échouerait juste
 * après ce point retrouverait quand même la clé à sa prochaine tentative.
 */
async function activerLeSecondFacteur(
  page: Page,
  email: string,
): Promise<void> {
  await page.fill('input[name="motDePasse"]', MOT_DE_PASSE_EPREUVE);
  await page.click('button[type="submit"]');
  await page.waitForLoadState("networkidle");
  const affichee = (await page.locator("code").first().innerText()).replace(
    /\s+/g,
    "",
  );
  const cle = base32VersBrut(affichee);
  expect(cle).not.toBe("");
  memoriserLaCle(email, cle);
  await page.fill('input[name="code"]', await codeCourant(email));
  await page.click('button[type="submit"]');
  await page.waitForLoadState("networkidle");
}

/**
 * L'ENRÔLEMENT, PUIS LA RECONNEXION — deux gestes, pas un.
 *
 * *Mesuré* : activer le second facteur ne mène pas à l'arrivée mais **renvoie
 * à la connexion** (`motif=connexion.apres_enrolement`). C'est juste — *une
 * session ouverte sans second facteur ne devient pas valide parce qu'on vient
 * d'en poser un* —, et le harnais suit ce chemin plutôt que de le supposer.
 *
 * Si l'identité est DÉJÀ activée — par `tests/e2e/setup/global.ts`, ou par un
 * appel précédent dans ce même processus — l'enrôlement est sauté et la clé
 * vient de `process.env` (voir l'en-tête du module).
 */
export async function ouvrirLaSessionSensible(
  page: Page,
  email: string,
): Promise<void> {
  await seConnecter(page, email);
  if (page.url().includes("/enrolement")) {
    await activerLeSecondFacteur(page, email);
    await seConnecter(page, email);
  }
  if (page.url().includes("/connexion/code")) {
    await page.fill('input[name="code"]', await codeCourant(email));
    await page.click('button[type="submit"]');
    await page.waitForLoadState("networkidle");
  }
  await expect(page).toHaveURL(/\/arrivee/);
}
