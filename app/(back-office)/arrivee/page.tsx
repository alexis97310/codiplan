import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { EnTete, Mesure, Page, Panneau } from "@/components/charte/socle";
import { Button } from "@/components/ui/button";
import { etatArrivee, type Arrivee } from "@/lib/auth/arrivee";
import { t } from "@/lib/i18n/fr";

/**
 * PAGE D'ARRIVÉE (ticket L1-02f) — qui vous êtes, pour quelle société.
 *
 * **Elle porte désormais une NAVIGATION, et c'est un changement daté du
 * 11/09/2026.** Sa rédaction disait « pas de navigation, pas de menu : chaque
 * donnée de plus serait un écran de lot 2 écrit en avance ». Les écrans du lot
 * 2 existent ; la phrase est devenue fausse le jour où ils ont été construits,
 * et un point d'entrée qui ne mène nulle part est un cul-de-sac, pas une
 * discipline. Elle ne porte toujours AUCUNE donnée métier : des liens, et rien
 * de plus.
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
    <Page>
      <EnTete titre={t("arrivee.titre")} />

      <Panneau>
        <dl className="flex flex-col gap-3">
          <Mesure libelle={t("arrivee.compte")} valeur={etat.arrivee.nom} />
          <Mesure libelle={t("arrivee.email")} valeur={etat.arrivee.email} />
        </dl>
      </Panneau>

      {etat.issue === "sans_societe" ? (
        <p className="text-gris max-w-[60ch] text-sm">
          {t("arrivee.sans_societe")}
        </p>
      ) : (
        <Societe arrivee={etat.arrivee} />
      )}

      <NavigationLot2 />

      <form action="/api/session/deconnexion" method="post">
        <Button type="submit" variant="outline">
          {t("arrivee.deconnexion")}
        </Button>
      </form>
    </Page>
  );
}

/**
 * Les écrans atteignables depuis l'arrivée.
 *
 * Des LIENS, jamais des données : cette page lit une société et une identité,
 * et rien d'autre. Chaque destination fait sa propre lecture cloisonnée.
 */
function NavigationLot2() {
  return (
    <nav aria-label={t("navigation.titre")}>
      <ul className="border-trait flex flex-wrap gap-x-6 gap-y-2 border-t pt-4">
        {(
          [
            ["/planning", t("navigation.planning")],
            ["/clients", t("navigation.clients")],
            ["/techniciens", t("navigation.techniciens")],
          ] as const
        ).map(([href, libelle]) => (
          <li key={href}>
            <a href={href} className="text-bleu font-bold underline">
              {libelle}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function Societe({ arrivee }: { arrivee: Arrivee }) {
  return (
    <dl className="bg-societe-primaire text-societe-primaire-encre flex flex-col gap-3 rounded-sm px-4 py-3 text-sm">
      <div className="flex items-baseline justify-between gap-4">
        <dt>{t("arrivee.societe")}</dt>
        <dd className="font-bold">{arrivee.societe ?? ""}</dd>
      </div>
      <div className="flex items-baseline justify-between gap-4">
        <dt>{t("arrivee.role")}</dt>
        <dd className="font-bold">{arrivee.role ?? ""}</dd>
      </div>
    </dl>
  );
}
