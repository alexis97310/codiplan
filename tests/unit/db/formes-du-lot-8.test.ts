import { describe, expect, it } from "vitest";

import {
  TABLES_ASCENDANCE,
  TABLES_HERITAGE,
  ecartsListeAscendance,
  ecartsListeHeritage,
  ecartsPolitiques,
  formeAttendue,
  type ColonneSociete,
  type PolitiqueObservee,
} from "@/scripts/lib/politiques-rls";

/**
 * LES DEUX FORMES DU LOT 8, GARDÉES DANS LES DEUX SENS (D93).
 *
 * *« Héritage »* pour `document` — la cible polymorphe est visible, et la
 * classe rétrécit. *« Ascendance »* pour `modele_materiel` et
 * `famille_materiel` — un parent n'est visible, pour un compte portail, que si
 * l'un de ses enfants l'est.
 *
 * **Ce fichier éprouve les DEUX directions du prédicat** (§9, 11/09) : à côté
 * de chaque cas qui doit rougir, un cas qui doit rester vert POUR SA PROPRE
 * RAISON. Une mise en échec seule n'éprouve que la moitié bruyante ; la moitié
 * permissive, celle qui ne produit jamais de signal, ne s'éprouve que par un
 * succès dont on a vérifié la cause.
 */

/** La clause réellement écrite en base sur `document` (migration du lot 8). */
const CLAUSE_HERITAGE =
  `(EXISTS (SELECT 1 FROM machine WHERE (machine.id = document.machine_id)) ` +
  `OR EXISTS (SELECT 1 FROM modele_materiel WHERE (modele_materiel.id = document.modele_id))) ` +
  `AND ((classe = 'client'::"ClasseDocument") ` +
  `OR (NULLIF(current_setting('app.client_id'::text, true), ''::text) IS NULL))`;

/** La clause réellement écrite en base sur `modele_materiel`. */
const CLAUSE_ASCENDANCE =
  `(societe_id = (NULLIF(current_setting('app.societe_id'::text, true), ''::text))::uuid) ` +
  `AND ((NULLIF(current_setting('app.client_id'::text, true), ''::text) IS NULL) ` +
  `OR (EXISTS (SELECT 1 FROM machine WHERE (machine.modele_id = modele_materiel.id))))`;

function politique(
  table: string,
  clause: string,
  nom = "cloisonnement",
): PolitiqueObservee {
  return {
    table,
    nom,
    commande: "ALL",
    permissive: "PERMISSIVE",
    lecture: clause,
    ecriture: clause,
  };
}

function colonne(table: string): ColonneSociete {
  return { table, presente: true, obligatoire: true };
}

describe("la liste close de la ONZIÈME forme — « héritage »", () => {
  it("l'état du dépôt n'a aucun écart — sinon tout le reste ment", () => {
    expect(ecartsListeHeritage()).toEqual([]);
  });

  it("elle porte l'entrée que D93 arbitre — témoin de non-vacuité", () => {
    expect(TABLES_HERITAGE.map((e) => e.table)).toEqual(["document"]);
    // Et ses DEUX cibles : une seule ferait de la moitié des documents des
    // lignes invisibles, en silence.
    expect(TABLES_HERITAGE[0]?.cibles.map((c) => c.parent).sort()).toEqual([
      "machine",
      "modele_materiel",
    ]);
  });

  it("une ADDITION est refusée, et le message dit pourquoi", () => {
    const ecarts = ecartsListeHeritage(["document", "intervention"]);
    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("intervention");
    expect(ecarts[0]).toMatch(/arbitrage/);
  });

  it("le RETRAIT — le sens SILENCIEUX — est refusé lui aussi", () => {
    const ecarts = ecartsListeHeritage([]);
    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("document");
    expect(ecarts[0]).toMatch(/clause de société seule/);
  });
});

describe("la liste close de la DOUZIÈME forme — « ascendance »", () => {
  it("l'état du dépôt n'a aucun écart", () => {
    expect(ecartsListeAscendance()).toEqual([]);
  });

  it("elle porte les DEUX étages, et c'est la chaîne qui compte", () => {
    // Fermer `modele_materiel` sans `famille_materiel` laisserait la fuite
    // remonter d'un cran : une famille « ponts élévateurs » visible dit qu'il y
    // a un pont quelque part.
    expect(TABLES_ASCENDANCE.map((e) => e.table)).toEqual([
      "modele_materiel",
      "famille_materiel",
    ]);
  });

  it("une ADDITION est refusée", () => {
    const ecarts = ecartsListeAscendance([
      "modele_materiel",
      "famille_materiel",
      "client",
    ]);
    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("client");
  });

  it("le RETRAIT d'un SEUL des deux étages est refusé", () => {
    const ecarts = ecartsListeAscendance(["modele_materiel"]);
    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("famille_materiel");
    expect(ecarts[0]).toMatch(/clause de société SEULE/);
  });
});

describe("`formeAttendue` range les trois tables où il faut", () => {
  it("et le voisin qui LEUR RESSEMBLE reste sous « société »", () => {
    expect(formeAttendue("document")).toBe("héritage");
    expect(formeAttendue("modele_materiel")).toBe("ascendance");
    expect(formeAttendue("famille_materiel")).toBe("ascendance");
    // LE CAS QUI DOIT RESTER VERT POUR SA PROPRE RAISON : `habilitation` est
    // une table de référentiel métier de la même famille de noms, et elle n'a
    // rien à voir. Si `formeAttendue` se mettait à ranger par ressemblance, ce
    // témoin tomberait.
    expect(formeAttendue("habilitation")).toBe("société");
    expect(formeAttendue("machine")).toBe("parc");
  });
});

describe("la FORME est jugée sur la clause, et les deux sens sont éprouvés", () => {
  it("la clause réellement écrite en base PASSE, et pour sa propre raison", () => {
    const ecarts = ecartsPolitiques(
      [colonne("document"), colonne("modele_materiel")],
      [
        politique("document", CLAUSE_HERITAGE),
        politique("modele_materiel", CLAUSE_ASCENDANCE),
      ],
    );
    expect(ecarts).toEqual([]);
  });

  it("une clause d'héritage amputée d'UNE cible est refusée, et la nomme", () => {
    // La faute silencieuse : la moitié des documents — ceux du modèle —
    // disparaît, et la liste se raccourcit sans que personne sache ce qui
    // manque.
    const amputee =
      `EXISTS (SELECT 1 FROM machine WHERE (machine.id = document.machine_id)) ` +
      `AND ((classe = 'client'::"ClasseDocument") ` +
      `OR (NULLIF(current_setting('app.client_id'::text, true), ''::text) IS NULL))`;
    const ecarts = ecartsPolitiques(
      [colonne("document")],
      [politique("document", amputee)],
    );
    expect(ecarts.join("\n")).toMatch(/modele_materiel/);
    expect(ecarts.join("\n")).toMatch(/modele_id/);
  });

  it("une clause d'héritage sans rétrécissement de classe est refusée", () => {
    const sansClasse =
      `EXISTS (SELECT 1 FROM machine WHERE (machine.id = document.machine_id)) ` +
      `OR EXISTS (SELECT 1 FROM modele_materiel WHERE (modele_materiel.id = document.modele_id))`;
    const ecarts = ecartsPolitiques(
      [colonne("document")],
      [politique("document", sansClasse)],
    );
    expect(ecarts.join("\n")).toMatch(/RÉTRÉCIT pas/);
  });

  it("une clause d'héritage qui ANCRE EN PLUS la société est refusée", () => {
    // Le correcteur bien intentionné (§9, 26/08, forme 5) : il ajoute « par
    // sécurité » l'ancrage que toutes les autres tables portent. C'est une
    // seconde lecture du même critère, et deux lectures divergent en silence.
    const ancree =
      `(societe_id = (NULLIF(current_setting('app.societe_id'::text, true), ''::text))::uuid) AND ` +
      CLAUSE_HERITAGE;
    const ecarts = ecartsPolitiques(
      [colonne("document")],
      [politique("document", ancree)],
    );
    expect(ecarts.join("\n")).toMatch(/SECONDE source du même fait/);
  });

  it("LA FAUTE TELLE QU'ELLE SE COMMETTRAIT — l'ascendance « simplifiée » en clause de société", () => {
    // C'est le geste exact que le jumeau d'isolation joue en base : rendre à
    // `modele_materiel` la forme que onze autres tables portent. Elle passe
    // tous les gardiens de forme « société » — d'où l'obligation d'une forme à
    // elle, et d'une liste close gardée dans les deux sens.
    const societeSeule = `societe_id = (NULLIF(current_setting('app.societe_id'::text, true), ''::text))::uuid`;
    const ecarts = ecartsPolitiques(
      [colonne("modele_materiel")],
      [politique("modele_materiel", societeSeule)],
    );
    expect(ecarts.join("\n")).toMatch(/app\.client_id/);
    expect(ecarts.join("\n")).toMatch(/EXISTS/);
  });

  it("une ascendance qui perd son ancrage société est refusée aussi", () => {
    const sansSociete =
      `(NULLIF(current_setting('app.client_id'::text, true), ''::text) IS NULL) ` +
      `OR (EXISTS (SELECT 1 FROM machine WHERE (machine.modele_id = modele_materiel.id)))`;
    const ecarts = ecartsPolitiques(
      [colonne("modele_materiel")],
      [politique("modele_materiel", sansSociete)],
    );
    expect(ecarts.join("\n")).toMatch(/RÉTRÉCIT le cloisonnement de société/);
  });
});
