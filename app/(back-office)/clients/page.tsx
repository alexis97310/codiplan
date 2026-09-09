import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  EnTete,
  Etiquette,
  Mesure,
  Page,
  Panneau,
  Vide,
} from "@/components/charte/socle";
import { etatArrivee } from "@/lib/auth/arrivee";
import { obtenirSession } from "@/lib/auth/session";
import { t } from "@/lib/i18n/fr";
import { mot } from "@/lib/i18n/vocabulaire";
import {
  type ClientDuParc,
  type SiteDuParc,
  lireLeParc,
} from "@/lib/parc/depot";

/**
 * L'ÉCRAN DU PARC (ticket L2-12) — un client, ses lieux d'intervention, leur
 * rattachement, leur trajet, leurs forfaits, leurs machines.
 *
 * **Le trajet ne s'affiche JAMAIS seul** (D56). Un « 25 min » posé dans une
 * colonne ne dit pas d'où l'on part, et le jour où une quatrième agence ouvre,
 * personne ne sait quelles valeurs revoir. Il est donc rendu à côté de son
 * rattachement, et la note l'explique — ce n'est pas une donnée manquante,
 * c'est une donnée dont le référentiel serait implicite.
 *
 * **Aucun montant n'est calculé ici** : les forfaits arrivent déjà formatés par
 * `formatMoney`, la devise décidant des décimales (I3).
 */
export default async function PageParc() {
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

  const parc = await lireLeParc(session.contexte);

  return (
    <Page>
      <EnTete titre={t("parc.titre")} accroche={t("parc.accroche")} />

      {parc.clients.length === 0 ? (
        <Vide
          titre={t("parc.vide.titre")}
          invitation={t("parc.vide.invitation")}
        />
      ) : (
        parc.clients.map((client) => (
          <FicheClient
            key={client.id}
            client={client}
            libelleCodeExterne={parc.libelleCodeExterne}
          />
        ))
      )}

      <p>
        <a className="text-bleu underline" href="/arrivee">
          {t("navigation.retour")}
        </a>
      </p>
    </Page>
  );
}

function FicheClient({
  client,
  libelleCodeExterne,
}: {
  client: ClientDuParc;
  libelleCodeExterne: string;
}) {
  return (
    <Panneau titre={client.raisonSociale}>
      <dl className="mb-4 flex flex-col gap-2">
        {client.codeExterne === null ? null : (
          <Mesure libelle={libelleCodeExterne} valeur={client.codeExterne} />
        )}
        <Mesure libelle={t("parc.machines")} valeur={client.machines} />
      </dl>

      {client.sites.length === 0 ? (
        <Vide
          titre={t("parc.sites_vide.titre")}
          invitation={t("parc.sites_vide.invitation")}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {client.sites.map((site) => (
            <li key={site.id}>
              <FicheSite site={site} />
            </li>
          ))}
        </ul>
      )}
    </Panneau>
  );
}

function FicheSite({ site }: { site: SiteDuParc }) {
  return (
    <article className="border-trait bg-acier rounded-sm border p-3">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base">{site.libelle}</h3>
        {site.zone === null ? null : (
          <Etiquette texte={site.zone} ton="neutre" />
        )}
      </div>

      <dl className="flex flex-col gap-1.5">
        {/* LE COUPLE, jamais l'un sans l'autre (D56). */}
        <Mesure
          libelle={`${mot("agence")} — ${t("parc.rattachement")}`}
          valeur={site.agence}
        />
        <Mesure
          libelle={t("parc.trajet")}
          valeur={
            site.trajetMinutes === null
              ? t("parc.trajet.absent")
              : `${site.trajetMinutes} ${t("parc.minutes")}`
          }
          accent={site.trajetMinutes === null ? "gris" : undefined}
        />
        <Mesure libelle={t("parc.machines")} valeur={site.machines} />
      </dl>

      <p className="text-gris mt-1.5 max-w-[65ch] text-xs">
        {t("parc.trajet.aide")}
      </p>

      <h4 className="mt-3 text-sm">{t("parc.forfaits")}</h4>
      {site.forfaits.length === 0 ? (
        <p className="text-gris text-sm">{t("parc.forfaits.aucun")}</p>
      ) : (
        <ul className="mt-1 flex flex-col gap-1">
          {site.forfaits.map((forfait) => (
            <li
              key={forfait.code}
              className="border-l-ambre bg-ambre-fond flex items-baseline justify-between gap-4 border-l-4 px-2 py-1 text-sm"
            >
              <span>{forfait.libelle}</span>
              <span className="font-bold">{forfait.montant}</span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
