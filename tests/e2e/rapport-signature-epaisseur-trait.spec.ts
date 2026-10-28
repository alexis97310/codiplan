import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { instantAMinutes, jourSuivant } from "@/lib/calendar/fuseau";
import { fr } from "@/lib/i18n";
import { uuidv7 } from "@/lib/db/uuid";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { COMPTE_TECHNICIEN_EPREUVE, MOT_DE_PASSE_EPREUVE } from "./setup/scene";

/**
 * 9I2-SIGNATURE-TRAIT-ET-COLONNE-MOIS, point 1 — LE TRAIT DE LA SIGNATURE
 * RESTE ~2 PX CSS, QUEL QUE SOIT LE `devicePixelRatio`.
 *
 * `demarrerTrace` (`components/terrain/rapport-automatique.tsx`) ne posait
 * NI `lineWidth` NI `ctx.scale` avant ce ticket : le trait faisait
 * 1 PIXEL PHYSIQUE, soit ~0,33 px CSS à DPR 3 — quasi invisible, à l'écran ET
 * dans le PNG enregistré. `preparerTraitSignature` pose maintenant
 * `lineWidth = 2 × échelle`, où l'échelle est celle de la résolution interne
 * du canevas (`canvas.width / largeur affichée`, posée par le
 * `useLayoutEffect` voisin) — mesurée ICI à DPR 1, 2 et 3, en relisant le
 * CONTEXTE 2D du canevas après un tracé réel (même technique que
 * `rapport-terrain.spec.ts` : les événements `pointer` sont dispatchés
 * directement dans la page, jamais simulés au niveau matériel).
 *
 * SA PROPRE FIXTURE, PRÉFIXÉE `9I2-`, loin dans le futur — jamais
 * `SCENE.rapportTravaillee` ni `SCENE.rapportVierge` : ces deux-là sont déjà
 * la propriété exclusive de `rapport-terrain.spec.ts` (voir le docblock de
 * `scene.ts`), qui y écrit une vraie signature sous `fullyParallel`. Trois
 * contextes de navigateur DISTINCTS (un par DPR) lisent la MÊME fiche sans
 * jamais écrire dessus deux fois en même temps : chacun efface son tracé
 * (`terrain.signature.effacer`) avant de conclure, pour que le suivant
 * reparte d'un canevas vide.
 */

// SÉRIEL — les trois DPR lisent et écrivent la MÊME fiche l'un après
// l'autre (jamais `SCENE.*`, voir le docblock plus haut) ; sous
// `fullyParallel`, des tests d'un même fichier peuvent sinon tourner en même
// temps sur des workers distincts.
test.describe.configure({ mode: "serial" });

const RANG_SEMAINES = 45;
const CLIENT_9I2 = uuidv7();
const SITE_9I2 = uuidv7();
const INTERVENTION_9I2 = uuidv7();
const LIBELLE_SITE = "9I2-site-signature";

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  const jour = jourSuivant(reperes.lundi, RANG_SEMAINES * 7);
  const client = admin();
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "DUCOS" },
      select: { id: true },
    });
    await client.client.create({
      data: {
        id: CLIENT_9I2,
        societe_id: reperes.societeId,
        raison_sociale: "9I2-client-signature",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_9I2,
        societe_id: reperes.societeId,
        client_id: CLIENT_9I2,
        agence_id: agence.id,
        libelle: LIBELLE_SITE,
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION_9I2,
        societe_id: reperes.societeId,
        agence_id: agence.id,
        client_id: CLIENT_9I2,
        site_id: SITE_9I2,
        technicien_id: reperes.technicienDucos,
        type: "preventif_contrat",
        priorite: "p3",
        statut: "affectee",
        date_planifiee: new Date(
          Date.UTC(jour.annee, jour.mois - 1, jour.jour),
        ),
        creneau_debut: instantAMinutes(jour, 8 * 60, reperes.fuseau),
        creneau_fin: instantAMinutes(jour, 9 * 60, reperes.fuseau),
        duree_estimee_min: 60,
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.$executeRawUnsafe(
      `DELETE FROM "segment_travail" WHERE "intervention_id" = $1::uuid`,
      INTERVENTION_9I2,
    );
    await client.intervention.deleteMany({ where: { id: INTERVENTION_9I2 } });
    await client.site.deleteMany({ where: { id: SITE_9I2 } });
    await client.client.deleteMany({ where: { id: CLIENT_9I2 } });
  } finally {
    await client.$disconnect();
  }
});

async function ouvrirLaSessionDuTerrain(page: Page): Promise<void> {
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(COMPTE_TECHNICIEN_EPREUVE);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await expect(page).toHaveURL(/\/terrain$/);
}

for (const dpr of [1, 2, 3] as const) {
  test(`le trait de signature reste ~2 px CSS à DPR ${dpr}`, async ({
    browser,
  }) => {
    const contexte = await browser.newContext({
      viewport: { width: 375, height: 800 },
      deviceScaleFactor: dpr,
    });
    const page = await contexte.newPage();
    try {
      await ouvrirLaSessionDuTerrain(page);
      await page.goto(`/terrain/${INTERVENTION_9I2}`);
      await page
        .getByRole("button", { name: fr["terrain.signature.option_signee"] })
        .click();
      await page
        .getByLabel(fr["terrain.signature.nom_libelle"])
        .fill(fr["terrain.e2e.signataire_nom"]);

      await page.locator("canvas").evaluate((element) => {
        const rectangle = element.getBoundingClientRect();
        const envoyer = (type: string, x: number, y: number): void => {
          element.dispatchEvent(
            new PointerEvent(type, {
              bubbles: true,
              clientX: rectangle.left + x,
              clientY: rectangle.top + y,
              pointerId: 1,
            }),
          );
        };
        envoyer("pointerdown", 20, 20);
        envoyer("pointermove", 100, 80);
        envoyer("pointerup", 100, 80);
      });

      const mesure = await page.locator("canvas").evaluate((element) => {
        const canevas = element as HTMLCanvasElement;
        const contexte2d = canevas.getContext("2d");
        if (contexte2d === null) {
          throw new Error("contexte 2D absent");
        }
        const rectangle = canevas.getBoundingClientRect();
        const echelle = canevas.width / rectangle.width;
        return { lineWidth: contexte2d.lineWidth, echelle };
      });

      // ~2 PX CSS, PAS 1 PIXEL PHYSIQUE (le défaut d'avant ce ticket aurait
      // rendu `lineWidth === 1`, soit ~0,33 px CSS à DPR 3).
      expect(mesure.lineWidth / mesure.echelle).toBeCloseTo(2, 1);

      // EFFACE AVANT DE REFERMER — la fiche est partagée par les trois DPR
      // de cette boucle ; le prochain doit repartir d'un canevas vide.
      await page
        .getByRole("button", { name: fr["terrain.signature.effacer"] })
        .click();
    } finally {
      await contexte.close();
    }
  });
}
