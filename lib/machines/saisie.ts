import { z } from "zod";

/**
 * SAISIE D'UNE FICHE MACHINE (ticket L2-01, arbitrages D6 et D7).
 *
 * ## LES QUATRE OBLIGATOIRES, ET NON TROIS
 *
 * `modele_id`, `client_id`, `site_id`, `numero_serie` (D6 — *« quatre champs
 * obligatoires, et non trois : le guide se trompait »*). Le numéro de série
 * redevient obligatoire, ce qui rend l'unicité `(société, modèle, n° de série)`
 * définissable et **supprime le risque de doublons silencieux au recensement**.
 *
 * ## LE NUMÉRO ILLISIBLE EST UN CAS, PAS UN TROU
 *
 * Il existe — la maquette le montrait déjà. Le technicien saisit
 * `SN-INCONNU-<référence interne>`, unique par construction, et la fiche est
 * marquée `complet = false` : elle remonte alors dans la file de complétion.
 *
 * **Ce n'est PAS un `NULL`, et c'est tout l'intérêt.** Sous un index unique,
 * PostgreSQL considère deux `NULL` comme distincts : une colonne nullable
 * aurait laissé passer autant de doublons qu'on veut, précisément sur les
 * fiches les moins bien renseignées — *un verrou qui s'ouvre tout seul sur les
 * cas mal renseignés est pire qu'une absence de verrou.*
 *
 * `marquerComplet` déduit `complet` du numéro plutôt que de le demander : deux
 * sources d'un même fait divergent en silence (§9, 01/09), et celle-ci se
 * calcule.
 *
 * ## CE QUE CE MODULE NE FAIT PAS
 *
 * **Il ne fabrique ni `id`, ni `qr_token`, ni `numero`.** L'`id` est un UUID v7
 * généré **sur l'appareil**, y compris hors ligne (D7, I10) ; le `qr_token` en
 * est dérivé ; et `numero` est attribué par le SERVEUR à la première
 * synchronisation. Les trois appartiennent au chemin qui écrit, pas à la saisie
 * — et le compteur par société n'existe pas encore : il vient avec la
 * synchronisation, au lot 3.
 *
 * **Il ne porte aucune règle de validité de la garantie ni du contrat.** Elles
 * dépendent de données que le lot 2 n'a pas encore.
 */

/** Un texte obligatoire, une fois les espaces de bordure retirés. */
const texteNonVide = z.string().trim().min(1);

/** Un texte facultatif : absent, ou non vide. Jamais la chaîne vide. */
const texteFacultatif = z
  .string()
  .trim()
  .min(1)
  .nullable()
  .default(null)
  .catch(null);

/** Le préfixe que D6 impose quand la plaque est illisible. */
export const PREFIXE_SERIE_INCONNUE = "SN-INCONNU-";

/**
 * Les états du cycle de vie d'un actif. **Clos en base ET ici** — à l'inverse
 * des zones géographiques, qui ne sont closes qu'à l'entrée serveur : une
 * machine est en service, en panne, arrêtée, remplacée ou ferraillée dans
 * n'importe quelle société, et une valeur de plus est une migration qu'on veut
 * voir passer en revue.
 */
export const STATUTS_MACHINE = [
  "en_service",
  "en_panne",
  "arretee",
  "remplacee",
  "ferraillee",
] as const;

export const CRITICITES_MACHINE = [
  "bloquante",
  "importante",
  "normale",
] as const;

export const SOURCES_CREATION_MACHINE = [
  "terrain",
  "recensement",
  "import",
  "back_office",
] as const;

/**
 * Vrai si ce numéro de série est celui d'une plaque ILLISIBLE (D6).
 *
 * La comparaison est faite sur le texte élagué, et elle ne tolère rien d'autre :
 * `sn-inconnu-` en minuscules est un numéro de série ordinaire, pas une marque
 * de fiche incomplète. *Une tolérance choisirait à la place de celui qui a
 * saisi.*
 */
export function serieInconnue(numeroSerie: string): boolean {
  return numeroSerie.trim().startsWith(PREFIXE_SERIE_INCONNUE);
}

export const schemaMachine = z
  .object({
    // ── Les QUATRE de D6 ──────────────────────────────────────────────────
    modele_id: z.uuid(),
    client_id: z.uuid(),
    site_id: z.uuid(),
    numero_serie: texteNonVide,

    // ── Le reste, facultatif à la création (D6 : « localisation et photo de
    //    plaque restent facultatives ») ────────────────────────────────────
    reference_interne: texteFacultatif,
    localisation: texteFacultatif,
    facture_origine: texteFacultatif,
    date_mise_en_service: z.date().nullable().default(null),
    date_vente: z.date().nullable().default(null),
    garantie_fin: z.date().nullable().default(null),

    statut: z.enum(STATUTS_MACHINE).default("en_service"),
    criticite: z.enum(CRITICITES_MACHINE).default("normale"),
    source_creation: z.enum(SOURCES_CREATION_MACHINE).default("back_office"),
    machine_remplacee_id: z.uuid().nullable().default(null),
  })
  .transform((machine) => ({
    ...machine,
    /**
     * DÉDUIT, jamais demandé. `complet` pilote la file de complétion : le
     * laisser saisir en ferait une seconde source du même fait, et les deux
     * divergeraient le jour où quelqu'un corrigerait le numéro sans y penser.
     */
    complet: !serieInconnue(machine.numero_serie),
  }));

export type SaisieMachine = z.output<typeof schemaMachine>;
