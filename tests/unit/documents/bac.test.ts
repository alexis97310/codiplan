import { describe, expect, it } from "vitest";

import {
  formeComparable,
  propositions,
  totalExplique,
} from "@/lib/documents/propositions";
import {
  cibleDocument,
  colonnesDeCible,
  empreinteSha256,
  schemaClassement,
  schemaDocument,
  schemaDocumentRecu,
  schemaEcartement,
} from "@/lib/documents/saisie";

/**
 * LE BAC DE RÉCEPTION, ET CE QU'IL REFUSE DE DÉCIDER SEUL (L8-07, D87).
 *
 * *Un rapprochement faux accroche la notice d'un compresseur à un pont
 * élévateur, et personne ne le voit avant qu'un technicien suive la mauvaise
 * procédure.* Les scénarios ci-dessous éprouvent donc autant ce que le bac
 * PROPOSE que ce qu'il se refuse à conclure.
 */

const EMPREINTE = "a".repeat(64);

const CATALOGUE = {
  modeles: [
    { id: "m-1", marque: "Atlas", reference: "GA-11" },
    { id: "m-2", marque: "Ravaglioli", reference: "KPX-337" },
  ],
  machines: [
    { id: "x-1", numero_serie: "SN-A1-4471" },
    { id: "x-2", numero_serie: "SN-INCONNU-ATELIER-3" },
  ],
} as const;

describe("le rapprochement se fait sur la CLÉ, jamais sur une ressemblance", () => {
  it("propose le modèle dont la référence est dans le nom du fichier", () => {
    const trouvees = propositions("Notice_GA-11_fr.pdf", CATALOGUE);
    expect(trouvees).toHaveLength(1);
    expect(trouvees[0]?.cible).toEqual({ cible: "modele", modele_id: "m-1" });
    // La CLÉ est rendue avec la proposition : une proposition dont on ne voit
    // pas la raison se ratifie sans être lue.
    expect(trouvees[0]?.cle).toBe("GA-11");
  });

  it("tolère la GRAPHIE de la clé, jamais la clé elle-même", () => {
    // `GA-11`, `ga 11` et `GA_11` sont la même référence écrite trois fois.
    expect(propositions("notice ga 11.pdf", CATALOGUE)).toHaveLength(1);
    expect(propositions("NOTICE_GA_11.PDF", CATALOGUE)).toHaveLength(1);
    // LE CAS QUI DOIT RESTER VERT POUR SA PROPRE RAISON (§9, 11/09) : la
    // référence VOISINE ne propose rien. Si le module se mettait à mesurer une
    // ressemblance, ce témoin tomberait — et lui seul.
    expect(propositions("notice GA-12.pdf", CATALOGUE)).toEqual([]);
  });

  it("ne propose RIEN quand le nom ne dit rien — et ce n'est pas un rejet", () => {
    // *72 % de l'historique d'import ne se rattache à rien et se reprend quand
    // même* (L1-08b). Ici de même : le fichier reste à traiter, et l'humain lui
    // donne sa cible en regardant sa première page.
    expect(propositions("scan_2019_047.pdf", CATALOGUE)).toEqual([]);
  });

  it("les MODÈLES viennent d'abord — une notice sert toutes leurs machines", () => {
    const trouvees = propositions("KPX-337 et SN-A1-4471.pdf", CATALOGUE);
    expect(trouvees.map((p) => p.cible.cible)).toEqual(["modele", "machine"]);
  });

  it("une clé trop courte n'est jamais cherchée", () => {
    // Une clé de deux caractères se retrouverait dans presque tout nom de
    // fichier, et une proposition qui se déclenche toujours apprend à ne plus
    // lire les propositions (§9, 11/09).
    const court = {
      modeles: [{ id: "m-3", marque: "X", reference: "A1" }],
      machines: [],
    } as const;
    expect(propositions("A1-notice-A1.pdf", court)).toEqual([]);
    expect(formeComparable("A1")).toBe("a1");
  });
});

describe("la CIBLE est une somme, et le type refuse l'état interdit", () => {
  it("accepte le modèle SEUL et la machine SEULE", () => {
    expect(
      cibleDocument.safeParse({
        cible: "modele",
        modele_id: "0198c0f0-0000-7000-8000-000000000001",
      }).success,
    ).toBe(true);
    expect(
      cibleDocument.safeParse({
        cible: "machine",
        machine_id: "0198c0f0-0000-7000-8000-000000000002",
      }).success,
    ).toBe(true);
  });

  it("refuse une cible qui n'en est pas une", () => {
    expect(cibleDocument.safeParse({ cible: "contrat" }).success).toBe(false);
    expect(cibleDocument.safeParse({}).success).toBe(false);
  });

  it("les colonnes rendues portent l'une OU l'autre, jamais deux à la fois", () => {
    expect(colonnesDeCible({ cible: "modele", modele_id: "m" })).toEqual({
      modele_id: "m",
      machine_id: null,
      intervention_id: null,
    });
    expect(colonnesDeCible({ cible: "machine", machine_id: "x" })).toEqual({
      modele_id: null,
      machine_id: "x",
      intervention_id: null,
    });
    // La troisième cible (BON-2) : les photos d'une intervention.
    expect(
      colonnesDeCible({ cible: "intervention", intervention_id: "i" }),
    ).toEqual({
      modele_id: null,
      machine_id: null,
      intervention_id: "i",
    });
  });
});

describe("l'empreinte a une FORME, et la casse est REFUSÉE plutôt que normalisée", () => {
  it("accepte 64 hexadécimaux minuscules", () => {
    expect(empreinteSha256.safeParse(EMPREINTE).success).toBe(true);
  });

  it("refuse les majuscules — normaliser laisserait croire à un contrat", () => {
    // Deux écritures d'un même condensat feraient deux documents distincts, et
    // la déduplication laisserait passer le doublon qu'elle existe pour
    // attraper.
    expect(empreinteSha256.safeParse("A".repeat(64)).success).toBe(false);
  });

  it("refuse une longueur qui n'est pas celle d'un SHA-256", () => {
    expect(empreinteSha256.safeParse("a".repeat(63)).success).toBe(false);
    expect(empreinteSha256.safeParse("a".repeat(65)).success).toBe(false);
  });
});

describe("le classement et l'écartement exigent chacun leur preuve", () => {
  it("un classement sans cible est refusé", () => {
    expect(
      schemaClassement.safeParse({ classe: "client", libelle: "Notice" })
        .success,
    ).toBe(false);
  });

  it("un écartement sans motif est refusé", () => {
    expect(schemaEcartement.safeParse({}).success).toBe(false);
    expect(schemaEcartement.safeParse({ motif: "   " }).success).toBe(false);
    expect(schemaEcartement.safeParse({ motif: "illisible" }).success).toBe(
      true,
    );
  });

  it("aucune classe par défaut — celui qui dépose choisit", () => {
    const sansClasse = schemaDocument.safeParse({
      cible: {
        cible: "modele",
        modele_id: "0198c0f0-0000-7000-8000-0000000000c1",
      },
      libelle: "Notice",
      nom_fichier: "n.pdf",
      type_mime: "application/pdf",
      taille_octets: 10,
      empreinte: EMPREINTE,
      objet_cle: "bac/n.pdf",
    });
    // Un défaut se tromperait dans un sens ou dans l'autre, et un document mal
    // classé est pire qu'un document absent.
    expect(sansClasse.success).toBe(false);
  });

  it("les deux dates de L8-06 sont facultatives, et personne ne les invente", () => {
    const fiche = schemaDocument.parse({
      cible: {
        cible: "machine",
        machine_id: "0198c0f0-0000-7000-8000-0000000000a1",
      },
      classe: "interne",
      libelle: "Rapport",
      nom_fichier: "r.pdf",
      type_mime: "application/pdf",
      taille_octets: 10,
      empreinte: EMPREINTE,
      objet_cle: "bac/r.pdf",
    });
    expect(fiche.date_document).toBeNull();
    expect(fiche.date_expiration).toBeNull();
  });

  it("un fichier vide n'est pas un document", () => {
    const zero = schemaDocumentRecu.safeParse({
      empreinte: EMPREINTE,
      nom_fichier: "vide.pdf",
      type_mime: "application/pdf",
      taille_octets: 0,
      objet_cle: "bac/vide.pdf",
    });
    expect(zero.success).toBe(false);
  });

  it("l'aperçu de la première page est facultatif — sinon le dépôt se perdrait", () => {
    const recu = schemaDocumentRecu.parse({
      empreinte: EMPREINTE,
      nom_fichier: "n.pdf",
      type_mime: "application/pdf",
      taille_octets: 10,
      objet_cle: "bac/n.pdf",
    });
    expect(recu.apercu_objet_cle).toBeNull();
  });
});

describe("le TOTAL explique chaque fichier reçu", () => {
  it("les trois états sont exclusifs, et leur somme vaut le nombre de reçus", () => {
    expect(
      totalExplique({ recus: 10, a_traiter: 4, classes: 5, ecartes: 1 }),
    ).toBe(true);
  });

  it("un total qui ne s'explique pas est refusé — dans les DEUX sens", () => {
    // *Sinon le témoin dirait faux dans le sens rassurant* (L1-08b) : un total
    // trop grand cache des fichiers non traités, un total trop petit invente du
    // travail fait.
    expect(
      totalExplique({ recus: 10, a_traiter: 4, classes: 5, ecartes: 0 }),
    ).toBe(false);
    expect(
      totalExplique({ recus: 10, a_traiter: 4, classes: 5, ecartes: 2 }),
    ).toBe(false);
  });
});
