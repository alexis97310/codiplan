import Link from "next/link";

import { t } from "@/lib/i18n/fr";
import { CLASSES_LIEN } from "@/lib/theme/apparence";

/**
 * LA LIGNE DE RÉSUMÉ DU REGISTRE — « N interventions · tri : … », PUIS
 * « Effacer les filtres » (TP-UX3-1-REGISTRE-1, §5.3 de la spécification du
 * 28/09/2026) : sous la barre de filtres, au-dessus du tableau.
 *
 * ## Le texte, composé de clés — jamais une phrase écrite ici
 *
 * `nombre`/`libelleUn`/`libellePluriel` et `texteTri` sont déjà résolus par
 * l'appelant (`decompte` de `../presentation.ts`, et la clé de
 * `ordreDuRegistre`, `lib/interventions/ordre-registre.ts`) : ce composant
 * ne fait qu'assembler, avec la même ponctuation que les puces de filtres
 * actifs (`ponctuation.point_median`, `ponctuation.deux_points`) — jamais un
 * séparateur écrit en dur, que le gardien des chaînes visibles (L0-11)
 * refuserait.
 *
 * ## `hrefEffacer` — absent, aucun lien
 *
 * Le lien ne s'affiche que si l'appelant le fournit, c'est-à-dire quand un
 * filtre est RÉELLEMENT actif — la même garde que les puces du registre.
 */
export function LigneResume({
  nombre,
  libelleUn,
  libellePluriel,
  texteTri,
  hrefEffacer,
}: Readonly<{
  nombre: number;
  libelleUn: string;
  libellePluriel: string;
  texteTri: string;
  /** Un filtre est actif. Absent, aucun lien « Effacer les filtres ». */
  hrefEffacer?: string;
}>) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-13 font-bold">
      <span className="text-app-encre-faible">
        <b className="text-app-encre">
          {nombre} {nombre === 1 ? libelleUn : libellePluriel}
        </b>
        {t("ponctuation.point_median")}
        {t("interventions.resume.tri")}
        {t("ponctuation.deux_points")}
        {texteTri}
      </span>
      {hrefEffacer === undefined ? null : (
        <Link href={hrefEffacer} className={CLASSES_LIEN}>
          {t("interventions.puce_tout_effacer")}
        </Link>
      )}
    </div>
  );
}
