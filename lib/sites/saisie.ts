import { z } from "zod";

import { schemaZoneGeographique } from "./zones";

/**
 * Ce qu'on a le droit d'écrire sur un site — validation d'entrée (ticket L1-02 ;
 * chapitre 11.2 ; arbitrages D23 ; règle RG-PLA-05 ; CLAUDE.md §2 : Zod sur
 * toute entrée serveur, sans exception).
 *
 * Ce module est PUR : aucune base, aucun contexte de session. Les règles de
 * saisie sont donc les mêmes quel que soit le chemin — formulaire, action
 * serveur, ou l'import Excel de L1-08 quand il arrivera.
 *
 * **Ce qui n'est PAS contrôlé ici, et pourquoi ce n'est pas un oubli.**
 *   — la commune : aucun référentiel communal n'est arrêté nulle part, et un
 *     motif inventé refuserait des données justes (CLAUDE.md §8) ;
 *   — la forme de l'adresse : une adresse calédonienne (boîte postale, tribu,
 *     commune) n'a pas celle d'une adresse métropolitaine, et le cahier des
 *     charges n'en fixe aucune ;
 *   — l'appartenance du client à la société : elle ne se contrôle pas sur une
 *     saisie isolée. C'est la clé étrangère COMPOSITE `(societe_id, client_id)`
 *     qui la tient, et le dépôt en rend le refus lisible.
 *
 * **Et la société n'est JAMAIS une entrée.** Aucun schéma d'ici ne porte de
 * `societe_id` : il vient du contexte de session et de lui seul. Une société
 * transmise par l'appelant serait une habilitation auto-déclarée.
 */

/** Texte facultatif : vide ou blanc se range en `null`, jamais en chaîne vide. */
const texteFacultatif = z
  .string()
  .trim()
  .transform((valeur) => (valeur.length === 0 ? null : valeur))
  .nullable();

/**
 * Libellé du site — obligatoire, non vide après suppression des blancs.
 *
 * La même exigence est posée en base (`site_libelle_non_vide`) : Zod ne voit ni
 * l'import Excel de L1-08, ni une correction faite à la main.
 */
const libelle = z.string().trim().min(1).max(200);

/** Adresse en JSON, comme `client.adresse_facturation` et `agence.adresse`. */
const adresse = z.record(z.string(), z.json()).nullable();

/**
 * Latitude et longitude en degrés décimaux (WGS 84).
 *
 * Les bornes ne sont pas une règle de gestion : ce sont celles de la mesure. La
 * base les porte aussi (`site_latitude_bornee`, `site_longitude_bornee`), et
 * l'intérêt de la double barrière est ici très concret — l'inversion
 * latitude/longitude est la faute de saisie la plus fréquente sur des
 * coordonnées, et à Nouméa (−22,27 ; 166,45) elle est attrapée par la seule
 * borne de la latitude.
 */
const latitude = z.number().min(-90).max(90).nullable();
const longitude = z.number().min(-180).max(180).nullable();

/**
 * Une plage horaire d'accès au site — MÊME forme que `calendrier_plage`
 * (jour ISO 1-7, minutes locales depuis minuit), et ce n'est pas un hasard :
 * une seconde façon d'écrire une récurrence hebdomadaire serait une seconde
 * lecture d'un même critère (CLAUDE.md §9, 01/09).
 *
 * `fin_minutes` peut valoir 1440 — minuit de fin de journée. Une plage dont la
 * fin précède le début est refusée : elle ne décrit aucune ouverture, et
 * l'accepter produirait un avertissement de fermeture (I7) sur un site ouvert.
 */
const plageHoraire = z
  .object({
    jour_semaine: z.number().int().min(1).max(7),
    debut_minutes: z.number().int().min(0).max(1440),
    fin_minutes: z.number().int().min(0).max(1440),
  })
  .strict()
  .refine((plage) => plage.fin_minutes > plage.debut_minutes, {
    path: ["fin_minutes"],
  });

/**
 * Horaires d'accès : une liste de plages, ou `null` quand ils ne sont pas
 * renseignés.
 *
 * **Une liste VIDE et `null` ne disent pas la même chose**, et le dépôt les
 * garde distincts : `null` = « on ne sait pas », une liste vide = « aucune
 * plage d'ouverture ». Le premier ne doit produire aucun avertissement, le
 * second en produit un — c'est la même distinction que `calendrier_plage`, où
 * un jour sans plage est un jour fermé.
 */
const horaires = z.array(plageHoraire).nullable();

/**
 * Temps de trajet de référence, en minutes, DEPUIS l'agence de rattachement
 * (D23, D56, RG-PLA-05).
 *
 * Il **FAIT FOI** quand il existe ; l'estimation par zone n'est qu'un défaut
 * appliqué en son absence. Zéro est une valeur légitime — un site situé à
 * l'agence même —, un négatif ne l'est pas.
 */
const tempsTrajet = z
  .number()
  .int()
  .min(0)
  .max(24 * 60)
  .nullable();

/**
 * Création d'un site. L'identifiant est attribué par le serveur (I10), la
 * société vient du contexte : ni l'un ni l'autre n'est une entrée, et le schéma
 * est `strict()` pour que les fournir soit un REFUS plutôt qu'un champ ignoré.
 *
 * `client_id` EST une entrée, et c'est la différence avec `societe_id` : le
 * client est un choix de l'utilisateur à l'intérieur de sa société, tandis que
 * la société est son habilitation. La clé composite en base refuse le client
 * d'une autre société ; la politique « parc » refuse d'écrire pour un client
 * hors du périmètre d'un compte portail.
 *
 * Les défauts sont posés ICI et nulle part ailleurs : à la création, « non
 * fourni » veut bien dire « vide ». C'est le défaut trouvé à L1-01 — un
 * `.default(null)` côté modification efface tout ce qu'on ne mentionne pas.
 */
export const schemaCreationSite = z
  .object({
    client_id: z.uuid(),
    /**
     * L'agence dont le site dépend (D56). Obligatoire, comme en base : un site
     * dépend d'une agence et d'une seule, et il n'existe aucune valeur par
     * défaut qui ne soit pas un mensonge — la choisir pour l'utilisateur
     * reviendrait à décider d'où part le temps de trajet.
     */
    agence_id: z.uuid(),
    libelle,
    adresse: adresse.default(null),
    commune: texteFacultatif.default(null),
    zone_geo: schemaZoneGeographique.default(null),
    latitude: latitude.default(null),
    longitude: longitude.default(null),
    consignes_acces: texteFacultatif.default(null),
    horaires: horaires.default(null),
    temps_trajet_min: tempsTrajet.default(null),
    actif: z.boolean().default(true),
  })
  .strict();
export type CreationSite = z.output<typeof schemaCreationSite>;

/**
 * Modification d'un site. Tous les champs sont facultatifs — une modification
 * partielle est le cas normal —, mais `libelle` reste non vide s'il est fourni.
 *
 * **`client_id` n'est PAS modifiable, et c'est une décision.** Déplacer un site
 * d'un client à un autre emporterait silencieusement ses machines (L2-01), son
 * historique d'interventions et le périmètre des comptes portail qui le
 * nomment. Ce n'est pas une modification de fiche, c'est une reprise de données
 * — elle passera par un chemin qui dit ce qu'elle emporte, jamais par un champ
 * de formulaire.
 *
 * **Aucun défaut ici.** `undefined` signifie « ne touche pas à cette colonne »,
 * `null` signifie « efface-la ».
 */
export const schemaModificationSite = z
  .object({
    /**
     * Le rattachement PEUT changer — une agence ouvre, un secteur est
     * redécoupé — mais jamais seul : voir le `superRefine` ci-dessous.
     */
    agence_id: z.uuid().optional(),
    libelle: libelle.optional(),
    adresse: adresse.optional(),
    commune: texteFacultatif.optional(),
    zone_geo: schemaZoneGeographique.optional(),
    latitude: latitude.optional(),
    longitude: longitude.optional(),
    consignes_acces: texteFacultatif.optional(),
    horaires: horaires.optional(),
    temps_trajet_min: tempsTrajet.optional(),
    actif: z.boolean().optional(),
  })
  .strict()
  .superRefine((saisie, contexte) => {
    // ── LE TEMPS DE TRAJET NE VOYAGE JAMAIS SEUL (D56) ────────────────────
    //
    // Changer l'agence de rattachement sans revoir `temps_trajet_min`
    // laisserait un nombre qui décrit un trajet depuis une agence dont le site
    // ne dépend plus — et plus rien, ensuite, ne le signalerait.
    //
    // **Cette exigence est posée DEUX fois, et ce n'est pas une redondance
    // décorative.** Ici, pour que le refus soit rendu à l'utilisateur avec le
    // champ fautif ; et en base, par le déclencheur `trajet_suit_agence`, pour
    // que l'import Excel de L1-08 et une correction faite à la main la
    // traversent aussi. C'est le principe de I1 appliqué à autre chose que le
    // cloisonnement.
    //
    // Ce qui reste permis : fournir la nouvelle valeur, ou `null` pour revenir
    // à l'estimation par zone (D23). On n'exige pas qu'on mesure, on exige
    // qu'on décide.
    if (
      saisie.agence_id !== undefined &&
      !Object.hasOwn(saisie, "temps_trajet_min")
    ) {
      contexte.addIssue({
        code: "custom",
        path: ["temps_trajet_min"],
        message: "temps_trajet_min_exige_avec_agence",
      });
    }
  });
export type ModificationSite = z.output<typeof schemaModificationSite>;

/**
 * Bornes de la recherche. Même raisonnement qu'à L1-01 : la volumétrie du
 * chapitre 11.3 ne demande aucune pagination, mais une requête qui ramènerait
 * tout le référentiel d'un coup depuis Nouméa se paie en latence. La borne est
 * explicite plutôt que laissée au défaut de personne (leçon du 23/08).
 */
export const LIMITE_RECHERCHE_PAR_DEFAUT = 50;
export const LIMITE_RECHERCHE_MAXIMALE = 200;

/**
 * Critères de recherche. `texte` cherche dans le libellé et dans la commune :
 * ce sont les deux façons dont l'ADV désigne un lieu au téléphone.
 */
export const schemaRechercheSite = z
  .object({
    client_id: z.uuid().nullable().default(null),
    zone_geo: schemaZoneGeographique.default(null),
    texte: z
      .string()
      .trim()
      .transform((valeur) => (valeur.length === 0 ? null : valeur))
      .nullable()
      .default(null),
    actifs_seulement: z.boolean().default(false),
    limite: z
      .number()
      .int()
      .min(1)
      .max(LIMITE_RECHERCHE_MAXIMALE)
      .default(LIMITE_RECHERCHE_PAR_DEFAUT),
    /**
     * LA PAGE, 1-INDEXÉE (AT-07) — même contrat que `lib/clients/saisie.ts` :
     * l'état de la pagination vit dans l'URL, jamais dans un composant.
     */
    page: z.coerce.number().int().min(1).default(1),
  })
  .strict();
export type RechercheSite = z.output<typeof schemaRechercheSite>;
