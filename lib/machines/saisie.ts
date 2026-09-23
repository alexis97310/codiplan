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
  // D28 : la fiche absorbée par une fusion. Seul producteur, L3-10 ; la saisie
  // ne la choisit jamais à la main — voir la note ci-dessous.
  "fusionnee",
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

/**
 * LES CHAMPS D'UNE FICHE MACHINE, AVANT LA DÉDUCTION DE `complet` (R6-03).
 *
 * **Exporté pour qu'un gardien puisse en DÉRIVER sa population**, et pas pour
 * être appelé : `schemaMachine` reste la seule porte de validation. *Mesuré le
 * 16/09/2026 : `.transform()` rend un `ZodPipe`, qui ne porte pas de `.shape`*
 * — un gabarit confronté à `schemaMachine` aurait donc lu **zéro champ**, et
 * l'accord de deux listes vides est le vert le plus trompeur qui soit (§9,
 * 10/09). L'objet est nommé plutôt que le gardien ne fouille l'intérieur du
 * `def`, qui est une forme interne de Zod et changerait sans prévenir.
 */
export const champsMachine = z.object({
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
});

export const schemaMachine = champsMachine.transform((machine) => ({
  ...machine,
  /**
   * DÉDUIT, jamais demandé. `complet` pilote la file de complétion : le
   * laisser saisir en ferait une seconde source du même fait, et les deux
   * divergeraient le jour où quelqu'un corrigerait le numéro sans y penser.
   *
   * **Et c'est ce qui interdit à un GABARIT d'exposer une colonne « Complet »**
   * (R6-03, §6) : le champ n'existe pas dans `champsMachine`, si bien qu'un
   * fichier n'a aucun moyen de mentir sur la qualité d'une fiche. *Une colonne
   * qu'aucun schéma ne porte est une colonne qu'on ne peut pas ajouter par
   * distraction.*
   */
  complet: !serieInconnue(machine.numero_serie),
}));

export type SaisieMachine = z.output<typeof schemaMachine>;

/**
 * LA RECHERCHE DU PARC (AT-07) — câblée depuis AT-04, remplie ici.
 *
 * **Le texte ne cherche que sur des colonnes VISIBLES à l'écran** — numéro de
 * série, client, lieu, référence du modèle, et depuis D126 appliqué à `/parc`
 * (N-12) la marque et la famille, que la ligne affiche désormais. La maquette
 * annonce aussi le QR code (`docs/maquette/CODIPLAN_Maquette.html`, écran
 * `parc`), et c'est précisément le point où ce ticket s'en écarte : `qr_token`
 * n'est affiché dans AUCUNE colonne du tableau du parc, et chercher sur un
 * champ que personne ne voit rendrait des résultats que personne ne peut
 * expliquer. L'écart est ici, à l'endroit précis où la consigne de recherche
 * cesse de s'appliquer telle quelle.
 *
 * `page` suit exactement le même contrat que `lib/clients/saisie.ts` et
 * `lib/sites/saisie.ts` : 1-indexée, l'état vit dans l'URL.
 */
export const LIMITE_RECHERCHE_PAR_DEFAUT = 50;

/**
 * LE PLAFOND DU RÉSUMÉ (KPI), PAS DE L'AFFICHAGE (AT-07).
 *
 * Avant ce ticket, `LIGNES_AFFICHEES` (200) bornait la SEULE requête de
 * l'écran, lue à la fois pour le tableau et pour le résumé — parce que les
 * deux étaient la même chose. La pagination sépare les deux : le tableau
 * prend désormais `LIMITE_RECHERCHE_PAR_DEFAUT` par page, et ce plafond-ci
 * borne la lecture qui alimente `resumerLeParc`, plafond de sécurité contre un
 * parc filtré qui compterait des milliers de fiches. *Un parc au-delà de ce
 * plafond verrait son résumé approximatif plutôt que faux de façon
 * imprévisible* — c'est un écart documenté, pas un défaut caché : la mesure
 * d'aujourd'hui (194 machines) tient tout entière sous ce plafond.
 */
export const LIMITE_RECHERCHE_MAXIMALE = 500;

/**
 * LE FILTRE DE STATUT DE LA BARRE D'OUTILS (N-10, D125) — un `<select>` que
 * `codiplan-maquette-complete.html` dessine trois fois dans `parc()` et que
 * l'écran n'avait encore jamais câblé.
 *
 * **Les QUATRE options sont celles, et rien que celles, que la maquette
 * écrit** : `tous`, puis les trois statuts non terminaux — en service, en
 * panne, arrêtée. Les trois statuts terminaux (`remplacee`, `ferraillee`,
 * `fusionnee`) n'ont pas d'option dans `<select id="machine-status">` : la
 * maquette est MUETTE sur eux, et « ce qu'elle ne dit pas reste libre » (§1)
 * — mais ici rien ne les réclame non plus, si bien qu'aucune option n'est
 * ajoutée par extension.
 */
export const FILTRES_STATUT_PARC = [
  "tous",
  "en_service",
  "en_panne",
  "arretee",
] as const;
export type FiltreStatutParc = (typeof FILTRES_STATUT_PARC)[number];

export const schemaRechercheParc = z
  .object({
    texte: z
      .string()
      .trim()
      .transform((valeur) => (valeur.length === 0 ? null : valeur))
      .nullable()
      .default(null),
    statut: z.enum(FILTRES_STATUT_PARC).default("tous"),
    /**
     * LES TROIS FILTRES COMBINABLES DE LISTES-1 (23/09/2026) — *« page parc :
     * la liste est plutôt lisible, mais il faudrait des filtres : clients,
     * sites, famille, statut »*. `statut` existait déjà (D125) ; ces trois-ci
     * s'y ajoutent, sous la MÊME forme — un identifiant technique, jamais un
     * libellé, pour ne rien recomparer qui ne soit déjà cloisonné en base.
     */
    client_id: z.uuid().nullable().default(null),
    site_id: z.uuid().nullable().default(null),
    famille_id: z.uuid().nullable().default(null),
    page: z.coerce.number().int().min(1).default(1),
  })
  .strict();
export type RechercheParc = z.output<typeof schemaRechercheParc>;
