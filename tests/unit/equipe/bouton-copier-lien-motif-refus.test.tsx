import { fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { fr } from "@/lib/i18n";
import { BoutonCopierLien } from "@/components/equipe/bouton-copier-lien";

/**
 * B5 (relecture de 9I6B, 9I7D-RESERVES-DE-REVUE-ACCES-ET-MENTIONS) — LA
 * ROUTE REND `{ erreur: motif }` EN 200 ; CE BOUTON AFFICHE LE TEXTE PROPRE
 * À CE MOTIF, PAS « Le lien n'a pas pu être copié. » POUR TOUT REFUS.
 */
describe("BoutonCopierLien — le motif nommé du refus, affiché (B5)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("un motif connu du préfixe par défaut (technicien) affiche son propre texte", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ erreur: "deja_un_mot_de_passe" }),
      }),
    );
    const { getByRole, getByText } = render(
      <BoutonCopierLien action="/api/equipe/x/copier-lien" />,
    );
    fireEvent.click(getByRole("button", { name: fr["equipe.acces.copier_lien"] }));
    await waitFor(() =>
      expect(
        getByText(fr["equipe.acces.refus.deja_un_mot_de_passe"]),
      ).toBeInTheDocument(),
    );
  });

  it("un motif propre au bureau (cible_protegee, D223) affiche son texte via le préfixe bureau", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ erreur: "cible_protegee" }),
      }),
    );
    const { getByRole, getByText } = render(
      <BoutonCopierLien
        action="/api/equipe/bureau/x/copier-nouveau-lien"
        prefixeMotifRefus="equipe.bureau.acces.refus."
      />,
    );
    fireEvent.click(getByRole("button", { name: fr["equipe.acces.copier_lien"] }));
    await waitFor(() =>
      expect(
        getByText(fr["equipe.bureau.acces.refus.cible_protegee"]),
      ).toBeInTheDocument(),
    );
  });

  it("un motif inconnu retombe sur le texte générique, jamais une clé brute", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ erreur: "un_motif_jamais_vu" }),
      }),
    );
    const { getByRole, getByText } = render(
      <BoutonCopierLien action="/api/equipe/x/copier-lien" />,
    );
    fireEvent.click(getByRole("button", { name: fr["equipe.acces.copier_lien"] }));
    await waitFor(() =>
      expect(
        getByText(fr["equipe.acces.copier_lien_erreur"]),
      ).toBeInTheDocument(),
    );
  });
});
