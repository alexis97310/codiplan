import { describe, expect, it } from "vitest";

import { fichiersSource, sansCommentaires } from "../outils/fichiers-source";

/**
 * `second_facteur_valide` EST DÉDUIT DE `mfa_actif` À LA CRÉATION DE SESSION
 * (décision d'Alexis du 10/11/2026, `lib/auth/config.ts`).
 *
 * **Ce que ce gardien tient.** Better Auth porte un mécanisme « appareil de
 * confiance » (`trustDevice`) qui, quand une vérification l'a demandé,
 * laisse une connexion SUIVANTE créer une session sans présenter de nouveau
 * le second facteur — la session créée alors porterait, elle aussi,
 * `second_facteur_valide: true` par construction, sans vérification à CETTE
 * connexion-là. Ce produit n'offre nulle part de « se souvenir de cet
 * appareil » : aucun appel de ce dépôt ne passe `trustDevice`, donc
 * Better Auth ne pose jamais le cookie qui l'activerait, et le mécanisme
 * reste ENTIÈREMENT INERTE.
 *
 * **Pourquoi un gardien plutôt qu'une confiance tacite.** C'est exactement la
 * leçon de L1-02d : une fermeture par absence n'est pas une fermeture tenue,
 * c'est un accident qui arrange — le jour où un écran ajoute une case
 * « se souvenir de moi sur cet appareil » sans relire ce raisonnement, le
 * champ redevient vrai sans vérification effective. Ce gardien rougit ce
 * jour-là plutôt que de laisser la régression passer inaperçue.
 */
const SOURCES = fichiersSource(["app", "components", "lib"]).map(
  (fichier) => ({ ...fichier, sansCommentaires: sansCommentaires(fichier.contenu) }),
);

describe("l'appareil de confiance de Better Auth reste inerte (gardien)", () => {
  it("aucun appel du dépôt ne passe `trustDevice` — le mécanisme ne peut donc jamais poser son cookie", () => {
    const porteurs = SOURCES.filter((fichier) =>
      fichier.sansCommentaires.includes("trustDevice"),
    );
    expect(
      porteurs.map((fichier) => fichier.chemin),
      "un appel passant `trustDevice` réveillerait un chemin où une session " +
        "porte `second_facteur_valide: true` sans vérification à CETTE " +
        "connexion — voir l'en-tête de ce fichier avant d'en ajouter un.",
    ).toEqual([]);
  });
});
