import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  CODES_LIAISON,
  CODE_SORTIE_ECART,
  CODE_SORTIE_LIAISON,
  EcartConstate,
  INSTRUCTION_LECTURE_SEULE,
  estPanneDeLiaison,
  urlVeille,
} from "../../scripts/veille-hebergee.mjs";

/**
 * LA VEILLE DE LA BASE HÉBERGÉE — le détectif tourne-t-il, et sur la bonne base ?
 *
 * **Ce que ce gardien répare, et il a été mesuré.** Les contrôles détectifs du
 * dépôt ne s'exécutaient que dans `db-migrate.yml`, dont le déclencheur est
 * `workflow_dispatch` et lui seul ; et le `verify:full` nocturne tourne contre
 * un PostgreSQL JETABLE. Le détectif n'avait donc jamais regardé l'endroit où
 * la faute se produit. C'est la même famille que É12 — une garantie dont le
 * déclenchement dépend de l'initiative d'un humain n'est pas une garantie.
 *
 * **Et un job planifié que personne ne garde est le défaut du dépôt.** Retirer
 * la veille de `ci.yml` ne casserait rien, ne ferait rougir aucun test, et le
 * silence a exactement la forme du succès (§9, 31/08). Ce gardien lit donc le
 * flux et exige que la veille y soit, planifiée, et câblée à l'alarme.
 */
const CI = readFileSync(
  join(process.cwd(), ".github/workflows/ci.yml"),
  "utf8",
);

/**
 * Le SOURCE de la veille, lu comme texte.
 *
 * Le ticket L0-04 aurait dit « le script appelle les six contrôles » ; il les
 * appelle en effet. Mais **rien ne le tenait** : en retirer un de la liste
 * `controles` ne casse aucune compilation, ne fait rougir aucun scénario, et
 * la veille continue de rendre un vert — sur cinq contrôles au lieu de six. Les
 * fonctions pures, elles, restent gardées par leurs propres épreuves : ce qui
 * ne l'était pas, c'est le CÂBLAGE. Même famille que É12 : le silence a
 * exactement la forme du succès.
 */
const VEILLE = readFileSync(
  join(process.cwd(), "scripts/veille-hebergee.mts"),
  "utf8",
);

/**
 * Les six fonctions d'écart que la veille doit appeler, chacune nommée par le
 * contrôle qu'elle porte. Recopiées ? Non : ce sont les six symboles réellement
 * exportés par `scripts/lib/`, et le test ci-dessous les confronte au source de
 * la veille, qui est une source qu'il ne contrôle pas.
 */
const CONTROLES_ATTENDUS = [
  "ecartsRlsDeclaree",
  "ecartsPolitiques",
  "ecartsDeclencheurs",
  "ecartsPrivilegesJournal",
  "ecartsDurcissementPartitions",
  "ecartsPrivilegesConsolidation",
] as const;

/** Les contrôles réellement CÂBLÉS dans un source de veille donné. */
function controlesCables(source: string): string[] {
  return CONTROLES_ATTENDUS.filter((nom) =>
    new RegExp(`\\b${nom}\\s*\\(`).test(source),
  );
}

/** Position d'un fragment dans le flux, en échouant s'il est absent. */
function position(fragment: string): number {
  const index = CI.indexOf(fragment);
  expect(index, `fragment absent de ci.yml : ${fragment}`).toBeGreaterThan(-1);
  return index;
}

describe("la veille de la base hébergée (D55)", () => {
  describe("elle est branchée, et sur une échéance", () => {
    it("le flux la déclare comme job", () => {
      position("veille-hebergee:");
      position("pnpm veille");
    });

    it("elle tourne à ÉCHÉANCE FIXE, pas seulement à la main", () => {
      // Le point entier. `workflow_dispatch` seul rendrait la veille aussi
      // dépendante de l'initiative humaine que le contrôle qu'elle remplace.
      const bloc = CI.slice(
        position("veille-hebergee:"),
        position("alarme-nuit-rouge:"),
      );
      expect(bloc).toContain("github.event_name == 'schedule'");
      expect(CI).toContain('- cron: "0 15 * * *"');
    });

    it("elle reçoit le secret du rôle APPLICATIF, jamais celui de migration", () => {
      // **Le point le plus important de ce gardien.** Lire `pg_inherits`,
      // `pg_policies` et les ACL ne demande aucun droit particulier. Faire
      // porter à un travail automatique nocturne une accréditation capable de
      // tout écrire serait payer un prix qu'on n'a aucune raison de payer — et
      // le verrou READ ONLY protège de l'accident, pas de l'accréditation.
      const bloc = CI.slice(
        position("veille-hebergee:"),
        position("alarme-nuit-rouge:"),
      );
      expect(bloc).toContain("DATABASE_URL: ${{ secrets.DATABASE_URL }}");
      expect(bloc).not.toContain("secrets.MIGRATION_DATABASE_URL");
      // Elle ne migre pas et n'amorce pas : ces mots n'ont rien à faire ici.
      expect(bloc).not.toContain("migrate deploy");
      expect(bloc).not.toContain("db:seed");
      expect(bloc).not.toContain("PURGE_DEMONSTRATION_CONFIRMEE");
    });

    it("elle publie la NATURE de son rouge, et l'alarme la lit", () => {
      const bloc = CI.slice(
        position("veille-hebergee:"),
        position("alarme-nuit-rouge:"),
      );
      expect(bloc).toContain("nature: ${{ steps.veille.outputs.nature }}");
      expect(bloc).toContain("nature=liaison");
      expect(bloc).toContain("nature=securite");
      expect(CI).toContain("needs.veille-hebergee.outputs.nature");
    });

    it("les deux rouges ouvrent DEUX fils d'issues distincts", () => {
      // Une nuit injoignable est un incident d'EXPLOITATION ; une base qui a
      // dérivé est un incident de SÉCURITÉ. Les mêler apprendrait en trois
      // semaines à ne plus lire ni l'un ni l'autre.
      for (const marqueur of [
        "[veille-injoignable]",
        "[veille-securite]",
        "[nuit-rouge]",
      ]) {
        expect(CI, marqueur).toContain(marqueur);
      }
    });

    it("une nuit de veille rouge ouvre la MÊME issue qu'un verify:full rouge", () => {
      // Sans ce câblage, la veille sonnerait dans la boîte de courriel que le
      // 20 août a montrée vide — c'est tout l'objet de l'écart É12.
      expect(CI).toContain("needs: [verify-full, veille-hebergee]");
      expect(CI).toContain("needs.veille-hebergee.result == 'failure'");
    });

    it("elle ne tourne PAS sur les propositions de fusion", () => {
      // Une PR n'a pas à toucher la base hébergée, et les secrets n'ont rien à
      // faire sur un chemin qu'une branche quelconque déclenche.
      const bloc = CI.slice(
        position("veille-hebergee:"),
        position("alarme-nuit-rouge:"),
      );
      expect(bloc).not.toContain("pull_request");
    });
  });

  describe("elle ne peut pas écrire", () => {
    it("verrouille la TRANSACTION, et non les sessions suivantes", () => {
      // **La différence a été mesurée, elle n'est pas de style.**
      // `SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY` ne verrouille
      // PAS la transaction en cours : un `DELETE` émis juste après passe sans
      // rien dire. Et Prisma répartit ses requêtes sur un POOL : un réglage de
      // session posé sur une connexion n'engage pas les autres. La première
      // rédaction de la veille portait cette faute, et c'est le scénario
      // d'isolation qui l'a révélée en échouant.
      expect(INSTRUCTION_LECTURE_SEULE).toBe("SET TRANSACTION READ ONLY");
      expect(INSTRUCTION_LECTURE_SEULE).not.toContain(
        "SESSION CHARACTERISTICS",
      );
    });

    it("le verrou est la PREMIÈRE instruction de la transaction", () => {
      // Une lecture seule posée après coup ne protégerait pas ce qui l'a
      // précédée. L'ordre est donc lu dans le fichier, pas supposé.
      const source = readFileSync(
        join(process.cwd(), "scripts/veille-hebergee.mts"),
        "utf8",
      );
      const ouverture = source.indexOf("$transaction(async (tx)");
      const verrou = source.indexOf(
        "tx.$executeRawUnsafe(INSTRUCTION_LECTURE_SEULE)",
      );
      const premiereLecture = source.indexOf("await observer(tx)");

      expect(ouverture).toBeGreaterThan(-1);
      expect(verrou).toBeGreaterThan(ouverture);
      expect(premiereLecture).toBeGreaterThan(verrou);
    });
  });

  describe("elle refuse de partir aveugle", () => {
    it("exige une base à observer, et c'est celle du rôle applicatif", () => {
      expect(() => urlVeille({})).toThrow(/DATABASE_URL/);
      expect(() => urlVeille({ DATABASE_URL: "   " })).toThrow(
        /rôle APPLICATIF/,
      );
      expect(urlVeille({ DATABASE_URL: "postgres://x" })).toBe("postgres://x");
      // Et elle ne se rabat PAS sur le secret privilégié s'il traîne dans
      // l'environnement : un repli silencieux vers le rôle de migration serait
      // exactement le défaut qu'on vient de retirer.
      expect(() =>
        urlVeille({ MIGRATION_DATABASE_URL: "postgres://privilegie" }),
      ).toThrow(/DATABASE_URL/);
    });
  });

  describe("elle appelle réellement les SIX contrôles", () => {
    it("chacun est câblé, et ils sont six", () => {
      // Le témoin d'abord : cinq contrôles câblés sur six ressemblent trait
      // pour trait à six, puisque le sixième ne dit rien quand il n'est pas là.
      expect(controlesCables(VEILLE)).toEqual([...CONTROLES_ATTENDUS]);
      // Et la liste `controles` en déclare autant qu'il y a de contrôles : un
      // appel présent mais rangé hors du tableau ne serait jamais joué.
      expect(VEILLE.match(/^\s+ecarts: /gm) ?? []).toHaveLength(
        CONTROLES_ATTENDUS.length,
      );
    });

    it("ÉPREUVE PAR RETRAIT : un contrôle décâblé est vu", () => {
      // La faute écrite plutôt qu'imaginée (§9, 24/08) : on retire de la source
      // l'appel au contrôle des FORMES de politique — celui qui attrape la
      // politique de `client` desserrée à la main —, et l'on vérifie que le
      // gardien ne s'en accommode pas. Sans cette épreuve, le test ci-dessus
      // pourrait être vert pour une autre raison que la sienne.
      const ampute = VEILLE.replace(/ecartsPolitiques\s*\(/g, "voidPolitiques(");

      // LA SONDE : le retrait a-t-il réellement eu lieu ?
      expect(ampute).not.toBe(VEILLE);
      expect(controlesCables(ampute)).toHaveLength(
        CONTROLES_ATTENDUS.length - 1,
      );
      expect(controlesCables(ampute)).not.toContain("ecartsPolitiques");
    });
  });

  describe("rouge parce que faute, rouge parce qu'injoignable", () => {
    it("distingue les deux, et par le CODE DE SORTIE", () => {
      // `EX_TEMPFAIL` de sysexits.h. Deux codes, parce que le flux doit pouvoir
      // choisir son fil d'issues sans lire un message.
      expect(CODE_SORTIE_ECART).toBe(1);
      expect(CODE_SORTIE_LIAISON).toBe(75);
      expect(CODE_SORTIE_ECART).not.toBe(CODE_SORTIE_LIAISON);
    });

    it("un écart CONSTATÉ n'est jamais pris pour une panne de liaison", () => {
      // Le sens qui compte : une base jointe et fautive ne doit pas se ranger
      // dans le fil « injoignable », où elle finirait par ne plus être lue.
      expect(estPanneDeLiaison(new EcartConstate("la base a dérivé"))).toBe(
        false,
      );
      expect(estPanneDeLiaison(new Error("n'importe quoi"))).toBe(false);
    });

    it("les codes Prisma de LIAISON sont reconnus", () => {
      // Témoin : une liste vide rendrait `estPanneDeLiaison` toujours faux, et
      // toute nuit injoignable serait classée « sécurité ».
      expect(CODES_LIAISON.length).toBeGreaterThanOrEqual(4);
      for (const code of CODES_LIAISON) {
        expect(estPanneDeLiaison({ errorCode: code }), code).toBe(true);
        expect(estPanneDeLiaison({ code }), code).toBe(true);
      }
      // Et l'erreur d'initialisation de Prisma, qui n'a pas toujours de code.
      const initiale = new Error("Can't reach database server");
      initiale.name = "PrismaClientInitializationError";
      expect(estPanneDeLiaison(initiale)).toBe(true);
    });

    it("un code Prisma qui n'est PAS de liaison ne s'y range pas", () => {
      // Sans ce sens-là, tout échec deviendrait « injoignable » et le fil
      // sécurité ne recevrait jamais rien.
      for (const code of ["P2002", "P2025", "P1000"]) {
        expect(estPanneDeLiaison({ errorCode: code }), code).toBe(false);
      }
    });
  });
});
