import { Prisma, type PrismaClient } from "@prisma/client";

import { type ContexteSession, exigerSocieteActive } from "@/lib/auth/contexte";
import { avecContexteApplicatif } from "@/lib/db/client";
import { uuidv7 } from "@/lib/db/uuid";
import { trierAlphanumeriquement } from "@/lib/tri/collation";

import {
  exigeCourriel,
  type CreationContact,
  type ModificationContact,
} from "./saisie";

/**
 * LE CHEMIN D'ÉCRITURE DES CONTACTS (CONTACTS-1).
 *
 * `lib/contacts/saisie.ts` (L1-03) pose déjà toute la validation — rôles clos,
 * canaux clos, la dépendance courriel/canal e-mail — et la table, ses
 * contraintes et sa politique RLS existent depuis la même migration. **Rien
 * n'écrivait `contact`.** Ce module ouvre les trois écritures — création,
 * modification, bascule d'activité — sur la forme de
 * `lib/habilitations/depot.ts`.
 *
 * **Aucun filtre société ni périmètre n'est écrit ici** : `avecContexteApplicatif`
 * pose le contexte, et la politique « parc » de `contact` — société, client,
 * et la disjonction qui laisse voir un contact sans site quel que soit le
 * périmètre — décide (I1).
 */

/** Un contact tel qu'un écran le lit. */
export type FicheContact = {
  readonly id: string;
  readonly client_id: string;
  /** `null` = contact du client, sans rattachement à un site. */
  readonly site_id: string | null;
  readonly nom: string;
  readonly fonction: string | null;
  readonly telephone: string | null;
  readonly mobile: string | null;
  readonly email: string | null;
  readonly roles: readonly string[];
  readonly canaux: readonly string[];
  readonly actif: boolean;
};

const CHAMPS_FICHE = {
  id: true,
  client_id: true,
  site_id: true,
  nom: true,
  fonction: true,
  telephone: true,
  mobile: true,
  email: true,
  roles: true,
  canaux: true,
  actif: true,
} as const;

/**
 * Motif d'un refus. Une CLÉ, jamais une phrase (D50) : la couche de rendu
 * choisit son texte au dictionnaire.
 *
 * `client_hors_perimetre` couvre le client inexistant et le client d'une autre
 * société — les distinguer apprendrait à un appelant qu'un identifiant existe
 * ailleurs (D50). `site_hors_client` couvre de même le site inexistant et le
 * site d'un AUTRE client — `contact_site_du_client_fkey` porte le triplet
 * (société, client, site) et ne distingue pas les deux non plus.
 *
 * `courriel_requis_pour_canal_email` (CS43) : vider le courriel d'un contact
 * encore notifié par ce canal. `modifierContact` le refuse AVANT d'écrire ;
 * `motifDeLErreur` le reconnaît aussi, en filet, si la contrainte
 * `contact_courriel_si_canal_email` est atteinte par un autre chemin.
 */
export type MotifRefusContact =
  | "client_hors_perimetre"
  | "site_hors_client"
  | "introuvable"
  | "courriel_requis_pour_canal_email";

export type ResultatContact =
  | { readonly accepte: true; readonly fiche: FicheContact }
  | { readonly accepte: false; readonly motif: MotifRefusContact };

/** Violation de contrainte d'intégrité référentielle (les deux clés composites). */
const VIOLATION_CLE_ETRANGERE = "P2003";

/** Ligne absente, ou hors du périmètre que la politique laisse voir. */
const ENREGISTREMENT_ABSENT = "P2025";

function motifDeLErreur(erreur: unknown): MotifRefusContact | null {
  if (!(erreur instanceof Prisma.PrismaClientKnownRequestError)) {
    return null;
  }
  // Le nom de la contrainte est reconnu, jamais son texte destiné à un humain
  // (le texte vit au dictionnaire).
  if (/contact_site_du_client_fkey/.test(erreur.message)) {
    return "site_hors_client";
  }
  if (
    /contact_client_fkey/.test(erreur.message) ||
    erreur.code === VIOLATION_CLE_ETRANGERE
  ) {
    return "client_hors_perimetre";
  }
  if (/contact_courriel_si_canal_email/.test(erreur.message)) {
    return "courriel_requis_pour_canal_email";
  }
  if (erreur.code === ENREGISTREMENT_ABSENT) {
    return "introuvable";
  }
  return null;
}

/**
 * CRÉE un contact pour un client de la société active.
 *
 * L'identifiant est un UUID v7 attribué ICI (I10). **Le client et le site ne
 * sont pas vérifiés par une lecture préalable** : les clés étrangères
 * composites `contact_client_fkey` et `contact_site_du_client_fkey` tiennent
 * déjà les deux contrôles, sans la fenêtre qu'un `findFirst` puis `create`
 * ouvrirait — même raisonnement que `creerSite`.
 */
export async function creerContact(
  contexte: ContexteSession,
  saisie: CreationContact,
  client?: PrismaClient,
): Promise<ResultatContact> {
  try {
    const societeId = exigerSocieteActive(contexte);
    const fiche = await avecContexteApplicatif(
      contexte,
      (tx) =>
        tx.contact.create({
          data: {
            id: uuidv7(),
            societe_id: societeId,
            client_id: saisie.client_id,
            site_id: saisie.site_id,
            nom: saisie.nom,
            fonction: saisie.fonction,
            telephone: saisie.telephone,
            mobile: saisie.mobile,
            email: saisie.email,
            roles: [...saisie.roles],
            canaux: [...saisie.canaux],
          },
          select: CHAMPS_FICHE,
        }),
      client,
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

type EtapeModification =
  | { readonly etat: "ok"; readonly fiche: FicheContact }
  | { readonly etat: "absent" }
  | { readonly etat: "refus_courriel" };

/**
 * MODIFIE un contact.
 *
 * `updateMany` plutôt que `update`, comme `modifierHabilitation` : zéro ligne
 * touchée n'est pas une erreur technique, c'est la politique qui a refusé — un
 * identifiant hors périmètre et un identifiant inconnu rendent le MÊME refus
 * (D35, D50). `client_id` n'est pas modifiable (`saisie.ts`) ; `site_id` l'est,
 * et porte le même contrôle référentiel qu'à la création.
 *
 * **CS43** : ce formulaire ne soumet jamais `canaux` (`saisie-recue.ts`), donc
 * `exigerCourrielSiCanalEmail` de `saisie.ts` ne joue jamais ici — elle ne voit
 * que l'entrée, jamais ce qui est déjà en base. La RÈGLE est pourtant la même
 * (`exigeCourriel`) : avant d'écrire, on la rejoue sur l'état EFFECTIF — le
 * canal déjà enregistré, le courriel soumis s'il l'est, celui déjà enregistré
 * sinon — et on refuse SANS écrire plutôt que de laisser la contrainte
 * `contact_courriel_si_canal_email` lever une erreur non reconnue (l'ancien
 * 500). Si le contact n'existe pas dans le périmètre, on laisse tomber au
 * même refus « introuvable » qu'avant, par le chemin `updateMany` existant.
 */
export async function modifierContact(
  contexte: ContexteSession,
  id: string,
  saisie: ModificationContact,
  client?: PrismaClient,
): Promise<ResultatContact> {
  try {
    const etape = await avecContexteApplicatif(
      contexte,
      async (tx): Promise<EtapeModification> => {
        if (saisie.email !== undefined || saisie.canaux !== undefined) {
          const existant = await tx.contact.findFirst({
            where: { id },
            select: { email: true, canaux: true },
          });
          if (existant !== null) {
            const canauxEffectifs = saisie.canaux ?? existant.canaux;
            const emailEffectif =
              saisie.email === undefined ? existant.email : saisie.email;
            if (exigeCourriel(canauxEffectifs) && !emailEffectif) {
              return { etat: "refus_courriel" };
            }
          }
        }
        const touchees = await tx.contact.updateMany({
          where: { id },
          data: {
            site_id: saisie.site_id,
            nom: saisie.nom,
            fonction: saisie.fonction,
            telephone: saisie.telephone,
            mobile: saisie.mobile,
            email: saisie.email,
            roles: saisie.roles === undefined ? undefined : [...saisie.roles],
            canaux:
              saisie.canaux === undefined ? undefined : [...saisie.canaux],
            actif: saisie.actif,
          },
        });
        if (touchees.count === 0) {
          return { etat: "absent" };
        }
        const fiche = await tx.contact.findFirstOrThrow({
          where: { id },
          select: CHAMPS_FICHE,
        });
        return { etat: "ok", fiche };
      },
      client,
    );
    if (etape.etat === "refus_courriel") {
      return { accepte: false, motif: "courriel_requis_pour_canal_email" };
    }
    return etape.etat === "absent"
      ? { accepte: false, motif: "introuvable" }
      : { accepte: true, fiche: etape.fiche };
  } catch (erreur: unknown) {
    const motif = motifDeLErreur(erreur);
    if (motif === null) {
      throw erreur;
    }
    return { accepte: false, motif };
  }
}

/**
 * BASCULE L'ACTIVITÉ — la seule façon de retirer un contact des listes
 * courantes. Comme les habilitations et les sites : pas de suppression, un
 * interlocuteur parti se désactive, et son historique (`demande.contact_id`)
 * continue de le désigner.
 */
export async function basculerActiviteContact(
  contexte: ContexteSession,
  id: string,
  actif: boolean,
  client?: PrismaClient,
): Promise<ResultatContact> {
  const fiche = await avecContexteApplicatif(
    contexte,
    async (tx) => {
      const touchees = await tx.contact.updateMany({
        where: { id },
        data: { actif },
      });
      if (touchees.count === 0) {
        return null;
      }
      return tx.contact.findFirstOrThrow({
        where: { id },
        select: CHAMPS_FICHE,
      });
    },
    client,
  );
  return fiche === null
    ? { accepte: false, motif: "introuvable" }
    : { accepte: true, fiche };
}

/**
 * LES CONTACTS D'UN CLIENT — tous, qu'ils soient du client (`site_id` nul) ou
 * d'un de ses sites. C'est la lecture de la fiche client : *elle montre QUI
 * appeler chez ce client, quel que soit le lieu.*
 *
 * **Triés en JS, jamais par `ORDER BY`** (CS19, LISTES-1) : une liste de
 * référentiel suit l'ordre alphanumérique de `lib/tri/collation.ts`, pas la
 * collation de la base qui répond.
 */
export async function contactsDuClient(
  contexte: ContexteSession,
  clientId: string,
  client?: PrismaClient,
): Promise<readonly FicheContact[]> {
  const contacts = await avecContexteApplicatif(
    contexte,
    (tx) =>
      tx.contact.findMany({
        where: { client_id: clientId },
        select: CHAMPS_FICHE,
      }),
    client,
  );
  return trierAlphanumeriquement(
    contacts,
    (contact) => contact.nom,
    (contact) => contact.id,
  );
}

/**
 * LES CONTACTS D'UN SITE — uniquement ceux rattachés à CE site, jamais ceux du
 * client sans site ni ceux d'un autre site du même client. C'est la lecture de
 * la fiche site : *elle montre qui appeler pour CE lieu précisément.*
 *
 * Même tri JS que `contactsDuClient` ci-dessus (CS19, LISTES-1).
 */
export async function contactsDuSite(
  contexte: ContexteSession,
  siteId: string,
  client?: PrismaClient,
): Promise<readonly FicheContact[]> {
  const contacts = await avecContexteApplicatif(
    contexte,
    (tx) =>
      tx.contact.findMany({
        where: { site_id: siteId },
        select: CHAMPS_FICHE,
      }),
    client,
  );
  return trierAlphanumeriquement(
    contacts,
    (contact) => contact.nom,
    (contact) => contact.id,
  );
}
