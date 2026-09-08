import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Champ, Formulaire, Message } from "@/components/session/formulaire";
import { fr } from "@/lib/i18n/fr";

/**
 * LE PREMIER ÉCRAN, ÉPROUVÉ AU RENDU (ticket L1-02f).
 *
 * ## Ce qui compte ici n'est pas la mise en page, c'est UNE borne
 *
 * Les routes de session reportent leurs refus d'un chemin vers une page par un
 * paramètre d'URL — donc par une valeur qui vient de **l'extérieur**. Sans
 * filtre, n'importe qui ferait écrire n'importe quoi à la page en forgeant un
 * lien : « votre compte a été suspendu, appelez ce numéro » sur une page de
 * connexion à la charte du client. Le paramètre est donc une CLÉ du
 * dictionnaire, jamais un texte, et une clé inconnue n'affiche RIEN.
 *
 * C'est aussi la coupure de L0-11 rendue mécanique : ce qu'un humain lit vient
 * du dictionnaire, et de nulle part ailleurs.
 *
 * ## CE QUE LA MESURE SUR LE SERVEUR RÉEL A MONTRÉ, ET SA LIMITE
 *
 * `/connexion?motif=Votre%20compte%20est%20suspendu`, contre l'application
 * construite : **aucun élément `role="status"` n'est rendu** — la borne tient.
 * La chaîne forgée apparaît néanmoins dans la SOURCE de la page, échappée, dans
 * la clé de route que Next sérialise (`__PAGE__?{"motif":"…"}`). Elle n'atteint
 * donc aucun lecteur, et c'est le point ; mais elle est là, et le dire vaut
 * mieux que laisser le prochain lecteur la trouver en croyant à un trou. Ce que
 * ce gardien promet est exact : rien de ce qui vient de l'URL n'est AFFICHÉ.
 */
describe("le message d'un écran de session vient du dictionnaire", () => {
  it("une clé connue s'affiche, dans le texte du dictionnaire", () => {
    render(<Message motif="auth.refus" />);
    expect(screen.getByRole("status")).toHaveTextContent(fr["auth.refus"]);
  });

  it("une chaîne LIBRE venue de l'URL n'affiche rien", () => {
    render(<Message motif="Votre compte est suspendu, appelez le 00 00 00" />);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("une clé absente n'affiche rien non plus", () => {
    render(<Message motif="auth.refus.inexistant" />);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("et rien du tout quand aucun motif n'est passé", () => {
    render(<Message />);
    expect(screen.queryByRole("status")).toBeNull();
  });
});

describe("le formulaire de session poste vers une route, sans JavaScript", () => {
  it("il porte sa méthode et son action — un navigateur nu doit suffire", () => {
    const { container } = render(
      <Formulaire
        action="/api/session/connexion"
        titre={fr["connexion.titre"]}
        accroche={fr["connexion.accroche"]}
        valider={fr["connexion.valider"]}
      >
        <Champ nom="email" type="email" libelle={fr["connexion.email"]} />
      </Formulaire>,
    );

    const formulaire = container.querySelector("form");
    expect(formulaire?.getAttribute("method")).toBe("post");
    expect(formulaire?.getAttribute("action")).toBe("/api/session/connexion");

    // Le champ est REQUIS côté navigateur — ce qui ne remplace jamais Zod côté
    // serveur, et ne prétend pas le faire : c'est du confort de saisie.
    const champ = screen.getByLabelText(fr["connexion.email"]);
    expect(champ).toBeRequired();
    expect(champ.getAttribute("name")).toBe("email");
  });

  it("le code du second facteur n'accepte que six chiffres à la saisie", () => {
    render(
      <Formulaire
        action="/api/session/code"
        titre={fr["connexion.code"]}
        valider={fr["connexion.code.valider"]}
      >
        <Champ
          nom="code"
          type="text"
          libelle={fr["connexion.code"]}
          motif="[0-9]{6}"
        />
      </Formulaire>,
    );
    expect(screen.getByLabelText(fr["connexion.code"])).toHaveAttribute(
      "pattern",
      "[0-9]{6}",
    );
  });
});
