import { Prisma } from "@prisma/client";

import { type ContexteSession, exigerSocieteActive } from "@/lib/auth/contexte";
import { avecContexteApplicatif } from "@/lib/db/client";
import { uuidv7 } from "@/lib/db/uuid";

import {
  colonnesDeCible,
  type Classement,
  type Ecartement,
  type SaisieDocument,
  type SaisieDocumentRecu,
} from "./saisie";
import { type Avancement } from "./propositions";

/**
 * LES ACCÈS AU BAC DE RÉCEPTION ET AUX DOCUMENTS (lot 8 ; D87, D93, D94).
 *
 * **Aucune comparaison de société, de client ni de périmètre n'est écrite ici**,
 * et c'est le point. Tout passe par `avecContexteApplicatif`, et les politiques
 * décident : forme « héritage » sur `document` (un document est visible si sa
 * cible l'est, et la classe rétrécit), forme « interne » sur `document_recu`
 * (société ET pas de compte portail). Une comparaison écrite au-dessus serait
 * une seconde lecture du même critère, verte aujourd'hui et permissive le jour
 * où elle divergerait (§9, 01/09).
 *
 * ## LA DÉDUPLICATION EST LUE DANS UN REFUS, JAMAIS PRÉVENUE PAR UNE LECTURE
 *
 * `recevoir` n'interroge pas la base avant d'écrire. Entre un `SELECT` et un
 * `INSERT`, un second dépôt du même fichier passe — et le bac est justement
 * l'endroit où l'on redépose, un téléversement de plusieurs gigaoctets depuis
 * Nouméa se coupant et se reprenant. **Le seul endroit où « une fois » se
 * garantit est l'index unique** `(societe_id, empreinte)` ; ce module écrit,
 * lit le refus `P2002`, et rend `doublon` avec le reçu déjà présent.
 *
 * ## CE QU'IL N'Y A PAS ICI, ET C'EST ÉCRIT PLUTÔT QUE TU
 *
 * **Aucun classement automatique.** `classer` exige une cible NOMMÉE par son
 * appelant ; il n'existe aucune fonction qui prendrait une proposition et la
 * ratifierait. *Un rapprochement faux accroche la notice d'un compresseur à un
 * pont élévateur, et personne ne le voit avant qu'un technicien suive la
 * mauvaise procédure.*
 *
 * **Aucun transport d'octets.** Le module de stockage n'existe pas, faute
 * d'appelant : `objet_cle` est fournie, jamais fabriquée.
 */

/** Un fichier du bac, tel qu'il est rendu. */
export type FicheRecu = {
  id: string;
  empreinte: string;
  nom_fichier: string;
  type_mime: string;
  taille_octets: bigint;
  objet_cle: string;
  apercu_objet_cle: string | null;
  statut: "a_traiter" | "classe" | "ecarte";
  document_id: string | null;
  ecarte_motif: string | null;
};

const CHAMPS_RECU = {
  id: true,
  empreinte: true,
  nom_fichier: true,
  type_mime: true,
  taille_octets: true,
  objet_cle: true,
  apercu_objet_cle: true,
  statut: true,
  document_id: true,
  ecarte_motif: true,
} as const;

/** Code d'erreur Prisma d'une violation de contrainte d'unicité. */
const VIOLATION_UNICITE = "P2002";

/**
 * Le résultat d'un dépôt. `doublon` n'est PAS une erreur : c'est la réponse
 * attendue quand le même fichier revient, et elle rend le reçu déjà présent
 * pour que l'appelant reprenne son traitement là où il en était.
 */
export type ResultatReception =
  | { readonly recu: FicheRecu; readonly doublon: false }
  | { readonly recu: FicheRecu; readonly doublon: true };

/**
 * Dépose un fichier au bac. **Déduplication par empreinte AVANT tout
 * rapprochement** : deux fois le même PDF est un seul document, et le découvrir
 * après le rapprochement fait deux fois le travail.
 */
export async function recevoir(
  contexte: ContexteSession,
  saisie: SaisieDocumentRecu,
): Promise<ResultatReception> {
  const societeId = exigerSocieteActive(contexte);
  try {
    const recu = await avecContexteApplicatif(contexte, (tx) =>
      tx.documentRecu.create({
        data: {
          id: uuidv7(),
          societe_id: societeId,
          ...saisie,
          taille_octets: BigInt(saisie.taille_octets),
        },
        select: CHAMPS_RECU,
      }),
    );
    return { recu, doublon: false };
  } catch (erreur: unknown) {
    if (
      !(erreur instanceof Prisma.PrismaClientKnownRequestError) ||
      erreur.code !== VIOLATION_UNICITE
    ) {
      throw erreur;
    }
    // Le fichier était déjà là. On rend CELUI-LÀ : sans lui, l'appelant devrait
    // le retrouver lui-même, et un téléversement repris perdrait sa place.
    const existant = await avecContexteApplicatif(contexte, (tx) =>
      tx.documentRecu.findFirstOrThrow({
        where: { empreinte: saisie.empreinte },
        select: CHAMPS_RECU,
      }),
    );
    return { recu: existant, doublon: true };
  }
}

/**
 * LE PROCHAIN FICHIER À TRAITER — et la reprise est là, tout entière.
 *
 * *Une session interrompue reprend au même document*, et il n'y a pour cela
 * aucune table de session à tenir : l'ordre est déterministe — l'identifiant
 * est un UUID v7, donc ordonné dans le temps — et un fichier reste `a_traiter`
 * tant que personne ne l'a classé ni écarté. **L'état de la reprise est l'état
 * du bac lui-même**, ce qui est la seule façon de ne rien perdre : il n'y a pas
 * de travail partiel à sauvegarder, chaque geste étant validé quand il est fait.
 */
export function prochainATraiter(
  contexte: ContexteSession,
): Promise<FicheRecu | null> {
  return avecContexteApplicatif(contexte, (tx) =>
    tx.documentRecu.findFirst({
      where: { statut: "a_traiter" },
      orderBy: { id: "asc" },
      select: CHAMPS_RECU,
    }),
  );
}

/**
 * CLASSE un fichier du bac : il crée la fiche `document` et lie les deux, dans
 * UNE transaction.
 *
 * **La cible vient de l'appelant, et rien ne la devine.** Il n'existe aucune
 * fonction de ce module qui prendrait une proposition et la ratifierait : c'est
 * ce qui interdit l'automatisme silencieux, et c'est une exigence de sécurité,
 * pas de qualité de données.
 *
 * Les deux écritures sont dans la même transaction parce que la base tient
 * l'ÉQUIVALENCE `statut = 'classe' ⟺ document_id IS NOT NULL` : les séparer
 * laisserait, entre les deux, un état que la contrainte refuse — c'est-à-dire
 * une panne, pas une incohérence.
 */
export async function classer(
  contexte: ContexteSession,
  recuId: string,
  classement: Classement,
  fichier: Pick<
    SaisieDocument,
    "nom_fichier" | "type_mime" | "taille_octets" | "empreinte" | "objet_cle"
  >,
): Promise<FicheRecu> {
  const societeId = exigerSocieteActive(contexte);
  return avecContexteApplicatif(contexte, async (tx) => {
    const document = await tx.document.create({
      data: {
        id: uuidv7(),
        societe_id: societeId,
        ...colonnesDeCible(classement.cible),
        classe: classement.classe,
        libelle: classement.libelle,
        nom_fichier: fichier.nom_fichier,
        type_mime: fichier.type_mime,
        taille_octets: BigInt(fichier.taille_octets),
        empreinte: fichier.empreinte,
        objet_cle: fichier.objet_cle,
      },
      select: { id: true },
    });
    return tx.documentRecu.update({
      where: { id: recuId },
      data: { statut: "classe", document_id: document.id },
      select: CHAMPS_RECU,
    });
  });
}

/**
 * ÉCARTE un fichier du bac, avec son MOTIF.
 *
 * *Un écartement sans motif est un écartement que personne ne pourra rejuger.*
 * La base l'exige dans les deux sens ; ce module ne fait que porter le motif.
 */
export function ecarter(
  contexte: ContexteSession,
  recuId: string,
  ecartement: Ecartement,
): Promise<FicheRecu> {
  return avecContexteApplicatif(contexte, (tx) =>
    tx.documentRecu.update({
      where: { id: recuId },
      data: { statut: "ecarte", ecarte_motif: ecartement.motif },
      select: CHAMPS_RECU,
    }),
  );
}

/**
 * L'AVANCEMENT — le compteur visible que L8-07 réclame.
 *
 * *Ce travail sera délégué, et un travail délégué qui perd une session perd la
 * personne avec.* Les quatre nombres sont comptés en base sous le contexte, et
 * leur somme explique chaque fichier reçu — `totalExplique` le vérifie, et un
 * test le mesure plutôt que de l'espérer.
 */
export async function avancement(
  contexte: ContexteSession,
): Promise<Avancement> {
  return avecContexteApplicatif(contexte, async (tx) => {
    const parStatut = await tx.documentRecu.groupBy({
      by: ["statut"],
      _count: { _all: true },
    });
    const compte = (statut: string): number =>
      parStatut.find((ligne) => ligne.statut === statut)?._count._all ?? 0;
    const a_traiter = compte("a_traiter");
    const classes = compte("classe");
    const ecartes = compte("ecarte");
    return {
      recus: a_traiter + classes + ecartes,
      a_traiter,
      classes,
      ecartes,
    };
  });
}
