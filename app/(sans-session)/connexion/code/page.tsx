import type { Metadata } from "next";

import { headers } from "next/headers";

import { MarqueClaire } from "@/components/navigation/marque";
import { CadreAcces } from "@/components/session/cadre-acces";
import { ChampCode } from "@/components/session/champ-code";
import { MessageAcces } from "@/components/session/message-acces";
import { Button } from "@/components/ui/button";
import { Message } from "@/components/ui/message";
import { estCleTraduction, t } from "@/lib/i18n/fr";

export const metadata: Metadata = { title: t("connexion.code") };

/**
 * PRÉSENTATION DU SECOND FACTEUR À LA CONNEXION (ticket L1-02f ; au gabarit
 * de la maquette du 28/09, D188, partie 6).
 *
 * **Ne réutilise plus `components/session/formulaire.tsx`** — même raison
 * qu'à `/connexion` (D188, partie 5) : ce fichier reste intact.
 *
 * ## « ← Retour à la connexion » N'EST PAS UN LIEN (piège K3)
 *
 * `GET /connexion` redirige un compte à demi-session vers `/arrivee`
 * (`connexion/page.tsx`) : un simple `<a href="/connexion">` BOUCLERAIT.
 * Le retour reste donc EXACTEMENT le même geste que « Se déconnecter »
 * d'aujourd'hui — un `POST /api/session/deconnexion`, route inchangée —
 * seul le texte et la position changent. Le pied « Se déconnecter » est
 * retiré de CETTE page SEULE : `nav.deconnexion` sert encore `/enrolement`.
 *
 * ## Second chemin : le code de secours (TR-34, 9CW-TP-S6)
 *
 * `<details>` natif plutôt qu'une bascule en JavaScript — son formulaire
 * poste vers sa propre route (`/api/session/code-secours`) et fonctionne
 * sans aucun script, comme le premier.
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
      <CadreAcces>
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6">
          <form action="/api/session/deconnexion" method="post">
            <button
              type="submit"
              className="text-muted-foreground hover:text-foreground text-sm underline underline-offset-4"
            >
              {t("connexion.code.retour")}
            </button>
          </form>

          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {t("connexion.code.titre_page")}
            </h1>
            <p className="text-muted-foreground text-sm">
              {t("connexion.code.aide")}
            </p>
          </div>

          {/* LE REFUS, SUR CETTE ÉTAPE, PREND LE TEXTE DE LA MAQUETTE
              (M:5466) PLUTÔT QUE LE TEXTE GÉNÉRIQUE DE `auth.refus` — il
              sert aussi un code de secours refusé, les deux routes
              renvoyant le même motif (écart nommé, D188). Tout AUTRE motif
              valide retombe sur le bandeau générique. */}
          {typeof motif === "string" && motif === "auth.refus" ? (
            <Message ton="refus" titre={t("connexion.code.refus")} />
          ) : typeof motif === "string" && estCleTraduction(motif) ? (
            <MessageAcces motif={motif} />
          ) : null}

          <form
            action="/api/session/code"
            method="post"
            className="flex flex-col gap-4"
          >
            <ChampCode libelle={t("connexion.code.champ_accessible")} />
            <Button type="submit">{t("connexion.code.verifier")}</Button>
          </form>

          <details className="w-full">
            <summary className="text-muted-foreground hover:text-foreground cursor-pointer text-sm underline underline-offset-4">
              {t("connexion.code.secours.repli")}
            </summary>
            <form
              action="/api/session/code-secours"
              method="post"
              className="mt-4 flex flex-col gap-1.5"
            >
              <label htmlFor="code-secours" className="text-sm font-medium">
                {t("connexion.code.secours.champ")}
              </label>
              <input
                id="code-secours"
                name="code"
                type="text"
                required
                pattern="[A-Za-z0-9]{5}-[A-Za-z0-9]{5}"
                placeholder={t("connexion.code.secours.placeholder")}
                className="border-input bg-background rounded-md border px-3 py-2 text-sm font-normal"
              />
              <span className="text-muted-foreground text-xs font-bold">
                {t("connexion.code.secours.aide")}
              </span>
              <Button type="submit" variant="outline" className="mt-2.5">
                {t("connexion.code.secours.utiliser")}
              </Button>
            </form>
          </details>
        </main>
      </CadreAcces>
    </>
  );
}
