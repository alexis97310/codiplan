import { afterEach, describe, expect, it, vi } from "vitest";

import {
  corpsPremierAcces,
  envoyerLienPremierAcces,
} from "@/lib/courriel/premier-acces";
import { VARIABLE_CLE, VARIABLE_EXPEDITEUR } from "@/lib/courriel";
import type { Envoi } from "@/lib/courriel/message";
import {
  lignesDelivrance,
  resoudreDelivrance,
} from "@/scripts/lib/delivrance-premier-acces";

/**
 * LE DESTINATAIRE, DISSOCIÉ DE L'IDENTITÉ (13/09/2026, complément de Q8).
 *
 * *Ce que ces scénarios gardent, et qu'aucun autre ne garde :* `--email`
 * DÉSIGNE l'identité que la base cherche, et le canal ouvert la veille postait
 * à cette adresse. Sur la base semée, les neuf identités portent des adresses
 * en `@codima.test` — RFC 2606, un domaine qui ne résout nulle part. **Le lien
 * partait dans le vide, et c'est la seule porte d'une base semée** (D65).
 *
 * Les deux directions sont éprouvées, comme le §9 du 11/09 l'exige : un cas
 * qui doit CHANGER — la dissociation — et un cas qui doit rester CE QU'IL EST
 * pour sa propre raison — le défaut, quand personne ne demande rien.
 */

const IDENTITE = "adv@codima.test";
const BOITE = "exploitation@example.test";

describe("le DÉFAUT ne change rien pour qui ne demande rien", () => {
  it("sans --destinataire, le lien part à l'adresse de l'identité", () => {
    const delivrance = resoudreDelivrance(IDENTITE, null);

    expect(delivrance.destinataire).toBe(IDENTITE);
    expect(delivrance.identite).toBe(IDENTITE);
    expect(delivrance.dissociee).toBe(false);
  });

  it("une entrée VIDE vaut une absence — c'est ce que le flux GitHub passe", () => {
    // Une entrée facultative non renseignée n'arrive pas absente : elle arrive
    // vide. Sans ce cas, `--destinataire ""` enverrait à personne en silence.
    for (const vide of ["", "   "]) {
      expect(resoudreDelivrance(IDENTITE, vide).destinataire).toBe(IDENTITE);
      expect(resoudreDelivrance(IDENTITE, vide).dissociee).toBe(false);
    }
  });
});

describe("la DISSOCIATION se lit dans la sortie, jamais entre les lignes", () => {
  const delivrance = resoudreDelivrance(IDENTITE, BOITE);

  it("les deux adresses sont distinctes et la dissociation est DÉRIVÉE", () => {
    expect(delivrance.destinataire).toBe(BOITE);
    expect(delivrance.identite).toBe(IDENTITE);
    expect(delivrance.dissociee).toBe(true);
  });

  it("un envoi réussi nomme LES DEUX adresses et la référence", () => {
    const sortie = lignesDelivrance(
      { parti: true, reference: "abc-123" },
      delivrance,
    ).join("\n");

    expect(sortie).toContain(BOITE);
    expect(sortie).toContain(IDENTITE);
    expect(sortie).toContain("POUR L'IDENTITÉ");
    expect(sortie).toContain("abc-123");
    expect(sortie).toMatch(/DESTINATAIRE DISSOCIÉ/);
  });

  it("un envoi NON dissocié nomme quand même les deux — l'absence ne porte aucun sens", () => {
    // LE CAS QUI DOIT RESTER JUSTE POUR SA PROPRE RAISON (§9, 11/09). Si la
    // mention de l'identité n'apparaissait qu'en cas de dissociation, ce serait
    // son ABSENCE qui porterait le sens — et une absence a exactement la forme
    // d'un succès (§9, 31/08). Le lecteur COMPARE deux adresses ; il n'infère
    // pas d'une convention qu'il faudrait connaître.
    const sortie = lignesDelivrance(
      { parti: true, reference: "abc-123" },
      resoudreDelivrance(IDENTITE, null),
    ).join("\n");

    expect(sortie).toContain("POUR L'IDENTITÉ");
    expect(sortie).toContain(IDENTITE);
    // Et l'avertissement, lui, ne s'invite PAS : il dirait faux.
    expect(sortie).not.toMatch(/DESTINATAIRE DISSOCIÉ/);
  });
});

describe("le REFUS reste ce qu'il est, et il nomme désormais les deux adresses", () => {
  const manquante: Envoi = {
    parti: false,
    motif:
      "COURRIEL_API_CLE est absente — RIEN N'A ÉTÉ ENVOYÉ. " +
      "Voir docs/mise-en-ligne.md.",
  };

  it("il dit qu'il n'a rien envoyé, à qui, pour quelle identité, et ce qui manque", () => {
    const sortie = lignesDelivrance(
      manquante,
      resoudreDelivrance(IDENTITE, BOITE),
    ).join("\n");

    expect(sortie).toContain("COURRIEL NON ENVOYÉ");
    expect(sortie).toContain(BOITE);
    expect(sortie).toContain(IDENTITE);
    expect(sortie).toContain("COURRIEL_API_CLE");
    // ET IL DIT CE QUI RESTE VRAI : le jeton est émis, le canal est un confort.
    expect(sortie).toMatch(/jeton, lui, EST émis/);
  });

  it("aucune sortie ne porte l'URL — elle est imprimée par l'appelant, une fois", () => {
    // TÉMOIN de ce que ce module ne fait PAS. Le flux GitHub expurge les URL du
    // journal (12/09) ; une URL glissée ici la ferait rentrer par la fenêtre.
    for (const envoi of [
      { parti: true, reference: "abc-123" } as const,
      manquante,
    ]) {
      const sortie = lignesDelivrance(
        envoi,
        resoudreDelivrance(IDENTITE, BOITE),
      ).join("\n");
      expect(sortie).not.toMatch(/https?:\/\//);
    }
  });
});

describe("le CORPS du message nomme l'identité qu'il ouvre", () => {
  const url = "https://exemple.test/premier-acces?jeton=xyz";

  it("il dit de quel compte il parle, et sous quelle identité on entre", () => {
    // Sans cela, un destinataire dissocié reçoit un lien et ne peut pas juger
    // s'il doit le suivre. C'est le silence que le §9 refuse.
    const corps = corpsPremierAcces(url, IDENTITE);

    expect(corps).toContain(IDENTITE);
    expect(corps).toContain(url);
    expect(corps).not.toContain("votre compte");
  });

  it("il ne porte NI mot de passe, NI société, NI nom de base", () => {
    // TÉMOIN : un courriel se transfère et s'imprime — tout ce qu'il porte est
    // durable et hors de notre portée.
    const corps = corpsPremierAcces(url, IDENTITE);

    expect(corps).not.toMatch(/mot de passe\s*:/i);
    expect(corps).not.toMatch(/postgres(ql)?:\/\//);
  });
});

/**
 * CE QUI PART SUR LE FIL — le FAIT, pas le geste (§9, 09/09).
 *
 * Tout ce qui précède mesure `lignesDelivrance` et `resoudreDelivrance`, qui
 * sont des fonctions pures. **Elles resteraient vertes si `envoyerSiDemande`
 * passait la mauvaise adresse à `envoyerLienPremierAcces`** : la sortie dirait
 * « envoyé à X » pendant que le message part à Y, et le journal du flux
 * l'affirmerait sans que rien ne le démente.
 *
 * *C'est la faute du 09/09 dans sa forme exacte* — une garantie énoncée sur un
 * geste (« la sortie nomme le destinataire ») là où le fait est ailleurs (« le
 * message part au destinataire »). Ces deux scénarios lisent la requête
 * réellement postée.
 */
describe("le message posté porte bien le destinataire, et le corps l'identité", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const configure = {
    [VARIABLE_CLE]: "une-valeur-quelconque",
    [VARIABLE_EXPEDITEUR]: "codiplan@example.test",
  };
  const url = "https://exemple.test/premier-acces?jeton=xyz";

  async function poster(destinataire: string, identite: string) {
    // Le type est DÉCLARÉ plutôt que déduit d'arguments inutilisés : c'est ce
    // qui rend `mock.calls` lisible sans conversion — une assertion de type y
    // masquerait le jour où la signature bouge.
    const appel = vi.fn<
      (url: string, options: { body: string }) => Promise<Response>
    >(
      async () =>
        new Response(JSON.stringify({ id: "abc-123" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", appel);
    const envoi = await envoyerLienPremierAcces(
      destinataire,
      url,
      identite,
      configure,
    );
    expect(envoi.parti).toBe(true);
    const [, options] = appel.mock.calls[0]!;
    return JSON.parse(options.body) as {
      to: readonly string[];
      text: string;
    };
  }

  it("dissocié : « to » est la BOÎTE, le texte nomme l'IDENTITÉ", async () => {
    const envoye = await poster(BOITE, IDENTITE);

    expect(envoye.to).toEqual([BOITE]);
    expect(envoye.text).toContain(IDENTITE);
    expect(envoye.text).toContain(url);
    // ET LE CROISEMENT, qui est la faute qu'on veut rendre impossible : le
    // message ne part JAMAIS à l'identité quand une boîte est nommée.
    expect(envoye.to).not.toContain(IDENTITE);
  });

  it("non dissocié : « to » est l'identité — le cas qui doit rester ce qu'il est", async () => {
    const delivrance = resoudreDelivrance(IDENTITE, null);
    const envoye = await poster(delivrance.destinataire, delivrance.identite);

    expect(envoye.to).toEqual([IDENTITE]);
    expect(envoye.text).toContain(IDENTITE);
  });
});
