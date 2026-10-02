import type { Metadata } from "next";

import { headers } from "next/headers";

import { MarqueClaire } from "@/components/navigation/marque";
import { Champ, Formulaire, Message } from "@/components/session/formulaire";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n/fr";

export const metadata: Metadata = { title: t("connexion.code") };

/**
 * PRÉSENTATION DU SECOND FACTEUR À LA CONNEXION (ticket L1-02f).
 *
 * Ce que cette page NE dit pas est aussi important que ce qu'elle dit : elle
 * n'apprend rien du compte, et son refus est le même que tous les autres (D35).
 * On n'y arrive qu'avec le bon mot de passe, ce qui ne renseigne aucun tiers.
 *
 * **Second chemin : le code de secours** (TR-34, 9CW-TP-S6), pour qui a perdu
 * son application d'authentification. `<details>` natif plutôt qu'un bascule
 * en JavaScript — le formulaire du dessous poste vers sa propre route
 * (`/api/session/code-secours`) et fonctionne sans aucun script, comme le
 * premier.
 */
export default async function PageCodeSecondFacteur({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Lire les en-têtes rend le rendu dynamique : cette page dépend du cookie de
  // défi que la connexion vient de poser, elle ne peut pas être figée.
  await headers();
  const motif = (await searchParams).motif;
  return (
    <>
      <MarqueClaire accueil="/" />
      <Formulaire
        action="/api/session/code"
        titre={t("connexion.code")}
        accroche={t("connexion.code.accroche")}
        valider={t("connexion.code.valider")}
      >
        <Message motif={typeof motif === "string" ? motif : undefined} />
        <Champ
          nom="code"
          type="text"
          libelle={t("connexion.code")}
          motif="[0-9]{6}"
        />
      </Formulaire>

      <details className="mx-auto w-full max-w-md">
        <summary className="text-muted-foreground hover:text-foreground cursor-pointer text-sm underline underline-offset-4">
          {t("connexion.code.secours.lien")}
        </summary>
        <form
          action="/api/session/code-secours"
          method="post"
          className="mt-4 flex flex-col gap-4"
        >
          <Champ
            nom="code"
            type="text"
            libelle={t("connexion.code.secours.champ")}
            motif="[A-Za-z0-9]{5}-[A-Za-z0-9]{5}"
          />
          <Button type="submit" variant="outline">
            {t("connexion.code.secours.valider")}
          </Button>
        </form>
      </details>

      <Deconnexion />
    </>
  );
}

/**
 * « Se déconnecter », offerte sur une étape sans session complète (TR-38) —
 * ce chrome n'a pas la barre qui la porte ailleurs (`components/navigation/barre.tsx`).
 * Même route, même geste : un POST, jamais un lien.
 */
function Deconnexion() {
  return (
    <form
      action="/api/session/deconnexion"
      method="post"
      className="mx-auto w-full max-w-md"
    >
      <button
        type="submit"
        className="text-muted-foreground hover:text-foreground text-sm underline underline-offset-4"
      >
        {t("nav.deconnexion")}
      </button>
    </form>
  );
}
