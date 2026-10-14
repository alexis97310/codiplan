import type { Metadata } from "next";

import Link from "next/link";

import { CadreAcces } from "@/components/session/cadre-acces";
import { Champ, Message } from "@/components/session/formulaire";
import { Button } from "@/components/ui/button";
import { Icone } from "@/components/ui/icone";
import { t } from "@/lib/i18n/fr";
import { libelleChampObligatoire } from "@/lib/i18n/obligatoire";

export const metadata: Metadata = { title: t("premier_acces.titre") };

/**
 * PREMIER ACCÈS — L'ÉCRAN OÙ L'ON CHOISIT SON MOT DE PASSE (D65), REPRIS AU
 * GABARIT DE LA MAQUETTE PAR 9EWB3-CONNEXION-MAQUETTE (M:5507-5522).
 *
 * ## Le jeton vit dans l'URL, et nulle part ailleurs
 *
 * Il arrive en paramètre de requête parce que c'est la bibliothèque qui l'y
 * met, à la fin de sa propre redirection. Il n'est ni recopié en base, ni posé
 * en cookie : il est repassé tel quel dans un champ caché, et consommé par la
 * route.
 *
 * ## Un seul écran de refus, quel que soit le motif (D35, D50)
 *
 * Jeton absent, vide, tronqué, expiré, déjà servi ou inconnu : **le même
 * écran** « Ce lien n'est plus valide », sans nom ni adresse. Les distinguer
 * apprendrait à un tiers si un lien a existé ou a déjà servi. La page ne lit
 * donc que la PRÉSENCE du jeton dans l'URL, jamais `motif`, pour décider quelle
 * des deux branches rendre.
 *
 * ## Ce qu'il ne fait PAS
 *
 * Il n'ouvre aucune session et ne lit rien de la base au GET — ni prénom, ni
 * e-mail, ni nom d'administrateur : l'écran dit « Bienvenue », sans plus.
 */
export default async function PagePremierAcces({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parametres = await searchParams;
  const jeton = parametres.token;
  const motif = parametres.motif;

  if (typeof jeton !== "string" || jeton.trim() === "") {
    return (
      <CadreAcces>
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("premier_acces.lien_invalide.titre")}
          </h1>
          <p className="text-muted-foreground text-sm">
            {t("premier_acces.lien_invalide.texte")}
          </p>
          <Button asChild size="lg" className="w-full">
            <Link href="/connexion">
              {t("premier_acces.lien_invalide.action")}
            </Link>
          </Button>
        </main>
      </CadreAcces>
    );
  }

  return (
    <CadreAcces>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("premier_acces.bienvenue")}
          </h1>
          <p className="text-muted-foreground text-sm">
            {t("premier_acces.accroche")}
          </p>
        </div>

        <Message motif={typeof motif === "string" ? motif : undefined} />

        {/* `method="post"` sur une route : le formulaire fonctionne sans
            JavaScript, et la réponse porte ses `Set-Cookie` sans qu'aucune
            couche ne s'interpose. */}
        <form
          action="/api/session/premier-acces"
          method="post"
          className="flex flex-col gap-4"
        >
          {/* Le jeton repasse tel quel : il vient de la bibliothèque, il
              n'est ni réécrit ni interprété ici. */}
          <input type="hidden" name="jeton" value={jeton} />
          <Champ
            nom="motDePasse"
            type="password"
            libelle={libelleChampObligatoire(t("premier_acces.mot_de_passe"))}
          />
          <ul className="text-muted-foreground -mt-2 flex flex-wrap gap-4 text-14">
            <li className="flex items-center gap-1.5">
              <Icone nom="check" className="text-app-vert-plein" />
              {t("premier_acces.regle_longueur")}
            </li>
            <li className="flex items-center gap-1.5">
              <Icone nom="check" className="text-app-vert-plein" />
              {t("premier_acces.regle_confirmation")}
            </li>
          </ul>
          <Champ
            nom="confirmation"
            type="password"
            libelle={libelleChampObligatoire(t("premier_acces.confirmation"))}
          />
          <Button type="submit" size="lg" className="w-full">
            {t("premier_acces.valider")}
          </Button>
          <p className="text-muted-foreground text-sm">
            {t("premier_acces.conseil_telephone")}
          </p>
        </form>
      </main>
    </CadreAcces>
  );
}
