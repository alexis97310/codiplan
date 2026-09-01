import { Prisma } from "@prisma/client";

import { avecContexteApplicatif } from "@/lib/db/client";
import { uuidv7 } from "@/lib/db/uuid";
import { type ContexteSession } from "@/lib/auth/contexte";

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
    const fiche = await avecContexteApplicatif(contexte, (tx) =>
      tx.client.create({
        data: {
          id: uuidv7(),
          // `societe_id` est repris du contexte validé par
          // `avecContexteApplicatif` : la politique le réclamerait de toute
          // façon en `WITH CHECK`, mais l'écrire ici garde la première barrière
          // là où I1 la veut — côté serveur.
          societe_id: exigerSocieteActive(contexte),
          ...saisie,
          adresse_facturation: saisie.adresse_facturation ?? Prisma.DbNull,
        },
        select: CHAMPS_FICHE,
      }),
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
  // L'adresse est extraite du reste : `undefined` signifie « ne touche pas à
  // cette colonne », `null` signifie « efface-la ». Prisma distingue les deux
  // par `Prisma.DbNull`, et les confondre effacerait une adresse à chaque
  // modification qui ne la mentionne pas.
  const { adresse_facturation: adresse, ...reste } = saisie;

  try {
    const fiche = await avecContexteApplicatif(contexte, (tx) =>
      tx.client.update({
        where: { id },
        data: {
          ...reste,
          ...(adresse === undefined
            ? {}
            : { adresse_facturation: adresse ?? Prisma.DbNull }),
        },
        select: CHAMPS_FICHE,
      }),
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
 * **Point ouvert, et il est écrit plutôt que tu :** `client` ne figure pas au
 * périmètre d'audit de I8 (`scripts/lib/perimetre-audit.ts`, liste close des
 * deux côtés), si bien qu'une suppression ne laisse aucune trace. L'y faire
 * entrer est un arbitrage, pas une décision de ticket — la revue R0 l'a relevé
 * en propre (écart É-b).
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
export async function rechercherClients(
  contexte: ContexteSession,
  criteres: RechercheClient,
): Promise<FicheClient[]> {
  const filtreTexte =
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

  return avecContexteApplicatif(contexte, (tx) =>
    tx.client.findMany({
      where: {
        ...filtreTexte,
        ...(criteres.actifs_seulement ? { actif: true } : {}),
      },
      orderBy: [{ raison_sociale: "asc" }, { id: "asc" }],
      take: criteres.limite,
      select: CHAMPS_FICHE,
    }),
  );
}

/**
 * La société active, ou une exception technique.
 *
 * `avecContexteApplicatif` refuse déjà un contexte sans société — ce contrôle
 * est là pour que le TYPE soit `string` et non `string | null` au moment
 * d'écrire `societe_id`. Le message est destiné à un développeur : il ne passe
 * pas par le dictionnaire (`lib/i18n/fr.ts`, la coupure).
 */
function exigerSocieteActive(contexte: ContexteSession): string {
  if (contexte.societeId === null) {
    throw new Error(
      "Aucune société active : `avecContexteApplicatif` aurait dû refuser " +
        "cette transaction avant d'en arriver ici.",
    );
  }
  return contexte.societeId;
}
