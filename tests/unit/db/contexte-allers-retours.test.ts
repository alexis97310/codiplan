import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { join } from "node:path";

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
};

async function emissionsDe(contexte: ContexteRls): Promise<Emission[]> {
  const emissions: Emission[] = [];
  const prisma = clientFactice(emissions) as unknown as Parameters<
    typeof avecContexteRls
  >[0];
  await avecContexteRls(prisma, contexte, async () => null);
  return emissions;
}

/** Un utilisateur interne : pas de compte portail, donc pas de périmètre. */
const CONTEXTE_INTERNE: ContexteRls = {
  societeId: "aaaaaaaa-0000-7000-8000-000000000001",
  role: null,
};

describe("la pose du contexte n'a pas coûté un aller-retour de plus", () => {
  it("UN aller-retour pour un utilisateur interne, DEUX pour un compte portail", async () => {
    const interne = await emissionsDe(CONTEXTE_INTERNE);
    const portail = await emissionsDe(CONTEXTE);

    expect(interne).toHaveLength(1);
    expect(portail).toHaveLength(2);

    // Le seul chiffre qui compte pour ce ticket : « zéro aller-retour ajouté ».
    // Il est tenu avec de la marge, la pose ayant cessé d'émettre une
    // instruction par variable.
    expect(portail.length).toBeLessThan(ALLERS_RETOURS_AVANT);

    // Témoins de non-vacuité : le client factice a bien été traversé, et la
    // seconde instruction est bien la DÉSIGNATION du client. Zéro émission
    // ressemblerait trait pour trait à « une seule », et passerait le
    // `toBeLessThan` ci-dessus (§9, 30/08).
    expect(interne[0]?.sql).toContain("set_config");
    expect(portail[1]?.sql).toContain("app_poser_perimetre_client");
  });

  /**
   * CE SCÉNARIO A CHANGÉ DE LIEU, PAS DE PROPRIÉTÉ (D70), et il faut le dire.
   *
   * Il exigeait que la lecture du périmètre voyage DANS le `set_config` —
   * `SELECT string_agg(…)`, valeur jointe par des virgules — parce qu'une
   * lecture séparée aurait coûté un aller-retour de plus. **D70 a déplacé cette
   * lecture dans une fonction**, qui valide en outre la désignation : la forme
   * a bougé, la propriété non — un appel là où il y avait une instruction, et
   * le corps d'une fonction ne coûte aucun aller-retour.
   *
   * Ce n'est donc pas un test assoupli pour faire passer la vérification :
   * **c'est la même exigence, lue là où le code est parti.** Elle porte
   * désormais sur la MIGRATION, une source que ce fichier ne contrôle pas — et
   * c'est ce qui la garde honnête (§9, 01/09).
   */
  it("la lecture du périmètre voyage TOUJOURS dans un seul aller-retour", async () => {
    const [, designation] = await emissionsDe(CONTEXTE);

    // Un APPEL, et rien d'autre : ni lecture préalable, ni pose séparée.
    expect(designation?.sql).toContain("app_poser_perimetre_client");
    expect(designation?.sql).not.toContain("string_agg");
    expect(designation?.parametres).toHaveLength(2);

    const corps = readFileSync(
      join(
        process.cwd(),
        "prisma/migrations/20260909160000_designation_du_client_portail/migration.sql",
      ),
      "utf8",
    );
    // La lecture est bien DANS la fonction, et la FORME de la valeur ne bouge
    // pas : liste jointe par des virgules, exactement ce que lisent les
    // politiques. C'est ce que L1-02b avait verrouillé, et qui doit survivre au
    // déménagement.
    expect(corps).toContain("SELECT string_agg");
    expect(corps).toContain("','");
    expect(corps).toContain("set_config('app.perimetre_sites'");
    // Et le verrou que D70 ajoute au même endroit : sans lui, la désignation
    // serait une parole sur l'honneur.
    expect(corps).toContain("RAISE EXCEPTION");
    // *Ce fichier ne vérifie PAS l'absence de `SECURITY DEFINER`*, et c'est
    // délibéré : le gardien de D50 le fait déjà, sur TOUTES les migrations et
    // avec la seule coupure légitime — documentation contre exécution (§9,
    // 26/08). Une seconde lecture naïve du même critère est pire qu'aucune :
    // celle-ci tombait sur la phrase de la migration qui EXPLIQUE pourquoi la
    // fonction n'est pas `DEFINER`.
  });

  it("pose RÉELLEMENT toutes les variables, avec leurs valeurs", async () => {
    const [emission] = await emissionsDe(CONTEXTE);
    const noms = (emission?.parametres ?? []).filter(
      (valeur, rang) => rang % 2 === 0,
    );

    // C'est ici que la liste close et le comportement se confrontent : la
    // seconde n'est pas écrite à côté de la première, elle en est tirée.
    expect(noms).toEqual([...VARIABLES_CONTEXTE]);
    // DIX depuis L1-02d : les quatre DÉSIGNATIONS d'authentification — courriel,
    // identifiant d'utilisateur, jeton de session, identifiant de vérification —
    // s'ajoutent aux six premières. Leur pose la plus importante est celle qui
    // les REMET À VIDE : sur une connexion mutualisée, une variable non posée
    // hérite de ce que la transaction précédente y a laissé.
    //
    // Le décompte suit la liste close plutôt qu'un chiffre écrit à la main —
    // sinon la ligne au-dessus et celle-ci diraient deux choses, et il faudrait
    // corriger les deux (§9, 01/09).
    expect(noms).toHaveLength(VARIABLES_CONTEXTE.length);

    const valeurs = (emission?.parametres ?? []).filter(
      (valeur, rang) => rang % 2 === 1,
    );
    expect(valeurs[0]).toBe(CONTEXTE.societeId);
    expect(valeurs[4]).toBe(CONTEXTE.clientId);
    // Le périmètre part VIDE et sera rempli par la seconde instruction : il
    // doit être DÉFINI dans tous les cas, une variable non posée héritant sur
    // une connexion mutualisée de ce que la transaction précédente y a laissé.
    expect(valeurs[5]).toBe("");
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

    expect(valeurs).toHaveLength(VARIABLES_CONTEXTE.length);
    // Toutes vides sauf la société, qui est la seule fournie ici.
    expect(valeurs.slice(1)).toEqual(
      Array.from({ length: VARIABLES_CONTEXTE.length - 1 }, () => ""),
    );
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
