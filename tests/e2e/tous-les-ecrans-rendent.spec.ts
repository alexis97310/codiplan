import { readdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { urlAdministration } from "./setup/base";
import { COMPTE_ADMIN_SOCIETE_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * CHAQUE ÉCRAN DU BACK-OFFICE REND-IL RÉELLEMENT 200 ? (Lot PARC-BIS, 21/09/2026).
 *
 * ## Ce que ce fichier répare
 *
 * *Mesuré le 21/09/2026 : `/parc/nouvelle` et `/parc/[id]/modifier`
 * rendaient 500 en production — un digest distinct par écran — depuis le
 * lot PARC (#236, commit 6219c12), livrés et jamais corrigés depuis. La
 * cause : `<FormulaireMachine>` est un composant CLIENT, et les deux pages
 * lui passaient `urlRetour` comme une FONCTION. React ne sérialise pas une
 * fonction à travers la frontière serveur → client (« Functions cannot be
 * passed directly to Client Components… ») — une erreur de RENDU, que ni
 * `pnpm typecheck` (une fonction est un type valide) ni `pnpm lint` ni
 * `pnpm build` (ces pages sont dynamiques, dépendantes de la session : leurs
 * données ne se collectent jamais au build) ne peuvent voir.
 *
 * `tests/unit/ui/lot-parc.test.ts` ne le voyait pas non plus, et c'est la
 * leçon à retenir : il rend `<FormulaireMachine>` par `createElement`,
 * directement, CÔTÉ CLIENT — jamais à travers la frontière que Next.js
 * franchit, lui, à chaque requête réelle. *Une suite qui éprouve le
 * composant n'éprouve pas la frontière qui le porte jusqu'à l'écran.*
 *
 * `scripts/lib/atteignabilite-ecrans.ts` ne le voyait pas davantage, et pour
 * une raison différente, écrite dans son propre en-tête : il prouve qu'un
 * CHEMIN existe dans le code source, jamais que le RENDU ne lève pas. Les
 * deux écrans cassés étaient parfaitement atteignables — un lien y mène bel
 * et bien depuis `/parc` — et rendaient 500 tout de même.
 *
 * « Un déploiement vert ne prouve pas qu'un écran s'affiche. » — la panne du
 * 19/09 (cinq écrans morts pendant trois heures) et celle-ci (deux écrans de
 * plus, un temps que personne n'avait mesuré) partagent la même cause
 * profonde : rien, dans `pnpm verify` ni `pnpm verify:full`, n'ouvrait
 * réellement un navigateur sur CHAQUE écran du back-office. Ce fichier
 * ferme ce trou : il REND chaque écran, pour de vrai, et exige 200.
 *
 * ## La population des routes vient du DÉPÔT, jamais d'une liste recopiée
 *
 * Tout `page.tsx` sous `app/(back-office)/` y entre — même raison que
 * `ecransOrphelins` : *une liste d'admis oublie, par construction, l'écran
 * que personne n'y a ajouté.* Les segments dynamiques (`[id]`) ont besoin d'un
 * identifiant réel, et `[id]` désigne tour à tour une machine, un client, un
 * site, une intervention, un calendrier, une agence… jamais la même chose :
 * `RESOLVEURS` fournit donc un résolveur PAR ROUTE, pas par nom de
 * segment, et il est FERMÉ DANS LES DEUX SENS contre les routes dynamiques
 * que le dépôt porte réellement — une route dynamique sans résolveur, ou un
 * résolveur pour une route disparue, fait échouer la préparation plutôt que
 * de sauter en silence (même discipline que `docs/constitution/`, indexée
 * dans les deux sens contre `CLAUDE.md`).
 *
 * ## Ce qu'il ne couvre pas, et pourquoi c'est dit plutôt que masqué
 *
 * `/parametres/forfaits/[id]` et `/imports/[id]` n'ont AUCUNE ligne au semis
 * (`prisma/seed.ts` ne pose ni forfait ni lot d'import) : leurs scénarios
 * sont `test.skip`, avec un motif nommé, jamais un saut muet. Ce fichier
 * n'écrit pas cette donnée lui-même — voir la proposition de la revue pour
 * qui la doit.
 */

function racineBackOffice(): string {
  return join(process.cwd(), "app", "(back-office)");
}

/** Toutes les routes du back-office, DÉRIVÉES du dépôt — jamais recopiées. */
function routesBackOffice(): string[] {
  const routes: string[] = [];
  function explorer(dossier: string, segments: readonly string[]): void {
    for (const entree of readdirSync(dossier, { withFileTypes: true })) {
      const chemin = join(dossier, entree.name);
      if (entree.isDirectory()) {
        explorer(chemin, [...segments, entree.name]);
      } else if (entree.name === "page.tsx") {
        routes.push(`/${segments.join("/")}`);
      }
    }
  }
  explorer(racineBackOffice(), []);
  return routes.sort();
}

type Resolveur = (
  prisma: PrismaClient,
  societeId: string,
) => Promise<string | null>;

/**
 * Un résolveur PAR ROUTE dynamique — jamais par nom de segment (voir
 * l'en-tête). `null` : aucune ligne du semis ne porte cet écran, dans la
 * société de l'épreuve (`admin.societe@codima.test`, sur CODIMA-NC).
 */
const RESOLVEURS: Readonly<Record<string, Resolveur>> = {
  "/parc/[id]": async (prisma, societeId) =>
    (
      await prisma.machine.findFirst({
        where: { societe_id: societeId },
        select: { id: true },
      })
    )?.id ?? null,
  "/parc/[id]/modifier": async (prisma, societeId) =>
    (
      await prisma.machine.findFirst({
        where: { societe_id: societeId },
        select: { id: true },
      })
    )?.id ?? null,
  "/clients/[id]": async (prisma, societeId) =>
    (
      await prisma.client.findFirst({
        where: { societe_id: societeId },
        select: { id: true },
      })
    )?.id ?? null,
  "/sites/[id]": async (prisma, societeId) =>
    (
      await prisma.site.findFirst({
        where: { societe_id: societeId },
        select: { id: true },
      })
    )?.id ?? null,
  "/interventions/[id]": async (prisma, societeId) =>
    (
      await prisma.intervention.findFirst({
        where: { societe_id: societeId },
        select: { id: true },
      })
    )?.id ?? null,
  "/interventions/[id]/bon": async (prisma, societeId) =>
    (
      await prisma.intervention.findFirst({
        where: { societe_id: societeId },
        select: { id: true },
      })
    )?.id ?? null,
  // Renommé `[calendrier]` → `[id]` par AGENCE-1 (21/09/2026) : Next.js exige
  // un seul nom de segment dynamique par position dans l'arborescence, et
  // `/parametres/agences/[id]/modifier` (ajoutée par le même lot) partage
  // cette position. La valeur résolue reste un identifiant de CALENDRIER,
  // comme avant ce renommage.
  "/parametres/agences/[id]": async (prisma, societeId) =>
    (
      await prisma.calendrier.findFirst({
        where: { societe_id: societeId },
        select: { id: true },
      })
    )?.id ?? null,
  // AGENCE-1 — la valeur résolue est ici un identifiant d'AGENCE, jamais de
  // calendrier : les deux routes partagent le nom `[id]` sans partager
  // l'entité qu'il désigne, ce que Next.js permet et que ce fichier documente.
  "/parametres/agences/[id]/modifier": async (prisma, societeId) =>
    (
      await prisma.agence.findFirst({
        where: { societe_id: societeId },
        select: { id: true },
      })
    )?.id ?? null,
  "/vgp/enregistrer/[id]": async (prisma, societeId) =>
    (
      await prisma.machine.findFirst({
        where: { societe_id: societeId },
        select: { id: true },
      })
    )?.id ?? null,
  // Aucune ligne au semis — voir l'en-tête, section « Ce qu'il ne couvre pas ».
  "/parametres/forfaits/[id]": async () => null,
  "/imports/[id]": async () => null,
};

// Même identité que la mesure d'origine (« compte admin_societe »), et le
// seul moyen d'ouvrir CHAQUE écran du back-office : `adv` (le compte courant
// des autres scénarios) n'a pas nécessairement la matrice complète.
// `serial`, comme `equipe.spec.ts` et `montants-par-role.spec.ts` : le
// second facteur de ce compte est un TOTP dépendant du temps, et deux
// connexions concurrentes sur la MÊME identité risqueraient un code déjà
// consommé.
test.describe.configure({ mode: "serial" });

let prisma: PrismaClient;
let societeId: string;

test.beforeAll(async () => {
  prisma = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  const societe = await prisma.societe.findFirstOrThrow({
    where: { code: "CODIMA-NC" },
    select: { id: true },
  });
  societeId = societe.id;
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

const ROUTES = routesBackOffice();
const ROUTES_DYNAMIQUES = ROUTES.filter((route) => route.includes("["));

test("les résolveurs de segments dynamiques couvrent EXACTEMENT les routes dynamiques du dépôt", () => {
  const sansResolveur = ROUTES_DYNAMIQUES.filter(
    (route) => !(route in RESOLVEURS),
  );
  const resolveursPerimes = Object.keys(RESOLVEURS).filter(
    (route) => !ROUTES_DYNAMIQUES.includes(route),
  );
  expect(
    sansResolveur,
    `route(s) dynamique(s) du dépôt sans résolveur dans ce fichier : ${sansResolveur.join(", ")}`,
  ).toEqual([]);
  expect(
    resolveursPerimes,
    `résolveur(s) pour une route qui n'existe plus dans le dépôt : ${resolveursPerimes.join(", ")}`,
  ).toEqual([]);
});

for (const route of ROUTES) {
  test(`${route} rend 200`, async ({ page }) => {
    let chemin = route;
    if (route.includes("[")) {
      const resoudre = RESOLVEURS[route];
      if (resoudre === undefined) {
        // Le test de fermeture ci-dessus rougit déjà dans ce cas ; ce message
        // évite seulement un `undefined()` opaque si les deux tournent hors
        // ordre (`fullyParallel`).
        throw new Error(`Aucun résolveur enregistré pour ${route}.`);
      }
      const id = await resoudre(prisma, societeId);
      test.skip(
        id === null,
        `aucune ligne du semis (société CODIMA-NC) ne porte ${route} — voir l'en-tête de ce fichier`,
      );
      if (id === null) {
        return;
      }
      chemin = route.replace(/\[[^\]]+\]/, id);
    }

    await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
    const reponse = await page.goto(chemin);
    expect(reponse, `${chemin} n'a rendu aucune réponse`).not.toBeNull();
    expect(
      reponse!.status(),
      `${chemin} a répondu ${reponse!.status()} au lieu de 200`,
    ).toBe(200);
    expect(
      new URL(page.url()).pathname,
      `${chemin} a fini sur ${new URL(page.url()).pathname} — une redirection masquerait un 200 qui ne prouve rien`,
    ).toBe(chemin);
  });
}

/**
 * UN SEGMENT MAL FORMÉ EST UN REFUS, JAMAIS UNE PANNE (AGENCE-1, DÉFAUT 2 —
 * revue Codex de #275).
 *
 * ## Pourquoi ce n'est PAS une extension de la boucle ci-dessus
 *
 * La boucle `for (const route of ROUTES)` n'ouvre CHAQUE écran qu'avec un
 * identifiant RÉEL, résolu par `RESOLVEURS` — c'est tout son objet, écrit en
 * tête de ce fichier. La généraliser à un identifiant MALFORMÉ pour chaque
 * route dynamique du dépôt ferait rougir cette suite sur des écrans qu'AGENCE-1
 * ne touche pas : mesuré à la relecture, aucun des `RESOLVEURS` existants
 * (`/parc/[id]`, `/clients/[id]`, `/sites/[id]`, `/interventions/[id]`…) ne
 * valide la forme de son identifiant avant de lire sa fiche — le même défaut,
 * ailleurs, non corrigé par ce lot. En faire une exigence générale ouvrirait
 * un chantier qui déborde AGENCE-1 ; ce scénario reste donc SCOPÉ à la seule
 * route que ce lot corrige.
 *
 * Ce scénario n'a pas pu être exécuté dans ce lot — le bac à sable ne joint ni
 * PostgreSQL ni Docker (voir la proposition #275) — mais il documente le
 * comportement attendu pour la prochaine exécution réelle de `pnpm
 * test:e2e`.
 */
test("un identifiant mal formé rend 404, jamais 500 (/parametres/agences/[id]/modifier)", async ({
  page,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
  const reponse = await page.goto("/parametres/agences/pas-un-uuid/modifier");
  expect(reponse, "aucune réponse rendue").not.toBeNull();
  expect(
    reponse!.status(),
    `a répondu ${reponse!.status()} au lieu de 404`,
  ).toBe(404);
});
