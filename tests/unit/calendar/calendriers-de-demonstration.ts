import {
  ANNEES_FERIES,
  SOCIETES,
  feriesDuTerritoire,
  societeParCode,
  type CalendrierSeed,
} from "@/prisma/seed-data";
import type { Calendrier } from "@/lib/calendar";

/**
 * Reconstitue, sans base de données, le calendrier qu'une agence du jeu de
 * démonstration obtiendra une fois le seed appliqué.
 *
 * **Pourquoi partir du seed plutôt que de fabriquer des horaires.** Les
 * critères d'acceptation du ticket L0-08 portent sur des agences NOMMÉES —
 * « le samedi est ouvré pour Ducos et non pour Koné ». Un scénario qui
 * fabriquerait ses propres plages prouverait que le calcul est juste, pas que
 * le jeu de démonstration l'est ; il resterait vert le jour où quelqu'un
 * ouvrirait Koné le samedi par distraction. Ici, une divergence du seed fait
 * tomber le scénario — ce qui est l'objet.
 *
 * Le chargement depuis la base, lui, est éprouvé par les tests d'isolation :
 * c'est là que le cloisonnement et les politiques ont leur mot à dire.
 */
export function calendrierDeDemonstration(
  societeCode: string,
  agenceCode: string,
): Calendrier {
  const societe = societeParCode(societeCode);

  const agence = societe.agences.find(
    (candidate) => candidate.code === agenceCode,
  );
  if (agence === undefined) {
    throw new Error(
      `Agence ${agenceCode} absente de la société ${societeCode} du jeu de ` +
        "démonstration.",
    );
  }

  const calendrier = societe.calendriers.find(
    (candidate) => candidate.code === agence.calendrier_code,
  );
  if (calendrier === undefined) {
    throw new Error(
      `Calendrier ${agence.calendrier_code} absent de la société ${societeCode}.`,
    );
  }

  return {
    code: calendrier.code,
    // Aucune agence du jeu ne surcharge son fuseau : il vient donc de la
    // société (D5). La règle d'héritage elle-même est celle de
    // `fuseauDeLAgence`, éprouvée par `fuseau.test.ts`.
    fuseau: societe.fuseau_horaire,
    territoire: calendrier.territoire,
    plages: calendrier.plages,
    feries: feriesAppliques(calendrier),
  };
}

/** Les fériés du territoire du calendrier, avec la surcharge « travaillé ». */
function feriesAppliques(calendrier: CalendrierSeed) {
  return ANNEES_FERIES.flatMap((annee) =>
    feriesDuTerritoire(calendrier.territoire, annee).map((ferie) => ({
      date: ferie.date,
      libelle: ferie.libelle,
      travaille: calendrier.feries_travailles.includes(ferie.libelle),
    })),
  );
}

/** Les codes des sociétés du jeu, pour les scénarios qui les parcourent. */
export const SOCIETES_DE_DEMONSTRATION = SOCIETES.map(
  (societe) => societe.code,
);
