import { PrismaClient } from "@prisma/client";

import { jourDe, maintenant } from "@/lib/calendar/fuseau";
import { lundiDeLaSemaine } from "@/lib/calendar/semaine";

import { urlAdministration } from "./base";
import type { ReperesDeScene } from "./scene";

/**
 * LES REPÈRES DE LA SCÈNE, RELUS depuis la base.
 *
 * La préparation globale et les scénarios vivent dans des PROCESSUS DISTINCTS :
 * ce que `ecrireLaScene` calcule ne leur parvient pas. Les identifiants
 * d'agence, de site et d'identité étant tirés au semis, ils se relisent — ils ne
 * se devinent pas.
 *
 * *Les identifiants d'INTERVENTION, eux, sont fixes et écrits dans `scene.ts` :
 * c'est ce qui permet à un scénario de viser une ligne sans dépendre du nombre
 * de sites de démonstration.*
 */
export async function reperesDeLaScene(): Promise<ReperesDeScene> {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    const societe = await client.societe.findFirstOrThrow({
      where: { code: "CODIMA-NC" },
      select: { id: true, fuseau_horaire: true },
    });
    const identite = async (email: string): Promise<string> =>
      (
        await client.utilisateur.findFirstOrThrow({
          where: { email },
          select: { id: true },
        })
      ).id;
    return {
      societeId: societe.id,
      fuseau: societe.fuseau_horaire,
      // Le jour civil À NOUMÉA, jamais en UTC — entre 00:00 et 11:00, la date
      // UTC est encore la veille et désignerait le lundi de la semaine
      // PRÉCÉDENTE (9D2-TESTS-DATES-NOUMEA).
      lundi: lundiDeLaSemaine(
        jourDe(maintenant(societe.fuseau_horaire).local),
      ),
      technicienKone: await identite("perrin@codima.test"),
      technicienDucos: await identite("garnier@codima.test"),
    };
  } finally {
    await client.$disconnect();
  }
}
