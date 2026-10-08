import { t } from "@/lib/i18n/fr";
import { cn } from "@/lib/utils";

/**
 * LA FRISE D'ÉTAPES DE LA FICHE INTERVENTION (D8, `stepper` de la maquette
 * du 28/09, :1841 ; 9EE-TP-UX4-1-FICHE-INTERVENTION-1) — où en est
 * l'intervention, d'un regard.
 *
 * GÉNÉRIQUE : ce composant ne connaît aucun statut d'intervention — il
 * reçoit des ÉTAPES déjà nommées et déjà traduites (`etapesDeLIntervention`,
 * `app/(back-office)/interventions/presentation.ts`, compose la liste ;
 * l'appelant traduit chaque clé avant de la poser ici), comme tous les
 * composants de `components/ui/`.
 *
 * Sous 901 px, la frise au trait ne tient pas : une seule ligne, « Étape N
 * sur TOTAL · libellé », et une jauge.
 */
export type EtatEtapeFrise = "faite" | "courante" | "arretee" | "a_venir";

export type EtapeFrise = {
  readonly cle: string;
  readonly libelle: string;
  readonly etat: EtatEtapeFrise;
  /** « (suspendue) » — seulement sur l'étape ARRÊTÉE. */
  readonly precision?: string;
};

const CLASSES_BARRE: Record<EtatEtapeFrise, string> = {
  faite: "bg-app-vert-plein",
  courante: "bg-app-bleu-plein",
  arretee: "bg-app-orange-bord",
  a_venir: "bg-app-bord",
};

const CLASSES_LIBELLE: Record<EtatEtapeFrise, string> = {
  faite: "text-app-encre font-bold",
  courante: "text-app-encre font-bold",
  arretee: "text-app-orange-encre font-bold",
  a_venir: "text-app-encre-faible font-bold",
};

/** « (suspendue) » — le signe de ponctuation vient du dictionnaire (L0-11). */
function entreParentheses(texte: string | undefined): string | null {
  if (texte === undefined) {
    return null;
  }
  return `${t("ponctuation.parenthese_ouvrante")}${texte}${t(
    "ponctuation.parenthese_fermante",
  )}`;
}

export function FriseEtapes({
  etapes,
  etapeSur,
  separateur,
  className,
}: Readonly<{
  etapes: readonly EtapeFrise[];
  /** « Étape N sur TOTAL » — le préfixe et le mot « sur », déjà traduits. */
  etapeSur: { readonly prefixe: string; readonly milieu: string };
  /** Le séparateur entre « Étape N sur TOTAL » et le libellé — déjà traduit. */
  separateur: string;
  className?: string;
}>) {
  if (etapes.length === 0) {
    return null;
  }
  const indexCourant = etapes.findIndex(
    (etape) => etape.etat === "courante" || etape.etat === "arretee",
  );
  const courante = indexCourant === -1 ? etapes[0]! : etapes[indexCourant]!;
  const rang = indexCourant === -1 ? 1 : indexCourant + 1;
  return (
    <nav aria-label={courante.libelle} className={className}>
      <ol
        role="list"
        className="hidden min-[901px]:flex min-[901px]:items-start min-[901px]:gap-2"
      >
        {etapes.map((etape) => (
          <li
            key={etape.cle}
            role="listitem"
            aria-current={
              etape.etat === "courante" || etape.etat === "arretee"
                ? "step"
                : undefined
            }
            className="flex flex-1 flex-col gap-1.5"
          >
            <div
              className={cn("h-1.5 rounded-full", CLASSES_BARRE[etape.etat])}
            />
            <span
              className={cn("text-12 font-bold", CLASSES_LIBELLE[etape.etat])}
            >
              {etape.libelle}
              {entreParentheses(etape.precision)}
            </span>
          </li>
        ))}
      </ol>
      <div className="flex flex-col gap-1.5 min-[901px]:hidden">
        <span className="text-12 font-bold">
          {etapeSur.prefixe} {rang} {etapeSur.milieu} {etapes.length}
          {separateur}
          {courante.libelle}
          {entreParentheses(courante.precision)}
        </span>
        <div className="bg-app-bord h-1.5 rounded-full">
          <div
            className="bg-app-bleu-plein h-1.5 rounded-full"
            style={{ width: `${(rang / etapes.length) * 100}%` }}
          />
        </div>
      </div>
    </nav>
  );
}
