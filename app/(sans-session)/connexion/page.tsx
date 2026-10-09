import type { Metadata } from "next";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";

import { MarqueClaire } from "@/components/navigation/marque";
import { CadreAcces } from "@/components/session/cadre-acces";
import { ChampMotDePasse } from "@/components/session/champ-mot-de-passe";
import { MessageAcces } from "@/components/session/message-acces";
import { Button } from "@/components/ui/button";
import { etatArriveeOuAnonyme } from "@/lib/auth/arrivee";
import { t } from "@/lib/i18n/fr";

export const metadata: Metadata = { title: t("connexion.titre") };

/**
 * PAGE DE CONNEXION (ticket L1-02f ; au gabarit de la maquette du 28/09,
 * D188, partie 5).
 *
 * **Ne réutilise plus `components/session/formulaire.tsx`** (`Formulaire`,
 * `Champ`, `Message`) : ce fichier reste INTACT, partagé par `/enrolement`
 * et `/premier-acces`, qui continuent de le rendre à l'identique. Cette
 * page compose sa propre marque — `CadreAcces` (deux colonnes), `
 * ChampMotDePasse` (le bouton « Afficher »/« Masquer »), `MessageAcces` (le
 * bandeau à quatre tons). Le champ `email` reste un `<input>` ordinaire,
 * posé ici : rien ne le distingue assez d'un `Champ` pour justifier un
 * composant à part.
 *
 * Elle redirige un compte DÉJÀ connecté plutôt que de lui redemander ses
 * identifiants — vers l'enrôlement si son rôle l'attend, vers l'arrivée sinon.
 */
export default async function PageConnexion({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const etat = await etatArriveeOuAnonyme(await headers());
  if (etat.issue === "enrolement_requis") {
    redirect("/enrolement");
  }
  if (etat.issue !== "anonyme") {
    redirect("/arrivee");
  }

  const motif = (await searchParams).motif;
  return (
    <>
      {/* LA MARQUE, UNE SEULE FOIS (décision GR17-M15) — au-dessus du
          cadre à deux colonnes, jamais répétée dans sa colonne gauche. */}
      <MarqueClaire accueil="/" />
      <CadreAcces>
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {t("connexion.titre_page")}
            </h1>
            <p className="text-muted-foreground text-sm">
              {t("connexion.accroche_page")}
            </p>
          </div>

          <MessageAcces motif={typeof motif === "string" ? motif : undefined} />

          {/* `method="post"` sur une route : le formulaire fonctionne sans
              JavaScript, et la réponse porte ses `Set-Cookie` sans
              qu'aucune couche ne s'interpose (même discipline que
              `Formulaire`). */}
          <form
            action="/api/session/connexion"
            method="post"
            className="flex flex-col gap-4"
          >
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              {t("connexion.email")}
              <input
                name="email"
                type="email"
                required
                autoComplete="username"
                className="border-input bg-background rounded-md border px-3 py-2 text-sm font-normal"
              />
            </label>

            <div className="flex flex-col gap-1">
              <ChampMotDePasse
                libelle={t("connexion.mot_de_passe")}
                libelleAfficher={t("connexion.mot_de_passe.afficher")}
                libelleMasquer={t("connexion.mot_de_passe.masquer")}
              />
              {/* QE-18 (a), D162 — texte seul : le seul chemin d'ouverture
                  d'un accès est désormais administratif (Équipe), jamais un
                  formulaire public. AVANT le bouton, aligné à droite sur sa
                  propre ligne (M:5455, `.a-oubli`). */}
              <div className="-mt-1.5 flex justify-end">
                <Link
                  href="/mot-de-passe-oublie"
                  className="text-sm underline underline-offset-2"
                >
                  {t("connexion.mot_de_passe_oublie")}
                </Link>
              </div>
            </div>

            <Button type="submit">{t("connexion.valider")}</Button>
          </form>
        </main>
      </CadreAcces>
    </>
  );
}
