import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { etatArriveeOuAnonyme } from "@/lib/auth/arrivee";
import { identiteDeChrome } from "@/lib/auth/chrome";
import { Role } from "@/lib/auth/roles";

/** Toutes les pages d'un répertoire, récursivement. */
function pages(repertoire: string): readonly string[] {
  const trouvees: string[] = [];
  for (const entree of readdirSync(repertoire)) {
    const chemin = join(repertoire, entree);
    if (statSync(chemin).isDirectory()) {
      trouvees.push(...pages(chemin));
    } else if (entree === "page.tsx") {
      trouvees.push(chemin);
    }
  }
  return trouvees;
}

/** Toutes les mises en page du répertoire `app/`, la racine comprise. */
function misesEnPage(repertoire: string): readonly string[] {
  const trouvees: string[] = [];
  for (const entree of readdirSync(repertoire)) {
    const chemin = join(repertoire, entree);
    if (statSync(chemin).isDirectory()) {
      trouvees.push(...misesEnPage(chemin));
    } else if (entree === "layout.tsx") {
      trouvees.push(chemin);
    }
  }
  return trouvees;
}

/**
 * LA MISE EN PAGE RACINE NE LÈVE JAMAIS — l'incident du 11/09/2026.
 *
 * ## Ce qui s'est passé, mesuré
 *
 * D95 a mis la barre de navigation dans la mise en page racine, et la barre a
 * besoin du nom de la personne. La session a été lue là, par un appel nu à
 * `obtenirSession`. **Sans `BETTER_AUTH_SECRET`, la bibliothèque lève au
 * premier appel — donc sur CHAQUE page, y compris `/` qui ne touche aucune
 * base et `/sante` dont le contrat entier est de ne jamais lever.** Le serveur
 * de production n'a jamais répondu ; `pnpm test:e2e` a expiré au bout de
 * 240 s, et la CI sur `27a5ca1` est tombée.
 *
 * *Ce qui l'a laissé passer n'est pas un gardien creux : c'est qu'aucun gardien
 * ne regardait là.* `pnpm verify` ne joue pas Playwright — la porte du ticket
 * et la porte de `main` ne gardent pas la même chose, ce que le §9 du 02/09
 * nomme déjà, et le vert annoncé était sincère et insuffisant.
 *
 * ## Deux scénarios, deux natures, et il faut les DEUX
 *
 * **Le FAIT** — la lecture ne lève pas, même quand ce qu'elle appelle lève. Il
 * se mesure en lui passant une lecture qui lève : sans cette couture,
 * l'éprouver exigerait de casser l'environnement, ce qu'un test unitaire ne
 * sait pas faire.
 *
 * **LE CHEMIN** — la mise en page racine emploie bien cette lecture-là. Un
 * module qui ne lève jamais ne protège rien si l'écran appelle l'autre ; c'est
 * la moitié que l'incident a réellement franchie, et elle est statique.
 */

describe("la lecture de chrome ne lève jamais", () => {
  it("rend l'identité quand tout va bien — le témoin de non-vacuité", async () => {
    // Sans lui, « rend null » serait vrai d'une fonction qui rend toujours
    // null, et le scénario suivant ne prouverait rien.
    const identite = await identiteDeChrome(new Headers(), async () => ({
      identite: { nom: "Direction de démonstration" },
      contexte: { utilisateurId: "u1", societeId: null, role: null } as never,
    }));
    expect(identite?.nom).toBe("Direction de démonstration");
  });

  it("rend `null` quand la lecture LÈVE — c'est l'incident exact", async () => {
    const identite = await identiteDeChrome(new Headers(), async () => {
      throw new Error(
        "You are using the default secret. Please set `BETTER_AUTH_SECRET`",
      );
    });
    expect(identite).toBeNull();
  });

  it("rend `null` quand personne n'est connecté", async () => {
    expect(await identiteDeChrome(new Headers(), async () => null)).toBeNull();
  });

  it("rend `null` sur une base injoignable — l'autre impossibilité", async () => {
    const identite = await identiteDeChrome(new Headers(), async () => {
      throw Object.assign(new Error("P1001"), { code: "P1001" });
    });
    expect(identite).toBeNull();
  });
});

describe("le chemin : AUCUNE mise en page n'emploie une lecture qui lève", () => {
  /*
   * R2-16 a déplacé la barre de la racine vers les segments : il y a désormais
   * QUATRE mises en page, et trois d'entre elles lisent une session. Le gardien
   * ne pouvait plus regarder la racine seule — *c'est la faute du §9 du 09/09 :
   * la garantie était énoncée pour UN fichier, et un second appelant a traversé
   * l'énoncé sans le rencontrer.* Sa population est donc DÉRIVÉE du répertoire
   * `app/` : une mise en page écrite demain y entre le jour où elle apparaît.
   */
  const MISES_EN_PAGE = misesEnPage(join(process.cwd(), "app"));

  const sansCommentaires = (chemin: string): string =>
    readFileSync(chemin, "utf8")
      .replace(/\/\/[^\n]*/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "");

  it("a réellement lu des mises en page — le témoin", () => {
    // Un décompte nul ressemble toujours à un sans-faute (§9, 30/08).
    expect(MISES_EN_PAGE.length).toBeGreaterThanOrEqual(4);
    expect(sansCommentaires(join(process.cwd(), "app/layout.tsx"))).toContain(
      "RootLayout",
    );
  });

  it("aucune n'appelle `obtenirSession`, qui lève", () => {
    // La coupure est « documentation contre exécution » (D50) : l'entête d'une
    // mise en page a le droit de NOMMER la fonction pour dire pourquoi elle ne
    // l'appelle pas. C'est le corps qui est jugé.
    const fautives = MISES_EN_PAGE.filter((chemin) =>
      /\bobtenirSession\b/.test(sansCommentaires(chemin)),
    );
    expect(fautives).toEqual([]);
  });

  it("celles qui lisent une session passent par `chromeDeLaRequete`", () => {
    const lectrices = MISES_EN_PAGE.filter((chemin) =>
      /\bchromeDeLaRequete\b/.test(sansCommentaires(chemin)),
    );
    // La direction permissive : au moins une lit vraiment, sinon les deux
    // assertions ci-dessus seraient vertes sur un dossier de coquilles vides.
    expect(lectrices.length).toBeGreaterThanOrEqual(3);
  });

  it("et `chromeDeLaRequete` est faite des DEUX moitiés qui ne lèvent pas", () => {
    // Les deux moitiés du chrome — la charte et l'identité — ne lèvent ni
    // l'une ni l'autre. En garder une seule laisserait la porte ouverte par
    // l'autre, et personne ne s'en apercevrait avant la prochaine prise de vue.
    const chrome = sansCommentaires(
      join(process.cwd(), "lib/navigation/chrome.ts"),
    );
    expect(chrome).toMatch(/\bidentiteDeChrome\b/);
    expect(chrome).toMatch(/\bthemeDuContexte\b/);
    expect(chrome).not.toMatch(/\bobtenirSession\b/);
  });
});

describe("les ÉCRANS qui précèdent la session ne lèvent pas non plus (R2-16)", () => {
  /*
   * Le troisième appelant du même incident. La racine réparée le 11/09,
   * `/connexion` et `/enrolement` rendaient TOUJOURS 500 sans
   * `BETTER_AUTH_SECRET` — mesuré par le scénario Playwright de R2-16 sur une
   * compilation de production : 2 échecs, le témoin `data-apparence` absent
   * parce que la page n'avait pas été servie du tout.
   *
   * *Une page de connexion qui rend 500 quand la configuration manque est le
   * pire mode de défaillance du produit : personne ne peut même lire le
   * formulaire pour comprendre.*
   */
  const LECTURES_QUI_LEVENT = ["obtenirSession", "etatArrivee"] as const;

  const SANS_SESSION = pages(join(process.cwd(), "app", "(sans-session)"));

  const sansCommentaires = (chemin: string): string =>
    readFileSync(chemin, "utf8")
      .replace(/\/\/[^\n]*/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "");

  it("observe les six écrans — le témoin", () => {
    expect(SANS_SESSION.length).toBeGreaterThanOrEqual(6);
  });

  it("aucun n'appelle une lecture qui lève", () => {
    // `etatArriveeOuAnonyme` contient `etatArrivee` : le motif exige donc que
    // le nom ne soit PAS suivi de « OuAnonyme », sans quoi la réparation
    // elle-même ferait rougir le gardien.
    const fautifs = SANS_SESSION.filter((chemin) => {
      const corps = sansCommentaires(chemin);
      return LECTURES_QUI_LEVENT.some((nom) =>
        new RegExp(`\\b${nom}\\b(?!OuAnonyme)`).test(corps),
      );
    }).map((chemin) => chemin.slice(process.cwd().length + 1));
    expect(fautifs).toEqual([]);
  });

  it("et ceux qui lisent une session passent par la forme qui ne lève pas", () => {
    // La direction permissive : sans elle, six pages qui ne liraient RIEN
    // passeraient l'assertion ci-dessus (§9, 11/09).
    const lecteurs = SANS_SESSION.filter((chemin) =>
      /\betatArriveeOuAnonyme\b/.test(sansCommentaires(chemin)),
    );
    expect(lecteurs.length).toBeGreaterThanOrEqual(2);
  });

  it("`etatArriveeOuAnonyme` rend `anonyme` quand la lecture lève", async () => {
    const etat = await etatArriveeOuAnonyme(new Headers(), () => {
      throw new Error("You are using the default secret");
    });
    expect(etat).toEqual({ issue: "anonyme" });
  });

  it("et ne travestit RIEN quand la lecture aboutit", async () => {
    // Le cas qui doit rester vert POUR SA PROPRE RAISON : une enveloppe qui
    // rendrait TOUJOURS `anonyme` passerait l'assertion précédente.
    const etat = await etatArriveeOuAnonyme(new Headers(), async () => ({
      issue: "enrolement_requis" as const,
      role: Role.direction,
    }));
    expect(etat.issue).toBe("enrolement_requis");
  });
});
