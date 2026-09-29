import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CarteClient } from "@/app/(back-office)/clients/carte-client";
import { t } from "@/lib/i18n/fr";
import type { FicheClient } from "@/lib/clients";

/**
 * LE BADGE DE LA CARTE CLIENT — « Actif », jamais « Active » (CS1, audit du
 * 28/09/2026).
 *
 * *Le reste du produit accorde au masculin* (`site.actif`, `client.actif`
 * existant sans appelant avant ce lot) : « Active »/« inactive » étaient les
 * deux seules exceptions. Le sélecteur « État de la fiche »
 * (`clients.etat.actif`/`clients.etat.inactif`) n'est PAS touché ici — CS1 ne
 * vise que le badge de la carte.
 */
function client(actif: boolean): FicheClient {
  return {
    id: "cli-1",
    code_externe: null,
    raison_sociale: "Client de l'épreuve",
    ridet: null,
    categorie: null,
    adresse_facturation: null,
    conditions_reglement: null,
    commercial_referent: null,
    actif,
  };
}

describe("le badge de la carte client", () => {
  it("un client actif porte « Actif » (client.actif), pas « Active » (clients.etat.actif, réservé au sélecteur de la fiche)", () => {
    render(
      <CarteClient
        client={client(true)}
        sites={undefined}
        nombreEquipements={0}
      />,
    );
    const badge = screen.getByText(t("client.actif"));
    expect(badge).toBeInTheDocument();
    // Le témoin de non-vacuité de la négation : les deux clés existent et
    // diffèrent réellement, sans quoi l'assertion suivante ne prouverait rien.
    expect(t("client.actif")).not.toBe(t("clients.etat.actif"));
    expect(badge.textContent).not.toBe(t("clients.etat.actif"));
  });

  it("un client inactif porte la valeur de clients.inactif, pas celle de clients.etat.inactif (sélecteur de la fiche)", () => {
    render(
      <CarteClient
        client={client(false)}
        sites={undefined}
        nombreEquipements={0}
      />,
    );
    const badge = screen.getByText(t("clients.inactif"));
    expect(badge).toBeInTheDocument();
    expect(t("clients.inactif")).not.toBe(t("clients.etat.inactif"));
    expect(badge.textContent).not.toBe(t("clients.etat.inactif"));
  });
});
