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
 * **CE QUE `ctx.lineWidth` NE PROUVE PAS (9IC-CORRECTIFS-COURTS, réserve du
 * solde 593)** — relire la PROPRIÉTÉ posée sur le contexte ne prouve pas ce
 * que le canevas a réellement DESSINÉ : un bogue dans la conversion
 * `positionCanevas`, ou dans `lineCap`/`lineJoin`, laisserait `lineWidth`
 * correct tout en traçant un trait d'une autre épaisseur. À DPR 1 et 3, une
 * seconde mesure relit donc les PIXELS du PNG réellement enregistré
 * (`canvas.toDataURL()`, décodé dans la page par une seconde balise `Image`)
 * après un trait HORIZONTAL dédié — l'épaisseur verticale d'un trait
 * horizontal est sans ambiguïté, alors que celle du trait diagonal mesuré
 * par `ctx.lineWidth` ci-dessus ne le serait pas.
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

      if (dpr === 1 || dpr === 3) {
        // EFFACE LE TRAIT DIAGONAL — la mesure PNG qui suit veut un trait
        // HORIZONTAL, sans ambiguïté, pas la diagonale ci-dessus.
        await page
          .getByRole("button", { name: fr["terrain.signature.effacer"] })
          .click();

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
          envoyer("pointerdown", 40, 50);
          envoyer("pointermove", 120, 50);
          envoyer("pointerup", 120, 50);
        });

        // LES PIXELS DU PNG RÉELLEMENT ENREGISTRÉ, PAS LA PROPRIÉTÉ
        // `lineWidth` — voir le docblock. `positionCanevas` convertit déjà le
        // point du pointeur à l'échelle de la résolution interne, si bien que
        // le trait horizontal tracé en x ∈ [40, 120] (coordonnées CSS) occupe
        // x ∈ [40 × échelle, 120 × échelle] en pixels internes — la même
        // échelle que celle du PNG décodé ci-dessous.
        const mesurePixels = await page
          .locator("canvas")
          .evaluate(async (element) => {
            const canevas = element as HTMLCanvasElement;
            const rectangle = canevas.getBoundingClientRect();
            const echelleInterne = canevas.width / rectangle.width;
            const xInterne = Math.round(80 * echelleInterne);

            const image = new Image();
            await new Promise<void>((resolve, reject) => {
              image.onload = () => resolve();
              image.onerror = () => reject(new Error("décodage du PNG échoué"));
              image.src = canevas.toDataURL();
            });

            const decodeur = document.createElement("canvas");
            decodeur.width = image.naturalWidth;
            decodeur.height = image.naturalHeight;
            const contexteDecodeur = decodeur.getContext("2d");
            if (contexteDecodeur === null) {
              throw new Error("contexte 2D absent (décodage)");
            }
            contexteDecodeur.drawImage(image, 0, 0);

            const donnees = contexteDecodeur.getImageData(
              xInterne,
              0,
              1,
              decodeur.height,
            ).data;
            let epaisseur = 0;
            for (let y = 0; y < decodeur.height; y += 1) {
              if (donnees[y * 4 + 3] > 0) epaisseur += 1;
            }
            return { epaisseur, echelleInterne };
          });

        // ≈ 2 × DPR PIXELS INTERNES — le défaut d'avant ce ticket aurait
        // rendu un trait d'ÉPAISSEUR CONSTANTE (~1 pixel physique) QUEL QUE
        // SOIT LE DPR ; `epaisseur ≥ dpr + 1` sépare sans ambiguïté les deux :
        // à DPR 1, le défaut rendrait 1, le correctif ≥ 2 ; à DPR 3, le
        // défaut rendrait 1, le correctif ≥ 4 (en pratique ~6 à 8).
        expect(mesurePixels.epaisseur).toBeGreaterThanOrEqual(dpr + 1);
        expect(mesurePixels.epaisseur).toBeLessThanOrEqual(dpr * 4 + 2);
      }

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
