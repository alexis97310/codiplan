/**
 * LA FILE DE NUIT — la lecture de `docs/backlog.md` que la session nocturne fait.
 *
 * UNE SEULE MAISON. Le script `pnpm file` et le gardien
 * `tests/unit/docs/file-de-nuit.test.ts` lisent tous deux d'ici : deux lectures
 * d'un même critère divergent en silence (§9 du CLAUDE.md, 01/09/2026), et la
 * parade est de n'en écrire qu'une.
 *
 * LA POPULATION EST DÉRIVÉE DU DOCUMENT, jamais tenue à la main : tout titre de
 * ticket entre dans la file le jour où il est écrit, et réclame son marqueur.
 * C'est le renversement de D41 et de D55 appliqué au backlog — une liste
 * d'ADMIS tenue à la main oublie, par construction, le ticket que personne n'y
 * a ajouté.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

export const CHEMIN_BACKLOG = join(process.cwd(), "docs", "backlog.md");

export type EtatDeFile = "LIBRE" | "LIVRÉ" | "BLOQUÉ";

export type TicketDeFile = {
  readonly identifiant: string;
  readonly titre: string;
  /** Ligne 1-indexée du TITRE dans `docs/backlog.md`. */
  readonly ligne: number;
  readonly etat: EtatDeFile | null;
  /** Renseigné pour le seul état `BLOQUÉ`. Vide = défaut. */
  readonly motif: string;
};

/** Un titre de ticket : `**L2-01** …` comme `**L0-01 — …**`. Les deux graphies existent. */
const TITRE = /^\*\*(L\d+-\d+[a-z]?)\b(?:\*\*)?[\s—-]*(.*)$/;
/** Le marqueur, sur la ligne qui suit immédiatement le titre. */
const MARQUEUR = /^\*File :\*\s+(LIBRE|LIVRÉ|BLOQUÉ)\s*(?:—\s*(.*))?$/;

export function lireLaFile(texte?: string): TicketDeFile[] {
  const lignes = (texte ?? readFileSync(CHEMIN_BACKLOG, "utf8")).split("\n");
  const tickets: TicketDeFile[] = [];

  for (let i = 0; i < lignes.length; i += 1) {
    const titre = TITRE.exec(lignes[i]);
    if (!titre) continue;

    const suivante = lignes[i + 1] ?? "";
    const marque = MARQUEUR.exec(suivante.trim());

    tickets.push({
      identifiant: titre[1],
      titre: titre[2].replace(/\*\*$/, "").trim(),
      ligne: i + 1,
      etat: marque ? (marque[1] as EtatDeFile) : null,
      motif: (marque?.[2] ?? "").trim(),
    });
  }

  return tickets;
}

export type Ecart = { readonly ticket: TicketDeFile; readonly raison: string };

/**
 * ELLE NE S'APPELLE PAS `ecartsDeLaFile`, ET CE N'EST PAS UN DÉTAIL. Tout export
 * nommé `ecarts…` dans `scripts/lib/` est, par convention gardée, un contrôle de
 * la VEILLE de la base hébergée — `tests/unit/veille-hebergee.test.ts` le réclame
 * alors dans la liste des contrôles câblés. Le motif est délibérément LARGE, et
 * il a mordu ici le jour même : la file de nuit n'observe aucune base, elle n'est
 * pas un contrôle de veille. *C'est au nouveau venu de changer de nom, jamais au
 * gardien d'élargir son motif.*
 *
 * Ce qui rend la file ILLISIBLE — et donc ce qui doit faire échouer `verify`.
 *
 * Deux défauts, et le second est celui qu'on oublie : un ticket sans marqueur
 * n'a pas d'état, et un `BLOQUÉ` sans motif n'en dit pas plus que « non ».
 * *Un blocage dont personne ne nomme la cause ne se lève jamais, faute de
 * savoir qui doit agir.*
 */
export function defautsDeLaFile(tickets: readonly TicketDeFile[]): Ecart[] {
  const ecarts: Ecart[] = [];
  for (const ticket of tickets) {
    if (ticket.etat === null) {
      ecarts.push({
        ticket,
        raison:
          "aucun marqueur `*File :*` sur la ligne qui suit le titre — trois états, et trois seulement : LIBRE, LIVRÉ, BLOQUÉ — <motif>",
      });
      continue;
    }
    if (ticket.etat === "BLOQUÉ" && ticket.motif.length === 0) {
      ecarts.push({
        ticket,
        raison:
          "marqué BLOQUÉ sans motif — le motif dit PAR QUOI, en une ligne, et il est obligatoire",
      });
    }
  }
  return ecarts;
}

/** Le premier travail non bloqué, dans l'ordre du document. `null` si la file est épuisée. */
export function premierTravailLibre(
  tickets: readonly TicketDeFile[],
): TicketDeFile | null {
  return tickets.find((t) => t.etat === "LIBRE") ?? null;
}
