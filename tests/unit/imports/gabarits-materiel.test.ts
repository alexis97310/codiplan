import { AssujettissementVgp } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { type FeuilleLue } from "@/lib/excel/classeur";
import { controlerFeuille, MOTIF_AMBIGUITE } from "@/lib/excel/controle";
import { champsMachine } from "@/lib/machines/saisie";
import { schemaFamilleMateriel } from "@/lib/materiel/saisie";
import {
  CHAMPS_EQUIPEMENTS,
  CHAMPS_EQUIPEMENTS_ECARTES,
  CHAMPS_FAMILLES,
  CHAMPS_FAMILLES_ECARTES,
  CHAMPS_FAMILLES_VGP,
  CHAMPS_FAMILLES_VGP_ECARTES,
  COLONNES_EQUIPEMENTS,
  COLONNES_FAMILLES,
  MODELE_FAMILLES,
  MOTIF_CLIENT_INTROUVABLE,
  MOTIF_MODELE_INTROUVABLE,
  MOTIF_SAISIE_REFUSEE,
  MOTIF_SITE_INTROUVABLE,
  cleDeLaFamille,
  cleDuModele,
  cleDuSite,
  marqueurDu,
  modeleEquipements,
  preparerUnEquipement,
  preparerUneFamille,
} from "@/lib/imports/modeles";
import {
  NAISSANCE,
  schemaAssujettissementFamille,
} from "@/lib/vgp/assujettissement";

/**
 * LES DEUX GABARITS DU MATÉRIEL (R6-03 ; D6, L9-03, L9-04, L9-06).
 *
 * **La population vient des SCHÉMAS, jamais des gabarits** — la parade du §9
 * (31/08) : *sélectionner « les colonnes du modèle » exclurait exactement le
 * champ qu'on a oublié d'exposer.* Les familles sont confrontées à DEUX schémas,
 * parce qu'elles en ont deux ; les équipements à `champsMachine`, l'objet que
 * `schemaMachine` enveloppe.
 */

/** Les champs d'un schéma, et lesquels refusent l'absence. */
function champsDe(shape: Record<string, unknown>) {
  return Object.entries(shape).map(([nom, champ]) => ({
    nom,
    obligatoire: !(
      champ as { safeParse: (v: unknown) => { success: boolean } }
    ).safeParse(undefined).success,
  }));
}

const CHAMPS_FAMILLE = champsDe(schemaFamilleMateriel.shape);
const CHAMPS_VGP = champsDe(
  // `superRefine` conserve la forme de l'objet — mesuré : les trois clés y sont.
  (
    schemaAssujettissementFamille as unknown as {
      shape: Record<string, unknown>;
    }
  ).shape,
);
const CHAMPS_MACHINE = champsDe(champsMachine.shape);

/**
 * CHAQUE CHAMP EST EXPOSÉ OU ÉCARTÉ NOMMÉMENT, et la réciproque est gardée
 * aussi : une colonne qui n'alimente aucun champ ferait remplir une case pour
 * rien, et une exemption qui ne s'adosse à rien n'exempte plus personne.
 */
function confronter(
  nom: string,
  champs: readonly { nom: string; obligatoire: boolean }[],
  exposes: Readonly<Record<string, string>>,
  ecartes: Readonly<Record<string, string>>,
) {
  describe(`le gabarit « ${nom} » dit exactement ce que la saisie attend`, () => {
    it("a réellement lu un schéma — le témoin de non-vacuité", () => {
      // *Deux listes vides s'accordent parfaitement* (§9, 10/09).
      expect(champs.length).toBeGreaterThan(0);
      expect(Object.keys(exposes).length + Object.keys(ecartes).length).toBe(
        champs.length,
      );
    });

    it("chaque champ du schéma est EXPOSÉ ou ÉCARTÉ nommément", () => {
      const cibles = new Set(Object.values(exposes));
      const orphelins = champs
        .filter((c) => !cibles.has(c.nom) && !Object.hasOwn(ecartes, c.nom))
        .map((c) => c.nom);
      expect(
        orphelins,
        "champs du schéma que le gabarit ignore en silence",
      ).toEqual([]);
    });

    it("chaque champ écarté porte son MOTIF, et existe au schéma", () => {
      const auSchema = new Set(champs.map((c) => c.nom));
      for (const [champ, motif] of Object.entries(ecartes)) {
        expect(motif.trim().length, champ).toBeGreaterThan(20);
        expect(auSchema.has(champ), `${champ} n'existe pas au schéma`).toBe(
          true,
        );
      }
    });

    it("aucune colonne ORPHELINE — le sens qu'on oublie", () => {
      const auSchema = new Set(champs.map((c) => c.nom));
      for (const champ of Object.values(exposes)) {
        expect(auSchema.has(champ), `${champ} n'existe pas au schéma`).toBe(
          true,
        );
      }
    });
  });
}

confronter(
  "familles",
  CHAMPS_FAMILLE,
  CHAMPS_FAMILLES,
  CHAMPS_FAMILLES_ECARTES,
);
confronter(
  "familles — l'assujettissement",
  CHAMPS_VGP,
  CHAMPS_FAMILLES_VGP,
  CHAMPS_FAMILLES_VGP_ECARTES,
);
confronter(
  "équipements",
  CHAMPS_MACHINE,
  CHAMPS_EQUIPEMENTS,
  CHAMPS_EQUIPEMENTS_ECARTES,
);

/* ────────────────────────────────────────────────────────────────────────
 * L'ASSUJETTISSEMENT — les règles du lot 9, lues là où elles mordent
 * ──────────────────────────────────────────────────────────────────────── */

/** Une ligne du gabarit « familles », par nom de colonne. */
function ligneFamille(
  valeurs: Partial<Record<keyof typeof COLONNES_FAMILLES, string>>,
): Record<string, string> {
  const ligne: Record<string, string> = {};
  for (const [cle, valeur] of Object.entries(valeurs)) {
    ligne[COLONNES_FAMILLES[cle as keyof typeof COLONNES_FAMILLES]] =
      valeur as string;
  }
  return ligne;
}

describe("l'assujettissement se déclare à la famille (L9-03, L9-04)", () => {
  it("une famille sans déclaration naît « à déterminer », jamais « non soumise »", () => {
    const prepare = preparerUneFamille(
      ligneFamille({ code: "PONT", libelle: "Ponts élévateurs" }),
    );
    expect(prepare.prete).toBe(true);
    if (!prepare.prete) return;
    expect(prepare.vgp.assujettissement).toBe(NAISSANCE);
    // **Et `NAISSANCE` n'est PAS `non_soumis`** — le témoin qui rend
    // l'assertion précédente informative. *Une case décochée est indiscernable
    // d'une famille jamais examinée*, et c'est cette distinction qu'on garde.
    expect(NAISSANCE).not.toBe(AssujettissementVgp.non_soumis);
    expect(prepare.vgp.periodiciteMois).toBeNull();
    expect(prepare.vgp.referenceTexte).toBeNull();
  });

  it("les QUATRE valeurs de l'énumération sont acceptées — la population en vient", () => {
    // **Le ticket dit « trois », la mesure en compte quatre**, et la population
    // de cette boucle vient de `AssujettissementVgp` : recopier trois noms ici
    // ferait passer le scénario tout en laissant `verifie` refusé.
    const valeurs = Object.values(AssujettissementVgp);
    expect(valeurs.length).toBeGreaterThanOrEqual(4);
    for (const valeur of valeurs) {
      const prepare = preparerUneFamille(
        ligneFamille({
          code: "PONT",
          libelle: "Ponts élévateurs",
          assujettissement: valeur,
          // `soumis` est le seul à exiger les deux autres colonnes : les
          // fournir partout éprouve la valeur, et non la règle de L9-04, qui a
          // ses propres scénarios ci-dessous.
          periodicite: "6",
          reference: "Code du travail NC, art. Lp. 261-1",
        }),
      );
      expect(prepare.prete, `${valeur} refusée`).toBe(true);
      if (prepare.prete) expect(prepare.vgp.assujettissement).toBe(valeur);
    }
  });

  it("la CASSE est tolérée, et rien d'autre ne l'est", () => {
    const majuscule = preparerUneFamille(
      ligneFamille({ code: "C", libelle: "L", assujettissement: "Non_Soumis" }),
    );
    expect(majuscule.prete).toBe(true);
    if (majuscule.prete) {
      expect(majuscule.vgp.assujettissement).toBe(
        AssujettissementVgp.non_soumis,
      );
    }

    // **« À déterminer » n'est PAS `a_determiner`.** L'accent et l'espace font
    // une autre chaîne, et elle est REFUSÉE plutôt que devinée : *une tolérance
    // qui les rapprocherait choisirait à la place de qui a saisi* — et le
    // silence tomberait du côté « on n'a pas regardé », qui est précisément
    // l'état qu'on ne veut pas inventer.
    const accentue = preparerUneFamille(
      ligneFamille({
        code: "C",
        libelle: "L",
        assujettissement: "À déterminer",
      }),
    );
    expect(accentue.prete).toBe(false);
    if (!accentue.prete) expect(accentue.motif).toBe(MOTIF_SAISIE_REFUSEE);
  });

  it("« soumis » exige la périodicité ET le texte qui la fonde (L9-04)", () => {
    const sansPeriodicite = preparerUneFamille(
      ligneFamille({
        code: "C",
        libelle: "L",
        assujettissement: "soumis",
        reference: "Code du travail NC",
      }),
    );
    expect(sansPeriodicite.prete).toBe(false);

    const sansTexte = preparerUneFamille(
      ligneFamille({
        code: "C",
        libelle: "L",
        assujettissement: "soumis",
        periodicite: "6",
      }),
    );
    // *Sans le texte, la périodicité est un chiffre que personne ne peut
    // défendre.* Les deux refus sont distincts au schéma ; le rapport ne rend
    // qu'un motif, et il renvoie au FICHIER dans les deux cas — ce qui est exact.
    expect(sansTexte.prete).toBe(false);

    // LE CAS QUI DOIT RESTER VERT POUR SA PROPRE RAISON (§9, 11/09) : si le
    // gabarit refusait `soumis` en toutes circonstances, les deux assertions
    // ci-dessus passeraient aussi.
    const complet = preparerUneFamille(
      ligneFamille({
        code: "C",
        libelle: "L",
        assujettissement: "soumis",
        periodicite: "6",
        reference: "Code du travail NC, art. Lp. 261-1",
      }),
    );
    expect(complet.prete).toBe(true);
    if (complet.prete) {
      expect(complet.vgp.periodiciteMois).toBe(6);
      expect(complet.vgp.referenceTexte).toBe(
        "Code du travail NC, art. Lp. 261-1",
      );
    }
  });

  it("les trois AUTRES valeurs n'exigent rien, et n'interdisent rien", () => {
    // Une famille qu'on vient de déclarer NON soumise peut garder la trace du
    // texte qu'on a lu pour le décider : c'est une information, pas une
    // contradiction (`lib/vgp/assujettissement.ts`).
    const prepare = preparerUneFamille(
      ligneFamille({
        code: "C",
        libelle: "L",
        assujettissement: "non_soumis",
        reference: "Arrêté examiné le 12/09",
      }),
    );
    expect(prepare.prete).toBe(true);
  });

  it("une périodicité ILLISIBLE est refusée, pas ramenée à l'absence", () => {
    // Le piège que L1-09d a mesuré, éprouvé ici sur l'autre périodicité : une
    // faute de frappe ne doit pas devenir une périodicité absente EN SILENCE.
    const faute = preparerUneFamille(
      ligneFamille({
        code: "C",
        libelle: "L",
        assujettissement: "soumis",
        periodicite: "six",
        reference: "Code du travail NC",
      }),
    );
    expect(faute.prete).toBe(false);
    if (!faute.prete) expect(faute.motif).toBe(MOTIF_SAISIE_REFUSEE);
  });

  it("la périodicité de la FAMILLE est en MOIS, et elle n'est pas celle du modèle", () => {
    // *Les mêler ferait facturer un entretien pour une vérification légale, ou
    // l'inverse.* La séparation se lit jusque dans le libellé des colonnes :
    // celle-ci nomme les VGP et son unité, celle du gabarit « modèles » nomme
    // les jours et le compteur.
    expect(COLONNES_FAMILLES.periodicite).toContain("VGP");
    expect(COLONNES_FAMILLES.periodicite).toContain("mois");
    expect(COLONNES_FAMILLES.assujettissement).toContain("VGP");
    expect(COLONNES_FAMILLES.reference).toContain("VGP");
  });

  it("le CODE seul identifie, et la clé est celle de l'index (D101)", () => {
    const cle = MODELE_FAMILLES.cle(ligneFamille({ code: "Pont-Élév" }), 3);
    expect(cle.cle).toBe(cleDeLaFamille("Pont-Élév"));
    // Une ligne sans code ne désigne rien : la clé de dernier recours porte son
    // rang, et elle ne peut pas se confondre avec une clé de famille.
    expect(MODELE_FAMILLES.cle(ligneFamille({ libelle: "L" }), 7).cle).toBe(
      "LIGNE-7",
    );
  });
});

/* ────────────────────────────────────────────────────────────────────────
 * LES ÉQUIPEMENTS — trois parents, et la clé du contrôle
 * ──────────────────────────────────────────────────────────────────────── */

const CLIENT = "11111111-1111-7111-8111-111111111111";
const SITE = "22222222-2222-7222-8222-222222222222";
const MODELE = "33333333-3333-7333-8333-333333333333";

/** Un parc où tout se résout — les trois parents de D6. */
const CLIENTS = {
  cles: new Set(["CLI-1"]),
  ambigues: new Set<string>(),
  fiches: new Map([["CLI-1", CLIENT]]),
};
const SITES = { fiches: new Map([[cleDuSite(CLIENT, "Atelier"), SITE]]) };
const MODELES = {
  fiches: new Map([[cleDuModele("Ravaglioli", "KPX-337"), MODELE]]),
};

function ligneEquipement(
  valeurs: Partial<Record<keyof typeof COLONNES_EQUIPEMENTS, string>>,
): Record<string, string> {
  const ligne: Record<string, string> = {};
  for (const [cle, valeur] of Object.entries(valeurs)) {
    ligne[COLONNES_EQUIPEMENTS[cle as keyof typeof COLONNES_EQUIPEMENTS]] =
      valeur as string;
  }
  return ligne;
}

const COMPLETE = {
  client: "CLI-1",
  site: "Atelier",
  marque: "Ravaglioli",
  reference: "KPX-337",
  numeroSerie: "10326169",
} as const;

describe("un équipement désigne TROIS parents, et le rejet dit lequel manque", () => {
  it("les trois résolus, la ligne passe", () => {
    const prepare = preparerUnEquipement(
      CLIENTS,
      SITES,
      MODELES,
      ligneEquipement(COMPLETE),
      3,
    );
    expect(prepare.prete).toBe(true);
    if (!prepare.prete) return;
    expect(prepare.saisie.modele_id).toBe(MODELE);
    expect(prepare.saisie.client_id).toBe(CLIENT);
    expect(prepare.saisie.site_id).toBe(SITE);
    // **Le chemin le sait, le fichier ne le déclare pas.**
    expect(prepare.saisie.source_creation).toBe("import");
  });

  it("le CLIENT introuvable porte SON motif", () => {
    const prepare = preparerUnEquipement(
      CLIENTS,
      SITES,
      MODELES,
      ligneEquipement({ ...COMPLETE, client: "CLI-INCONNU" }),
      3,
    );
    expect(prepare.prete).toBe(false);
    if (!prepare.prete) expect(prepare.motif).toBe(MOTIF_CLIENT_INTROUVABLE);
  });

  it("le SITE introuvable porte SON motif — client reconnu, libellé inconnu", () => {
    const prepare = preparerUnEquipement(
      CLIENTS,
      SITES,
      MODELES,
      ligneEquipement({ ...COMPLETE, site: "Hangar" }),
      3,
    );
    expect(prepare.prete).toBe(false);
    if (!prepare.prete) expect(prepare.motif).toBe(MOTIF_SITE_INTROUVABLE);
  });

  it("le MODÈLE introuvable porte SON motif — les deux autres reconnus", () => {
    const prepare = preparerUnEquipement(
      CLIENTS,
      SITES,
      MODELES,
      ligneEquipement({ ...COMPLETE, reference: "KPX-999" }),
      3,
    );
    expect(prepare.prete).toBe(false);
    if (!prepare.prete) expect(prepare.motif).toBe(MOTIF_MODELE_INTROUVABLE);
  });

  it("un client introuvable N'ANNONCE PAS aussi un site introuvable", () => {
    // **L'ORDRE est une décision** : la clé d'un site CONTIENT son client, si
    // bien qu'un client introuvable rend le site introuvable par construction.
    // *Annoncer les deux ferait chercher deux corrections là où il n'y en a
    // qu'une.* Le témoin : le libellé du site est ici parfaitement valide.
    const prepare = preparerUnEquipement(
      CLIENTS,
      SITES,
      MODELES,
      ligneEquipement({ ...COMPLETE, client: "CLI-INCONNU", site: "Atelier" }),
      3,
    );
    expect(prepare.prete).toBe(false);
    if (!prepare.prete) expect(prepare.motif).toBe(MOTIF_CLIENT_INTROUVABLE);
  });

  it("les trois se nomment SÉPARÉMENT — aucun ne partage son code", () => {
    const motifs = [
      MOTIF_CLIENT_INTROUVABLE,
      MOTIF_SITE_INTROUVABLE,
      MOTIF_MODELE_INTROUVABLE,
    ];
    expect(new Set(motifs).size).toBe(3);
    expect(motifs).not.toContain(MOTIF_SAISIE_REFUSEE);
  });
});

describe("le numéro de série vient de la CLÉ, jamais d'une seconde règle (D6)", () => {
  const modele = modeleEquipements(CLIENTS, SITES, MODELES);

  it("une série lisible donne une fiche COMPLÈTE", () => {
    const prepare = preparerUnEquipement(
      CLIENTS,
      SITES,
      MODELES,
      ligneEquipement(COMPLETE),
      3,
    );
    expect(prepare.prete).toBe(true);
    if (!prepare.prete) return;
    expect(prepare.saisie.numero_serie).toBe("10326169");
  });

  it("une plaque ILLISIBLE donne `SN-INCONNU-<référence>` et une fiche incomplète", () => {
    const valeurs = ligneEquipement({
      ...COMPLETE,
      numeroSerie: "",
      referenceInterne: "MAC-0128",
    });
    const prepare = preparerUnEquipement(CLIENTS, SITES, MODELES, valeurs, 3);
    expect(prepare.prete).toBe(true);
    if (!prepare.prete) return;
    expect(prepare.saisie.numero_serie).toBe("SN-INCONNU-MAC-0128");
    expect(prepare.saisie.reference_interne).toBe("MAC-0128");

    // **`complet` est DÉDUIT, et les deux déductions s'accordent** : celle du
    // rapprochement, qui alimente le décompte `incompletes` du rapport, et
    // celle de `schemaMachine`, qui écrit la colonne. *Deux sources d'un même
    // fait divergent en silence* — ici elles descendent de la même clé, et ce
    // scénario le constate plutôt que de le supposer.
    expect(modele.cle(valeurs, 3).complet).toBe(false);
  });

  it("une série DÉJÀ préfixée reste incomplète — elle n'est pas relue comme une série", () => {
    const valeurs = ligneEquipement({
      ...COMPLETE,
      numeroSerie: "SN-INCONNU-MAC-0224",
    });
    const prepare = preparerUnEquipement(CLIENTS, SITES, MODELES, valeurs, 3);
    expect(prepare.prete).toBe(true);
    if (!prepare.prete) return;
    // *La relire comme une série ferait passer une fiche incomplète pour une
    // fiche complète*, et deux passages du même fichier donneraient deux clés.
    expect(prepare.saisie.numero_serie).toBe("SN-INCONNU-MAC-0224");
    expect(modele.cle(valeurs, 3).complet).toBe(false);
  });

  it("NI série NI référence : la ligne est REFUSÉE, et `LIGNE-3` n'est pas gravé", () => {
    const valeurs = ligneEquipement({
      ...COMPLETE,
      numeroSerie: "",
      referenceInterne: "",
    });
    // La forme de dernier recours rend `LIGNE-3`, qui est une chaîne NON VIDE :
    // *sans la coupure, `texteNonVide` l'accepterait et une machine naîtrait
    // avec le rang d'un tableur gravé pour toujours.*
    expect(modele.cle(valeurs, 3).forme).toBe("rang");
    expect(modele.cle(valeurs, 3).cle).toBe("LIGNE-3");

    const prepare = preparerUnEquipement(CLIENTS, SITES, MODELES, valeurs, 3);
    expect(prepare.prete).toBe(false);
    if (!prepare.prete) expect(prepare.motif).toBe(MOTIF_SAISIE_REFUSEE);
  });

  it("une ligne sans numéro n'est pas prise pour un reste de GABARIT", () => {
    // Le CLIENT est identifiant : sans lui, une ligne qui nomme un client et un
    // lieu sans numéro serait *comptée, ignorée et jamais rejetée.*
    expect(modele.identifiantes).toContain(COLONNES_EQUIPEMENTS.client);
  });

  it("aucune colonne « Complet » n'existe, et le schéma l'interdit (§6)", () => {
    const colonnes = modele.colonnes.map((c) => c.nom.toLowerCase());
    expect(colonnes.some((nom) => nom.includes("complet"))).toBe(false);
    // *Le champ n'existe pas dans `champsMachine`* : on ne peut donc pas
    // l'ajouter par distraction, et un fichier n'a aucun moyen de mentir sur la
    // qualité d'une fiche.
    expect(Object.hasOwn(champsMachine.shape, "complet")).toBe(false);
  });
});

/* ────────────────────────────────────────────────────────────────────────
 * LA CRITICITÉ TOLÈRE LA CASSE — D-05, mesuré sur le jeu d'essai
 * ──────────────────────────────────────────────────────────────────────── */

describe("la criticité tolère la CASSE, comme l'assujettissement et les codes (D101)", () => {
  it("« Normale », recopiée avec la majuscule qu'un tableur met de lui-même, PASSE", () => {
    // *Mesuré (D-05) : avant ce rabattement, cette ligne — par ailleurs
    // parfaitement valide — se rejetait `saisie_refusee`, indiscernable d'une
    // criticité réellement fausse.*
    const prepare = preparerUnEquipement(
      CLIENTS,
      SITES,
      MODELES,
      ligneEquipement({ ...COMPLETE, criticite: "Normale" }),
      3,
    );
    expect(prepare.prete).toBe(true);
    if (!prepare.prete) return;
    expect(prepare.saisie.criticite).toBe("normale");
  });

  it("« BLOQUANTE » toutes capitales passe aussi", () => {
    const prepare = preparerUnEquipement(
      CLIENTS,
      SITES,
      MODELES,
      ligneEquipement({ ...COMPLETE, criticite: "BLOQUANTE" }),
      3,
    );
    expect(prepare.prete).toBe(true);
    if (!prepare.prete) return;
    expect(prepare.saisie.criticite).toBe("bloquante");
  });

  it("une criticité RÉELLEMENT fausse reste refusée — ceci n'est pas une tolérance de plus", () => {
    // *Rien n'est tranché ici* : `z.enum(CRITICITES_MACHINE)` reste seul juge.
    // Une valeur qui n'est PAS, à la casse près, l'une des trois connues est
    // refusée comme avant — aucune distance d'édition, aucun rapprochement sur
    // une ressemblance.
    const prepare = preparerUnEquipement(
      CLIENTS,
      SITES,
      MODELES,
      ligneEquipement({ ...COMPLETE, criticite: "Haute" }),
      3,
    );
    expect(prepare.prete).toBe(false);
    if (!prepare.prete) expect(prepare.motif).toBe(MOTIF_SAISIE_REFUSEE);
  });

  it("une cellule VIDE ne pose AUCUNE clé — le défaut du schéma décide seul", () => {
    // *Comme pour toute cellule vide* (`saisieDepuisLaLigne`) : une absence
    // n'écrit pas une chaîne vide, elle n'apparaît pas, et c'est
    // `champsMachine` qui pose alors son défaut (`normale`).
    const prepare = preparerUnEquipement(
      CLIENTS,
      SITES,
      MODELES,
      ligneEquipement(COMPLETE),
      3,
    );
    expect(prepare.prete).toBe(true);
    if (!prepare.prete) return;
    expect(Object.hasOwn(prepare.saisie, "criticite")).toBe(false);
  });
});

/* ────────────────────────────────────────────────────────────────────────
 * LA CHAÎNE RÉELLE, ET LA BORNE QUI EXPLIQUE LES COLONNES DE DATE
 * ──────────────────────────────────────────────────────────────────────── */

/** Une feuille au format de D31 : marqueur, en-têtes, données. */
function feuille(
  marqueur: string,
  entetes: readonly string[],
  lignes: readonly (readonly (string | { serie: number })[])[],
): FeuilleLue {
  return {
    nom: "f",
    lignes: [
      [{ texte: marqueur }],
      entetes.map((texte) => ({ texte })),
      ...lignes.map((l) =>
        l.map((c) => (typeof c === "string" ? { texte: c } : c)),
      ),
    ],
  };
}

const parcVide = { cles: new Set<string>(), ambigues: new Set<string>() };

describe("les deux gabarits se lisent par la chaîne réelle", () => {
  it("le marqueur des familles est DÉRIVÉ, et le contrôle l'accepte", () => {
    const controle = controlerFeuille(
      feuille(
        marqueurDu(MODELE_FAMILLES),
        MODELE_FAMILLES.colonnes.map((c) => c.nom),
        [["PONT", "Ponts élévateurs", "soumis", "6", "Code du travail NC"]],
      ),
      MODELE_FAMILLES,
      parcVide,
    );
    expect(controle.lisible).toBe(true);
    if (!controle.lisible) return;
    expect(controle.anomalies).toEqual([]);
    expect(controle.inconnues).toEqual([]);
    expect(controle.proposition.creations).toBe(1);
    expect(controle.proposition.rejets).toBe(0);
    expect(controle.totalExplique).toBe(true);
  });

  it("le marqueur des équipements aussi, et la fiche incomplète est COMPTÉE", () => {
    const modele = modeleEquipements(CLIENTS, SITES, MODELES);
    const controle = controlerFeuille(
      feuille(
        marqueurDu(modele),
        modele.colonnes.map((c) => c.nom),
        [
          ["CLI-1", "Atelier", "Ravaglioli", "KPX-337", "10326169", "", "", ""],
          ["CLI-1", "Atelier", "Ravaglioli", "KPX-337", "", "MAC-0128", "", ""],
        ],
      ),
      modele,
      parcVide,
    );
    expect(controle.lisible).toBe(true);
    if (!controle.lisible) return;
    expect(controle.proposition.creations).toBe(2);
    expect(controle.proposition.rejets).toBe(0);
    // **`incompletes` QUALIFIE, elle ne s'ajoute pas** : une seule des deux
    // fiches entrera à compléter, et le total explique toujours chaque ligne.
    expect(controle.proposition.incompletes).toBe(1);
    expect(controle.totalExplique).toBe(true);
  });

  it("une clé AMBIGUË rejette la ligne plutôt que d'écraser au hasard", () => {
    const modele = modeleEquipements(CLIENTS, SITES, MODELES);
    const controle = controlerFeuille(
      feuille(
        marqueurDu(modele),
        modele.colonnes.map((c) => c.nom),
        [["CLI-1", "Atelier", "Ravaglioli", "KPX-337", "10326169", "", "", ""]],
      ),
      modele,
      // *L'ambiguïté est un fait du PARC* : `machine` ne porte AUCUNE unicité
      // sur la série seule — elle est `(societe_id, modele_id, numero_serie)`.
      { cles: new Set(["10326169"]), ambigues: new Set(["10326169"]) },
    );
    expect(controle.lisible).toBe(true);
    if (!controle.lisible) return;
    expect(controle.lignes[0]?.rejetMotif).toBe(MOTIF_AMBIGUITE);
  });

  it("LA BORNE MESURÉE : le dictionnaire de ligne ne rend AUCUNE date", () => {
    // **C'est le motif écrit dans `CHAMPS_EQUIPEMENTS_ECARTES`**, et il est
    // mesuré plutôt que déduit d'une lecture du code : une cellule de DATE
    // porte `serie`, que `texte()` ne lit pas. *Exposer « Date de mise en
    // service » ferait une case que le client remplit et que personne ne lit.*
    //
    // **Condition de levée, vérifiable** : le jour où ce scénario rougira,
    // c'est que le dictionnaire de ligne rend une date — et les trois colonnes
    // écartées redeviennent exposables.
    const modele = modeleEquipements(CLIENTS, SITES, MODELES);
    const controle = controlerFeuille(
      feuille(
        marqueurDu(modele),
        [...modele.colonnes.map((c) => c.nom), "Sonde"],
        [
          [
            "CLI-1",
            "Atelier",
            "Ravaglioli",
            "KPX-337",
            "10326169",
            "",
            "",
            "",
            { serie: 46000 },
          ],
        ],
      ),
      modele,
      parcVide,
    );
    expect(controle.lisible).toBe(true);
    if (!controle.lisible) return;
    // La colonne est inconnue du gabarit, donc absente du dictionnaire ; c'est
    // la cellule elle-même qu'on interroge par une colonne connue ci-dessous.
    expect(controle.inconnues).toEqual(["Sonde"]);

    const avecDate = controlerFeuille(
      feuille(
        marqueurDu(modele),
        modele.colonnes.map((c) => c.nom),
        [
          [
            "CLI-1",
            "Atelier",
            "Ravaglioli",
            "KPX-337",
            "10326169",
            { serie: 46000 },
            "",
            "",
          ],
        ],
      ),
      modele,
      parcVide,
    );
    expect(avecDate.lisible).toBe(true);
    if (!avecDate.lisible) return;
    // **La cellule de date rend `undefined`** — elle n'est ni du texte, ni un
    // nombre pour `texte()`.
    expect(
      avecDate.lignes[0]?.valeurs[COLONNES_EQUIPEMENTS.referenceInterne],
    ).toBeUndefined();
  });
});
