import { type PrismaClient } from "@prisma/client";

import { type ContexteSession } from "@/lib/auth/contexte";
import { avecContexteApplicatif } from "@/lib/db/client";
import {
  CHAMPS_LIGNE,
  type LigneIntervention,
} from "@/lib/interventions/depot";

/**
 * L'HISTORIQUE D'UNE MACHINE — conservé au changement de site (L2-05).
 *
 * ## La faute que ce module existe pour ne pas commettre
 *
 * Une machine déménage : un compresseur passe de l'atelier de Ducos à celui de
 * Koné, et la fiche change de `site_id`. **Son historique, lui, ne bouge pas** :
 * les interventions ont eu lieu où elles ont eu lieu, et elles gardent leur
 * propre site.
 *
 * *La façon naturelle d'écrire cette lecture est de partir du site de la
 * machine* — « les interventions de ce site, sur cette machine ». Elle est
 * fausse, et elle est fausse **en silence** : elle rend un historique **amputé
 * de tout ce qui précède le déménagement**, sans rien dire. L'écran affiche
 * trois interventions au lieu de douze, et personne ne sait qu'il en manque
 * neuf.
 *
 * **La lecture part donc de la MACHINE, et d'elle seule.** `site_id` n'apparaît
 * dans aucun filtre de ce fichier.
 *
 * ## Il ne compare aucune société
 *
 * Tout passe par `avecContexteApplicatif`, donc sous le contexte cloisonné : la
 * politique d'`intervention` est de forme « parc » (D84), et rien n'est
 * recomparé au-dessus. *C'est ce qui fait que le même appel sert l'écran
 * interne et le portail* — un compte de portail n'y verra que ce que son
 * périmètre lui donne, sans qu'une ligne d'ici le sache.
 */

/**
 * L'historique d'une machine, du plus récent au plus ancien.
 *
 * **L'ordre est celui des FAITS, pas celui de la saisie** : `date_planifiee`
 * d'abord, puis le numéro à date égale — *deux interventions du même jour se
 * départagent par l'ordre où elles ont été numérotées, qui est le seul ordre
 * stable dont on dispose.* Une intervention sans date planifiée — une demande
 * non encore posée — vient en tête : elle est ce qui reste à faire.
 *
 * **Elle ramène TOUT**, et c'est ce que la fiche (`/parc/[id]`) attend : un
 * historique amputé y aurait la même forme qu'un historique complet. Un écran
 * qui n'en montre que le début appelle `teteDeLHistorique` avec ce qu'il
 * affiche (PARC-1).
 */
export async function historiqueDeLaMachine(
  contexte: ContexteSession,
  machineId: string,
  client?: PrismaClient,
): Promise<readonly LigneIntervention[]> {
  return lireLHistorique(contexte, machineId, undefined, client);
}

/**
 * LA TÊTE DE L'HISTORIQUE — les `limite` lignes les plus récentes, et elles
 * seules (PARC-1).
 *
 * L'aperçu de `/parc` montre trois événements. Il les obtenait en lisant
 * l'historique entier puis en le tronquant : la requête ramenait quinze ans de
 * lignes pour en garder trois, à chaque survol. **La limite est un ARGUMENT,
 * jamais une constante cachée ici** — l'appelant sait combien il affiche, la
 * requête ne le devine pas, et deux écrans qui n'en montrent pas le même
 * nombre n'ont pas à partager un chiffre.
 *
 * *Même lecture que `historiqueDeLaMachine`* — même filtre, même ordre, bornée
 * et rien d'autre : les lignes rendues sont les premières de l'historique
 * complet, et `tests/isolation/historique-machine-borne.test.ts` le confronte.
 *
 * `limite` est un entier strictement positif, et c'est refusé avant toute
 * requête : Prisma lit un `take` négatif comme « depuis la fin », ce qui
 * rendrait les plus ANCIENNES sous le titre « derniers événements » sans
 * qu'aucune ligne ne manque ni ne rougisse.
 */
export async function teteDeLHistorique(
  contexte: ContexteSession,
  machineId: string,
  limite: number,
  client?: PrismaClient,
): Promise<readonly LigneIntervention[]> {
  if (!Number.isInteger(limite) || limite <= 0) {
    throw new Error(
      `teteDeLHistorique : la limite doit être un entier strictement positif, reçu ${String(limite)}`,
    );
  }
  return lireLHistorique(contexte, machineId, limite, client);
}

/**
 * LA SEULE LECTURE, écrite une fois — deux requêtes d'un même critère
 * divergent en silence (§9, 01/09), et « la machine, jamais le site » ne
 * doit pas avoir à être juste deux fois. `limite` absente : pas de `take`,
 * tout est rendu.
 */
async function lireLHistorique(
  contexte: ContexteSession,
  machineId: string,
  limite: number | undefined,
  client?: PrismaClient,
): Promise<readonly LigneIntervention[]> {
  return avecContexteApplicatif(
    contexte,
    (tx) =>
      tx.intervention.findMany({
        // **Le SEUL filtre, et c'est tout le ticket.** Ajouter `site_id` ici
        // amputerait l'historique de tout ce qui précède un déménagement.
        //
        // *Il traverse `intervention_machine` depuis L2-08a* — une visite peut
        // couvrir plusieurs matériels, et l'historique d'une machine est celui
        // des visites qui l'ont TOUCHÉE, pas de celles qui ne portaient qu'elle.
        // Le `some` ne change rien au ticket L2-05 : il ne regarde toujours que
        // la machine.
        where: { machines: { some: { machine_id: machineId } } },
        select: CHAMPS_LIGNE,
        orderBy: [{ date_planifiee: "desc" }, { numero: "desc" }],
        take: limite,
      }),
    client,
  );
}

/**
 * LES SITES OÙ CETTE MACHINE A ÉTÉ VUE, du plus récent au plus ancien.
 *
 * *C'est la trace du déménagement, et elle se DÉDUIT de l'historique* — aucune
 * table ne la porte, et il n'en faut pas : **les interventions passées disent
 * déjà où la machine était.** Une colonne « site précédent » serait une seconde
 * écriture du même fait, qui diverge en silence (§9, 01/09).
 *
 * *Ce qu'elle ne dit pas, et qui est écrit plutôt que tu :* une machine qui a
 * déménagé **sans intervention entre les deux** ne laisse aucune trace ici. Le
 * journal d'audit la porte — `machine.site_id` est une table auditée (I8, D55) —
 * et c'est là qu'il faudra la lire le jour où quelqu'un la demandera.
 */
export function sitesTraverses(
  historique: readonly LigneIntervention[],
): readonly string[] {
  const vus: string[] = [];
  for (const ligne of historique) {
    if (!vus.includes(ligne.site_id)) {
      vus.push(ligne.site_id);
    }
  }
  return vus;
}
