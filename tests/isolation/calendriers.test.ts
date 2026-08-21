import { afterAll, describe, expect, it } from "vitest";

import {
  chargerCalendrierAgence,
  estJourOuvre,
  estOuvert,
  lireCleJour,
  versInstant,
} from "@/lib/calendar";

import { avecSociete, clientApp, fermerClients } from "./setup/db";
import {
  AGENCE_A,
  AGENCE_B,
  CALENDRIER_A,
  CALENDRIER_B,
  JOUR_FERIE_A,
  JOUR_FERIE_B,
  SOCIETE_A,
  SOCIETE_B,
  TERRITOIRE_A,
} from "./setup/fixtures";

/**
 * Cloisonnement des calendriers, et non-cloisonnement des fériés
 * (ticket L0-08 ; invariant I1 ; arbitrages D13 et D46).
 *
 * **Les quatre tables du ticket ne se rangent pas au même endroit, et c'est le
 * sujet.** `calendrier`, `calendrier_plage` et `calendrier_ferie` sont des
 * tables MÉTIER : elles portent `societe_id NOT NULL` et sont invisibles d'une
 * autre société. `jour_ferie` est un RÉFÉRENTIEL DE PLATEFORME (D46) : le
 * 14 juillet est un fait du territoire, il se lit depuis n'importe quelle
 * société, et son écriture est réservée aux rôles éditeur.
 *
 * Ces deux régimes se prouvent ensemble : un scénario qui n'éprouverait que le
 * cloisonnement passerait au vert sur une base vide, et un scénario qui
 * n'éprouverait que la lecture partagée ne dirait rien des fuites.
 *
 * Tous les scénarios passent par le rôle applicatif restreint (voir setup/db) :
 * les politiques mordent réellement.
 */
describe("calendriers d'agence — cloisonnés (I1)", () => {
  afterAll(fermerClients);

  it("sans contexte société, aucune des trois tables ne renvoie de ligne", async () => {
    const client = clientApp();
    expect(await client.calendrier.findMany()).toHaveLength(0);
    expect(await client.calendrierPlage.findMany()).toHaveLength(0);
    expect(await client.calendrierFerie.findMany()).toHaveLength(0);
  });

  it("la société A ne lit que son propre calendrier", async () => {
    const calendriers = await avecSociete(SOCIETE_A, (tx) =>
      tx.calendrier.findMany({ select: { id: true, societe_id: true } }),
    );
    expect(calendriers).toHaveLength(1);
    expect(calendriers[0]?.id).toBe(CALENDRIER_A);
  });

  it("la société A ne voit pas le calendrier de la société B", async () => {
    const trouve = await avecSociete(SOCIETE_A, (tx) =>
      tx.calendrier.findUnique({ where: { id: CALENDRIER_B } }),
    );
    expect(trouve).toBeNull();
  });

  it("la société A ne voit ni les plages ni les surcharges de fériés de B", async () => {
    const vues = await avecSociete(SOCIETE_A, async (tx) => ({
      plages: await tx.calendrierPlage.findMany({
        select: { societe_id: true },
      }),
      feries: await tx.calendrierFerie.findMany({
        select: { societe_id: true },
      }),
    }));

    expect(vues.plages.map((plage) => plage.societe_id)).toEqual([SOCIETE_A]);
    expect(vues.feries.map((ferie) => ferie.societe_id)).toEqual([SOCIETE_A]);
  });

  it("la société A ne peut pas créer un calendrier pour la société B (WITH CHECK)", async () => {
    // `$1::uuid` : les identifiants sont typés `uuid` en base, et un paramètre
    // lié part en `text`. Sans le cast, l'échec viendrait d'une erreur de type
    // et non de la politique — le scénario serait vert pour rien.
    await expect(
      avecSociete(SOCIETE_A, (tx) =>
        tx.$executeRawUnsafe(
          `INSERT INTO "calendrier"
             ("id", "societe_id", "code", "libelle", "territoire")
           VALUES ('aaaaaaaa-0000-7000-8000-0000000000cf', $1::uuid,
                   'PIRATE', 'Pirate', 'ISO-TERRITOIRE-B')`,
          SOCIETE_B,
        ),
      ),
    ).rejects.toThrow(/row-level security|violates/i);
  });

  it("la société A ne peut pas modifier le calendrier de la société B", async () => {
    const lignesAffectees = await avecSociete(SOCIETE_A, (tx) =>
      tx.$executeRawUnsafe(
        `UPDATE "calendrier" SET "libelle" = 'détourné' WHERE "id" = $1::uuid`,
        CALENDRIER_B,
      ),
    );
    // La politique ne lève pas : elle rend la ligne invisible, donc l'UPDATE
    // n'en touche aucune. C'est le comportement attendu de RLS en lecture.
    expect(lignesAffectees).toBe(0);
  });

  it("la société A ne peut pas marquer travaillé un férié du calendrier de B", async () => {
    // La surcharge « travaillé » est une décision d'agence (D13). Qu'une
    // société puisse la poser chez une autre reviendrait à ouvrir ses portes.
    await expect(
      avecSociete(SOCIETE_A, (tx) =>
        tx.$executeRawUnsafe(
          `INSERT INTO "calendrier_ferie"
             ("id", "societe_id", "calendrier_id", "jour_ferie_id", "travaille")
           VALUES ('aaaaaaaa-0000-7000-8000-0000000000cd', $1::uuid, $2::uuid,
                   $3::uuid, true)`,
          SOCIETE_B,
          CALENDRIER_B,
          JOUR_FERIE_B,
        ),
      ),
    ).rejects.toThrow(/row-level security|violates/i);
  });
});

describe("jours fériés — référentiel de plateforme (D46)", () => {
  afterAll(fermerClients);

  it("`jour_ferie` reste lisible SANS contexte société", async () => {
    // Contrôle positif : sans lui, une base vide produirait les mêmes zéros
    // qu'un cloisonnement parfait, et les scénarios ci-dessus ne prouveraient
    // rien.
    const feries = await clientApp().jourFerie.findMany({
      select: { id: true },
    });
    const ids = feries.map((ferie) => ferie.id);

    expect(ids).toContain(JOUR_FERIE_A);
    expect(ids).toContain(JOUR_FERIE_B);
  });

  it("les DEUX sociétés lisent les fériés des DEUX territoires", async () => {
    // C'est la raison d'être de D46 : le férié est un fait du territoire, pas
    // une donnée de société. Deux sociétés d'un même territoire n'ont aucune
    // raison d'en tenir deux listes divergentes.
    for (const societe of [SOCIETE_A, SOCIETE_B]) {
      const ids = await avecSociete(societe, async (tx) =>
        (await tx.jourFerie.findMany({ select: { id: true } })).map(
          (ferie) => ferie.id,
        ),
      );
      expect(ids, societe).toContain(JOUR_FERIE_A);
      expect(ids, societe).toContain(JOUR_FERIE_B);
    }
  });

  it("un rôle NON éditeur ne peut pas écrire dans le référentiel", async () => {
    // Même régime que `devise` et `parite` (L0-06) : la lecture est ouverte,
    // l'écriture appartient aux seuls rôles éditeur (I1).
    await expect(
      avecSociete(SOCIETE_A, (tx) =>
        tx.$executeRawUnsafe(
          `INSERT INTO "jour_ferie" ("id", "territoire", "date", "libelle")
           VALUES ('00000000-0000-7000-8000-0000000000fc', 'ISO-TERRITOIRE-A',
                   DATE '2026-06-17', 'Férié inventé')`,
        ),
      ),
    ).rejects.toThrow(/row-level security|violates/i);
  });
});

describe("chargement du calendrier d'une agence (D5, D13)", () => {
  afterAll(fermerClients);

  /** Une fenêtre qui couvre le férié fictif du 15 juin 2026, un lundi. */
  const FENETRE = {
    du: lireCleJour("2026-06-01"),
    au: lireCleJour("2026-06-30"),
  };

  it("assemble le fuseau de l'agence, ses plages et les fériés de son territoire", async () => {
    const calendrier = await avecSociete(SOCIETE_A, (tx) =>
      chargerCalendrierAgence(tx, {
        societeId: SOCIETE_A,
        agenceId: AGENCE_A,
        fenetre: FENETRE,
      }),
    );

    expect(calendrier).not.toBeNull();
    // L'agence ne surcharge pas son fuseau : elle hérite de sa société (D5).
    expect(calendrier?.fuseau).toBe("Pacific/Noumea");
    expect(calendrier?.territoire).toBe(TERRITOIRE_A);
    expect(calendrier?.plages).toEqual([
      { jour_semaine: 1, debut_minutes: 480, fin_minutes: 720 },
    ]);
    expect(calendrier?.feries).toEqual([
      { date: "2026-06-15", libelle: "Férié fictif A", travaille: true },
    ]);
  });

  it("le férié TRAVAILLÉ reste un jour ouvré (D13, RG-PLA-02)", async () => {
    const calendrier = await avecSociete(SOCIETE_A, (tx) =>
      chargerCalendrierAgence(tx, {
        societeId: SOCIETE_A,
        agenceId: AGENCE_A,
        fenetre: FENETRE,
      }),
    );
    if (calendrier === null) {
      throw new Error(
        "Calendrier introuvable : le scénario ne peut pas jouer.",
      );
    }

    // Le 15 juin 2026 est un lundi, et le calendrier ouvre le lundi de 8 h à
    // midi. La surcharge dit que l'agence travaille ce férié.
    const lundiFerie = lireCleJour("2026-06-15");
    expect(estJourOuvre(calendrier, lundiFerie)).toBe(true);
    expect(
      estOuvert(
        calendrier,
        versInstant(
          { ...lundiFerie, heures: 9, minutes: 0, secondes: 0 },
          calendrier.fuseau,
        ),
      ),
    ).toBe(true);
  });

  it("une agence d'une AUTRE société est introuvable, filtre applicatif compris", async () => {
    // Deux barrières se superposent : le `where` porte `societe_id` (CLAUDE.md
    // §5.6) et la politique RLS masque la ligne. Le scénario ne dit pas
    // laquelle a joué — il dit que le résultat est `null`, et c'est l'objet.
    const calendrier = await avecSociete(SOCIETE_A, (tx) =>
      chargerCalendrierAgence(tx, {
        societeId: SOCIETE_A,
        agenceId: AGENCE_B,
        fenetre: FENETRE,
      }),
    );
    expect(calendrier).toBeNull();
  });

  it("la société B charge son propre calendrier, et lui seul", async () => {
    const calendrier = await avecSociete(SOCIETE_B, (tx) =>
      chargerCalendrierAgence(tx, {
        societeId: SOCIETE_B,
        agenceId: AGENCE_B,
        fenetre: FENETRE,
      }),
    );

    expect(calendrier?.code).toBe("ISO-CAL-B");
    expect(calendrier?.fuseau).toBe("Europe/Paris");
    // Le férié du territoire B n'est pas surchargé : il reste chômé.
    expect(calendrier?.feries).toEqual([
      { date: "2026-06-16", libelle: "Férié fictif B", travaille: false },
    ]);
  });
});
