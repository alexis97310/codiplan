import { z } from "zod";

import {
  cleJour,
  lireCleJour,
  lireFuseau,
  MINUTES_PAR_JOUR,
  type Fuseau,
  type JourLocal,
} from "./fuseau";
import { estJourSemaineIso } from "./semaine";

/**
 * Le calendrier d'ouverture d'une AGENCE, tel que le module le manipule
 * (ticket L0-08, invariant I7, arbitrages D5 et D13).
 *
 * **Agence, jamais site.** Une agence est un établissement CODIMA — Ducos,
 * Koné, Dolbeau ; un site est un lieu d'intervention chez un client. Le cahier
 * des charges confondait les deux jusqu'à D47, qui a corrigé RG-PLA-01 et
 * RG-PLA-02 dans le sens que D5 avait déjà tranché. Les horaires d'un SITE
 * client existent eux aussi, mais ils ne servent qu'à un avertissement (D13),
 * jamais à un blocage — voir `usages.ts`.
 *
 * **Deux attributs indépendants viennent de l'agence** (D46, complément 1) :
 * son **fuseau** (quelle heure il est) et son **territoire** (quels jours sont
 * fériés). L'un ne se déduit jamais de l'autre — `Europe/Paris` couvre
 * plusieurs territoires aux fériés différents.
 *
 * **Aucun calendrier global codé en dur** (I7) : ce type ne porte aucune valeur
 * par défaut. Un calendrier vide est un calendrier fermé toute la semaine, ce
 * qui se voit immédiatement, plutôt qu'un calendrier « du lundi au vendredi »
 * qui aurait l'air juste à Koné et faux à Ducos.
 */

/**
 * Une plage d'ouverture hebdomadaire — la forme d'une ligne de
 * `calendrier_plage`. C'est une récurrence : la règle est locale, le fuseau
 * vient du calendrier, et rien n'est figé en UTC (point 3 du ticket).
 *
 * Plusieurs plages par jour sont admises : la coupure de midi en est une, et
 * une agence qui ferme entre 11 h 30 et 13 h 30 n'est pas ouverte à midi.
 */
export type PlageOuverture = {
  /** Jour ISO — 1 lundi, 7 dimanche. */
  jour_semaine: number;
  /** Ouverture, en minutes locales depuis minuit. */
  debut_minutes: number;
  /** Fermeture, en minutes locales depuis minuit. Strictement après le début. */
  fin_minutes: number;
};

/**
 * **Le FAIT PUBLIC** : un jour férié du territoire, tel que `jour_ferie` le
 * porte (D46). Il dit ce qui EST férié, jamais ce qui est chômé.
 */
export type FaitPublic = {
  /** Date locale `AAAA-MM-JJ` — un férié est un jour, pas un instant. */
  date: string;
  libelle: string;
};

/**
 * **L'ÉCART LOCAL** : ce par quoi une agence s'écarte du fait public, tel que
 * `calendrier_ferie` le porte (D46, complément 2).
 *
 * Deux formes, et une seule table :
 *   — un **férié travaillé** (`travaille: true` sur une date que le territoire
 *     déclare fériée) — RG-PLA-02, « un férié n'est pas systématiquement
 *     chômé » ;
 *   — un **pont** propre à l'entreprise (`travaille: false` sur un jour
 *     ordinaire).
 */
export type EcartAgence = {
  date: string;
  /** L'agence travaille-t-elle ce jour-là ? */
  travaille: boolean;
  /** Motif libre — « pont de l'Ascension », « journée de solidarité ». */
  motif: string | null;
};

/**
 * Un jour qui ne suit pas la simple règle hebdomadaire, une fois le fait public
 * ET l'écart local pris en compte, DANS CET ORDRE.
 *
 * `ouvre` répond à une seule question : les plages du jour de semaine
 * s'appliquent-elles ? L'écart local n'invente jamais d'horaires — les horaires
 * vivent dans `calendrier_plage`, à un seul endroit.
 */
export type JourParticulier = {
  date: string;
  libelle: string;
  /** Les plages hebdomadaires s'appliquent-elles ce jour-là ? */
  ouvre: boolean;
  /** D'où vient la décision : le fait public, ou l'écart de l'agence. */
  origine: "territoire" | "agence";
};

/** Un calendrier résolu : de quoi répondre à « quand », et rien de plus. */
export type Calendrier = {
  /** Code du calendrier — sert aux messages d'erreur, jamais à une règle. */
  code: string;
  /** Fuseau de l'agence, hérité de la société si elle ne le surcharge pas (D5). */
  fuseau: Fuseau;
  /**
   * Territoire de l'AGENCE dont les fériés s'appliquent — code ISO 3166-1
   * alpha-2, clé de `jour_ferie` (D46). Indépendant du fuseau, et jamais déduit
   * de lui : `Europe/Paris` couvre plusieurs territoires aux fériés différents.
   */
  territoire: string;
  plages: readonly PlageOuverture[];
  /** Le résultat de `appliquerEcarts` — jamais les deux sources séparément. */
  jours_particuliers: readonly JourParticulier[];
};

const schemaPlage = z
  .object({
    jour_semaine: z.number().refine(estJourSemaineIso, {
      message: "jour de semaine ISO attendu — 1 pour lundi, 7 pour dimanche",
    }),
    debut_minutes: z.number().int().min(0).max(MINUTES_PAR_JOUR),
    fin_minutes: z.number().int().min(0).max(MINUTES_PAR_JOUR),
  })
  .refine((plage) => plage.fin_minutes > plage.debut_minutes, {
    message: "une plage d'ouverture se ferme après s'être ouverte",
  });

const schemaDateLocale = z.string().refine((valeur) => {
  try {
    lireCleJour(valeur);
    return true;
  } catch {
    return false;
  }
}, "date locale AAAA-MM-JJ attendue");

const schemaJourParticulier = z.object({
  date: schemaDateLocale,
  libelle: z.string().min(1),
  ouvre: z.boolean(),
  origine: z.enum(["territoire", "agence"]),
});

/**
 * Territoire au sens des fériés : ISO 3166-1 alpha-2, deux lettres majuscules.
 *
 * La liste des codes valides n'est délibérément PAS recopiée : elle
 * vieillirait, et le ticket dit expressément qu'un client sur un autre
 * territoire aura les siens. C'est la FORME qui est contrôlée, ici comme en
 * base — un `CHECK` porte la même expression.
 */
export const schemaTerritoire = z.string().regex(/^[A-Z]{2}$/, {
  message:
    "territoire attendu en code ISO 3166-1 alpha-2 — « NC », « FR ». " +
    "Ni un nom de territoire, ni un fuseau horaire.",
});

/** Schéma d'un calendrier (CLAUDE.md §2 — Zod sur toute entrée). */
export const schemaCalendrier = z.object({
  code: z.string().min(1),
  fuseau: z.unknown().transform((valeur) => lireFuseau(valeur)),
  territoire: schemaTerritoire,
  plages: z.array(schemaPlage),
  jours_particuliers: z.array(schemaJourParticulier),
});

/**
 * **L'ordre de lecture, et il ne s'inverse jamais** (D46, complément 2).
 *
 *   1. `jour_ferie` porte le **fait public du territoire** — ce qui EST férié ;
 *   2. `calendrier_ferie` porte **l'écart local** de l'agence — ce qu'elle en
 *      fait.
 *
 * Le fait public d'abord, l'écart local ensuite. **Jamais l'inverse.** Lire
 * dans l'autre sens donnerait à une agence le pouvoir de décréter un férié pour
 * son territoire — ce qui n'appartient à aucune entreprise, et que les
 * politiques de la base refusent déjà (`jour_ferie` n'est écrivable que par les
 * rôles éditeur). Cette fonction est le seul endroit où les deux sources se
 * rencontrent, et l'ordre y est écrit une fois pour toutes.
 *
 * Un fait public sans écart reste chômé. Un écart sans fait public est un pont
 * — ou une ouverture exceptionnelle, si `travaille` vaut `true`.
 */
export function appliquerEcarts(
  faitsPublics: readonly FaitPublic[],
  ecartsLocaux: readonly EcartAgence[],
): JourParticulier[] {
  const particuliers = new Map<string, JourParticulier>();

  // 1. Le fait public. Un férié est chômé tant que rien ne dit le contraire.
  for (const fait of faitsPublics) {
    particuliers.set(fait.date, {
      date: fait.date,
      libelle: fait.libelle,
      ouvre: false,
      origine: "territoire",
    });
  }

  // 2. L'écart local, par-dessus. Il tranche, mais il ne renomme pas le fait
  //    public : « Ascension » reste « Ascension » même travaillée.
  for (const ecart of ecartsLocaux) {
    const fait = particuliers.get(ecart.date);
    particuliers.set(ecart.date, {
      date: ecart.date,
      libelle: fait?.libelle ?? ecart.motif ?? "Jour particulier",
      ouvre: ecart.travaille,
      origine: "agence",
    });
  }

  return [...particuliers.values()].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
}

/**
 * Construit un calendrier depuis un enregistrement quelconque — typiquement
 * des lignes Prisma recomposées par `appliquerEcarts`. Toute entrée non
 * conforme échoue ici, pas trois appels plus loin dans un planning faux.
 */
export function lireCalendrier(enregistrement: unknown): Calendrier {
  return schemaCalendrier.parse(enregistrement);
}

/** Plages déclarées pour ce jour de la semaine, triées par heure d'ouverture. */
export function plagesDuJourSemaine(
  calendrier: Calendrier,
  jourSemaine: number,
): PlageOuverture[] {
  return calendrier.plages
    .filter((plage) => plage.jour_semaine === jourSemaine)
    .sort((a, b) => a.debut_minutes - b.debut_minutes);
}

/** Le jour particulier qui tombe ce jour-là, s'il y en a un. */
export function jourParticulier(
  calendrier: Calendrier,
  jour: JourLocal,
): JourParticulier | null {
  const cle = cleJour(jour);
  return (
    calendrier.jours_particuliers.find((candidat) => candidat.date === cle) ??
    null
  );
}

/**
 * Ce jour est-il chômé ? Un férié ne l'est que si l'agence ne le travaille pas
 * (RG-PLA-02) ; et un jour ordinaire peut l'être si l'agence y pose un pont.
 * Dans les deux cas, c'est `appliquerEcarts` qui a déjà tranché — on ne relit
 * pas ici les deux sources.
 */
export function estChome(calendrier: Calendrier, jour: JourLocal): boolean {
  const particulier = jourParticulier(calendrier, jour);
  return particulier !== null && !particulier.ouvre;
}
