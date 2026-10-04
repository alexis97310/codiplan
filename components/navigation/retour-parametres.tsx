import Link from "next/link";

import { t } from "@/lib/i18n/fr";

/**
 * LE RETOUR VERS « Paramètres » DEPUIS SES SOUS-PAGES (CG1 ; renommé QT-21,
 * D167, 05/10/2026, TP-NAV1).
 *
 * Même forme que `agence.retour` (`agences/nouvelle`, `agences/[agenceId]`) :
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
