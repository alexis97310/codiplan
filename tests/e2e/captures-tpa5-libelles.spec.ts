import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { test, type Page } from "@playwright/test";

import { urlAdministration } from "./setup/base";
import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE 9BT-TP-A5-LIBELLES (29/09/2026) — même recette que
 * `captures-tpa4a-messages.spec.ts` : rien n'est écrit sans la variable
 * d'environnement qui nomme le dossier, pour que `pnpm test:e2e` ordinaire
 * n'écrive jamais de fichier.
 *
 * **AVANT/APRÈS se prend en rejouant ce même fichier deux fois** — une fois
 * dans un `git worktree` posé sur le commit qui précède ce lot, une fois sur
 * le code livré. Aucune clé `fr[...]` n'est lue ici : sur le code AVANT, les
 * clés neuves n'existent pas encore, et `next build` type-vérifie ce fichier
 * contre le code qu'il capture (mémoire « captures-avant-apres-e2e »).
 *
 * `CAPTURES_TPA5_PHASE` n'influence QUE le nom du fichier produit — jamais
 * le code exécuté, qui est toujours celui du commit sur lequel ce fichier
 * tourne.
 *
 * ## CE QUE CE FICHIER NE CAPTURE PAS
 *
 * — `/portail` : AUCUN compte portail ne peut ouvrir de session aujourd'hui
 *   (D10 — `utilisateur_societe.count` vaut zéro pour un compte portail,
 *   `reemettreJetonPremierAcces` le refuse). Même constat que
 *   `docs/propositions/ERGO-PRISE-DE-VUE/passation.md` : refus documenté,
 *   pas une régression de ce lot.
 * — Le statut « Remplacé le » (PA-11) et la zone sans forfait de déplacement
 *   (PA-19) : `tests/e2e/captures-tpa5-libelles-throwaway.spec.ts`, sur une
 *   base JETABLE dédiée — jamais sur la base partagée de ce fichier, qui
 *   servirait aussi aux autres scénarios de `taux_horaire`/`forfait`.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_TPA5 ?? "";
const PHASE = process.env.CAPTURES_TPA5_PHASE ?? "apres";

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
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

/** N'IMPORTE QUELLE machine de la société — une simple LECTURE. */
async function uneMachineExistante(): Promise<string> {
  const client = admin();
  try {
    const societe = await client.societe.findFirstOrThrow({
      where: { code: "CODIMA-NC" },
      select: { id: true },
    });
    const machine = await client.machine.findFirstOrThrow({
      where: { societe_id: societe.id },
      select: { id: true },
    });
    return machine.id;
  } finally {
    await client.$disconnect();
  }
}

/** N'IMPORTE QUELLE intervention de la société — une simple LECTURE. */
async function uneInterventionExistante(): Promise<string> {
  const client = admin();
  try {
    const societe = await client.societe.findFirstOrThrow({
      where: { code: "CODIMA-NC" },
      select: { id: true },
    });
    const intervention = await client.intervention.findFirstOrThrow({
      where: { societe_id: societe.id },
      select: { id: true },
    });
    return intervention.id;
  } finally {
    await client.$disconnect();
  }
}

for (const largeur of [1280, 375] as const) {
  test(`captures — parc, fiche machine, clients, refus temps manquant, à ${largeur}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 1200 });
    await ouvrirUneSession(page);

    // PV-02 — l'aperçu et la fiche ne composent plus « Agence CODIMA ».
    const machineId = await uneMachineExistante();
    await page.goto(`/parc?machine=${machineId}`);
    await capturer(page, "parc-apercu-agence", largeur);

    await page.goto(`/parc/${machineId}`);
    await capturer(page, "fiche-machine-agence", largeur);

    // CS1 — le badge « Actif »/« Inactif », masculin comme le reste du
    // produit. `sans_equipement=1` : « Ancien client » (inactif) n'a aucun
    // équipement et resterait sinon masqué par le filtre par défaut
    // (LISTES-1) — sans lui, seuls des clients actifs seraient visibles.
    await page.goto("/clients?sans_equipement=1");
    await capturer(page, "clients-badges", largeur);

    // TR-53 — le refus de clôture ne nomme plus « Winpro ».
    const interventionId = await uneInterventionExistante();
    await page.goto(
      `/interventions/${interventionId}?motif=intervention.refus.temps_manquant`,
    );
    await capturer(page, "fiche-refus-temps-manquant", largeur);
  });
}
