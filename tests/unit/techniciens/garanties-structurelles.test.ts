import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { fichiersSource, sansCommentaires } from "../outils/fichiers-source";

/**
 * TROIS GARDIENS D'ÉQUIPE-1 QUE `tests/isolation/` NE PORTE PAS ENCORE.
 *
 * ## Pourquoi statiques
 *
 * `pnpm test` (projet « unit ») tourne sans base — voir l'en-tête de
 * `depot.test.ts`. Ce que ce fichier prouve est donc la FORME du code, pas son
 * comportement sous PostgreSQL : que `technicien` reste vidé par la
 * composition et non par la suppression, que le module n'a AUCUN autre accès
 * à la base que le canal cloisonné, et qu'il n'ouvre aucun chemin
 * d'authentification. Le cloisonnement RÉEL — RLS et clés composites qui
 * rendent un technicien de la société A invisible depuis la société B — est
 * déjà porté par `tests/isolation/` pour `technicien`, `utilisateur_societe`
 * et `utilisateur` ; ce lot n'a pas à le redémontrer, il doit seulement ne pas
 * le contourner. C'est cette seconde moitié que ces trois gardiens tiennent.
 */

const DEPOT = readFileSync(
  join(process.cwd(), "lib/techniciens/depot.ts"),
  "utf8",
);
const DEPOT_SANS_COMMENTAIRES = sansCommentaires(DEPOT);

describe("un technicien désactivé n'est jamais supprimé (gardien)", () => {
  it("TÉMOIN — le module écrit bien dans `technicien`", () => {
    expect(DEPOT_SANS_COMMENTAIRES).toContain("tx.technicien.create");
    expect(DEPOT_SANS_COMMENTAIRES).toContain("tx.technicien.updateMany");
  });

  it("aucun verbe de suppression n'existe dans le dépôt des techniciens", () => {
    // « Il cesse d'être proposé, il ne cesse pas d'avoir existé » (chapitre 11,
    // colonne `technicien.actif`) : le seul chemin pour retirer un technicien
    // du choix est la bascule d'activité, jamais une ligne en moins. Une
    // suppression romprait aussi les interventions passées, qui le NOMMENT
    // encore (`SegmentTravail`, `TechnicienHabilitation`, `Absence`).
    expect(DEPOT_SANS_COMMENTAIRES).not.toMatch(
      /\.(delete|deleteMany)\s*\(/,
    );
  });

  it("la modification n'écrit QUE l'agence et l'activité — jamais l'existence", () => {
    const appel = /tx\.technicien\.updateMany\(\{[\s\S]*?\}\)/.exec(
      DEPOT_SANS_COMMENTAIRES,
    );
    expect(appel).not.toBeNull();
    const corps = appel![0];
    expect(corps).toContain("agence_id: saisie.agence_id");
    expect(corps).toContain("actif: saisie.actif");
  });
});

describe("le dépôt des techniciens n'a qu'un seul canal vers la base (gardien)", () => {
  it("`@/lib/db/client` n'est importé QUE pour `avecContexteApplicatif`", () => {
    // C'est la fonction qui pose `app.societe_id` ET `app.role` sur la
    // transaction (`lib/db/rls.ts`) — la précondition structurelle du
    // cloisonnement que les politiques RLS appliquent ensuite. Importer aussi
    // `prisma` (le singleton non cloisonné) ouvrirait un second chemin, sous
    // aucun contexte de société.
    const importation = /import\s*\{([^}]*)\}\s*from\s*"@\/lib\/db\/client";/.exec(
      DEPOT,
    );
    expect(importation).not.toBeNull();
    const noms = importation![1]!.split(",").map((n) => n.trim());
    expect(noms).toEqual(["avecContexteApplicatif"]);
  });

  it("aucune requête n'est écrite hors d'un `tx` reçu de la transaction", () => {
    // `prisma.` nommerait le singleton non cloisonné directement — le motif
    // qui trahirait un contournement de `avecContexteApplicatif`.
    expect(DEPOT_SANS_COMMENTAIRES).not.toMatch(/[^.\w]prisma\./);
  });

  it("les clés composites qui portent le cloisonnement existent toujours au schéma", () => {
    const schema = readFileSync(
      join(process.cwd(), "prisma/schema.prisma"),
      "utf8",
    );
    // `technicien` : la clé primaire (société, utilisateur) — sans la société
    // dans la clé, un technicien d'une autre société pourrait s'insérer sous
    // le même utilisateur_id.
    expect(schema).toMatch(/@@id\(\[societe_id, utilisateur_id\]\)/);
    // `utilisateur_societe` : l'unicité (utilisateur, société) — c'est elle
    // que le dépôt traduit en « deja_membre » (P2002).
    expect(schema).toMatch(/@@unique\(\[utilisateur_id, societe_id\]\)/);
  });
});

describe("aucun chemin d'authentification n'est ouvert ici (gardien)", () => {
  it("TÉMOIN — le motif reconnaît bien un appel Better Auth", () => {
    expect(/auth\.api\.\w+\s*\(/.test("await auth.api.signUpEmail({")).toBe(
      true,
    );
  });

  it("`lib/techniciens/**` et `app/api/techniciens/**` n'appellent aucune API Better Auth", () => {
    // Plus large que la seule `signUpEmail` que
    // `tests/unit/auth/amorcage-retrait.test.ts` garde déjà pour tout le
    // dépôt : ce gardien-ci refuse TOUT appel `auth.api.*` — création de
    // compte, session, second facteur — depuis le territoire de ce lot. Créer
    // un technicien crée son identité, jamais son accès.
    const fichiers = fichiersSource([
      "lib/techniciens",
      "app/api/techniciens",
    ]);
    expect(fichiers.length).toBeGreaterThan(0);

    const fautifs = fichiers.filter((fichier) =>
      /auth\.api\.\w+\s*\(/.test(sansCommentaires(fichier.contenu)),
    );
    expect(
      fautifs.map((f) => f.chemin),
      "un appel à l'API Better Auth a été trouvé dans le territoire d'ÉQUIPE-1 " +
        "— créer un technicien crée son identité, pas son accès.",
    ).toEqual([]);
  });

  it("aucune ligne n'est écrite dans `compte`, `session` ou `second_facteur`", () => {
    // La forme la plus proche d'un accès inventé SANS passer par Better Auth :
    // écrire soi-même une empreinte de mot de passe ou une session. Aucune des
    // trois tables n'a de raison d'apparaître dans ce module.
    expect(DEPOT_SANS_COMMENTAIRES).not.toMatch(
      /tx\.(compte|session|secondFacteur)\./,
    );
  });
});
