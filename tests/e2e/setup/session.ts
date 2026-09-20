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
 * variable locale pour la clé d'activation — recopiée plutôt que partagée,
 * parce que le territoire du lot ÉQUIPE-1 n'autorisait qu'un seul fichier
 * NEUF sous `tests/e2e/` (`equipe.spec.ts` lui-même) ; `setup/` n'en fait
 * pas partie, mais la copie a quand même été faite.
 *
 * **Mesuré : la base de l'épreuve est UNE SEULE, recréée une fois pour toute
 * l'exécution** (`tests/e2e/setup/global.ts`), pas par fichier. Les deux
 * fichiers ouvrent la MÊME identité — `COMPTE_ADMIN_SOCIETE_EPREUVE`, seule
 * identité `admin_societe` du semis. Le premier fichier qui s'y connecte
 * traverse `/enrolement` et active le second facteur EN BASE, pour de bon.
 * Le second fichier, plus tard dans la même exécution, retrouve un compte
 * déjà activé et passe directement par `/connexion/code` — mais sa PROPRE
 * copie de la clé, jamais renseignée par CE fichier-là, restait vide.
 * Le scénario « `admin_societe` lit le MOTIF à la place des montants — D37 »
 * en est tombé à chaque exécution depuis que `equipe.spec.ts` existe (#248),
 * dans l'ordre où les fichiers s'exécutent (`equipe.spec.ts` avant
 * `montants-par-role.spec.ts`, alphabétique).
 *
 * La correction n'est pas d'allonger un délai ni de réessayer : c'est de
 * cesser la duplication. Une SEULE fonction, un SEUL cache — tenu ici, par
 * courriel, parce qu'une exécution peut ouvrir plusieurs identités sensibles.
 * Le fichier qui active le second facteur le pose dans ce cache ; tout fichier
 * suivant qui rouvre la MÊME identité le retrouve, au lieu d'en supposer un
 * qu'il n'a jamais vu. La clé n'est toujours écrite ni en base ni sur disque —
 * seulement gardée en mémoire, le temps du run (`workers: 1` en CI, donc un
 * seul processus la porte du début à la fin).
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

/** Une clé activée par courriel — plusieurs identités sensibles par exécution. */
const clesActivees = new Map<string, string>();

async function codeCourant(email: string): Promise<string> {
  const cle = clesActivees.get(email);
  if (cle === undefined) {
    throw new Error(
      `Aucune clé activée pour ${email} : \`ouvrirLaSessionSensible\` ne l'a ` +
        "pas encore traversé dans cette exécution.",
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
 * L'ENRÔLEMENT, PUIS LA RECONNEXION — deux gestes, pas un.
 *
 * *Mesuré* : activer le second facteur ne mène pas à l'arrivée mais **renvoie
 * à la connexion** (`motif=connexion.apres_enrolement`). C'est juste — *une
 * session ouverte sans second facteur ne devient pas valide parce qu'on vient
 * d'en poser un* —, et le harnais suit ce chemin plutôt que de le supposer.
 *
 * Si l'identité est DÉJÀ activée — par CE fichier ou par un autre, plus tôt
 * dans la même exécution — l'enrôlement est sauté et la clé vient du cache.
 */
export async function ouvrirLaSessionSensible(
  page: Page,
  email: string,
): Promise<void> {
  await seConnecter(page, email);
  if (page.url().includes("/enrolement")) {
    await page.fill('input[name="motDePasse"]', MOT_DE_PASSE_EPREUVE);
    await page.click('button[type="submit"]');
    await page.waitForLoadState("networkidle");
    const affichee = (await page.locator("code").first().innerText()).replace(
      /\s+/g,
      "",
    );
    const cle = base32VersBrut(affichee);
    expect(cle).not.toBe("");
    clesActivees.set(email, cle);
    await page.fill('input[name="code"]', await codeCourant(email));
    await page.click('button[type="submit"]');
    await page.waitForLoadState("networkidle");
    await seConnecter(page, email);
  }
  if (page.url().includes("/connexion/code")) {
    await page.fill('input[name="code"]', await codeCourant(email));
    await page.click('button[type="submit"]');
    await page.waitForLoadState("networkidle");
  }
  await expect(page).toHaveURL(/\/arrivee/);
}
