import Link from "next/link";

import { Carte } from "@/components/ui/carte";
import { t } from "@/lib/i18n/fr";

/**
 * « JOURNAL D'AUJOURD'HUI » — direction, administrateur (`journalCard`,
 * maquette :2845-2848 ; I8, D32 ; 9EG-TP-UX6-TABLEAU-DE-BORD-2).
 *
 * `LIGNES_JOURNAL = 5` (décision 27 d'Alexis du 05/10/2026) : les cinq
 * dernières écritures, puis « N écritures aujourd'hui ». **Aucun lien vers
 * un « journal complet »** — aucune page ni route de ce nom n'existe sur ce
 * dépôt (voir la passation).
 */
export type LigneJournalAffichee = {
  readonly id: string;
  readonly heure: string;
  readonly texte: string;
  readonly auteur: string;
  readonly href: string | undefined;
};

export function BlocJournal({
  lignes,
  compteLibelle,
}: Readonly<{
  lignes: readonly LigneJournalAffichee[];
  compteLibelle: string;
}>) {
  return (
    <Carte titre={t("tableau_de_bord.journal_titre")} icone="history">
      <div data-bloc="journal-liste">
        {lignes.length === 0 ? (
          <p className="text-app-encre-faible px-[16px] py-[15px] text-13 font-bold">
            {t("tableau_de_bord.journal_vide")}
          </p>
        ) : (
          lignes.map((ligne) =>
            ligne.href === undefined ? (
              <div
                key={ligne.id}
                className="border-app-bord flex items-center gap-[10px] border-b px-[16px] py-[10px] text-13 font-bold last:border-b-0"
              >
                <span className="text-app-encre-faible shrink-0 font-mono text-12 font-bold">
                  {ligne.heure}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {ligne.texte}
                  {t("ponctuation.point_median")}
                  {ligne.auteur}
                </span>
              </div>
            ) : (
              <Link
                key={ligne.id}
                href={ligne.href}
                className="border-app-bord flex items-center gap-[10px] border-b px-[16px] py-[10px] text-13 font-bold last:border-b-0"
              >
                <span className="text-app-encre-faible shrink-0 font-mono text-12 font-bold">
                  {ligne.heure}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {ligne.texte}
                  {t("ponctuation.point_median")}
                  {ligne.auteur}
                </span>
              </Link>
            ),
          )
        )}
      </div>
      <p className="text-app-encre-faible border-app-bord border-t px-[16px] py-[10px] text-12 font-bold">
        {compteLibelle}
      </p>
    </Carte>
  );
}
