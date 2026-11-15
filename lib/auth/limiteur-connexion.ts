import type { PrismaClient } from "@prisma/client";

import { prisma as clientParDefaut } from "@/lib/db/client";
import { uuidv7 } from "@/lib/db/uuid";

import { avecDesignationAuth } from "./lecture-identite";

/**
 * LE LIMITEUR DE TENTATIVES DE CONNEXION (décision d'Alexis du 10/11/2026 ;
 * D258, ticket 9L07-CONNEXION-TENTATIVES-LIMITEES).
 *
 * ## Le problème que ce module répare
 *
 * `/api/session/connexion` (`lib/auth/connexion.ts`) n'avait qu'un plancher de
 * durée (`lib/auth/reponse-uniforme.ts`) : aucune limite au nombre d'essais.
 * Le limiteur intégré à la bibliothèque d'authentification est tenu en
 * mémoire du processus — `lib/auth/config.ts` — et ne protège donc rien sur un
 * hébergement sans état, où chaque requête peut atterrir sur un processus
 * différent.
 *
 * ## Pourquoi une table plutôt qu'un compteur sur `utilisateur`
 *
 * Le refus doit se comporter IDENTIQUEMENT pour un compte inexistant et pour
 * un compte réel (D35) : une colonne sur `utilisateur` ne le permettrait pas,
 * faute de ligne pour un courriel inconnu. `tentative_connexion.identifiant`
 * porte donc le courriel TEL QUE SAISI, normalisé, qu'il désigne ou non un
 * compte réel.
 *
 * ## Pourquoi une ligne par échec, et pas un compteur à réarmer
 *
 * La fenêtre de quinze minutes est GLISSANTE : elle se calcule en comptant les
 * lignes récentes, jamais en relisant un compteur qu'il faudrait remettre à
 * zéro à une date précise — ce qui aurait exigé une tâche planifiée que ce
 * ticket n'ouvre pas. Une ligne vieillit seule ; elle sort seule de la fenêtre.
 *
 * ## Pourquoi le mot de passe n'est jamais vérifié pendant le verrouillage
 *
 * Si une tentative pendant le verrouillage ajoutait une ligne de plus, la
 * fenêtre glisserait sans fin tant que quelqu'un continuerait d'essayer, et le
 * verrouillage ne lèverait jamais. `verrouille` est donc appelée AVANT tout
 * appel à la bibliothèque : verrouillé, aucune ligne n'est ajoutée, et les cinq
 * lignes déjà posées sortent seules de la fenêtre quinze minutes après la
 * dernière d'entre elles.
 */

/**
 * LE SEUIL ET LA FENÊTRE — deux valeurs MÉTIER, décision d'Alexis du
 * 10/11/2026 : « 5 échecs sur un compte → refus temporisé de 15 minutes ».
 * Jamais de réglage inventé ici — ce sont exactement ces deux nombres.
 */
export const SEUIL_ECHECS_CONNEXION = 5;

/** Fenêtre glissante, en secondes. Quinze minutes (décision d'Alexis du 10/11/2026). */
export const FENETRE_ECHECS_CONNEXION_SECONDES = 900;

/** Normalise un courriel saisi en un identifiant stable pour cette table. */
export function identifiantConnexion(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Adresse de l'appelant, lue dans les en-têtes d'une requête entrante.
 *
 * **Extraction volontairement minimale** (décision d'Alexis du 10/11/2026 :
 * « et par adresse IP si c'est simple ») : le premier maillon de
 * `x-forwarded-for`, ou `null`. Aucune dépendance, aucune bibliothèque de
 * plus — la valeur n'a besoin que d'être stable pour une même adresse, jamais
 * d'être démêlée d'un proxy menteur.
 */
export function extraireAdresseIp(entetes: Headers): string | null {
  const brute = entetes.get("x-forwarded-for");
  if (brute === null) {
    return null;
  }
  const premiere = brute.split(",")[0]?.trim();
  return premiere !== undefined && premiere !== "" ? premiere : null;
}

export type SujetLimiteur = {
  /** Le courriel saisi, déjà normalisé par {@link identifiantConnexion}. */
  readonly identifiant: string;
  /** L'adresse de l'appelant, ou `null` si elle n'a pas pu être lue. */
  readonly adresseIp: string | null;
};

/** Début de la fenêtre glissante, pour une horloge donnée. */
function depuis(maintenant: Date): Date {
  return new Date(
    maintenant.getTime() - FENETRE_ECHECS_CONNEXION_SECONDES * 1000,
  );
}

/**
 * Vrai si ce compte, ou cette adresse, a atteint le seuil d'échecs dans la
 * fenêtre glissante — et doit donc être refusé SANS vérifier le mot de passe.
 *
 * `maintenant` est injectée : c'est elle que les scénarios avancent pour
 * éprouver la levée du verrou sans jamais attendre quinze minutes réelles.
 */
export async function verrouille(
  sujet: SujetLimiteur,
  client: PrismaClient = clientParDefaut,
  maintenant: () => Date = () => new Date(),
): Promise<boolean> {
  const depuisDate = depuis(maintenant());

  const parIdentifiant = await avecDesignationAuth(
    client,
  ).tentativeConnexion.count({
    where: { identifiant: sujet.identifiant, survenue_le: { gt: depuisDate } },
  });
  if (parIdentifiant >= SEUIL_ECHECS_CONNEXION) {
    return true;
  }

  if (sujet.adresseIp === null) {
    return false;
  }
  const parAdresse = await avecDesignationAuth(client).tentativeConnexion.count(
    {
      where: { adresse_ip: sujet.adresseIp, survenue_le: { gt: depuisDate } },
    },
  );
  return parAdresse >= SEUIL_ECHECS_CONNEXION;
}

/** Enregistre un échec — un mot de passe refusé, pour ce courriel et cette adresse. */
export async function enregistrerEchec(
  sujet: SujetLimiteur,
  client: PrismaClient = clientParDefaut,
): Promise<void> {
  await avecDesignationAuth(client).tentativeConnexion.create({
    data: {
      id: uuidv7(),
      identifiant: sujet.identifiant,
      adresse_ip: sujet.adresseIp,
    },
  });
}

/** Remet à zéro les échecs d'un compte — une connexion vient de réussir. */
export async function reinitialiserEchecs(
  identifiant: string,
  client: PrismaClient = clientParDefaut,
): Promise<void> {
  await avecDesignationAuth(client).tentativeConnexion.deleteMany({
    where: { identifiant },
  });
}
