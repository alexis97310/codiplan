import { PrismaClient } from "@prisma/client";
import { expect, test, type Locator, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";
import { TERRITOIRE_NOUVELLE_CALEDONIE } from "@/prisma/seed-data";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { COMPTE_ADMIN_SOCIETE_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * L'ÉCRAN DES AGENCES DIT-IL L'ÉTAT QU'ON VIENT D'Y CHANGER ? (AGENCE-2)
 *
 * ## Ce que ce fichier mesure
 *
 * *Mesuré le 22/09/2026 sur la base de production : Alexis crée une agence
 * avec un code erroné, en crée une seconde avec le bon code, DÉSACTIVE la
 * première par la fiche de modification livrée à AGENCE-1 — et les deux lignes
 * s'affichent à l'identique. Rien ne dit qu'une des deux est désactivée.*
 * `grep -nE "actif|inactif" app/(back-office)/parametres/agences/page.tsx` ne
 * rendait AUCUNE ligne : le dépôt rend le champ (`lib/agences/depot.ts`,
 * `FicheAgence.actif`), la fiche l'expose, et la liste l'ignorait.
 *
 * Second défaut, même écran : le lien vers la fiche reprenait la clé
 * `agence.action.modifier` — le bouton « Enregistrer » de la fiche —, si bien
 * que la dernière colonne portait un « Enregistrer » en bout de ligne, qui ne
 * dit pas où il mène. Alexis a conclu qu'il n'y avait pas de lien.
 *
 * Et la colonne elle-même, en-tête « Actions » compris, était HORS DU CADRE
 * à 1280 px : le tableau exigeait 1040 px de large dans un cadre qui en
 * offre 966, et son conteneur défile latéralement sans le dire. `toBeVisible`
 * ne le voit pas — une boîte non vide hors de l'écran est « visible » pour
 * lui —, d'où `toBeInViewport` à cette largeur précise : c'est celle des
 * captures exigées par le lot, et une largeur d'écran courante.
 *
 * ## Pourquoi le geste est joué PAR LA FICHE, jamais posé en base
 *
 * C'est le geste d'Alexis, exactement : la désactivation passe par la fiche
 * de l'agence (`/parametres/agences/[agenceId]`, PA-29, QT-21, D167), et
 * c'est la LISTE qui doit ensuite en témoigner. Poser `actif = false` par
 * Prisma prouverait que l'écran lit la
 * colonne ; jouer la fiche prouve que ce qu'un humain vient de faire se voit.
 *
 * ## Pourquoi le second scénario FORGE SA PROPRE agence (9AY-AA-0)
 *
 * La version précédente désactivait DOLBEAU — une agence PARTAGÉE du jeu de
 * démonstration — le temps du scénario, avant de la réactiver dans un
 * `finally`. Ce geste éteignait une agence que d'autres épreuves comptent :
 * `tests/e2e/ecrans-largeur-utile.spec.ts` mesure exactement trois lignes sur
 * ce même écran, et la première épreuve DE CE FICHIER en mesure autant. Sous
 * `fullyParallel`, une agence du semis éteinte le temps d'un scénario reste un
 * risque de collision, quand bien même « la liste ne la cache pas » et que le
 * compte des lignes ne change pas.
 *
 * Le second scénario forge donc SA PROPRE agence (préfixe `AA0-`, code tiré au
 * sort à chaque exécution), par l'écran de création — aucun appel de dépôt de
 * test n'existait déjà pour une agence (mesuré : aucun autre fichier de
 * `tests/e2e/` ne crée d'agence). Il la désactive par la fiche, vérifie la
 * liste et le badge, puis la SUPPRIME par un accès direct à la base dans un
 * `finally` : aucune route de suppression n'existe pour une agence (mesuré,
 * `app/api/parametres/agences/` ne porte que `creer` et `[id]/modifier`,
 * cette dernière inchangée par PA-29 — seule l'ADRESSE DE L'ÉCRAN a bougé), et
 * il n'y en a pas à inventer ici — la suppression de test est le même geste de
 * nettoyage que `tests/e2e/absences-2.spec.ts` ou `tests/e2e/bon-3.spec.ts`
 * appliquent déjà à un site, un client ou une machine qu'ils ont forgés.
 *
 * **DEPUIS CE TICKET, AUCUN AUTRE SCÉNARIO NE MODIFIE `actif` D'UNE AGENCE
 * PARTAGÉE** (mesuré : `grep -rn actif tests/e2e tests/isolation` ne rend, sur
 * une agence, que ce fichier — les autres occurrences visent `technicien.actif`
 * ou lisent un décompte sans rien écrire). Les écrans qui filtrent `actif`
 * (AGENCE-ACTIVE, ticket suivant) ne sont donc jamais mis en défaut par une
 * agence partagée qu'une épreuve aurait laissée éteinte.
 *
 * *`workers` vaut `1` sous CI (`playwright.config.ts`) : deux scénarios n'y
 * tournent jamais en même temps, et la fenêtre où l'agence forgée existe se
 * referme avant qu'un autre scénario ne charge cet écran. Hors CI, sous
 * `fullyParallel`, une collision reste possible le temps très bref de ce
 * scénario — c'est le même risque que toute donnée forgée et nettoyée en
 * `finally` ailleurs dans ce dépôt.*
 *
 * Le libellé de la ligne est LU EN BASE par son code, jamais écrit ici : un
 * texte attendu par un test de rendu passe par le dictionnaire (L0-11), et
 * un libellé de test n'y a pas sa place — il n'est pas un libellé d'écran.
 */
// Pas de mode « serial » : les deux scénarios sont indépendants — le premier
// ne fait que LIRE, et le second ne modifie plus que l'agence qu'il a forgée.
// Enchaînés, l'échec du premier priverait le second de sa mesure.

const PREFIXE_AGENCE_FORGEE = "AA0-";

/** Un code unique par exécution — jamais deux essais ne se disputent le même. */
function codeAgenceForgee(): string {
  return `${PREFIXE_AGENCE_FORGEE}${Date.now()}`;
}

/** La ligne de la liste qui porte cet établissement. */
function ligneDe(page: Page, libelle: string): Locator {
  return page.locator("main tbody tr").filter({
    has: page.getByRole("cell", { name: libelle }),
  });
}

/**
 * Forge une agence PAR L'ÉCRAN DE CRÉATION — le même geste qu'un humain — puis
 * relit son identifiant : le semis attribue les identifiants (I10), un
 * scénario ne les devine pas.
 */
async function creerAgenceForgee(
  page: Page,
  code: string,
): Promise<{ id: string; libelle: string }> {
  // Pas de texte fixe accolé au code : une chaîne visible écrite ici serait
  // reconnue par son NOM (« libelle ») partout où ce nom réapparaît dans le
  // fichier — y compris dans `ligneDe`, une portée distincte — et ferait
  // rougir le gardien `sans-chaine-visible-en-dur` sur une correspondance de
  // nom, pas de portée.
  const libelle = code;

  await page.goto("/parametres/agences/nouvelle");
  // Par le NOM du champ, pas par son libellé : chaque `<label>` du formulaire
  // porte aussi le texte d'aide qui le suit (même élément), et « Code » y est
  // un sous-texte de l'aide du territoire — `getByLabel` échoue en mode
  // strict sur les deux. Même geste que `tests/e2e/contacts.spec.ts`.
  await page.locator('input[name="code"]').fill(code);
  await page.locator('input[name="libelle"]').fill(libelle);
  // PA-35 (QT-21, D167, 05/10/2026, TP-NAV1) — la saisie libre est devenue
  // une liste : `selectOption`, jamais `fill`, qui n'opère pas sur un
  // `<select>`.
  await page
    .locator('select[name="territoire"]')
    .selectOption(TERRITOIRE_NOUVELLE_CALEDONIE);
  await page
    .locator("#contenu")
    .getByRole("button", { name: fr["agence.action.creer"] })
    .click();
  await page.waitForLoadState("networkidle");

  const { societeId } = await reperesDeLaScene();
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    return await client.agence.findFirstOrThrow({
      where: { societe_id: societeId, code },
      select: { id: true, libelle: true },
    });
  } finally {
    await client.$disconnect();
  }
}

/** Nettoyage : aucune route de suppression n'existe pour une agence (mesuré). */
async function supprimerAgenceForgee(code: string): Promise<void> {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    await client.agence.deleteMany({ where: { code } });
  } finally {
    await client.$disconnect();
  }
}

/**
 * Le geste d'Alexis : sur la fiche, (dé)cocher « Actif », enregistrer,
 * revenir à la liste.
 *
 * La fiche est ouverte PAR SON ADRESSE, pas par le lien de la liste : le lien
 * est le second défaut de ce lot, éprouvé à part. S'il portait ce scénario,
 * la mesure « avant » rougirait sur le lien et ne dirait rien de l'état —
 * *un test qui échoue pour une autre raison que celle qu'il nomme ne
 * mesure pas.*
 */
async function reglerLEtatParLaFiche(
  page: Page,
  id: string,
  actif: boolean,
): Promise<void> {
  await page.goto(`/parametres/agences/${id}`);

  const caseActif = page.getByLabel(fr["agence.actif"]);
  if (actif) {
    await caseActif.check();
  } else {
    await caseActif.uncheck();
  }
  await page
    .getByRole("button", { name: fr["agence.action.modifier"] })
    .click();
  await page.waitForLoadState("networkidle");
  await expect(page.locator("[role='status']")).toHaveText(
    fr["agence.modifiee"],
  );

  await page.goto("/parametres/agences");
  await expect(page.locator("main")).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
});

/** La largeur des captures du lot — et celle où le défaut a été vu. */
const FENETRE = { width: 1280, height: 900 };

test("LA COLONNE DES ACTIONS PORTE SON INTITULÉ, DANS LE CADRE À 1280 PX, ET LE LIEN DIT OÙ IL MÈNE", async ({
  page,
}) => {
  await page.setViewportSize(FENETRE);
  await page.goto("/parametres/agences");
  await expect(page.locator("main")).toBeVisible();

  // Dans le CADRE, pas seulement dans le DOM : sans défilement latéral.
  await expect(
    page.getByRole("columnheader", { name: fr["agence.colonne_actions"] }),
  ).toBeInViewport({ ratio: 1 });

  // Un lien « Modifier » par ligne — jamais le « Enregistrer » de la fiche.
  const lignes = page.locator("main tbody tr");
  await expect(lignes).toHaveCount(3);
  const liens = page.getByRole("link", {
    name: fr["agence.modifier"],
    exact: true,
  });
  await expect(liens).toHaveCount(3);
  await expect(liens.first()).toBeInViewport({ ratio: 1 });
  await expect(
    page.getByRole("link", { name: fr["agence.action.modifier"], exact: true }),
  ).toHaveCount(0);
});

test("UNE AGENCE FORGÉE PAR L'ÉPREUVE, DÉSACTIVÉE PAR SA FICHE, SE DISTINGUE DANS LA LISTE", async ({
  page,
}) => {
  const code = codeAgenceForgee();

  try {
    const agence = await creerAgenceForgee(page, code);

    await page.goto("/parametres/agences");
    await expect(page.locator("main")).toBeVisible();
    // Témoin : à la création, la ligne est là et rien n'y est dit inactif —
    // sans lui, « Inactif visible après » pourrait l'être depuis toujours.
    const ligne = ligneDe(page, agence.libelle);
    await expect(ligne).toHaveCount(1);
    await expect(
      ligne.getByText(fr["agence.inactif"], { exact: true }),
    ).toHaveCount(0);

    await reglerLEtatParLaFiche(page, agence.id, false);

    // LE LIVRABLE — et LA MESURE DU DÉFAUT : la ligne est toujours là (on ne
    // la cache pas — il faut pouvoir la retrouver), et elle dit son état.
    // Avant AGENCE-2, cette attente-ci rougissait : la ligne existait,
    // identique aux autres, et ne disait rien.
    const ligneApres = ligneDe(page, agence.libelle);
    await expect(ligneApres).toHaveCount(1);
    await expect(
      ligneApres.getByText(fr["agence.inactif"], { exact: true }),
    ).toBeVisible();
    await expect(
      ligneApres.getByText(fr["agence.actif"], { exact: true }),
    ).toHaveCount(0);

    // Et une agence du semis, jamais touchée par cette épreuve, reste dite
    // active : la différence est visible dans les deux sens, jamais par
    // l'absence d'un mot.
    const { societeId } = await reperesDeLaScene();
    const client = new PrismaClient({
      datasources: { db: { url: urlAdministration() } },
    });
    const temoin = await client.agence
      .findFirstOrThrow({
        where: { societe_id: societeId, code: { not: code } },
        select: { libelle: true },
      })
      .finally(() => client.$disconnect());
    await expect(
      ligneDe(page, temoin.libelle).getByText(fr["agence.actif"], {
        exact: true,
      }),
    ).toBeVisible();
  } finally {
    await supprimerAgenceForgee(code);
  }
});
