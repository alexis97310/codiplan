import { describe, expect, it } from "vitest";

import {
  TABLES_ASCENDANCE,
  TABLES_HERITAGE,
  TABLES_INTERNES,
  ecartsListeAscendance,
  ecartsListeHeritage,
  ecartsListeInterne,
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

/**
 * La clause réellement écrite en base sur `document` (migration du lot 8,
 * troisième cible — l'intervention — ajoutée au ticket 17-BON-2).
 */
const CLAUSE_HERITAGE =
  `(EXISTS (SELECT 1 FROM machine WHERE (machine.id = document.machine_id)) ` +
  `OR EXISTS (SELECT 1 FROM modele_materiel WHERE (modele_materiel.id = document.modele_id)) ` +
  `OR EXISTS (SELECT 1 FROM intervention WHERE (intervention.id = document.intervention_id))) ` +
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
    // Et ses TROIS cibles (la troisième, l'intervention, depuis 17-BON-2) :
    // en omettre une ferait d'une part des documents des lignes invisibles,
    // en silence.
    expect(TABLES_HERITAGE[0]?.cibles.map((c) => c.parent).sort()).toEqual([
      "intervention",
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

describe("la liste close de la TREIZIÈME forme — « interne »", () => {
  it("l'état du dépôt n'a aucun écart", () => {
    expect(ecartsListeInterne()).toEqual([]);
  });

  it("elle porte les cinq tables ARBITRÉES, et D94 dit ce qu'elle laisse ouvert", () => {
    // La forme ferme les tables qu'elle crée ; elle ne prétend PAS fermer la
    // classe. `taux_horaire`, `forfait`, `agence` posent la même question
    // aujourd'hui, et D94 l'écrit avec sa condition de réouverture plutôt que
    // de l'étendre en séance.
    //
    // **`import_lot` et `import_lot_ligne` s'y ajoutent par D100, et elles s'y
    // ajoutent À LEUR NAISSANCE — ce qui est la seule chose qui rende ce choix
    // bon marché** (I1). Ce n'est donc pas la classe de D94 qui s'élargit :
    // ce sont deux tables nouvelles qui reçoivent leur forme au moment où la
    // question se pose sans effort.
    //
    // **`absence` s'y ajoute à L3-04, à SA NAISSANCE elle aussi** (RG-PLA-06).
    // Sa fuite n'est pas celle des trois autres — elle ne nomme aucun fichier :
    // *« votre technicien habituel est en arrêt du 14 au 28 » est une donnée de
    // santé par déduction.* C'est pourquoi chaque entrée porte désormais le
    // motif de SON retrait, et non un gabarit qui parlait de noms de fichiers
    // pour toutes (§9, 10/09).
    //
    // **`segment_travail` s'y ajoute à R5-02, à SA NAISSANCE elle aussi**
    // (D119). Sa fuite est celle d'`absence`, un cran plus fin : *combien de
    // temps une personne nommée a passé chez un client, minute par minute, est
    // une information sur cette personne.* Et elle est la PREMIÈRE table de
    // cette liste qui soit aussi une FILLE d'une table du parc — le critère de
    // la filiation la réclamerait, et « interne » ferme davantage : la
    // comparaison est écrite dans `ecartsTablesFilles`, pas supposée.
    expect([...TABLES_INTERNES]).toEqual([
      "document_recu",
      "absence",
      "import_lot",
      "import_lot_ligne",
      "segment_travail",
    ]);
  });

  it("une ADDITION est refusée — c'est un arbitrage, pas une commodité", () => {
    const ecarts = ecartsListeInterne([
      "document_recu",
      "absence",
      "import_lot",
      "import_lot_ligne",
      "segment_travail",
      "taux_horaire",
    ]);
    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("taux_horaire");
  });

  it("le RETRAIT — le sens SILENCIEUX — est refusé lui aussi, et CHACUN dit ce qu'il rouvre", () => {
    const ecarts = ecartsListeInterne([]);
    expect(ecarts).toHaveLength(5);
    expect(ecarts[0]).toMatch(/NOMS DE FICHIERS/);
    // Et celui de `segment_travail` ne parle ni de fichier ni de santé : il
    // parle de MINUTES. *Trois motifs distincts sur cinq entrées est ce qui
    // distingue un constat d'un gabarit.*
    const surLeCompteur = ecarts.find((ecart) =>
      ecart.includes("segment_travail"),
    );
    expect(surLeCompteur).toMatch(/MINUTE PAR MINUTE/);
    expect(surLeCompteur).not.toMatch(/NOMS DE FICHIERS/);
    // **Le motif n'est plus un gabarit** : celui d'`absence` ne parle d'aucun
    // fichier, et c'est ce qui distingue un constat d'une phrase préécrite
    // qu'un dispositif réémet en votre nom (§9, 10/09).
    const surLAbsence = ecarts.find((ecart) => ecart.includes("absence"));
    expect(surLAbsence).toMatch(/donnée de santé par déduction/);
    expect(surLAbsence).not.toMatch(/NOMS DE FICHIERS/);
  });

  it("la clause écrite en base PASSE, et celle sans discriminant est refusée", () => {
    const interne =
      `(societe_id = (NULLIF(current_setting('app.societe_id'::text, true), ''::text))::uuid) ` +
      `AND (NULLIF(current_setting('app.client_id'::text, true), ''::text) IS NULL)`;
    expect(
      ecartsPolitiques(
        [colonne("document_recu")],
        [politique("document_recu", interne)],
      ),
    ).toEqual([]);

    // LA FAUTE TELLE QU'ELLE SE COMMETTRAIT : la clause de société seule, celle
    // que onze tables portent, et qu'un compte portail muni d'une société lit.
    const societeSeule = `societe_id = (NULLIF(current_setting('app.societe_id'::text, true), ''::text))::uuid`;
    const ecarts = ecartsPolitiques(
      [colonne("document_recu")],
      [politique("document_recu", societeSeule)],
    );
    expect(ecarts.join("\n")).toMatch(/app\.client_id/);
  });
});

describe("`formeAttendue` range les quatre tables où il faut", () => {
  it("et le voisin qui LEUR RESSEMBLE reste sous « société »", () => {
    expect(formeAttendue("document")).toBe("héritage");
    expect(formeAttendue("modele_materiel")).toBe("ascendance");
    expect(formeAttendue("famille_materiel")).toBe("ascendance");
    expect(formeAttendue("document_recu")).toBe("interne");
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
    // La faute silencieuse : les documents du modèle disparaissent, et la
    // liste se raccourcit sans que personne sache ce qui manque.
    const amputee =
      `(EXISTS (SELECT 1 FROM machine WHERE (machine.id = document.machine_id)) ` +
      `OR EXISTS (SELECT 1 FROM intervention WHERE (intervention.id = document.intervention_id))) ` +
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
      `OR EXISTS (SELECT 1 FROM modele_materiel WHERE (modele_materiel.id = document.modele_id)) ` +
      `OR EXISTS (SELECT 1 FROM intervention WHERE (intervention.id = document.intervention_id))`;
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
