import { t } from "@/lib/i18n/fr";

/**
 * LA CHRONOLOGIE — une liste verticale datée, GÉNÉRIQUE
 * (9EE-TP-UX4-1-FICHE-INTERVENTION-2) — EXTRAITE de la fiche intervention
 * (`chronologieDeLaFiche`, `app/(back-office)/interventions/presentation.ts`,
 * inchangée) pour que la fiche site (9EF-1, à venir) la reprenne sur SES
 * propres évènements, sans recopier le rendu.
 *
 * **Les évènements arrivent déjà traduits** — `instant` et `libelle` sont des
 * chaînes prêtes à l'affichage, jamais une clé du dictionnaire ni une `Date` :
 * ce composant ne lit ni fuseau ni dictionnaire métier, il ne fait que
 * mettre en forme ce que l'appelant lui donne (même geste que `Saisie` dans
 * la fiche intervention, qui ne lit ni base ni politique).
 */
export type EvenementAffiche = {
  readonly instant: string;
  readonly libelle: string;
};

export function Chronologie({
  titre,
  evenements,
}: Readonly<{
  titre: string;
  evenements: readonly EvenementAffiche[];
}>) {
  return (
    <section className="bg-app-surface border-app-bord flex flex-col gap-3 rounded-lg border px-4 py-3.5">
      <h2 className="text-[13px] font-bold">{titre}</h2>
      <ol className="flex flex-col gap-1.5 text-13 font-bold">
        {evenements.map((evenement, index) => (
          // Un évènement composé n'a pas d'identifiant propre ; l'ordre affiché est celui du tableau lui-même.
          <li key={index}>
            <span className="text-app-encre-faible">{evenement.instant}</span>
            {t("ponctuation.separateur")}
            {evenement.libelle}
          </li>
        ))}
      </ol>
    </section>
  );
}
