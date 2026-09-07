import { describe, expect, it } from "vitest";

import {
  VARIABLE_SESSION_AUTH_EMAIL,
  VARIABLE_SESSION_AUTH_IDENTIFIANT,
  VARIABLE_SESSION_AUTH_JETON,
  VARIABLE_SESSION_AUTH_UTILISATEUR,
} from "@/lib/db/rls";

import { fichiersSource, sansCommentaires } from "../outils/fichiers-source";

/**
 * LA POSE D'UNE DÉSIGNATION NE S'ÉCRIT QUE LÀ OÙ LE CONTEXTE SE COMPOSE
 * (ticket L1-02e).
 *
 * ## Ce que ce gardien tient, et ce qu'il ne peut pas tenir
 *
 * La forme « désignation » ne vaut que parce que la valeur posée est celle que
 * l'appelant **nommait déjà** : le courriel qu'il vient de saisir, le jeton
 * qu'il présente, l'identifiant que la session porte. Elle ne rend jamais plus
 * que ce qu'il savait avant d'interroger.
 *
 * **Cette propriété tient à ce qu'aucun chemin ne laisse CHOISIR la valeur — et
 * un invariant qui repose sur ce qu'aucun ticket futur ne fera est un invariant
 * qui tombera, sans bruit.** Il est pourtant à moitié gardable, et c'est la
 * moitié qui compte : *d'où* la variable est posée. Un chemin de requête qui
 * poserait `app.authentification_utilisateur_id` depuis un paramètre d'URL
 * n'aurait plus rien d'une désignation — ce serait un identifiant choisi par
 * l'extérieur, et la politique le croirait sur parole.
 *
 * Ce gardien refuse donc que la pose s'écrive ailleurs que dans les fichiers
 * qui **composent le contexte**. Le cas qu'il attrape est nommé : quelqu'un
 * qui, dans six mois, posera la variable « juste pour ce cas ».
 *
 * **Ce qu'il ne tient PAS, et qui s'écrit dans la borne de la forme plutôt que
 * dans un motif** : que la valeur soit dérivée d'un contexte authentifié. Aucun
 * motif statique ne peut le décider — il faudrait suivre la provenance d'une
 * chaîne. C'est écrit au CLAUDE.md, au pied de I1, à l'endroit où quelqu'un le
 * lira avant d'ajouter un chemin, et en tête de `lib/auth/lecture-identite.ts`.
 *
 * ## La population, et le piège du 31/08
 *
 * Le critère de sélection ne porte sur RIEN de ce que le gardien fait
 * respecter : il retient **tous** les fichiers des répertoires applicatifs, et
 * fait de « ne nomme pas une variable de désignation » une **assertion**. Un
 * fichier qui la nomme ne sort donc pas de la population — il la fait échouer.
 *
 * ## Les six formes du 26/08, et celle qui reste hors de portée
 *
 * Le périmètre examiné retire les **commentaires** — la seule coupure légitime
 * est « documentation contre exécution » (D50), et ces trois modules citent les
 * noms des variables dans leur prose, ce qui est exactement ce qu'on veut
 * d'eux. Il ne retire **jamais** les chaînes littérales : une pose écrite dans
 * un `$executeRawUnsafe` est du texte, et c'est justement la forme qu'elle
 * prendrait. Les deux graphies sont surveillées — le nom **littéral** de la
 * variable (`app.authentification_…`) et la **constante** exportée qui le
 * porte —, parce qu'un chemin fautif écrirait naturellement l'une ou l'autre.
 *
 * Hors de portée, et dit plutôt que tu : l'assemblage délibéré du nom à
 * l'exécution (`"app.authentification_" + champ`). Un gardien statique arrête
 * la correction bien intentionnée, pas un contournement décidé.
 */

/** Les répertoires APPLICATIFS. `tests/` doit pouvoir éprouver les politiques. */
const REPERTOIRES = ["app", "components", "lib", "prisma", "scripts"];

/**
 * LES FICHIERS QUI COMPOSENT LE CONTEXTE — liste close, et elle est courte
 * parce que c'est tout son intérêt.
 *
 *   - `lib/db/rls.ts` déclare les noms et **remet les quatre variables à vide**
 *     à chaque contexte ordinaire. C'est leur pose la plus importante : celle
 *     qui REFERME.
 *   - `lib/auth/lecture-identite.ts` les renseigne, et **uniquement depuis le
 *     `where` de la requête Prisma** — c'est-à-dire depuis ce que l'appelant
 *     nommait déjà.
 *
 * Y ajouter une entrée est un arbitrage : c'est ouvrir une clé d'accès aux
 * tables d'authentification depuis un chemin de plus.
 */
const COMPOSITEURS: readonly string[] = [
  "lib/db/rls.ts",
  "lib/auth/lecture-identite.ts",
];

/** Les quatre variables, sous leurs deux graphies. */
const VARIABLES: readonly string[] = [
  VARIABLE_SESSION_AUTH_EMAIL,
  VARIABLE_SESSION_AUTH_UTILISATEUR,
  VARIABLE_SESSION_AUTH_JETON,
  VARIABLE_SESSION_AUTH_IDENTIFIANT,
];

const CONSTANTES: readonly string[] = [
  "VARIABLE_SESSION_AUTH_EMAIL",
  "VARIABLE_SESSION_AUTH_UTILISATEUR",
  "VARIABLE_SESSION_AUTH_JETON",
  "VARIABLE_SESSION_AUTH_IDENTIFIANT",
];

/** Ce qu'un fichier nomme d'une désignation, une fois sa prose retirée. */
function designationsNommees(contenu: string): string[] {
  const code = sansCommentaires(contenu);
  return [...VARIABLES, ...CONSTANTES].filter((nom) => code.includes(nom));
}

describe("la pose d'une désignation ne s'écrit que là où le contexte se compose", () => {
  const fichiers = fichiersSource(REPERTOIRES);

  it("parcourt bien des fichiers — sinon le gardien serait vide", () => {
    expect(fichiers.length).toBeGreaterThan(10);
  });

  it("les fichiers de la liste close existent — une exemption s'adosse à quelque chose", () => {
    // Corollaire du 31/08 : une exemption qui nomme un fichier disparu ne
    // protège plus rien, silencieusement, et le premier fichier qui reprendra
    // ce nom héritera d'une exemption que personne ne lui a accordée.
    const connus = new Set(fichiers.map((fichier) => fichier.chemin));
    for (const compositeur of COMPOSITEURS) {
      expect(connus.has(compositeur), `${compositeur} n'existe plus`).toBe(
        true,
      );
    }
  });

  it("et ils nomment bien les variables — le gardien porte sur quelque chose", () => {
    // TÉMOIN DE NON-VACUITÉ. Sans lui, un motif devenu aveugle — une constante
    // renommée, un module scindé — rendrait « aucun fautif » et passerait pour
    // un sans-faute. Un décompte nul ressemble toujours à un sans-faute.
    for (const compositeur of COMPOSITEURS) {
      const fichier = fichiers.find((f) => f.chemin === compositeur);
      expect(designationsNommees(fichier!.contenu).length).toBeGreaterThan(0);
    }
  });

  it("aucun autre fichier applicatif ne nomme une variable de désignation", () => {
    const fautifs = fichiers
      .filter((fichier) => !COMPOSITEURS.includes(fichier.chemin))
      .map((fichier) => ({
        chemin: fichier.chemin,
        noms: designationsNommees(fichier.contenu),
      }))
      .filter((fichier) => fichier.noms.length > 0)
      .map((fichier) => `${fichier.chemin} → ${fichier.noms.join(", ")}`);

    expect(
      fautifs,
      "une variable de désignation est posée hors des fichiers qui composent " +
        "le contexte. La forme « désignation » ne tient que si la valeur est " +
        "celle que l'appelant nommait DÉJÀ : posée depuis un chemin de " +
        "requête, elle laisse choisir la ligne à lire. Voir CLAUDE.md, I1, " +
        "septième forme.",
    ).toEqual([]);
  });
});
