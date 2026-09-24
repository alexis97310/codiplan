import { z } from "zod";

/**
 * LA SAISIE D'UN ORDRE D'INTERVENTION (lot 2, D84).
 *
 * Zod sur toute entrée serveur, sans exception (CLAUDE.md §2). Ce module ne
 * touche pas la base : il dit ce qu'une entrée doit être pour mériter d'y
 * arriver.
 *
 * ## Ce que l'utilisateur ne saisit JAMAIS
 *
 * **L'agence** — elle est déduite du site, qui porte son rattachement (D56).
 * La faire saisir serait deux lectures d'un même critère, et deux lectures
 * divergent en silence (§9, 01/09).
 *
 * **Le forfait de déplacement** — il est déduit de la ZONE du site par la
 * règle déjà écrite et déjà éprouvée (`lib/tarification/forfaits.ts`,
 * RG-TAR-06, D23). *La consigne d'exploitation disait « l'agence impose le
 * forfait » ; le code dit que les conditions d'un forfait portent sur la zone,
 * la famille et le type — jamais sur l'agence. La voie qui reste ouverte est
 * celle de la règle écrite, et l'écart est inscrit au registre du jour.*
 *
 * **Le numéro** — il est attribué par le serveur, séquentiellement par société,
 * à la première synchronisation (I10). Personne ne l'attribue aujourd'hui, et
 * l'inventer ici poserait une règle que personne n'a décidée.
 *
 * **Le statut** — une intervention naît TOUJOURS `a_planifier` depuis
 * PARCOURS-1 (23/09/2026, arbitrage Alexis). Le laisser saisir permettrait de
 * créer une intervention déjà clôturée.
 *
 * ## Les machines sont un TABLEAU depuis L2-08a, PLAFONNÉ À UNE DEPUIS PARCOURS-1
 *
 * `machine_id` a disparu, de la saisie comme du schéma, au profit d'un
 * tableau qui pouvait en couvrir plusieurs (chapitre 7/M3). **L'arbitrage du
 * 23/09/2026 referme ce choix : « une intervention ne peut pas avoir 2
 * machines. »** Le tableau reste — il porte toujours zéro ou une machine,
 * jamais un scalaire nullable qui aurait fallu réécrire ailleurs —, mais
 * `.max(1)` en refuse désormais un second. `intervention_machine` porte la
 * même règle en base (`@@unique([intervention_id])`) : la saisie refuse tôt,
 * la base refuse toujours.
 *
 * ## CE QUI A QUITTÉ LA CRÉATION POUR LA PLANIFICATION (PARCOURS-1, 23/09/2026)
 *
 * *« Lors de la création d'intervention, on ne peut pas décider ni de la date
 * d'intervention, ni du technicien affecté : il doit y avoir un ordre précis —
 * Créer demande d'intervention → Planifier et qualifier l'intervention. »*
 * (Alexis, 23/09/2026)
 *
 * `date_planifiee`, `creneau_debut`, `creneau_fin`, `duree_estimee_min` et
 * `technicien_id` ne sont donc plus des champs de CE schéma : ils ne se
 * saisissent qu'au geste de PLANIFICATION, tenu par `schemaDeplacement`
 * ci-dessous, et les quatre s'y donnent ENSEMBLE ou pas du tout
 * (`peutPlanifier`, `lib/interventions/cycle-de-vie.ts`). Une création ne
 * porte donc plus jamais de créneau, et `creerIntervention` ne calcule plus
 * aucun statut : il est TOUJOURS `a_planifier`.
 */

/** Les neuf natures du chapitre 11.2. */
export const TYPES_INTERVENTION = [
  "preventif_contrat",
  "preventif_hors_contrat",
  "curatif",
  "installation",
  "garantie",
  "controle_reglementaire",
  "expertise",
  "reprise",
  "recensement",
] as const;
export type TypeIntervention = (typeof TYPES_INTERVENTION)[number];

/** Les quatre niveaux d'urgence. */
export const PRIORITES = ["p1", "p2", "p3", "p4"] as const;
export type Priorite = (typeof PRIORITES)[number];

/** Le cycle de vie, dans l'ordre de l'annexe D. */
export const STATUTS_INTERVENTION = [
  "a_planifier",
  "planifiee",
  "affectee",
  "en_cours",
  "suspendue",
  "terminee",
  "cloturee",
  "annulee",
] as const;
export type StatutIntervention = (typeof STATUTS_INTERVENTION)[number];

/**
 * L'ÉTAT LU AVANT UNE ÉCRITURE QUI PEUT PLANIFIER OU DÉPLACER
 * (AVERTISSEMENTS-1, 24/09/2026).
 *
 * `deplacerIntervention` et `affecterTechnicien` le portent dans leur
 * `Resultat` accepté : c'est en le comparant à l'état ACTUEL, relu après coup,
 * que `avertirApresPlanification` (`lib/avertissements/planification.ts`)
 * décide qui prévenir. Défini ici, et non dans `depot.ts` ni dans le module
 * d'avertissement, pour que ni l'un ni l'autre n'ait à importer le second —
 * les deux lisent déjà ce fichier.
 */
export type EtatAvantPlanification = {
  readonly statut: StatutIntervention;
  readonly technicienId: string | null;
  readonly datePlanifiee: Date | null;
  readonly creneauDebut: Date | null;
};

/** Les trois modes de RG-TAR-05. */
export const MODES_VALORISATION = [
  "forfait",
  "temps_passe",
  "forfait_plus_heures",
] as const;
export type ModeValorisation = (typeof MODES_VALORISATION)[number];

const uuid = z.string().uuid();

/**
 * LA CRÉATION. Le créneau est facultatif : une intervention peut naître dans la
 * file d'attente, sans date — c'est le statut `a_planifier` de l'annexe D, et
 * c'est le cas d'une demande qu'on enregistre avant de savoir quand la traiter.
 */
export const schemaCreation = z
  .object({
    id: uuid,
    client_id: uuid,
    site_id: uuid,
    /**
     * LA MACHINE, AU PLUS UNE (PARCOURS-1, 23/09/2026, arbitrage Alexis).
     *
     * **Le tableau VIDE reste le cas ordinaire à la création**, et non un
     * oubli : le dépannage à l'aveugle sait qu'un compresseur est en panne,
     * pas lequel. RG-INT-01 n'exige la machine qu'**avant de démarrer**, et
     * c'est la base qui le tient — pas cette saisie, qui refuserait alors
     * d'enregistrer un appel.
     *
     * Les doublons sont retirés ICI plutôt que laissés buter sur l'index
     * unique : *une même machine nommée deux fois dans un formulaire est une
     * maladresse de saisie, pas une faute à refuser.* `.max(1)`, lui, refuse
     * une VRAIE seconde machine — c'est la règle nouvelle, pas une maladresse.
     */
    machine_ids: z
      .array(uuid)
      .default([])
      .transform((ids) => [...new Set(ids)])
      .pipe(z.array(uuid).max(1)),
    type: z.enum(TYPES_INTERVENTION),
    priorite: z.enum(PRIORITES).default("p3"),
    mode_valorisation: z.enum(MODES_VALORISATION).default("temps_passe"),
    /**
     * LA PANNE SIGNALÉE OU LE TRAVAIL DEMANDÉ (PARCOURS-1) — OBLIGATOIRE :
     * *« panne signalée / travail demandé (texte obligatoire) »* (Alexis,
     * 23/09/2026). Même rôle que `demande.description` (L2-06), sur la table
     * voisine : une intervention créée directement, hors du module demandes,
     * porte la même exigence que celle qui en descend.
     */
    description: z.string().trim().min(1).max(4000),
    /** LE CONTACT SUR PLACE (PARCOURS-1) — facultatif, comme `demande.contact_id`. */
    contact_id: uuid.nullable().default(null),
    /** LA RÉFÉRENCE CLIENT / LE N° DE BON DE COMMANDE (PARCOURS-1) — facultatif. */
    reference_client: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .nullable()
      .default(null),
  })
  .strict();

export type Creation = z.infer<typeof schemaCreation>;

/**
 * LE DÉPLACEMENT — changer de jour, d'heure, de technicien, ou tout cela.
 *
 * ## L'HEURE SE DONNE EN MINUTES LOCALES, JAMAIS EN INSTANT (R2-19)
 *
 * Un créneau est stocké en INSTANT — 07:30 à Nouméa et 07:30 à Lyon ne sont pas
 * le même moment, et c'est tout l'objet de la colonne. Mais **l'instant se
 * calcule, il ne se saisit pas** : il demande le fuseau de l'agence de
 * l'intervention, que ni un formulaire ni un navigateur ne connaissent.
 *
 * *Laisser l'appelant fournir l'instant donnerait DEUX représentations d'une
 * même chose* — l'une pour le glissé, l'autre pour le formulaire — et deux
 * lectures d'un même critère divergent en silence (§9, 01/09). Le dépôt
 * résout donc l'instant, une fois, sous le fuseau qui décide.
 *
 * La DURÉE est fournie plutôt que la fin : c'est ce que la règle de la vue jour
 * demande — *le dépôt change l'heure de début, la durée est conservée* — et
 * fournir une fin permettrait de redimensionner par un chemin qui n'est pas
 * fait pour cela.
 */
export const schemaDeplacement = z
  .object({
    intervention_id: uuid,
    date_planifiee: z.date().nullable(),
    /** Minutes locales depuis minuit, dans le fuseau de l'agence. */
    debut_minutes: z
      .number()
      .int()
      .min(0)
      .max(24 * 60 - 1)
      .nullable(),
    /** Durée en minutes, strictement positive quand une heure est donnée. */
    duree_min: z.number().int().positive().nullable(),
    technicien_id: uuid.nullable(),
  })
  .refine((v) => (v.debut_minutes === null) === (v.duree_min === null), {
    message: "Un créneau se donne en entier : une heure et une durée, ou rien.",
    path: ["duree_min"],
  })
  // UN CRÉNEAU SANS JOUR EST UN ÉTAT QUE LE PLANNING NE SAIT PAS RANGER. La
  // grille range par `date_planifiee` ; un créneau posé sans elle laisserait
  // l'intervention invisible sur les deux vues tout en occupant le temps d'un
  // technicien.
  .refine((v) => v.debut_minutes === null || v.date_planifiee !== null, {
    message: "Un créneau se pose sur un jour : la date planifiée est requise.",
    path: ["date_planifiee"],
  });

export type Deplacement = z.infer<typeof schemaDeplacement>;

/**
 * LA CLÔTURE — c'est-à-dire LA VALIDATION DU TEMPS (D120).
 *
 * **Ce champ n'est plus la saisie d'un temps, c'est la validation du temps
 * MESURÉ.** L'écran le pré-remplit avec ce que le compteur a compté ; le
 * responsable ou l'ADV le confirme ou le corrige. *La saisie manuelle d'un
 * temps qu'aucun compteur n'a mesuré se fait dans Winpro au moment de
 * facturer, hors de CODIPLAN.*
 *
 * Il reste OBLIGATOIRE et STRICTEMENT POSITIF, et ce n'est pas une
 * coquetterie : sous D83, zéro minute facturerait quand même le plancher d'une
 * heure. Une intervention qui n'a pas eu lieu s'annule, elle ne se clôture pas
 * à zéro.
 */
export const schemaCloture = z.object({
  intervention_id: uuid,
  temps_valide_min: z
    .number()
    .int("Le temps se saisit en minutes entières.")
    .positive("Une intervention clôturée a duré. Sinon, elle s'annule."),
});

export type Cloture = z.infer<typeof schemaCloture>;

/**
 * L'ANNULATION. Le motif est OBLIGATOIRE et non vide.
 *
 * *Une annulation n'efface rien* : la ligne reste, son statut change, et le
 * motif est ce qui rend la trace lisible six mois plus tard. Un motif
 * facultatif serait un motif jamais renseigné.
 */
export const schemaAnnulation = z.object({
  intervention_id: uuid,
  motif: z
    .string()
    .trim()
    .min(3, "Le motif d'annulation est obligatoire.")
    .max(500),
});

export type Annulation = z.infer<typeof schemaAnnulation>;

/**
 * LA SUSPENSION (L2-10, RG-INT-06).
 *
 * Le **motif** est obligatoire — *une intervention arrêtée sans qu'on sache
 * pourquoi est une intervention perdue*, et celui qui la retrouvera dans trois
 * semaines n'aura personne à qui demander.
 *
 * **La référence de pièce et sa date vont ENSEMBLE, ou pas du tout.** RG-INT-06
 * exige les deux : *« pour une attente de pièce, la référence attendue **et** la
 * date de disponibilité prévisionnelle »*. Une référence sans date ferait une
 * file d'attente **sans horizon**, c'est-à-dire une file que l'alerte du
 * chapitre 16.1 ne saurait pas trier.
 *
 * **Ce qui n'est PAS saisi : l'instant de la suspension.** Il est daté par le
 * serveur, dans le fuseau de l'agence (L0-08) — le laisser saisir permettrait
 * de rajeunir une attente, et l'ancienneté est précisément ce que la file
 * mesure.
 */
export const schemaSuspension = z
  .object({
    intervention_id: uuid,
    motif: z
      .string()
      .trim()
      .min(3, "Le motif de la suspension est obligatoire.")
      .max(500),
    piece_attendue_ref: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .nullable()
      .default(null),
    date_dispo_prevue: z.date().nullable().default(null),
  })
  .strict()
  .refine(
    (v) => (v.piece_attendue_ref === null) === (v.date_dispo_prevue === null),
    {
      message:
        "Une attente de pièce se saisit en entier : la référence et la date de disponibilité prévue, ou aucune des deux.",
      path: ["date_dispo_prevue"],
    },
  );

export type Suspension = z.infer<typeof schemaSuspension>;

/** La reprise ne porte que l'identifiant : le statut se déduit du créneau. */
export const schemaReprise = z.object({ intervention_id: uuid }).strict();

export type Reprise = z.infer<typeof schemaReprise>;

/**
 * LA NOTE INTERNE (50-INTERVENTIONS-2) — texte libre, jamais obligatoire.
 *
 * Une case vide REMET À `null`, jamais à une chaîne vide (§9, même régime que
 * `commentaire_technicien`) : un champ vidé par le rôle back-office EFFACE la
 * note, il ne laisse pas une chaîne vide indiscernable d'une note « vide ».
 */
export const schemaNoteInterne = z
  .object({
    intervention_id: uuid,
    note_interne: z
      .string()
      .trim()
      .max(4000)
      .transform((valeur) => (valeur.length === 0 ? null : valeur))
      .nullable()
      .default(null),
  })
  .strict();

export type NoteInterne = z.infer<typeof schemaNoteInterne>;

/**
 * LA RECHERCHE DU REGISTRE (AT-07 ; étendue AT-07 bis, 18/09/2026) — les
 * quatre filtres que la maquette annonce pour cet écran (« Filtres : agence
 * · type · statut · période », `docs/maquette/CODIPLAN_Maquette.html`,
 * écran `inter`), et le texte.
 *
 * **Le texte porte sur les colonnes VISIBLES** — le client, le lieu, ET la
 * moitié « `numero` » de la référence affichée (`INT-00312`) : *« c'est ce
 * que les utilisateurs taperont en premier »* (mesure du 18/09/2026).
 * `numeroDeReference` (`lib/interventions/depot.ts`) retire le préfixe et la
 * ponctuation avant de comparer à `numero`.
 *
 * **La moitié « `Local-XXXXXX` » reste un ÉCART NOMMÉ**, pas un oubli :
 * cette forme dérive de l'`id`, une colonne `@db.Uuid` dont le filtre Prisma
 * ne porte ni `contains` ni `startsWith` (seulement l'égalité, l'appartenance
 * et l'ordre — mesuré, TS refuse l'inverse à la compilation). La chercher
 * demanderait du SQL brut, que le stack imposé interdit hors migrations et
 * politiques RLS, ou un filtrage côté application qui romprait le total des
 * filtres (pagination et total liraient deux populations différentes). Et
 * `numero` reste `null` pour toute intervention avant la synchronisation
 * (lot 3), donc `INT-00312` ne trouve rien tant qu'elle n'a pas livré.
 * Jamais sur le technicien, dont le nom vit dans l'annuaire
 * (`lib/auth/annuaire.ts`) et non sur `intervention`.
 *
 * **Une case vide d'un `<select>` soumet une chaîne vide**, jamais `null` :
 * `z.preprocess` la ramène à `null` avant que l'énumération ne la juge, pour
 * que « tous les types » soit un choix normal et non un refus de validation.
 */
/** La taille d'une PAGE du registre (AT-07) — même valeur que les trois autres écrans qui paginent. */
export const LIMITE_RECHERCHE_PAR_DEFAUT = 50;

const filtreOuVide = <T extends readonly [string, ...string[]]>(valeurs: T) =>
  z.preprocess(
    (valeur) => (valeur === "" ? null : valeur),
    z.enum(valeurs).nullable(),
  );

export const schemaRechercheInterventions = z
  .object({
    texte: z
      .string()
      .trim()
      .transform((valeur) => (valeur.length === 0 ? null : valeur))
      .nullable()
      .default(null),
    agence_id: z
      .preprocess(
        (valeur) => (valeur === "" ? null : valeur),
        z.uuid().nullable(),
      )
      .default(null),
    type: filtreOuVide(TYPES_INTERVENTION).default(null),
    statut: filtreOuVide(STATUTS_INTERVENTION).default(null),
    /**
     * LE FILTRE TECHNICIEN (57-REGISTRE-2) — « Tous » (absent), « Non
     * affectées » (`"aucun"`, sur `technicien_id IS NULL`), ou un technicien
     * précis (son `id`, un UUID — pas de forme littérale « ce n'est pas un
     * UUID » possible avec `z.uuid()`, d'où la validation manuelle ci-dessous).
     *
     * **Une valeur invalide retombe à `null` (aucun filtre), jamais une
     * erreur** : contrairement à `agence_id` ci-dessus, dont un UUID malformé
     * fait échouer TOUT le schéma (`criteres.success` devient faux, et la
     * page entière se vide) — un comportement existant que ce ticket ne
     * touche pas, mais qu'il ne reproduit pas non plus ici, sur consigne
     * explicite du ticket.
     */
    technicien: z
      .preprocess(
        (valeur) => {
          if (valeur === "aucun") return "aucun";
          return typeof valeur === "string" &&
            z.uuid().safeParse(valeur).success
            ? valeur
            : null;
        },
        z.union([z.literal("aucun"), z.uuid()]).nullable(),
      )
      .default(null),
    /**
     * LA PÉRIODE — bornes sur `date_planifiee`. Une intervention encore en
     * file d'attente n'a pas de date : un filtre de période l'exclut donc
     * naturellement, ce qui est le comportement attendu de ce filtre-là.
     */
    du: z
      .preprocess(
        (valeur) => (valeur === "" ? null : valeur),
        z.coerce.date().nullable(),
      )
      .default(null),
    au: z
      .preprocess(
        (valeur) => (valeur === "" ? null : valeur),
        z.coerce.date().nullable(),
      )
      .default(null),
    /**
     * INCLURE LES CLIENTS INACTIFS — RG-PLA-08 (arbitrage du 19/09/2026,
     * direction d'exploitation, D129). Par défaut, ce registre tait les
     * interventions dont le CLIENT est inactif (`filtreDesInterventions`,
     * `lib/interventions/depot.ts`) : cette case est le seul moyen de les
     * revoir depuis cet écran, sans quoi l'historique deviendrait
     * inatteignable. Une case DÉCOCHÉE ne soumet rien en HTML — d'où le
     * `"on"` reconnu et rien d'autre.
     */
    inclure_clients_inactifs: z.preprocess(
      (valeur) => valeur === "on",
      z.boolean(),
    ),
    /**
     * LE LIEN DE LA TUILE « INTERVENTIONS SANS DURÉE » DU TABLEAU DE BORD
     * (AFFICHAGE-MATERIEL-1, 23/09/2026) — un paramètre d'URL, jamais une case
     * du formulaire : cette vue n'est pas un filtre qu'on compose à la main,
     * c'est un lien qui pose exactement le critère de la tuile
     * (`compterInterventionsSansDuree`, `lib/interventions/depot.ts`).
     */
    sans_duree_a_venir: z.preprocess((valeur) => valeur === "1", z.boolean()),
    page: z.coerce.number().int().min(1).default(1),
  })
  .strict()
  .refine((v) => v.du === null || v.au === null || v.au >= v.du, {
    message: "La fin de la période doit suivre son début.",
    path: ["au"],
  });
export type RechercheInterventions = z.output<
  typeof schemaRechercheInterventions
>;
