import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { obtenirSession } from "@/lib/auth/session";
import { avecContexteApplicatif } from "@/lib/db/client";
import { estCleTraduction, t } from "@/lib/i18n/fr";
import { libellesDesSites, lireSite } from "@/lib/sites/depot";
import { ZONES_GEOGRAPHIQUES } from "@/lib/sites/zones";

import { libelleRattachement } from "../presentation";

/**
 * LA FICHE D'UN LIEU D'INTERVENTION (L3-16, D75).
 *
 * ## LE REFUS DE D56 EST RENDU ICI, ET IL EST NOMMÉ
 *
 * *« Changer le rattachement sans revoir le temps de trajet est refusé à
 * l'écran avec le message de D56 »* — c'est l'acceptation du ticket. Le refus
 * vient de **deux endroits qui ne se recouvrent pas** : la saisie Zod, qui le
 * rend avec son champ ; et le déclencheur `site_trajet_suit_agence`, qui le
 * rend à l'import Excel et à une correction faite à la main. *Aucun des deux ne
 * remplace l'autre*, et cet écran ne fait que rendre lisible le premier.
 *
 * **Le motif ne nomme ni l'ancien rattachement ni le nouveau** : un refus a le
 * droit d'être lisible, jamais d'être informatif (D50).
 *
 * ## Le temps de trajet ne s'affiche jamais sans son origine
 *
 * Le libellé complet du champ — *« depuis le rattachement »* — est celui du
 * dictionnaire, et l'aide dit ce que la donnée n'est PAS : *elle sert au calcul
 * de charge et aux tournées, jamais à la facturation* (D74). **Un appelant qui
 * l'additionnerait aux heures facturerait le déplacement deux fois.**
 *
 * ## Aucune comparaison de société n'est écrite ici
 *
 * `lireSite` lit sous le contexte cloisonné, et la forme « parc » décide. Une
 * fiche hors périmètre et une fiche inexistante rendent LA MÊME chose — les
 * distinguer ferait un oracle (D35, D50).
 */
export default async function PageSite({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await obtenirSession(await headers());
  if (session === null) {
    redirect("/connexion");
  }
  if (session.contexte.societeId === null) {
    redirect("/arrivee");
  }

  const { id } = await params;
  const motif = (await searchParams).motif;
  const site = await lireSite(session.contexte, id);
  if (site === null) {
    notFound();
  }
  const libelles = await libellesDesSites(session.contexte, [site]);
  // Les agences de la société, pour que le rattachement soit MODIFIABLE : sans
  // cela, l'exigence de D56 serait vraie et inatteignable depuis cet écran.
  const agences = await avecContexteApplicatif(session.contexte, (tx) =>
    tx.agence.findMany({
      select: { id: true, libelle: true },
      orderBy: [{ libelle: "asc" }, { id: "asc" }],
    }),
  );

  return (
    <main className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <Link href="/sites" className="text-app-encre-faible text-[12.5px]">
          {t("sites.retour")}
        </Link>
        <h1 className="text-[22px] font-extrabold tracking-tight">
          {site.libelle}
        </h1>
        <p className="text-app-encre-faible text-[13px]">
          {libelles.clients.get(site.client_id) ?? ""}
        </p>
      </header>

      {typeof motif === "string" && estCleTraduction(motif) ? (
        <p
          role="status"
          data-motif={motif}
          className="border-app-rouge-bord bg-app-rouge-fond text-app-rouge-encre rounded-md border px-3.5 py-2.5 text-[12.5px]"
        >
          {t(motif)}
        </p>
      ) : null}

      <form
        method="post"
        action={`/api/sites/${site.id}/modifier`}
        className="bg-app-surface border-app-bord flex flex-col gap-4 rounded-[10px] border px-4 py-4"
      >
        <Champ
          nom="libelle"
          libelle={t("site.libelle")}
          valeur={site.libelle}
        />
        <Champ
          nom="commune"
          libelle={t("site.commune")}
          valeur={site.commune ?? ""}
        />

        <label className="flex flex-col gap-1 text-[12.5px] font-semibold">
          {t("site.zone_geo")}
          <select
            name="zone_geo"
            defaultValue={site.zone_geo ?? ""}
            className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-normal"
          >
            <option value="" />
            {ZONES_GEOGRAPHIQUES.map((zone) => (
              <option key={zone} value={zone}>
                {t(`site.zone.${zone}`)}
              </option>
            ))}
          </select>
        </label>

        {/*
          LE RATTACHEMENT ET LE TEMPS DE TRAJET SONT CÔTE À CÔTE, et ce n'est
          pas une disposition : *un nombre dont la signification dépend d'une
          autre colonne ne voyage jamais seul* (D56). Les séparer à l'écran
          ferait saisir l'un sans voir l'autre, c'est-à-dire exactement la faute
          que le refus attrape ensuite.
        */}
        <div className="border-app-bord grid gap-4 rounded-md border px-3.5 py-3 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-[12.5px] font-semibold md:col-span-2">
            {libelleRattachement()}
            <select
              name="agence_id"
              defaultValue={site.agence_id}
              className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-normal"
            >
              {agences.map((agence) => (
                <option key={agence.id} value={agence.id}>
                  {agence.libelle}
                </option>
              ))}
            </select>
          </label>
          <Champ
            nom="temps_trajet_min"
            libelle={t("site.temps_trajet_min")}
            valeur={
              site.temps_trajet_min === null
                ? ""
                : String(site.temps_trajet_min)
            }
            aide={t("site.temps_trajet_min.aide")}
          />
        </div>

        <Champ
          nom="consignes_acces"
          libelle={t("site.consignes_acces")}
          valeur={site.consignes_acces ?? ""}
        />

        <div>
          <button
            type="submit"
            className="bg-app-accent text-app-accent-encre rounded-md px-4 py-2 text-[13px] font-bold"
          >
            {t("sites.action.modifier")}
          </button>
        </div>
      </form>
    </main>
  );
}

function Champ({
  nom,
  libelle,
  valeur,
  aide,
}: Readonly<{
  nom: string;
  libelle: string;
  valeur: string;
  aide?: string;
}>) {
  return (
    <label className="flex flex-col gap-1 text-[12.5px] font-semibold">
      {libelle}
      <input
        name={nom}
        defaultValue={valeur}
        className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-normal"
      />
      {aide === undefined ? null : (
        <span className="text-app-encre-faible text-[11px] font-normal">
          {aide}
        </span>
      )}
    </label>
  );
}
