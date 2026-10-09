import Link from "next/link";

import { Carte } from "@/components/ui/carte";
import { Icone } from "@/components/ui/icone";
import { t, type CleTraduction } from "@/lib/i18n/fr";

/**
 * « DONNÉES À COMPLÉTER » — administrateur de société (`donneesCard`,
 * maquette :2843-2844 ; 9EG-TP-UX6-TABLEAU-DE-BORD-2).
 *
 * Chaque point porte le MÊME texte et le MÊME lien que `/parametres/donnees`
 * (9DT) — `lib/tableau-de-bord/lectures.ts` lit les mêmes fonctions, jamais
 * un second calcul.
 */
export type PointAffiche = {
  readonly cle: CleTraduction;
  readonly compte: number;
  readonly href: string;
};

export function BlocDonneesACompleter({
  points,
}: Readonly<{ points: readonly PointAffiche[] }>) {
  return (
    <Carte
      titre={t("donnees_a_completer.titre")}
      icone="database"
      compte={points.length}
      action={{
        libelle: t("demande.interventions_machine.tout_voir"),
        href: "/parametres/donnees",
      }}
    >
      <div data-bloc="donnees-a-completer-liste">
        {points.map((point) => (
          <Link
            key={point.cle}
            href={point.href}
            className="border-app-bord flex items-center gap-[10px] border-b px-[16px] py-[12px] text-13 font-bold last:border-b-0"
          >
            <span className="bg-app-orange-fond text-app-orange-encre flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-full">
              <Icone nom="alert" taille={16} />
            </span>
            <span className="min-w-0 flex-1 truncate">{t(point.cle)}</span>
            <span className="text-app-encre-faible shrink-0">
              {point.compte}
            </span>
            <Icone nom="chev-r" taille={16} />
          </Link>
        ))}
      </div>
    </Carte>
  );
}
