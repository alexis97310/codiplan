import { periodesValidees } from "@/lib/absences/periode";
import { chargerCalendrierAgence } from "@/lib/calendar/agence";
import { chargerCalendrierDuTechnicien } from "@/lib/calendar/technicien";
import { minutesOuvrees } from "@/lib/calendar/ouverture";
import { versLocal } from "@/lib/calendar/fuseau";
import { type PrismaClient } from "@prisma/client";

import { type ContexteSession } from "@/lib/auth/contexte";
import { avecContexteApplicatif } from "@/lib/db/client";

import {
  occupationTechnicien,
  type InterventionMesuree,
  type OccupationTechnicien,
} from "./statistiques";

/**
 * LE DÉNOMINATEUR DU TAUX D'OCCUPATION, lu au calendrier plutôt qu'inventé.
 *
 * ## Pourquoi la maille est (technicien, agence) et non le technicien seul
 *
 * Les minutes ouvrables viennent du **calendrier de l'agence** : I7 l'exige —
 * *aucun calendrier global codé en dur*, Ducos ouvre le samedi et Koné non. Un
 * technicien qui intervient pour deux agences n'a donc pas UN dénominateur,
 * il en a deux.
 *
 * **Trois façons de s'en sortir, et deux sont mauvaises.** Prendre l'agence où
 * il a le plus d'interventions CHOISIT en silence, et le choix bascule d'une
 * semaine à l'autre. Additionner les deux calendriers compterait deux fois les
 * heures d'une même journée. **La troisième est d'assumer la maille réelle :
 * une ligne par couple (technicien, agence)** — c'est ce que fait ce module, et
 * un technicien qui n'intervient que pour une agence n'y voit aucune
 * différence.
 *
 * ~~*Ce que cela ne tranche pas, et qui reste dû :* la table `technicien` du
 * chapitre 11 n'existe pas, et le calendrier de travail PROPRE au technicien
 * n'est pas encore consulté ici.~~ **FAIT à L3-01a.** `technicien` existe, et
 * le dénominateur vient désormais de `chargerCalendrierDuTechnicien` : horaires
 * propres s'il en a, sinon ceux de son agence. *La phrase est barrée et non
 * effacée : c'est elle qui a nommé la dette, et une dette payée se relit.*
 *
 * **La maille (technicien, agence) ne change pas pour autant**, et elle compte
 * plus qu'avant : le dénominateur dépend maintenant de la PERSONNE autant que
 * de l'agence, si bien que la mise en cache suit le couple et non l'agence
 * seule — *deux techniciens de la même agence peuvent avoir deux
 * dénominateurs.*
 *
 * ## Le refus plutôt que le chiffre
 *
 * Une agence sans calendrier rend `minutesOuvrables = 0`, ce que
 * `tauxOccupation` traduit par `null` — *« pas de calendrier » n'est pas
 * « 0 % »*. L'écran affiche alors l'absence, jamais un pourcentage.
 */

/** Une ligne de statistique, telle que l'écran la consomme. */
export type LigneOccupation = {
  readonly technicienId: string | null;
  readonly agenceId: string;
  readonly agenceLibelle: string;
  readonly occupation: OccupationTechnicien;
};

type Mesurable = InterventionMesuree & { readonly agence_id: string };

/**
 * Regroupe les interventions par (technicien, agence) et donne à chaque groupe
 * son dénominateur, lu au calendrier de l'agence sur la période affichée.
 *
 * `du` et `au` sont des instants ; le calendrier les rapporte au fuseau de son
 * agence, comme partout ailleurs (L0-08).
 */
export async function occupationsDuPlanning(
  contexte: ContexteSession,
  interventions: readonly Mesurable[],
  du: Date,
  au: Date,
  client?: PrismaClient,
): Promise<readonly LigneOccupation[]> {
  const societeId = contexte.societeId;
  if (societeId === null) {
    return [];
  }

  const groupes = new Map<
    string,
    { cle: LigneOccupation; lignes: Mesurable[] }
  >();
  for (const intervention of interventions) {
    const cle = `${intervention.technicien_id ?? ""}|${intervention.agence_id}`;
    const existant = groupes.get(cle);
    if (existant === undefined) {
      groupes.set(cle, {
        cle: {
          technicienId: intervention.technicien_id,
          agenceId: intervention.agence_id,
          agenceLibelle: "",
          occupation: occupationTechnicien(intervention.technicien_id, [], 0),
        },
        lignes: [intervention],
      });
    } else {
      existant.lignes.push(intervention);
    }
  }

  return avecContexteApplicatif(
    contexte,
    async (tx) => {
      const agences = await tx.agence.findMany({
        where: {
          id: { in: [...new Set(interventions.map((i) => i.agence_id))] },
        },
        select: { id: true, libelle: true },
      });
      const libelles = new Map(agences.map((a) => [a.id, a.libelle]));

      // LUES UNE SEULE FOIS pour toute la fenêtre, et sous le contexte cloisonné :
      // la forme « interne » d'`absence` décide, et aucune comparaison de société
      // n'est écrite au-dessus (D94).
      const absences = await tx.absence.findMany({
        where: { du: { lte: au }, au: { gte: du } },
        select: {
          id: true,
          utilisateur_id: true,
          du: true,
          au: true,
          statut: true,
        },
      });

      const resultat: LigneOccupation[] = [];
      // LE DÉNOMINATEUR EST MIS EN CACHE PAR COUPLE (technicien, agence) depuis
      // L3-01a, et non plus par agence seule : *un technicien qui travaille le
      // samedi par exception n'a pas le même dénominateur que son voisin de la
      // même agence.* La clé du cache suit donc la maille du groupe.
      const ouvrablesParCle = new Map<string, number>();
      const fenetre = { du: versLocal(du, "UTC"), au: versLocal(au, "UTC") };

      for (const { cle, lignes } of groupes.values()) {
        const cleCache = `${cle.technicienId ?? ""}|${cle.agenceId}`;
        let ouvrables = ouvrablesParCle.get(cleCache);
        if (ouvrables === undefined) {
          // LA RÈGLE DE PRIORITÉ EST LUE, ELLE N'EST PLUS DUE (L3-01a). Ce module
          // écrivait : *« le calendrier de travail PROPRE au technicien n'est pas
          // encore consulté ici ; le jour où il le sera, c'est lui qui fera foi
          // et l'agence deviendra le repli. »* C'est ce jour.
          //
          // La règle vit dans `lib/calendar/technicien.ts` et NULLE PART
          // AILLEURS : horaires propres s'il en a, sinon ceux de son agence ;
          // fériés et ponts toujours ceux de l'agence.
          //
          // **LE REPLI EST L'AGENCE DE L'INTERVENTION, et il est nommé** : un
          // technicien sans ligne de rattachement — la table vient de naître, et
          // rien n'oblige une société à la remplir d'un coup — retrouve le
          // comportement d'avant ce ticket. *Rendre « inconnu » là où l'on savait
          // répondre serait une régression déguisée en rigueur.*
          const calendrier =
            (cle.technicienId === null
              ? null
              : await chargerCalendrierDuTechnicien(tx, {
                  societeId,
                  utilisateurId: cle.technicienId,
                  fenetre,
                })) ??
            (await chargerCalendrierAgence(tx, {
              societeId,
              agenceId: cle.agenceId,
              fenetre,
            }));
          // Une agence sans calendrier n'a pas d'heures ouvrables CONNUES. Zéro
          // est ici le signal de l'absence, et `tauxOccupation` le rend en
          // `null` plutôt qu'en « 0 % ».
          //
          // *Un technicien SANS rattachement tombe dans le même cas*, et pour la
          // même raison : rien ne dit quelles sont ses heures, et les inventer
          // afficherait un taux qui ne repose sur rien.
          // ── LES ABSENCES SE RETRANCHENT DU DÉNOMINATEUR (L3-17, RG-PLA-06)
          //
          // C'est la moitié que L3-17 attendait, et son ticket la nommait :
          // *« les heures travaillées sont celles du calendrier de travail du
          // technicien, ABSENCES DÉDUITES (L3-04) ».*
          //
          // **Sans elle, le chiffre est faux dans le sens qui accuse.** Un
          // technicien absent toute la semaine garde une semaine ouvrable
          // entière au dénominateur : son taux d'occupation tombe près de zéro,
          // et **rien ne distingue « il était absent » de « il n'a rien fait ».**
          // C'est la famille que D88 nomme sur le registre des VGP, et la
          // troisième de ce module — après « pas de calendrier » et « n'a rien
          // fait », qui ne se corrigent déjà pas pareil.
          //
          // **Les périodes sont FUSIONNÉES avant d'être retranchées**, et c'est
          // `lib/absences/periode.ts` qui le fait : un congé prolongé par un
          // arrêt se recouvre, et retrancher deux fois les mêmes journées rendrait
          // un dénominateur NÉGATIF — c'est-à-dire un taux supérieur à 100 %, ou
          // un signe moins sur un écran de direction.
          const brut =
            calendrier === null ? 0 : minutesOuvrees(calendrier, du, au);
          const absentes =
            calendrier === null
              ? 0
              : periodesValidees(absences, cle.technicienId, { du, au }).reduce(
                  (total, periode) =>
                    total + minutesOuvrees(calendrier, periode.du, periode.au),
                  0,
                );
          // `Math.max` est une CEINTURE, pas la règle : la fusion garantit déjà
          // qu'on ne retranche jamais deux fois la même journée. *Une garantie
          // qu'on ne peut pas constater après coup est une intention* — celle-ci
          // se constate, et un scénario la mesure sur des périodes qui se
          // recouvrent.
          ouvrables = Math.max(0, brut - absentes);
          ouvrablesParCle.set(cleCache, ouvrables);
        }

        resultat.push({
          ...cle,
          agenceLibelle: libelles.get(cle.agenceId) ?? cle.agenceId,
          occupation: occupationTechnicien(cle.technicienId, lignes, ouvrables),
        });
      }

      // Le technicien non affecté vient en dernier : c'est une file d'attente,
      // pas une personne, et la mettre en tête ferait lire la liste à l'envers.
      return resultat.sort((a, b) => {
        if ((a.technicienId === null) !== (b.technicienId === null)) {
          return a.technicienId === null ? 1 : -1;
        }
        return (a.technicienId ?? "").localeCompare(b.technicienId ?? "");
      });
    },
    client,
  );
}
