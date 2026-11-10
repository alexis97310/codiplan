import { afterAll, describe, expect, it } from "vitest";

import { type ContexteSession } from "@/lib/auth/contexte";
import { Role } from "@/lib/auth/roles";
import {
  creerModele,
  creerModeleDepuisGabarit,
  dupliquerModele,
  listerLesVersionsChecklist,
  publierVersion,
} from "@/lib/checklists/depot";
import { GABARITS_DE_DEPART } from "@/lib/checklists/gabarits-de-depart";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import { SOCIETE_A, SOCIETE_B, UTILISATEUR_INTERNE_A } from "./setup/fixtures";

/**
 * 9K20-CHECKLIST-DUPLIQUER-DEPART — `dupliquerModele` et
 * `creerModeleDepuisGabarit`, sur le chemin de production réel.
 *
 * Toute scène pose ses PROPRES lignes (préfixe `9K20`) et les efface en
 * `finally` — aucune écriture sur le harnais partagé.
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
const INTERNE_B = session(UTILISATEUR_INTERNE_A, SOCIETE_B, Role.admin_societe);

async function supprimerModele(id: string): Promise<void> {
  await clientOwner().checklistVersion.deleteMany({
    where: { checklist_modele_id: id },
  });
  await clientOwner().checklistModele.deleteMany({ where: { id } });
}

function creer(
  contexte: ContexteSession,
  saisie: Omit<Parameters<typeof creerModele>[1], "libelle"> &
    Partial<Pick<Parameters<typeof creerModele>[1], "libelle">>,
): ReturnType<typeof creerModele> {
  return creerModele(
    contexte,
    { libelle: "Checklist épreuve 9K20", ...saisie },
    clientApp(),
  );
}

const GABARIT = GABARITS_DE_DEPART[0];
if (GABARIT === undefined) {
  throw new Error(
    "Aucun gabarit de départ déclaré : l'épreuve ne peut pas tourner.",
  );
}

describe("dupliquerModele", () => {
  it("recopie les points de la DERNIÈRE version publiée comme version 1 du nouveau modèle", async () => {
    const sourceId = await creer(INTERNE_A, { code: "9K20-SOURCE" });
    let nouveauId: string | null = null;
    try {
      await publierVersion(
        INTERNE_A,
        sourceId,
        [
          {
            typeReponse: "conforme_non_conforme_sans_objet",
            section: "Sécurité",
            ordre: 1,
            libelle: "Premier point",
            obligatoire: true,
          },
        ],
        clientApp(),
      );
      // Une SECONDE version — la duplication doit recopier la DERNIÈRE,
      // jamais la première.
      await publierVersion(
        INTERNE_A,
        sourceId,
        [
          {
            typeReponse: "choix_dans_une_liste",
            section: "Levage",
            ordre: 1,
            libelle: "État du câble",
            choix: ["Bon", "Usé"],
          },
          {
            typeReponse: "valeur_mesuree",
            section: "Levage",
            ordre: 2,
            libelle: "Mesure",
            unite: "mm",
          },
        ],
        clientApp(),
      );

      const resultat = await dupliquerModele(
        INTERNE_A,
        sourceId,
        { code: "9K20-COPIE", libelle: "Copie 9K20" },
        clientApp(),
      );
      expect(resultat.accepte).toBe(true);
      if (!resultat.accepte) return;
      nouveauId = resultat.checklistModeleId;

      const versions = await listerLesVersionsChecklist(
        INTERNE_A,
        nouveauId,
        clientApp(),
      );
      expect(versions).toHaveLength(1);
      expect(versions[0]?.numero).toBe(1);
      expect(versions[0]?.points).toHaveLength(2);
      const pointChoix = versions[0]?.points.find(
        (p) => p.typeReponse === "choix_dans_une_liste",
      );
      expect(pointChoix?.choix).toEqual(["Bon", "Usé"]);
      const pointMesure = versions[0]?.points.find(
        (p) => p.typeReponse === "valeur_mesuree",
      );
      expect(pointMesure?.unite).toBe("mm");
      expect(pointMesure?.toleranceMin).toBeNull();
      expect(pointMesure?.toleranceMax).toBeNull();
    } finally {
      if (nouveauId !== null) await supprimerModele(nouveauId);
      await supprimerModele(sourceId);
    }
  });

  it("refuse — aucune_version_source — rien n'est créé si la source n'a pas encore de version", async () => {
    const sourceId = await creer(INTERNE_A, { code: "9K20-SANS-VERSION" });
    try {
      const resultat = await dupliquerModele(
        INTERNE_A,
        sourceId,
        { code: "9K20-COPIE-RATEE", libelle: "Copie ratée" },
        clientApp(),
      );
      expect(resultat).toEqual({
        accepte: false,
        motif: "aucune_version_source",
      });
      const vu = await clientOwner().checklistModele.findFirst({
        where: { code: "9K20-COPIE-RATEE" },
      });
      expect(vu).toBeNull();
    } finally {
      await supprimerModele(sourceId);
    }
  });

  it("refuse — introuvable — société B ne peut pas dupliquer un modèle de A", async () => {
    const sourceId = await creer(INTERNE_A, { code: "9K20-SOURCE-AILLEURS" });
    try {
      await publierVersion(
        INTERNE_A,
        sourceId,
        [{ typeReponse: "case_faite", section: "S", ordre: 1, libelle: "L" }],
        clientApp(),
      );
      const resultat = await dupliquerModele(
        INTERNE_B,
        sourceId,
        { code: "9K20-COPIE-AILLEURS", libelle: "Copie ailleurs" },
        clientApp(),
      );
      expect(resultat).toEqual({ accepte: false, motif: "introuvable" });
      const vu = await clientOwner().checklistModele.findFirst({
        where: { code: "9K20-COPIE-AILLEURS" },
      });
      expect(vu).toBeNull();
    } finally {
      await supprimerModele(sourceId);
    }
  });
});

describe("creerModeleDepuisGabarit", () => {
  it("crée le modèle et publie v1 avec les points EXACTS du gabarit", async () => {
    const resultat = await creerModeleDepuisGabarit(
      INTERNE_A,
      GABARIT.id,
      { code: "9K20-GABARIT", libelle: "Depuis gabarit 9K20" },
      clientApp(),
    );
    expect(resultat.accepte).toBe(true);
    if (!resultat.accepte) return;
    try {
      const versions = await listerLesVersionsChecklist(
        INTERNE_A,
        resultat.checklistModeleId,
        clientApp(),
      );
      expect(versions).toHaveLength(1);
      expect(versions[0]?.numero).toBe(1);
      expect(versions[0]?.points).toHaveLength(GABARIT.points.length);
      expect(versions[0]?.points.map((p) => p.libelle)).toEqual(
        GABARIT.points.map((p) => p.libelle),
      );

      const modele = await clientOwner().checklistModele.findFirst({
        where: { id: resultat.checklistModeleId },
        select: { sous_type_id: true, famille_id: true, modele_id: true },
      });
      expect(modele?.sous_type_id).toBeNull();
      expect(modele?.famille_id).toBeNull();
      expect(modele?.modele_id).toBeNull();
    } finally {
      await supprimerModele(resultat.checklistModeleId);
    }
  });

  it("refuse — gabarit_inconnu — rien n'est créé pour un identifiant inexistant", async () => {
    const resultat = await creerModeleDepuisGabarit(
      INTERNE_A,
      "gabarit-qui-n-existe-pas",
      { code: "9K20-GABARIT-INCONNU", libelle: "Inconnu" },
      clientApp(),
    );
    expect(resultat).toEqual({ accepte: false, motif: "gabarit_inconnu" });
    const vu = await clientOwner().checklistModele.findFirst({
      where: { code: "9K20-GABARIT-INCONNU" },
    });
    expect(vu).toBeNull();
  });
});
