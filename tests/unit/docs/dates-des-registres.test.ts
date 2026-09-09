import { readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { RACINE } from "../outils/fichiers-source";

/**
 * AUCUN REGISTRE NE PORTE UNE DATE QU'ON N'A PAS LUE.
 *
 * **Le fait, mesuré le 9 septembre 2026.** Trois registres portaient une date
 * POSTÉRIEURE au jour où ils ont été écrits :
 *
 * | Fichier | Dit | Ajouté le (date d'auteur du commit) |
 * |---|---|---|
 * | `2026-09-09-journee.md` | 09/09 | **08/09** |
 * | `2026-09-10-nuit.md` | 10/09 | **09/09** |
 * | `2026-09-11-nuit.md` | 11/09 | **09/09** |
 *
 * Et l'écart ne se lit pas seulement sur l'horloge de la machine, qui pourrait
 * être fausse : **une horloge EXTÉRIEURE le confirme**. Le flux planifié de la
 * CI tourne chaque jour à 15 h 00 UTC ; sa dernière exécution, lue par l'API de
 * GitHub, est datée du `2026-09-08T15:13:34Z`. S'il était le 11, il y aurait
 * trois exécutions de plus. *Deux horloges indépendantes disent le 9.*
 *
 * **Pourquoi c'est plus grave qu'une coquille.** Un registre est la PISTE
 * D'AUDIT du travail : c'est lui qu'on relit pour savoir quand une décision a
 * été prise et dans quel ordre. Une date écrite de mémoire y met un fait faux à
 * l'endroit exact où l'on vient chercher un fait — la même espèce que l'état
 * affirmé au lieu d'être observé (§9 du CLAUDE.md, 07/09), et une durée en est
 * un (§9, 09/09).
 *
 * **Ce que ce gardien tient, et ce qu'il ne tient pas.** Il refuse une date
 * FUTURE, et rien d'autre. Un registre daté d'hier est légitime — on complète,
 * on reprend. Un registre daté de demain ne l'est jamais : personne n'a lu cette
 * date, elle a été supposée. C'est la borne la plus étroite qui attrape la
 * faute observée, et elle ne demande ni historique git ni profondeur de clone.
 */

/** Les registres déjà écrits quand la faute a été trouvée — INVENTAIRE, pas exemption. */
const INVENTAIRE_ANTERIEUR: ReadonlyArray<{
  fichier: string;
  ecritLe: string;
}> = [
  // Même forme que l'inventaire des migrations déjà appliquées qui violent la
  // règle des blocs de garde (§9, 07/09) : ce qui est poussé ne se réécrit pas,
  // et *un défaut connu et inventorié n'est pas le même objet qu'un défaut
  // connu et unique*. Chacun porte, dans son texte, la note de correction qui
  // dit la date mesurée.
  { fichier: "2026-09-10-nuit.md", ecritLe: "2026-09-09" },
  { fichier: "2026-09-11-nuit.md", ecritLe: "2026-09-09" },
];

const REPERTOIRE = join(RACINE, "docs", "registres");
const MOTIF_DATE = /^(\d{4})-(\d{2})-(\d{2})-/;

/** Aujourd'hui, en UTC, sous la forme `AAAA-MM-JJ`. */
function aujourdhui(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Les registres, avec la date que porte leur nom. */
function registres(): ReadonlyArray<{ fichier: string; date: string }> {
  return readdirSync(REPERTOIRE)
    .filter((fichier) => fichier.endsWith(".md"))
    .flatMap((fichier) => {
      const trouve = MOTIF_DATE.exec(fichier);
      return trouve === null
        ? []
        : [{ fichier, date: `${trouve[1]}-${trouve[2]}-${trouve[3]}` }];
    });
}

/** Les registres dont la date est postérieure à `jour`. Rendus triés. */
export function registresDatesDuFutur(jour: string): string[] {
  const inventories = new Set(
    INVENTAIRE_ANTERIEUR.map((entree) => entree.fichier),
  );
  return registres()
    .filter(
      (registre) =>
        registre.date > jour && !inventories.has(registre.fichier),
    )
    .map((registre) => `${registre.fichier} — daté du ${registre.date}`)
    .sort();
}

describe("les dates des registres sont LUES, jamais supposées", () => {
  it("regarde bien des registres — sinon le gardien serait vide", () => {
    // Un décompte nul ressemble toujours à un sans-faute (§9, 30/08). Deux
    // témoins : la population existe, et elle porte bien des dates analysées.
    const tous = registres();
    expect(tous.length).toBeGreaterThanOrEqual(4);
    expect(tous.every((registre) => /^\d{4}-\d{2}-\d{2}$/.test(registre.date))).toBe(
      true,
    );
  });

  it("aucun registre n'est daté du futur", () => {
    expect(
      registresDatesDuFutur(aujourdhui()),
      "un registre porte une date postérieure à aujourd'hui : elle n'a pas " +
        "été lue, elle a été supposée. Un registre est la piste d'audit du " +
        "travail ; une date fausse y met un fait faux à l'endroit exact où " +
        "l'on vient chercher un fait. Lire `date -u` avant de nommer le " +
        "fichier.",
    ).toEqual([]);
  });

  it("l'INVENTAIRE s'adosse à des fichiers qui existent", () => {
    // Une liste qui nomme un chemin devient muette le jour où ce chemin
    // change, et personne ne le voit (§9, 31/08 — le témoin d'adossement).
    const noms = new Set(registres().map((registre) => registre.fichier));
    for (const entree of INVENTAIRE_ANTERIEUR) {
      expect(noms, `inventaire orphelin : ${entree.fichier}`).toContain(
        entree.fichier,
      );
    }
  });

  it("l'inventaire ne couvre QUE des dates réellement postérieures", () => {
    // Le sens inverse : une entrée d'inventaire qui ne serait pas fautive
    // serait une exemption gratuite. Chacune doit porter une date d'écriture
    // ANTÉRIEURE à celle que son nom annonce — sans quoi elle n'a rien à faire
    // dans cet inventaire.
    for (const entree of INVENTAIRE_ANTERIEUR) {
      const annoncee = MOTIF_DATE.exec(entree.fichier)?.slice(1, 4).join("-");
      expect(annoncee, entree.fichier).toBeDefined();
      expect(
        entree.ecritLe < (annoncee ?? ""),
        `${entree.fichier} n'est pas daté du futur : il n'a rien à faire dans l'inventaire`,
      ).toBe(true);
    }
  });
});

describe("le gardien mis en échec", () => {
  it("ROUGIT sur une date future, sur la population réelle", () => {
    // La faute telle qu'elle s'est commise : un registre nommé pour demain.
    // On la rejoue en reculant la date de référence d'un jour — ce qui rend
    // fautif le registre le plus récent, quel qu'il soit.
    // Le sujet doit être HORS INVENTAIRE : reculer la référence sous un
    // registre inventorié ne produirait aucune violation, et l'épreuve serait
    // creuse — c'est la moitié de faute qu'on oublie de rejouer (§9, 11/09).
    const inventories = new Set(
      INVENTAIRE_ANTERIEUR.map((entree) => entree.fichier),
    );
    const dates = registres()
      .filter((registre) => !inventories.has(registre.fichier))
      .map((registre) => registre.date)
      .sort();
    expect(dates.length, "aucun registre hors inventaire").toBeGreaterThan(0);
    const veilleDuDernier = dates[dates.length - 1]!;
    const recule = new Date(`${veilleDuDernier}T00:00:00.000Z`);
    recule.setUTCDate(recule.getUTCDate() - 1);

    const fautifs = registresDatesDuFutur(recule.toISOString().slice(0, 10));
    expect(fautifs.length).toBeGreaterThan(0);
    expect(fautifs.join(" ")).toContain(veilleDuDernier);
  });

  it("RESTE VERT sur une date d'hier, et pour sa propre raison", () => {
    // La direction permissive — celle qui ne produit aucun signal (§9, 11/09).
    // Un registre daté d'hier est légitime, et le gardien doit le laisser
    // passer PARCE QU'il est passé, non parce qu'il ne regarde rien : le
    // scénario précédent vient de montrer qu'il mord sur la même population.
    const lointain = "2999-01-01";
    expect(registresDatesDuFutur(lointain)).toEqual([]);
  });
});
