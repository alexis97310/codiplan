import { describe, expect, it } from "vitest";

import {
  regrouperLeParcParClient,
  type LigneAvecClient,
} from "@/app/(back-office)/parc/presentation";

/**
 * 99Z-GR10-PARC, décision B (26/09/2026) — un intertitre par client, un par
 * groupe.
 *
 * `regrouperLeParcParClient` ne trie rien : elle suppose `lignes` déjà
 * groupée par client (c'est `rechercherLeParc`, `lib/machines/depot.ts`, qui
 * le fait). Ce gardien fabrique donc des scènes DÉJÀ GROUPÉES — jamais dans
 * un ordre que la fonction devrait elle-même corriger.
 */

function ligne(
  id: string,
  clientId: string,
  raisonSociale: string,
): LigneAvecClient & { readonly id: string } {
  return {
    id,
    client_id: clientId,
    client: { raison_sociale: raisonSociale },
  };
}

describe("regrouperLeParcParClient (99Z-GR10-PARC, décision B)", () => {
  it("rend une liste vide sur un parc vide", () => {
    expect(regrouperLeParcParClient([])).toEqual([]);
  });

  it("pose un intertitre en tête, avant la première ligne", () => {
    const resultat = regrouperLeParcParClient([ligne("m1", "c1", "Client A")]);
    expect(resultat).toEqual([
      { type: "intertitre", clientId: "c1", libelle: "Client A" },
      { type: "ligne", machine: ligne("m1", "c1", "Client A") },
    ]);
  });

  it("ne pose PAS de second intertitre entre deux lignes consécutives du même client", () => {
    const resultat = regrouperLeParcParClient([
      ligne("m1", "c1", "Client A"),
      ligne("m2", "c1", "Client A"),
    ]);
    expect(resultat.filter((e) => e.type === "intertitre")).toHaveLength(1);
    expect(resultat).toHaveLength(3);
  });

  it("pose un intertitre à CHAQUE changement de client", () => {
    const resultat = regrouperLeParcParClient([
      ligne("m1", "c1", "Client A"),
      ligne("m2", "c2", "Client B"),
      ligne("m3", "c2", "Client B"),
      ligne("m4", "c3", "Client C"),
    ]);
    expect(
      resultat
        .filter((e) => e.type === "intertitre")
        .map((e) => (e.type === "intertitre" ? e.libelle : null)),
    ).toEqual(["Client A", "Client B", "Client C"]);
    expect(resultat).toHaveLength(7); // 4 lignes + 3 intertitres
  });

  it("un client présent dans DEUX groupes séparés (complètes puis incomplètes, PARC-A) porte DEUX intertitres", () => {
    // Le parc trie par `complet` DESC puis par client (PARC-A) : un client
    // dont une machine est complète et l'autre non se retrouve dans deux
    // segments distincts, avec un AUTRE client entre les deux (ici « Client
    // B », seul dans les incomplètes) — c'est ce que `rechercherLeParc`
    // produirait réellement, et la fonction ne fait qu'observer le résultat.
    const resultat = regrouperLeParcParClient([
      ligne("m1", "c1", "Client A"), // complète
      ligne("m2", "c2", "Client B"), // incomplète, seule de son client
      ligne("m3", "c1", "Client A"), // incomplète, même client que m1
    ]);
    const intertitres = resultat.filter((e) => e.type === "intertitre");
    expect(intertitres).toHaveLength(3);
    expect(
      intertitres.map((e) => (e.type === "intertitre" ? e.clientId : null)),
    ).toEqual(["c1", "c2", "c1"]);
  });
});
