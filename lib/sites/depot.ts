import { Prisma, type PrismaClient } from "@prisma/client";

import { type ContexteSession, exigerSocieteActive } from "@/lib/auth/contexte";
import { avecContexteApplicatif } from "@/lib/db/client";
import { uuidv7 } from "@/lib/db/uuid";

import { trierAlphanumeriquement } from "@/lib/tri/collation";

import {
  type CreationSite,
  type ModificationSite,
  type RechercheSite,
} from "./saisie";
import { type CatalogueTrajets, type EcritureTrajetZone } from "./trajet-zone";

/**
 * Les accès au site d'intervention — création, lecture, modification,
 * suppression, recherche (ticket L1-02).
 *
 * **Aucun filtre société n'est écrit ici, et aucun filtre de PÉRIMÈTRE non
 * plus.** Toutes les fonctions passent par `avecContexteApplicatif`, qui ouvre
 * une transaction sous le rôle applicatif NON propriétaire en posant
 * `app.societe_id`, `app.role`, et — pour un compte portail — `app.client_id`
 * et `app.perimetre_sites`. La politique de `site` est de forme « parc » avec
 * les TROIS filtres : société, client, périmètre de sites. Un `findMany` sans
 * `where` ne rend donc que les sites de la société active ; pour un compte
 * portail, ceux de son client ; et si son périmètre est restreint, ceux de son
 * périmètre seulement. C'est RG-DRO-01, tenue par la base.
 *
 * C'est le doublement exigé par I1 : filtre côté serveur — ici le CONTEXTE,
 * qu'aucun chemin applicatif ne peut contourner — ET politique en base.
 *
 * **Les refus sont typés, pas levés.** Un client inexistant ou hors société est
 * une réponse attendue, pas une anomalie technique : il remonte comme un
 * résultat que l'appelant sait rendre, et le texte de l'écran vient du
 * dictionnaire — une exception ne transporte jamais de texte destiné à un
 * humain.
 */

/** Un site tel qu'il est rendu. */
export type FicheSite = {
  id: string;
  client_id: string;
  /** L'agence dont le site dépend — l'ORIGINE de `temps_trajet_min` (D56). */
  agence_id: string;
  libelle: string;
  adresse: Prisma.JsonValue | null;
  commune: string | null;
  zone_geo: string | null;
  latitude: Prisma.Decimal | null;
  longitude: Prisma.Decimal | null;
  consignes_acces: string | null;
  horaires: Prisma.JsonValue | null;
  /**
   * DONNÉE DE PLANIFICATION, ET RIEN D'AUTRE (D74) : charge et tournées. Elle
   * ne s'ajoute jamais aux heures facturées — le déplacement se facture par
   * forfait de zone (RG-INT-07). Un appelant qui l'additionnerait aux heures
   * facturerait le déplacement deux fois.
   */
  temps_trajet_min: number | null;
  actif: boolean;
  /** Sous contrat de maintenance (CONTRAT-SITE-1) — une case, rien de plus. */
  sous_contrat: boolean;
};

/** Colonnes rendues. `societe_id` n'en est pas : l'appelant est déjà dans sa société. */
const CHAMPS_FICHE = {
  id: true,
  client_id: true,
  // `agence_id` est rendu AVEC `temps_trajet_min`, et jamais sans : un nombre
  // dont la signification dépend d'une autre colonne ne voyage pas seul (D56).
  agence_id: true,
  libelle: true,
  adresse: true,
  commune: true,
  zone_geo: true,
  latitude: true,
  longitude: true,
  consignes_acces: true,
  horaires: true,
  temps_trajet_min: true,
  actif: true,
  sous_contrat: true,
} as const;

/**
 * Motif d'un refus. Une CLÉ, jamais une phrase : la couche de rendu choisit son
 * texte au dictionnaire, et un message technique ne se traduit pas.
 *
 * `client_hors_perimetre` couvre DEUX situations que le dépôt ne distingue pas
 * volontairement — le client n'existe pas, et le client appartient à une autre
 * société. Les séparer apprendrait à un appelant qu'un identifiant existe
 * ailleurs, ce que D50 refuse : un message d'erreur est un canal d'information,
 * soumis au cloisonnement comme une requête.
 */
export type MotifRefusSite =
  | "client_hors_perimetre"
  | "agence_hors_societe"
  | "trajet_a_revoir"
  | "fiche_introuvable";

export type ResultatEcriture =
  | { readonly accepte: true; readonly fiche: FicheSite }
  | { readonly accepte: false; readonly motif: MotifRefusSite };

/** Violation de contrainte d'intégrité référentielle — ici, la clé composite. */
const VIOLATION_CLE_ETRANGERE = "P2003";

/** Ligne absente, ou hors du périmètre que la politique laisse voir. */
const ENREGISTREMENT_ABSENT = "P2025";

/** Violation d'une contrainte contrôlée par la base (CHECK, WITH CHECK de RLS). */
const CONTRAINTE_BASE = "P2010";

function motifDeLErreur(erreur: unknown): MotifRefusSite | null {
  if (!(erreur instanceof Prisma.PrismaClientKnownRequestError)) {
    return null;
  }
  // Le déclencheur de D56 est reconnu par la CONTRAINTE qu'il nomme, et non par
  // son texte : le message est destiné à un humain et vit au dictionnaire, il
  // n'a pas à être reconnu par une comparaison de chaîne.
  if (/site_trajet_suit_agence/.test(erreur.message)) {
    return "trajet_a_revoir";
  }
  if (/site_agence_fkey/.test(erreur.message)) {
    return "agence_hors_societe";
  }
  if (
    erreur.code === VIOLATION_CLE_ETRANGERE ||
    erreur.code === CONTRAINTE_BASE
  ) {
    return "client_hors_perimetre";
  }
  if (erreur.code === ENREGISTREMENT_ABSENT) {
    return "fiche_introuvable";
  }
  return null;
}

/**
 * Crée un site pour un client de la société active.
 *
 * L'identifiant est un UUID v7 attribué ICI et non par la base (I10) : c'est la
 * règle qui permettra à l'application mobile d'en générer un hors ligne.
 *
 * **Le client n'est pas vérifié par une requête préalable, et c'est délibéré.**
 * Un `findFirst` suivi d'un `create` laisse une fenêtre entre les deux, et il
 * dupliquerait en TypeScript un contrôle que la clé étrangère composite
 * `(societe_id, client_id)` tient déjà, sans fenêtre. Le refus de la base est
 * traduit en motif ; il n'est pas prévenu.
 */
export async function creerSite(
  contexte: ContexteSession,
  saisie: CreationSite,
): Promise<ResultatEcriture> {
  try {
    const societeId = exigerSocieteActive(contexte);
    const fiche = await avecContexteApplicatif(contexte, (tx) =>
      creerSiteDans(tx, societeId, saisie),
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
 * L'ÉCRITURE ELLE-MÊME, DANS UNE TRANSACTION QUE L'APPELANT TIENT (R6-01).
 *
 * `creerSite` l'appelle, et `appliquerLeLotDeSites` aussi — *un lot s'applique
 * dans UNE transaction, et `creerSite` ouvrirait la sienne par ligne : un lot à
 * moitié écrit serait alors un état que rien ne décrit* (L1-08i).
 *
 * **Elle est EXTRAITE plutôt que recopiée**, ce qui est la parade du §9
 * (01/09) : la seconde implémentation d'un critère n'est jamais gratuite — on
 * la remplace par un appel à la première. *C'est mot pour mot ce que
 * `creerClientDans` a fait à L1-08i, et la raison n'a pas changé d'un mot.*
 */
export async function creerSiteDans(
  tx: Prisma.TransactionClient,
  societeId: string,
  saisie: CreationSite,
): Promise<FicheSite> {
  const { adresse, horaires, ...reste } = saisie;
  return tx.site.create({
    data: {
      id: uuidv7(),
      societe_id: societeId,
      ...reste,
      adresse: adresse ?? Prisma.DbNull,
      horaires: horaires ?? Prisma.DbNull,
    },
    select: CHAMPS_FICHE,
  });
}

/**
 * LA MÊME ÉCRITURE, EN LOT — même raison qu'à `creerClientsEnLot` (session du
 * 16/09/2026, point 1 de la suite — dépassement de délai) : un `create` par
 * ligne coûte un aller-retour par ligne, et c'est ce qui a fait dépasser le
 * délai de la transaction. L'identifiant est fourni par l'appelant :
 * `createMany` ne rend aucune ligne, et l'appelant en a besoin pour tracer
 * chaque ligne d'import (D15, I10).
 */
export async function creerSitesEnLot(
  tx: Prisma.TransactionClient,
  societeId: string,
  lignes: readonly { readonly id: string; readonly saisie: CreationSite }[],
): Promise<void> {
  if (lignes.length === 0) return;
  await tx.site.createMany({
    data: lignes.map(({ id, saisie }) => {
      const { adresse, horaires, ...reste } = saisie;
      return {
        id,
        societe_id: societeId,
        ...reste,
        adresse: adresse ?? Prisma.DbNull,
        horaires: horaires ?? Prisma.DbNull,
      };
    }),
  });
}

/** Lit un site par son identifiant. `null` s'il n'est pas dans le périmètre. */
export async function lireSite(
  contexte: ContexteSession,
  id: string,
): Promise<FicheSite | null> {
  return avecContexteApplicatif(contexte, (tx) =>
    tx.site.findFirst({ where: { id }, select: CHAMPS_FICHE }),
  );
}

/**
 * Modifie un site.
 *
 * Une fiche hors périmètre — autre société, autre client, hors du périmètre de
 * sites d'un compte portail — lève `P2025`, rendu en « introuvable ». Le refus
 * ne dit pas si elle existe ailleurs : un message est un canal d'information,
 * soumis au cloisonnement comme une requête (D50).
 */
export async function modifierSite(
  contexte: ContexteSession,
  id: string,
  saisie: ModificationSite,
): Promise<ResultatEcriture> {
  // `undefined` signifie « ne touche pas à cette colonne », `null` signifie
  // « efface-la ». Prisma distingue les deux par `Prisma.DbNull`, et les
  // confondre effacerait une adresse à chaque modification qui ne la mentionne
  // pas — c'est le défaut trouvé par un test à L1-01.
  try {
    const fiche = await avecContexteApplicatif(contexte, (tx) =>
      modifierSiteDans(tx, id, saisie),
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
 * La MODIFICATION dans une transaction que l'appelant tient — le jumeau de
 * `creerSiteDans`, et pour la même raison (R6-01).
 *
 * *`undefined` signifie « ne touche pas à cette colonne », `null` signifie
 * « efface-la »* : Prisma distingue les deux par `Prisma.DbNull`, et les
 * confondre effacerait une adresse à chaque modification qui ne la mentionne
 * pas — le défaut qu'un test avait trouvé à L1-01.
 */
export async function modifierSiteDans(
  tx: Prisma.TransactionClient,
  id: string,
  saisie: ModificationSite,
): Promise<FicheSite> {
  const { adresse, horaires, ...reste } = saisie;
  return tx.site.update({
    where: { id },
    data: {
      ...reste,
      ...(adresse === undefined ? {} : { adresse: adresse ?? Prisma.DbNull }),
      ...(horaires === undefined
        ? {}
        : { horaires: horaires ?? Prisma.DbNull }),
    },
    select: CHAMPS_FICHE,
  });
}

/**
 * Supprime un site.
 *
 * **La voie ordinaire est la DÉSACTIVATION** — `actif = false` —, parce qu'un
 * lieu cesse d'être visité bien plus souvent qu'il ne cesse d'avoir existé, et
 * parce que ses interventions passées le nomment. La suppression existe pour la
 * fiche créée par erreur, et pour elle seule.
 *
 * **Et elle LAISSE une trace** : `site` est une table métier cloisonnée, donc
 * auditée depuis D55, et le déclencheur écrit les valeurs d'avant dans
 * `journal_audit`. C'est ce qui la rend acceptable — elle est réversible par la
 * lecture.
 */
export async function supprimerSite(
  contexte: ContexteSession,
  id: string,
): Promise<{ readonly accepte: boolean; readonly motif?: MotifRefusSite }> {
  try {
    await avecContexteApplicatif(contexte, (tx) =>
      tx.site.delete({ where: { id } }),
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
 * CE QUE LA RECHERCHE RETIENT — écrit UNE FOIS, et partagé (AT-07).
 *
 * Le texte est cherché dans le libellé, la commune, ET depuis LISTES-1
 * (23/09/2026) dans la raison sociale du CLIENT — trois façons dont un lieu se
 * désigne au téléphone : *« la liste des sites est imbuvable, difficile d'y
 * faire une recherche »*, et chercher un site par le nom de son client est la
 * façon la plus fréquente de le retrouver quand son propre libellé ne dit rien
 * (« Atelier », « Entrepôt »…). **Deux appelants la lisent** : `rechercherSites`
 * (la page) et `compterSites` (le total de la pagination), exactement comme
 * `filtreDeRecherche` de `lib/clients/depot.ts` sert la liste et son
 * compteur — la seconde implémentation d'un critère n'est jamais gratuite
 * (§9, 01/09).
 *
 * **`inclure_sans_equipement: false` filtre les sites sans aucun équipement
 * enregistré** (LISTES-1) — `machines: { some: {} }` est une clause de
 * RELATION, elle ne recompare aucune société : elle porte sur les machines
 * DÉJÀ lues sous le contexte cloisonné de la relation `site.machines`.
 *
 * **`sous_contrat_seulement: true` filtre sur la colonne `sous_contrat`
 * elle-même** (CONTRAT-SITE-1) — pas une clause de relation, une simple
 * comparaison sur `site`, qui se compose avec les critères ci-dessus.
 */
function filtreDeRecherche(criteres: RechercheSite): Prisma.SiteWhereInput {
  const filtreTexte: Prisma.SiteWhereInput =
    criteres.texte === null
      ? {}
      : {
          OR: [
            {
              libelle: {
                contains: criteres.texte,
                mode: Prisma.QueryMode.insensitive,
              },
            },
            {
              commune: {
                contains: criteres.texte,
                mode: Prisma.QueryMode.insensitive,
              },
            },
            {
              client: {
                raison_sociale: {
                  contains: criteres.texte,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
            },
          ],
        };

  return {
    ...filtreTexte,
    ...(criteres.client_id === null ? {} : { client_id: criteres.client_id }),
    ...(criteres.zone_geo === null ? {} : { zone_geo: criteres.zone_geo }),
    ...(criteres.actifs_seulement ? { actif: true } : {}),
    ...(criteres.inclure_sans_equipement ? {} : { machines: { some: {} } }),
    ...(criteres.sous_contrat_seulement ? { sous_contrat: true } : {}),
    ...(criteres.client_actif === true ? { client: { actif: true } } : {}),
  };
}

/**
 * Recherche — une PAGE, désormais (AT-07).
 *
 * **L'ORDRE N'EST PLUS POSÉ PAR `ORDER BY` (LISTES-1, 23/09/2026).** Mesuré
 * en production : la base hébergée classe « AVIS SLAP LOCATOIN » avant
 * « Anse Vata », les majuscules d'abord — une collation d'octets que ce dépôt
 * ne peut ni mesurer à distance ni changer sans migration (§8). L'ordre
 * alphanumérique demandé (`lib/tri/collation.ts`) est donc calculé ICI, sur
 * les IDENTIFIANTS de TOUTE la recherche filtrée — une lecture étroite,
 * `id`+`libelle` seulement, jamais les fiches complètes — puis SEULE la page
 * demandée est relue avec `CHAMPS_FICHE`. Deux requêtes remplacent une seule,
 * mais aucune ne charge le référentiel entier en mémoire : la première ne
 * porte que deux colonnes, la seconde est bornée à `criteres.limite`.
 */
export async function rechercherSites(
  contexte: ContexteSession,
  criteres: RechercheSite,
  client?: PrismaClient,
): Promise<FicheSite[]> {
  const where = filtreDeRecherche(criteres);
  const lignes = await avecContexteApplicatif(
    contexte,
    (tx) => tx.site.findMany({ where, select: { id: true, libelle: true } }),
    client,
  );
  const ordonnees = trierAlphanumeriquement(
    lignes,
    (ligne) => ligne.libelle,
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
      tx.site.findMany({
        where: { id: { in: idsDeLaPage } },
        select: CHAMPS_FICHE,
      }),
    client,
  );
  const parId = new Map(fiches.map((fiche) => [fiche.id, fiche]));
  return idsDeLaPage
    .map((id) => parId.get(id))
    .filter((fiche): fiche is FicheSite => fiche !== undefined);
}

/**
 * COMBIEN DE FICHES CORRESPONDENT À LA RECHERCHE (AT-07) — jamais le compte de
 * la page. La MÊME `filtreDeRecherche` que `rechercherSites`.
 */
export async function compterSites(
  contexte: ContexteSession,
  criteres: RechercheSite,
  client?: PrismaClient,
): Promise<number> {
  return avecContexteApplicatif(
    contexte,
    (tx) => tx.site.count({ where: filtreDeRecherche(criteres) }),
    client,
  );
}

/**
 * LES LIBELLÉS D'UNE LISTE DE SITES — client et rattachement (L3-16).
 *
 * ## Pourquoi une SECONDE lecture et non un `select` élargi
 *
 * `rechercherSites` porte les critères — texte, client, zone, actifs. Les
 * élargir d'une jointure aurait mêlé **ce qu'on cherche** et **ce qu'on
 * affiche** dans une seule requête, et l'écran suivant qui voudra d'autres
 * libellés aurait rouvert le critère. *Ici la recherche reste la recherche*, et
 * les libellés se résolvent sur les identifiants qu'elle a rendus — la forme que
 * `occupationsDuPlanning` emploie déjà pour les agences.
 *
 * **Aucune comparaison de société n'est écrite ici** : on lit sous le contexte,
 * les formes « parc » et « société » décident, et un identifiant hors périmètre
 * rend simplement zéro ligne — donc pas de libellé, et non un libellé d'une
 * autre société.
 */
export async function libellesDesSites(
  contexte: ContexteSession,
  sites: readonly FicheSite[],
  client?: PrismaClient,
): Promise<{
  readonly clients: ReadonlyMap<string, string>;
  readonly agences: ReadonlyMap<string, string>;
}> {
  const clientIds = [...new Set(sites.map((site) => site.client_id))];
  const agenceIds = [...new Set(sites.map((site) => site.agence_id))];
  if (clientIds.length === 0 && agenceIds.length === 0) {
    return { clients: new Map(), agences: new Map() };
  }
  return avecContexteApplicatif(
    contexte,
    async (tx) => {
      const [clients, agences] = await Promise.all([
        tx.client.findMany({
          where: { id: { in: clientIds } },
          select: { id: true, raison_sociale: true },
        }),
        tx.agence.findMany({
          where: { id: { in: agenceIds } },
          select: { id: true, libelle: true },
        }),
      ]);
      return {
        clients: new Map(clients.map((c) => [c.id, c.raison_sociale])),
        agences: new Map(agences.map((a) => [a.id, a.libelle])),
      };
    },
    client,
  );
}

/**
 * COMBIEN D'ÉQUIPEMENTS SONT ENREGISTRÉS SUR CHACUN DE CES SITES (LISTES-1).
 *
 * *« Il faut le temps de trajet + le nombre d'équipement enregistré »*, et
 * *« si le site n'a pas d'équipement enregistré, il faut le filtrer »* — le
 * compte sert les DEUX : l'affichage de la carte, et le filtre par défaut de
 * `filtreDeRecherche`, qui doit compter EXACTEMENT ce que cette fonction
 * compte, sans quoi un site masqué par défaut afficherait pourtant « 0 » à
 * qui lève le masquage — ou l'inverse.
 *
 * `groupBy` plutôt qu'un `findMany` regroupé en mémoire (le choix de
 * `sitesParClient`, juste au-dessus) : ici on ne veut qu'un NOMBRE par site,
 * jamais une colonne supplémentaire, et l'agrégat se fait en base — même
 * discipline que `compterSites` : jamais tout le parc chargé pour un compte.
 */
export async function equipementsParSite(
  contexte: ContexteSession,
  sites: readonly { readonly id: string }[],
  client?: PrismaClient,
): Promise<ReadonlyMap<string, number>> {
  if (sites.length === 0) {
    return new Map();
  }
  const comptes = await avecContexteApplicatif(
    contexte,
    (tx) =>
      tx.machine.groupBy({
        by: ["site_id"],
        where: { site_id: { in: sites.map((site) => site.id) } },
        _count: { _all: true },
      }),
    client,
  );
  return new Map(comptes.map((compte) => [compte.site_id, compte._count._all]));
}

/**
 * COMBIEN D'HABILITATIONS SONT EXIGÉES SUR CHACUN DE CES SITES (PASTILLES-1).
 *
 * Compte TOUTE ligne de `site_habilitation_requise`, bloquante ou non — la
 * demande d'Alexis ne distingue pas les deux pour la pastille, seul
 * `RG-PLA-04` (l'affectation) le fait. Même construction que
 * `equipementsParSite` juste au-dessus : un `groupBy` par lot, jamais une
 * requête par carte.
 */
export async function habilitationsRequisesParSite(
  contexte: ContexteSession,
  sites: readonly { readonly id: string }[],
  client?: PrismaClient,
): Promise<ReadonlyMap<string, number>> {
  if (sites.length === 0) {
    return new Map();
  }
  const comptes = await avecContexteApplicatif(
    contexte,
    (tx) =>
      tx.siteHabilitationRequise.groupBy({
        by: ["site_id"],
        where: { site_id: { in: sites.map((site) => site.id) } },
        _count: { _all: true },
      }),
    client,
  );
  return new Map(comptes.map((compte) => [compte.site_id, compte._count._all]));
}

/**
 * LE CATALOGUE DES TEMPS DE TRAJET PAR ZONE — lecture (R3-03, D107).
 *
 * **Aucune comparaison de société n'est écrite ici**, pas plus qu'ailleurs dans
 * ce module : la politique de `temps_trajet_zone` est de forme « société », et
 * un `findMany` sans `where` ne rend que les lignes de la société active. Une
 * comparaison au-dessus serait une seconde lecture du même critère.
 *
 * Rend une table de correspondance, jamais une liste : l'appelant cherche
 * toujours *« que vaut CETTE zone »*, et la résolution de `trajet-zone.ts` la
 * lit ainsi.
 */
export async function lireCatalogueTrajets(
  contexte: ContexteSession,
  client?: PrismaClient,
): Promise<CatalogueTrajets> {
  const lignes = await avecContexteApplicatif(
    contexte,
    (tx) =>
      tx.tempsTrajetZone.findMany({
        select: { zone: true, minutes: true },
        orderBy: { zone: "asc" },
      }),
    client,
  );
  return new Map(lignes.map((ligne) => [ligne.zone, ligne.minutes]));
}

/**
 * RÉGLER une zone — création ou correction, en une écriture.
 *
 * `upsert` sur `(societe_id, zone)` : *régler une zone est le même geste, qu'on
 * l'ait déjà réglée ou non*, et exiger de l'appelant qu'il sache laquelle des
 * deux opérations faire l'obligerait à lire d'abord — une lecture entre laquelle
 * et l'écriture un second réglage passerait (la leçon de `documents/depot.ts`,
 * où la déduplication se lit dans un refus plutôt que dans un `SELECT`).
 *
 * **La société n'est pas une entrée** : `exigerSocieteActive` la prend au
 * contexte. Une société transmise par l'appelant serait une habilitation
 * auto-déclarée.
 *
 * **Et la zone a déjà été jugée** : `schemaTrajetZone` refuse une zone hors de
 * D23 et une zone sans estimation possible. Ce module écrit, il ne décide pas.
 */
export async function reglerTrajetZone(
  contexte: ContexteSession,
  ecriture: EcritureTrajetZone,
  client?: PrismaClient,
): Promise<void> {
  const societeId = exigerSocieteActive(contexte);
  await avecContexteApplicatif(
    contexte,
    (tx) =>
      tx.tempsTrajetZone.upsert({
        where: {
          societe_id_zone: { societe_id: societeId, zone: ecriture.zone },
        },
        create: {
          id: uuidv7(),
          societe_id: societeId,
          zone: ecriture.zone,
          minutes: ecriture.minutes,
        },
        update: { minutes: ecriture.minutes },
      }),
    client,
  );
}

/**
 * RETIRER le réglage d'une zone — ce qui rend la main au défaut de D107.
 *
 * *Retirer n'écrit pas zéro*, et c'est tout l'objet de cette fonction : zéro se
 * lirait « l'agence est sur place » là où il faut lire « je reviens à la valeur
 * de référence ». La base refuse d'ailleurs zéro.
 *
 * **`deleteMany` et non `delete`** : une zone jamais réglée n'est pas une
 * erreur, et un `delete` aurait levé `P2025` sur un geste idempotent. Le nombre
 * de lignes touchées est rendu pour que l'appelant sache s'il a changé quelque
 * chose, sans que ce soit un refus.
 */
export async function retirerTrajetZone(
  contexte: ContexteSession,
  zone: string,
  client?: PrismaClient,
): Promise<number> {
  const { count } = await avecContexteApplicatif(
    contexte,
    (tx) => tx.tempsTrajetZone.deleteMany({ where: { zone } }),
    client,
  );
  return count;
}
