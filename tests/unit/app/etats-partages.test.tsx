import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// `app/global-error.tsx` importe sa propre feuille de style (c'est la règle :
// il remplace la racine, qui ne lui transmet plus rien). Vitest s'exécute
// sous Vite, pas sous le pipeline Next — inutile qu'il traite le CSS pour
// éprouver du texte et des clics, et le mock l'en dispense.
vi.mock("@/app/globals.css", () => ({}));

import Erreur from "@/app/error";
import ErreurGlobale from "@/app/global-error";
import Chargement from "@/app/loading";
import Introuvable from "@/app/not-found";
import { fr } from "@/lib/i18n/fr";

/**
 * AV-11 — LES QUATRE ÉTATS QUI MANQUAIENT À TOUT ÉCRAN.
 *
 * Avant ce ticket, `app/` ne portait aucun `loading.tsx`, `error.tsx`,
 * `not-found.tsx` ni `global-error.tsx` : un écran lent ne montrait rien, un
 * écran cassé rendait une PAGE BLANCHE, une adresse inexistante rendait la
 * page d'erreur crue de Next. Ce fichier éprouve ce que chacun des quatre DOIT
 * dire (§ ticket) : un chargement dit qu'on attend, une erreur dit ce qui
 * s'est passé et ce qu'on peut faire sans jamais montrer de trace technique
 * (D50), une page introuvable propose une sortie.
 */

const rafraichirEnArriere = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: rafraichirEnArriere }),
}));

describe("le chargement (app/loading.tsx)", () => {
  it("dit qu'on attend, jamais qu'il n'y a rien", () => {
    render(<Chargement />);

    // `role="status"` — pas `EtatVide`, qui dit « rien à montrer » : les deux
    // notions ne se confondent pas (D88).
    expect(screen.getByRole("status")).toHaveTextContent(fr["etat.chargement"]);
  });
});

describe("la page introuvable (app/not-found.tsx)", () => {
  it("nomme l'absence, sans plus, et propose une sortie", () => {
    render(<Introuvable />);

    expect(
      screen.getByRole("heading", { name: fr["etat.introuvable.titre"] }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(fr["etat.introuvable.description"]),
    ).toBeInTheDocument();

    const sortie = screen.getByRole("link", {
      name: fr["etat.retour_accueil"],
    });
    expect(sortie).toHaveAttribute("href", "/");
  });
});

describe("l'erreur (app/error.tsx)", () => {
  it("ne montre aucune trace technique, et offre deux gestes actionnés par l'humain", () => {
    const reset = vi.fn();
    const erreur = Object.assign(
      new Error("societe_id manquant dans le contexte RLS"),
      { digest: "abc123" },
    );

    render(<Erreur error={erreur} reset={reset} />);

    expect(
      screen.getByRole("heading", { name: fr["etat.erreur.titre"] }),
    ).toBeInTheDocument();
    expect(screen.getByText(fr["etat.erreur.description"])).toBeInTheDocument();
    // Le message de l'exception et son digest ne sont RENDUS NULLE PART : ce
    // que `error` porte est un canal de développeur, jamais l'écran (D50).
    expect(screen.queryByText(/societe_id manquant/)).not.toBeInTheDocument();
    expect(screen.queryByText(/abc123/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: fr["etat.reessayer"] }));
    expect(reset).toHaveBeenCalledTimes(1);

    fireEvent.click(
      screen.getByRole("button", { name: fr["etat.retour_arriere"] }),
    );
    expect(rafraichirEnArriere).toHaveBeenCalledTimes(1);
  });
});

describe("l'erreur globale (app/global-error.tsx)", () => {
  it("porte ses propres <html> et <body>, sans trace technique ni dépendance au routeur", () => {
    const reset = vi.fn();
    const erreur = new Error("societe_id manquant dans le contexte RLS");

    render(<ErreurGlobale error={erreur} reset={reset} />);

    // Elle remplace la racine : elle doit donc porter la sienne.
    expect(document.querySelector("html")).not.toBeNull();
    expect(document.querySelector("body")).not.toBeNull();

    expect(
      screen.getByRole("heading", { name: fr["etat.erreur_globale.titre"] }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(fr["etat.erreur_globale.description"]),
    ).toBeInTheDocument();
    expect(screen.queryByText(/societe_id manquant/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: fr["etat.reessayer"] }));
    expect(reset).toHaveBeenCalledTimes(1);

    // Le retour est une NAVIGATION (`next/link`), jamais `useRouter` : le
    // rendu de la racine elle-même a échoué, `Link` ne dépend de rien d'autre.
    const sortie = screen.getByRole("link", {
      name: fr["etat.retour_accueil"],
    });
    expect(sortie).toHaveAttribute("href", "/");
  });
});
