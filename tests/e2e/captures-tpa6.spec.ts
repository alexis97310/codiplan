import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { test, type Page } from "@playwright/test";

import { instantDuJour, jourDe, maintenant } from "@/lib/calendar/fuseau";
import { uuidv7 } from "@/lib/db/uuid";

import { urlAdministration } from "./setup/base";
import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE 9BX-TP-A6-TRIS-MISE-EN-PAGE (30/09/2026) — même recette que
 * `captures-9bv-dates-reprise.spec.ts` : rien n'est écrit sans la variable
 * d'environnement qui nomme le dossier, pour que `pnpm test:e2e` ordinaire
 * n'écrive jamais de fichier.
 *
 * **AVANT/APRÈS se prend en rejouant ce même fichier deux fois** — une fois
 * dans un `git worktree` posé sur le commit qui précède ce lot, une fois sur
 * le code livré (mémoire « captures-avant-apres-e2e »).
 *
 * ## Ce que ce fichier force, et pourquoi
 *
 * Aucune agence de démonstration n'est INACTIVE (PA-27) et aucune
 * intervention n'est ANNULÉE au jour même (IN-46) : les deux scènes sont
 * forgées ici, préfixées `TPA6-`, supprimées en fin de scénario — jamais une
 * ligne du semis touchée.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_TPA6 ?? "";
const PHASE = process.env.CAPTURES_TPA6_PHASE ?? "apres";

const AGENCE_INACTIVE_CAPTURE = uuidv7();
const INTERVENTION_ANNULEE_CAPTURE = uuidv7();

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

test.beforeAll(async () => {
  if (DOSSIER === "") return;
  const client = admin();
  try {
    const societe = await client.societe.findFirstOrThrow({
      where: { code: "CODIMA-NC" },
      select: { id: true, fuseau_horaire: true },
    });
    const agenceActive = await client.agence.findFirstOrThrow({
      where: { societe_id: societe.id, code: "DUCOS" },
      select: { id: true, calendrier_id: true, territoire: true },
    });

    // PA-27 — UNE AGENCE INACTIVE, POUR VOIR L'INACTIVE PASSER EN FIN DE
    // LISTE : partage le calendrier de Ducos, comme Dolbeau le fait déjà dans
    // le semis (D13) — aucun calendrier n'est forgé pour cette seule capture.
    await client.agence.create({
      data: {
        id: AGENCE_INACTIVE_CAPTURE,
        societe_id: societe.id,
        code: "TPA6INA",
        libelle: "TPA6-Zzz Agence inactive (capture)",
        actif: false,
        calendrier_id: agenceActive.calendrier_id,
        territoire: agenceActive.territoire,
      },
    });

    // IN-46 — UNE INTERVENTION ANNULÉE, PRIORITÉ P1, DATÉE D'AUJOURD'HUI —
    // même civile que `tableau-de-bord/page.tsx` calcule, sous le fuseau de
    // la société.
    const site = await client.site.findFirstOrThrow({
      where: { societe_id: societe.id, actif: true },
      select: { id: true, client_id: true, agence_id: true },
    });
    const jour = jourDe(maintenant(societe.fuseau_horaire).local);
    await client.intervention.create({
      data: {
        id: INTERVENTION_ANNULEE_CAPTURE,
        societe_id: societe.id,
        client_id: site.client_id,
        site_id: site.id,
        agence_id: site.agence_id,
        type: "curatif",
        statut: "annulee",
        priorite: "p1",
        date_planifiee: instantDuJour(jour),
        description: "TPA6- capture, supprimée en fin de scénario",
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  if (DOSSIER === "") return;
  const client = admin();
  try {
    await client.intervention.deleteMany({
      where: { id: INTERVENTION_ANNULEE_CAPTURE },
    });
    await client.agence.deleteMany({
      where: { id: AGENCE_INACTIVE_CAPTURE },
    });
  } finally {
    await client.$disconnect();
  }
});

for (const largeur of [1280, 375] as const) {
  test(`captures — parc, agences, équipe, absences, tableau de bord, à ${largeur}px`, async ({
    page,
  }) => {
    test.skip(DOSSIER === "", "capture inerte sans CAPTURES_TPA6");
    // CINQ PAGES PAR EXÉCUTION — le délai par défaut (30 s) est trop juste
    // (mesuré).
    test.setTimeout(90_000);
    await page.setViewportSize({ width: largeur, height: 1200 });
    await ouvrirUneSession(page);

    // PV-06 — l'aperçu du parc, une ligne sélectionnée pour révéler l'action
    // de `DetailHero`.
    await page.goto("/parc");
    const premiereLigne = page
      .locator('[data-bloc="liste-machines"] a')
      .first();
    if (await premiereLigne.isVisible()) {
      await premiereLigne.click();
    }
    await capturer(page, "parc-apercu", largeur);

    // PA-27 — les agences, inactive en fin de liste.
    await page.goto("/parametres/agences");
    await capturer(page, "agences-inactive-en-fin", largeur);

    // PA-39 — l'équipe, triée par nom.
    await page.goto("/parametres/equipe");
    await capturer(page, "equipe-tri-nom", largeur);

    // TR-9 — le sélecteur « Personne » des absences, FOCUSÉ mais FERMÉ : un
    // `<select>` natif ouvert est un popup du système d'exploitation que
    // Playwright ne peut pas garantir capturable (il a bloqué la capture en
    // 375px, mesuré) — le placeholder visible à l'état fermé suffit à
    // montrer PA-39/TR-9 (l'option vide n'existait pas avant ce lot).
    await page.goto("/absences");
    const selectPersonne = page.locator("#absence-personne");
    if (await selectPersonne.isVisible()) {
      await selectPersonne.focus();
    }
    await capturer(page, "absences-select-personne", largeur);

    // IN-46 — le tableau de bord, sans l'annulée du jour.
    await page.goto("/tableau-de-bord");
    await capturer(page, "tableau-de-bord-sans-annulee", largeur);
  });
}
