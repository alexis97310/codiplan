import type { Prisma } from "@prisma/client";

import {
  chargerCalendrierAgence,
  type CacheCalendrierAgence,
  type FenetreJours,
} from "./agence";
import type { Calendrier } from "./calendrier";
import type { Fuseau } from "./fuseau";

/**
 * LE CALENDRIER DE TRAVAIL D'UN TECHNICIEN — la règle de priorité, écrite une
 * seule fois (L3-01a ; D72, D13, I7).
 *
 * > *« Règle de priorité écrite une fois dans `lib/calendar` : horaires propres
 * > s'il en a, sinon ceux de son agence ; **fériés et ponts toujours ceux de son
 * > agence** ; agence sans calendrier ⇒ refus de poser, aucun horaire
 * > inventé. »* (L3-01)
 *
 * ## LA PRIORITÉ NE PORTE QUE SUR LES HORAIRES, ET C'EST TOUT LE TICKET
 *
 * Un technicien peut travailler le samedi par exception ; **il ne décrète pas
 * les jours fériés de son territoire**. C'est la même ligne de partage que D46
 * trace entre `jour_ferie` — le fait public — et `calendrier_ferie` — l'écart
 * local de l'agence : *lire dans l'autre sens donnerait à une personne le
 * pouvoir de chômer un jour que son agence travaille, ou l'inverse.*
 *
 * Ce module compose donc **les plages du technicien** avec **tout le reste de
 * son agence** : fuseau, territoire, fériés et ponts. Le fuseau en particulier
 * n'est jamais celui du calendrier propre — *un calendrier n'a pas de fuseau,
 * une agence en a un* (D46).
 *
 * ## UN TECHNICIEN SANS RATTACHEMENT N'A PAS DE CALENDRIER
 *
 * Rend `null`, jamais un calendrier vide. *« Inconnu » n'est pas « ouvert »*
 * (I7, RG-PLA-07) : un calendrier sans plage se lirait « fermé toute la
 * semaine », ce qui est une réponse — et fausse.
 *
 * **`cache`, optionnel** (PERF-2) : transmis tel quel à `chargerCalendrierAgence`,
 * qui seule sait s'en servir. Cette fonction ne le lit ni ne le remplit
 * elle-même — la règle de priorité reste tout entière ici, et le cache ne
 * porte que le CHARGEMENT commun à l'agence, jamais un raccourci de la règle.
 */
export async function chargerCalendrierDuTechnicien(
  tx: Prisma.TransactionClient,
  parametres: {
    societeId: string;
    utilisateurId: string;
    fenetre: FenetreJours;
    cache?: CacheCalendrierAgence;
  },
): Promise<Calendrier | null> {
  const { societeId, utilisateurId, fenetre, cache } = parametres;

  // Le filtre société est explicite en plus de la politique RLS (CLAUDE.md
  // §5.6) : une requête qui ne le porterait que dans la base serait juste
  // aujourd'hui et fausse le jour où elle s'exécuterait sous un rôle exempté.
  const technicien = await tx.technicien.findFirst({
    where: { societe_id: societeId, utilisateur_id: utilisateurId },
    select: { agence_id: true },
  });
  if (technicien === null) {
    return null;
  }

  const agence = await chargerCalendrierAgence(
    tx,
    {
      societeId,
      agenceId: technicien.agence_id,
      fenetre,
    },
    cache,
  );
  if (agence === null) {
    return null;
  }

  const exception = await tx.technicienCalendrier.findFirst({
    where: { societe_id: societeId, utilisateur_id: utilisateurId },
    select: {
      calendrier: {
        select: {
          code: true,
          plages: {
            select: {
              jour_semaine: true,
              debut_minutes: true,
              fin_minutes: true,
            },
          },
        },
      },
    },
  });
  if (exception === null) {
    return agence;
  }

  // LES PLAGES VIENNENT DU TECHNICIEN, LE RESTE DE L'AGENCE.
  //
  // *Un calendrier propre SANS plage n'est pas un calendrier propre* : ce
  // serait un technicien qui ne travaille jamais, et l'exception se lirait
  // comme une absence. On retombe alors sur l'agence, qui est le repli que
  // L3-01 nomme.
  if (exception.calendrier.plages.length === 0) {
    return agence;
  }

  return {
    ...agence,
    code: exception.calendrier.code,
    plages: exception.calendrier.plages,
  };
}

/**
 * LE FUSEAU D'UN TECHNICIEN — celui de son AGENCE, jamais celui de l'appareil
 * (L0-08, D72, I7).
 *
 * > *« Point critique pour l'application technicien : l'affichage suit le
 * > fuseau de l'AGENCE, jamais celui de l'appareil. Un technicien en
 * > déplacement ne doit pas voir son planning se décaler parce que son
 * > téléphone a changé de fuseau. »* (L0-08)
 *
 * **Elle vit ici plutôt que dans l'écran qui l'a réclamée la première**, et
 * pour la raison habituelle : l'écran de la journée et la route du compteur en
 * ont besoin tous les deux, et *deux écritures d'un même critère divergent en
 * silence* (§9, 01/09) — celle-ci porterait un décalage d'un jour sous UTC+11,
 * c'est-à-dire exactement le genre de chiffre que personne ne recompte.
 *
 * **Le repli est la SOCIÉTÉ, jamais une valeur inventée.** `technicien` porte
 * `agence_id NOT NULL`, mais la LIGNE peut manquer : une personne de rôle
 * `technicien` sans rattachement existe, et c'est l'état d'un compte que
 * personne n'a fini de paramétrer. C'est le même repli que le planning applique
 * déjà. *« Je ne sais pas où il est rattaché » ne doit pas rendre l'écran
 * illisible ; cela ne doit pas non plus inventer une agence.*
 */
export async function fuseauDuTechnicien(
  tx: Prisma.TransactionClient,
  parametres: { societeId: string; utilisateurId: string },
): Promise<Fuseau> {
  const { societeId, utilisateurId } = parametres;
  // Le filtre société est explicite en plus de la politique (CLAUDE.md §5.6) :
  // en local, le rôle de migration est superutilisateur et CONTOURNE la RLS
  // (§9, 07/09).
  const technicien = await tx.technicien.findFirst({
    where: { societe_id: societeId, utilisateur_id: utilisateurId },
    select: { agence: { select: { fuseau_horaire: true } } },
  });
  if (technicien?.agence.fuseau_horaire != null) {
    return technicien.agence.fuseau_horaire;
  }
  const societe = await tx.societe.findFirst({
    where: { id: societeId },
    select: { fuseau_horaire: true },
  });
  return societe?.fuseau_horaire ?? "UTC";
}
