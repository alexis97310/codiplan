import { lireSante, type Reponse } from "@/lib/db/sante";
import { t } from "@/lib/i18n/fr";

/**
 * LA PAGE DE SANTÉ — sans compte, à la charte, et elle ne tombe jamais.
 *
 * ## Le jumeau qui compte est le sien
 *
 * *Avec une base injoignable, la page s'affiche quand même et dit « non ». Elle
 * ne rend pas une 500.* C'est le contrat, et c'est ce qui distingue une sonde
 * d'un symptôme : **une sonde qui tombe en même temps que ce qu'elle surveille
 * ne surveille rien.** Tout le travail est fait par `lib/db/sante.ts`, qui ne
 * lève jamais ; cette page ne fait que rendre ce qu'il dit.
 *
 * ## Ce qu'elle ne dit jamais
 *
 * Ni adresse, ni nom d'hôte, ni nom de base, ni identifiant, ni mot de passe.
 * Elle est **sans compte**, donc lisible par n'importe qui : un message d'erreur
 * est un canal d'information, soumis au cloisonnement comme une requête (D50).
 * Le message brut d'un pilote PostgreSQL nomme l'hébergeur et la région ; il est
 * réécrit avant d'arriver ici.
 *
 * `force-dynamic` : une page de santé mise en cache dirait l'état d'hier.
 */
export const dynamic = "force-dynamic";

export default async function PageSante() {
  const etat = await lireSante();
  const toutVaBien =
    etat.baseJointe.ok && etat.roleApplicatif.ok && etat.migrations.ok;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-6 px-6 py-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("sante.titre")}
        </h1>
        <p className="text-muted-foreground text-sm">{t("sante.sous_titre")}</p>
      </header>

      <p
        role="status"
        className={`rounded-md border px-3 py-2 text-sm ${
          toutVaBien
            ? "border-border"
            : "border-destructive text-destructive"
        }`}
      >
        {toutVaBien ? t("sante.tout_va_bien") : t("sante.quelque_chose_cloche")}
      </p>

      <dl className="flex flex-col gap-3 text-sm">
        <LigneReponse libelle={t("sante.base")} reponse={etat.baseJointe} />
        <LigneReponse
          libelle={t("sante.role")}
          reponse={etat.roleApplicatif}
          note={t("sante.role_explication")}
        />
        <LigneReponse
          libelle={t("sante.migrations")}
          reponse={etat.migrations}
          note={
            etat.migrations.ok || etat.migrations.detail === null
              ? undefined
              : `${t("sante.migration_manquante")} : ${etat.migrations.detail}`
          }
        />
        <LigneNombre libelle={t("sante.societes")} valeur={etat.societes} />
        <LigneNombre libelle={t("sante.comptes")} valeur={etat.comptes} />
      </dl>
    </main>
  );
}

function LigneReponse({
  libelle,
  reponse,
  note,
}: {
  libelle: string;
  reponse: Reponse;
  note?: string;
}) {
  return (
    <div className="border-border flex flex-col gap-1 rounded-md border px-3 py-2">
      <div className="flex items-baseline justify-between gap-4">
        <dt>{libelle}</dt>
        <dd
          className={`font-medium ${reponse.ok ? "" : "text-destructive"}`}
        >
          {reponse.ok ? t("sante.oui") : t("sante.non")}
        </dd>
      </div>
      {note === undefined ? null : (
        <p className="text-muted-foreground text-xs">{note}</p>
      )}
      {reponse.detail === null || reponse.ok ? null : (
        <p className="text-destructive text-xs">{reponse.detail}</p>
      )}
    </div>
  );
}

function LigneNombre({
  libelle,
  valeur,
}: {
  libelle: string;
  valeur: number | null;
}) {
  return (
    <div className="border-border flex items-baseline justify-between gap-4 rounded-md border px-3 py-2">
      <dt>{libelle}</dt>
      <dd className="font-medium">
        {valeur === null ? t("sante.inconnu") : String(valeur)}
      </dd>
    </div>
  );
}
