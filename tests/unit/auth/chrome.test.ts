import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { identiteDeChrome } from "@/lib/auth/chrome";

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

describe("le chemin : la mise en page racine emploie la lecture qui ne lève pas", () => {
  const LAYOUT = readFileSync(join(process.cwd(), "app/layout.tsx"), "utf8");
  const sansCommentaires = LAYOUT.replace(/\/\/[^\n]*/g, "").replace(
    /\/\*[\s\S]*?\*\//g,
    "",
  );

  it("a réellement lu la mise en page — le témoin", () => {
    expect(sansCommentaires).toContain("RootLayout");
  });

  it("n'appelle PAS `obtenirSession`, qui lève", () => {
    // La coupure est « documentation contre exécution » (D50) : l'entête de la
    // mise en page a le droit de NOMMER la fonction pour dire pourquoi elle ne
    // l'appelle pas. C'est le corps qui est jugé.
    expect(sansCommentaires).not.toMatch(/\bobtenirSession\b/);
  });

  it("appelle `identiteDeChrome`", () => {
    expect(sansCommentaires).toMatch(/\bidentiteDeChrome\b/);
  });

  it("et `themeDuContexte`, qui porte le même contrat", () => {
    // Les deux moitiés du chrome — la charte et l'identité — ne lèvent ni
    // l'une ni l'autre. En garder une seule laisserait la porte ouverte par
    // l'autre, et personne ne s'en apercevrait avant la prochaine prise de vue.
    expect(sansCommentaires).toMatch(/\bthemeDuContexte\b/);
  });
});
