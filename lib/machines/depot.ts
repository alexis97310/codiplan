import { type Prisma } from "@prisma/client";

import { type ContexteSession } from "@/lib/auth/contexte";
import { avecContexteApplicatif } from "@/lib/db/client";

/**
 * LA LECTURE DU PARC MACHINES (R2-21 ; D6, D10, D22, I10).
 *
 * ## Ce module lit, il ne compare rien
 *
 * Toute lecture passe par `avecContexteApplicatif`, donc sous le contexte
 * cloisonné : la politique de `machine` est de forme « parc » — société **et**
 * `app.client_id` **et** `app.perimetre_sites` —, et rien n'est recomparé
 * au-dessus. *Une comparaison de société écrite ici serait une seconde lecture
 * d'un même critère, qui diverge en silence* (§9, 01/09).
 *
 * C'est ce qui fait que le même appel sert l'écran interne et le portail : un
 * compte de portail ne voit que le parc de son client et de son périmètre, sans
 * qu'aucune ligne de ce fichier ne le sache.
 *
 * ## CE QU'IL NE REND PAS, ET POURQUOI C'EST ÉCRIT
 *
 * La maquette montre un parc à huit colonnes, dont **« Compteur »** et
 * **« Contrat »**. Ni l'un ni l'autre n'existe : il n'y a pas de table de
 * relevés, et les contrats sont au lot 4. *Afficher une colonne vide dirait que
 * la donnée manque ; afficher un zéro dirait qu'elle vaut zéro.* Les deux
 * colonnes sont donc ABSENTES, et l'écart est écrit ici plutôt que tu — c'est la
 * leçon de R2-13, qui reste bloqué pour exactement cette raison.
 */

/** Ce qu'une ligne de parc porte à l'écran. */
export const CHAMPS_PARC = {
  id: true,
  numero: true,
  numero_serie: true,
  reference_interne: true,
  statut: true,
  criticite: true,
  complet: true,
  localisation: true,
  date_mise_en_service: true,
  modele: {
    select: { reference: true, famille: { select: { libelle: true } } },
  },
  client: { select: { raison_sociale: true } },
  site: { select: { libelle: true, commune: true } },
} as const;

export type LigneDeParc = Prisma.MachineGetPayload<{
  select: typeof CHAMPS_PARC;
}>;

/**
 * LE COMPTE DE CE QUE L'ÉCRAN MONTRE, par statut et par complétude.
 *
 * **Il est calculé sur les lignes RENDUES, jamais par une seconde requête.**
 * Deux lectures d'un même critère divergent en silence, et un bandeau qui
 * compterait autrement que le tableau qu'il coiffe est la pire forme de cette
 * divergence : *le lecteur voit les deux chiffres côte à côte et ne sait pas
 * lequel croire.*
 */
export type ResumeDuParc = {
  readonly total: number;
  readonly parStatut: Readonly<Record<string, number>>;
  /** Les fiches à compléter — numéro de série illisible ou absent (D6). */
  readonly incompletes: number;
};

export function resumerLeParc(lignes: readonly LigneDeParc[]): ResumeDuParc {
  const parStatut: Record<string, number> = {};
  let incompletes = 0;
  for (const ligne of lignes) {
    parStatut[ligne.statut] = (parStatut[ligne.statut] ?? 0) + 1;
    if (!ligne.complet) {
      incompletes += 1;
    }
  }
  return { total: lignes.length, parStatut, incompletes };
}

/**
 * Le parc lisible sous le contexte courant.
 *
 * `limite` borne ce qui est RENDU, jamais ce qui est cloisonné : le
 * cloisonnement est prononcé par la politique, et une borne d'affichage ne s'y
 * substitue pas. Elle existe parce qu'un parc réel compte des milliers de
 * lignes — *le fichier de l'exploitation en porte 292 pour un seul client* — et
 * qu'un écran qui les rendrait toutes serait un écran qu'on n'ouvre plus.
 */
export async function listerLeParc(
  contexte: ContexteSession,
  limite: number,
): Promise<readonly LigneDeParc[]> {
  return avecContexteApplicatif(contexte, (tx) =>
    tx.machine.findMany({
      select: CHAMPS_PARC,
      // Les fiches INCOMPLÈTES d'abord : ce sont celles qui demandent un geste,
      // et un parc trié par date les enterrerait sous les fiches saines.
      orderBy: [
        { complet: "asc" },
        { numero: "desc" },
        { numero_serie: "asc" },
      ],
      take: limite,
    }),
  );
}

/** Ce qu'une FICHE de machine porte, en plus de ce qu'une ligne de parc montre. */
export const CHAMPS_FICHE = {
  ...CHAMPS_PARC,
  modele: {
    select: {
      reference: true,
      marque: true,
      famille: { select: { libelle: true } },
    },
  },
} as const;

export type FicheMachine = Prisma.MachineGetPayload<{
  select: typeof CHAMPS_FICHE;
}>;

/**
 * LA FICHE D'UNE MACHINE, ou `null`.
 *
 * **Une fiche hors périmètre et une fiche inexistante rendent LA MÊME chose.**
 * Les distinguer ferait un oracle — celui-là même que D22 refuse sur le chemin
 * du QR et que D35 refuse à la connexion : *un refus a le droit d'être lisible,
 * jamais d'être informatif* (D50).
 *
 * Aucune comparaison de société n'est écrite ici : la politique de `machine`
 * est de forme « parc », et c'est elle qui prononce.
 */
export async function lireMachine(
  contexte: ContexteSession,
  id: string,
): Promise<FicheMachine | null> {
  return avecContexteApplicatif(contexte, (tx) =>
    tx.machine.findUnique({ where: { id }, select: CHAMPS_FICHE }),
  );
}
