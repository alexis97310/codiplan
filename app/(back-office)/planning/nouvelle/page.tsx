import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { obtenirSession } from "@/lib/auth/session";
import { avecContexteApplicatif } from "@/lib/db/client";
import { estCleTraduction, t } from "@/lib/i18n/fr";
import { mot } from "@/lib/i18n/vocabulaire";
import {
  PRIORITES,
  TYPES_INTERVENTION,
  MODES_VALORISATION,
} from "@/lib/interventions/saisie";

/**
 * CRÉER UNE INTERVENTION DEPUIS LE PLANNING (lot 2, D84).
 *
 * ## Ce que l'écran ne demande PAS, et pourquoi il vaut mieux qu'il ne demande
 * pas
 *
 * **L'agence** et **le forfait de déplacement** ne sont pas des champs. Le lieu
 * d'intervention les détermine tous les deux — l'un par son rattachement (D56),
 * l'autre par sa zone (D23, RG-TAR-06). Les faire saisir donnerait à
 * l'utilisateur le pouvoir de contredire la donnée, et donnerait au dépôt deux
 * lectures d'un même critère.
 *
 * La liste des lieux est celle du périmètre de l'appelant : elle est lue SOUS
 * le contexte cloisonné, et un compte portail restreint n'y voit que les siens.
 */
export default async function PageNouvelleIntervention({
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

  const lieux = await avecContexteApplicatif(session.contexte, (tx) =>
    tx.site.findMany({
      select: {
        id: true,
        libelle: true,
        client_id: true,
        client: { select: { raison_sociale: true } },
      },
      orderBy: { libelle: "asc" },
      take: 200,
    }),
  );

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-6 px-6 py-10">
      <Link href="/planning" className="text-muted-foreground text-sm">
        {t("planning.retour_fleche")}
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">
        {t("planning.creer")}
      </h1>

      {typeof motif === "string" && estCleTraduction(motif) ? (
        <p
          role="status"
          className="border-destructive text-destructive rounded-md border px-3 py-2 text-sm"
        >
          {t(motif)}
        </p>
      ) : null}

      <form
        action="/api/interventions/creer"
        method="post"
        className="flex flex-col gap-4"
      >
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {mot("site")}
          <select
            name="site"
            required
            className="border-input bg-background rounded-md border px-3 py-2 font-normal"
          >
            {lieux.map((lieu) => (
              <option key={lieu.id} value={`${lieu.client_id}:${lieu.id}`}>
                {libelleDuLieu(lieu)}
              </option>
            ))}
          </select>
        </label>
        <p className="text-muted-foreground -mt-2 text-xs">
          {t("intervention.deduit_du_lieu")}
        </p>

        <Choix
          nom="type"
          libelle={t("intervention.type")}
          valeurs={TYPES_INTERVENTION}
          prefixe="type_intervention"
        />
        <Choix
          nom="priorite"
          libelle={t("intervention.priorite")}
          valeurs={PRIORITES}
          prefixe="priorite"
          defaut="p3"
        />
        <Choix
          nom="mode_valorisation"
          libelle={t("intervention.mode_valorisation")}
          valeurs={MODES_VALORISATION}
          prefixe="mode_valorisation"
          defaut="temps_passe"
        />

        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {t("intervention.date")}
          <input
            name="date_planifiee"
            type="date"
            className="border-input bg-background rounded-md border px-3 py-2 font-normal"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {t("intervention.technicien")}
          <input
            name="technicien_id"
            type="text"
            className="border-input bg-background rounded-md border px-3 py-2 font-normal"
          />
        </label>

        <Button type="submit">{t("intervention.action.creer")}</Button>
      </form>
    </main>
  );
}

/** Le lieu, nommé par son client puis par lui-même. */
function libelleDuLieu(lieu: {
  libelle: string;
  client: { raison_sociale: string };
}): string {
  return `${lieu.client.raison_sociale} — ${lieu.libelle}`;
}

function Choix({
  nom,
  libelle,
  valeurs,
  prefixe,
  defaut,
}: {
  nom: string;
  libelle: string;
  valeurs: readonly string[];
  prefixe: string;
  defaut?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium">
      {libelle}
      <select
        name={nom}
        defaultValue={defaut}
        className="border-input bg-background rounded-md border px-3 py-2 font-normal"
      >
        {valeurs.map((valeur) => {
          const cle = `${prefixe}.${valeur}`;
          return (
            <option key={valeur} value={valeur}>
              {estCleTraduction(cle) ? t(cle) : valeur}
            </option>
          );
        })}
      </select>
    </label>
  );
}
