import Link from "next/link";

import { t } from "@/lib/i18n/fr";

/**
 * LE RETOUR VERS « Sociétés & tarifs » DEPUIS SES NEUF SOUS-PAGES (CG1).
 *
 * Même forme que `agence.retour` (`agences/nouvelle`, `agences/[id]/modifier`) :
 * un lien nu, jamais l'habillage commun des liens visibles (sa liste de
 * porteurs, dans `tests/unit/theme/lien-visible.test.ts`, est fermée par
 * égalité).
 */
export function RetourParametres() {
  return (
    <Link
      href="/parametres"
      className="text-app-encre-faible text-13 font-bold"
    >
      {t("parametres.retour")}
    </Link>
  );
}
