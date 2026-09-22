import { Prisma, type PrismaClient } from "@prisma/client";

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
import { type ObjetStocke } from "./stockage";
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
  client?: PrismaClient,
): Promise<ResultatReception> {
  const societeId = exigerSocieteActive(contexte);
  try {
    const recu = await avecContexteApplicatif(
      contexte,
      (tx) =>
        tx.documentRecu.create({
          data: {
            id: uuidv7(),
            societe_id: societeId,
            ...saisie,
            taille_octets: BigInt(saisie.taille_octets),
          },
          select: CHAMPS_RECU,
        }),
      client,
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
    // ── LA RELECTURE NE PORTE AUCUNE CLAUSE DE SOCIÉTÉ, ET DEUX CHOSES LA
    //    TIENNENT — mesurées le 12/09/2026, pas supposées ────────────────────
    //
    // 1. **Ce chemin n'est atteint qu'après une violation de
    //    `(societe_id, empreinte)`**, et une telle violation est par
    //    construction INTRA-société. « Le fichier de la société voisine »
    //    n'arrive donc jamais ici : il y a un verrou AVANT la politique, et
    //    c'est l'index.
    // 2. **La politique « interne » réduit les candidats à UN.** Quand deux
    //    sociétés portent la même empreinte — ce que l'index autorise —, ce
    //    `findFirst` sans ordre en verrait DEUX si elle ne mordait pas, et
    //    choisirait au hasard. *Mesuré : 1 candidat sous la politique, 2 sans
    //    elle* (`tests/isolation/bac-de-reception.test.ts`, le jumeau).
    //
    // Une comparaison de société écrite ici serait une seconde lecture d'un
    // même critère (§9, 01/09) — et elle masquerait le point 1, qui est la
    // garantie la plus forte des deux.
    const existant = await avecContexteApplicatif(
      contexte,
      (tx) =>
        tx.documentRecu.findFirstOrThrow({
          where: { empreinte: saisie.empreinte },
          select: CHAMPS_RECU,
        }),
      client,
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

/**
 * ── L'UNION DE L8-02, ET CE QU'ELLE ÉVITE ────────────────────────────────────
 *
 * D'où vient un document affiché sur la fiche d'une machine. **La distinction
 * reste visible**, et c'est l'acceptation du ticket : *un document de modèle se
 * corrige une fois pour toutes, un document de machine n'existe que là.* Un
 * écran qui les mêlerait ferait supprimer une notice de gamme en croyant
 * nettoyer un exemplaire.
 */
export type OrigineDocument = "modele" | "machine";

/** Un document tel que la fiche d'une machine le montre. */
export type DocumentDeMachine = {
  readonly id: string;
  readonly libelle: string;
  readonly nom_fichier: string;
  readonly type_mime: string;
  readonly taille_octets: bigint;
  readonly classe: "client" | "interne";
  readonly date_document: Date | null;
  readonly date_expiration: Date | null;
  /** `modele` : partagé par tous les exemplaires. `machine` : propre à celui-ci. */
  readonly origine: OrigineDocument;
};

const CHAMPS_DOCUMENT = {
  id: true,
  libelle: true,
  nom_fichier: true,
  type_mime: true,
  taille_octets: true,
  classe: true,
  date_document: true,
  date_expiration: true,
  modele_id: true,
  machine_id: true,
} as const;

/**
 * LES DOCUMENTS D'UNE MACHINE — LES SIENS **ET** CEUX DE SON MODÈLE (L8-02).
 *
 * ## AUCUNE LIGNE N'EST COPIÉE, et c'est tout l'objet du ticket
 *
 * Une notice accrochée au modèle apparaît sur ses cinq cents exemplaires parce
 * qu'elle est **lue** depuis chacun, jamais parce qu'elle y a été recopiée. *Le
 * jour où le constructeur la corrige, on corrige une ligne et la correction se
 * voit partout* — ce qu'une duplication rendrait impossible à tenir.
 *
 * ## POURQUOI LA MACHINE EST RELUE ICI, et non reçue de l'appelant
 *
 * L'union a besoin du `modele_id`. Le recevoir en argument laisserait un
 * appelant nommer le modèle de son choix : la politique « ascendance » de D93
 * le refuserait sans doute, mais *« sans doute » n'est pas une garantie*, et
 * une borne qui vit dans la bonne volonté de l'appelant n'en est pas une
 * (L1-02e). La machine est donc **relue sous le même contexte**, dans la même
 * transaction, et le modèle vient d'elle.
 *
 * ## `null` ET `[]` NE SE CORRIGENT PAS AU MÊME ENDROIT
 *
 * `null` dit **« cette machine ne vous est pas visible »** — hors périmètre,
 * hors société, ou inexistante, et les trois rendent la même chose : les
 * distinguer ferait un oracle (D35, D50). `[]` dit **« elle n'a aucun
 * document »**, ce qui est un fait sur le parc et non sur le droit de lire.
 *
 * ## AUCUNE COMPARAISON DE SOCIÉTÉ, DE CLIENT NI DE PÉRIMÈTRE N'EST ÉCRITE ICI
 *
 * Les deux lectures passent par `avecContexteApplicatif` : la forme « parc »
 * décide de la machine, la forme « héritage » décide des documents, et la
 * classe `interne` disparaît d'elle-même pour un compte de portail. *Une
 * comparaison écrite au-dessus serait une seconde lecture d'un même critère* —
 * verte aujourd'hui, permissive le jour où elle divergerait (§9, 01/09).
 */
export async function documentsDeLaMachine(
  contexte: ContexteSession,
  machineId: string,
  client?: PrismaClient,
): Promise<readonly DocumentDeMachine[] | null> {
  return avecContexteApplicatif(
    contexte,
    async (tx) => {
      const machine = await tx.machine.findUnique({
        where: { id: machineId },
        select: { id: true, modele_id: true },
      });
      if (machine === null) {
        return null;
      }
      const lignes = await tx.document.findMany({
        where: {
          OR: [{ machine_id: machine.id }, { modele_id: machine.modele_id }],
        },
        select: CHAMPS_DOCUMENT,
        // LES DOCUMENTS DE MODÈLE D'ABORD, comme le bac les traite d'abord
        // (L8-07) : ce sont eux qui servent toutes les machines du modèle, et
        // c'est par eux qu'on commence à chercher une procédure.
        orderBy: [{ machine_id: "asc" }, { libelle: "asc" }, { id: "asc" }],
      });
      return lignes.map((ligne) => ({
        id: ligne.id,
        libelle: ligne.libelle,
        nom_fichier: ligne.nom_fichier,
        type_mime: ligne.type_mime,
        taille_octets: ligne.taille_octets,
        classe: ligne.classe,
        date_document: ligne.date_document,
        date_expiration: ligne.date_expiration,
        // L'ORIGINE SE DÉDUIT DE LA CIBLE, elle ne se stocke pas : la contrainte
        // `document_cible_unique` garantit qu'une colonne et une seule est
        // renseignée (L8-01), si bien qu'une troisième valeur est impossible.
        origine: ligne.machine_id === null ? "modele" : "machine",
      }));
    },
    // `client` est pris pour la MÊME raison que partout ailleurs dans ce dépôt
    // (L1-02d, `lib/absences/depot.ts`) : *une couche sans appelant ne se garde
    // pas*, et le scénario qui prouve le cloisonnement doit pouvoir emprunter
    // CE chemin contre la base jetable — sans quoi il éprouverait une variante
    // écrite pour lui, ce qui est exactement la divergence de L1-02b.
    client,
  );
}

/** Une photo d'intervention, telle que le bon la montre. */
export type PhotoIntervention = {
  readonly id: string;
  readonly libelle: string;
  readonly nom_fichier: string;
  readonly classe: "client" | "interne";
  readonly cree_le: Date;
};

/**
 * DÉPOSE UNE PHOTO SUR UNE INTERVENTION (BON-2) — directement classée,
 * jamais par le bac de réception.
 *
 * **Pourquoi pas `recevoir` puis `classer`** : le bac existe pour un fichier
 * dont la cible est INCERTAINE à réception — un PDF scanné qu'il faut encore
 * rapprocher d'un modèle ou d'une machine (L8-07). Une photo prise sur le
 * terrain n'a AUCUNE ambiguïté : le technicien la prend DEPUIS l'écran de
 * CETTE intervention. Faire transiter un geste sans ambiguïté par un circuit
 * conçu pour en lever une ajouterait une étape que rien ne justifie.
 *
 * La cible n'est PAS reçue en `CibleDocument` : elle est TOUJOURS
 * `intervention`, et c'est le paramètre `interventionId`, jamais un champ que
 * l'appelant pourrait faire varier — la même discipline que
 * `documentsDeLaMachine`, qui relit sa machine plutôt que de faire confiance
 * à un modèle fourni (L1-02e).
 */
export async function deposerPhotoIntervention(
  contexte: ContexteSession,
  interventionId: string,
  saisie: {
    readonly classe: "client" | "interne";
    readonly libelle: string;
    readonly nom_fichier: string;
    readonly type_mime: string;
    readonly objet: ObjetStocke;
  },
  client?: PrismaClient,
): Promise<{ readonly id: string }> {
  const societeId = exigerSocieteActive(contexte);
  return avecContexteApplicatif(
    contexte,
    (tx) =>
      tx.document.create({
        data: {
          id: uuidv7(),
          societe_id: societeId,
          intervention_id: interventionId,
          classe: saisie.classe,
          libelle: saisie.libelle,
          nom_fichier: saisie.nom_fichier,
          type_mime: saisie.type_mime,
          taille_octets: BigInt(saisie.objet.tailleOctets),
          empreinte: saisie.objet.empreinte,
          objet_cle: saisie.objet.objetCle,
        },
        select: { id: true },
      }),
    client,
  );
}

/**
 * UN DOCUMENT PAR SON IDENTIFIANT, avec de quoi lire ses octets — jamais les
 * octets eux-mêmes (L8-05). `null` s'il n'est pas visible.
 */
export async function lireDocument(
  contexte: ContexteSession,
  id: string,
  client?: PrismaClient,
): Promise<{
  readonly objet_cle: string;
  readonly type_mime: string;
  readonly nom_fichier: string;
} | null> {
  return avecContexteApplicatif(
    contexte,
    (tx) =>
      tx.document.findFirst({
        where: { id },
        select: { objet_cle: true, type_mime: true, nom_fichier: true },
      }),
    client,
  );
}

/**
 * LES PHOTOS D'UNE INTERVENTION, dans l'ordre où elles ont été prises.
 *
 * `null` si l'intervention n'est pas visible — hors périmètre, hors société,
 * ou inexistante (D35, D50) ; `[]` si elle l'est et ne porte aucune photo.
 */
export async function photosDeLIntervention(
  contexte: ContexteSession,
  interventionId: string,
  client?: PrismaClient,
): Promise<readonly PhotoIntervention[] | null> {
  return avecContexteApplicatif(
    contexte,
    async (tx) => {
      const intervention = await tx.intervention.findUnique({
        where: { id: interventionId },
        select: { id: true },
      });
      if (intervention === null) {
        return null;
      }
      return tx.document.findMany({
        where: { intervention_id: interventionId },
        select: {
          id: true,
          libelle: true,
          nom_fichier: true,
          classe: true,
          cree_le: true,
        },
        orderBy: [{ cree_le: "asc" }, { id: "asc" }],
      });
    },
    client,
  );
}
