import { describe, expect, it } from "vitest";

import { fr, type CleTraduction } from "@/lib/i18n/fr";

/**
 * AUCUNE RÉFÉRENCE DE TICKET OU D'INVARIANT DANS LE GLOSSAIRE — VISUEL-1
 * (23/09/2026).
 *
 * ## Ce que ce gardien répare
 *
 * *Mesuré en production le 23/09/2026, sur un compte `admin_societe` :* le
 * tableau de bord affichait « R2-13 », la fiche machine affichait « (L8-05) »,
 * `/imports` affichait « (L1-09) ». Une référence de ticket ou d'invariant est
 * un mot du DÉVELOPPEUR — elle vit dans un commentaire, une trace, un message
 * de gardien (CLAUDE.md §5, la coupure de `lib/i18n/fr.ts`) — et n'a aucune
 * valeur pour la personne qui la lit à l'écran en travaillant. C'est la même
 * famille de faute que le jargon technique dans un message d'erreur RENDU : le
 * texte a changé de destination sans changer de forme.
 *
 * ## Le motif, exactement celui du ticket
 *
 * `\b[A-Z]{1,2}\d{1,2}(-\d{2})?\b`, et seulement quand il apparaît ENTRE
 * PARENTHÈSES ou EN FIN DE PHRASE — jamais n'importe où dans le texte. C'est
 * ce qui distingue une fuite (« … reste à écrire (L1-09). ») d'une étiquette
 * métier légitime qui a la même forme mais pas la même place (« P1 —
 * critique », où « P1 » ouvre la phrase, jamais ne la clôt ni ne se love entre
 * parenthèses).
 *
 * ## Pas de liste d'admis, une liste d'EXEMPTIONS fermée dans les deux sens
 *
 * Le gardien part de TOUT `fr.ts`, comme celui de L0-11 part de tout le dépôt
 * (§9, 01/09) — pas d'annuaire de clés à tenir d'accord. La seule clé
 * légitime mesurée aujourd'hui, `planning.legende.en_cours` (« En cours /
 * P1 »), est nommée avec son motif dans `EXEMPTIONS` ci-dessous. Une
 * exemption qui ne correspond plus à rien — la clé a disparu, ou son texte ne
 * porte plus la forme qu'elle excusait — fait rougir le gardien au même titre
 * qu'une fuite non exemptée : une exemption qui ne protège plus rien est une
 * exemption qui ment.
 */

/** Une référence de ticket ou d'invariant : `L1-09`, `I8`, `R2-13`, `D124`… */
const REFERENCE = /\b[A-Z]{1,2}\d{1,2}(?:-\d{2})?\b/;

/** Vrai si une référence apparaît DANS un groupe entre parenthèses. */
function fuiteEntreParentheses(texte: string): boolean {
  const groupes = texte.match(/\(([^()]*)\)/g) ?? [];
  return groupes.some((groupe) => REFERENCE.test(groupe));
}

/** Vrai si le DERNIER mot du texte, ponctuation finale ôtée, EST une référence. */
function fuiteEnFinDePhrase(texte: string): boolean {
  const mots = texte
    .trim()
    .replace(/[.!?:]+$/, "")
    .split(/\s+/);
  const dernier = mots[mots.length - 1] ?? "";
  return new RegExp(`^${REFERENCE.source}$`).test(dernier);
}

function porteUneReference(texte: string): boolean {
  return fuiteEntreParentheses(texte) || fuiteEnFinDePhrase(texte);
}

/**
 * Liste close des clés LÉGITIMEMENT concernées par le motif, chacune avec son
 * motif. Fermée dans les deux sens — voir la dernière assertion.
 */
const EXEMPTIONS: Readonly<Record<string, string>> = {
  "planning.legende.en_cours":
    "« P1 » est l'étiquette de priorité affichée dans la légende du planning, jamais une référence de ticket — elle ferme la phrase par construction (« En cours / P1 »).",
};

describe("aucune référence de ticket ou d'invariant dans le glossaire (VISUEL-1)", () => {
  it("témoin : le motif détecte bien une fuite connue avant correction", () => {
    // Sans ce témoin, un motif qui ne détecterait plus rien laisserait passer
    // silencieusement toutes les fuites (§9, 06/09).
    expect(fuiteEntreParentheses("Reste à écrire (L1-09).")).toBe(true);
    expect(fuiteEnFinDePhrase("Voir I8")).toBe(true);
    // Et la paire qui doit rester verte pour sa propre raison : une étiquette
    // de priorité en tête de phrase n'est ni entre parenthèses ni en fin de
    // phrase.
    expect(porteUneReference("P1 — critique")).toBe(false);
  });

  it("aucune valeur du glossaire ne porte une référence interne, hors exemption nommée", () => {
    const fautives = Object.entries(fr)
      .filter(([cle, valeur]) => porteUneReference(valeur) && !(cle in EXEMPTIONS))
      .map(([cle, valeur]) => `${cle} → ${valeur}`);
    expect(fautives).toEqual([]);
  });

  it("chaque exemption est ADOSSÉE à une clé qui existe et qui porte réellement le motif", () => {
    const perimees = Object.keys(EXEMPTIONS).filter((cle) => {
      const valeur = fr[cle as CleTraduction] as string | undefined;
      return valeur === undefined || !porteUneReference(valeur);
    });
    expect(perimees).toEqual([]);
  });
});
