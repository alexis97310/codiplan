import { readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";

import { describe, expect, it, vi, afterEach } from "vitest";

import {
  configurationCourriel,
  envoyerCourriel,
  estAdressable,
  VARIABLE_CLE,
  VARIABLE_EXPEDITEUR,
} from "@/lib/courriel";
import { expediteurResend } from "@/lib/courriel/resend";
import { RACINE } from "../outils/fichiers-source";

/**
 * LE CANAL D'ENVOI — il démarre SANS la clé, et il ne ment jamais (Q8).
 *
 * *Ce que ces scénarios gardent, et qu'aucun autre ne garde :* un canal qui
 * échoue en silence est indiscernable d'un canal qui marche, **jusqu'au coup de
 * téléphone**. L'agence croit avoir invité son client, la personne n'a rien
 * reçu, et personne ne le sait. C'est le §9 appliqué à un canal — *le silence a
 * exactement la forme du succès.*
 */

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("un envoi non configuré échoue en NOMMANT ce qui manque", () => {
  it("sans clé ni adresse, il nomme les DEUX variables", async () => {
    const envoi = await envoyerCourriel(
      { destinataire: "quelqu-un@example.test", sujet: "s", texte: "t" },
      {},
    );

    expect(envoi.parti).toBe(false);
    if (envoi.parti) {
      return;
    }
    expect(envoi.motif).toContain(VARIABLE_CLE);
    expect(envoi.motif).toContain(VARIABLE_EXPEDITEUR);
    // ET IL DIT QU'IL N'A RIEN ENVOYÉ. « L'envoi a échoué » laisse la question
    // ouverte ; le lecteur doit savoir s'il peut recommencer.
    expect(envoi.motif).toMatch(/RIEN N'A ÉTÉ ENVOYÉ/);
    // Et où trouver la marche à suivre, pour quelqu'un qui lit sur un téléphone.
    expect(envoi.motif).toContain("docs/mise-en-ligne.md");
  });

  it("avec la clé mais sans adresse, il ne nomme QUE ce qui manque", async () => {
    const envoi = await envoyerCourriel(
      { destinataire: "quelqu-un@example.test", sujet: "s", texte: "t" },
      { [VARIABLE_CLE]: "une-valeur-quelconque" },
    );

    expect(envoi.parti).toBe(false);
    if (envoi.parti) {
      return;
    }
    expect(envoi.motif).toContain(VARIABLE_EXPEDITEUR);
    // LE CAS QUI DOIT RESTER JUSTE POUR SA PROPRE RAISON : nommer les deux
    // quand une seule manque enverrait chercher une variable déjà posée.
    expect(envoi.motif).not.toContain(VARIABLE_CLE);
  });

  it("configuré, il rend bien un expéditeur", () => {
    // TÉMOIN : sans lui, les deux scénarios ci-dessus seraient verts sur un
    // module qui refuse TOUJOURS, ce qui ne prouverait rien.
    const configuration = configurationCourriel({
      [VARIABLE_CLE]: "une-valeur-quelconque",
      [VARIABLE_EXPEDITEUR]: "codiplan@example.test",
    });
    expect(configuration.configure).toBe(true);
  });
});

describe("le transport ne fait jamais croire qu'un message est parti", () => {
  const courriel = {
    destinataire: "quelqu-un@example.test",
    sujet: "Votre accès",
    texte: "https://example.test/premier-acces?jeton=…",
  };

  it("un refus du prestataire est un échec NOMMÉ, jamais une exception", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 422 })),
    );
    const envoi = await expediteurResend("cle", "de@example.test").envoyer(
      courriel,
    );

    expect(envoi.parti).toBe(false);
    if (!envoi.parti) {
      expect(envoi.motif).toContain("422");
      expect(envoi.motif).toMatch(/RIEN N'A ÉTÉ ENVOYÉ/);
    }
  });

  it("un 2xx SANS référence n'est pas un succès — « je ne sais pas » se dit", async () => {
    // C'est le cas qu'on serait tenté de compter comme réussi : le prestataire
    // a répondu 200. Mais sans référence, on ne peut rien retrouver chez lui le
    // jour où quelqu'un dit n'avoir rien reçu.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 200 })),
    );
    const envoi = await expediteurResend("cle", "de@example.test").envoyer(
      courriel,
    );

    expect(envoi.parti).toBe(false);
    if (!envoi.parti) {
      expect(envoi.motif).toMatch(/sans référence/);
    }
  });

  it("le réseau muet est un échec NOMMÉ, jamais un silence", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("TimeoutError");
      }),
    );
    const envoi = await expediteurResend("cle", "de@example.test").envoyer(
      courriel,
    );

    expect(envoi.parti).toBe(false);
    if (!envoi.parti) {
      expect(envoi.motif).toMatch(/RIEN N'A ÉTÉ ENVOYÉ/);
    }
  });

  it("et un envoi réussi rend sa référence — sans quoi rien de ce qui précède ne prouverait rien", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ id: "abc-123" }), { status: 200 }),
      ),
    );
    const envoi = await expediteurResend("cle", "de@example.test").envoyer(
      courriel,
    );

    expect(envoi.parti).toBe(true);
    if (envoi.parti) {
      expect(envoi.reference).toBe("abc-123");
    }
  });

  it("la CLÉ ne sort jamais dans un motif de refus", async () => {
    // Le dépôt est PUBLIC et les journaux d'exécution le sont aussi : un secret
    // recopié dans un message de refus est un secret perdu (I9, D50).
    const secret = "cle-qui-ne-doit-jamais-paraitre";
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(`{"message":"clé ${secret} invalide"}`, { status: 401 }),
      ),
    );
    const envoi = await expediteurResend(secret, "de@example.test").envoyer(
      courriel,
    );

    expect(envoi.parti).toBe(false);
    if (!envoi.parti) {
      expect(envoi.motif).not.toContain(secret);
      expect(envoi.motif).toContain("401");
    }
  });

  it("une adresse inadressable est refusée AVANT tout appel réseau", async () => {
    const appel = vi.fn();
    vi.stubGlobal("fetch", appel);
    const envoi = await expediteurResend("cle", "de@example.test").envoyer({
      ...courriel,
      destinataire: "pas une adresse",
    });

    expect(envoi.parti).toBe(false);
    expect(appel).not.toHaveBeenCalled();
  });
});

describe("le contrôle d'adresse est grossier, et c'est une décision", () => {
  it("il laisse passer ce qu'il ne sait pas juger", () => {
    // Refuser une adresse légitime coûte plus cher que de laisser le
    // prestataire rendre son refus : lui, il sait.
    expect(estAdressable("prenom+etiquette@sous.domaine.nc")).toBe(true);
    expect(estAdressable("a@b.c")).toBe(true);
  });

  it("il refuse ce qui ne peut pas être une adresse", () => {
    expect(estAdressable("")).toBe(false);
    expect(estAdressable("sans-arobase")).toBe(false);
    expect(estAdressable("avec espace@example.test")).toBe(false);
  });
});

/**
 * AUCUN SECRET DANS LE DÉPÔT — I9, et le dépôt est PUBLIC depuis le 12/09/2026.
 *
 * Le gardien lit le module et exige qu'il ne connaisse que des NOMS de
 * variables. *Une clé « de test » déposée en commentaire est une clé déposée* —
 * et celui qui l'y met est toujours certain qu'elle ne vaut rien.
 */
describe("le module d'envoi ne porte aucun secret", () => {
  const FICHIERS = readdirSync(join(RACINE, "lib", "courriel")).map((nom) =>
    join(RACINE, "lib", "courriel", nom),
  );

  it("la population n'est pas vide", () => {
    expect(FICHIERS.length).toBeGreaterThan(2);
  });

  it("aucune clé, aucun jeton, aucun mot de passe écrit", () => {
    for (const fichier of FICHIERS) {
      const source = readFileSync(fichier, "utf8");
      // Les formes qu'un secret de service prend : une clé Resend, un jeton
      // porteur écrit en clair, un mot de passe d'application.
      expect(source, `${fichier} porte une clé en clair`).not.toMatch(
        /re_[A-Za-z0-9_]{8,}/,
      );
      expect(source, `${fichier} porte un jeton porteur en clair`).not.toMatch(
        /Bearer\s+[A-Za-z0-9._-]{12,}/,
      );
    }
  });

  it("un SEUL fichier connaît le prestataire", () => {
    // Ce qui rend le prestataire remplaçable : le jour où l'on en change, c'est
    // ce fichier qu'on remplace, et rien d'autre.
    const connaissent = FICHIERS.filter((fichier) =>
      /api\.resend\.com/.test(readFileSync(fichier, "utf8")),
    );
    // `basename`, jamais `split("/")` : le chemin vient de `join`, qui écrit
    // `\` sous Windows — le nom du fichier n'y serait jamais isolé, et la
    // comparaison rougirait sur un module sain (PORTABILITE-1, 22/09/2026).
    expect(connaissent.map((f) => basename(f))).toEqual(["resend.ts"]);
  });
});
