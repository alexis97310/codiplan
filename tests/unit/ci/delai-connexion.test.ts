import { describe, expect, it } from "vitest";

import {
  avecDelaiDeConnexion,
  codePrisma,
  doitReessayer,
} from "../../../scripts/lib/delai-connexion";

describe("avecDelaiDeConnexion", () => {
  it("ajoute connect_timeout quand il est absent", () => {
    expect(avecDelaiDeConnexion("postgresql://u:p@h:5432/b", 30)).toBe(
      "postgresql://u:p@h:5432/b?connect_timeout=30",
    );
  });

  it("ne change JAMAIS une valeur déjà posée", () => {
    const sortie = avecDelaiDeConnexion(
      "postgresql://u:p@h:5432/b?connect_timeout=9",
      30,
    );
    expect(sortie).toContain("connect_timeout=9");
    expect(sortie).not.toContain("connect_timeout=30");
  });

  it("conserve les AUTRES paramètres", () => {
    const sortie = avecDelaiDeConnexion(
      "postgresql://u:p@h:5432/b?sslmode=require",
      30,
    );
    expect(sortie).toContain("sslmode=require");
    expect(sortie).toContain("connect_timeout=30");
  });

  it("fonctionne sur une URL SANS point d'interrogation", () => {
    expect(avecDelaiDeConnexion("postgresql://u:p@h:5432/b", 30)).toContain(
      "connect_timeout=30",
    );
  });
});

describe("doitReessayer — un seul nouvel essai, et seulement sur P1001", () => {
  it("P1001, première tentative : oui", () => {
    expect(doitReessayer("P1001", 1)).toBe(true);
  });

  it("un autre code, première tentative : non", () => {
    expect(doitReessayer("P2002", 1)).toBe(false);
    expect(doitReessayer(undefined, 1)).toBe(false);
  });

  it("P1001 une DEUXIÈME fois : non — un seul essai", () => {
    expect(doitReessayer("P1001", 2)).toBe(false);
  });
});

describe("codePrisma", () => {
  it("lit errorCode", () => {
    expect(codePrisma({ errorCode: "P1001" })).toBe("P1001");
  });

  it("lit code, à défaut d'errorCode", () => {
    expect(codePrisma({ code: "P1001" })).toBe("P1001");
  });

  it("rend undefined si ni l'un ni l'autre n'est une chaîne", () => {
    expect(codePrisma(new Error("autre chose"))).toBeUndefined();
    expect(codePrisma(null)).toBeUndefined();
    expect(codePrisma(undefined)).toBeUndefined();
  });
});
