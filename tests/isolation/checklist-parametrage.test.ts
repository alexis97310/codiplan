import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { type ContexteSession } from "@/lib/auth/contexte";
import { Role } from "@/lib/auth/roles";
import {
  basculerActiviteChecklist,
  creerModele,
  listerLesModelesChecklist,
  listerLesVersionsChecklist,
  obtenirModeleChecklist,
  publierVersion,
} from "@/lib/checklists/depot";
import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  FAMILLE_A,
  FAMILLE_B,
  SOCIETE_A,
  SOCIETE_B,
  UTILISATEUR_INTERNE_A,
} from "./setup/fixtures";

/**
 * 9K19-CHECKLIST-PARAMETRAGE (CK3) — LE PARAMÉTRAGE, SUR LE CHEMIN DE
 * PRODUCTION RÉEL (`creerModele`, `publierVersion`,
 * `basculerActiviteChecklist`, `listerLesModelesChecklist`).
 *
 * Toute scène pose ses PROPRES lignes (préfixe `9K19`) et les efface en
 * `afterAll` — aucune écriture sur `FAMILLE_A`/`FAMILLE_B` du harnais
 * partagé, lues seulement.
 *
 * **Non dupliqué** : l'exclusivité des trois rattachements
 * (`checklist_modele_un_seul_rattachement`, D238) et le chaînage composite
 * sous-type/famille sont déjà éprouvés au niveau SQL par
 * `tests/isolation/sous-type-materiel.test.ts` (ticket 9K17A) — ce fichier
 * n'éprouve que la TRADUCTION de ces refus en motif, par `creerModele` et
 * `motifModeleChecklist`.
 */

afterAll(fermerClients);

function session(
  utilisateurId: string,
  societeId: string,
  role: Role,
): ContexteSession {
  return {
    utilisateurId,
    societeId,
    role,
    secondFacteurValide: true,
    adresseIp: null,
    clientId: null,
  };
}

const INTERNE_A = session(UTILISATEUR_INTERNE_A, SOCIETE_A, Role.admin_societe);
// MÊME utilisateur, posé sous SOCIETE_B — même patron que `COMPLET_B` de
// `tests/isolation/checklist-domaine.test.ts` : seule la société posée dans
// le contexte gouverne la RLS, jamais l'identité réelle de l'auteur.
const INTERNE_B = session(UTILISATEUR_INTERNE_A, SOCIETE_B, Role.admin_societe);

const SOUS_TYPE_A = "aaaaaaaa-0000-7000-8000-0000000019a1";
const SOUS_TYPE_B = "bbbbbbbb-0000-7000-8000-0000000019b1";

/** Les versions (`onDelete: Restrict`) d'abord — leurs points suivent en CASCADE. */
async function supprimerModele(id: string): Promise<void> {
  await clientOwner().checklistVersion.deleteMany({
    where: { checklist_modele_id: id },
  });
  await clientOwner().checklistModele.deleteMany({ where: { id } });
}

/** `creerModele`, avec un libellé par défaut — aucun scénario ci-dessous ne le juge. */
function creer(
  contexte: ContexteSession,
  saisie: Omit<Parameters<typeof creerModele>[1], "libelle"> &
    Partial<Pick<Parameters<typeof creerModele>[1], "libelle">>,
): ReturnType<typeof creerModele> {
  return creerModele(
    contexte,
    { libelle: "Checklist épreuve 9K19", ...saisie },
    clientApp(),
  );
}

beforeAll(async () => {
  const owner = clientOwner();
  await owner.$executeRawUnsafe(
    `INSERT INTO "sous_type_materiel" ("id", "societe_id", "famille_id", "code", "libelle")
     VALUES ($1::uuid, $2::uuid, $3::uuid, 'E-9K19-A', 'Sous-type épreuve 9K19 A')
     ON CONFLICT ("id") DO NOTHING`,
    SOUS_TYPE_A,
    SOCIETE_A,
    FAMILLE_A,
  );
  await owner.$executeRawUnsafe(
    `INSERT INTO "sous_type_materiel" ("id", "societe_id", "famille_id", "code", "libelle")
     VALUES ($1::uuid, $2::uuid, $3::uuid, 'E-9K19-B', 'Sous-type épreuve 9K19 B')
     ON CONFLICT ("id") DO NOTHING`,
    SOUS_TYPE_B,
    SOCIETE_B,
    FAMILLE_B,
  );
});

afterAll(async () => {
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "sous_type_materiel" WHERE "id" IN ($1::uuid, $2::uuid)`,
    SOUS_TYPE_A,
    SOUS_TYPE_B,
  );
});

describe("creerModele — le sous-type est désormais écrit (9K19 ouvre enfin l'écran)", () => {
  it("un modèle rattaché au sous-type de SA société est créé, sous_type_id posé", async () => {
    const id = await creer(INTERNE_A, {
      code: "9K19-SOUS-TYPE",
      sousTypeId: SOUS_TYPE_A,
    });
    try {
      const lu = await clientOwner().checklistModele.findFirst({
        where: { id },
        select: { sous_type_id: true },
      });
      expect(lu?.sous_type_id).toBe(SOUS_TYPE_A);
    } finally {
      await supprimerModele(id);
    }
  });

  it("deux modèles de la MÊME société avec le MÊME code — refusé, code_pris", async () => {
    const id = await creer(INTERNE_A, { code: "9K19-DOUBLON" });
    try {
      await expect(
        creer(INTERNE_A, { code: "9K19-DOUBLON" }),
      ).rejects.toThrow();
    } finally {
      await supprimerModele(id);
    }
  });

  it("un sous-type d'une AUTRE société est refusé PAR LA CLÉ — jamais créé", async () => {
    await expect(
      creer(INTERNE_A, {
        code: "9K19-SOUS-TYPE-AILLEURS",
        sousTypeId: SOUS_TYPE_B,
      }),
    ).rejects.toThrow();
    const vu = await clientOwner().checklistModele.findFirst({
      where: { code: "9K19-SOUS-TYPE-AILLEURS" },
    });
    expect(vu).toBeNull();
  });
});

describe("basculerActiviteChecklist — société B ne touche rien de A", () => {
  it("société B ne peut pas désactiver un modèle de A — zéro ligne touchée", async () => {
    const id = await creer(INTERNE_A, { code: "9K19-ACTIVITE" });
    try {
      const resultat = await basculerActiviteChecklist(
        INTERNE_B,
        id,
        false,
        clientApp(),
      );
      expect(resultat).toEqual({ accepte: false, motif: "introuvable" });

      const toujoursActif = await clientOwner().checklistModele.findFirst({
        where: { id },
        select: { actif: true },
      });
      expect(toujoursActif?.actif).toBe(true);
    } finally {
      await supprimerModele(id);
    }
  });

  it("société A désactive bien SON modèle — le témoin de non-vacuité", async () => {
    const id = await creer(INTERNE_A, { code: "9K19-ACTIVITE-A" });
    try {
      const resultat = await basculerActiviteChecklist(
        INTERNE_A,
        id,
        false,
        clientApp(),
      );
      expect(resultat).toEqual({ accepte: true });
    } finally {
      await supprimerModele(id);
    }
  });
});

describe("publierVersion — numéro qui incrémente, choix roundtrip, cloisonnement", () => {
  it("publie v1 PUIS v2 — jamais une réécriture ; les CINQ types de réponse, choix compris", async () => {
    const id = await creer(INTERNE_A, { code: "9K19-VERSION" });
    try {
      await publierVersion(
        INTERNE_A,
        id,
        [
          {
            typeReponse: "conforme_non_conforme_sans_objet",
            section: "Sécurité",
            ordre: 1,
            libelle: "Premier point",
            obligatoire: true,
          },
          {
            typeReponse: "choix_dans_une_liste",
            section: "Levage",
            ordre: 2,
            libelle: "État du câble",
            choix: ["Bon", "Usé", "À remplacer"],
          },
          {
            typeReponse: "texte_libre",
            section: "Observations",
            ordre: 3,
            libelle: "Remarques",
          },
        ],
        clientApp(),
      );

      const versions1 = await listerLesVersionsChecklist(
        INTERNE_A,
        id,
        clientApp(),
      );
      expect(versions1).toHaveLength(1);
      expect(versions1[0]?.numero).toBe(1);
      const pointChoix = versions1[0]?.points.find(
        (p) => p.typeReponse === "choix_dans_une_liste",
      );
      expect(pointChoix?.choix).toEqual(["Bon", "Usé", "À remplacer"]);
      const pointTexte = versions1[0]?.points.find(
        (p) => p.typeReponse === "texte_libre",
      );
      expect(pointTexte?.choix).toEqual([]);

      await publierVersion(
        INTERNE_A,
        id,
        [
          {
            typeReponse: "case_faite",
            section: "Levage",
            ordre: 1,
            libelle: "Graissage",
          },
        ],
        clientApp(),
      );

      const versions2 = await listerLesVersionsChecklist(
        INTERNE_A,
        id,
        clientApp(),
      );
      expect(versions2.map((v) => v.numero)).toEqual([2, 1]);
      expect(versions2[1]?.points).toHaveLength(3);
    } finally {
      await supprimerModele(id);
    }
  });

  it("société B ne peut pas publier sur un modèle de A — refusé PAR LA CLÉ", async () => {
    const id = await creer(INTERNE_A, { code: "9K19-VERSION-B" });
    try {
      await expect(
        publierVersion(
          INTERNE_B,
          id,
          [{ typeReponse: "case_faite", section: "S", ordre: 1, libelle: "L" }],
          clientApp(),
        ),
      ).rejects.toThrow();

      const versions = await listerLesVersionsChecklist(
        INTERNE_A,
        id,
        clientApp(),
      );
      expect(versions).toHaveLength(0);
    } finally {
      await supprimerModele(id);
    }
  });
});

describe("listerLesModelesChecklist et obtenirModeleChecklist — cloisonnement de lecture", () => {
  it("société B ne LIT aucun modèle de A, ni par la liste ni par l'en-tête", async () => {
    const id = await creer(INTERNE_A, { code: "9K19-LECTURE" });
    try {
      const listeB = await listerLesModelesChecklist(INTERNE_B, clientApp());
      expect(listeB.map((m) => m.id)).not.toContain(id);

      const enTeteB = await obtenirModeleChecklist(INTERNE_B, id, clientApp());
      expect(enTeteB).toBeNull();

      const listeA = await listerLesModelesChecklist(INTERNE_A, clientApp());
      expect(listeA.map((m) => m.id)).toContain(id);
    } finally {
      await supprimerModele(id);
    }
  });

  it("le rattachement lisible porte le niveau SOUS_TYPE quand `sous_type_id` est posé", async () => {
    const id = await creer(INTERNE_A, {
      code: "9K19-RATTACHEMENT",
      sousTypeId: SOUS_TYPE_A,
    });
    try {
      const liste = await listerLesModelesChecklist(INTERNE_A, clientApp());
      const ligne = liste.find((m) => m.id === id);
      expect(ligne?.rattachement).toEqual({
        niveau: "sous_type",
        id: SOUS_TYPE_A,
      });
    } finally {
      await supprimerModele(id);
    }
  });
});
