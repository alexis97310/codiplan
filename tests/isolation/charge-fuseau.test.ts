import { afterAll, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { occupationsDuPlanning } from "@/lib/interventions/occupation";

import { clientApp, fermerClients } from "./setup/db";
import {
  AGENCE_A,
  CLIENT_A1,
  SITE_A1_S1,
  SOCIETE_A,
  UTILISATEUR_INTERNE_A,
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";

/**
 * LE DÉCALAGE DE ONZE HEURES — le dénominateur d'une journée (12/09/2026).
 *
 * ## Ce qui était mesuré, et ce qui l'était vraiment
 *
 * L'écran construisait ses bornes à **minuit UTC** — ce qui est JUSTE pour
 * l'appartenance au jour, `date_planifiee` étant un `@db.Date` que Prisma rend
 * à minuit UTC — puis passait **les mêmes bornes** comme des **instants** au
 * calcul des minutes ouvrables.
 *
 * *Sous `Pacific/Noumea` — UTC+11, sans heure d'été —, « lundi 00:00 UTC » vaut
 * « lundi 11 h à Nouméa ».* La fenêtre d'une journée courait donc de **lundi
 * 11 h à mardi 11 h** : elle **amputait la matinée** et **ajoutait celle du
 * lendemain**. C'est l'explication des « 04:30 ouvrables » qu'aucune plage
 * horaire ne justifiait.
 *
 * ## Les deux chiffres, sur la fixture réelle
 *
 * L'agence A ouvre le **lundi de 08:00 à 12:00**, soit **240 minutes**, et son
 * fuseau est `Pacific/Noumea` (posés par `tests/isolation/setup/global.ts`).
 *
 * | | |
 * |---|---|
 * | Avant — bornes UTC prises pour des instants | **60** minutes |
 * | Après — la fenêtre est en JOURS, convertie au fuseau du calendrier | **240** minutes |
 *
 * *Le 60 est mesuré, pas déduit : le lundi 08:00–12:00 à Nouméa est le dimanche
 * 21:00 – lundi 01:00 UTC, dont il ne reste qu'une heure dans « lundi 00:00 UTC
 * → mardi 00:00 UTC ».* Un quart du vrai, et rien ne le disait.
 *
 * ## Pourquoi ce fichier, et pas une assertion de plus ailleurs
 *
 * Le défaut ne vit dans aucun des deux modules : il vit dans le **TYPE** que
 * l'un passe à l'autre. Un jour civil n'est pas un instant, et il ne le devient
 * qu'une fois le fuseau connu. La réparation descend donc la conversion là où
 * le fuseau EST connu — le calendrier de chaque agence —, et ce fichier mesure
 * qu'elle a bien lieu, à travers la lecture cloisonnée et le vrai calendrier.
 */

afterAll(fermerClients);

const SESSION = {
  utilisateurId: UTILISATEUR_INTERNE_A,
  societeId: SOCIETE_A,
  role: Role.adv,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const TECHNICIEN = UTILISATEUR_PAR_ROLE[Role.technicien];

/** Lundi 14 septembre 2026 — le jour que l'agence A ouvre de 08:00 à 12:00. */
const LUNDI = { annee: 2026, mois: 9, jour: 14 };
const MARDI = { annee: 2026, mois: 9, jour: 15 };

/**
 * Une ligne minimale : ce module mesure le DÉNOMINATEUR, et il lui faut une
 * ligne pour avoir un groupe (technicien, agence) à mesurer. Sa durée n'entre
 * dans aucune des assertions ci-dessous.
 */
const LIGNE = {
  id: "00000000-0000-7000-8000-00000000f001",
  technicien_id: TECHNICIEN,
  agence_id: AGENCE_A,
  client_id: CLIENT_A1,
  site_id: SITE_A1_S1,
  statut: "planifiee" as const,
  duree_reelle_min: null,
  temps_reel_min: null,
  duree_estimee_min: 60,
  date_planifiee: new Date("2026-09-14T00:00:00.000Z"),
};

async function ouvrables(fenetre: {
  du: typeof LUNDI;
  au: typeof LUNDI;
}): Promise<number> {
  const lignes = await occupationsDuPlanning(
    SESSION,
    [LIGNE],
    fenetre,
    clientApp(),
  );
  const ligne = lignes.find((l) => l.technicienId === TECHNICIEN);
  if (ligne === undefined) throw new Error("aucune ligne pour le technicien");
  return ligne.occupation.minutesOuvrables;
}

describe("le dénominateur d'une journée est celui du fuseau de l'agence", () => {
  it("UNE JOURNÉE rend les 240 minutes de la plage, jamais les 60 d'une fenêtre décalée", async () => {
    expect(await ouvrables({ du: LUNDI, au: MARDI })).toBe(240);
  });

  it("LE TÉMOIN — la borne haute est EXCLUSIVE : deux jours ne doublent pas le lundi", async () => {
    // Mardi n'a aucune plage au calendrier de l'agence A (seul le lundi en
    // porte une). Une fenêtre de deux jours doit donc rendre les MÊMES 240
    // minutes. Sans ce cas, une conversion qui décalerait TOUT d'un jour
    // passerait le premier test en mesurant le mauvais lundi.
    expect(
      await ouvrables({ du: LUNDI, au: { annee: 2026, mois: 9, jour: 16 } }),
    ).toBe(240);
  });

  it("LE SENS QUI DOIT RENDRE ZÉRO POUR SA PROPRE RAISON — le mardi seul", async () => {
    // Une fonction qui rendrait « la plage du calendrier » sans regarder la
    // fenêtre passerait les deux cas ci-dessus. Le mardi seul n'ouvre pas :
    // zéro est ici la bonne réponse, et elle prouve que la fenêtre mord.
    expect(
      await ouvrables({ du: MARDI, au: { annee: 2026, mois: 9, jour: 16 } }),
    ).toBe(0);
  });
});
