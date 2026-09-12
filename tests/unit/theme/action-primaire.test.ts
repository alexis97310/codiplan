import { readFileSync, readdirSync } from "node:fs";
import { extname, join, relative } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * UNE COULEUR, UN SENS — L'ACTION PRIMAIRE N'EST PAS ROUGE.
 *
 * ## LA RÈGLE, ET POURQUOI ELLE N'EST PAS UNE PRÉFÉRENCE
 *
 * `--app-accent` est **le rouge de la marque**, et il sert déjà deux fois : la
 * marque — barre, pastille de société — et l'**alerte** — le statut « en
 * cours », les messages de refus. *Un troisième sens sur la même couleur est
 * une couleur qui ne dit plus rien* : un œil qui voit du rouge partout cesse de
 * le lire comme un signal.
 *
 * Les cinq boutons d'action primaire le portaient. Ils portent désormais le
 * **bleu plein**, et **une seule maison le dit** —
 * `components/ui/action-primaire.tsx`.
 *
 * ## CE QUE CE GARDIEN REGARDE, ET DANS LES DEUX SENS
 *
 *   1. **Aucun écran n'écrit `bg-app-accent`.** La faute telle qu'elle se
 *      commettrait est la sixième recopie, née de la couleur d'avant.
 *   2. **Aucun écran ne recopie l'apparence** du bouton — la classe complète —
 *      même avec une autre couleur : ce serait la même duplication sous un
 *      autre nom, et elle divergerait au premier ajustement.
 *   3. **La maison, elle, la porte** — sans quoi le gardien serait vert sur un
 *      dépôt où plus personne n'a de bouton.
 *
 * ## SA LIMITE, ANNONCÉE
 *
 * Il lit du texte : une classe assemblée à l'exécution lui échappe, comme à
 * tout motif statique (§9, 26/08, forme 6). Ce qu'il arrête est la recopie bien
 * intentionnée, qui est la façon dont cette règle se perdra si elle se perd.
 */

const MAISON = join(process.cwd(), "components/ui/action-primaire.tsx");

const RACINES = ["app", "components"] as const;

function fichiersDeRendu(racine: string): string[] {
  const chemin = join(process.cwd(), racine);
  const trouves: string[] = [];
  for (const entree of readdirSync(chemin, { withFileTypes: true })) {
    const complet = join(chemin, entree.name);
    if (entree.isDirectory()) {
      trouves.push(...fichiersDeRendu(relative(process.cwd(), complet)));
    } else if (extname(entree.name) === ".tsx") {
      trouves.push(complet);
    }
  }
  return trouves;
}

/** Tous les composants, MOINS la maison — qui est la seule exemption. */
function ecrans(): string[] {
  return RACINES.flatMap(fichiersDeRendu).filter(
    (fichier) => fichier !== MAISON,
  );
}

describe("l'action primaire n'est pas rouge, et elle n'a qu'une maison", () => {
  it("TÉMOIN — la population n'est pas vide, et la maison existe", () => {
    // Zéro fichier observé ressemble exactement à un sans-faute (§9, 30/08).
    expect(ecrans().length).toBeGreaterThan(10);
    expect(readFileSync(MAISON, "utf8")).toContain("bg-app-bleu-plein");
  });

  it("aucun écran n'écrit le rouge de la marque comme fond de bouton", () => {
    for (const fichier of ecrans()) {
      const texte = readFileSync(fichier, "utf8");
      expect(
        texte,
        `${relative(process.cwd(), fichier)} écrit bg-app-accent`,
      ).not.toContain("bg-app-accent");
    }
  });

  it("aucun écran ne RECOPIE l'apparence du bouton, même en bleu", () => {
    // La duplication sous un autre nom est la même duplication : elle
    // divergerait au premier ajustement, et sans rougir.
    for (const fichier of ecrans()) {
      const texte = readFileSync(fichier, "utf8");
      expect(
        /rounded-md px-4 py-2 text-\[13px\] font-bold/.test(texte),
        `${relative(process.cwd(), fichier)} recopie l'apparence du bouton`,
      ).toBe(false);
    }
  });

  it("LA MISE EN ÉCHEC : la sixième recopie est refusée", () => {
    // La faute telle qu'elle se commettrait — un écran nouveau qui reprend la
    // classe d'un écran ancien, par copie.
    const fautif =
      '<button className="bg-app-accent text-app-accent-encre rounded-md px-4 py-2 text-[13px] font-bold">';
    expect(fautif).toContain("bg-app-accent");
    expect(/rounded-md px-4 py-2 text-\[13px\] font-bold/.test(fautif)).toBe(
      true,
    );
  });
});
