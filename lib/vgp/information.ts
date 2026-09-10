import { AssujettissementVgp } from "@prisma/client";

/**
 * L'ÉTAT DE L'INFORMATION — et ce n'est PAS un état de conformité (L9-02, D88).
 *
 * ## LA PHRASE QUI GOUVERNE CE FICHIER
 *
 * *Ce n'est pas un registre de conformité : c'est un registre de ce qu'on nous
 * a dit.* Les VGP sont commandées par les CLIENTS ; CODIMA n'apprend leur
 * résultat que si on le lui dit. **Tout ce qui suit en découle**, et rien ici ne
 * rend un verdict : le seul calcul autorisé est une DATE (L9-01).
 *
 * ## LE DANGER, NOMMÉ : UN REGISTRE À MOITIÉ REMPLI RESSEMBLE À UN REGISTRE
 *    COMPLET
 *
 * C'est le §9 du 06/09 — *un chiffre juste, dans un rapport vrai, qui fait
 * conclure faux* — appliqué à un parc de machines. Une machine sans nouvelles
 * affichée en blanc, ou rangée avec les « à jour », se lit comme une machine en
 * règle. **`sans_information` est donc une valeur à part entière, jamais une
 * absence de valeur**, et elle porte la date depuis laquelle on n'a rien reçu.
 *
 * ## LES QUATRE ÉTATS, ET POURQUOI IL N'Y EN A PAS TROIS
 *
 * `hors_registre` — la famille n'est pas soumise, ou personne n'a regardé. Il ne
 * se confond pas avec `sans_information` : l'un dit « la question ne se pose
 * pas ici », l'autre « elle se pose et nous n'avons pas la réponse ».
 *
 * ## AUCUNE DURÉE N'EST ÉCRITE ICI (L9-05)
 *
 * Ni un seuil d'alerte, ni une tolérance, ni un « bientôt ». La périodicité
 * vient de la donnée saisie, et l'échéance s'en déduit. *Un seuil inventé est
 * un délai inventé, que le §8 interdit.*
 *
 * ## L'HEURE EST UN PARAMÈTRE, JAMAIS UNE LECTURE
 *
 * `aujourdHui` est reçu, il n'est pas lu ici. Deux raisons, et la seconde est la
 * plus forte : le seul endroit du dépôt où la date courante se lit est
 * `lib/calendar` et elle s'y lit AVEC un fuseau (L0-08) ; et une fonction qui
 * lit l'horloge rend un test vert parce que l'heure a bougé, non parce que la
 * règle tient (§9, D85, appliqué hors du cloisonnement).
 */

/** Ce que le registre sait dire d'une machine, et rien de plus. */
export type EtatInformation =
  | {
      /** La question ne se pose pas : famille non soumise, ou jamais examinée. */
      readonly etat: "hors_registre";
      readonly assujettissement: AssujettissementVgp;
    }
  | {
      /** Elle se pose, et nous n'avons JAMAIS rien reçu. */
      readonly etat: "sans_information";
      /** Depuis quand nous n'avons rien : la date de mise en service, ou nulle. */
      readonly depuis: Date | null;
      readonly joursSansInformation: number | null;
    }
  | {
      /** Nous avons reçu quelque chose, et voici quand. */
      readonly etat: "information_recue";
      readonly derniereInformation: Date;
      /** L'échéance DÉDUITE de la périodicité déclarée. Nulle sans périodicité. */
      readonly prochaineEcheance: Date | null;
      /** Le nombre de jours d'ici l'échéance ; négatif si elle est passée. */
      readonly joursAvantEcheance: number | null;
    };

const MILLISECONDES_PAR_JOUR = 86_400_000;

/** Différence en jours pleins entre deux instants. Aucune tolérance : un calcul. */
function joursEntre(depuis: Date, jusqua: Date): number {
  return Math.floor(
    (jusqua.getTime() - depuis.getTime()) / MILLISECONDES_PAR_JOUR,
  );
}

/**
 * Ajoute des mois à une date, en UTC.
 *
 * **Le dernier jour du mois est ramené, jamais débordé.** 31 janvier + 1 mois
 * rend le 28 (ou le 29) février, et non le 3 mars : une échéance qui saute
 * par-dessus la fin du mois est fausse d'un mois entier une fois sur douze.
 * *Mesuré par un scénario nommé, parce que le comportement natif de `Date` fait
 * exactement l'inverse.*
 */
export function ajouterMois(date: Date, mois: number): Date {
  const annee = date.getUTCFullYear();
  const moisCible = date.getUTCMonth() + mois;
  const jour = date.getUTCDate();
  // Le jour 0 du mois SUIVANT est le dernier jour du mois cible.
  const dernierJourDuMoisCible = new Date(
    Date.UTC(annee, moisCible + 1, 0),
  ).getUTCDate();
  return new Date(
    Date.UTC(
      annee,
      moisCible,
      Math.min(jour, dernierJourDuMoisCible),
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds(),
    ),
  );
}

/**
 * Ce que le registre peut dire d'une machine — et rien de plus que cela.
 *
 * @param aujourdHui l'instant de référence, REÇU et jamais lu ici (voir
 *   l'en-tête). L'appelant le tient de `lib/calendar`, avec son fuseau.
 */
export function etatDeLInformation(entree: {
  readonly assujettissement: AssujettissementVgp;
  readonly periodiciteMois: number | null;
  /** La dernière information REÇUE d'un organisme. Nulle : on n'a rien reçu. */
  readonly derniereInformation: Date | null;
  /** À défaut d'information, depuis quand la machine existe. Peut être nulle. */
  readonly depuis: Date | null;
  readonly aujourdHui: Date;
}): EtatInformation {
  // HORS REGISTRE : la question ne se pose pas. `a_determiner` y est rangé
  // DÉLIBÉRÉMENT — tant que personne n'a regardé, on ne peut pas dire qu'il
  // manque une information, on peut seulement dire qu'il manque une DÉCISION,
  // et c'est la liste des indéterminés (L9-03) qui la réclame, pas celle-ci.
  if (entree.assujettissement !== AssujettissementVgp.soumis) {
    return {
      etat: "hors_registre",
      assujettissement: entree.assujettissement,
    };
  }

  if (entree.derniereInformation === null) {
    return {
      etat: "sans_information",
      depuis: entree.depuis,
      joursSansInformation:
        entree.depuis === null
          ? null
          : joursEntre(entree.depuis, entree.aujourdHui),
    };
  }

  // L'ÉCHÉANCE EST DÉDUITE, JAMAIS AFFIRMÉE. Sans périodicité déclarée, elle
  // est NULLE : on sait quand on a été informé, on ne sait pas quand la
  // prochaine visite est due. *Rendre une date au jugé serait exactement le
  // registre qui ment.*
  const prochaineEcheance =
    entree.periodiciteMois === null
      ? null
      : ajouterMois(entree.derniereInformation, entree.periodiciteMois);

  return {
    etat: "information_recue",
    derniereInformation: entree.derniereInformation,
    prochaineEcheance,
    joursAvantEcheance:
      prochaineEcheance === null
        ? null
        : joursEntre(entree.aujourdHui, prochaineEcheance),
  };
}
