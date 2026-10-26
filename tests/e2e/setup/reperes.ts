import { PrismaClient } from "@prisma/client";

import { jourDe, maintenant } from "@/lib/calendar/fuseau";
import { lundiDeLaSemaine } from "@/lib/calendar/semaine";

import { urlAdministration } from "./base";
import {
  lundiDeLaSceneMemorise,
  lundiSansJourPasse,
  type ReperesDeScene,
} from "./scene";

/**
 * LES REPÈRES DE LA SCÈNE, RELUS depuis la base.
 *
 * La préparation globale et les scénarios vivent dans des PROCESSUS DISTINCTS :
 * ce que `ecrireLaScene` calcule ne leur parvient pas par un simple import.
 * Les identifiants d'agence, de site et d'identité étant tirés au semis, ils
 * se relisent toujours en base — ils ne se devinent pas.
 *
 * **`lundi`, lui, ne se RECALCULE plus ici** (9G4D-EPREUVE-TRANSMETTRE-ET-MINUIT,
 * mesuré par 9G4A1-REPRISE-9G4C) — il se RELIT, posé par `ecrireLaScene` dans
 * `process.env` (`lundiDeLaSceneMemorise`). Le recalculer séparément dans ce
 * second processus laissait les deux diverger d'une semaine entière si minuit
 * s'intercalait entre les deux calculs. Le secours (recalcul local) ne sert
 * qu'à un appel de cette fonction HORS du harnais `global.ts` — un test
 * unitaire, par exemple — où rien n'a jamais posé la valeur mémorisée.
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
    const lundi =
      lundiDeLaSceneMemorise() ??
      (() => {
        // Le jour civil À NOUMÉA, jamais en UTC — entre 00:00 et 11:00, la
        // date UTC est encore la veille et désignerait le lundi de la
        // semaine PRÉCÉDENTE (9D2-TESTS-DATES-NOUMEA).
        const aujourdhui = jourDe(maintenant(societe.fuseau_horaire).local);
        return lundiSansJourPasse(lundiDeLaSemaine(aujourdhui), aujourdhui);
      })();
    return {
      societeId: societe.id,
      fuseau: societe.fuseau_horaire,
      lundi,
      technicienKone: await identite("perrin@codima.test"),
      technicienDucos: await identite("garnier@codima.test"),
    };
  } finally {
    await client.$disconnect();
  }
}
