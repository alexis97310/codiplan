import { Prisma, type PrismaClient } from "@prisma/client";

import { avecContexteApplicatif } from "@/lib/db/client";
import { uuidv7 } from "@/lib/db/uuid";
import { type ContexteSession, exigerSocieteActive } from "@/lib/auth/contexte";
import { normaliserRaisonSociale } from "@/lib/excel/rapprochement";
import { interventionsEmpechantDesactivationDans } from "@/lib/interventions/depot";
import { trierAlphanumeriquement } from "@/lib/tri/collation";

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
export type MotifRefusClient =
  "code_externe_en_double" | "client_introuvable" | "interventions_ouvertes";

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
 *
 * **LE PASSAGE À INACTIF EST REFUSÉ TANT QUE DES INTERVENTIONS RESTENT
 * OUVERTES** (QT-16, D165). *Seul le PASSAGE est jugé, jamais le MAINTIEN* —
 * même précédent que `modifierSite` sur une agence déjà inactive (D134) :
 * l'état actuel est donc relu DANS LA MÊME TRANSACTION avant d'écrire, pour
 * qu'une fiche déjà inactive reste modifiable sur ses autres champs même si
 * elle porte encore des interventions anciennes. Le contrôle et l'écriture
 * voient le même état, sans fenêtre entre les deux (L1-08i).
 */
export async function modifierClient(
  contexte: ContexteSession,
  id: string,
  saisie: ModificationClient,
  client?: PrismaClient,
): Promise<ResultatEcriture> {
  try {
    const resultat = await avecContexteApplicatif(
      contexte,
      async (tx) => {
        if (saisie.actif === false) {
          const actuel = await tx.client.findFirst({
            where: { id },
            select: { actif: true },
          });
          if (actuel !== null && actuel.actif) {
            const bloquantes = await interventionsEmpechantDesactivationDans(
              tx,
              id,
            );
            if (bloquantes.length > 0) {
              return {
                accepte: false as const,
                motif: "interventions_ouvertes" as const,
              };
            }
          }
        }
        const fiche = await modifierClientDans(tx, id, saisie);
        return { accepte: true as const, fiche };
      },
      client,
    );
    return resultat;
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
 * Recherche — la « recherche » du ticket L1-01, élargie par CS2 (03/10/2026).
 *
 * Le texte est cherché dans la raison sociale, le code externe, ET la commune
 * d'un des sites du client — les trois façons dont un ADV désigne un client
 * au téléphone (les deux premières, RG-IMP-05 ; la troisième, promise par
 * l'écran, `lib/i18n/fr.ts`). Les fiches sont rendues par raison sociale, ce
 * qui est l'ordre d'une liste lue par un humain.
 *
 * **Sans accent ni casse, et SANS l'extension `unaccent`** — choix du pilote
 * du 03/10 (`docs/propositions/mesure-cli-dem-03-10.md`, aucun `D`, aucune
 * règle ne change) : une migration pour une extension PostgreSQL n'est pas ce
 * que CS2 a demandé. La comparaison se fait donc ICI, en JavaScript, avec
 * `normaliserRaisonSociale` (`lib/excel/rapprochement.ts`) — la même qui
 * efface déjà accents et casse pour le rapprochement Excel, réutilisée plutôt
 * que recopiée.
 */
/**
 * CE QUE LA RECHERCHE RETIENT — écrit UNE FOIS, et partagé.
 *
 * **Trois appelants le lisent** : la liste, qui rend les fiches ; le compteur
 * du total filtré ; le compteur des fiches sans code externe. *Recopier le
 * critère dans chacun aurait donné trois lectures d'un même critère* (§9,
 * 01/09) — et dans le pire endroit qui soit, puisque les compteurs s'affichent
 * AU-DESSUS du tableau : le lecteur verrait des chiffres côte à côte sans
 * savoir lequel croire, ce qui est exactement le défaut que `resumerLeParc`
 * évite par l'autre voie.
 *
 * **Le texte n'est plus un `WHERE` SQL (CS2)** : la base ne sait comparer
 * sans accent qu'avec une extension que ce ticket ne pose pas (ci-dessus).
 * `filtreSansTexte` reste la clause SQL — état, équipement, périmètre, et le
 * `code_externe: null` du compteur de rapprochement — et
 * `clientsFiltresParTexte` rejoue ENSUITE le texte en JS, sur les candidats
 * que la base a déjà bornés. Les trois appelants passent tous par cette
 * dernière : le total est littéralement `.length` de la liste qu'il compte,
 * jamais un second calcul qui pourrait diverger.
 */
/**
 * `restriction` est le périmètre par personne (QT-2, D152,
 * `perimetreClientDuTechnicien`, `lib/interventions/perimetre-technicien.ts`)
 * — `undefined` sauf pour un technicien restreint sur `consulter_parc_complet`.
 * Composé en `AND`, jamais fondu : même discipline que `filtreDuParc`
 * (`lib/machines/depot.ts`).
 */
function filtreSansTexte(
  criteres: RechercheClient,
  restriction?: Prisma.ClientWhereInput,
  supplementaire?: Prisma.ClientWhereInput,
): Prisma.ClientWhereInput {
  const filtreEtat: Prisma.ClientWhereInput =
    criteres.etat === "tous" ? {} : { actif: criteres.etat === "actifs" };

  // LISTES-1 (23/09/2026) — `machines: { some: {} }` masque les fiches sans
  // aucun équipement enregistré, par défaut ; voir la note de
  // `RechercheClient.inclure_sans_equipement`. Une clause de RELATION, qui ne
  // recompare aucune société.
  const filtreEquipement: Prisma.ClientWhereInput =
    criteres.inclure_sans_equipement ? {} : { machines: { some: {} } };

  // LE LIEN DE LA TUILE « DONNÉES À COMPLÉTER » (9DT-TP-MOD2-INDICATEURS-
  // DONNEES, QT-20, MO-7) — le MÊME critère que `supplementaire` de
  // `compterSansCodeExterne` ci-dessous, posé ici pour que la LISTE
  // (`/clients?sans_code_externe=1`) et le COMPTE partagent une seule
  // écriture du filtre (§9, 01/09).
  const filtreSansCode: Prisma.ClientWhereInput = criteres.sans_code_externe
    ? { code_externe: null }
    : {};

  const base: Prisma.ClientWhereInput = {
    ...filtreEtat,
    ...filtreEquipement,
    ...filtreSansCode,
    ...supplementaire,
  };
  return restriction === undefined ? base : { AND: [base, restriction] };
}

/** Un candidat, avant le filtrage par texte — la lecture reste étroite (CS2). */
type CandidatClient = {
  readonly id: string;
  readonly raison_sociale: string;
  readonly code_externe: string | null;
};

/**
 * LES COMMUNES DES SITES DE CES CANDIDATS, ET D'EUX SEULS (CS2) — jamais
 * toute la table `site` : la lecture reste bornée à ce que la base a déjà
 * filtré par état/équipement/périmètre, exactement le même geste que
 * `sitesParClient` juste plus bas, réduit à la seule colonne qu'il faut ici.
 */
async function communesParClientId(
  contexte: ContexteSession,
  idsCandidats: readonly string[],
  client?: PrismaClient,
): Promise<ReadonlyMap<string, readonly string[]>> {
  if (idsCandidats.length === 0) {
    return new Map();
  }
  const sites = await avecContexteApplicatif(
    contexte,
    (tx) =>
      tx.site.findMany({
        where: { client_id: { in: [...idsCandidats] } },
        select: { client_id: true, commune: true },
      }),
    client,
  );
  const parClient = new Map<string, string[]>();
  for (const site of sites) {
    if (site.commune === null) continue;
    const liste = parClient.get(site.client_id);
    if (liste === undefined) {
      parClient.set(site.client_id, [site.commune]);
    } else {
      liste.push(site.commune);
    }
  }
  return parClient;
}

/**
 * LE CRITÈRE DE RECHERCHE, EN UNE SEULE ÉCRITURE (CS2) — voir le commentaire
 * au-dessus de `filtreSansTexte`. `supplementaire` est le `code_externe: null`
 * de `compterSansCodeExterne`, le seul écart entre les trois appelants.
 */
async function clientsFiltresParTexte(
  contexte: ContexteSession,
  criteres: RechercheClient,
  client: PrismaClient | undefined,
  restriction: Prisma.ClientWhereInput | undefined,
  supplementaire?: Prisma.ClientWhereInput,
): Promise<readonly CandidatClient[]> {
  const where = filtreSansTexte(criteres, restriction, supplementaire);
  const candidats = await avecContexteApplicatif(
    contexte,
    (tx) =>
      tx.client.findMany({
        where,
        select: { id: true, raison_sociale: true, code_externe: true },
      }),
    client,
  );
  if (criteres.texte === null) {
    return candidats;
  }
  const texteNormalise = normaliserRaisonSociale(criteres.texte);
  const communes = await communesParClientId(
    contexte,
    candidats.map((candidat) => candidat.id),
    client,
  );
  return candidats.filter((candidat) =>
    [
      candidat.raison_sociale,
      candidat.code_externe,
      ...(communes.get(candidat.id) ?? []),
    ].some(
      (champ) =>
        champ !== null &&
        normaliserRaisonSociale(champ).includes(texteNormalise),
    ),
  );
}

/**
 * Recherche — une PAGE (AT-07).
 *
 * **L'ORDRE N'EST PLUS POSÉ PAR `ORDER BY` (LISTES-1, 23/09/2026)** — même
 * raison, mot pour mot, qu'à `rechercherSites` : la collation de la base
 * hébergée n'est pas celle que `lib/tri/collation.ts` garantit, et ce dépôt
 * n'a pas le droit de la changer (§8). Les candidats filtrés par
 * `clientsFiltresParTexte` fixent l'ordre de TOUTE la recherche, puis seule la
 * page demandée est relue avec `CHAMPS_FICHE`.
 */
export async function rechercherClients(
  contexte: ContexteSession,
  criteres: RechercheClient,
  client?: PrismaClient,
  restriction?: Prisma.ClientWhereInput,
): Promise<FicheClient[]> {
  const lignes = await clientsFiltresParTexte(
    contexte,
    criteres,
    client,
    restriction,
  );
  const ordonnees = trierAlphanumeriquement(
    lignes,
    (ligne) => ligne.raison_sociale,
    (ligne) => ligne.id,
  );
  const debut = (criteres.page - 1) * criteres.limite;
  const idsDeLaPage = ordonnees
    .slice(debut, debut + criteres.limite)
    .map((ligne) => ligne.id);
  if (idsDeLaPage.length === 0) {
    return [];
  }
  const fiches = await avecContexteApplicatif(
    contexte,
    (tx) =>
      tx.client.findMany({
        where: { id: { in: idsDeLaPage } },
        select: CHAMPS_FICHE,
      }),
    client,
  );
  const parId = new Map(fiches.map((fiche) => [fiche.id, fiche]));
  return idsDeLaPage
    .map((id) => parId.get(id))
    .filter((fiche): fiche is FicheClient => fiche !== undefined);
}

/**
 * COMBIEN DE FICHES CORRESPONDENT À LA RECHERCHE (AT-07) — jamais le compte de
 * la page.
 *
 * **Le total est `.length` de la MÊME liste que `rechercherClients` pagine**
 * (CS2) : les deux passent par `clientsFiltresParTexte`, donc un total qui ne
 * compterait pas ce que la liste montre est désormais structurellement
 * impossible, pas seulement surveillé par un test. *Une pagination qui
 * compterait autrement que la liste qu'elle pagine est la faute nommée par le
 * directeur d'exploitation le 16/09 : « 50 clients » sous une liste qui en
 * compte 619 se lit comme une mesure.*
 */
export async function compterClients(
  contexte: ContexteSession,
  criteres: RechercheClient,
  client?: PrismaClient,
  restriction?: Prisma.ClientWhereInput,
): Promise<number> {
  const lignes = await clientsFiltresParTexte(
    contexte,
    criteres,
    client,
    restriction,
  );
  return lignes.length;
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
  const lignes = await clientsFiltresParTexte(
    contexte,
    criteres,
    client,
    undefined,
    { code_externe: null },
  );
  return lignes.length;
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
 * COMBIEN D'ÉQUIPEMENTS SONT ENREGISTRÉS CHEZ CHACUN DE CES CLIENTS
 * (LISTES-1) — même raison, même forme que `equipementsParSite` de
 * `lib/sites/depot.ts` : le compte sert l'affichage de la carte ET le filtre
 * par défaut de `filtreDeRecherche`, qui doit compter EXACTEMENT la même
 * chose.
 */
export async function equipementsParClient(
  contexte: ContexteSession,
  clients: readonly { readonly id: string }[],
  client?: PrismaClient,
): Promise<ReadonlyMap<string, number>> {
  if (clients.length === 0) {
    return new Map();
  }
  const comptes = await avecContexteApplicatif(
    contexte,
    (tx) =>
      tx.machine.groupBy({
        by: ["client_id"],
        where: { client_id: { in: clients.map((c) => c.id) } },
        _count: { _all: true },
      }),
    client,
  );
  return new Map(
    comptes.map((compte) => [compte.client_id, compte._count._all]),
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
