import {
  SOCIETES,
  anneeDeDepartFeries,
  anneesFeries,
  ecartsDeLAgence,
  feriesDuTerritoire,
  societeParCode,
  type AgenceSeed,
  type SocieteSeed,
} from "@/prisma/seed-data";
import { appliquerEcarts, type Calendrier } from "@/lib/calendar";

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
 * **L'ordre de lecture est celui de D46, complément 2**, et il est reproduit
 * ici tel que `chargerCalendrierAgence` l'applique : le fait public du
 * territoire d'abord, l'écart local de l'agence ensuite. Un assistant de test
 * qui les composerait dans l'autre sens rendrait le scénario vert sur du code
 * faux.
 *
 * Le chargement depuis la base, lui, est éprouvé par les tests d'isolation :
 * c'est là que le cloisonnement et les politiques ont leur mot à dire.
 */
export function calendrierDeDemonstration(
  societeCode: string,
  agenceCode: string,
): Calendrier {
  const societe = societeParCode(societeCode);
  const agence = agenceDeDemonstration(societe, agenceCode);

  const calendrier = societe.calendriers.find(
    (candidat) => candidat.code === agence.calendrier_code,
  );
  if (calendrier === undefined) {
    throw new Error(
      `Calendrier ${agence.calendrier_code} absent de la société ${societeCode}.`,
    );
  }

  const anneeDeDepart = anneeDeDepartFeries(societe);

  const faitsPublics = anneesFeries(anneeDeDepart).flatMap((annee) =>
    feriesDuTerritoire(agence.territoire, annee).map((ferie) => ({
      date: ferie.date,
      libelle: ferie.libelle,
    })),
  );

  const ecartsLocaux = ecartsDeLAgence(agence, anneeDeDepart).map((ecart) => ({
    date: ecart.date,
    travaille: ecart.travaille,
    motif: ecart.motif,
  }));

  return {
    code: calendrier.code,
    // Aucune agence du jeu ne surcharge son fuseau : il vient donc de la
    // société (D5). La règle d'héritage elle-même est celle de
    // `fuseauDeLAgence`, éprouvée par `fuseau.test.ts`.
    fuseau: societe.fuseau_horaire,
    // Le territoire vient de l'AGENCE, jamais du fuseau ni du calendrier
    // (D46, complément 1).
    territoire: agence.territoire,
    plages: calendrier.plages,
    jours_particuliers: appliquerEcarts(faitsPublics, ecartsLocaux),
  };
}

/** Une agence du jeu de démonstration, par le code de sa société et le sien. */
export function agenceDeDemonstration(
  societe: SocieteSeed,
  agenceCode: string,
): AgenceSeed {
  const agence = societe.agences.find(
    (candidat) => candidat.code === agenceCode,
  );
  if (agence === undefined) {
    throw new Error(
      `Agence ${agenceCode} absente de la société ${societe.code} du jeu de ` +
        "démonstration.",
    );
  }
  return agence;
}

/** Les codes des sociétés du jeu, pour les scénarios qui les parcourent. */
export const SOCIETES_DE_DEMONSTRATION = SOCIETES.map(
  (societe) => societe.code,
);

/**
 * La première année de l'horizon glissant d'une société — celle dont les
 * scénarios dérivent leurs dates plutôt que de les écrire (D46, complément 3).
 */
export function premiereAnneeDeLHorizon(societeCode: string): number {
  return anneeDeDepartFeries(societeParCode(societeCode));
}

/**
 * La date d'un férié NOMMÉ, pour le territoire d'une agence et une année.
 *
 * Un scénario qui écrirait `"2026-05-25"` cesserait de porter sur les données
 * du seed l'année suivante — le lundi de Pentecôte tombe le 17 mai en 2027. La
 * date se demande donc au référentiel, comme le fait le code.
 */
export function ferieDeDemonstration(
  societeCode: string,
  agenceCode: string,
  libelle: string,
  annee: number,
): string {
  const societe = societeParCode(societeCode);
  const agence = agenceDeDemonstration(societe, agenceCode);
  const ferie = feriesDuTerritoire(agence.territoire, annee).find(
    (candidat) => candidat.libelle === libelle,
  );

  if (ferie === undefined) {
    throw new Error(
      `Férié « ${libelle} » absent du territoire ${agence.territoire} en ` +
        `${annee} : le scénario ne peut pas s'y adosser.`,
    );
  }
  return ferie.date;
}
