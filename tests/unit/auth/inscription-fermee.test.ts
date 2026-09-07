import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  CHEMINS_FERMES,
  CHEMINS_INSCRIPTION,
  estCheminFerme,
  estCheminInscription,
} from "../../../lib/auth/inscription-fermee";

/**
 * L'INSCRIPTION EN LIBRE-SERVICE N'EXISTE PAS (ticket L1-02c).
 *
 * *Personne ne crée son propre compte. Jamais, dans aucun mode.* Ce n'est pas
 * une restriction, c'est le métier — et c'est une décision d'exploitation du
 * 07/09/2026.
 *
 * **Ce que ce gardien répare, et il a été mesuré.** Le gestionnaire de
 * `app/api/auth/[...all]/route.ts` est un ATTRAPE-TOUT : il exposait
 * `/sign-up/email` sans que personne l'ait décidé, et son propre commentaire
 * annonçait « inscription » parmi ce qu'il sert. Une surface ouverte par un
 * joker est une surface que personne ne relit.
 */

const ROUTE = readFileSync(
  join(process.cwd(), "app/api/auth/[...all]/route.ts"),
  "utf8",
);

describe("le chemin d'inscription est reconnu", () => {
  it("reconnaît les formes que Better Auth monte réellement", () => {
    expect(estCheminInscription("/api/auth/sign-up/email")).toBe(true);
    expect(estCheminInscription("/api/auth/sign-up")).toBe(true);
    expect(estCheminInscription("/api/auth/sign-up/")).toBe(true);
  });

  it("ne mord PAS sur les chemins voisins — sinon il fermerait la connexion", () => {
    // La contre-épreuve : un gardien qui rougirait sur tout passerait pour
    // juste alors qu'il serait seulement bruyant.
    expect(estCheminInscription("/api/auth/sign-in/email")).toBe(false);
    expect(estCheminInscription("/api/auth/sign-out")).toBe(false);
    expect(estCheminInscription("/api/auth/two-factor/verify")).toBe(false);
    expect(estCheminInscription("/api/auth/two-factor/disable")).toBe(false);
    expect(estCheminInscription("/api/auth/get-session")).toBe(false);
  });

  it("la liste porte ce qui existe, et rien de plus", () => {
    // TÉMOIN DE NON-VACUITÉ : une liste vide reconnaîtrait zéro chemin et ce
    // fichier resterait vert.
    expect(CHEMINS_INSCRIPTION.length).toBeGreaterThan(0);
    expect([...CHEMINS_INSCRIPTION]).toEqual(["/sign-up"]);
  });
});

describe("la gouvernance du second facteur est fermée aussi (L1-02d)", () => {
  it("ferme les DEUX points d'entrée que le sujet ne doit pas atteindre", () => {
    // `/two-factor/disable` retire le second facteur du compte connecté : la
    // transition que D58 refuse d'ouvrir. `/two-factor/enable` part avec lui —
    // l'enrôlement est décidé, mais il s'écrira comme un chemin à nous.
    expect(estCheminFerme("/api/auth/two-factor/disable")).toBe(true);
    expect(estCheminFerme("/api/auth/two-factor/enable")).toBe(true);
    expect(estCheminFerme("/api/auth/sign-up/email")).toBe(true);
  });

  it("laisse la VÉRIFICATION ouverte — la fermer interdirait la connexion", () => {
    // La contre-épreuve, et elle n'est pas décorative : un préfixe `/two-factor`
    // aurait emporté ces chemins, et tout compte portant un second facteur
    // n'aurait plus jamais pu se connecter.
    expect(estCheminFerme("/api/auth/two-factor/verify-totp")).toBe(false);
    expect(estCheminFerme("/api/auth/two-factor/verify-backup-code")).toBe(
      false,
    );
    expect(estCheminFerme("/api/auth/sign-in/email")).toBe(false);
    expect(estCheminFerme("/api/auth/get-session")).toBe(false);
  });

  it("la liste close porte exactement les trois chemins arbitrés", () => {
    // TÉMOIN : une liste vide reconnaîtrait zéro chemin et ce fichier resterait
    // vert.
    expect(CHEMINS_FERMES.length).toBeGreaterThan(0);
    expect([...CHEMINS_FERMES]).toEqual([
      "/sign-up",
      "/two-factor/enable",
      "/two-factor/disable",
    ]);
  });
});

describe("la ROUTE ferme réellement, et le gardien le lit", () => {
  it("le gestionnaire appelle la fermeture avant de déléguer", () => {
    // Le contrôle porte sur le CÂBLAGE : la fonction peut être juste et n'être
    // appelée par personne — c'est la maladie que ce dépôt a nommée sur la
    // veille. On exige donc que les deux verbes la traversent.
    expect(ROUTE).toContain("estCheminFerme");
    for (const verbe of ["GET", "POST"]) {
      const bloc = new RegExp(
        `export async function ${verbe}\\([^)]*\\)[^{]*\\{[\\s\\S]*?\\n\\}`,
      ).exec(ROUTE)?.[0];
      expect(bloc, `le verbe ${verbe} n'a pas été trouvé`).toBeDefined();
      expect(bloc).toContain("fermerInscription");
    }
  });

  it("répond 404, et non 403 — un refus qui explique est un renseignement", () => {
    // D35, et le §9 du 20/08 : « interdit » apprendrait que la route existe et
    // que l'inscription est administrée ailleurs.
    expect(ROUTE).toContain("status: 404");
    expect(ROUTE).not.toContain("status: 403");
  });
});
