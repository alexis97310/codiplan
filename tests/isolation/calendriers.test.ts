import { afterAll, describe, expect, it } from "vitest";

import {
  chargerCalendrierAgence,
  cleJour,
  estJourOuvre,
  estOuvert,
  jourSuivant,
  lireCleJour,
  versInstant,
  type Calendrier,
} from "@/lib/calendar";

import { sousSociete, clientApp, fermerClients } from "./setup/db";
import {
  AGENCE_A,
  AGENCE_B,
  ANNEE_FIXTURE,
  CALENDRIER_A,
  CALENDRIER_B,
  FERIE_TRAVAILLE_A,
  FUSEAU_AGENCE_B,
  FUSEAU_SOCIETE_A,
  PONT_A,
  SOCIETE_A,
  SOCIETE_B,
  TERRITOIRE_A,
  TERRITOIRE_B,
  feriesFixture,
} from "./setup/fixtures";

/**
 * Cloisonnement des calendriers, non-cloisonnement des fériés, et ordre de
 * lecture (ticket L0-08 ; invariant I1 ; arbitrages D13 et D46).
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

/** La fenêtre couvre l'année en cours du jeu fixture, fériés et pont compris. */
const FENETRE = {
  du: lireCleJour(`${ANNEE_FIXTURE}-01-01`),
  au: lireCleJour(`${ANNEE_FIXTURE}-12-31`),
};

function chargerA(): Promise<Calendrier | null> {
  return sousSociete(SOCIETE_A, (tx) =>
    chargerCalendrierAgence(tx, {
      societeId: SOCIETE_A,
      agenceId: AGENCE_A,
      fenetre: FENETRE,
    }),
  );
}

describe("calendriers d'agence — cloisonnés (I1)", () => {
  afterAll(fermerClients);

  it("sans contexte société, aucune des trois tables ne renvoie de ligne", async () => {
    const client = clientApp();
    expect(await client.calendrier.findMany()).toHaveLength(0);
    expect(await client.calendrierPlage.findMany()).toHaveLength(0);
    expect(await client.calendrierFerie.findMany()).toHaveLength(0);
  });

  it("la société A ne lit que son propre calendrier", async () => {
    const calendriers = await sousSociete(SOCIETE_A, (tx) =>
      tx.calendrier.findMany({ select: { id: true, societe_id: true } }),
    );
    expect(calendriers).toHaveLength(1);
    expect(calendriers[0]?.id).toBe(CALENDRIER_A);
  });

  it("la société A ne voit pas le calendrier de la société B", async () => {
    const trouve = await sousSociete(SOCIETE_A, (tx) =>
      tx.calendrier.findUnique({ where: { id: CALENDRIER_B } }),
    );
    expect(trouve).toBeNull();
  });

  it("la société A ne voit ni les plages ni les écarts de B", async () => {
    const vues = await sousSociete(SOCIETE_A, async (tx) => ({
      plages: await tx.calendrierPlage.findMany({
        select: { societe_id: true },
      }),
      ecarts: await tx.calendrierFerie.findMany({
        select: { societe_id: true },
      }),
    }));

    expect(vues.plages.map((plage) => plage.societe_id)).toEqual([SOCIETE_A]);
    expect(new Set(vues.ecarts.map((ecart) => ecart.societe_id))).toEqual(
      new Set([SOCIETE_A]),
    );
  });

  it("la société A ne peut pas créer un calendrier pour la société B (WITH CHECK)", async () => {
    // `$1::uuid` : les identifiants sont typés `uuid` en base, et un paramètre
    // lié part en `text`. Sans le cast, l'échec viendrait d'une erreur de type
    // et non de la politique — le scénario serait vert pour rien.
    await expect(
      sousSociete(SOCIETE_A, (tx) =>
        tx.$executeRawUnsafe(
          `INSERT INTO "calendrier" ("id", "societe_id", "code", "libelle")
           VALUES ('aaaaaaaa-0000-7000-8000-0000000000cf', $1::uuid,
                   'PIRATE', 'Pirate')`,
          SOCIETE_B,
        ),
      ),
    ).rejects.toThrow(/row-level security|violates/i);
  });

  it("la société A ne peut pas modifier le calendrier de la société B", async () => {
    const lignesAffectees = await sousSociete(SOCIETE_A, (tx) =>
      tx.$executeRawUnsafe(
        `UPDATE "calendrier" SET "libelle" = 'détourné' WHERE "id" = $1::uuid`,
        CALENDRIER_B,
      ),
    );
    // La politique ne lève pas : elle rend la ligne invisible, donc l'UPDATE
    // n'en touche aucune. C'est le comportement attendu de RLS en lecture.
    expect(lignesAffectees).toBe(0);
  });

  it("la société A ne peut pas poser un écart local chez l'agence de B", async () => {
    // L'écart local est une décision d'agence (D46, complément 2). Qu'une
    // société puisse la poser chez une autre reviendrait à ouvrir ses portes.
    await expect(
      sousSociete(SOCIETE_A, (tx) =>
        tx.$executeRawUnsafe(
          `INSERT INTO "calendrier_ferie"
             ("id", "societe_id", "agence_id", "territoire", "date",
              "travaille")
           VALUES ('aaaaaaaa-0000-7000-8000-0000000000cd', $1::uuid, $2::uuid,
                   $3, DATE '${ANNEE_FIXTURE}-03-02', false)`,
          SOCIETE_B,
          AGENCE_B,
          TERRITOIRE_B,
        ),
      ),
    ).rejects.toThrow(/row-level security|violates/i);
  });
});

describe("jours fériés — référentiel de plateforme (D46)", () => {
  afterAll(fermerClients);

  const PREMIER_A = feriesFixture(TERRITOIRE_A)[0]?.date ?? "";
  const PREMIER_B = feriesFixture(TERRITOIRE_B)[0]?.date ?? "";

  it("`jour_ferie` reste lisible SANS contexte société", async () => {
    // Contrôle positif : sans lui, une base vide produirait les mêmes zéros
    // qu'un cloisonnement parfait, et les scénarios ci-dessus ne prouveraient
    // rien.
    const territoires = await clientApp().jourFerie.findMany({
      select: { territoire: true },
      distinct: ["territoire"],
    });

    expect(territoires.map((ligne) => ligne.territoire).sort()).toEqual(
      [TERRITOIRE_A, TERRITOIRE_B].sort(),
    );
  });

  it("les DEUX sociétés lisent les fériés des DEUX territoires", async () => {
    // C'est la raison d'être de D46 : le férié est un fait du territoire, pas
    // une donnée de société. Deux sociétés d'un même territoire n'ont aucune
    // raison d'en tenir deux listes divergentes.
    for (const societe of [SOCIETE_A, SOCIETE_B]) {
      const dates = await sousSociete(societe, async (tx) =>
        (await tx.jourFerie.findMany({ select: { date: true } })).map((ferie) =>
          ferie.date.toISOString().slice(0, 10),
        ),
      );
      expect(dates, societe).toContain(PREMIER_A);
      expect(dates, societe).toContain(PREMIER_B);
    }
  });

  it("un rôle NON éditeur ne peut pas écrire dans le référentiel", async () => {
    // Même régime que `devise` et `parite` (L0-06) : la lecture est ouverte,
    // l'écriture appartient aux seuls rôles éditeur (I1). C'est aussi ce qui
    // donne son sens à l'ordre de lecture — une société qui pourrait écrire
    // dans `jour_ferie` décréterait un férié pour tout son territoire.
    await expect(
      sousSociete(SOCIETE_A, (tx) =>
        tx.$executeRawUnsafe(
          `INSERT INTO "jour_ferie" ("id", "territoire", "date", "libelle")
           VALUES ('00000000-0000-7000-8000-0000000000fc', $1,
                   DATE '${ANNEE_FIXTURE}-03-03', 'Férié inventé')`,
          TERRITOIRE_A,
        ),
      ),
    ).rejects.toThrow(/row-level security|violates/i);
  });

  it("la base refuse un territoire qui n'est pas un code ISO alpha-2", async () => {
    // Le contrôle de forme vit en base autant que dans Zod : un import mal
    // formé n'a pas à pouvoir écrire « Nouvelle-Calédonie » là où `jour_ferie`
    // attend `NC` (D46, complément 1).
    // Sous contexte société : sans lui, la politique masquerait les lignes et
    // l'UPDATE n'en toucherait aucune — le scénario serait vert sans avoir
    // atteint la contrainte.
    await expect(
      sousSociete(SOCIETE_A, (tx) =>
        tx.$executeRawUnsafe(
          `UPDATE "agence" SET "territoire" = 'NOUVELLE_CALEDONIE'
            WHERE "id" = $1::uuid`,
          AGENCE_A,
        ),
      ),
    ).rejects.toThrow(/territoire_iso_alpha2|violates/i);
  });
});

describe("chargement du calendrier d'une agence (D5, D13, D46)", () => {
  afterAll(fermerClients);

  it("assemble le fuseau, le territoire et les plages de l'agence", async () => {
    const calendrier = await chargerA();

    expect(calendrier).not.toBeNull();
    // L'agence A ne surcharge pas son fuseau : elle hérite de sa société (D5).
    expect(calendrier?.fuseau).toBe(FUSEAU_SOCIETE_A);
    expect(calendrier?.territoire).toBe(TERRITOIRE_A);
    expect(calendrier?.plages).toEqual([
      { jour_semaine: 1, debut_minutes: 480, fin_minutes: 720 },
    ]);
  });

  /**
   * Le scénario adversaire de D46, complément 1. Les deux agences partagent le
   * MÊME fuseau — B surcharge le sien pour valoir celui de A — et relèvent de
   * territoires DIFFÉRENTS. Tout code qui déduirait l'un de l'autre tombe ici.
   */
  it("même fuseau, territoires différents : le territoire n'est pas le fuseau", async () => {
    const a = await chargerA();
    const b = await sousSociete(SOCIETE_B, (tx) =>
      chargerCalendrierAgence(tx, {
        societeId: SOCIETE_B,
        agenceId: AGENCE_B,
        fenetre: FENETRE,
      }),
    );

    expect(a?.fuseau).toBe(FUSEAU_AGENCE_B);
    expect(b?.fuseau).toBe(FUSEAU_AGENCE_B);
    expect(a?.territoire).not.toBe(b?.territoire);

    // Et les jours particuliers qui en découlent ne sont pas les mêmes.
    const datesA = a?.jours_particuliers.map((jour) => jour.date) ?? [];
    const datesB = b?.jours_particuliers.map((jour) => jour.date) ?? [];
    expect(datesA.length).toBeGreaterThan(0);
    expect(datesB.length).toBeGreaterThan(0);
    expect(a?.jours_particuliers.map((jour) => jour.libelle)).not.toEqual(
      b?.jours_particuliers.map((jour) => jour.libelle),
    );
  });

  it("le fait public d'abord, l'écart local ensuite (D46, complément 2)", async () => {
    const calendrier = await chargerA();
    if (calendrier === null) {
      throw new Error(
        "Calendrier introuvable : le scénario ne peut pas jouer.",
      );
    }

    const travaille = calendrier.jours_particuliers.find(
      (jour) => jour.date === FERIE_TRAVAILLE_A.date,
    );
    const pont = calendrier.jours_particuliers.find(
      (jour) => jour.date === PONT_A,
    );

    // Le férié travaillé garde le LIBELLÉ du fait public — l'écart tranche,
    // il ne renomme pas — et son origine dit que l'agence a eu le dernier mot.
    expect(travaille).toEqual({
      date: FERIE_TRAVAILLE_A.date,
      libelle: FERIE_TRAVAILLE_A.libelle,
      ouvre: true,
      origine: "agence",
    });

    // Le pont n'a aucun fait public en face : c'est l'agence qui le nomme.
    expect(pont).toEqual({
      date: PONT_A,
      libelle: "Pont de démonstration",
      ouvre: false,
      origine: "agence",
    });
  });

  it("le férié TRAVAILLÉ reste un jour ouvré (RG-PLA-02)", async () => {
    const calendrier = await chargerA();
    if (calendrier === null) {
      throw new Error(
        "Calendrier introuvable : le scénario ne peut pas jouer.",
      );
    }

    const jour = lireCleJour(FERIE_TRAVAILLE_A.date);
    expect(estJourOuvre(calendrier, jour)).toBe(true);
    expect(
      estOuvert(
        calendrier,
        versInstant(
          { ...jour, heures: 9, minutes: 0, secondes: 0 },
          calendrier.fuseau,
        ),
      ),
    ).toBe(true);
  });

  it("le PONT retire une journée pourtant ouverte selon les plages", async () => {
    const calendrier = await chargerA();
    if (calendrier === null) {
      throw new Error(
        "Calendrier introuvable : le scénario ne peut pas jouer.",
      );
    }

    // Le pont tombe un lundi, seul jour où ce calendrier ouvre : sans l'écart
    // local, la journée serait ouvrée. C'est ce qui rend le scénario probant.
    expect(estJourOuvre(calendrier, lireCleJour(PONT_A))).toBe(false);
  });

  it("une agence d'une AUTRE société est introuvable, filtre applicatif compris", async () => {
    // Deux barrières se superposent : le `where` porte `societe_id` (CLAUDE.md
    // §5.6) et la politique RLS masque la ligne. Le scénario ne dit pas
    // laquelle a joué — il dit que le résultat est `null`, et c'est l'objet.
    const calendrier = await sousSociete(SOCIETE_A, (tx) =>
      chargerCalendrierAgence(tx, {
        societeId: SOCIETE_A,
        agenceId: AGENCE_B,
        fenetre: FENETRE,
      }),
    );
    expect(calendrier).toBeNull();
  });
});

describe("un seul écart par agence et par jour (D46, complément 2)", () => {
  afterAll(fermerClients);

  /**
   * **Le trou que cette contrainte ferme.** Rien, dans les clés étrangères,
   * n'empêcherait deux lignes pour la même agence et la même date — l'une
   * disant « on travaille », l'autre « on chôme ». `appliquerEcarts` en
   * retiendrait une **en silence**, celle que le tri aurait mise en dernier, et
   * l'agence découvrirait son planning à l'usage.
   *
   * L'unicité de `(agence_id, date)` l'interdit en base. Elle est éprouvée ici
   * sous les deux angles, parce que c'est le même trou vu des deux côtés : deux
   * écarts adossés au même férié, et un pont autonome posé sur un jour déjà
   * surchargé.
   */

  /** L'identifiant du férié que l'agence A travaille déjà (fixture). */
  async function idFerieTravaille(): Promise<string> {
    const ferie = await clientApp().jourFerie.findUniqueOrThrow({
      where: {
        territoire_date: {
          territoire: TERRITOIRE_A,
          date: new Date(`${FERIE_TRAVAILLE_A.date}T00:00:00.000Z`),
        },
      },
      select: { id: true },
    });
    return ferie.id;
  }

  it("un SECOND écart sur la même date est refusé", async () => {
    const jourFerieId = await idFerieTravaille();

    await expect(
      sousSociete(SOCIETE_A, (tx) =>
        tx.$executeRawUnsafe(
          `INSERT INTO "calendrier_ferie"
             ("id", "societe_id", "agence_id", "territoire", "date",
              "jour_ferie_id", "travaille", "motif")
           VALUES ('aaaaaaaa-0000-7000-8000-0000000000e5', $1::uuid, $2::uuid,
                   $4, DATE '${FERIE_TRAVAILLE_A.date}', $3::uuid, false,
                   'décision contraire')`,
          SOCIETE_A,
          AGENCE_A,
          jourFerieId,
          TERRITOIRE_A,
        ),
      ),
    ).rejects.toThrow(/agence_id_date|duplicate key|unique/i);
  });

  it("un PONT autonome posé sur un jour déjà surchargé est refusé", async () => {
    // Le même trou vu de l'autre côté : l'écart existant est adossé à un férié,
    // celui-ci n'est adossé à rien. Sans l'unicité, les deux coexisteraient et
    // se contrediraient.
    await expect(
      sousSociete(SOCIETE_A, (tx) =>
        tx.$executeRawUnsafe(
          `INSERT INTO "calendrier_ferie"
             ("id", "societe_id", "agence_id", "territoire", "date",
              "jour_ferie_id", "travaille", "motif")
           VALUES ('aaaaaaaa-0000-7000-8000-0000000000e6', $1::uuid, $2::uuid,
                   $3, DATE '${FERIE_TRAVAILLE_A.date}', NULL, false,
                   'pont autonome le même jour')`,
          SOCIETE_A,
          AGENCE_A,
          TERRITOIRE_A,
        ),
      ),
    ).rejects.toThrow(/agence_id_date|duplicate key|unique/i);
  });

  it("deux agences peuvent en revanche diverger le même jour", async () => {
    // L'unicité porte sur (agence, date), pas sur la date : c'est précisément
    // ce qui permet à Dolbeau de poser un pont que Ducos ne pose pas, alors
    // qu'elles partagent un calendrier d'ouverture.
    const ecarts = await sousSociete(SOCIETE_A, (tx) =>
      tx.calendrierFerie.findMany({
        where: { date: new Date(`${FERIE_TRAVAILLE_A.date}T00:00:00.000Z`) },
        select: { agence_id: true },
      }),
    );
    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]?.agence_id).toBe(AGENCE_A);
  });

  it("un écart dont la date diverge du férié qu'il surcharge est refusé", async () => {
    // La clé étrangère COMPOSITE vers `jour_ferie(id, date)` : un écart ne peut
    // pas prétendre surcharger un férié en portant une autre date que la
    // sienne. Sans elle, la colonne `date` serait une divergence en attente.
    const jourFerieId = await idFerieTravaille();
    const lendemain = cleJour(jourSuivant(lireCleJour(FERIE_TRAVAILLE_A.date)));

    await expect(
      sousSociete(SOCIETE_A, (tx) =>
        tx.$executeRawUnsafe(
          `INSERT INTO "calendrier_ferie"
             ("id", "societe_id", "agence_id", "territoire", "date",
              "jour_ferie_id", "travaille", "motif")
           VALUES ('aaaaaaaa-0000-7000-8000-0000000000e7', $1::uuid, $2::uuid,
                   $4, DATE '${lendemain}', $3::uuid, true, 'date divergente')`,
          SOCIETE_A,
          AGENCE_A,
          jourFerieId,
          TERRITOIRE_A,
        ),
      ),
    ).rejects.toThrow(/jour_ferie_id_date|foreign key|violates/i);
  });
});
