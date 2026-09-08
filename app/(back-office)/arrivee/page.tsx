import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { Button } from "@/components/ui/button";
import { etatArrivee, type Arrivee } from "@/lib/auth/arrivee";
import { t } from "@/lib/i18n/fr";

/**
 * PAGE D'ARRIVÉE (ticket L1-02f) — qui vous êtes, pour quelle société.
 *
 * **Et rien d'autre.** Pas de liste de clients, pas de navigation, pas de menu :
 * chaque donnée de plus serait un écran de lot 2 écrit en avance.
 *
 * La raison sociale n'est pas recopiée de la session : elle est LUE en base sous
 * le contexte cloisonné, par `etatArrivee`. La politique de `societe` est de
 * forme « identité » (`id = app.societe_id`, D42), si bien qu'une session active
 * sur A ne peut pas obtenir le nom de B — pas même en passant l'identifiant de
 * B. C'est ce qui rend cette page capable de PROUVER le cloisonnement à travers
 * l'application, et non seulement de l'illustrer.
 */
export default async function PageArrivee() {
  const etat = await etatArrivee(await headers());

  if (etat.issue === "anonyme") {
    redirect("/connexion");
  }
  if (etat.issue === "enrolement_requis") {
    redirect("/enrolement");
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">
        {t("arrivee.titre")}
      </h1>

      <dl className="flex flex-col gap-3 text-sm">
        <Ligne libelle={t("arrivee.compte")} valeur={etat.arrivee.nom} />
        <Ligne libelle={t("arrivee.email")} valeur={etat.arrivee.email} />
      </dl>

      {etat.issue === "sans_societe" ? (
        <p className="text-muted-foreground text-sm">
          {t("arrivee.sans_societe")}
        </p>
      ) : (
        <Societe arrivee={etat.arrivee} />
      )}

      <form action="/api/session/deconnexion" method="post">
        <Button type="submit" variant="outline">
          {t("arrivee.deconnexion")}
        </Button>
      </form>
    </main>
  );
}

function Ligne({ libelle, valeur }: { libelle: string; valeur: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted-foreground">{libelle}</dt>
      <dd className="font-medium">{valeur}</dd>
    </div>
  );
}

function Societe({ arrivee }: { arrivee: Arrivee }) {
  return (
    <dl className="bg-societe-primaire text-societe-primaire-encre flex flex-col gap-3 rounded-lg px-4 py-3 text-sm">
      <Ligne libelle={t("arrivee.societe")} valeur={arrivee.societe ?? ""} />
      <Ligne libelle={t("arrivee.role")} valeur={arrivee.role ?? ""} />
    </dl>
  );
}
