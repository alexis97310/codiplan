import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { pathToFileURL } from "node:url";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { fr } from "@/lib/i18n/fr";

/**
 * AV-11 (LOT AV-11 + D-04) — LE REPLI DE CHARGEMENT REVIENT, ÉCRAN PAR ÉCRAN,
 * JAMAIS À LA RACINE.
 *
 * ## La panne que ce gardien existe pour empêcher de se reproduire
 *
 * `app/loading.tsx` a existé (#217) et a été retiré (17/09/2026) : posé à la
 * racine, il enveloppait TOUT `{children}` de la mise en page racine — barre
 * de navigation comprise — dans une seule frontière, restée bloquée sur
 * « Chargement… » à l'infini en production, base et migrations pourtant
 * saines (voir `scripts/lib/verdict-deploiement.ts`, `GESTE_PAGE_BLOQUEE`).
 *
 * Ce ticket repose des replis, mais UN PAR ÉCRAN, jamais un qui couvre
 * l'application entière. Ce fichier tient la garantie dans les DEUX sens :
 * sa **population est DÉRIVÉE** de `app/` (même discipline que
 * `tests/unit/app/barre-par-segment.test.ts`) — un `loading.tsx` posé demain
 * y entre le jour où son fichier apparaît, sans qu'on revienne modifier une
 * liste tenue à la main.
 *
 * ## Ce qu'il vérifie, et pourquoi chaque règle ferme exactement le défaut mesuré
 *
 * 1. **Aucun `loading.tsx` ne partage son répertoire avec un `layout.tsx`.**
 *    C'est la faute exacte de #217 : une frontière posée au niveau d'une mise
 *    en page couvre tout ce que cette mise en page rend, y compris la barre.
 *    Un `loading.tsx` posé à côté d'un `page.tsx`, dans un répertoire SANS
 *    mise en page propre, ne peut structurellement couvrir que le contenu de
 *    CET écran.
 * 2. **Chaque `loading.tsx` a un `page.tsx` voisin, async.** Un repli sans
 *    page voisine ne protège rien ; un repli à côté d'une page SYNCHRONE ne
 *    s'affichera jamais — les deux sont un fichier mort.
 * 3. **Chaque `loading.tsx` est lui-même SYNCHRONE et SANS LECTURE.** Un repli
 *    qui ferait sa propre attente ne pourrait jamais garantir sa propre fin —
 *    exactement le mécanisme qu'on veut exclure par construction, plutôt que
 *    par mesure a posteriori.
 * 4. **Chaque `loading.tsx` RESTITUE le texte partagé, et cède la place.**
 *    Rendu isolément (sans DB, sans réseau — c'est tout l'intérêt d'un
 *    composant synchrone), il affiche `etat.chargement` sous `role="status"`.
 */

const RACINE_APP = join(process.cwd(), "app");
const HORS_PERIMETRE = new Set(["api"]);

function fichiersDuRepertoire(
  repertoire: string,
  nom: string,
): readonly string[] {
  const trouves: string[] = [];
  for (const entree of readdirSync(repertoire)) {
    const chemin = join(repertoire, entree);
    if (statSync(chemin).isDirectory()) {
      if (HORS_PERIMETRE.has(entree)) continue;
      trouves.push(...fichiersDuRepertoire(chemin, nom));
    } else if (entree === nom) {
      trouves.push(chemin);
    }
  }
  return trouves;
}

const REPLIS = fichiersDuRepertoire(RACINE_APP, "loading.tsx");

function aUnVoisin(chemin: string, nom: string): boolean {
  return readdirSync(dirname(chemin)).includes(nom);
}

function estAsync(cheminDePage: string): boolean {
  return readFileSync(cheminDePage, "utf8").includes(
    "export default async function",
  );
}

/**
 * Un repli sans lecture ni attente : ni `async`, ni `await`, ni un import de
 * la couche base de données. La négation positive est volontaire — un repli
 * qui ajouterait demain un mot-clé `async` doit rougir ICI, pas au premier
 * incident de production.
 */
function estSynchroneEtSansLecture(cheminDuRepli: string): boolean {
  const texte = readFileSync(cheminDuRepli, "utf8");
  return (
    !texte.includes("async ") &&
    !texte.includes("await ") &&
    !texte.includes("@/lib/db")
  );
}

describe("le repli de chargement d'un écran, jamais de la racine (AV-11)", () => {
  it("observe des replis — sans quoi tout ce qui suit ne mesure rien", () => {
    // Témoin de non-vacuité : un décompte nul ressemble à un sans-faute.
    expect(REPLIS.length).toBeGreaterThanOrEqual(5);
  });

  it("app/loading.tsx — LA faute exacte de #217 — n'existe pas", () => {
    expect(REPLIS).not.toContain(join(RACINE_APP, "loading.tsx"));
  });

  it("aucun repli ne partage son répertoire avec une mise en page", () => {
    const ecarts = REPLIS.filter((repli) => aUnVoisin(repli, "layout.tsx")).map(
      (repli) => relative(process.cwd(), repli),
    );
    expect(ecarts).toEqual([]);
  });

  it("chaque repli a une page voisine, et elle est asynchrone", () => {
    const ecarts = REPLIS.filter((repli) => {
      const page = join(dirname(repli), "page.tsx");
      return !aUnVoisin(repli, "page.tsx") || !estAsync(page);
    }).map((repli) => relative(process.cwd(), repli));
    expect(ecarts).toEqual([]);
  });

  it("chaque repli est synchrone et ne lit rien — il ne peut pas rester bloqué par lui-même", () => {
    const ecarts = REPLIS.filter(
      (repli) => !estSynchroneEtSansLecture(repli),
    ).map((repli) => relative(process.cwd(), repli));
    expect(ecarts).toEqual([]);
  });

  it("chaque repli rendu isolément affiche le texte partagé et cède ensuite la place", async () => {
    for (const repli of REPLIS) {
      const importe = (await import(pathToFileURL(repli).href)) as {
        default: () => React.JSX.Element;
      };
      const Repli = importe.default;
      const { unmount } = render(<Repli />);

      const statut = screen.getByRole("status");
      expect(statut).toHaveTextContent(fr["etat.chargement"]);

      // CÈDE LA PLACE : un repli qui resterait affiché après le démontage de
      // son arbre serait la forme même du défaut de #217 — une frontière qui
      // ne se referme jamais. Un composant synchrone n'a rien qui puisse
      // l'en empêcher, et ce test le constate plutôt que de le supposer.
      unmount();
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    }
  });
});
