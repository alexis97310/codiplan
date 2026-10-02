import { describe, expect, it, vi } from "vitest";

import {
  avecDelaiDeConnexion,
  codePrisma,
  connecterAvecReessai,
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

  it("NE RÉ-ENCODE PAS un paramètre déjà présent, à l'octet près (constat du 02/10/2026, relecture 9CR)", () => {
    const sortie = avecDelaiDeConnexion(
      "postgresql://u:p@h:5432/b?options=-c%20x",
      30,
    );
    expect(sortie).toBe(
      "postgresql://u:p@h:5432/b?options=-c%20x&connect_timeout=30",
    );
  });

  it("conserve plusieurs AUTRES paramètres intacts, dans leur ordre", () => {
    const sortie = avecDelaiDeConnexion(
      "postgresql://u:p@h:5432/b?pgbouncer=true&sslmode=require",
      30,
    );
    expect(sortie).toBe(
      "postgresql://u:p@h:5432/b?pgbouncer=true&sslmode=require&connect_timeout=30",
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

function erreurPrisma(code: string): Error {
  return Object.assign(new Error(code), { code });
}

describe("connecterAvecReessai — la boucle réelle, dépendances injectées (relecture 9CR)", () => {
  it("succès direct : 1 appel, 0 attente", async () => {
    const connecter = vi.fn().mockResolvedValue(undefined);
    const attendre = vi.fn().mockResolvedValue(undefined);
    const ecrire = vi.fn();

    await connecterAvecReessai(1, connecter, attendre, ecrire);

    expect(connecter).toHaveBeenCalledTimes(1);
    expect(attendre).not.toHaveBeenCalled();
  });

  it("P1001 puis succès : 2 appels, 1 attente", async () => {
    const connecter = vi
      .fn()
      .mockRejectedValueOnce(erreurPrisma("P1001"))
      .mockResolvedValueOnce(undefined);
    const attendre = vi.fn().mockResolvedValue(undefined);
    const ecrire = vi.fn();

    await connecterAvecReessai(1, connecter, attendre, ecrire);

    expect(connecter).toHaveBeenCalledTimes(2);
    expect(attendre).toHaveBeenCalledTimes(1);
    expect(ecrire).toHaveBeenCalledTimes(1);
  });

  it("P1001 deux fois de suite : l'erreur remonte après 2 appels, pas de troisième essai", async () => {
    const erreur = erreurPrisma("P1001");
    const connecter = vi.fn().mockRejectedValue(erreur);
    const attendre = vi.fn().mockResolvedValue(undefined);
    const ecrire = vi.fn();

    await expect(
      connecterAvecReessai(1, connecter, attendre, ecrire),
    ).rejects.toThrow(erreur);
    expect(connecter).toHaveBeenCalledTimes(2);
    expect(attendre).toHaveBeenCalledTimes(1);
  });

  it("un autre code (ex. P1000) : aucune nouvelle tentative, l'erreur remonte tout de suite", async () => {
    const erreur = erreurPrisma("P1000");
    const connecter = vi.fn().mockRejectedValue(erreur);
    const attendre = vi.fn().mockResolvedValue(undefined);
    const ecrire = vi.fn();

    await expect(
      connecterAvecReessai(1, connecter, attendre, ecrire),
    ).rejects.toThrow(erreur);
    expect(connecter).toHaveBeenCalledTimes(1);
    expect(attendre).not.toHaveBeenCalled();
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
