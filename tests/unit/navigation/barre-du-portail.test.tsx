import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { BarreDeNavigation } from "@/components/navigation/barre";
import { fr } from "@/lib/i18n/fr";
import { ENTREES, ENTREES_PORTAIL } from "@/lib/navigation/entrees";
import { THEME_DEFAUT } from "@/lib/theme/theme";

/**
 * LE PORTAIL A SA PROPRE BARRE (R2-17, D97).
 *
 * *Mesuré avant : `app/(portail)/layout.tsx` rendait les onze entrées d'une
 * maquette de BACK-OFFICE — « Planning », « Techniciens », « Facturation ».*
 * Ce n'était pas une fuite de cloisonnement, aucune ne menant à une route
 * servie ; c'était une fuite de LECTURE, et elle est vue par un client.
 *
 * ## Pourquoi ce scénario rend le composant plutôt que d'ouvrir un navigateur
 *
 * **Aucun compte de portail ne peut ouvrir de session aujourd'hui**, et ce
 * n'est pas une lacune du harnais : le chemin qu'il emprunte —
 * `reemettreJetonPremierAcces` — refuse quand `utilisateurSociete.count` vaut
 * zéro, ce qui est précisément l'état d'un compte de portail (D10). *Lu dans
 * `lib/auth/amorcage.ts`, et c'est le constat qui a fondé D96.* Un scénario
 * Playwright irait donc buter sur `/connexion` et mesurerait une redirection,
 * jamais une barre.
 *
 * **La levée est nommée et vérifiable** : le jour où L2-13 livre le lien
 * d'invitation, ce scénario se double d'une scène de bout en bout qui ouvre une
 * session de portail par l'écran. *Une limite écrite avec sa condition de levée
 * n'est pas une dette silencieuse.*
 */

vi.mock("next/navigation", () => ({ usePathname: () => "/portail" }));

/** Ce qu'un client ne doit JAMAIS lire au-dessus de son espace. */
const LIBELLES_DU_BACK_OFFICE = ENTREES.map((entree) => fr[entree.cle]);

function rendreLaBarreDuPortail() {
  render(
    <BarreDeNavigation
      theme={THEME_DEFAUT}
      initiales="AB"
      entrees={ENTREES_PORTAIL}
      accueil="/portail"
    />,
  );
}

describe("la barre du portail ne porte que ce qui appartient au client", () => {
  it("a réellement rendu une barre — le témoin de non-vacuité", () => {
    // Deux listes vides s'accordent parfaitement (§9, 10/09). Sans ce témoin,
    // une barre qui ne rendrait RIEN passerait toutes les assertions
    // ci-dessous, et elle les passerait pour la pire des raisons.
    rendreLaBarreDuPortail();
    expect(ENTREES_PORTAIL.length).toBeGreaterThan(0);
    expect(LIBELLES_DU_BACK_OFFICE.length).toBeGreaterThan(0);
    expect(screen.getByRole("navigation")).toBeTruthy();
    for (const entree of ENTREES_PORTAIL) {
      expect(screen.getByText(fr[entree.cle])).toBeTruthy();
    }
  });

  it("aucun libellé du back-office n'y apparaît", () => {
    rendreLaBarreDuPortail();
    const barre = screen.getByRole("navigation");
    const rendus = LIBELLES_DU_BACK_OFFICE.filter((libelle) =>
      barre.textContent?.includes(libelle),
    );
    expect(
      rendus,
      "libellés de back-office lus dans la barre du portail",
    ).toEqual([]);
  });

  it("le point de retour mène au portail, jamais au planning", () => {
    // La moitié qu'on oublierait. `/planning` ne s'ouvre pas à un compte de
    // portail — il n'a aucune habilitation de société (D10) et la route le
    // redirige : la marque l'y envoyait, c'est-à-dire dehors.
    rendreLaBarreDuPortail();
    const retour = screen.getByRole("link", { name: /CODIPLAN/i });
    expect(retour.getAttribute("href")).toBe("/portail");
  });
});

describe("la liste du portail obéit à ses deux règles propres", () => {
  it("ne porte AUCUNE entrée inerte", () => {
    // La règle qui la sépare de la barre du back-office (D97). Une entrée
    // inerte est admise dans une barre que la maquette PRESCRIT ; elle ne
    // l'est pas dans une barre qu'on dessine soi-même — ce serait promettre au
    // client un outil qu'on n'a pas décidé de lui donner.
    for (const entree of ENTREES_PORTAIL) {
      expect(entree.chemin, fr[entree.cle]).not.toBeNull();
      expect(entree.ouvertePar, fr[entree.cle]).toBeUndefined();
    }
  });

  it("chaque entrée mène à une route RÉELLEMENT servie par le segment", () => {
    // « Ne porte que ce qui existe » se mesure sur le disque, pas sur une
    // intention. Le sens gardé est celui qui casse : une entrée dont l'écran
    // n'existe pas mènerait à un 404, et un 404 dans une barre se lit comme
    // une panne.
    for (const entree of ENTREES_PORTAIL) {
      const page = join(
        process.cwd(),
        "app",
        "(portail)",
        entree.chemin ?? "",
        "page.tsx",
      );
      expect(existsSync(page), `${entree.chemin} → ${page}`).toBe(true);
    }
  });

  it("les deux barres ne partagent AUCUNE clé — la paire qui doit rester verte pour sa raison", () => {
    // §9 (11/09). Le cas qui doit rougir est couvert ci-dessus ; celui-ci doit
    // rester vert POUR SA PROPRE RAISON — les deux listes existent, elles sont
    // toutes deux peuplées, et elles sont disjointes. Deux listes vides le
    // seraient aussi.
    const cles = new Set(ENTREES.map((e) => e.cle));
    const partagees = ENTREES_PORTAIL.filter((e) => cles.has(e.cle));
    expect(partagees).toEqual([]);
    expect(cles.size).toBeGreaterThan(0);
    expect(ENTREES_PORTAIL.length).toBeGreaterThan(0);
  });
});
