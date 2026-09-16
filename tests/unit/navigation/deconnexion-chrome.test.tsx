import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BarreDeNavigation } from "@/components/navigation/barre";
import { fr } from "@/lib/i18n/fr";
import {
  ENTREES,
  ENTREES_PORTAIL,
  ENTREES_TERRAIN,
} from "@/lib/navigation/entrees";
import { THEME_DEFAUT } from "@/lib/theme/theme";

/**
 * LA DÉCONNEXION EST DANS LE CHROME, DANS LES TROIS COQUES (N-02, arbitrage du
 * 16/09/2026).
 *
 * ## Ce que ce ticket répare
 *
 * `POST /api/session/deconnexion` existait, et le seul bouton qui l'appelait
 * était sur `/arrivee` — un écran d'atterrissage sur lequel on ne revient
 * jamais. *En pratique, une session ouverte ne se fermait pas.* La commande
 * vit désormais dans `BarreDeNavigation`, commune aux trois mises en page qui
 * la rendent (`(back-office)`, `(portail)`, `(mobile)`) : c'est elle qui
 * décide, et une seule preuve suffit pour les trois puisqu'aucune des trois
 * mises en page ne réimplémente le chrome.
 *
 * ## Pourquoi rendre le composant, pas naviguer un navigateur (pour le portail
 * et le terrain)
 *
 * `barre-du-portail.test.tsx` et `barre-du-terrain.test.tsx` l'ont déjà écrit,
 * et la raison n'a pas changé : aucun compte de portail ne peut ouvrir de
 * session aujourd'hui (D96), et un scénario Playwright buterait sur
 * `/connexion` sans jamais atteindre la barre. Le chemin du BACK-OFFICE, lui,
 * est éprouvé de bout en bout par `tests/e2e/deconnexion.spec.ts` — la
 * commande FERME réellement la session, pas seulement s'affiche.
 *
 * ## LE CRITÈRE DE PRÉSENCE EST CELUI D'`Avatar`, ET C'EST DÉLIBÉRÉ
 *
 * Une pastille d'initiales absente et un bouton de déconnexion absent disent
 * la même chose — « le chrome ne sait pas qui est connecté » — et ce n'est PAS
 * un contrôle d'accès : `lib/navigation/entrees.ts` le dit déjà pour les
 * entrées, et cela vaut ici à l'identique.
 */

vi.mock("next/navigation", () => ({ usePathname: () => "/peu-importe" }));

const COQUES = [
  { nom: "back-office", entrees: ENTREES, accueil: "/planning" },
  { nom: "portail", entrees: ENTREES_PORTAIL, accueil: "/portail" },
  { nom: "terrain", entrees: ENTREES_TERRAIN, accueil: "/terrain" },
] as const;

describe.each(COQUES)(
  "la commande de déconnexion dans la coque $nom",
  ({ entrees, accueil }) => {
    it("est un POST vers la route de déconnexion, jamais un lien", () => {
      render(
        <BarreDeNavigation
          theme={THEME_DEFAUT}
          initiales="ML"
          entrees={entrees}
          accueil={accueil}
        />,
      );

      const bouton = screen.getByRole("button", {
        name: fr["nav.deconnexion"],
      });
      const formulaire = bouton.closest("form");
      expect(formulaire).not.toBeNull();
      expect(formulaire).toHaveAttribute("action", "/api/session/deconnexion");
      expect(formulaire).toHaveAttribute("method", "post");
    });

    it("disparaît quand personne n'est connecté — même critère qu'Avatar", () => {
      render(
        <BarreDeNavigation
          theme={THEME_DEFAUT}
          initiales={null}
          entrees={entrees}
          accueil={accueil}
        />,
      );

      expect(
        screen.queryByRole("button", { name: fr["nav.deconnexion"] }),
      ).toBeNull();
    });

    it("n'est pas une entrée de la barre — la liste close ne bouge pas", () => {
      render(
        <BarreDeNavigation
          theme={THEME_DEFAUT}
          initiales="ML"
          entrees={entrees}
          accueil={accueil}
        />,
      );

      // La déconnexion vit HORS de <nav> : c'est une commande du chrome, pas
      // une destination de la navigation (D95, §9 — deux lectures d'un même
      // critère divergent en silence, et il n'y en a qu'une : le CHEMIN).
      const nav = screen.getByRole("navigation");
      expect(
        Array.from(nav.querySelectorAll("form")),
        "un <form> de déconnexion s'est glissé DANS la navigation",
      ).toHaveLength(0);
    });
  },
);
