import { AsyncLocalStorage } from "node:async_hooks";

/**
 * L'ÉCHANGE D'AUTHENTIFICATION — ce qu'un appelant a déjà nommé, et qui reste
 * vrai jusqu'au bout de la requête (ticket D62).
 *
 * ## Le défaut que ce module répare, et il était mesuré avant d'être réparé
 *
 * La bibliothèque lit une ligne par sa clé de désignation, puis **réécrit celle
 * qu'elle vient d'obtenir en la nommant par son `id`**. Mesuré sur les huit flux
 * réels : 69 opérations, dont **7 nomment un `id`, et les 7 sont des
 * ÉCRITURES**. Aucune lecture, dans aucun flux, ne désigne par `id`.
 *
 * Or `id` n'est une clé de désignation d'aucune de ces tables. L'enveloppe ne
 * posait donc **aucune** variable, la politique lisait une chaîne vide, et
 * l'écriture était refusée en silence — zéro ligne, aucune erreur. Conséquences
 * mesurées : le défi de second facteur ne se consommait jamais, si bien qu'un
 * compte enrôlé **ne pouvait plus se connecter du tout** ; le code de secours
 * échouait en `409` après avoir été validé ; et le compteur d'échecs de D62 ne
 * s'incrémentait jamais.
 *
 * ## Ce qui est reporté, et ce qui ne l'est pas
 *
 * *L'`id` ouvre les ÉCRITURES, jamais les LECTURES* — arbitrage d'exploitation
 * du 08/09/2026, et la mesure le dictait : puisque aucune lecture ne désigne par
 * `id`, en ouvrir une serait élargir sans nécessité. Une lecture par `id` ne
 * reçoit donc **aucun** report et reste refusée.
 *
 * ## LA COMPOSITION EST LE CŒUR, ET ELLE N'AJOUTE AUCUNE POLITIQUE
 *
 * Le danger d'une désignation par `id` n'est pas la devinette — `uuidv7()`
 * laisse 74 bits aléatoires sur 128 — c'est la **rejouabilité** : un `id` sorti
 * d'une trace, d'un journal ou d'une URL peut resservir, et une écriture sur
 * `second_facteur` désignée par un `id` rejoué serait la reprise du facteur de
 * quelqu'un d'autre.
 *
 * La clause compose donc deux choses, et **elle existait déjà en base** :
 *
 * | Table | Ce que le `where` dit | Ce que la politique exige |
 * |---|---|---|
 * | `second_facteur` | QUELLE ligne (`id`) | à QUI elle est (`utilisateur_id = app.authentification_utilisateur_id`) |
 * | `verification` | QUELLE ligne (`id`) | quel SECRET l'ouvre (`identifiant = app.authentification_identifiant`) |
 *
 * Un `id` valide appartenant à un AUTRE compte, présenté par un compte
 * authentifié, échoue donc sur la seconde moitié. C'est éprouvé nommément —
 * `tests/isolation/rejeu-designation.test.ts` — et son jumeau retire le report
 * pour montrer que la ligne d'autrui redevient inatteignable *et* que la
 * connexion cesse de fonctionner.
 *
 * ## CE QUI N'EST PAS EXPRIMABLE, ET QUI EST DIT PLUTÔT QUE HABILLÉ
 *
 * Sur `second_facteur`, la seconde moitié est bien **l'appartenance au compte** :
 * la colonne existe. Sur `verification`, **elle ne l'est pas** — la table n'a pas
 * de colonne de compte, et le lien passe par `valeur`, qui ne porte
 * l'identifiant de l'utilisateur que pour *certaines* lignes : mesuré, la ligne
 * `2fa-attempts-…` porte un **compteur** (`"0"`), pas un compte. Une clause
 * « `valeur` = le compte » casserait donc le décompte des tentatives.
 *
 * Ce qui compose sur `verification` est l'**identifiant opaque déjà présenté** —
 * vingt caractères aléatoires portés par un cookie signé, c'est-à-dire un
 * secret, là où un `id` n'en est pas un. C'est au moins aussi fort pour le cas
 * du rejeu, et ce n'est pas la même garantie : il faut le lire ainsi.
 *
 * ## POURQUOI CE MÉCANISME ÉCHOUE DU BON CÔTÉ
 *
 * Le report ne vit que dans un **échange** ouvert explicitement. Un point
 * d'entrée qui oublierait de l'ouvrir ne recevrait aucun report : l'écriture par
 * `id` serait refusée, et la fonctionnalité cesserait de marcher. **Oublier la
 * frontière casse, ça n'ouvre jamais.** C'est le seul sens de défaillance
 * acceptable pour un mécanisme de ce genre, et c'est ce qui rend la liste close
 * ci-dessous gardable sans être une promesse.
 *
 * Le contexte asynchrone est celui de Node (`AsyncLocalStorage`) : il suit les
 * promesses d'une même requête et ne traverse jamais deux requêtes
 * concurrentes. Un scénario le mesure plutôt que de le supposer.
 *
 * ## Ce module ne NOMME aucune variable
 *
 * Il transporte des paires opaques `{ variable, valeur }` produites par
 * `lib/auth/lecture-identite.ts`, seul endroit où une désignation se lit depuis
 * le `where` d'une requête. Le gardien de L1-02e
 * (`tests/unit/auth/pose-de-designation.test.ts`) garde donc une liste close
 * INCHANGÉE : ce fichier ne pose rien, il se souvient.
 */

/** Une variable de désignation et la valeur qu'une requête lui a donnée. */
export type DesignationReportee = {
  readonly variable: string;
  readonly valeur: string;
};

/** L'état d'un échange : ce qui y a déjà été désigné, par variable. */
type Echange = Map<string, string>;

const stockage = new AsyncLocalStorage<Echange>();

/**
 * Ouvre un échange d'authentification.
 *
 * Un échange = **une requête entrante**, ou un acte d'authentification côté
 * serveur. Les échanges ne s'emboîtent pas : un échange déjà ouvert est
 * réutilisé, pour qu'une route qui appelle deux aides ne fabrique pas deux
 * échanges dont le second perdrait ce que le premier savait.
 */
export function dansUnEchangeAuth<T>(travail: () => Promise<T>): Promise<T> {
  const ouvert = stockage.getStore();
  if (ouvert !== undefined) {
    return travail();
  }
  return stockage.run(new Map(), travail);
}

/** Vrai si un échange est ouvert — mesuré par les scénarios, pas supposé. */
export function echangeOuvert(): boolean {
  return stockage.getStore() !== undefined;
}

/**
 * Retient ce qu'une opération vient de désigner.
 *
 * Appelé par `lib/auth/lecture-identite.ts` avec ce qu'il a lu dans le `where` —
 * jamais avec une valeur venue d'ailleurs.
 */
export function retenirDesignations(
  designations: readonly DesignationReportee[],
): void {
  const echange = stockage.getStore();
  if (echange === undefined) {
    return;
  }
  for (const designation of designations) {
    echange.set(designation.variable, designation.valeur);
  }
}

/** Ce que l'échange a déjà retenu, vide hors d'un échange. */
export function designationsReportees(): DesignationReportee[] {
  const echange = stockage.getStore();
  if (echange === undefined) {
    return [];
  }
  return [...echange].map(([variable, valeur]) => ({ variable, valeur }));
}
