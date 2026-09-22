import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LigneAgence } from "@/app/(back-office)/parametres/agences/composants";

/**
 * LA LISTE DES ÉTABLISSEMENTS DISTINGUE DEUX AGENCES DE MÊME LIBELLÉ
 * (AGENCE-CODE-1).
 *
 * Mesuré le 23/09/2026 sur la base de production d'Alexis : deux agences
 * « DUCOS » y coexistent, l'une active et l'autre inactive, avec deux
 * identifiants distincts, et la liste des établissements les rendait à
 * l'identique — `grep -n "code" app/(back-office)/parametres/agences/
 * page.tsx` ne rendait AUCUNE ligne avant ce lot : le `select` ne lisait
 * même pas la colonne.
 *
 * `LigneAgence` est un composant PUR — voir son en-tête pour pourquoi il vit
 * hors de `page.tsx` (D-13, même raison que `estExpiree` dans
 * `parametres/equipe/presentation.ts`) : le rendre directement, avec des
 * données forgées, éprouve exactement ce qu'un humain lit, sans base ni
 * navigateur.
 */
describe("LigneAgence (AGENCE-CODE-1)", () => {
  it("deux établissements de même libellé et de codes différents restent distinguables dans la liste", () => {
    render(
      <table>
        <tbody>
          <LigneAgence
            id="11111111-1111-7111-8111-111111111111"
            libelle="Ducos"
            code="DUCOS"
            actif={true}
            parametrage={null}
            exceptions={0}
            colonnes={8}
          />
          <LigneAgence
            id="22222222-2222-7222-8222-222222222222"
            libelle="Ducos"
            code="DUCOS-2"
            actif={false}
            parametrage={null}
            exceptions={0}
            colonnes={8}
          />
        </tbody>
      </table>,
    );

    const lignes = screen.getAllByRole("row");
    expect(lignes).toHaveLength(2);
    // Le défaut mesuré, exactement : avant ce lot, les deux cellules de nom
    // auraient porté le même texte « Ducos », indiscernables l'une de
    // l'autre.
    const textes = lignes.map((ligne) => ligne.textContent ?? "");
    expect(new Set(textes).size).toBe(2);
    expect(screen.getByText(/DUCOS-2/)).toBeInTheDocument();
    expect(screen.getByText(/^Ducos.*DUCOS$/)).toBeInTheDocument();
  });
});
