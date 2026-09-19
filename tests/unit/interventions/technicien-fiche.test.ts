import type { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { technicienAfficheSurLaFiche } from "../../../app/(back-office)/interventions/presentation";

import { annuaireDesPersonnes } from "@/lib/auth/annuaire";
import { t } from "@/lib/i18n/fr";

/**
 * LA FICHE D'INTERVENTION AFFICHAIT L'IDENTIFIANT TECHNIQUE DU TECHNICIEN, PAS
 * SON NOM (D-04, contraire à I10).
 *
 * ## Le défaut, mesuré sur la fiche
 *
 * `ligne.technicien_id ?? t("intervention.aucun_technicien")` rendait l'UUID
 * v7 tel quel dès qu'un technicien était affecté — *exactement ce qu'I10
 * interdit : « clé technique et numéro affiché sont distincts ».*
 * `lib/interventions/personnes.ts` résout déjà cette question pour le
 * planning, sous l'annuaire cloisonné qui distingue un nom rendu d'un nom
 * refusé et d'un nom jamais demandé — `technicienAfficheSurLaFiche` la
 * reprend pour la fiche plutôt que d'écrire une seconde lecture du même
 * critère (§9, 01/09).
 *
 * ## Ce que ce fichier tient, sans base
 *
 * `annuaireSur` fait ce que `personnes-du-planning.test.ts` fait déjà pour le
 * planning : un `tx` FAUX qui rend ce que la politique aurait rendu, passé à
 * la VRAIE `annuaireDesPersonnes` — jamais un `Annuaire` reconstruit à la
 * main, qui n'éprouverait rien de la fonction réelle.
 */

const NOMS = new Map<string, string>([["technicien-1", "Jean Wamytan"]]);

async function annuaireSur(
  identifiants: readonly string[],
  refusees: readonly string[] = [],
) {
  const tx = {
    utilisateur: {
      findMany: async ({ where }: { where: { id: { in: string[] } } }) => {
        return where.id.in
          .filter((id) => !refusees.includes(id))
          .flatMap((id) => {
            const nom = NOMS.get(id);
            return nom === undefined ? [] : [{ id, nom }];
          });
      },
    },
  } as unknown as Prisma.TransactionClient;
  return annuaireDesPersonnes(tx, identifiants);
}

describe("LE TECHNICIEN AFFICHÉ SUR LA FICHE — un nom, jamais l'identifiant", () => {
  it("rend le nom quand l'annuaire l'a lu", async () => {
    const annuaire = await annuaireSur(["technicien-1"]);
    expect(technicienAfficheSurLaFiche("technicien-1", annuaire)).toBe(
      "Jean Wamytan",
    );
  });

  it("ne rend JAMAIS l'identifiant brut — le défaut par son bout exact", async () => {
    const annuaire = await annuaireSur(["technicien-1"]);
    const valeur = technicienAfficheSurLaFiche("technicien-1", annuaire);
    expect(valeur).not.toBe("technicien-1");
  });

  it("dit le refus de la politique, plutôt que de rendre un identifiant", async () => {
    // La politique a refusé cette identité (une autre société) : ce n'est
    // pas une absence à confondre avec l'identifiant qu'on affichait avant.
    const annuaire = await annuaireSur(
      ["technicien-hors-perimetre"],
      ["technicien-hors-perimetre"],
    );
    expect(
      technicienAfficheSurLaFiche("technicien-hors-perimetre", annuaire),
    ).toBe(t("planning.nom_non_communique"));
  });

  it("aucune affectation — son PROPRE libellé, distinct de celui du planning", async () => {
    // `quiTravaille(null, …)` rend « Interventions non affectées », écrit pour
    // une COLONNE de planning. Une fiche d'une seule intervention a le sien.
    const annuaire = await annuaireSur([]);
    expect(technicienAfficheSurLaFiche(null, annuaire)).toBe(
      t("intervention.aucun_technicien"),
    );
  });
});
