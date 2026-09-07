import { describe, expect, it } from "vitest";

import {
  VARIABLES_CONTEXTE,
  avecContexteRls,
  instructionContexte,
  type ContexteRls,
} from "../../../lib/db/rls";

/**
 * COMBIEN D'ALLERS-RETOURS COÛTE LA POSE DU CONTEXTE ? (ticket L1-02b)
 *
 * **La question n'est pas cosmétique, et elle a déjà coûté une fois.** Le seed
 * passait en 0,3 s en local et échouait en P2028 sur la base hébergée, au 28ᵉ
 * aller-retour d'une transaction dont le délai valait 5 000 ms : le code était
 * identique des deux côtés, seule la latence changeait — une milliseconde en
 * local, cent-quatre-vingt-dix vers Sydney (§9, 23/08). **Un défaut de latence
 * ne se mesure pas, il se compte.**
 *
 * Le contexte est posé au début de CHAQUE transaction applicative. Il coûtait
 * quatre allers-retours ; réparer l'armement en aurait ajouté deux. Les
 * `set_config` d'un même `SELECT` s'exécutent tous et aucun ne dépend de la
 * valeur d'un autre : rien n'exigeait qu'ils voyagent séparément. Ce fichier
 * COMPTE, plutôt que d'espérer.
 *
 * Le compte se fait sur un client factice — pas de base, pas de latence, et
 * surtout : ce qui est mesuré est le nombre d'INSTRUCTIONS que le module émet,
 * qui est exactement le nombre d'allers-retours qu'elles coûteront.
 */

/** Le nombre d'instructions que le module émettait avant ce ticket. */
const ALLERS_RETOURS_AVANT = 4;

type Emission = { sql: string; parametres: unknown[] };

/** Un client factice qui n'exécute rien et retient tout. */
function clientFactice(emissions: Emission[]) {
  const tx = {
    $executeRawUnsafe: (sql: string, ...parametres: unknown[]) => {
      emissions.push({ sql, parametres });
      return Promise.resolve(0);
    },
  };
  return {
    $transaction: <T>(travail: (tx: unknown) => Promise<T>) => travail(tx),
  };
}

const CONTEXTE: ContexteRls = {
  societeId: "aaaaaaaa-0000-7000-8000-000000000001",
  role: null,
  auteurId: "aaaaaaaa-0000-7000-8000-0000000000d3",
  adresseIp: "203.0.113.9",
  clientId: "aaaaaaaa-0000-7000-8000-0000000000c1",
  perimetreSites: ["aaaaaaaa-0000-7000-8000-00000000551a"],
};

async function emissionsDe(contexte: ContexteRls): Promise<Emission[]> {
  const emissions: Emission[] = [];
  const prisma = clientFactice(emissions) as unknown as Parameters<
    typeof avecContexteRls
  >[0];
  await avecContexteRls(prisma, contexte, async () => null);
  return emissions;
}

describe("la pose du contexte n'a pas coûté un aller-retour de plus", () => {
  it("émet UNE instruction pour SIX variables", async () => {
    const emissions = await emissionsDe(CONTEXTE);

    expect(emissions).toHaveLength(1);
    expect(emissions.length).toBeLessThan(ALLERS_RETOURS_AVANT);
    // Témoin de non-vacuité : le client factice a bien été traversé. Zéro
    // émission ressemblerait trait pour trait à « une seule », et passerait le
    // `toBeLessThan` ci-dessus (§9, 30/08).
    expect(emissions[0]?.sql).toContain("set_config");
  });

  it("pose RÉELLEMENT les six variables, avec leurs valeurs", async () => {
    const [emission] = await emissionsDe(CONTEXTE);
    const noms = (emission?.parametres ?? []).filter(
      (valeur, rang) => rang % 2 === 0,
    );

    // C'est ici que la liste close et le comportement se confrontent : la
    // seconde n'est pas écrite à côté de la première, elle en est tirée.
    expect(noms).toEqual([...VARIABLES_CONTEXTE]);
    expect(noms).toHaveLength(6);

    const valeurs = (emission?.parametres ?? []).filter(
      (valeur, rang) => rang % 2 === 1,
    );
    expect(valeurs[0]).toBe(CONTEXTE.societeId);
    expect(valeurs[4]).toBe(CONTEXTE.clientId);
    expect(valeurs[5]).toBe("aaaaaaaa-0000-7000-8000-00000000551a");
  });

  it("une absence est posée à la chaîne vide, jamais omise", async () => {
    // L'absence doit être LISIBLE côté politique (`NULLIF(…, '')`), pas
    // silencieuse : une variable non posée et une variable vide ne se
    // distinguent pas de l'extérieur, mais une variable non posée SUR UNE
    // CONNEXION MUTUALISÉE hérite de ce que la transaction précédente y a mis.
    const [emission] = await emissionsDe({
      societeId: CONTEXTE.societeId,
      role: null,
    });
    const valeurs = (emission?.parametres ?? []).filter(
      (valeur, rang) => rang % 2 === 1,
    );

    expect(valeurs).toHaveLength(6);
    expect(valeurs.slice(1)).toEqual(["", "", "", "", ""]);
  });

  it("les paramètres sont LIÉS : aucune valeur dans le texte SQL", () => {
    // Le nom vient d'une constante du module, la valeur d'un paramètre lié :
    // rien de ce que l'appelant fournit n'entre dans le texte de l'instruction.
    const { sql, parametres } = instructionContexte(CONTEXTE);
    expect(sql).not.toContain("app.");
    expect(sql).not.toContain(CONTEXTE.societeId);
    expect(sql.match(/\$\d+/g)).toHaveLength(parametres.length);
  });
});
