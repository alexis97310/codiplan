import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { COMPTE_ADMIN_SOCIETE_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible, ouvrirUneSession } from "./setup/session";

/**
 * 9L46-FINITIONS-LISTE-TELEPHONE-MDP-TECHNICIEN.
 *
 * ## Point 1/2 — la liste de `SelecteurRecherche` masquée par le clavier
 * tactile
 *
 * Mesuré à 375 px (voir la passation) : `window.innerHeight` ne rétrécit pas
 * quand le clavier s'ouvre sur un navigateur mobile, seul
 * `window.visualViewport.height` le fait — `components/ui/selecteur-
 * recherche.tsx` lisait le premier, et ouvrait son panneau sur la foi d'un
 * espace recouvert par le clavier. AUCUN navigateur de test (Playwright,
 * headless ou pas) n'ouvre réellement un clavier tactile : ce point SIMULE
 * la différence en posant un `window.visualViewport` à soi, plus bas que la
 * fenêtre réelle — exactement l'écart qu'un clavier réel creuse — et prouve
 * que le panneau reste dans cet espace réduit, jamais dans les 800 px de la
 * fenêtre entière.
 *
 * ## Point 3/4 — le changement de mot de passe du technicien, depuis
 * `/terrain/profil`
 *
 * `tests/e2e/9i9-mon-compte.spec.ts` prouve déjà la chaîne complète côté
 * bureau (`/mon-compte`) — mot de passe actuel faux refusé, aboutissement,
 * nouvelle session. Ce fichier ne rejoue pas ces refus : il prouve
 * uniquement ce qui est NEUF ici — que le même geste, posé par un
 * TECHNICIEN depuis `/terrain/profil/mot-de-passe`, aboutit et ramène sur
 * CET écran (jamais `/mon-compte`, fermé pour ce rôle par D221), et que le
 * mot de passe choisi ouvre bien la session suivante.
 */

test.describe.configure({ mode: "serial" });

const PREFIXE = "9L46-";

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

test.describe("liste déroulante masquée par le clavier tactile (375 px)", () => {
  const CLIENTS = [uuidv7(), uuidv7()] as const;

  function libelleClient(rang: number): string {
    return `${PREFIXE}Client ${rang}`;
  }

  test.beforeAll(async () => {
    const client = admin();
    try {
      const societe = await client.societe.findFirstOrThrow({
        where: { code: "CODIMA-NC" },
        select: { id: true },
      });
      await client.client.createMany({
        data: CLIENTS.map((id, rang) => ({
          id,
          societe_id: societe.id,
          raison_sociale: libelleClient(rang + 1),
          actif: true,
        })),
      });
    } finally {
      await client.$disconnect();
    }
  });

  test.afterAll(async () => {
    const client = admin();
    try {
      await client.client.deleteMany({ where: { id: { in: [...CLIENTS] } } });
    } finally {
      await client.$disconnect();
    }
  });

  test.beforeEach(async ({ page }) => {
    await ouvrirUneSession(page);
  });

  /**
   * Place le champ `nom` à `yCible`, PAR DÉFILEMENT — jamais par un
   * redimensionnement de fenêtre, qui changerait `window.innerHeight`
   * lui-même et ne reproduirait donc rien de l'écart propre au clavier
   * tactile. Même technique de défilement programmatique que
   * `placerChampSousLeBandeau` (9I8E).
   */
  async function placerChampAUneHauteur(
    page: Page,
    nom: string,
    yCible: number,
  ): Promise<void> {
    const champ = page.locator(`[data-selecteur="${nom}"] input[type="text"]`);
    await champ.click();
    const rect = await champ.evaluate((element) =>
      element.getBoundingClientRect(),
    );
    await page.evaluate(
      (delta) => window.scrollBy(0, delta),
      rect.top - yCible,
    );
  }

  test("point 1 — un clavier simulé (visualViewport réduit, fenêtre inchangée) ne masque ni ne coupe la liste", async ({
    page,
  }) => {
    const hauteurVisibleSimulee = 400;

    // LE CLAVIER SIMULÉ — posé avant tout script de page (`addInitScript`),
    // pour que `components/ui/selecteur-recherche.tsx` le lise dès son
    // premier calcul. `window.visualViewport` est une propriété en LECTURE
    // SEULE du navigateur réel ; `configurable: true` permet de la
    // remplacer malgré tout, comme le feraient les outils de débogage
    // mobile des navigateurs eux-mêmes.
    await page.addInitScript((hauteur) => {
      const cible = new EventTarget();
      const stub = {
        height: hauteur,
        width: 375,
        offsetTop: 0,
        offsetLeft: 0,
        scale: 1,
        addEventListener: cible.addEventListener.bind(cible),
        removeEventListener: cible.removeEventListener.bind(cible),
      };
      Object.defineProperty(window, "visualViewport", {
        value: stub,
        configurable: true,
      });
    }, hauteurVisibleSimulee);

    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/parc/nouvelle");

    // LE CHAMP RESTE DANS LA PARTIE VISIBLE DU CLAVIER SIMULÉ (330 < 400),
    // MAIS ASSEZ BAS pour qu'un calcul fondé sur les 800 px de la fenêtre
    // RÉELLE (le défaut d'avant ce lot) ouvre le panneau bien au-delà de
    // 400 — c'est exactement l'écart mesuré.
    await placerChampAUneHauteur(page, "client_id", 330);

    const champ = page.locator(
      '[data-selecteur="client_id"] input[type="text"]',
    );
    const motif = `q=${encodeURIComponent(PREFIXE)}`;
    await Promise.all([
      page.waitForResponse((reponse) => reponse.url().includes(motif)),
      champ.fill(PREFIXE),
    ]);

    const options = page.locator('#client_id-resultats li[role="option"]');
    await expect(options.first()).toBeVisible();
    expect(await options.count()).toBeGreaterThan(1);

    // LE PANNEAU ENTIER TIENT DANS LES 400 PX VISIBLES DU CLAVIER SIMULÉ —
    // `expect.poll` plutôt qu'une lecture unique : le défilement qui a
    // placé le champ déclenche un recalcul asynchrone de la position.
    await expect
      .poll(async () => {
        const boite = await page.locator("#client_id-resultats").boundingBox();
        return boite === null ? null : boite.y + boite.height;
      })
      .toBeLessThanOrEqual(hauteurVisibleSimulee);
    const boite = await page.locator("#client_id-resultats").boundingBox();
    expect(boite).not.toBeNull();
    if (boite === null) {
      throw new Error("inatteignable — l'assertion ci-dessus a déjà échoué");
    }
    expect(boite.y).toBeGreaterThanOrEqual(0);

    // ET LA DERNIÈRE OPTION RESTE RÉELLEMENT CLIQUABLE, PAS SEULEMENT DANS
    // LA BOÎTE — même technique que `assertListeVisibleEtCliquable` (9I7E).
    const compte = await options.count();
    const derniere = options.nth(compte - 1);
    const boiteOption = await derniere.boundingBox();
    expect(boiteOption).not.toBeNull();
    if (boiteOption === null) {
      throw new Error("inatteignable — l'assertion ci-dessus a déjà échoué");
    }
    const recouverte = await page.evaluate(
      ({ x, y }) => {
        const element = document.elementFromPoint(x, y);
        return (
          element === null ||
          element.closest('#client_id-resultats li[role="option"]') === null
        );
      },
      {
        x: boiteOption.x + boiteOption.width / 2,
        y: boiteOption.y + boiteOption.height / 2,
      },
    );
    expect(recouverte).toBe(false);
    await derniere.click();
    await expect(
      page.locator('[data-selecteur="client_id"] input[type="hidden"]'),
    ).not.toHaveValue("");
  });
});

test.describe("changement de mot de passe du technicien, depuis /terrain/profil (375 px)", () => {
  const NOM_TECHNICIEN = fr["acces9l46.e2e.nom"];
  const COURRIEL_TECHNICIEN = "technicien@9l46.e2e.test";
  const MOT_DE_PASSE_INITIAL = "mot-de-passe-9l46-initial";
  const MOT_DE_PASSE_FAUX = "mot-de-passe-9l46-faux";
  const MOT_DE_PASSE_FINAL = "mot-de-passe-9l46-final-choisi";

  let utilisateurId = "";

  test.beforeAll(async () => {
    const reperes = await reperesDeLaScene();
    const client = admin();
    try {
      const agence = await client.agence.findFirstOrThrow({
        where: { societe_id: reperes.societeId, code: "DUCOS" },
        select: { id: true },
      });

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
          societe_id: reperes.societeId,
          role: Role.technicien,
        },
      });
      await client.technicien.create({
        data: {
          id: uuidv7(),
          societe_id: reperes.societeId,
          utilisateur_id: utilisateurId,
          agence_id: agence.id,
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

  test("le technicien change son mot de passe depuis /terrain/profil/mot-de-passe, et le nouveau mot de passe ouvre la session suivante", async ({
    page,
    browser,
  }) => {
    // ── 0. L'ADMINISTRATEUR COPIE LE LIEN DE PREMIER ACCÈS ──────────────────
    await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
    const lien = await page.request.post(
      `/api/equipe/${utilisateurId}/copier-lien`,
    );
    expect(lien.status()).toBe(200);
    const { url: urlPremierAcces } = (await lien.json()) as { url: string };
    expect(urlPremierAcces).toMatch(/^https?:\/\//);

    // ── 1. LE TECHNICIEN, SUR SON PROPRE TÉLÉPHONE (375 px) ──────────────────
    const pageTechnicien = await browser.newPage({
      viewport: { width: 375, height: 800 },
    });
    await pageTechnicien.goto(urlPremierAcces);
    await pageTechnicien
      .getByLabel(fr["premier_acces.mot_de_passe"])
      .fill(MOT_DE_PASSE_INITIAL);
    await pageTechnicien
      .getByLabel(fr["premier_acces.confirmation"])
      .fill(MOT_DE_PASSE_INITIAL);
    await pageTechnicien
      .getByRole("button", { name: fr["premier_acces.valider"] })
      .click();
    await pageTechnicien.waitForLoadState("networkidle");
    await expect(pageTechnicien).toHaveURL(/\/connexion/);

    await pageTechnicien
      .getByLabel(fr["connexion.email"])
      .fill(COURRIEL_TECHNICIEN);
    await pageTechnicien
      .getByLabel(fr["connexion.mot_de_passe"])
      .fill(MOT_DE_PASSE_INITIAL);
    await pageTechnicien
      .getByRole("button", { name: fr["connexion.valider"] })
      .click();
    await expect(pageTechnicien).toHaveURL(/\/installation\?suite=%2Fterrain$/);
    await pageTechnicien
      .getByRole("link", { name: fr["pwa.etape.plus_tard"] })
      .click();
    await expect(pageTechnicien).toHaveURL(/\/terrain$/);

    // ── 2. LE PROFIL MÈNE AU CHANGEMENT DE MOT DE PASSE ──────────────────────
    await pageTechnicien.goto("/terrain/profil");
    await pageTechnicien
      .getByRole("link", { name: fr["terrain.mot_de_passe.titre"] })
      .click();
    await expect(pageTechnicien).toHaveURL(/\/terrain\/profil\/mot-de-passe$/);
    await expect(
      pageTechnicien.getByRole("heading", {
        name: fr["terrain.mot_de_passe.titre"],
      }),
    ).toBeVisible();

    // ── 3. UN MOT DE PASSE ACTUEL FAUX EST REFUSÉ, ET RAMÈNE SUR CET ÉCRAN ───
    await pageTechnicien
      .getByLabel(fr["mon_compte.mot_de_passe.actuel"], { exact: false })
      .fill("ce-n-est-pas-le-bon-mot-de-passe");
    await pageTechnicien
      .getByLabel(fr["mon_compte.mot_de_passe.nouveau"], { exact: false })
      .fill(MOT_DE_PASSE_FAUX);
    await pageTechnicien
      .getByLabel(fr["mon_compte.mot_de_passe.confirmation"], { exact: false })
      .fill(MOT_DE_PASSE_FAUX);
    await pageTechnicien
      .getByRole("button", { name: fr["mon_compte.mot_de_passe.valider"] })
      .click();
    await expect(pageTechnicien).toHaveURL(/\/terrain\/profil\/mot-de-passe\?/);
    await expect(
      pageTechnicien.getByText(fr["mon_compte.mot_de_passe.actuel_incorrect"]),
    ).toBeVisible();

    // ── 4. LE BON MOT DE PASSE ACTUEL ABOUTIT, TOUJOURS SUR CET ÉCRAN ────────
    await pageTechnicien
      .getByLabel(fr["mon_compte.mot_de_passe.actuel"], { exact: false })
      .fill(MOT_DE_PASSE_INITIAL);
    await pageTechnicien
      .getByLabel(fr["mon_compte.mot_de_passe.nouveau"], { exact: false })
      .fill(MOT_DE_PASSE_FINAL);
    await pageTechnicien
      .getByLabel(fr["mon_compte.mot_de_passe.confirmation"], { exact: false })
      .fill(MOT_DE_PASSE_FINAL);
    await pageTechnicien
      .getByRole("button", { name: fr["mon_compte.mot_de_passe.valider"] })
      .click();
    await expect(pageTechnicien).toHaveURL(/\/terrain\/profil\/mot-de-passe\?/);
    await expect(
      pageTechnicien.getByText(fr["mon_compte.mot_de_passe.abouti"]),
    ).toBeVisible();

    // ── 5. DÉCONNEXION, PUIS LE MOT DE PASSE FINAL OUVRE RÉELLEMENT LA SESSION
    await pageTechnicien
      .getByRole("button", { name: fr["nav.deconnexion"] })
      .click();
    await expect(pageTechnicien).toHaveURL(/\/connexion/);

    await pageTechnicien
      .getByLabel(fr["connexion.email"])
      .fill(COURRIEL_TECHNICIEN);
    await pageTechnicien
      .getByLabel(fr["connexion.mot_de_passe"])
      .fill(MOT_DE_PASSE_FINAL);
    await pageTechnicien
      .getByRole("button", { name: fr["connexion.valider"] })
      .click();
    await expect(pageTechnicien).toHaveURL(
      /\/(installation\?suite=%2Fterrain|terrain)$/,
    );
    if (pageTechnicien.url().includes("/installation")) {
      await pageTechnicien
        .getByRole("link", { name: fr["pwa.etape.plus_tard"] })
        .click();
      await expect(pageTechnicien).toHaveURL(/\/terrain$/);
    }

    await pageTechnicien.close();
  });
});
