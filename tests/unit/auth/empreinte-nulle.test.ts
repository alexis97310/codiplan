import { verifyPassword } from "@better-auth/utils/password";
import { describe, expect, it } from "vitest";

/**
 * UNE EMPREINTE NULLE REFUSE-T-ELLE TOUTE TENTATIVE ?
 * *(exigence de l'exploitation, nuit du 11/09/2026)*
 *
 * L'amorçage EFFACE l'empreinte du mot de passe jetable. La raison est écrite
 * dans `lib/auth/amorcage.ts` : cette empreinte était un **mensonge dans la
 * donnée** — un compte qui n'a pas de mot de passe ne doit pas en porter un.
 * Le cliquet de la réémission (`mot_de_passe IS NULL`) devient lisible en
 * CONSÉQUENCE de cette réparation, jamais l'inverse.
 *
 * Mais une réparation qui écrit `NULL` dans une colonne d'empreinte pose une
 * question qui renverserait tout : **si une empreinte nulle comparait vrai une
 * seule fois, nous aurions ouvert une porte en croyant en fermer une.**
 *
 * ## Ce que ce fichier mesure, et ce qu'il ne mesure pas
 *
 * Il mesure la **couche de comparaison** — la fonction que la bibliothèque
 * appelle une fois qu'elle a décidé de comparer. C'est la couche qui reste
 * quand la garde disparaît : `sign-in.mjs` refuse d'abord sur
 * `if (!currentPassword)`, et cette garde-là est éprouvée par le chemin réel
 * dans `tests/isolation/amorcage-premier-compte.test.ts` (trois tentatives).
 *
 * **Les deux sont indépendantes, et c'est le sujet.** Un jour où la garde
 * disparaîtrait — une version de la bibliothèque, un autre point d'entrée qui
 * comparerait sans elle —, la question « une empreinte nulle compare-t-elle
 * vrai ? » se reposerait entière. La réponse mesurée ici est qu'elle ne
 * compare pas du tout : elle LÈVE. Un refus par exception est plus fort qu'un
 * refus par valeur — un `false` se négligerait, une exception non.
 *
 * *Sa limite, annoncée :* il éprouve la bibliothèque installée, pas un
 * contrat. Le jour où `@better-auth/utils` change de comportement, c'est ce
 * fichier qui rougit — et c'est exactement ce qu'on lui demande.
 */
describe("une empreinte nulle ne compare JAMAIS vrai", () => {
  /**
   * Ce que la comparaison rend, sous une forme lisible dans un tableau :
   * `"VRAI"` serait la porte ouverte, `"faux"` un refus par valeur, et
   * `"lève: …"` un refus par exception.
   */
  async function comparer(
    empreinte: unknown,
    motDePasse: unknown,
  ): Promise<string> {
    try {
      const resultat = await verifyPassword(
        empreinte as string,
        motDePasse as string,
      );
      return resultat === true ? "VRAI" : "faux";
    } catch (erreur) {
      return `lève: ${erreur instanceof Error ? erreur.constructor.name : "inconnu"}`;
    }
  }

  it("empreinte NULL — les trois mots de passe de l'exigence", async () => {
    expect(await comparer(null, "NImporteQuoi1!")).toBe("lève: TypeError");
    expect(await comparer(null, "")).toBe("lève: TypeError");
    expect(await comparer(null, null)).toBe("lève: TypeError");
  });

  it("empreinte vide et empreinte malformée — les voisines de NULL", async () => {
    // `""` est ce qu'une réparation maladroite écrirait à la place de `NULL` ;
    // `"undefined"` est ce qu'une interpolation de chaîne y laisserait.
    expect(await comparer("", "NImporteQuoi1!")).toBe("lève: Error");
    expect(await comparer("", "")).toBe("lève: Error");
    expect(await comparer("undefined", "undefined")).toBe("lève: Error");
  });

  it("TÉMOIN — la même fonction rend VRAI sur une empreinte réelle", async () => {
    // Sans ce témoin, les six mesures ci-dessus seraient vertes sur une
    // fonction qui lèverait TOUJOURS, et elles ne parleraient de rien
    // (§9, 30/08 — un décompte nul ressemble à un sans-faute).
    const { hashPassword } = await import("@better-auth/utils/password");
    const empreinte = await hashPassword("UnVraiMotDePasse1!");
    expect(await comparer(empreinte, "UnVraiMotDePasse1!")).toBe("VRAI");
    expect(await comparer(empreinte, "UnAutreMotDePasse1!")).toBe("faux");
  });
});
