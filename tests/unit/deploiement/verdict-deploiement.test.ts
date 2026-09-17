import { describe, expect, it } from "vitest";

import { commitDeploye, reponseMachine, type EtatSante } from "@/lib/db/sante";

import {
  CODE_DE_SORTIE,
  NATURES_A_REESSAYER,
  pageBloqueeAuChargement,
  verdictDeLaPage,
  verdictDuDeploiement,
  type NatureVerdict,
} from "../../../scripts/lib/verdict-deploiement";

/**
 * R3-01 — LA VÉRIFICATION APRÈS DÉPLOIEMENT.
 *
 * Trois pannes de production en deux jours, **toutes la même** : du code sur
 * `main` qui lit une colonne qu'une migration non appliquée devait créer. La
 * première a duré 4 h 03 ; la troisième a été découverte par un écran blanc.
 * *Une sonde que personne n'ouvre ne sonne pas* — ces scénarios éprouvent ce qui
 * l'ouvre.
 *
 * **Chaque verdict est éprouvé dans les DEUX directions** (§9, 11/09) : un cas
 * qui doit le rendre, et un cas voisin qui doit rendre autre chose POUR SA
 * PROPRE RAISON. *Toutes mes mises en échec faisaient rougir le gardien ; aucune
 * ne vérifiait qu'un vert était mérité.*
 */

const COMMIT = "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0";
const AUTRE_COMMIT = "0123456789abcdef0123456789abcdef01234567";

/** Un corps de réponse conforme au contrat, que chaque scénario déforme. */
function corps(
  options: {
    base?: boolean;
    role?: boolean;
    migrations?: boolean;
    detailMigrations?: string | null;
    detailBase?: string | null;
    commit?: string | null;
  } = {},
): string {
  return JSON.stringify({
    ok: (options.base ?? true) && (options.migrations ?? true),
    commit: options.commit === undefined ? COMMIT : options.commit,
    baseJointe: {
      ok: options.base ?? true,
      detail: options.detailBase ?? null,
    },
    roleApplicatif: {
      ok: options.role ?? true,
      detail:
        (options.role ?? true)
          ? null
          : "Le rôle connecté n'est pas « codiplan_app ».",
    },
    migrations: {
      ok: options.migrations ?? true,
      detail: options.detailMigrations ?? null,
    },
  });
}

const ADRESSE = "https://exemple.invalid";

describe("le verdict du déploiement", () => {
  it("rend « sain » quand tout répond et que c'est bien le commit visé", () => {
    const verdict = verdictDuDeploiement({
      adresse: ADRESSE,
      corps: corps(),
      commitAttendu: COMMIT,
    });
    expect(verdict.nature).toBe("sain");
    expect(verdict.geste).toBeNull();
    // Le vert NOMME ce qu'il a mesuré : un « sain » qui ne dit pas sur quel
    // code il porte est exactement le vert qu'on ne peut pas vérifier.
    expect(verdict.detail).toContain("a1b2c3d");
  });

  it("rend « migration_manquante » et NOMME le geste, pas la migration à jouer à sa place", () => {
    const verdict = verdictDuDeploiement({
      adresse: ADRESSE,
      corps: corps({
        migrations: false,
        detailMigrations:
          "Une migration n'est pas appliquée : 20260913190000_trajet_par_zone_r3_03.",
      }),
      commitAttendu: COMMIT,
    });
    expect(verdict.nature).toBe("migration_manquante");
    // Le détail de la sonde est recopié TEL QUEL : c'est elle qui sait laquelle.
    expect(verdict.detail).toContain("20260913190000_trajet_par_zone_r3_03");
    expect(verdict.geste).toContain("DB migrate & seed");
    expect(verdict.geste).toContain("demonstration");
    // R3-01, en toutes lettres : le contrôle ne migre pas tout seul.
    expect(verdict.geste).toContain("Run workflow");
  });

  it("distingue « base_injoignable » de « migration_manquante » — deux gestes, deux causes", () => {
    const injoignable = verdictDuDeploiement({
      adresse: ADRESSE,
      corps: corps({
        base: false,
        migrations: false,
        detailBase: "La base de données ne répond pas.",
      }),
      commitAttendu: COMMIT,
    });
    // La base précède les migrations : sans base, leur verdict ne repose sur rien.
    expect(injoignable.nature).toBe("base_injoignable");
    expect(injoignable.geste).not.toContain("DB migrate & seed");
  });

  it("rend « role_inattendu » — une clé passe-partout en production, pas une panne", () => {
    // Une application connectée sous le rôle de MIGRATION contourne les
    // politiques RLS par nature (I1) : tout le cloisonnement tombe, et rien à
    // l'écran ne le dirait. Le ranger sous « la base ne répond pas » enverrait
    // chercher un incident de liaison là où il y a une clé passe-partout.
    const verdict = verdictDuDeploiement({
      adresse: ADRESSE,
      corps: corps({ role: false, migrations: false }),
      commitAttendu: COMMIT,
    });
    expect(verdict.nature).toBe("role_inattendu");
    expect(verdict.geste).toContain("codiplan_app");
    // LE RÔLE PRÉCÈDE LES MIGRATIONS : sous un rôle privilégié, tout ce qui
    // suit est mesuré par une identité qui voit tout.
    expect(verdict.nature).not.toBe("migration_manquante");

    // Et la base précède le rôle : sans base, le rôle n'est pas davantage lu.
    expect(
      verdictDuDeploiement({
        adresse: ADRESSE,
        corps: corps({ base: false, role: false, migrations: false }),
        commitAttendu: COMMIT,
      }).nature,
    ).toBe("base_injoignable");
  });

  it("rend « application_muette » quand rien n'a répondu, et ne conclut RIEN sur la base", () => {
    const verdict = verdictDuDeploiement({
      adresse: ADRESSE,
      corps: null,
      commitAttendu: COMMIT,
    });
    expect(verdict.nature).toBe("application_muette");
    // Ce qu'il dit de lui-même : il n'a pas pu regarder. C'est la leçon du
    // gabarit d'alarme (§9, 10/09) — ne pas nommer une cause non mesurée.
    expect(verdict.detail).toContain("il n'a pas pu regarder");
  });

  it("rend « reponse_illisible » — un défaut du DÉPÔT, jamais de l'hébergeur", () => {
    const pasDuJson = verdictDuDeploiement({
      adresse: ADRESSE,
      corps: "<html><body>502 Bad Gateway</body></html>",
      commitAttendu: COMMIT,
    });
    expect(pasDuJson.nature).toBe("reponse_illisible");
    expect(pasDuJson.geste).toContain("verdict-deploiement.ts");

    // Une clé ABSENTE n'est pas « false » : c'est une route qui ne rend plus ce
    // qu'on lui demandait. Sans cette branche, l'absence se lirait « rien ne va ».
    const sansLesCles = verdictDuDeploiement({
      adresse: ADRESSE,
      corps: JSON.stringify({ ok: true, commit: COMMIT }),
      commitAttendu: COMMIT,
    });
    expect(sansLesCles.nature).toBe("reponse_illisible");

    // Et « ok » au lieu d'un booléen ne passe pas pour un booléen.
    const okTextuel = verdictDuDeploiement({
      adresse: ADRESSE,
      corps: JSON.stringify({
        baseJointe: { ok: "oui" },
        roleApplicatif: { ok: "oui" },
        migrations: { ok: "oui" },
        commit: COMMIT,
      }),
      commitAttendu: COMMIT,
    });
    expect(okTextuel.nature).toBe("reponse_illisible");
  });

  it("rend « adresse_absente » plutôt que de sauter en silence", () => {
    for (const adresse of [null, "", "   "]) {
      const verdict = verdictDuDeploiement({
        adresse,
        corps: corps(),
        commitAttendu: COMMIT,
      });
      expect(verdict.nature, `adresse « ${adresse} »`).toBe("adresse_absente");
      expect(verdict.geste).toContain("URL_PRODUCTION");
    }
    // Et le code est 1, pas 75 : attendre ne pose aucune variable.
    expect(CODE_DE_SORTIE.adresse_absente).toBe(1);
  });
});

/**
 * LE TÉMOIN DU CONTRÔLE — et c'est le cœur du ticket.
 *
 * **Un contrôle lancé juste après une fusion mesure, par défaut, LE CODE
 * D'AVANT**, qui répond « tout va bien » en toute sincérité : sa base lui
 * suffit. Le contrôle aurait donc été VERT dans la fenêtre même où la panne
 * naît, et pour une raison qu'il n'aurait pas mesurée. *La question à poser à
 * tout vert inattendu n'est pas « le système est meilleur que je croyais » mais
 * « je n'ai pas mesuré ce que je crois »* (§9, 07/09).
 */
describe("le contrôle refuse de conclure sur le code d'AVANT", () => {
  it("rend « deploiement_en_retard » quand la réponse porte un autre commit", () => {
    const verdict = verdictDuDeploiement({
      adresse: ADRESSE,
      // Tout va bien — sur l'ANCIENNE version.
      corps: corps({ commit: AUTRE_COMMIT }),
      commitAttendu: COMMIT,
    });
    expect(verdict.nature).toBe("deploiement_en_retard");
    expect(verdict.nature).not.toBe("sain");
    // 75 : on n'a rien constaté. Un 1 ferait chercher un écart inexistant.
    expect(CODE_DE_SORTIE[verdict.nature]).toBe(75);
    // Et il est RÉESSAYABLE : c'est l'un des trois états qui s'améliorent seuls.
    expect(NATURES_A_REESSAYER).toContain(verdict.nature);
  });

  it("rend « commit_inconnu » quand la réponse ne dit pas quel code elle porte", () => {
    for (const commit of [null, "", "   "]) {
      const verdict = verdictDuDeploiement({
        adresse: ADRESSE,
        corps: corps({ commit }),
        commitAttendu: COMMIT,
      });
      expect(verdict.nature, `commit « ${commit} »`).toBe("commit_inconnu");
    }
    // Il n'est PAS réessayable : attendre ne fera pas apparaître la variable.
    expect(NATURES_A_REESSAYER).not.toContain("commit_inconnu");
  });

  it("mais reste vert POUR SA PROPRE RAISON quand aucun commit n'est visé", () => {
    // Une exécution planifiée ne vise aucune fusion : elle demande si ce qui est
    // en ligne va bien. Le témoin ne doit pas la rendre rouge pour autant — un
    // gardien bruyant désapprend à être lu (§9, 11/09).
    const verdict = verdictDuDeploiement({
      adresse: ADRESSE,
      corps: corps({ commit: null }),
      commitAttendu: null,
    });
    expect(verdict.nature).toBe("sain");
    // Et il DIT qu'il ne visait rien, plutôt que de laisser croire le contraire.
    expect(verdict.detail).toContain("Aucun commit n'était visé");
  });

  it("accepte une empreinte ABRÉGÉE, et refuse un préfixe trop court", () => {
    // Un hébergeur peut ne renseigner que les premiers caractères. Exiger
    // l'égalité stricte rendrait « en retard » pour toujours.
    expect(
      verdictDuDeploiement({
        adresse: ADRESSE,
        corps: corps({ commit: COMMIT.slice(0, 7) }),
        commitAttendu: COMMIT,
      }).nature,
    ).toBe("sain");
    expect(
      verdictDuDeploiement({
        adresse: ADRESSE,
        corps: corps({ commit: COMMIT.slice(0, 12).toUpperCase() }),
        commitAttendu: COMMIT,
      }).nature,
    ).toBe("sain");

    // Trois caractères feraient coïncider n'importe quoi : c'est refusé.
    expect(
      verdictDuDeploiement({
        adresse: ADRESSE,
        corps: corps({ commit: COMMIT.slice(0, 3) }),
        commitAttendu: COMMIT,
      }).nature,
    ).toBe("deploiement_en_retard");
  });
});

/**
 * LA CONVENTION DES CODES DE SORTIE EST CELLE DE `pnpm veille`.
 *
 * *75 quand on n'a rien pu constater, 1 quand on a constaté un écart.* Une même
 * distinction se dit avec les mêmes chiffres, ou ce sont deux conventions qui
 * divergeront — et l'on apprendra à ne lire ni l'une ni l'autre.
 */
describe("les codes de sortie", () => {
  const TOUTES: readonly NatureVerdict[] = [
    "sain",
    "migration_manquante",
    "base_injoignable",
    "role_inattendu",
    "application_muette",
    "reponse_illisible",
    "adresse_absente",
    "deploiement_en_retard",
    "commit_inconnu",
    "page_bloquee_au_chargement",
    "page_non_verifiable",
  ];

  it("couvrent TOUTES les natures, et la liste est dérivée du type", () => {
    // Témoin : une table vide serait trivialement cohérente (§9, 30/08).
    expect(Object.keys(CODE_DE_SORTIE).length).toBe(TOUTES.length);
    for (const nature of TOUTES) {
      expect(CODE_DE_SORTIE, `nature : ${nature}`).toHaveProperty(nature);
    }
  });

  it("n'emploient que 0, 1 et 75 — jamais un quatrième chiffre", () => {
    for (const nature of TOUTES) {
      expect([0, 1, 75], `nature : ${nature}`).toContain(
        CODE_DE_SORTIE[nature],
      );
    }
    expect(CODE_DE_SORTIE.sain).toBe(0);
  });

  it("ne réessaient QUE ce qui peut s'améliorer en attendant", () => {
    // Réessayer une migration manquante transformerait un rouge franc en
    // attente de deux minutes, au terme de laquelle rien n'aurait changé.
    expect(NATURES_A_REESSAYER).not.toContain("migration_manquante");
    expect(NATURES_A_REESSAYER).not.toContain("reponse_illisible");
    expect(NATURES_A_REESSAYER).not.toContain("adresse_absente");
    expect(NATURES_A_REESSAYER).not.toContain("sain");
    expect(NATURES_A_REESSAYER.length).toBeGreaterThan(0);
  });
});

/**
 * LES DEUX CÔTÉS DU CONTRAT, FACE À FACE (§9, 01/09).
 *
 * `reponseMachine` PRODUIT le corps, `verdictDuDeploiement` le LIT. Deux
 * implémentations d'un même contrat, dans deux répertoires, écrites pour deux
 * usages — *et rien, dans le code, ne dit qu'elles parlent de la même chose.*
 * Qu'elles dérivent, et la route rendra un corps que le contrôle jugera
 * illisible : un rouge qui enverra chercher chez l'hébergeur un défaut du dépôt.
 *
 * La parade est celle du §9 : **les faire répondre l'une à côté de l'autre**,
 * sur des états réels, avec un témoin — car deux fonctions qui ne rendent rien
 * s'accordent parfaitement (§9, 10/09).
 */
describe("la route et le contrôle ne peuvent pas diverger en silence", () => {
  function etat(base: boolean, migrations: boolean, role = true): EtatSante {
    return {
      baseJointe: { ok: base, detail: base ? null : "La base ne répond pas." },
      roleApplicatif: {
        ok: role,
        detail: role ? null : "Le rôle connecté n'est pas « codiplan_app ».",
      },
      migrations: {
        ok: migrations,
        detail: migrations ? null : "Une migration n'est pas appliquée : X.",
      },
      societes: { lisible: false, motif: "…" },
      comptes: { lisible: false, motif: "…" },
    };
  }

  const CAS = [
    { base: true, role: true, migrations: true, attendu: "sain" },
    {
      base: true,
      role: true,
      migrations: false,
      attendu: "migration_manquante",
    },
    { base: true, role: false, migrations: true, attendu: "role_inattendu" },
    {
      base: false,
      role: true,
      migrations: false,
      attendu: "base_injoignable",
    },
  ] as const;

  it("un corps produit par la route est TOUJOURS lisible par le contrôle", () => {
    for (const cas of CAS) {
      const corpsReel = JSON.stringify(
        reponseMachine(etat(cas.base, cas.migrations, cas.role), COMMIT),
      );
      const verdict = verdictDuDeploiement({
        adresse: ADRESSE,
        corps: corpsReel,
        commitAttendu: COMMIT,
      });
      // La première chose à refuser est « illisible » : c'est le signe que les
      // deux côtés ont divergé, et c'est ce que ce scénario existe pour voir.
      expect(verdict.nature, `cas ${JSON.stringify(cas)}`).not.toBe(
        "reponse_illisible",
      );
      expect(verdict.nature).toBe(cas.attendu);
    }
    // Témoin : trois cas, et ils ne rendent pas tous la même chose.
    expect(new Set(CAS.map((c) => c.attendu)).size).toBe(4);
  });

  it("ÉPREUVE : une route qui cesse de rendre `migrations` est refusée", () => {
    // La divergence telle qu'elle se commettrait — un renommage de champ jugé
    // anodin. Le contrôle doit la voir, et la ranger du bon côté : le DÉPÔT.
    const corpsDivergent = JSON.stringify({
      ...reponseMachine(etat(true, true), COMMIT),
      migrations: undefined,
    });
    const verdict = verdictDuDeploiement({
      adresse: ADRESSE,
      corps: corpsDivergent,
      commitAttendu: COMMIT,
    });
    expect(verdict.nature).toBe("reponse_illisible");
    expect(verdict.geste).toContain("défaut du dépôt");
  });

  it("et le commit rendu par la route est celui que l'hébergeur renseigne", () => {
    expect(commitDeploye({ VERCEL_GIT_COMMIT_SHA: COMMIT })).toBe(COMMIT);
    expect(commitDeploye({ COMMIT_DEPLOYE: COMMIT })).toBe(COMMIT);
    // « Je ne sais pas » et « rien » ne se corrigent pas au même endroit : la
    // chaîne vide devient `null`, que le contrôle sait nommer.
    expect(commitDeploye({ VERCEL_GIT_COMMIT_SHA: "  " })).toBeNull();
    expect(commitDeploye({})).toBeNull();

    // Et bout à bout : une route sans commit rend `commit_inconnu`, jamais vert.
    const sansCommit = JSON.stringify(
      reponseMachine(etat(true, true), commitDeploye({})),
    );
    expect(
      verdictDuDeploiement({
        adresse: ADRESSE,
        corps: sansCommit,
        commitAttendu: COMMIT,
      }).nature,
    ).toBe("commit_inconnu");
  });
});

/**
 * `/API/SANTE` MENTAIT PAR OMISSION — MESURÉ EN PRODUCTION LE 17/09/2026.
 *
 * Commit déployé `de17141`, `/api/sante` répondait `sain`, et
 * `document.body.innerText` sur `/planning` comme sur `/tableau-de-bord`
 * valait EXACTEMENT « Chargement… », indéfiniment. Ce texte-fixture reprend
 * la mesure telle quelle plutôt qu'une approximation — c'est la première
 * chose que ce scénario devait mettre en échec, et il le fait avant toute
 * correction du dépôt.
 */
describe("la page réelle peut mentir alors que la base va bien", () => {
  const TEXTE_DE_CHARGEMENT = "Chargement…";

  it("EXACTEMENT le repli, rien avant ni après — le cas mesuré en production", () => {
    expect(pageBloqueeAuChargement("Chargement…", TEXTE_DE_CHARGEMENT)).toBe(
      true,
    );
    expect(verdictDeLaPage("Chargement…", TEXTE_DE_CHARGEMENT).nature).toBe(
      "page_bloquee_au_chargement",
    );
  });

  it("un espace de bord ne change rien — la mesure passe par un `trim()`", () => {
    expect(
      pageBloqueeAuChargement("  Chargement…  \n", TEXTE_DE_CHARGEMENT),
    ).toBe(true);
  });

  it("LE CAS QUI DOIT RESTER VERT : le repli PARMI autre chose n'est pas ce défaut", () => {
    // Un bandeau déjà peint pendant qu'une section attend encore n'est pas
    // la panne mesurée — la panne mesurée est une égalité STRICTE.
    expect(
      pageBloqueeAuChargement("CODIPLAN\nChargement…", TEXTE_DE_CHARGEMENT),
    ).toBe(false);
  });

  it("une vraie page — le témoin qui doit rester vert pour sa propre raison", () => {
    const texteReel =
      "CODIPLAN\nConnexion\nAdresse électronique\nMot de passe\nSe connecter";
    expect(pageBloqueeAuChargement(texteReel, TEXTE_DE_CHARGEMENT)).toBe(false);
    expect(verdictDeLaPage(texteReel, TEXTE_DE_CHARGEMENT).nature).toBe("sain");
  });

  it("rien n'a pu être lu — c'est un défaut du CONTRÔLE, jamais un rouge accusateur", () => {
    const verdict = verdictDeLaPage(null, TEXTE_DE_CHARGEMENT);
    expect(verdict.nature).toBe("page_non_verifiable");
    expect(CODE_DE_SORTIE[verdict.nature]).toBe(75);
  });

  it("un défaut RÉEL de la page vaut 1 — c'est un écart CONSTATÉ, jamais un 75", () => {
    expect(CODE_DE_SORTIE.page_bloquee_au_chargement).toBe(1);
  });

  it("n'est pas réessayé — un repli qui ne part jamais ne part pas davantage en attendant", () => {
    expect(NATURES_A_REESSAYER).not.toContain("page_bloquee_au_chargement");
  });
});
