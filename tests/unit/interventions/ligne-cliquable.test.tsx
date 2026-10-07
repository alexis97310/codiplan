import { fireEvent, render, screen } from "@testing-library/react";
import Link from "next/link";
import { describe, expect, it, vi } from "vitest";

import { LigneCliquable } from "@/app/(back-office)/interventions/ligne-cliquable";

/**
 * `LigneCliquable` (88-REGISTRE-5, constat 16) — toute la ligne ouvre la
 * fiche, SAUF un clic qui atteint un lien, un bouton, une case, une étiquette
 * ou un `<select>` : ceux-là portent déjà leur propre action (la référence,
 * la case de sélection, « Poser »/« Déplacer… »/« Transmettre… ») et ne
 * doivent jamais déclencher une SECONDE navigation par-dessus.
 *
 * Repéré par `data-testid` plutôt que par un rôle nommé ou un `aria-label` —
 * un `aria-label` littéral est un ATTRIBUT VISIBLE (lu par un lecteur
 * d'écran) comme un autre pour le gardien `sans-chaine-visible-en-dur`
 * (L0-11), et ce fichier n'a aucun libellé réel du produit à y faire
 * correspondre.
 */

const POUSSER = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: POUSSER }),
}));

function scene(): void {
  render(
    <table>
      <tbody>
        <LigneCliquable href="/interventions/abc">
          <td data-testid="cellule-nue" />
          <td>
            <Link href="/interventions/abc" data-testid="lien" />
          </td>
          <td>
            <button type="button" data-testid="bouton" />
          </td>
          <td>
            <input type="checkbox" data-testid="case" />
          </td>
          <td>
            <label data-testid="etiquette">
              <input type="text" data-testid="champ" />
            </label>
          </td>
          <td>
            <select data-testid="select-technicien">
              <option value="a" />
            </select>
          </td>
        </LigneCliquable>
      </tbody>
    </table>,
  );
}

describe("LigneCliquable", () => {
  it("un clic sur une cellule nue pousse vers la fiche, une seule fois", () => {
    POUSSER.mockClear();
    scene();
    fireEvent.click(screen.getByTestId("cellule-nue"));
    expect(POUSSER).toHaveBeenCalledTimes(1);
    expect(POUSSER).toHaveBeenCalledWith("/interventions/abc");
  });

  it("un clic sur un lien, un bouton, une case, une étiquette ou un select ne pousse JAMAIS", () => {
    POUSSER.mockClear();
    scene();
    fireEvent.click(screen.getByTestId("lien"));
    fireEvent.click(screen.getByTestId("bouton"));
    fireEvent.click(screen.getByTestId("case"));
    fireEvent.click(screen.getByTestId("etiquette"));
    fireEvent.click(screen.getByTestId("select-technicien"));
    expect(POUSSER).not.toHaveBeenCalled();
  });
});
