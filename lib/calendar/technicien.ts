import type { Prisma } from "@prisma/client";

import { chargerCalendrierAgence, type FenetreJours } from "./agence";
import type { Calendrier } from "./calendrier";

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
 */
export async function chargerCalendrierDuTechnicien(
  tx: Prisma.TransactionClient,
  parametres: {
    societeId: string;
    utilisateurId: string;
    fenetre: FenetreJours;
  },
): Promise<Calendrier | null> {
  const { societeId, utilisateurId, fenetre } = parametres;

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

  const agence = await chargerCalendrierAgence(tx, {
    societeId,
    agenceId: technicien.agence_id,
    fenetre,
  });
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
