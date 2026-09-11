import { afterAll, afterEach, describe, expect, it } from "vitest";

import { uuidv7 } from "@/lib/db/uuid";
import { forfaitApplicable } from "@/lib/tarification/forfaits";

import { clientOwner, fermerClients } from "./setup/db";
import { SOCIETE_A } from "./setup/fixtures";

/**
 * « SANS CONDITION » S'ÉCRIT `NULL` EN BASE, JAMAIS LE TABLEAU VIDE.
 *
 * ## Pourquoi ce fichier existe
 *
 * Trois documents affirmaient l'inverse — le §6 du `CLAUDE.md`, le commentaire
 * de `prisma/schema.prisma` et l'en-tête de `lib/tarification/forfaits.ts` :
 * *« une liste scalaire PostgreSQL n'étant pas nullable, l'absence de condition
 * y est le tableau VIDE »*. **C'est une limite de l'ORM prise pour une
 * propriété de la base.** La colonne SQL est nullable ; c'est Prisma qui ne
 * sait pas déclarer une liste scalaire nullable, et qui rend `[]` en lecture.
 *
 * *Le code n'en était pas faux* : `axeSatisfait` traite `[]` comme « aucune
 * condition », et c'est exactement ce que Prisma rend pour un `NULL`. Les deux
 * s'accordent **à la lecture**. Le piège est sur le chemin d'**écriture**, et
 * il est resté invisible parce que **rien n'écrit de forfait** — le catalogue
 * naît vide et se remplit à la main.
 *
 * ## Ce que ce fichier tient, et qu'un commentaire ne tenait pas
 *
 * *Une phrase dans un document ne refuse rien* (§9). Ces scénarios FIXENT le
 * comportement réel : le jour où quelqu'un desserrera la contrainte ou écrira
 * l'écran de saisie, l'un des deux rougira.
 */

afterAll(fermerClients);

const poses: string[] = [];

afterEach(async () => {
  for (const id of poses.splice(0)) {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "forfait" WHERE "id" = '${id}'`,
    );
  }
});

/**
 * Un forfait, avec la valeur donnée sur l'axe des ZONES — l'autre axe restant
 * `NULL`.
 *
 * *Un seul axe varie à la fois, et c'est ce qui rend l'assertion utilisable* :
 * en mettant les deux au vide, c'est la contrainte des TYPES qui refusait la
 * première, et le scénario aurait nommé le voisin (§9, 24/08).
 */
function poser(zones: "NULL" | "VIDE"): Promise<unknown> {
  const id = uuidv7();
  poses.push(id);
  const valeur = zones === "NULL" ? "NULL" : `'{}'`;
  return clientOwner().$executeRawUnsafe(
    `INSERT INTO "forfait" ("id","societe_id","code","libelle","type","rang",
       "montant_mineur","devise_code","zone_geo","type_intervention",
       "cumulable_temps","actif")
     VALUES ('${id}', '${SOCIETE_A}', 'SC-${id.slice(-6)}', 'Sans condition',
             'deplacement', ${900000 + poses.length}, 1000, 'XPF',
             ${valeur}, NULL, true, true)`,
  );
}

describe("la base n'admet que `NULL` pour « sans condition »", () => {
  it("`NULL` est ACCEPTÉ — c'est la forme du cas majoritaire", async () => {
    await expect(poser("NULL")).resolves.not.toThrow();
  });

  it("le tableau VIDE est REFUSÉ, et la contrainte est nommée", async () => {
    // L'assertion NOMME la contrainte (§9, 24/08) : un `toThrow()` nu aurait
    // accepté n'importe quel refus — une clé étrangère, une politique.
    await expect(poser("VIDE")).rejects.toThrow(/forfait_zones_non_vides/);
  });

  it("et PRISMA rend `[]` pour ce `NULL` — c'est d'ici que vient le vide", async () => {
    await poser("NULL");
    const [lu] = await clientOwner().forfait.findMany({
      where: { id: poses[poses.length - 1] },
      select: { zone_geo: true, type_intervention: true },
    });
    // LA MESURE QUI EXPLIQUE TOUT LE RESTE : la base porte NULL, le code reçoit
    // un tableau vide. Aucun des deux ne ment ; c'est l'ORM qui traduit.
    expect(lu?.zone_geo).toEqual([]);
    expect(lu?.type_intervention).toEqual([]);
  });

  it("et ce `[]` est bien lu comme « aucune condition » par la règle", async () => {
    // Le bout de chaîne : la traduction de l'ORM arrive jusqu'à RG-TAR-06, et
    // le forfait général s'applique. *C'est la faute réparée le 09/09, et elle
    // reste réparée.*
    await poser("NULL");
    const [lu] = await clientOwner().forfait.findMany({
      where: { id: poses[poses.length - 1] },
      select: {
        id: true,
        zone_geo: true,
        famille_id: true,
        type_intervention: true,
      },
    });
    expect(
      forfaitApplicable(
        {
          zone_geo: lu?.zone_geo ?? [],
          famille_id: lu?.famille_id ?? null,
          type_intervention: lu?.type_intervention ?? [],
        },
        { zone: "grand_noumea", familleId: null, typeIntervention: null },
      ),
    ).toBe(true);
  });

  it("ÉCRIRE `[]` PAR PRISMA est refusé — le piège du chemin d'écriture", async () => {
    // *Aucun code n'écrit de forfait aujourd'hui.* Le jour où un écran le fera,
    // il devra envoyer `null`. Ce scénario fixe le fait plutôt que de le
    // laisser dans un commentaire.
    const id = uuidv7();
    poses.push(id);
    await expect(
      clientOwner().forfait.create({
        data: {
          id,
          societe_id: SOCIETE_A,
          code: `SC-${id.slice(-6)}`,
          libelle: "Sans condition",
          type: "deplacement",
          rang: 999999,
          montant_mineur: BigInt(1000),
          devise_code: "XPF",
          zone_geo: [],
          type_intervention: [],
          cumulable_temps: true,
          actif: true,
        },
      }),
    ).rejects.toThrow();
  });
});
