import { z } from "zod";

import type { Prisma } from "@prisma/client";

/**
 * LE PARAMÉTRAGE D'OUVERTURE PAR AGENCE (lot 2) — horaires, jours travaillés,
 * pas de créneau.
 *
 * ## Pourquoi ce module existe
 *
 * I7 est catégorique : *Ducos ouvre du lundi au samedi, Koné du lundi au
 * vendredi. **Aucun calendrier global codé en dur.*** Le planning avait besoin
 * de savoir quels créneaux proposer ; sans ce module, il aurait fallu écrire
 * une grille dans un composant, c'est-à-dire un calendrier global codé en dur,
 * que personne n'aurait pu régler.
 *
 * ## Les trois choses qu'il rend, et d'où chacune vient
 *
 * | Ce qu'on demande | D'où cela vient |
 * |---|---|
 * | les jours travaillés | `calendrier_plage.jour_semaine`, distinct |
 * | les horaires | `calendrier_plage.debut_minutes` / `fin_minutes` |
 * | le pas de créneau | `calendrier.pas_creneau_minutes` |
 *
 * **Ce module ne lit JAMAIS l'heure courante**, et c'est délibéré : il répond à
 * *quels créneaux existent un jour donné*, pas à *quels créneaux restent*. La
 * date courante se lit dans `lib/calendar/fuseau.ts`, avec un fuseau (L0-08),
 * et l'appelant la lui passe.
 *
 * **Et il ne dit rien des fériés ni des majorations.** Les fériés sont dans
 * `jour_ferie` et `calendrier_ferie`, dans cet ordre et jamais l'inverse (D46) ;
 * la majoration relève de la tarification et de l'agence du technicien (I7).
 */

/** Une plage d'ouverture, en minutes locales depuis minuit. */
export type Plage = {
  readonly jourSemaine: number;
  readonly debutMinutes: number;
  readonly finMinutes: number;
};

/** Le paramétrage d'un calendrier, tel qu'un écran de réglage l'affiche. */
export type Parametrage = {
  readonly calendrierId: string;
  readonly code: string;
  readonly libelle: string;
  readonly pasCreneauMinutes: number;
  readonly plages: readonly Plage[];
};

/**
 * LE PAS SE RÈGLE, IL NE SE DEVINE PAS.
 *
 * Les bornes sont celles de la contrainte `CHECK` de la base — écrites ici pour
 * que le refus soit LISIBLE avant d'être opposé, jamais pour décider à sa
 * place. *Deux lectures d'un même critère divergent en silence* : celle-ci est
 * la lecture d'affichage, la base garde.
 */
export const PAS_MINIMUM = 1;
export const PAS_MAXIMUM = 480;

export const schemaPasCreneau = z
  .number()
  .int("Le pas se règle en minutes entières.")
  .min(PAS_MINIMUM)
  .max(PAS_MAXIMUM);

/**
 * Le calendrier qui gouverne un technicien : le SIEN s'il en a un, celui de son
 * agence sinon.
 *
 * *L'exception l'emporte sur la règle, et c'est tout ce qu'une exception veut
 * dire.* Elle est un RATTACHEMENT à un autre calendrier de la même société,
 * jamais une copie de plages — recopier aurait fait deux lectures d'un même
 * critère, et la seconde aurait cessé d'être vraie au premier changement
 * d'horaires.
 */
export async function calendrierDuTechnicien(
  tx: Prisma.TransactionClient,
  utilisateurId: string,
  calendrierAgenceId: string | null,
): Promise<string | null> {
  const exception = await tx.technicienCalendrier.findFirst({
    where: { utilisateur_id: utilisateurId },
    select: { calendrier_id: true },
  });
  return exception?.calendrier_id ?? calendrierAgenceId;
}

/** Le paramétrage complet d'un calendrier. `null` s'il est hors périmètre. */
export async function lireParametrage(
  tx: Prisma.TransactionClient,
  calendrierId: string,
): Promise<Parametrage | null> {
  const calendrier = await tx.calendrier.findFirst({
    where: { id: calendrierId },
    select: {
      id: true,
      code: true,
      libelle: true,
      pas_creneau_minutes: true,
      plages: {
        select: {
          jour_semaine: true,
          debut_minutes: true,
          fin_minutes: true,
        },
        orderBy: [{ jour_semaine: "asc" }, { debut_minutes: "asc" }],
      },
    },
  });
  if (calendrier === null) {
    return null;
  }
  return {
    calendrierId: calendrier.id,
    code: calendrier.code,
    libelle: calendrier.libelle,
    pasCreneauMinutes: calendrier.pas_creneau_minutes,
    plages: calendrier.plages.map((p) => ({
      jourSemaine: p.jour_semaine,
      debutMinutes: p.debut_minutes,
      finMinutes: p.fin_minutes,
    })),
  };
}

/**
 * LES CRÉNEAUX D'UN JOUR — la grille que le planning propose.
 *
 * Un créneau est retenu s'il tient ENTIÈREMENT dans une plage : un dernier
 * créneau qui déborderait la fermeture proposerait un rendez-vous que l'agence
 * ne peut pas tenir. *Une grille qui déborde est pire qu'une grille courte —
 * la seconde se voit, la première se découvre sur place.*
 *
 * Rend des minutes locales depuis minuit, jamais des instants : le fuseau vient
 * de l'agence à la lecture, et une récurrence stockée en UTC se décalerait d'une
 * heure à chaque changement d'heure là où il y en a un.
 */
export function creneauxDuJour(
  parametrage: Parametrage,
  jourSemaine: number,
): readonly number[] {
  const pas = parametrage.pasCreneauMinutes;
  const creneaux: number[] = [];
  for (const plage of parametrage.plages) {
    if (plage.jourSemaine !== jourSemaine) {
      continue;
    }
    for (
      let debut = plage.debutMinutes;
      debut + pas <= plage.finMinutes;
      debut += pas
    ) {
      creneaux.push(debut);
    }
  }
  return [...new Set(creneaux)].sort((a, b) => a - b);
}

/** Les jours de la semaine où ce calendrier ouvre, en ISO 8601 (1 = lundi). */
export function joursTravailles(parametrage: Parametrage): readonly number[] {
  return [...new Set(parametrage.plages.map((p) => p.jourSemaine))].sort(
    (a, b) => a - b,
  );
}

/** Des minutes locales en `HH:MM` — la façon dont un humain lit une heure. */
export function enHeure(minutes: number): string {
  const h = String(Math.floor(minutes / 60)).padStart(2, "0");
  const m = String(minutes % 60).padStart(2, "0");
  return `${h}:${m}`;
}

/* ────────────────────────────────────────────────────────────────────────────
 * R3-13 — LES PLAGES SE RÈGLENT, elles ne se lisaient que.
 *
 * Ce qui suit décide ; rien n'y lit de base ni d'horloge. Les mêmes critères
 * sont tenus EN BASE par trois déclencheurs — `calendrier_plage_sans_chevauchement`,
 * `calendrier_plage_tient_le_pas` et `calendrier_pas_tient_dans_les_plages` : ce
 * qui est écrit ici est la
 * lecture d'AFFICHAGE, celle qui rend le refus lisible avant qu'il soit opposé.
 * *La base garde ; ce module explique.* Deux lectures d'un même critère
 * divergent en silence (§9, 01/09) — d'où le fait que les deux soient écrites
 * dans le même geste, avec un jumeau qui retire le verrou de base et montre
 * l'écriture passer.
 * ──────────────────────────────────────────────────────────────────────────── */

/** Minuit du lendemain, en minutes locales. La borne haute d'une plage. */
export const MINUTES_JOURNEE = 1440;

/**
 * Une heure saisie `HH:MM` en minutes locales — `null` si ce n'en est pas une.
 *
 * `<input type="time">` rend cette forme et rien d'autre, mais un formulaire se
 * forge : la conversion refuse plutôt qu'elle ne devine. **`24:00` est admis** —
 * c'est la fermeture à minuit, que la contrainte `calendrier_plage_bornes_journee`
 * autorise déjà (`fin_minutes <= 1440`) et qu'aucun sélecteur d'heure ne sait
 * écrire autrement.
 */
export function enMinutes(heure: string): number | null {
  const forme = /^([0-9]{1,2}):([0-9]{2})$/.exec(heure.trim());
  if (forme === null) {
    return null;
  }
  const heures = Number(forme[1]);
  const minutes = Number(forme[2]);
  if (minutes > 59) {
    return null;
  }
  const total = heures * 60 + minutes;
  return total > MINUTES_JOURNEE ? null : total;
}

/** Une plage telle qu'un formulaire la propose, avant tout contrôle croisé. */
export const schemaPlage = z
  .object({
    jourSemaine: z.number().int().min(1).max(7),
    debutMinutes: z.number().int().min(0).max(MINUTES_JOURNEE),
    finMinutes: z.number().int().min(0).max(MINUTES_JOURNEE),
  })
  .refine((p) => p.finMinutes > p.debutMinutes);

/**
 * DEUX PLAGES QUI SE TOUCHENT NE SE CHEVAUCHENT PAS.
 *
 * 08:00–12:00 et 12:00–17:00 sont la journée coupée par le déjeuner : c'est le
 * cas ordinaire, et le refuser interdirait la forme la plus répandue d'un
 * horaire d'agence. C'est la borne exacte du chevauchement d'interventions —
 * *« deux créneaux qui se TOUCHENT ne se chevauchent pas »* —, et elle est la
 * même ici pour que les deux ne divergent pas.
 */
export function chevauchent(a: Plage, b: Plage): boolean {
  if (a.jourSemaine !== b.jourSemaine) {
    return false;
  }
  return a.debutMinutes < b.finMinutes && b.debutMinutes < a.finMinutes;
}

/**
 * La plage du calendrier que `candidate` recouvrirait, `null` s'il n'y en a
 * aucune. `idsAIgnorer` porte la plage qu'on MODIFIE : une plage ne se chevauche
 * pas elle-même, et l'oublier rendrait toute modification impossible.
 */
export function plageQuiChevauche(
  existantes: readonly (Plage & { readonly id: string })[],
  candidate: Plage,
  idAIgnorer?: string,
): (Plage & { readonly id: string }) | null {
  return (
    existantes.find((p) => p.id !== idAIgnorer && chevauchent(p, candidate)) ??
    null
  );
}

/**
 * UNE PLAGE PLUS COURTE QUE LE PAS REND UNE GRILLE VIDE — un jour affiché
 * comme ouvert sur lequel le planning ne propose rien.
 *
 * `creneauxDuJour` le dit déjà par sa boucle : `debut + pas <= fin` n'est jamais
 * vrai quand la plage est plus courte que le pas. Le refus est ici pour que
 * l'état ne s'écrive pas, et non pour qu'il se découvre à la lecture.
 */
export function plageTientLePas(plage: Plage, pasMinutes: number): boolean {
  return plage.finMinutes - plage.debutMinutes >= pasMinutes;
}

/** La plage la plus courte du calendrier, en minutes. `null` s'il n'en a aucune. */
export function plageLaPlusCourte(plages: readonly Plage[]): number | null {
  const durees = plages.map((p) => p.finMinutes - p.debutMinutes);
  return durees.length === 0 ? null : Math.min(...durees);
}
