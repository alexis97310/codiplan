import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { test, type Page } from "@playwright/test";

import { urlAdministration } from "./setup/base";
import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE 9BP-TP-A4a-MESSAGES — même recette que
 * `captures-gr15-motif-rejet.spec.ts` : rien n'est écrit sans la variable
 * d'environnement qui nomme le dossier, pour que `pnpm test:e2e` ordinaire
 * n'écrive jamais de fichier.
 *
 * **AVANT/APRÈS se prend en rejouant ce même fichier deux fois** — une fois
 * dans un `git worktree` posé sur le commit qui précède ce lot, une fois sur
 * le code livré — jamais en changeant ce fichier entre les deux. Aucune clé
 * `fr[...]` n'est lue ici : sur le code AVANT, les clés neuves de ce lot
 * n'existent pas encore, et `next build` type-vérifie ce fichier contre le
 * code qu'il capture (piège connu, voir la mémoire « captures-avant-apres-
 * e2e »). Chaque scène est une NAVIGATION, jamais une écriture : le motif
 * voyage par le paramètre d'URL que la route poserait elle-même.
 *
 * `CAPTURES_TPA4A_PHASE` (« avant » ou « apres ») n'influence QUE le nom du
 * fichier produit — jamais le code exécuté, qui est toujours celui du commit
 * sur lequel ce fichier tourne.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_TPA4A ?? "";
const PHASE = process.env.CAPTURES_TPA4A_PHASE ?? "apres";

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
  test(`captures — refus de droit, et trois motifs justes sur la fiche, à ${largeur}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 1200 });
    await ouvrirUneSession(page);
    const id = await uneInterventionExistante();

    // CS14 / TR-6 — le même refus qu'une session absente, puis le refus de
    // droit nommé.
    await page.goto(`/interventions/${id}?motif=auth.refus`);
    await capturer(page, "fiche-refus-connexion", largeur);
    await page.goto(`/interventions/${id}?motif=auth.refus_droit`);
    await capturer(page, "fiche-refus-droit", largeur);

    // IN-22 — Affecter : « habilitation » (faux, aucun technicien désigné)
    // puis le motif juste.
    await page.goto(
      `/interventions/${id}?motif=intervention.refus.habilitation`,
    );
    await capturer(page, "fiche-affecter", largeur);
    await page.goto(
      `/interventions/${id}?motif=intervention.refus.planification_technicien_manquant`,
    );
    await capturer(page, "fiche-affecter-corrige", largeur);

    // IN-22 — Suspendre : « motif manquant » (faux quand c'est la pièce et
    // sa date qui manquent) puis le motif juste.
    await page.goto(
      `/interventions/${id}?motif=intervention.refus.motif_manquant`,
    );
    await capturer(page, "fiche-suspendre", largeur);
    await page.goto(
      `/interventions/${id}?motif=intervention.refus.piece_et_date`,
    );
    await capturer(page, "fiche-suspendre-corrige", largeur);

    // IN-22 — Clôturer : « aucun temps mesuré » (faux pour un temps saisi
    // mais invalide) puis le motif juste.
    await page.goto(
      `/interventions/${id}?motif=intervention.refus.temps_manquant`,
    );
    await capturer(page, "fiche-cloturer", largeur);
    await page.goto(
      `/interventions/${id}?motif=intervention.refus.temps_invalide`,
    );
    await capturer(page, "fiche-cloturer-corrige", largeur);
  });

  test(`captures — connexion indisponible, période inversée, vides propres au filtre, à ${largeur}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 1200 });

    // TR-31 — une panne technique à la connexion, distincte du refus.
    await page.goto("/connexion?motif=auth.indisponible");
    await capturer(page, "connexion-indisponible", largeur);

    await ouvrirUneSession(page);

    // IN-07 — une période inversée se nomme désormais, au lieu de vider la
    // page en silence.
    await page.goto("/interventions?du=2026-10-10&au=2026-10-01");
    await capturer(page, "interventions-periode-inversee", largeur);

    // IN-12 — une recherche qui ne trouve rien affiche le texte du filtre,
    // jamais celui d'un registre réellement vide.
    await page.goto("/interventions?q=TPA4-AUCUN");
    await capturer(page, "interventions-recherche-vide", largeur);

    // PV-36 — même distinction, et le lien « Voir tout le registre », sur
    // VGP.
    await page.goto("/vgp?q=TPA4-AUCUN");
    await capturer(page, "vgp-recherche-vide", largeur);
  });
}
