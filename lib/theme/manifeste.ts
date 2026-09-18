/**
 * LES COULEURS QUE LE MANIFESTE D'APPLICATION EXIGE (L3-06).
 *
 * ## Pourquoi elles sont ICI et nulle part ailleurs
 *
 * `apparence.ts` pose la règle : *« aucune couleur n'y est écrite : les
 * palettes sont déclarées dans `app/globals.css`, sous la seule forme qu'une
 * feuille de style admet pour une couleur — la déclaration de variable ».*
 *
 * **Un manifeste d'application n'est pas une feuille de style.** Le navigateur
 * le lit hors de tout document : il ne peut pas résoudre `var(--app-marque)`,
 * et il n'a pas de cascade où la résoudre. La couleur doit donc être écrite une
 * SECONDE fois, en clair.
 *
 * Ce module est le seul endroit où cela est licite, et ce n'est pas une
 * exemption nouvelle : **`lib/theme/` est déjà « LE mécanisme, l'endroit
 * désigné où le noir, le blanc et le thème neutre s'écrivent »** — c'est ce que
 * le gardien de L0-09 exempte, par préfixe de répertoire. *Poser une exemption
 * de plus pour `app/manifest.ts` aurait élargi la règle ; poser le fichier dans
 * le répertoire déjà désigné ne l'élargit pas d'un pouce.*
 *
 * ## CE QUI CONFRONTE LES DEUX COPIES
 *
 * *Le test à faire passer à toute duplication qui se prétend inévitable :
 * qu'est-ce qui confronterait les deux copies ? Si la réponse est « la
 * relecture », ce n'est pas un contrôle, c'est un doublon* (§9, 01/09).
 *
 * La réponse est `tests/unit/pwa/manifeste.test.ts` : il lit `app/globals.css`
 * — une source que ce module ne contrôle pas — et **rougit si les deux
 * s'écartent**. Avec son témoin : la variable doit exister, sans quoi la
 * comparaison serait verte sur deux absences.
 */

/**
 * La couleur de marque. Recopiée de `--app-marque` — et confrontée à elle.
 *
 * Elle habille la barre du système quand l'application est installée. *Une
 * couleur différente de celle de l'application produit un liseré étranger en
 * haut de l'écran, et c'est la première chose qu'on voit.*
 */
export const COULEUR_MARQUE = "#0053a1";

/**
 * Le fond de l'écran de démarrage. Recopié de `--app-fond` — et confronté.
 *
 * *Un écran de démarrage d'une autre couleur que l'application produit un
 * clignotement à chaque lancement.*
 */
export const COULEUR_FOND = "#f4f6f9";
