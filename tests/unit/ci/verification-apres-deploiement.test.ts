import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * R3-01 — LE MÉCANISME NE DOIT PAS POUVOIR DISPARAÎTRE EN SILENCE.
 *
 * ## Pourquoi ce gardien, alors que le contrôle a déjà ses scénarios
 *
 * `tests/unit/deploiement/` éprouve le VERDICT — ce que le contrôle conclut d'une
 * réponse. Il ne dit rien de la question qui a coûté trois pannes : *est-ce que
 * quelqu'un le lance ?* La règle du §12 — tout travail touchant `prisma/` finit
 * par un geste nommé — était écrite, juste, et n'a pas tenu : **une règle écrite
 * dans un document que personne ne relit au bon moment n'est pas un gardien.**
 * Ce qui la tient est dans `ci.yml`, et ce qui tient `ci.yml` est ici.
 *
 * ## Ce qu'il refuse, et chaque refus a son jumeau
 *
 * Les quatre pièces du mécanisme, et le retrait de chacune serait SILENCIEUX :
 * le job retiré, la profondeur de `checkout` ramenée à 1, le `needs` de
 * l'alarme amputé, le contrôle devenu migrateur. *Aucune ne ferait rougir quoi
 * que ce soit — elles laisseraient seulement la CI plus verte.*
 */
const CI = readFileSync(
  join(process.cwd(), ".github/workflows/ci.yml"),
  "utf8",
);

/** Le corps d'un job du flux, jusqu'au job suivant. */
function job(nom: string): string {
  const debut = CI.indexOf(`\n  ${nom}:\n`);
  expect(debut, `job absent de ci.yml : ${nom}`).toBeGreaterThan(-1);
  const suite = CI.slice(debut + 1);
  const fin = suite.search(/\n {2}[a-z][a-z0-9-]*:\n/);
  return fin === -1 ? suite : suite.slice(0, fin);
}

describe("la vérification après déploiement est câblée", () => {
  it("le gardien lit réellement le flux — sinon il garde le vide", () => {
    // Témoin : un découpage devenu aveugle rendrait des blocs vides, et tout
    // ce qui suit passerait (§9, 30/08).
    expect(job("deploiement").length).toBeGreaterThan(400);
    expect(job("verify-full").length).toBeGreaterThan(400);
    expect(job("alarme-nuit-rouge").length).toBeGreaterThan(400);
  });

  it("le contrôle tourne sur chaque fusion, la nuit, et à la demande", () => {
    const bloc = job("deploiement");
    expect(bloc).toContain("pnpm deploiement:verifier");
    expect(bloc).toContain("refs/heads/main");
    expect(bloc).toContain("schedule");
    expect(bloc).toContain("workflow_dispatch");
    // `always()` : l'état du déploiement ne dépend pas de la santé du dépôt —
    // et un `verify:full` rouge est précisément un moment où l'on veut savoir.
    expect(bloc).toContain("always()");
  });

  it("IL NE MIGRE RIEN — c'est écrit au ticket, et c'est vérifié", () => {
    // R3-01, en toutes lettres : « ce qu'il ne doit PAS faire : appliquer les
    // migrations tout seul ». Une migration ne part jamais toute seule
    // (db-migrate.yml, décision du 20/08) ; le contrôle NOMME le geste.
    const bloc = job("deploiement");
    for (const interdit of [
      "migrate deploy",
      "db:deploy",
      "db:seed",
      "db:resoudre",
      "MIGRATION_DATABASE_URL",
    ]) {
      expect(
        bloc,
        `le job « deploiement » ne doit pas porter : ${interdit}`,
      ).not.toContain(interdit);
    }
    // Et il ne reçoit AUCUNE accréditation de base : l'adresse publique suffit.
    expect(bloc).toContain("vars.URL_PRODUCTION");
    expect(bloc).not.toContain("secrets.DATABASE_URL");
  });

  it("il vise LE COMMIT de la fusion, sans quoi il mesurerait le code d'avant", () => {
    // C'est le témoin de non-vacuité du contrôle : l'ancienne version répond
    // « tout va bien » en toute sincérité, sa base lui suffisant. Sans
    // `COMMIT_ATTENDU`, le vert tomberait dans la fenêtre même où la panne naît.
    expect(job("deploiement")).toContain("COMMIT_ATTENDU");
    expect(job("deploiement")).toContain("github.sha");
  });

  it("une fusion qui porte une migration écrit l'avertissement elle-même", () => {
    const bloc = job("verify-full");
    expect(bloc).toContain("prisma/migrations/");
    expect(bloc).toContain("GITHUB_STEP_SUMMARY");
    // Le geste, champ par champ — un « pense à migrer » n'est pas un geste.
    expect(bloc).toContain("DB migrate & seed");
    expect(bloc).toContain("demonstration");
  });

  it("et LE CHECKOUT REMONTE DEUX COMMITS — sans quoi l'avertissement est muet", () => {
    // LA PIÈCE QU'ON RETIRERAIT SANS LE SAVOIR. Avec la profondeur 1, `HEAD^`
    // n'existe pas : `git diff` échoue, et la liste des migrations serait vide —
    // « aucune migration », en silence. *Un décompte nul ressemble toujours à un
    // sans-faute.* Deux verrous, et ils ne se recouvrent pas : la profondeur
    // demandée ici, et le refus explicite du pas lui-même.
    const bloc = job("verify-full");
    expect(bloc).toContain("fetch-depth: 2");
    expect(bloc).toContain("git rev-parse --verify --quiet HEAD^");
  });

  it("l'alarme ouvre une issue quand le déploiement a rougi", () => {
    const bloc = job("alarme-nuit-rouge");
    expect(bloc).toContain("needs.deploiement.result");
    expect(bloc).toMatch(
      /needs:\s*\[verify-full, veille-hebergee, deploiement\]/,
    );
    // DEUX fils, et la distinction est celle de la veille : « je n'ai rien pu
    // constater » n'est pas « j'ai constaté un écart ».
    for (const marqueur of [
      "[deploiement-en-retard]",
      "[deploiement-cloisonnement]",
      "[deploiement-incertain]",
    ]) {
      expect(bloc, marqueur).toContain(marqueur);
    }
    // Et le corps NE DÉCIDE PAS si quelque chose a été constaté : il LIT le
    // code de sortie du contrôle. Une rédaction unique disant « rien n'a été
    // constaté » couvrirait aussi l'adresse absente et le contrat divergent,
    // qui sont des écarts bien constatés (§9, 10/09 — une cause imprimée quoi
    // qu'il arrive est une opinion que le dispositif répète en votre nom).
    expect(bloc).toContain("needs.deploiement.outputs.code");

    // ── LE CANAL PEUT ÊTRE CLOS, ET L'ALARME DOIT LE SURVIVRE ─────────────
    //
    // *Mesuré le 12/09/2026 sur la première exécution réelle du dispositif :*
    // `gh` a répondu « the repository has disabled issues ». L'écart É12 avait
    // été fermé par « une issue vit DANS le dépôt » — et ce dépôt-ci n'a plus
    // d'issues. **Le corps part donc d'abord dans deux canaux que rien ne peut
    // désactiver**, le résumé et l'annotation, et l'issue n'est qu'un
    // troisième. Sans cela, fermer le canal faisait disparaître le CONTENU en
    // même temps que la sonnerie.
    expect(bloc).toContain("GITHUB_STEP_SUMMARY");
    expect(bloc).toContain("::error title=");
    // Et elle ROUGIT quand le canal est clos : le contenu est sauf, mais une
    // alarme sans trace durable n'est pas une alarme.
    expect(bloc).toContain("alarme sans canal");
    expect(bloc).toContain("cocher **Issues**");
    expect(bloc).toContain('"$CODE_DEPLOIEMENT" = "75"');
    // Le détail et le geste viennent du CONTRÔLE, jamais de ce fichier : une
    // recopie deviendrait fausse sans rougir (§9, 01/09).
    expect(bloc).toContain("needs.deploiement.outputs.geste");
    expect(bloc).toContain("needs.deploiement.outputs.detail");
  });
});

/**
 * LES JUMEAUX — chaque refus est joué sur la faute telle qu'elle se commettrait.
 *
 * *Un test de refus prouve que le verrou mordait le jour où on l'a écrit* (§9,
 * 24/08). Les quatre retraits ci-dessous sont ceux qu'une session pressée
 * ferait : ils laissent la CI plus verte et plus rapide, et c'est tout le
 * danger. **Le verdict est recalculé par les mêmes expressions que les
 * contrôles**, jamais par une comparaison d'ensembles — sans quoi l'épreuve
 * montrerait la DONNÉE du défaut et non qu'on l'aurait refusé (§9, 11/09).
 */
describe("ÉPREUVES : le mécanisme retiré est refusé", () => {
  /**
   * Les quatre assertions du mécanisme, jouées sur un flux quelconque.
   *
   * **Les motifs sont ancrés sur des LIGNES DE YAML, jamais sur des
   * sous-chaînes** — et c'est la première rédaction qui l'a appris : chacune des
   * quatre chaînes apparaît AUSSI dans un commentaire ou dans un nom de pas, si
   * bien qu'un `replace` amputait la prose et laissait le mécanisme intact. *Les
   * trois épreuves étaient rouges, et elles avaient raison : elles ne violaient
   * rien* (§9, 30/08 — la violation a-t-elle bien eu lieu ?).
   */
  function verdict(flux: string): {
    jobPresent: boolean;
    profondeur: boolean;
    alarme: boolean;
    neMigrePas: boolean;
  } {
    const bloc = (nom: string): string => {
      const debut = flux.indexOf(`\n  ${nom}:\n`);
      if (debut === -1) return "";
      const suite = flux.slice(debut + 1);
      const fin = suite.search(/\n {2}[a-z][a-z0-9-]*:\n/);
      return fin === -1 ? suite : suite.slice(0, fin);
    };
    const deploiement = bloc("deploiement");
    const alarme = bloc("alarme-nuit-rouge");
    return {
      // « Le contrôle est-il lancé ? » et « ne migre-t-il rien ? » sont DEUX
      // questions, et ce motif ne doit pas répondre à la seconde : ancré sur
      // l'égalité de la ligne, il rendrait `false` sur un job qui migre ET
      // contrôle, et les deux assertions cesseraient d'être indépendantes.
      jobPresent: /^ +run:.*\bpnpm deploiement:verifier\b/m.test(deploiement),
      profondeur: /^ +fetch-depth: 2$/m.test(bloc("verify-full")),
      alarme: /^ +needs: \[.*\bdeploiement\b.*\]$/m.test(alarme),
      neMigrePas: !/^ +run:.*migrate deploy/m.test(deploiement),
    };
  }

  it("l'état réel passe les quatre", () => {
    expect(verdict(CI)).toEqual({
      jobPresent: true,
      profondeur: true,
      alarme: true,
      neMigrePas: true,
    });
  });

  it("le job retiré : refusé", () => {
    const ampute = CI.replace(
      /^( +)run: pnpm deploiement:verifier$/m,
      "$1run: echo rien-a-faire",
    );
    expect(ampute).not.toBe(CI); // la violation a bien eu lieu
    expect(verdict(ampute).jobPresent).toBe(false);
    // ET LE RESTE TIENT TOUJOURS : l'épreuve vise LE verrou, pas un voisin.
    expect(verdict(ampute).profondeur).toBe(true);
    expect(verdict(ampute).alarme).toBe(true);
  });

  it("la profondeur ramenée à 1 : refusée — c'est le retrait SILENCIEUX", () => {
    const ampute = CI.replace(/^( +)fetch-depth: 2$/m, "$1fetch-depth: 1");
    expect(ampute).not.toBe(CI);
    expect(verdict(ampute).profondeur).toBe(false);
    expect(verdict(ampute).jobPresent).toBe(true);
    // Et la seconde moitié du verrou tient : le pas refuse de conclure plutôt
    // que de rendre une liste vide. Deux verrous qui ne se recouvrent pas.
    expect(ampute).toContain("git rev-parse --verify --quiet HEAD^");
  });

  it("l'alarme amputée : refusée", () => {
    const ampute = CI.replace(
      /^( +)needs: \[verify-full, veille-hebergee, deploiement\]$/m,
      "$1needs: [verify-full, veille-hebergee]",
    );
    expect(ampute).not.toBe(CI);
    expect(verdict(ampute).alarme).toBe(false);
    expect(verdict(ampute).jobPresent).toBe(true);
  });

  it("le repli de l'alarme retiré : refusé — c'est la sonnerie ET le contenu", () => {
    // La faute telle qu'elle se commettrait : « l'issue suffit », écrit par
    // quelqu'un qui n'a pas vu que le canal pouvait être clos. C'est la faute
    // que le 12/09 a réellement commise.
    const ampute = CI.replace(
      /^( +)\{\n +echo "## \$TITRE"[\s\S]*?\} >> "\$GITHUB_STEP_SUMMARY"\n/m,
      "",
    );
    expect(ampute).not.toBe(CI);
    const blocAmpute = (() => {
      const debut = ampute.indexOf("\n  alarme-nuit-rouge:\n");
      const suite = ampute.slice(debut + 1);
      const fin = suite.search(/\n {2}[a-z][a-z0-9-]*:\n/);
      return fin === -1 ? suite : suite.slice(0, fin);
    })();
    // Le premier écrit du corps a disparu : le contenu ne survit plus au canal.
    expect(blocAmpute).not.toContain('echo "## $TITRE"');
  });

  it("le contrôle devenu migrateur : refusé", () => {
    const devie = CI.replace(
      /^( +)run: pnpm deploiement:verifier$/m,
      "$1run: pnpm prisma migrate deploy && pnpm deploiement:verifier",
    );
    expect(devie).not.toBe(CI);
    expect(verdict(devie).neMigrePas).toBe(false);
    // Et il resterait « présent » : c'est pour cela que les deux assertions
    // sont distinctes — un contrôle qui migre passe le premier contrôle.
    expect(verdict(devie).jobPresent).toBe(true);
  });
});
