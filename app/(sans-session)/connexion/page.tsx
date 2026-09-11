import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { Champ, Formulaire, Message } from "@/components/session/formulaire";
import { etatArriveeOuAnonyme } from "@/lib/auth/arrivee";
import { t } from "@/lib/i18n/fr";

/**
 * PAGE DE CONNEXION (ticket L1-02f) — le premier écran du produit.
 *
 * Sobre assumé, et le mot est de l'exploitation : une accroche, deux champs, un
 * bouton. La charte de la société n'est pas ici — elle est posée par la mise en
 * page racine (L0-09), qui rend le thème NEUTRE tant qu'aucune société n'est
 * active. Une page de connexion doit s'afficher alors même qu'aucune société
 * n'est encore choisie, et c'est déjà écrit dans `lib/theme/session.ts`.
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
    <Formulaire
      action="/api/session/connexion"
      titre={t("connexion.titre")}
      accroche={t("connexion.accroche")}
      valider={t("connexion.valider")}
    >
      <Message motif={typeof motif === "string" ? motif : undefined} />
      <Champ nom="email" type="email" libelle={t("connexion.email")} />
      <Champ
        nom="motDePasse"
        type="password"
        libelle={t("connexion.mot_de_passe")}
      />
    </Formulaire>
  );
}
