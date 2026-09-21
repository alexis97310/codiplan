import { describe, expect, it } from "vitest";

import { maintenant } from "@/lib/calendar/fuseau";
import { lundiDeLaSemaine } from "@/lib/calendar/semaine";
import {
  INTERVENTIONS_DEMONSTRATION,
  LUNDI_DEMONSTRATION,
  SOCIETES,
  TECHNICIENS_PAR_AGENCE,
} from "@/prisma/seed-data";

/**
 * LA SEMAINE COURANTE N'EST PLUS VIDE, APRÈS LE SEMIS (lot SEMIS-2, #266,
 * 21/09/2026).
 *
 * ## LE DÉFAUT MESURÉ
 *
 * Sept semaines de production interrogées le 21/09/2026 : le jeu d'essai
 * entier tient dans la semaine du 14 au 19/09 (SEMIS-1), et les six autres
 * semaines — dont celle où l'exploitation regardait l'écran — sont vides.
 * `LUNDI_DEMONSTRATION` était un jour ÉCRIT EN DUR ; il l'est de nouveau
 * relatif, calculé à chaque semis (voir sa définition, `prisma/seed-data.ts`).
 *
 * ## CE QUE CE GARDIEN TIENT, EN DEUX TEMPS
 *
 * 1. **La fraîcheur elle-même** : `LUNDI_DEMONSTRATION` doit retomber sur le
 *    lundi de la semaine réelle — calculé ICI, une seconde fois,
 *    indépendamment de `prisma/seed-data.ts`, avec les mêmes primitives
 *    nommées (`maintenant`, `lundiDeLaSemaine`) plutôt qu'en relisant l'export.
 *    *Sans cette assertion, un retour à un lundi écrit en dur — la régression
 *    exacte que SEMIS-1 avait introduite — laisserait ce fichier vert* : le
 *    second test ci-dessous ne dépend que des ÉCARTS `joursDepuisLundi`
 *    déclarés dans `INTERVENTIONS_DEMONSTRATION`, qui ne bougent pas selon que
 *    `LUNDI_DEMONSTRATION` soit frais ou périmé.
 * 2. **Ce que ça donne à voir** : une fois `LUNDI_DEMONSTRATION` fixé sur le
 *    lundi réel, la semaine qu'il ouvre porte au moins une intervention pour
 *    au moins deux techniciens — jamais la grille presque vide qu'un seul
 *    technicien affecté donnerait à l'arbitre du projet.
 *
 * ## LA LIMITE ASSUMÉE
 *
 * Ce second temps REJOUE l'arithmétique de `prisma/seed.ts` — le site par
 * rang modulo (« const sitesEcrits », § 5) puis le technicien par rang modulo
 * au sein de l'équipe de l'agence (§ 9, « affectation des interventions aux
 * techniciens ») — plutôt que de lancer le semis : c'est le même compromis que
 * `tests/unit/seed/parc-de-demonstration.test.ts` fait déjà pour le parc,
 * dérive de la donnée PURE, jamais de la base. Une divergence entre les deux
 * arithmétiques ne rougirait donc pas ici ; c'est `pnpm test:e2e` qui éprouve
 * la VRAIE écriture, RLS comprise, et lui seul.
 *
 * *Deux lectures indépendantes de « maintenant » peuvent, en toute rigueur,
 * tomber de part et d'autre d'un changement de jour civil à Nouméa — le même
 * risque, assumé de la même façon, que `tests/e2e/glisser-deposer.spec.ts`
 * documente pour `reperesDeLaScene`.*
 */
describe("la semaine courante du planning de démonstration (CODIMA-NC)", () => {
  it("LUNDI_DEMONSTRATION suit le lundi réel, jamais un jour écrit en dur", () => {
    const lundiAttendu = lundiDeLaSemaine(maintenant("Pacific/Noumea").local);
    expect(LUNDI_DEMONSTRATION).toEqual(lundiAttendu);
  });

  it("contient au moins une intervention pour au moins deux techniciens", () => {
    const codimaNC = SOCIETES.find((societe) => societe.code === "CODIMA-NC");
    expect(
      codimaNC,
      "CODIMA-NC a disparu du jeu de démonstration",
    ).toBeDefined();
    if (codimaNC === undefined) return;

    // Le même aplatissement que `prisma/seed.ts` (« const sites =
    // clients.flatMap(… ») : un site par position, dans l'ordre des clients
    // puis de leurs sites.
    const sitesEcrits = codimaNC.clients.flatMap((client) =>
      client.sites.map((site) => site.agence_code),
    );
    expect(sitesEcrits.length).toBeGreaterThan(0);

    // Une ligne close ne se voit jamais affecter de technicien (D84) : le
    // semis s'en abstient à la seconde passe, voir `prisma/seed.ts`.
    const STATUTS_TERMINAUX = new Set(["cloturee", "annulee", "terminee"]);

    const techniciensDeLaSemaineCourante = new Set<string>();
    INTERVENTIONS_DEMONSTRATION.forEach((modele, index) => {
      if (modele.joursDepuisLundi === null) return;
      if (modele.joursDepuisLundi < 0 || modele.joursDepuisLundi > 6) return;
      if (STATUTS_TERMINAUX.has(modele.statut)) return;

      const agenceCode = sitesEcrits[index % sitesEcrits.length];
      const equipe = TECHNICIENS_PAR_AGENCE[agenceCode] ?? [];
      if (equipe.length === 0) return;

      const courriel = equipe[index % equipe.length];
      if (courriel !== undefined) {
        techniciensDeLaSemaineCourante.add(courriel);
      }
    });

    expect(
      techniciensDeLaSemaineCourante.size,
      "la semaine que LUNDI_DEMONSTRATION ouvre ne couvre qu'un seul " +
        "technicien après le semis, ou aucun : au moins trois des quatre " +
        "techniciens de CODIMA-NC afficheraient « Sans intervention » un " +
        "lundi matin.",
    ).toBeGreaterThanOrEqual(2);
  });
});
