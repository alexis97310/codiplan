import Link from "next/link";
import { ActionPrimaire } from "@/components/ui/action-primaire";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { obtenirSession } from "@/lib/auth/session";
import { rechercherClients } from "@/lib/clients/depot";
import { schemaRechercheClient } from "@/lib/clients/saisie";
import { avecContexteApplicatif } from "@/lib/db/client";
import { estCleTraduction, t } from "@/lib/i18n/fr";
import { ZONES_GEOGRAPHIQUES } from "@/lib/sites/zones";

import { libelleRattachement } from "../presentation";

/**
 * LA CRÉATION D'UN LIEU D'INTERVENTION (L3-16, D75).
 *
 * ## DEUX CHAMPS SANS VALEUR PAR DÉFAUT, ET C'EST LA SAISIE QUI L'EXIGE
 *
 * Le client et le **rattachement** sont obligatoires, et `saisie.ts` écrit
 * pourquoi : *« il n'existe aucune valeur par défaut qui ne soit pas un
 * mensonge — la choisir pour l'utilisateur reviendrait à décider d'où part le
 * temps de trajet »* (D56). Les deux listes déroulantes n'ont donc **aucune
 * option présélectionnée**.
 *
 * ## Les listes sont lues SOUS le contexte cloisonné
 *
 * Un compte ne peut proposer que ce qu'il a le droit de lire, et aucune
 * comparaison de société n'est écrite ici.
 */
export default async function PageNouveauSite({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await obtenirSession(await headers());
  if (session === null) {
    redirect("/connexion");
  }
  if (session.contexte.societeId === null) {
    redirect("/arrivee");
  }
  const motif = (await searchParams).motif;

  const clients = await rechercherClients(
    session.contexte,
    schemaRechercheClient.parse({}),
  );
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
          {t("sites.creer")}
        </h1>
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
        action="/api/sites/creer"
        className="bg-app-surface border-app-bord flex flex-col gap-4 rounded-[10px] border px-4 py-4"
      >
        {/* AUCUNE OPTION PRÉSÉLECTIONNÉE sur ces deux listes. Voir l'entête. */}
        <label className="flex flex-col gap-1 text-[12.5px] font-semibold">
          {t("site.client")}
          <select
            name="client_id"
            required
            defaultValue=""
            className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-normal"
          >
            <option value="" disabled />
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.raison_sociale}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-[12.5px] font-semibold">
          {libelleRattachement()}
          <select
            name="agence_id"
            required
            defaultValue=""
            className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-normal"
          >
            <option value="" disabled />
            {agences.map((agence) => (
              <option key={agence.id} value={agence.id}>
                {agence.libelle}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-[12.5px] font-semibold">
          {t("site.libelle")}
          <input
            name="libelle"
            required
            className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-normal"
          />
        </label>

        <label className="flex flex-col gap-1 text-[12.5px] font-semibold">
          {t("site.commune")}
          <input
            name="commune"
            className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-normal"
          />
        </label>

        <label className="flex flex-col gap-1 text-[12.5px] font-semibold">
          {t("site.zone_geo")}
          <select
            name="zone_geo"
            defaultValue=""
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

        <label className="flex flex-col gap-1 text-[12.5px] font-semibold">
          {t("site.temps_trajet_min")}
          <input
            name="temps_trajet_min"
            className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-normal"
          />
          <span className="text-app-encre-faible text-[11px] font-normal">
            {t("site.temps_trajet_min.aide")}
          </span>
        </label>

        <div>
          <ActionPrimaire>{t("sites.action.creer")}</ActionPrimaire>
        </div>
      </form>
    </main>
  );
}
