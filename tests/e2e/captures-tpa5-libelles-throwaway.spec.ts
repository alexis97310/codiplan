import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { test, type Page } from "@playwright/test";

import { urlAdministration } from "./setup/base";
import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE 9BT-TP-A5-LIBELLES QUI EXIGENT UNE BASE JETABLE DÉDIÉE —
 * jamais la base partagée de `captures-tpa5-libelles.spec.ts`.
 *
 * ## POURQUOI CE FICHIER EST SÉPARÉ, ET POURQUOI IL REFUSE DE S'EXÉCUTER
 * CONTRE LA BASE ORDINAIRE
 *
 * Deux écrans ne peuvent PAS se photographier sur `codiplan_test`, la base
 * que TOUS les autres fichiers de `tests/e2e/` partagent sous
 * `fullyParallel` :
 *
 * — **PA-11 (« Remplacé le »)** exige un DEUXIÈME taux horaire, daté du
 *   passé. Un deuxième taux change la valorisation lue par
 *   `tests/e2e/taux-horaire-succession.spec.ts` et par tout scénario qui
 *   valorise une intervention — écrire ce taux sur la base partagée
 *   changerait le résultat d'un autre fichier sous nos yeux.
 * — **PA-19 (zone sans forfait de déplacement)** exige qu'AUCUN forfait de
 *   déplacement ne s'applique à une zone entière. La scène partagée en pose
 *   déjà deux, universels (`FORFAITS_SCENE`, `tests/e2e/setup/scene.ts`), et
 *   le semis en pose un troisième (`FORFAITS_DEMONSTRATION`,
 *   `prisma/seed-data.ts`) : les supprimer romprait
 *   `ecrans-largeur-utile.spec.ts`, qui compte ces lignes.
 *
 * Ce fichier prend donc sa PROPRE base — nommée par `E2E_DATABASE_URL` comme
 * toujours, mais lancé dans une INVOCATION SÉPARÉE de `pnpm exec playwright
 * test`, jamais dans la même exécution que le reste de la suite. Le
 * gardien ci-dessous refuse de continuer si cette base porte le nom de la
 * base ordinaire — la même famille de refus que `urlAdministration` applique
 * déjà à Neon.
 *
 * AVANT/APRÈS : même principe que `captures-tpa5-libelles.spec.ts`, deux
 * invocations séparées (git worktree pour AVANT), chacune sur sa PROPRE base
 * jetable — recréée par la préparation globale (`tests/e2e/setup/global.ts`),
 * jamais réutilisée d'une invocation à l'autre.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_TPA5_TAUX ?? "";
const PHASE = process.env.CAPTURES_TPA5_PHASE ?? "apres";

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

/** LE GARDIEN : cette base ne peut pas être celle que tout le reste partage. */
function refuserLaBasePartagee(): void {
  const nom = new URL(urlAdministration()).pathname.replace(/^\//, "");
  if (nom === "codiplan_test") {
    throw new Error(
      "captures-tpa5-libelles-throwaway.spec.ts exige une base JETABLE " +
        "dédiée : E2E_DATABASE_URL pointe vers « codiplan_test », la base " +
        "partagée par tous les autres scénarios. Poser une deuxième ligne " +
        "de taux horaire ou vider le catalogue de déplacement dessus " +
        "changerait ce qu'ils mesurent.",
    );
  }
}

async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  if (DOSSIER === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER, `${nom}-${PHASE}-${largeur}.png`),
    fullPage: true,
  });
}

/**
 * PRÉPARE LA SCÈNE PROPRE À CE FICHIER, une seule fois : un deuxième taux
 * horaire daté du passé (PA-11), et un catalogue de déplacement REMPLACÉ par
 * une seule ligne, scopée à une zone unique (PA-18, PA-19) — jamais posée
 * avant `ouvrirUneSession`, qui exige déjà une base migrée et semée par la
 * préparation globale.
 */
async function poserLaSceneJetable(): Promise<void> {
  if (DOSSIER === "") return;
  refuserLaBasePartagee();
  const client = admin();
  try {
    const societe = await client.societe.findFirstOrThrow({
      where: { code: "CODIMA-NC" },
      select: { id: true },
    });

    // PA-11 — un taux daté du passé, en plus de celui que la préparation
    // globale pose déjà (`FORFAITS_SCENE`/le taux de la scène,
    // `tests/e2e/setup/scene.ts`, daté du 01/01/2020) : la ligne la plus
    // récente reste « en vigueur », celle-ci devient « Remplacé le ... ».
    await client.tauxHoraire.create({
      data: {
        id: randomUUID(),
        societe_id: societe.id,
        date_effet: new Date("2018-01-01T00:00:00.000Z"),
        montant_mineur: BigInt(5000),
        devise_code: "XPF",
      },
    });

    // PA-18/PA-19 — le catalogue de déplacement de cette base REMPLACE celui
    // du semis et de la scène partagée : une seule ligne, scopée à
    // `grand_noumea`. La zone `sud` n'a donc plus aucun forfait de
    // déplacement qui s'y applique.
    await client.forfait.deleteMany({
      where: { societe_id: societe.id, type: "deplacement" },
    });
    await client.forfait.create({
      data: {
        id: randomUUID(),
        societe_id: societe.id,
        code: "TPA5-DEPL-GN",
        libelle: "Déplacement Grand Nouméa (démonstration TP-A5)",
        type: "deplacement",
        rang: 1,
        montant_mineur: BigInt(3500),
        devise_code: "XPF",
        zone_geo: ["grand_noumea"],
        cumulable_temps: false,
        actif: true,
      },
    });
    // PA-18 — une nature autre que le déplacement, pour montrer que le
    // calcul ne la sélectionne jamais (« Non appliqué par le calcul
    // aujourd'hui »), même retenue par `forfaitRetenu`.
    await client.forfait.create({
      data: {
        id: randomUUID(),
        societe_id: societe.id,
        code: "TPA5-PREST-GN",
        libelle: "Prestation forfaitaire (démonstration TP-A5)",
        type: "prestation",
        rang: 1,
        montant_mineur: BigInt(15000),
        devise_code: "XPF",
        zone_geo: ["grand_noumea"],
        cumulable_temps: false,
        actif: true,
      },
    });
  } finally {
    await client.$disconnect();
  }
}

// UNE SEULE FOIS — `mode: "serial"` rejoue les deux largeurs dans le MÊME
// fichier l'une après l'autre ; appeler `poserLaSceneJetable` depuis chaque
// test tenterait de poser deux fois la même date d'effet (contrainte
// d'unicité `societe_id, date_effet`).
test.beforeAll(async () => {
  await poserLaSceneJetable();
});

for (const largeur of [1280, 375] as const) {
  test(`captures — taux remplacé, forfaits zone avec/sans déplacement, à ${largeur}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 1200 });
    await ouvrirUneSession(page);

    // PA-11 — le taux du passé porte « Remplacé le ... ».
    await page.goto("/parametres/taux-horaire");
    await capturer(page, "taux-horaire-remplace", largeur);

    // PA-18 — zone où le déplacement est retenu, et la prestation ne l'est
    // jamais.
    await page.goto("/parametres/forfaits?zone=grand_noumea");
    await capturer(page, "forfaits-zone-avec-deplacement", largeur);

    // PA-19 — zone sans aucun forfait de déplacement applicable.
    await page.goto("/parametres/forfaits?zone=sud");
    await capturer(page, "forfaits-zone-sans-deplacement", largeur);
  });
}
