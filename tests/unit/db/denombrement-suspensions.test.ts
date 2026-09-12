import { describe, expect, it } from "vitest";

import {
  lectureFiable,
  rapport,
  SQL_DENOMBREMENT,
} from "@/scripts/lib/suspensions-anterieures";

/**
 * R3-02 — LE DÉNOMBREMENT REFUSE DE RENDRE UN ZÉRO CREUX.
 *
 * ## LE COMPORTEMENT GARDÉ
 *
 * *« Il n'y a rien à rattraper » et « je ne vois rien » rendent le même zéro*
 * (§9, 30/08 et 07/09). `intervention` est sous `FORCE ROW LEVEL SECURITY` : un
 * rôle propriétaire non superutilisateur, sans contexte de société, verrait
 * **zéro ligne**. Le dénombrement doit refuser de compter dans ce cas-là — et
 * accepter dans les deux autres, pour leur propre raison.
 *
 * ## ET LES DEUX SENS DE L'ÉQUIVALENCE SONT COMPTÉS
 *
 * Les deux `CHECK` de D104 sont des ÉQUIVALENCES, pas des implications : une
 * ligne **non suspendue qui porte un motif** les viole autant qu'une suspendue
 * qui n'en porte pas. *Ne compter que le second sens rendrait un chiffre trop
 * bas, et il aurait l'air juste.*
 */
describe("le témoin de lecture décide si un compte a un sens", () => {
  it("un superutilisateur voit, même sous FORCE", () => {
    expect(lectureFiable({ superutilisateur: true, forceActif: true })).toBe(
      true,
    );
  });

  it("un rôle ordinaire voit quand FORCE est levé", () => {
    expect(lectureFiable({ superutilisateur: false, forceActif: false })).toBe(
      true,
    );
  });

  it("LE CAS QUI DOIT REFUSER — rôle ordinaire, FORCE actif", () => {
    // C'est l'état RÉEL du rôle de migration sur la base hébergée : c'est là,
    // et là seulement, que le zéro creux se produirait.
    expect(lectureFiable({ superutilisateur: false, forceActif: true })).toBe(
      false,
    );
  });
});

describe("la requête compte les DEUX sens de l'équivalence", () => {
  it("elle compte les suspendues sans motif ET les non suspendues qui en portent un", () => {
    // Une implication seule — « suspendue ⇒ motif » — laisserait passer les
    // résidus, et le chiffre serait trop bas en ayant l'air juste.
    expect(SQL_DENOMBREMENT).toContain("statut = 'suspendue'");
    expect(SQL_DENOMBREMENT).toContain("statut <> 'suspendue'");
    expect(SQL_DENOMBREMENT).toContain('"residus"');
  });

  it("elle ne lit que « intervention », et n'écrit rien", () => {
    // *Le dénombrement ne répare rien* : ni UPDATE, ni VALIDATE CONSTRAINT, ni
    // motif générique — ce dernier serait l'issue (a) que D104 a écartée.
    const lu = SQL_DENOMBREMENT.toUpperCase();
    for (const verbe of ["UPDATE", "INSERT", "DELETE", "VALIDATE", "ALTER"]) {
      expect(lu).not.toContain(verbe);
    }
  });
});

describe("le rapport dit ce qu'un zéro ne veut PAS dire", () => {
  it("il refuse d'être lu comme « le rattrapage est fait »", () => {
    // Sans cette phrase, un zéro mesuré sur une base bâtie depuis zéro se
    // lirait comme une absence de dette — alors qu'aucune violation n'y est
    // même POSSIBLE. C'est le §9 du 06/09 : un chiffre juste qui fait conclure
    // faux.
    const texte = rapport(
      {
        interventions: 32,
        suspendues: 2,
        sansMotif: 0,
        sansDate: 0,
        residus: 0,
      },
      {
        role: "postgres",
        superutilisateur: true,
        forceActif: true,
        voit: true,
      },
    );
    expect(texte).toContain("20260913160000_suspension_l2_10");
    expect(texte).toContain("NE RÉPARE RIEN");
  });

  it("il nomme les deux colonnes SÉPARÉMENT", () => {
    // *Elles ne se rattrapent pas pareil* : la date se reprend depuis le
    // journal d'audit, le motif ne se reprend pas du tout. Un total unique
    // ferait chiffrer le plus cher au prix du moins cher.
    const texte = rapport(
      {
        interventions: 10,
        suspendues: 4,
        sansMotif: 3,
        sansDate: 1,
        residus: 0,
      },
      {
        role: "codiplan_migration",
        superutilisateur: false,
        forceActif: false,
        voit: true,
      },
    );
    expect(texte).toContain("SANS MOTIF               : 3");
    expect(texte).toContain("SANS DATE                : 1");
  });
});
