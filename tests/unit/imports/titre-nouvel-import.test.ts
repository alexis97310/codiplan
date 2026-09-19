import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { fr, t } from "@/lib/i18n/fr";

/**
 * D-02 — LE TITRE DE LA CARTE « NOUVEL IMPORT » N'ANNONCE PLUS UN TYPE QUE
 * L'ÉCRAN NE CHOISIT PAS (19/09/2026, file des défauts).
 *
 * ## Le défaut mesuré, AVANT ce lot
 *
 * La carte de dépôt portait le titre `imports.nouveau_titre`, qui vaut
 * « Nouvel import — Clients ». **Aucun sélecteur de type n'existe sur cet
 * écran** — le formulaire ne propose qu'un champ fichier — et c'est la
 * première cellule du classeur déposé qui dit de quel import il s'agit :
 * `imports.fichier_aide`, affiché trois centimètres plus bas, le dit
 * correctement (« La première cellule porte le marqueur du modèle : c'est lui
 * qui dit de quel import il s'agit »). Le titre contredisait donc, à trois
 * centimètres, l'explication qui le suit.
 *
 * ## La correction, et pourquoi une clé plutôt qu'une réécriture
 *
 * L'écran lit désormais `imports.nouveau_titre_generique` (« Nouvel import »,
 * sans type nommé). `imports.nouveau_titre` reste dans le dictionnaire,
 * inutilisée : la consigne de ce lot interdisait de réécrire une clé
 * existante de `lib/i18n/fr.ts`, ce fichier étant sous écriture concurrente
 * par d'autres sessions.
 *
 * ## Ce que ce gardien tient, à la fois AVANT et APRÈS
 *
 * Il ne suffit pas que le nouveau titre soit vrai : il faut que la valeur
 * AFFICHÉE par l'écran — celle que `page.tsx` cite réellement — soit la bonne.
 * Une correction qui aurait changé `imports.nouveau_titre_generique` sans
 * jamais brancher l'écran dessus serait un correctif inerte ; c'est pourquoi
 * ce gardien lit le SOURCE de l'écran, pas seulement le dictionnaire.
 */

const PAGE = join(process.cwd(), "app/(back-office)/imports/page.tsx");

function sourceDeLecran(): string {
  return readFileSync(PAGE, "utf8");
}

describe("D-02 — le titre de « Nouvel import » n'annonce aucun type", () => {
  it("TÉMOIN — le défaut mesuré existe encore dans le dictionnaire, inchangé", () => {
    // La clé fautive n'a pas été réécrite (consigne du lot) : elle porte
    // encore, mot pour mot, le titre qui nommait un type. Si cette assertion
    // rougit, quelqu'un a réécrit la clé qu'il ne fallait pas toucher.
    expect(fr["imports.nouveau_titre"]).toBe("Nouvel import — Clients");
  });

  it("l'écran cite désormais la clé générique, jamais la clé fautive", () => {
    const source = sourceDeLecran();
    expect(source).toContain('t("imports.nouveau_titre_generique")');
    expect(source).not.toContain('t("imports.nouveau_titre")');
  });

  it("le titre réellement affiché ne nomme plus un type précis", () => {
    const titreAffiche = t("imports.nouveau_titre_generique");
    // Aucun des cinq types nommables (Clients, Contacts, Sites, Modèles,
    // Prestations, Familles, Équipements) ne doit apparaître dans le titre :
    // un titre qui en nommerait un SEUL referait exactement le défaut mesuré.
    for (const type of [
      "Client",
      "Contact",
      "Modèle",
      "Prestation",
      "Famille",
      "Équipement",
    ]) {
      expect(titreAffiche).not.toContain(type);
    }
  });

  it("JUMEAU — le texte d'aide, lui, dit toujours correctement ce qui décide du type", () => {
    // Ce texte n'était pas fautif ; il ne doit pas avoir bougé sous ce lot.
    expect(t("imports.fichier_aide")).toContain("marqueur du modèle");
  });

  it("AUCUN sélecteur de type n'existe sur cet écran — la prémisse du défaut", () => {
    const source = sourceDeLecran();
    // Le formulaire de dépôt ne porte qu'un champ fichier ; un sélecteur de
    // type ressemblerait à un <select> ou un input radio nommé "type".
    const formulaire = source.slice(
      source.indexOf('action="/api/imports/controler"'),
      source.indexOf("</form>"),
    );
    expect(formulaire).not.toMatch(/<select|type="radio"/);
  });
});
