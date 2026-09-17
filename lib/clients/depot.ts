import { Prisma, type PrismaClient } from "@prisma/client";

import { avecContexteApplicatif } from "@/lib/db/client";
import { uuidv7 } from "@/lib/db/uuid";
import { type ContexteSession, exigerSocieteActive } from "@/lib/auth/contexte";

import {
  type CreationClient,
  type ModificationClient,
  type RechercheClient,
} from "./saisie";

/**
 * Les accès à la fiche client — création, lecture, modification, suppression,
 * recherche (ticket L1-01).
 *
 * **Le filtre société n'est écrit nulle part ici, et c'est le point.** Toutes
 * les fonctions passent par `avecContexteApplicatif`, qui ouvre une transaction
 * sous le rôle applicatif NON propriétaire en posant `app.societe_id`,
 * `app.role`, `app.client_id` le cas échéant. La politique de `client` est de
 * forme « parc » : société ET `app.client_id` (D10, D22). Un `findMany` sans
 * `where` ne rend donc que les clients de la société active — et, pour un
 * compte portail, uniquement le sien.
 *
 * C'est le doublement exigé par I1 et RG-SOC-02 : filtre côté serveur, ET
 * politique en base. Ici, le « filtre côté serveur » est le CONTEXTE lui-même,
 * qu'aucun chemin applicatif ne peut contourner — `lib/db/garde-role.ts` refuse
 * d'ouvrir une transaction sous un rôle qui échapperait aux politiques.
 *
 * **Les refus sont typés, pas levés.** Un code externe en double est une
 * réponse attendue — RG-IMP-05 en fait même un cas de rapprochement —, pas une
 * anomalie technique. Il remonte comme un résultat que l'appelant sait rendre,
 * et le texte de l'écran vient du dictionnaire : une exception ne transporte
 * jamais de texte destiné à un humain (`lib/i18n/fr.ts`, la coupure).
 */

/** Une fiche client telle qu'elle est rendue. */
export type FicheClient = {
  id: string;
  code_externe: string | null;
  raison_sociale: string;
  ridet: string | null;
  categorie: string | null;
  adresse_facturation: Prisma.JsonValue | null;
  conditions_reglement: string | null;
  commercial_referent: string | null;
  actif: boolean;
};

/** Colonnes rendues. `societe_id` n'en est pas : l'appelant est déjà dans sa société. */
const CHAMPS_FICHE = {
  id: true,
  code_externe: true,
  raison_sociale: true,
  ridet: true,
  categorie: true,
  adresse_facturation: true,
  conditions_reglement: true,
  commercial_referent: true,
  actif: true,
} as const;

/**
 * Motif d'un refus d'écriture. Une CLÉ, jamais une phrase : la couche de rendu
 * choisit son texte au dictionnaire, et un message technique ne se traduit pas.
 */
export type MotifRefusClient = "code_externe_en_double" | "client_introuvable";

export type ResultatEcriture =
  | { readonly accepte: true; readonly fiche: FicheClient }
  | { readonly accepte: false; readonly motif: MotifRefusClient };

/** Code d'erreur Prisma d'une violation de contrainte d'unicité. */
const VIOLATION_UNICITE = "P2002";

/** Code d'erreur Prisma d'un enregistrement absent. */
const ENREGISTREMENT_ABSENT = "P2025";

function motifDeLErreur(erreur: unknown): MotifRefusClient | null {
  if (!(erreur instanceof Prisma.PrismaClientKnownRequestError)) {
    return null;
  }
  if (erreur.code === VIOLATION_UNICITE) {
    return "code_externe_en_double";
  }
  if (erreur.code === ENREGISTREMENT_ABSENT) {
    return "client_introuvable";
  }
  return null;
}

/**
 * Crée une fiche client dans la société active.
 *
 * L'identifiant est un UUID v7 attribué ICI et non par la base (I10) : c'est la
 * même règle qui permettra à l'application mobile d'en générer un hors ligne.
 * La société vient du contexte ; elle n'est jamais un paramètre.
 */
export async function creerClient(
  contexte: ContexteSession,
  saisie: CreationClient,
): Promise<ResultatEcriture> {
  try {
    const societeId = exigerSocieteActive(contexte);
    const fiche = await avecContexteApplicatif(contexte, (tx) =>
      creerClientDans(tx, societeId, saisie),
    );
    return { accepte: true, fiche };
  } catch (erreur: unknown) {
    const motif = motifDeLErreur(erreur);
    if (motif === null) {
      throw erreur;
    }
    return { accepte: false, motif };
  }
}

/**
 * L'ÉCRITURE ELLE-MÊME, DANS UNE TRANSACTION QUE L'APPELANT TIENT (L1-08i).
 *
 * `creerClient` l'appelle, et l'application d'un import aussi — *un lot
 * s'applique dans UNE transaction, et `creerClient` ouvrirait la sienne par
 * ligne : un lot à moitié écrit serait alors un état que rien ne décrit.*
 *
 * **Elle est extraite plutôt que recopiée**, ce qui est la parade du §9
 * (01/09) : la seconde implémentation d'un critère n'est jamais gratuite — on
 * la remplace par un appel à la première, *ce qui est presque toujours possible
 * et presque toujours meilleur.*
 *
 * L'identifiant est un UUID v7 attribué ICI et non par la base (I10), et
 * `societe_id` est celui que l'appelant a validé : la politique le réclamerait
 * de toute façon en `WITH CHECK`, mais l'écrire garde la première barrière là
 * où I1 la veut — côté serveur.
 */
export async function creerClientDans(
  tx: Prisma.TransactionClient,
  societeId: string,
  saisie: CreationClient,
): Promise<FicheClient> {
  return tx.client.create({
    data: {
      id: uuidv7(),
      societe_id: societeId,
      ...saisie,
      adresse_facturation: saisie.adresse_facturation ?? Prisma.DbNull,
    },
    select: CHAMPS_FICHE,
  });
}

/**
 * LA MÊME ÉCRITURE, EN LOT (session du 16/09/2026, point 1 de la suite —
 * dépassement de délai).
 *
 * **Pourquoi une seconde fonction plutôt qu'une boucle sur `creerClientDans`.**
 * Un import peut créer des centaines de fiches dans la MÊME transaction ; une
 * `create` par ligne fait autant d'allers-retours, et à 500 ms l'un vers la
 * base hébergée, c'est cela — pas la donnée — qui a fait dépasser le délai de
 * la transaction (voir `lib/imports/delais.ts`). `createMany` écrit N lignes
 * en UN aller-retour.
 *
 * **L'identifiant est fourni par l'appelant, jamais tiré ici** — à la
 * différence de `creerClientDans` : `createMany` ne rend aucune ligne créée
 * (Prisma ne le permet pas), et l'appelant a besoin de l'identifiant de
 * CHAQUE fiche pour tracer sa ligne d'import (D15). Le tirer après coup
 * serait une seconde source d'un identifiant que l'appelant doit déjà
 * connaître pour la même raison qu'à la création unitaire (I10).
 */
export async function creerClientsEnLot(
  tx: Prisma.TransactionClient,
  societeId: string,
  lignes: readonly { readonly id: string; readonly saisie: CreationClient }[],
): Promise<void> {
  if (lignes.length === 0) return;
  await tx.client.createMany({
    data: lignes.map(({ id, saisie }) => ({
      id,
      societe_id: societeId,
      ...saisie,
      adresse_facturation: saisie.adresse_facturation ?? Prisma.DbNull,
    })),
  });
}

/**
 * La MODIFICATION dans une transaction que l'appelant tient — le jumeau de
 * `creerClientDans`, et pour la même raison.
 *
 * L'adresse est extraite du reste : `undefined` signifie « ne touche pas à
 * cette colonne », `null` signifie « efface-la ». Prisma distingue les deux par
 * `Prisma.DbNull`, et les confondre effacerait une adresse à chaque
 * modification qui ne la mentionne pas.
 */
export async function modifierClientDans(
  tx: Prisma.TransactionClient,
  id: string,
  saisie: ModificationClient,
): Promise<FicheClient> {
  const { adresse_facturation: adresse, ...reste } = saisie;
  return tx.client.update({
    where: { id },
    data: {
      ...reste,
      ...(adresse === undefined
        ? {}
        : { adresse_facturation: adresse ?? Prisma.DbNull }),
    },
    select: CHAMPS_FICHE,
  });
}

/** Lit une fiche par son identifiant. `null` si elle n'est pas dans le périmètre. */
export async function lireClient(
  contexte: ContexteSession,
  id: string,
): Promise<FicheClient | null> {
  return avecContexteApplicatif(contexte, (tx) =>
    tx.client.findFirst({ where: { id }, select: CHAMPS_FICHE }),
  );
}

/**
 * Modifie une fiche.
 *
 * `updateMany` plutôt qu'`update` serait plus permissif ici, mais moins
 * lisible : `update` sur une ligne hors périmètre lève `P2025`, que l'on rend
 * en « introuvable ». Une fiche d'une autre société est donc introuvable, et
 * elle l'est pour la même raison qu'elle est invisible en lecture — la
 * politique. Le refus ne dit pas si elle existe ailleurs : un message est un
 * canal d'information, et il est soumis au cloisonnement comme une requête
 * (D50).
 */
export async function modifierClient(
  contexte: ContexteSession,
  id: string,
  saisie: ModificationClient,
): Promise<ResultatEcriture> {
  try {
    const fiche = await avecContexteApplicatif(contexte, (tx) =>
      modifierClientDans(tx, id, saisie),
    );
    return { accepte: true, fiche };
  } catch (erreur: unknown) {
    const motif = motifDeLErreur(erreur);
    if (motif === null) {
      throw erreur;
    }
    return { accepte: false, motif };
  }
}

/**
 * Supprime une fiche.
 *
 * **La voie ordinaire est la DÉSACTIVATION** — `actif = false`, colonne du
 * chapitre 11.2 — parce qu'un client cesse d'être un client bien plus souvent
 * qu'il ne cesse d'avoir existé. La suppression existe pour la fiche créée par
 * erreur, et pour elle seule.
 *
 * **Et la suppression LAISSE une trace** — depuis D55, qui a inversé le
 * périmètre d'audit de I8 : `client` est une table métier cloisonnée, elle est
 * donc auditée par défaut, et le déclencheur écrit les valeurs d'avant dans
 * `journal_audit`. C'est ce qui rend cette suppression acceptable : elle est
 * réversible par la lecture.
 */
export async function supprimerClient(
  contexte: ContexteSession,
  id: string,
): Promise<{ readonly accepte: boolean; readonly motif?: MotifRefusClient }> {
  try {
    await avecContexteApplicatif(contexte, (tx) =>
      tx.client.delete({ where: { id } }),
    );
    return { accepte: true };
  } catch (erreur: unknown) {
    const motif = motifDeLErreur(erreur);
    if (motif === null) {
      throw erreur;
    }
    return { accepte: false, motif };
  }
}

/**
 * Recherche — la « recherche » du ticket L1-01.
 *
 * Le texte est cherché à la fois dans la raison sociale et dans le code
 * externe : ce sont les deux façons dont un client se désigne au téléphone, et
 * les deux clés de rapprochement de RG-IMP-05. La casse est ignorée ; les
 * fiches sont rendues par raison sociale, ce qui est l'ordre d'une liste lue
 * par un humain.
 */
/**
 * CE QUE LA RECHERCHE RETIENT — écrit UNE FOIS, et partagé.
 *
 * **Deux appelants le lisent** : la liste, qui rend les fiches, et le compteur
 * des fiches sans code externe, qui les dénombre. *Recopier le `where` dans le
 * second aurait donné deux lectures d'un même critère* (§9, 01/09) — et dans le
 * pire endroit qui soit, puisque le compteur s'affiche AU-DESSUS du tableau :
 * le lecteur verrait les deux chiffres côte à côte sans savoir lequel croire,
 * ce qui est exactement le défaut que `resumerLeParc` évite par l'autre voie.
 *
 * *Ici la seconde requête est assumée* — le compteur porte sur toute la
 * recherche, quand le tableau est borné à ce qu'un écran peut montrer — mais ce
 * qui les sépare est alors la BORNE, une seule chose, et elle est dite à
 * l'écran. Le CRITÈRE, lui, n'a qu'une écriture.
 */
function filtreDeRecherche(criteres: RechercheClient): Prisma.ClientWhereInput {
  const filtreTexte: Prisma.ClientWhereInput =
    criteres.texte === null
      ? {}
      : {
          OR: [
            {
              raison_sociale: {
                contains: criteres.texte,
                mode: Prisma.QueryMode.insensitive,
              },
            },
            {
              code_externe: {
                contains: criteres.texte,
                mode: Prisma.QueryMode.insensitive,
              },
            },
          ],
        };

  return {
    ...filtreTexte,
    ...(criteres.actifs_seulement ? { actif: true } : {}),
  };
}

export async function rechercherClients(
  contexte: ContexteSession,
  criteres: RechercheClient,
  client?: PrismaClient,
): Promise<FicheClient[]> {
  return avecContexteApplicatif(
    contexte,
    (tx) =>
      tx.client.findMany({
        where: filtreDeRecherche(criteres),
        orderBy: [{ raison_sociale: "asc" }, { id: "asc" }],
        skip: (criteres.page - 1) * criteres.limite,
        take: criteres.limite,
        select: CHAMPS_FICHE,
      }),
    client,
  );
}

/**
 * COMBIEN DE FICHES CORRESPONDENT À LA RECHERCHE (AT-07) — jamais le compte de
 * la page.
 *
 * **Réutilise `filtreDeRecherche`, comme `compterSansCodeExterne` le fait déjà
 * juste en dessous** : le critère n'a qu'une écriture, et ce que ces deux
 * fonctions comptent diffère seulement par le `where` supplémentaire sur
 * `code_externe`. *Une pagination qui compterait autrement que la liste
 * qu'elle pagine est la faute nommée par le directeur d'exploitation le
 * 16/09 : « 50 clients » sous une liste qui en compte 619 se lit comme une
 * mesure.*
 */
export async function compterClients(
  contexte: ContexteSession,
  criteres: RechercheClient,
  client?: PrismaClient,
): Promise<number> {
  return avecContexteApplicatif(
    contexte,
    (tx) => tx.client.count({ where: filtreDeRecherche(criteres) }),
    client,
  );
}

/**
 * COMBIEN DE FICHES UN IMPORT NE SAURA PAS RAPPROCHER (RG-IMP-05, D29).
 *
 * **C'est le seul compteur que cet écran porte**, et c'est une décision : les
 * trois autres qu'une maquette montrerait volontiers — total, actifs,
 * inactifs — se lisent déjà dans le tableau, et *un compteur qu'on regarde sans
 * jamais agir dessus apprend à ne plus lire les compteurs* (§9, 11/09).
 * Celui-ci nomme un geste : ces fiches-là demandent qu'on leur attribue un
 * code, sans quoi le prochain import les recréera au lieu de les reconnaître.
 *
 * **Il compte dans le périmètre de la RECHERCHE, pas dans celui de la PAGE.**
 * La borne d'affichage tronque le tableau ; elle ne tronque pas ce compteur, et
 * l'écran le dit — *un chiffre dont on ne sait pas sur quoi il porte est un
 * chiffre qu'on lit de travers* (§9, 06/09).
 *
 * Aucune comparaison de société n'est écrite ici : `client` est de forme
 * « parc » (D10, D22), et un compte de portail ne compte donc que le sien sans
 * qu'une ligne de cette fonction le sache.
 */
export async function compterSansCodeExterne(
  contexte: ContexteSession,
  criteres: RechercheClient,
  client?: PrismaClient,
): Promise<number> {
  return avecContexteApplicatif(
    contexte,
    (tx) =>
      tx.client.count({
        where: { ...filtreDeRecherche(criteres), code_externe: null },
      }),
    client,
  );
}

/** Les lieux d'intervention d'un client, tels que la liste les résume. */
export type SitesDUnClient = {
  readonly nombre: number;
  /** Les communes DISTINCTES, dans l'ordre alphabétique. */
  readonly communes: readonly string[];
};

/**
 * OÙ L'ON INTERVIENT CHEZ CHACUN DE CES CLIENTS.
 *
 * *« Ce n'est pas du décor : c'est la question qu'on se pose en ouvrant la
 * liste. La jointure est un coût assumé. »* — l'arbitrage du 14/09/2026.
 *
 * **Une seule requête pour toute la page**, et non une par ligne : un `findMany`
 * borné aux clients rendus, puis le regroupement en mémoire. *Trente lignes
 * feraient trente allers-retours vers Sydney, à cent-quatre-vingt-dix
 * millisecondes pièce* (§9, 23/08) — le compte se fait ici, où il est gratuit.
 *
 * **Un client sans site rend une entrée à zéro, jamais une absence de clé** :
 * l'écran doit pouvoir écrire « aucun » plutôt que de laisser une case vide,
 * et les deux ne se lisent pas pareil.
 */
export async function sitesParClient(
  contexte: ContexteSession,
  clients: readonly { readonly id: string }[],
  client?: PrismaClient,
): Promise<ReadonlyMap<string, SitesDUnClient>> {
  const resume = new Map<string, { nombre: number; communes: Set<string> }>();
  for (const client of clients) {
    resume.set(client.id, { nombre: 0, communes: new Set() });
  }
  if (clients.length === 0) {
    return new Map();
  }

  const sites = await avecContexteApplicatif(
    contexte,
    (tx) =>
      tx.site.findMany({
        where: { client_id: { in: clients.map((c) => c.id) } },
        select: { client_id: true, commune: true },
      }),
    client,
  );

  for (const site of sites) {
    const entree = resume.get(site.client_id);
    // Un site rendu pour un client qui n'est pas dans la page ne peut pas
    // arriver — le `in` le borne — mais on ne le suppose pas.
    if (entree === undefined) continue;
    entree.nombre += 1;
    if (site.commune !== null && site.commune.trim().length > 0) {
      entree.communes.add(site.commune);
    }
  }

  return new Map(
    [...resume].map(([id, { nombre, communes }]) => [
      id,
      { nombre, communes: [...communes].sort((a, b) => a.localeCompare(b)) },
    ]),
  );
}

/**
 * LE LIBELLÉ QUE LA SOCIÉTÉ DONNE À SON CODE DE RAPPROCHEMENT (D29).
 *
 * *« Code Winpro » chez CODIMA, autre chose ailleurs* — c'est une DONNÉE, pas
 * une constante de compilation, exactement comme le nom et les couleurs d'une
 * société (L0-09). `lib/clients/code-externe.ts` décide quoi en faire quand
 * elle est absente ; cette fonction-ci ne fait que la lire.
 *
 * **Elle n'avait aucun appelant jusqu'au 14/09/2026.** La colonne existait, la
 * règle était écrite, et rien dans l'application ne l'ouvrait — *une interface
 * sans appelant est la maladie que le portail a soignée*, et c'est très
 * exactement ce que R3-12 mesure.
 *
 * `societe` est de forme « adhésion » (D67) : sous une société active, la clause
 * d'identité ne rend que la ligne de cette société. Aucune comparaison n'est
 * donc écrite ici.
 */
export async function libelleCodeExterneDeLaSociete(
  contexte: ContexteSession,
  client?: PrismaClient,
): Promise<string | null> {
  const societe = await avecContexteApplicatif(
    contexte,
    (tx) => tx.societe.findFirst({ select: { libelle_code_externe: true } }),
    client,
  );
  return societe?.libelle_code_externe ?? null;
}
