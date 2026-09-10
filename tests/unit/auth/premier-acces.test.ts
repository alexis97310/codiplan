import { describe, expect, it } from "vitest";

import {
  LONGUEUR_MINIMALE,
  choisirLePremierMotDePasse,
} from "@/lib/auth/premier-acces";
import { estCleTraduction } from "@/lib/i18n/fr";

/**
 * LE PREMIER ACCÈS — les refus qui ne parlent QUE de la saisie.
 *
 * ## Ce que ce fichier peut éprouver, et ce qu'il ne peut pas
 *
 * Les deux contrôles de saisie — discordance, longueur — répondent **avant**
 * toute lecture de base : ils ne disent rien de l'existence d'un compte, et ils
 * ne consomment pas le jeton. C'est précisément pourquoi ils se mesurent ici,
 * sans base. La consommation du jeton, elle, est un scénario d'ISOLATION :
 * elle traverse la bibliothèque et les politiques.
 *
 * ## L'ORDRE EST UNE GARANTIE, PAS UNE COMMODITÉ
 *
 * Une discordance qui aurait brûlé le jeton obligerait à en redemander un pour
 * une faute de frappe — et un jeton de premier accès se transmet hors bande,
 * donc il coûte un aller-retour humain. Le test ci-dessous le mesure sur un
 * jeton **manifestement invalide** : si la saisie était contrôlée après le
 * jeton, l'issue serait `refuse` et non `discordance`.
 */
describe("premier accès — les refus de saisie", () => {
  const JETON_QUI_N_EXISTE_PAS = "jeton-de-scenario-jamais-emis";

  it("refuse deux saisies discordantes SANS toucher au jeton", async () => {
    const issue = await choisirLePremierMotDePasse({
      jeton: JETON_QUI_N_EXISTE_PAS,
      motDePasse: "MotDePasseAssezLong1",
      confirmation: "MotDePasseAssezLong2",
    });
    // `discordance` et non `refuse` : la preuve que le jeton n'a pas été lu.
    expect(issue.issue).toBe("discordance");
  });

  it("refuse un mot de passe trop court, et l'ordre le prouve aussi", async () => {
    const trop = "a".repeat(LONGUEUR_MINIMALE - 1);
    const issue = await choisirLePremierMotDePasse({
      jeton: JETON_QUI_N_EXISTE_PAS,
      motDePasse: trop,
      confirmation: trop,
    });
    expect(issue.issue).toBe("trop_court");
  });

  it("la longueur EXACTE passe le contrôle de saisie — le cas qui doit rester vert", async () => {
    // §9, 11/09 : à côté de chaque cas qui doit rougir, un cas qui doit rester
    // vert POUR SA PROPRE RAISON. Ici le plancher est atteint tout juste ; la
    // saisie ne peut donc plus refuser, et seule une DISCORDANCE le peut
    // encore. Sans cette paire, un contrôle qui refuserait TOUT resterait
    // indiscernable d'un contrôle qui refuse les mots de passe courts.
    const juste = "a".repeat(LONGUEUR_MINIMALE);
    const issue = await choisirLePremierMotDePasse({
      jeton: JETON_QUI_N_EXISTE_PAS,
      motDePasse: juste,
      confirmation: `${juste}x`,
    });
    expect(issue.issue).toBe("discordance");
    // *Ce que ce fichier NE PEUT PAS mesurer, et qui est écrit plutôt que tu :*
    // ce qu'il advient d'un jeton réellement présenté. La longueur exacte avec
    // deux saisies IDENTIQUES atteindrait la bibliothèque et la base — c'est un
    // scénario d'isolation, `tests/isolation/premier-acces.test.ts`.
  });

  it("un jeton vide est refusé comme un jeton faux — aucun oracle", async () => {
    const issue = await choisirLePremierMotDePasse({
      jeton: "   ",
      motDePasse: "MotDePasseAssezLong",
      confirmation: "MotDePasseAssezLong",
    });
    expect(issue.issue).toBe("refuse");
  });

  it("chaque issue a son libellé au dictionnaire — la coupure de L0-11", async () => {
    // Le motif voyage sous forme de CLÉ jusqu'à l'écran ; une issue sans clé
    // rendrait une page muette là où quelqu'un attend une explication.
    const issues = [
      "abouti",
      "discordance",
      "trop_court",
      "refuse",
      "sans_jeton",
    ];
    expect(issues.length).toBeGreaterThan(0);
    for (const issue of issues) {
      expect(estCleTraduction(`premier_acces.${issue}`)).toBe(true);
    }
    // TÉMOIN — la fonction sait dire NON : sans lui, un `estCleTraduction` qui
    // rendrait toujours vrai laisserait la boucle ci-dessus sans objet.
    expect(estCleTraduction("premier_acces.cle_qui_n_existe_pas")).toBe(false);
  });
});
