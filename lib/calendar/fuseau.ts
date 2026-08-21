import { z } from "zod";

/**
 * Fuseaux horaires — la seule porte du dépôt vers « quelle heure il est, et où »
 * (ticket L0-08, invariant I7).
 *
 * Trois règles y sont tenues, et elles ne se séparent pas :
 *
 *   1. **Le fuseau est une donnée, jamais un littéral.** Il vient de l'agence
 *      (`agence.fuseau_horaire`, surchargeable, hérité de la société — D5).
 *      Aucun identifiant IANA n'est écrit dans le code : le gardien
 *      `tests/unit/calendar/sans-fuseau-en-dur.test.ts` le vérifie.
 *   2. **Un instant est en UTC, une lecture est locale.** `Date` porte un
 *      instant ; toute lecture en année, mois, heure ou jour de semaine passe
 *      par `versLocal`, qui exige un fuseau. Les accesseurs locaux de `Date`
 *      (`getHours`, `getDay`, …) lisent le fuseau de l'APPAREIL et sont
 *      bannis partout ailleurs — c'est le planning du technicien en
 *      déplacement qui se décalerait.
 *   3. **La date courante ne se lit pas sans fuseau.** `maintenant(fuseau)` est
 *      le seul chemin ; `Date.now()` et `new Date()` sans argument n'existent
 *      que dans ce fichier.
 *
 * Aucune dépendance : `Intl.DateTimeFormat` porte la base de données IANA du
 * moteur, ce qui suffit à convertir dans les deux sens (CLAUDE.md §2 — écrire
 * les trente lignes plutôt qu'ajouter deux cents kilo-octets).
 */

/** Identifiant IANA d'un fuseau — `Pacific/Noumea`, `Europe/Paris`. */
export type Fuseau = string;

/** Une lecture locale : ce que porte un calendrier mural, sans aucun décalage. */
export type DateLocale = {
  annee: number;
  /** 1 à 12 — jamais l'index 0 à 11 de `Date`, qui est une source d'erreur. */
  mois: number;
  jour: number;
  heures: number;
  minutes: number;
  secondes: number;
};

/** Une date locale réduite au jour, sans heure. */
export type JourLocal = Pick<DateLocale, "annee" | "mois" | "jour">;

const MINUTE_MS = 60_000;

/** Minutes d'une journée complète — sert de borne aux minutes locales. */
export const MINUTES_PAR_JOUR = 24 * 60;

/**
 * Le fuseau est-il connu du moteur ? `Intl.DateTimeFormat` lève un
 * `RangeError` sur un identifiant inconnu : c'est le contrôle, et il porte sur
 * la vraie base IANA plutôt que sur une liste recopiée qui vieillirait.
 */
export function estFuseauConnu(valeur: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: valeur });
    return true;
  } catch {
    return false;
  }
}

/**
 * Schéma d'un fuseau (CLAUDE.md §2 — Zod sur toute entrée).
 *
 * Refuse aussi un décalage numérique déguisé en fuseau (`UTC+11`, `+11:00`) :
 * un décalage est une conséquence du fuseau et de la date, jamais une donnée.
 * Stocké tel quel, il fige Paris à une heure de l'année et se trompe l'autre.
 */
export const schemaFuseau = z
  .string()
  .min(1)
  .refine((valeur) => !/^(utc|gmt)?[+-]\d/i.test(valeur), {
    message:
      "un décalage numérique n'est pas un fuseau : il est une conséquence du " +
      "fuseau et de la date. Attendu : un identifiant IANA.",
  })
  .refine(estFuseauConnu, {
    message: "fuseau horaire IANA inconnu du moteur",
  });

/** Valide un identifiant de fuseau et le retourne. */
export function lireFuseau(valeur: unknown): Fuseau {
  return schemaFuseau.parse(valeur);
}

/**
 * Formateurs mémorisés. `Intl.DateTimeFormat` est coûteux à construire et les
 * fuseaux en jeu se comptent sur les doigts d'une main.
 */
const formateurs = new Map<Fuseau, Intl.DateTimeFormat>();

function formateur(fuseau: Fuseau): Intl.DateTimeFormat {
  let connu = formateurs.get(fuseau);
  if (connu === undefined) {
    // La locale est fixée à `en-US` pour que les parties soient numériques et
    // stables : ce formateur ne sert JAMAIS à afficher, seulement à décomposer.
    connu = new Intl.DateTimeFormat("en-US", {
      timeZone: fuseau,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formateurs.set(fuseau, connu);
  }
  return connu;
}

function partie(
  parties: readonly Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
): number {
  const trouvee = parties.find((element) => element.type === type);
  if (trouvee === undefined) {
    throw new Error(
      `Décomposition impossible : la partie « ${type} » manque au formateur.`,
    );
  }
  return Number.parseInt(trouvee.value, 10);
}

/**
 * Lecture locale d'un instant dans un fuseau donné.
 *
 * C'est le point de passage unique : partout ailleurs, lire l'heure d'un
 * instant sans nommer de fuseau revient à lire celle de l'appareil.
 */
export function versLocal(instant: Date, fuseau: Fuseau): DateLocale {
  if (Number.isNaN(instant.getTime())) {
    throw new Error("Instant invalide : la conversion locale est impossible.");
  }

  const parties = formateur(fuseau).formatToParts(instant);
  const heures = partie(parties, "hour");

  return {
    annee: partie(parties, "year"),
    mois: partie(parties, "month"),
    jour: partie(parties, "day"),
    // `hourCycle: "h23"` rend minuit à 0 ; certains moteurs ont rendu 24 par le
    // passé sous `hour12: false`. Le repli coûte une ligne et ferme le sujet.
    heures: heures === 24 ? 0 : heures,
    minutes: partie(parties, "minute"),
    secondes: partie(parties, "second"),
  };
}

/**
 * Instant UTC correspondant à une date locale posée sur une échelle UTC.
 *
 * Passe par `setUTCFullYear` : `Date.UTC` projette les années inférieures à 100
 * dans les années 1900, ce qui fausserait silencieusement une date d'archive.
 */
function instantNaif(local: DateLocale): number {
  const date = new Date(0);
  date.setUTCFullYear(local.annee, local.mois - 1, local.jour);
  date.setUTCHours(local.heures, local.minutes, local.secondes, 0);
  return date.getTime();
}

/**
 * Décalage du fuseau à cet instant, en minutes (positif à l'est de Greenwich).
 *
 * Il est **calculé**, jamais stocké : à Paris il vaut +60 en hiver et +120 en
 * été, et c'est exactement ce que figer un décalage en base ferait perdre.
 */
export function decalageMinutes(instant: Date, fuseau: Fuseau): number {
  const local = versLocal(instant, fuseau);
  // `versLocal` s'arrête à la seconde ; l'instant est tronqué de même, pour que
  // les deux côtés de la soustraction portent la même précision.
  const tronque = Math.floor(instant.getTime() / 1000) * 1000;
  return (instantNaif(local) - tronque) / MINUTE_MS;
}

/**
 * Instant UTC d'une heure locale dans un fuseau — l'inverse de `versLocal`.
 *
 * **Deux candidats, jamais un.** Le décalage à retrancher n'est pas connu
 * d'avance : c'est justement ce que la conversion cherche. Sont donc essayés
 * les deux décalages en vigueur vingt-quatre heures avant et vingt-quatre
 * heures après — ils encadrent tout changement d'heure —, et l'on retient
 * celui qui se relit à l'identique.
 *
 * **Les deux cas limites, et la convention retenue.** Elle est celle de
 * `Temporal` (mode « compatible »), que suivent aussi java.time et les
 * bibliothèques usuelles ; l'adopter évite d'avoir un jour à expliquer
 * pourquoi CODIPLAN place un rendez-vous ailleurs que tout le monde.
 *
 *   — **Heure inexistante** (Paris, 2 h 30 le dernier dimanche de mars : les
 *     horloges passent de 2 h à 3 h). Aucun candidat ne se relit à
 *     l'identique ; on avance du saut, et 2 h 30 devient 3 h 30. Un créneau
 *     récurrent ce jour-là se pose, il ne disparaît pas.
 *   — **Heure ambiguë** (Paris, 2 h 30 le dernier dimanche d'octobre : elle
 *     existe deux fois). Les deux candidats se relisent à l'identique ; on
 *     retient le **premier**, celui encore à l'heure d'été.
 *
 * Nouméa ne connaît ni l'un ni l'autre — et c'est bien pour cela que le fuseau
 * ne peut pas être une constante du code.
 */
export function versInstant(local: DateLocale, fuseau: Fuseau): Date {
  const naif = instantNaif(local);
  const jourMs = 24 * 60 * MINUTE_MS;

  const candidats = [
    naif - decalageMinutes(new Date(naif - jourMs), fuseau) * MINUTE_MS,
    naif - decalageMinutes(new Date(naif + jourMs), fuseau) * MINUTE_MS,
  ];

  const valides = candidats.filter((candidat) =>
    seRelitAlIdentique(new Date(candidat), local, fuseau),
  );

  return new Date(
    valides.length > 0 ? Math.min(...valides) : Math.max(...candidats),
  );
}

/** L'instant, relu dans ce fuseau, redonne-t-il exactement cette heure locale ? */
function seRelitAlIdentique(
  instant: Date,
  local: DateLocale,
  fuseau: Fuseau,
): boolean {
  const relecture = versLocal(instant, fuseau);
  return (
    relecture.annee === local.annee &&
    relecture.mois === local.mois &&
    relecture.jour === local.jour &&
    relecture.heures === local.heures &&
    relecture.minutes === local.minutes &&
    relecture.secondes === local.secondes
  );
}

/** Le jour local, sans son heure. */
export function jourDe(local: DateLocale): JourLocal {
  return { annee: local.annee, mois: local.mois, jour: local.jour };
}

/** Une date locale à minuit — première seconde du jour. */
export function minuit(jour: JourLocal): DateLocale {
  return { ...jour, heures: 0, minutes: 0, secondes: 0 };
}

/** Une date locale à `minutes` minutes après minuit. */
export function aMinutes(jour: JourLocal, minutes: number): DateLocale {
  if (!Number.isInteger(minutes) || minutes < 0) {
    throw new Error(
      `Minutes locales invalides : ${minutes}. Attendu un entier positif ou nul.`,
    );
  }
  return {
    ...jour,
    heures: Math.floor(minutes / 60),
    minutes: minutes % 60,
    secondes: 0,
  };
}

/**
 * Instant UTC de la `n`-ième minute locale d'un jour, dans un fuseau.
 *
 * Les minutes peuvent atteindre ou dépasser 1440 : une fermeture à minuit
 * s'écrit `1440`, et elle désigne le lendemain à 0 h. Normaliser ici évite que
 * chaque appelant ne réinvente ce report de jour — et se trompe une fois.
 */
export function instantAMinutes(
  jour: JourLocal,
  minutes: number,
  fuseau: Fuseau,
): Date {
  const report = Math.floor(minutes / MINUTES_PAR_JOUR);
  return versInstant(
    aMinutes(jourSuivant(jour, report), minutes % MINUTES_PAR_JOUR),
    fuseau,
  );
}

/** Minutes écoulées depuis minuit local — l'inverse d'`aMinutes`. */
export function minutesDepuisMinuit(local: DateLocale): number {
  return local.heures * 60 + local.minutes;
}

/** Jour local suivant, en tenant compte des mois et des années. */
export function jourSuivant(jour: JourLocal, pas = 1): JourLocal {
  const date = new Date(0);
  date.setUTCFullYear(jour.annee, jour.mois - 1, jour.jour + pas);
  return {
    annee: date.getUTCFullYear(),
    mois: date.getUTCMonth() + 1,
    jour: date.getUTCDate(),
  };
}

/** Clé `AAAA-MM-JJ` d'un jour local — la forme des dates de la table `jour_ferie`. */
export function cleJour(jour: JourLocal): string {
  const mois = String(jour.mois).padStart(2, "0");
  const jourDuMois = String(jour.jour).padStart(2, "0");
  return `${String(jour.annee).padStart(4, "0")}-${mois}-${jourDuMois}`;
}

/** Lit une clé `AAAA-MM-JJ`. Refuse tout ce qui n'a pas exactement cette forme. */
export function lireCleJour(cle: string): JourLocal {
  const trouve = /^(\d{4})-(\d{2})-(\d{2})$/.exec(cle);
  if (trouve === null) {
    throw new Error(`Date locale invalide : « ${cle} ». Attendu AAAA-MM-JJ.`);
  }
  const [, annee, mois, jour] = trouve;
  return {
    annee: Number.parseInt(annee ?? "", 10),
    mois: Number.parseInt(mois ?? "", 10),
    jour: Number.parseInt(jour ?? "", 10),
  };
}

/** Compare deux jours locaux : négatif, nul ou positif. */
export function comparerJours(a: JourLocal, b: JourLocal): number {
  return cleJour(a).localeCompare(cleJour(b));
}

/**
 * L'instant présent, lu dans un fuseau nommé.
 *
 * **Seul endroit du dépôt où la date courante est lue.** La signature exige un
 * fuseau : c'est ce qui rend impossible d'écrire « aujourd'hui » sans dire
 * aujourd'hui *où*. Le gardien
 * `tests/unit/calendar/sans-date-courante-implicite.test.ts` interdit
 * `new Date()` et `Date.now()` partout ailleurs.
 */
export function maintenant(fuseau: Fuseau): {
  instant: Date;
  local: DateLocale;
} {
  const instant = new Date(Date.now());
  return { instant, local: versLocal(instant, fuseau) };
}
