import { PrismaClient } from "@prisma/client";
import { expect, test, type Locator, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";

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
 * C'est le geste d'Alexis, exactement : la désactivation passe par
 * `/parametres/agences/[id]/modifier`, et c'est la LISTE qui doit ensuite en
 * témoigner. Poser `actif = false` par Prisma prouverait que l'écran lit la
 * colonne ; jouer la fiche prouve que ce qu'un humain vient de faire se voit.
 *
 * ## Pourquoi c'est DOLBEAU du semis, et pourquoi elle est REMISE
 *
 * `tests/e2e/ecrans-largeur-utile.spec.ts` compte TROIS lignes sur cet écran
 * (témoin de « toutes visibles »), et les fichiers s'exécutent en parallèle
 * hors CI : créer une quatrième agence le temps du scénario ferait rougir un
 * gardien qui n'a rien à voir avec l'état. Désactiver une agence du semis ne
 * change pas le compte — **la liste ne la cache pas**, c'est précisément le
 * livrable : il faut pouvoir la retrouver pour la réactiver. Aucun autre
 * scénario ne lit `agence.actif` (mesuré : `grep -rn actif lib app | grep -i
 * agence` ne rend que ce module et la fiche). Elle est réactivée en fin de
 * scénario, dans un `finally`, par la même fiche — la scène est rendue comme
 * elle a été trouvée, même quand une attente échoue.
 *
 * Le libellé de la ligne est LU EN BASE par son code, jamais écrit ici : un
 * texte attendu par un test de rendu passe par le dictionnaire (L0-11), et
 * un libellé du semis n'y a pas sa place — il n'est pas un libellé d'écran.
 */
// Pas de mode « serial » : les deux scénarios sont indépendants — le premier
// ne fait que LIRE, et rien de ce qu'il compte ne dépend de l'état d'une
// ligne. Enchaînés, l'échec du premier priverait le second de sa mesure.

const CODE_AGENCE_EPROUVEE = "DOLBEAU";

async function agenceEprouvee(): Promise<{ id: string; libelle: string }> {
  // La société de l'épreuve (CODIMA-NC), relue comme les autres repères.
  const { societeId } = await reperesDeLaScene();
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societeId, code: CODE_AGENCE_EPROUVEE },
      select: { id: true, libelle: true },
    });
    return agence;
  } finally {
    await client.$disconnect();
  }
}

/** La ligne de la liste qui porte cet établissement. */
function ligneDe(page: Page, libelle: string): Locator {
  return page.locator("main tbody tr").filter({
    has: page.getByRole("cell", { name: libelle }),
  });
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
  await page.goto(`/parametres/agences/${id}/modifier`);

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

test("UNE AGENCE DÉSACTIVÉE PAR SA FICHE SE DISTINGUE DANS LA LISTE — ET Y RESTE", async ({
  page,
}) => {
  const { id, libelle } = await agenceEprouvee();

  await page.goto("/parametres/agences");
  await expect(page.locator("main")).toBeVisible();
  // Témoin : avant le geste, la ligne est là et rien n'y est dit inactif —
  // sans lui, « Inactif visible après » pourrait l'être depuis toujours.
  const ligne = ligneDe(page, libelle);
  await expect(ligne).toHaveCount(1);
  await expect(
    ligne.getByText(fr["agence.inactif"], { exact: true }),
  ).toHaveCount(0);

  try {
    await reglerLEtatParLaFiche(page, id, false);

    // LE LIVRABLE — et LA MESURE DU DÉFAUT : la ligne est toujours là (on ne
    // la cache pas — il faut pouvoir la retrouver pour la réactiver), et elle
    // dit son état. Avant AGENCE-2, cette attente-ci rougissait : la ligne
    // existait, identique aux deux autres, et ne disait rien.
    const ligneApres = ligneDe(page, libelle);
    await expect(ligneApres).toHaveCount(1);
    await expect(
      ligneApres.getByText(fr["agence.inactif"], { exact: true }),
    ).toBeVisible();
    await expect(
      ligneApres.getByText(fr["agence.actif"], { exact: true }),
    ).toHaveCount(0);

    // Et les AUTRES lignes, elles, restent dites actives : la différence est
    // visible dans les deux sens, jamais par l'absence d'un mot.
    await expect(
      page
        .locator("main tbody tr")
        .getByText(fr["agence.actif"], { exact: true }),
    ).toHaveCount(2);
    await expect(
      page
        .locator("main tbody tr")
        .getByText(fr["agence.inactif"], { exact: true }),
    ).toHaveCount(1);
  } finally {
    // La scène est rendue comme elle a été trouvée — par la même fiche.
    await reglerLEtatParLaFiche(page, id, true);
  }

  const ligneRendue = ligneDe(page, libelle);
  await expect(
    ligneRendue.getByText(fr["agence.actif"], { exact: true }),
  ).toBeVisible();
  await expect(
    ligneRendue.getByText(fr["agence.inactif"], { exact: true }),
  ).toHaveCount(0);
});
