import { describe, expect, it } from "vitest";

import { interpreterReponseDepot } from "@/components/planning/pose";
import { interpreterReponseMachine } from "@/components/parc/formulaire-machine";
import type { Envoi } from "@/lib/courriel/message";
import { codeApresEnvoi } from "@/scripts/lib/delivrance-premier-acces";

/**
 * LE GARDIEN — UN APPEL QUI ÉCHOUE NE REND JAMAIS LA BRANCHE DU SUCCÈS
 * (D-06 et D-03, 17/09/2026).
 *
 * ## Le même défaut, à trois endroits sans rapport
 *
 * Le glisser-déposer du planning (D-06) : `reponse.ok` n'était jamais lu, et
 * un corps vide tombait sur la branche du succès. L'ouverture du premier
 * compte (D-03) : `envoi.parti` était calculé, imprimé, puis JETÉ — le code de
 * sortie valait toujours `0`. Le formulaire de création/correction d'une
 * machine (D-06 étendu le 18/09/2026, sur demande explicite de
 * l'exploitation) : même mécanisme que le planning, un TROISIÈME appelant.
 * Trois gestes différents, la même conséquence : **l'écran, ou le flux
 * GitHub, dit que c'est fait quand ce n'est pas fait** (§9, 31/08 — le
 * silence a exactement la forme du succès).
 *
 * ## Ce gardien porte sur le FAIT, pas sur le geste
 *
 * « La réponse est lue » est une exigence sur un GESTE, et un geste vide la
 * satisfait — lire `reponse.ok` dans une variable qu'on n'utilise jamais
 * passerait cette exigence sans rien garder de la faute. Ce qui se mesure
 * ici est le FAIT : **un appel qui échoue ne rend jamais la valeur que rend un
 * appel qui réussit.** Chaque cas de faute porte donc son JUMEAU — un appel
 * qui réussit VRAIMENT, ou un cas qui doit rester au code de succès pour SA
 * PROPRE raison — pour prouver que la fonction ne rougit pas partout par
 * accident (§9, 24/08 et 11/09).
 *
 * ## Ce que ce gardien ne remplace pas
 *
 * Il n'éprouve pas l'écran ni le flux GitHub : `tests/unit/planning/pose.test.tsx`
 * et `tests/unit/scripts/delivrance-premier-acces.test.ts` le font, chacun à
 * son endroit. Celui-ci éprouve le CALCUL du verdict, seul, sans navigateur ni
 * processus — c'est ce qui le rend rejouable pour tout futur appelant de ces
 * deux fonctions.
 */

describe("le glisser-déposer du planning (D-06)", () => {
  it("JUMEAU — une réponse qui réussit VRAIMENT rend la branche du succès", () => {
    const issue = interpreterReponseDepot({
      ok: true,
      corps: { accepte: true, cle: null, avertissements: null },
    });
    expect(issue.issue).toBe("enregistre");
  });

  it("un code HTTP d'échec ne rend jamais « enregistre »", () => {
    const issue = interpreterReponseDepot({ ok: false, corps: null });
    expect(issue.issue).not.toBe("enregistre");
  });

  it("un corps VIDE malgré un 200 ne rend jamais « enregistre » — le défaut mesuré, tel quel", () => {
    // C'est EXACTEMENT le défaut mesuré : `.json().catch(() => null)` faisait
    // tomber une réponse illisible sur la branche du succès.
    const issue = interpreterReponseDepot({ ok: true, corps: null });
    expect(issue.issue).not.toBe("enregistre");
  });

  it("un corps sans la forme que la route rend toujours ne rend jamais « enregistre »", () => {
    const issue = interpreterReponseDepot({
      ok: true,
      corps: { autreChose: true },
    });
    expect(issue.issue).not.toBe("enregistre");
  });

  it("l'ABSENCE de réponse — le `fetch` a rejeté — ne rend jamais « enregistre »", () => {
    const issue = interpreterReponseDepot(null);
    expect(issue.issue).not.toBe("enregistre");
  });

  it("JUMEAU — un refus MÉTIER reste un refus, jamais confondu avec les deux issues techniques", () => {
    const issue = interpreterReponseDepot({
      ok: true,
      corps: {
        accepte: false,
        cle: "intervention.refus.chevauchement",
        avertissements: null,
      },
    });
    expect(issue).toEqual({
      issue: "refuse",
      cle: "intervention.refus.chevauchement",
    });
  });

  it("les quatre issues portent des noms tous DIFFÉRENTS — jamais deux qui se ressemblent", () => {
    const noms = new Set(
      [
        interpreterReponseDepot({
          ok: true,
          corps: { accepte: true, cle: null, avertissements: null },
        }),
        interpreterReponseDepot({
          ok: true,
          corps: { accepte: false, cle: "intervention.refus.inconnue" },
        }),
        interpreterReponseDepot({ ok: false, corps: null }),
        interpreterReponseDepot(null),
      ].map((issue) => issue.issue),
    );
    expect(noms.size).toBe(4);
  });
});

describe("le formulaire de création/correction d'une machine (D-06, étendu le 18/09/2026)", () => {
  // Même défaut à éprouver, sur un TROISIÈME appelant : `FormulaireMachine`
  // (`components/parc/formulaire-machine.tsx`), qui reprend le mécanisme du
  // planning sur demande explicite de l'exploitation. Voir
  // `tests/unit/ui/lot-parc.test.ts` pour la mesure à l'écran ; celle-ci
  // n'éprouve que le calcul, comme les deux blocs ci-dessus.
  it("JUMEAU — une réponse qui réussit VRAIMENT rend « enregistre »", () => {
    const issue = interpreterReponseMachine({
      ok: true,
      corps: { accepte: true, cle: null, id: "m-1" },
    });
    expect(issue.issue).toBe("enregistre");
  });

  it("un code HTTP d'échec ne rend jamais « enregistre »", () => {
    const issue = interpreterReponseMachine({ ok: false, corps: null });
    expect(issue.issue).not.toBe("enregistre");
  });

  it("un corps VIDE malgré un 200 ne rend jamais « enregistre »", () => {
    const issue = interpreterReponseMachine({ ok: true, corps: null });
    expect(issue.issue).not.toBe("enregistre");
  });

  it("l'ABSENCE de réponse ne rend jamais « enregistre »", () => {
    const issue = interpreterReponseMachine(null);
    expect(issue.issue).not.toBe("enregistre");
  });

  it("JUMEAU — un refus MÉTIER reste un refus, jamais confondu avec les deux issues techniques", () => {
    const issue = interpreterReponseMachine({
      ok: true,
      corps: {
        accepte: false,
        cle: "machine.refus.numero_serie_pris",
        id: null,
      },
    });
    expect(issue).toEqual({
      issue: "refuse",
      cle: "machine.refus.numero_serie_pris",
    });
  });
});

describe("l'ouverture du premier compte (D-03)", () => {
  const PARTI: Envoi = { parti: true, reference: "abc-123" };
  const REFUSE: Envoi = { parti: false, motif: "Resend a refusé l'envoi." };

  it("JUMEAU — un envoi qui part VRAIMENT rend le code de succès", () => {
    expect(codeApresEnvoi(PARTI)).toBe(0);
  });

  it("JUMEAU — aucun envoi demandé reste au code de succès, pour sa propre raison", () => {
    expect(codeApresEnvoi(null)).toBe(0);
  });

  it("un envoi REFUSÉ par le prestataire ne rend jamais le code de succès", () => {
    expect(codeApresEnvoi(REFUSE)).not.toBe(0);
  });
});
