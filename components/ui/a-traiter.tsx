import Link from "next/link";

import { type TonMessage } from "@/lib/theme/statuts";
import { CLASSES_LIEN } from "@/lib/theme/apparence";
import { cn } from "@/lib/utils";

/** La pastille de la ligne — même familles que `CLASSES_TON`, aucun jeton neuf. */
const CLASSES_PASTILLE: Record<TonMessage, string> = {
  succes: "bg-app-vert-bord",
  avertissement: "bg-app-orange-bord",
  refus: "bg-app-rouge-bord",
};

/**
 * LE BLOC « À TRAITER » (9EE-TP-UX4-1-FICHE-INTERVENTION-1 ; premier
 * appelant réel : TP-UX4-2, fiches client et site) — une carte titrée, des
 * lignes cliquables, et une borne de décompte fournie par l'appelant.
 *
 * **Ce composant ne choisit RIEN** : ni la population des lignes, ni la
 * borne, ni le lien « Les N … » — tout est fourni déjà composé, comme
 * `LigneResume` ou `Kpi` le font déjà pour un décompte du tableau de bord.
 * Il n'ouvre aucune lecture, aucune base.
 *
 * **La ligne entière ouvre sa destination** — même mécanique que
 * `CarteEntite` (`components/ui/carte-entite.tsx`) : un seul `<a>`, posé sur
 * le titre, étendu à toute la ligne par un `::after` étiré en
 * `absolute inset-0` sur son ancêtre `relative`, jamais un second lien
 * superposé.
 */
export type LigneATraiter = {
  readonly id: string;
  readonly ton: TonMessage;
  readonly titre: string;
  readonly detail?: string;
  readonly href: string;
};

export function BlocATraiter({
  titre,
  lignes,
  lienVoirPlus,
  className,
}: Readonly<{
  titre: string;
  lignes: readonly LigneATraiter[];
  /** « Les N … » — absent, aucun lien. */
  lienVoirPlus?: { readonly href: string; readonly libelle: string };
  className?: string;
}>) {
  return (
    <section
      className={cn(
        "bg-app-surface border-app-bord flex flex-col gap-3 rounded-lg border px-4 py-3.5",
        className,
      )}
    >
      <h2 className="text-[13px] font-bold">{titre}</h2>
      <ul role="list" className="flex flex-col gap-3">
        {lignes.map((ligne) => (
          <li
            key={ligne.id}
            className="relative flex items-start gap-2.5 text-13 font-bold"
          >
            <span
              aria-hidden="true"
              className={cn(
                "mt-1.5 size-2 shrink-0 rounded-full",
                CLASSES_PASTILLE[ligne.ton],
              )}
            />
            <span className="min-w-0 flex-1">
              <Link
                href={ligne.href}
                className={cn(CLASSES_LIEN, "after:absolute after:inset-0")}
              >
                {ligne.titre}
              </Link>
              {ligne.detail === undefined ? null : (
                <span className="text-app-encre-faible block text-12 font-bold">
                  {ligne.detail}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
      {lienVoirPlus === undefined ? null : (
        <Link href={lienVoirPlus.href} className={CLASSES_LIEN}>
          {lienVoirPlus.libelle}
        </Link>
      )}
    </section>
  );
}
