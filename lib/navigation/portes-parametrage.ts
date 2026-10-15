import type { NomIcone } from "@/components/ui/icone";
import { peut, type Capacite } from "@/lib/auth/habilitations";
import type { Role } from "@/lib/auth/roles";
import type { CleTraduction } from "@/lib/i18n/fr";
import { mot, motDansUnePhrase } from "@/lib/i18n/vocabulaire";

/**
 * LES PORTES DU HUB « Paramètres » (R3-05 ; sections : QT-21, D167,
 * 05/10/2026, TP-NAV1).
 *
 * **Elles vivent ici, et pas dans l'écran qui les rend**, pour deux raisons qui
 * ne se recouvrent pas. La première est celle de `lib/navigation/` tout entier :
 * une liste de destinations est une donnée, et un écran ne la tient pas. La
 * seconde est mesurée — le gardien des chaînes en dur (L0-11) lit un fichier
 * qui porte du JSX et prend ses littéraux pour du texte visible ; un tableau de
 * routes et de clés y serait rangé sous « chaîne visible écrite hors du
 * dictionnaire », ce qu'il n'est pas. *Le gardien a raison de ne pas savoir :
 * c'est la DESTINATION d'un texte qui décide, et il ne peut pas la lire.*
 *
 * **LA DOCTRINE « AUCUN DÉCOMPTE » EST LEVÉE POUR CE HUB** (9EWD-PARAMETRES-
 * HUB-MAQUETTE, décision n° 97 d'Alexis, 13/10/2026) — Alexis a comparé le
 * hub à la maquette et demandé les pastilles-décompte qu'elle dessine sous
 * chaque porte. *Ce que R3-05/D88 refusait restait juste hier : une mesure
 * qui se tairait à l'échec serait pire qu'une porte muette* — mais c'est
 * désormais une décision assumée, et non un oubli : `lib/navigation/
 * decomptes-parametrage.ts` lit chaque décompte séparément de la porte, et
 * une lecture qui échoue n'affiche RIEN plutôt que de faire échouer la page
 * (même motif que D88, appliqué à la lettre plutôt qu'au silence).
 *
 * Chaque porte porte désormais une `icone` (`components/ui/icone.tsx`), à la
 * lettre de la maquette — une porte n'est plus un simple lien, c'est la carte
 * que `hubc-i`/`porte()` dessinent (M:4364-4367).
 *
 * **Deux portes ont quitté cette liste (QT-21)** : `/parametres/societe`
 * (Charte, retirée jusqu'au lot 7, QT-22 — son identité en LECTURE rejoint la
 * carte « Identité » du hub, voir `lib/societes/identite.ts`) et `/clients`,
 * `/sites` (ils restent au menu principal ; le hub ne les double plus).
 *
 * **Une porte est entrée** : `/imports`, section « Données » — l'écran existait
 * et sa seule porte était l'entrée de la barre, jamais celle du hub de
 * paramétrage dont il relève pourtant.
 */
export type PorteParametrage = {
  readonly chemin: string;
  readonly titre: CleTraduction;
  /**
   * SUBSTITUE `titre` quand le titre de la maquette EST le mot imposé
   * lui-même (« Agences », M:4387) — l'écrire en dur dans `lib/i18n/fr.ts`
   * ferait rougir le gardien du vocabulaire (D5/D47) : le mot ne s'écrit que
   * sous une clé `vocabulaire.*`. Composé ici au point d'usage, comme déjà
   * `app/(back-office)/parametres/agences/[agenceId]/page.tsx`. `titre`
   * garde alors un repli jamais affiché, pour rester un `CleTraduction`
   * valide.
   */
  readonly titreCompose?: () => string;
  readonly resume: CleTraduction;
  /**
   * SUBSTITUE `resume` quand la description de la maquette contient le mot
   * imposé lui-même (« Le trajet aller depuis l'agence, zone par zone »,
   * M:4384) — même raison que `titreCompose` ci-dessus, et même mécanique :
   * composé au point d'usage avec `motDansUnePhrase`, jamais en dur dans
   * `lib/i18n/fr.ts`. `resume` garde alors un repli jamais affiché, pour
   * rester un `CleTraduction` valide.
   */
  readonly resumeCompose?: () => string;
  /** L'icône de la carte, à la lettre de la maquette (9EWD-PARAMETRES-HUB-MAQUETTE). */
  readonly icone: NomIcone;
  /** La section du hub où cette porte se range — liste close (QT-21). */
  readonly section:
    "tarifs" | "planification" | "organisation" | "referentiels" | "donnees";
  /**
   * LA OU LES CAPACITÉS QUI OUVRENT L'ÉCRAN (D153, TP-S3) — jamais un rôle
   * nommé en dur, la même matrice que la route. `undefined` laisse la porte
   * visible à quiconque n'est pas technicien (le cas de `/parametres/
   * materiel` et `/parametres/prestations`, dont la LECTURE est ouverte à
   * tout rôle non technicien). Un tableau se lit en OU — le taux horaire et
   * les forfaits s'ouvrent à qui les paramètre OU à qui en a besoin pour
   * chiffrer (QT-2, D152). La porte teste toujours `peut()`, pas
   * `peutPleinement` : elle n'offre ici qu'un lien, jamais l'écriture
   * elle-même — c'est l'écran visé qui distingue ensuite les deux pour ses
   * propres formulaires.
   */
  readonly capacite?: Capacite | readonly Capacite[];
};

/**
 * LES CINQ SECTIONS, DANS L'ORDRE OÙ LE HUB LES RANGE (QT-21) — liste close,
 * confrontée par un gardien à l'ensemble des valeurs que `PorteParametrage.
 * section` peut prendre : les deux listes ne peuvent pas diverger en
 * silence.
 */
export const SECTIONS_PARAMETRAGE: ReadonlyArray<{
  readonly id: PorteParametrage["section"];
  readonly titre: CleTraduction;
  /** Le sous-titre de section, à la lettre de la maquette (M:4381-4395). */
  readonly sousTitre: CleTraduction;
}> = [
  {
    id: "tarifs",
    titre: "parametres.index_section_tarifs",
    sousTitre: "parametres.index_section_tarifs_sous_titre",
  },
  {
    id: "planification",
    titre: "parametres.index_section_planification",
    sousTitre: "parametres.index_section_planification_sous_titre",
  },
  {
    id: "organisation",
    titre: "parametres.index_section_organisation",
    sousTitre: "parametres.index_section_organisation_sous_titre",
  },
  {
    id: "referentiels",
    titre: "parametres.index_section_referentiels",
    sousTitre: "parametres.index_section_referentiels_sous_titre",
  },
  {
    id: "donnees",
    titre: "parametres.index_section_donnees",
    sousTitre: "parametres.index_section_donnees_sous_titre",
  },
];

/**
 * L'ORDRE DES PORTES EST CELUI DE LA MAQUETTE, SECTION PAR SECTION
 * (9EWD-PARAMETRES-HUB-MAQUETTE, M:4381-4395) : Tarifs (une seule porte,
 * taux horaire et forfaits réunis depuis 9EWE-PARAMETRES-TARIFS-PAGE-UNIQUE),
 * Planification (trajets, prestations — amende D167, qui les rangeait en
 * Référentiels), Organisation (agences, équipe, habilitations), Référentiels
 * (matériel), Données (imports, données à compléter).
 */
export const PORTES_PARAMETRAGE: readonly PorteParametrage[] = [
  {
    // LA PORTE « Tarifs » (TAUX-1, 22/09/2026 ; fusionnée en une seule porte
    // par 9EWE-PARAMETRES-TARIFS-PAGE-UNIQUE, décisions n° 97 et n° 98
    // d'Alexis du 13/10/2026 — `/parametres/taux-horaire` et
    // `/parametres/forfaits` n'étaient deux portes que par accident
    // d'écriture : la maquette (M:4381-4382) n'en dessine qu'une, « Tarifs »,
    // vers un seul écran qui réunit le taux horaire et les forfaits).
    chemin: "/parametres/tarifs",
    titre: "parametres.index_tarifs_titre",
    resume: "parametres.index_tarifs_resume",
    icone: "coins",
    section: "tarifs",
    // D153 — même lecture que l'écran (QT-2, D152) : qui paramètre la
    // société, ou qui a besoin d'un tarif pour chiffrer.
    capacite: ["parametrer_societe", "voir_montants_vente"],
  },
  {
    chemin: "/parametres/trajets",
    titre: "parametres.index_trajets_titre",
    // AUCUNE clé dédiée : `resume` ne sert jamais, voir le commentaire de
    // `parametres.index_trajets_titre` (`lib/i18n/fr.ts`).
    resume: "parametres.index_trajets_titre",
    // REPRIS MOT POUR MOT DE LA MAQUETTE (M:4384) : « Le trajet aller depuis
    // l'agence, zone par zone » — le mot imposé ne s'écrit que sous
    // `vocabulaire.*` (D5/D47), voir `resumeCompose` ci-dessus.
    resumeCompose: () =>
      `Le trajet aller depuis l'${motDansUnePhrase("agence")}, zone par zone`,
    icone: "route",
    section: "planification",
    // D153 (03/10/2026, TP-S3, PA-25) — ADMS et ADV au ●, DIR au ○.
    capacite: "regler_trajets",
  },
  {
    // LA SIXIÈME PORTE (R3-15, 14/09/2026). Le catalogue des prestations
    // existait en base depuis L1-12 et n'avait AUCUN chemin : ni dépôt, ni
    // route, ni écran. *Une table qu'aucun humain n'atteint est une table dont
    // on ne peut pas dire si elle est juste.*
    //
    // RANGÉE SOUS « PLANIFICATION », pas « Référentiels » (9EWD-PARAMETRES-
    // HUB-MAQUETTE, amende D167) — M:4385 : une prestation porte une durée
    // standard, jamais un taux (D109), et c'est la charge qu'elle informe.
    chemin: "/parametres/prestations",
    titre: "parametres.index_prestations_titre",
    resume: "parametres.index_prestations_resume",
    icone: "briefcase",
    section: "planification",
    // D153 — ouvert comme l'écran : « pas technicien » seul, aucune capacité
    // ne restreint davantage LA LECTURE (seule l'écriture suit `peutPleinement`
    // sur `parametrer_societe`, à l'intérieur de l'écran lui-même).
  },
  {
    chemin: "/parametres/agences",
    // AUCUNE clé dédiée : `titre` ne sert jamais, voir le commentaire de
    // `parametres.index_horaires_resume` (`lib/i18n/fr.ts`).
    titre: "parametres.index_horaires_resume",
    titreCompose: () => mot("agence", true),
    resume: "parametres.index_horaires_resume",
    icone: "building",
    section: "organisation",
    // D153 (03/10/2026, TP-S3) — aucune `capacite` : la LECTURE reste ouverte
    // à tout rôle non technicien, comme avant (QT-2, D152, choix 6). Seule
    // l'ÉCRITURE (agences, plages, pas-créneau) suit `administrer_agences`,
    // jugée par l'écran lui-même, jamais par cette porte.
  },
  {
    // LA HUITIÈME PORTE DE CETTE LISTE (ÉQUIPE-1, 19/09/2026). La table
    // `technicien` existait depuis L3-01a et n'avait AUCUN chemin d'écriture
    // — mesuré sur 4fead41, les seules lignes qu'elle portait venaient du
    // seed. *Un technicien qui ne peut ni être ajouté ni partir n'est pas un
    // technicien administrable, c'est une donnée figée.*
    chemin: "/parametres/equipe",
    titre: "parametres.index_equipe_titre",
    resume: "parametres.index_equipe_resume",
    icone: "users",
    section: "organisation",
    // D153 (03/10/2026, TP-S3) — aucun ○ : seul admin_societe ouvre l'écran.
    capacite: "administrer_utilisateurs",
  },
  {
    // LA NEUVIÈME PORTE DE CETTE LISTE (ÉQUIPE-2, 20/09/2026). Même faute que
    // les prestations et le matériel : `lib/habilitations/affectation.ts`
    // applique RG-PLA-04 depuis L1-04, et `lib/interventions/depot.ts`
    // l'appelle réellement — mais rien ne pouvait écrire ni le référentiel, ni
    // une attribution, ni une exigence. *Le verrou mordait sur des données
    // qu'on ne pouvait alimenter qu'à la main, en base.*
    chemin: "/parametres/habilitations",
    titre: "parametres.index_habilitations_titre",
    resume: "parametres.index_habilitations_resume",
    icone: "badge",
    section: "organisation",
    // D153 (03/10/2026, TP-S3) — même garde que `/parametres/equipe`.
    capacite: "administrer_utilisateurs",
  },
  {
    // LA SEPTIÈME PORTE (L1-05b, 15/09/2026). Les deux tables du référentiel
    // matériel existaient depuis L1-05 et n'avaient AUCUN chemin d'écriture :
    // `ls lib/materiel/` rendait `saisie.ts`, et rien d'autre.
    //
    // **Et c'est un ENCHAÎNEMENT, pas un manque isolé** : une machine exige un
    // modèle (D6), un modèle exige une famille, et aucun des deux ne pouvait
    // naître. *Le parc ne se remplissait que par le semis.* L'import ne le
    // sauvait pas non plus — une seule fonction d'application existe dans tout
    // le dépôt, et c'est celle des clients (R6-01, R6-03).
    chemin: "/parametres/materiel",
    titre: "parametres.index_materiel_titre",
    resume: "parametres.index_materiel_resume",
    icone: "layers",
    section: "referentiels",
    // D153 — même lecture ouverte que `/parametres/prestations`, voir
    // ci-dessus : aucune `capacite`, l'écran lui-même gère son écriture.
  },
  {
    // LA PORTE « DONNÉES » (QT-21, D167, 05/10/2026, TP-NAV1). L'écran
    // existait et fonctionnait (`app/(back-office)/imports/page.tsx`), atteint
    // jusqu'ici par la seule entrée de la barre — jamais par le hub de
    // paramétrage dont il relève tout autant que le référentiel matériel ou
    // les prestations.
    chemin: "/imports",
    titre: "nav.imports_excel",
    resume: "parametres.index_imports_resume",
    icone: "upload",
    section: "donnees",
    // Même capacité que l'entrée de la barre (`CAPACITE_REQUISE["nav.
    // imports_excel"]`, `lib/navigation/entrees.ts`) : les deux portes du
    // même écran ne doivent pas juger différemment qui peut l'ouvrir.
    capacite: "importer_exporter",
  },
  {
    // LA PORTE « DONNÉES À COMPLÉTER » (9DT-TP-MOD2-INDICATEURS-DONNEES,
    // QE-19, MO-7, D170) — ouverte à l'ADV, la même capacité que l'écran
    // lui-même (`app/(back-office)/parametres/donnees/page.tsx`).
    chemin: "/parametres/donnees",
    titre: "parametres.index_donnees_titre",
    resume: "parametres.index_donnees_resume",
    icone: "database",
    section: "donnees",
    capacite: "gerer_client_site",
  },
];

/**
 * LA PORTE S'OUVRE-T-ELLE POUR CE RÔLE ? (D153, TP-S3)
 *
 * `undefined` laisse passer (le cas de `/parametres/materiel` et
 * `/parametres/prestations`, dont la LECTURE est ouverte à tout rôle non
 * technicien ; l'ÉCRITURE, elle, est jugée par l'écran lui-même).
 * Un tableau de capacités se lit en OU — `peut`, jamais `peutPleinement` :
 * cette page ne pose qu'un LIEN, jamais un formulaire.
 */
export function porteOuverte(role: Role, porte: PorteParametrage): boolean {
  if (porte.capacite === undefined) {
    return true;
  }
  const capacites = Array.isArray(porte.capacite)
    ? porte.capacite
    : [porte.capacite];
  return capacites.some((capacite) => peut(role, capacite));
}
