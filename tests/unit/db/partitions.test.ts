import { describe, expect, it } from "vitest";

import {
  dernierMoisCouvert,
  ecartsHorizonPartitions,
  ecartsPartitionDefaut,
  moisConsecutifsCouverts,
  MOIS_D_AVANCE_EXIGES_PARTITIONS,
  type EtatPartitions,
} from "@/lib/db/partitions";

/**
 * Les DEUX contrôles de partitions — la RÈGLE, éprouvée sans base
 * (ticket L0-10).
 *
 * La lecture réelle est éprouvée contre un PostgreSQL dans
 * `tests/isolation/journal-audit-partitions.test.ts`. Ici, c'est le VERDICT :
 * quels états sont acceptés, lesquels sont refusés, et surtout **qu'ils sont
 * indépendants** — un état peut satisfaire l'un et pas l'autre, dans les deux
 * sens. C'est cette indépendance qui justifie d'en avoir deux plutôt qu'un.
 */

/** Douze mois d'avance à partir du mois courant, l'état sain. */
function moisSuivants(depart: string, combien: number): string[] {
  const [annee, mois] = depart.split("-").map(Number);
  const rang = (annee as number) * 12 + ((mois as number) - 1);
  return Array.from({ length: combien }, (_, decalage) => {
    const total = rang + decalage;
    return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
  });
}

function etat(surcharge: Partial<EtatPartitions> = {}): EtatPartitions {
  return {
    moisCourant: "2026-08",
    moisCouverts: moisSuivants("2026-08", 13),
    defautPresente: true,
    lignesParDefaut: 0,
    ...surcharge,
  };
}

describe("le contrôle PRÉVENTIF — reste-t-il des partitions devant ? (L0-10)", () => {
  it("le mois courant plus douze : aucun écart", () => {
    expect(ecartsHorizonPartitions(etat())).toEqual([]);
    expect(moisConsecutifsCouverts(etat())).toBe(13);
    expect(dernierMoisCouvert(etat())).toBe("2027-08");
  });

  it("onze mois d'avance : refusé, avec le dernier mois nommé", () => {
    const ecarts = ecartsHorizonPartitions(
      etat({ moisCouverts: moisSuivants("2026-08", 12) }),
    );

    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("11 mois d'avance");
    expect(ecarts[0]).toContain("2027-07");
    expect(ecarts[0]).toContain("pnpm partitions:etendre");
  });

  it("le MOIS COURANT non couvert est le cas le plus grave, et il se distingue", () => {
    // Ce n'est plus « il manquera des partitions » mais « les écritures
    // d'aujourd'hui tombent DÉJÀ par défaut ». Le message doit le dire.
    const ecarts = ecartsHorizonPartitions(
      etat({ moisCouverts: moisSuivants("2026-09", 24) }),
    );

    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("2026-08");
    expect(ecarts[0]).toContain("AUCUNE");
    expect(ecarts[0]).toContain("tombent déjà");
  });

  it("UN TROU au milieu est refusé, même avec assez de partitions au total", () => {
    // Le cas qu'un simple décompte laisserait passer : quatorze partitions,
    // dont celle du mois prochain manque. La consécutivité est la règle.
    const troue = [
      ...moisSuivants("2026-08", 1),
      ...moisSuivants("2026-10", 13),
    ];
    expect(troue).toHaveLength(14);

    const ecarts = ecartsHorizonPartitions(etat({ moisCouverts: troue }));

    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("0 mois d'avance");
    expect(ecarts[0]).toContain("2026-08");
  });

  it("le seuil est bien celui qui est déclaré", () => {
    expect(MOIS_D_AVANCE_EXIGES_PARTITIONS).toBe(12);
    // Éprouvé en le déplaçant : sinon le paramètre serait décoratif.
    expect(
      ecartsHorizonPartitions(
        etat({ moisCouverts: moisSuivants("2026-08", 4) }),
        3,
      ),
    ).toEqual([]);
    expect(
      ecartsHorizonPartitions(
        etat({ moisCouverts: moisSuivants("2026-08", 4) }),
        4,
      ),
    ).toHaveLength(1);
  });

  it("l'année se franchit sans arithmétique fautive", () => {
    // Décembre plus douze mois tombe en décembre suivant : un compteur qui
    // additionnerait des mois sans reporter l'année casserait ici.
    const decembre = etat({
      moisCourant: "2026-12",
      moisCouverts: moisSuivants("2026-12", 13),
    });
    expect(ecartsHorizonPartitions(decembre)).toEqual([]);
    expect(dernierMoisCouvert(decembre)).toBe("2027-12");
  });
});

describe("le contrôle DÉTECTIF — la partition par défaut est-elle vide ? (L0-10)", () => {
  it("vide : aucun écart", () => {
    expect(ecartsPartitionDefaut(etat())).toEqual([]);
  });

  it("une ligne rangée par défaut est refusée, et le message dit les DEUX suites", () => {
    const ecarts = ecartsPartitionDefaut(etat({ lignesParDefaut: 3 }));

    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("3 ligne(s)");
    // La preuve rétrospective : l'écriture, elle, a réussi.
    expect(ecarts[0]).toContain("celle-ci a réussi");
    // Et le coût qui croît : la partition du mois ne peut plus être créée.
    expect(ecarts[0]).toContain("ne peut PLUS être créée");
  });

  it("la partition par défaut ABSENTE est refusée — c'est le filet qu'on retire", () => {
    // Et le message doit nommer la vraie conséquence : ce n'est pas le journal
    // qui tombe, c'est l'écriture métier, le déclencheur étant dans sa
    // transaction.
    const ecarts = ecartsPartitionDefaut(etat({ defautPresente: false }));

    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("PLUS de partition par défaut");
    expect(ecarts[0]).toContain("l'écriture métier");
  });
});

describe("les deux contrôles sont INDÉPENDANTS — c'est pourquoi il en faut deux", () => {
  it("l'horizon peut être tenu alors qu'une ligne est déjà tombée par défaut", () => {
    // Le cas exact que le préventif ne peut PAS voir : il parle de l'avenir.
    // La ligne est là, l'écriture a réussi, et seul le détectif s'en souvient.
    const apresCoup = etat({ lignesParDefaut: 1 });

    expect(ecartsHorizonPartitions(apresCoup)).toEqual([]);
    expect(ecartsPartitionDefaut(apresCoup)).toHaveLength(1);
  });

  it("la partition par défaut peut être vide alors que l'horizon s'épuise", () => {
    // Le cas inverse : rien ne s'est encore produit, mais cela va se produire.
    // Seul le préventif le voit, et c'est tout son intérêt.
    const avant = etat({ moisCouverts: moisSuivants("2026-08", 2) });

    expect(ecartsHorizonPartitions(avant)).toHaveLength(1);
    expect(ecartsPartitionDefaut(avant)).toEqual([]);
  });
});
