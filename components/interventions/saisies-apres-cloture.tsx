import { Carte } from "@/components/ui/carte";
import { type Annuaire } from "@/lib/auth/annuaire";
import { t } from "@/lib/i18n/fr";
import { type SaisieApresClotureAffichee } from "@/lib/interventions/saisie-tardive";

/** Le tiret qu'une identité introuvable affiche — même choix que le reste de la fiche. */
const TIRET = "—";

/**
 * LES SAISIES ARRIVÉES APRÈS LA CLÔTURE (9L14-FIGE-A-LA-CLOTURE, décision
 * d'Alexis du 10/11/2026) — EN LECTURE SEULE, jamais appliquées :
 * `saisiesApresClotureDeLIntervention` (`lib/interventions/saisie-tardive.
 * ts`), la plus ANCIENNE en tête (l'ordre dans lequel le bureau doit les
 * traiter). Visible même VIDE — sa seule présence rappelle que le dossier
 * peut en recevoir.
 *
 * Extrait de `app/(back-office)/interventions/[id]/page.tsx` dans son
 * propre fichier (9L14) : ce composant n'a besoin de rien d'autre que ses
 * props, et la fiche est déjà le plus gros fichier du dépôt (9L04A/9L16A,
 * le plafond mémoire de `pnpm build` se referme sur une accumulation).
 */
export function SaisiesApresCloture({
  saisies,
  annuaire,
  dateAffichee,
}: {
  readonly saisies: readonly SaisieApresClotureAffichee[];
  readonly annuaire: Annuaire;
  /** La date de réception, déjà formatée dans le fuseau de la fiche — jamais un `Date` + un `Fuseau` ici. */
  readonly dateAffichee: (saisie: SaisieApresClotureAffichee) => string;
}) {
  return (
    <Carte titre={t("intervention.saisies_apres_cloture.titre")}>
      <div className="px-4 py-3.5">
        {saisies.length === 0 ? (
          <p className="text-app-encre-faible text-[12px] font-bold">
            {t("intervention.saisies_apres_cloture.aucune")}
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {saisies.map((saisie) => {
              const designation = annuaire(saisie.auteurId);
              const nomAuteur =
                designation.etat === "nom" ? designation.nom : TIRET;
              return (
                <li
                  key={saisie.id}
                  className="border-app-bord flex flex-col gap-1 border-b pb-3 text-13 font-bold last:border-b-0 last:pb-0"
                >
                  <p className="font-semibold">
                    {t(`intervention.saisies_apres_cloture.type.${saisie.type}`)}
                  </p>
                  <p className="text-app-encre-faible">
                    {nomAuteur}
                    {t("ponctuation.separateur")}
                    {dateAffichee(saisie)}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Carte>
  );
}
