import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { EnTete, Page, Panneau, Vide } from "@/components/charte/socle";
import { etatArrivee } from "@/lib/auth/arrivee";
import { obtenirSession } from "@/lib/auth/session";
import { t } from "@/lib/i18n/fr";
import { listerLesInterventions } from "@/lib/interventions/depot";

/** La liste des interventions — le point d'entrée de la fiche (L2-14). */
export default async function PageInterventions() {
  const entetes = await headers();
  const etat = await etatArrivee(entetes);
  if (etat.issue === "anonyme") {
    redirect("/connexion");
  }
  if (etat.issue === "enrolement_requis") {
    redirect("/enrolement");
  }
  if (etat.issue === "sans_societe") {
    redirect("/arrivee");
  }

  const session = await obtenirSession(entetes);
  if (session === null) {
    redirect("/connexion");
  }

  const interventions = await listerLesInterventions(session.contexte);

  return (
    <Page>
      <EnTete
        titre={t("intervention.liste.titre")}
        accroche={t("intervention.liste.accroche")}
      />

      {interventions.length === 0 ? (
        <Vide
          titre={t("intervention.vide.titre")}
          invitation={t("intervention.vide.invitation")}
        />
      ) : (
        <Panneau>
          <ul className="flex flex-col">
            {interventions.map((intervention) => (
              <li
                key={intervention.id}
                className="border-trait flex flex-wrap items-baseline justify-between gap-x-4 border-b py-2 last:border-b-0"
              >
                <Link
                  className="text-bleu font-bold underline"
                  href={`/interventions/${intervention.id}`}
                >
                  {intervention.libelle}
                </Link>
                <span className="text-gris text-sm">{intervention.client}</span>
              </li>
            ))}
          </ul>
        </Panneau>
      )}

      <p>
        <a className="text-bleu underline" href="/arrivee">
          {t("navigation.retour")}
        </a>
      </p>
    </Page>
  );
}
