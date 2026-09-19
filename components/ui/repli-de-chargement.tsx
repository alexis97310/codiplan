import { t } from "@/lib/i18n/fr";

/**
 * LE REPLI DE CHARGEMENT D'UN ÉCRAN — jamais de la racine (AV-11).
 *
 * ## Ce qu'il ne faut jamais recommencer, et pourquoi ce composant existe
 *
 * `app/loading.tsx` a existé, a couvert TOUT `{children}` de la mise en page
 * racine — barre de navigation comprise — dans une seule frontière, et cette
 * frontière est restée bloquée sur « Chargement… » en production (mesuré le
 * 17/09/2026, voir `scripts/lib/verdict-deploiement.ts`). Il a été retiré, et
 * ce composant ne revient PAS à la racine : il n'est posé que dans des
 * répertoires de PAGE, jamais dans un répertoire qui porte une mise en page
 * (`tests/unit/app/repli-de-chargement.test.tsx` tient les deux sens).
 *
 * ## Ce qu'il ne fait jamais, pour ne jamais être lui-même la cause d'un blocage
 *
 * **Il est SYNCHRONE et STATIQUE.** Aucune lecture, aucune attente, aucun
 * `async` : un repli qui ferait lui-même une lecture ne pourrait jamais
 * garantir sa propre fin, ce qui est exactement le défaut que ce ticket
 * répare. Il ne pose qu'un texte du dictionnaire, déjà écrit pour cet usage
 * et resté sans appelant depuis le retrait de la racine.
 *
 * `role="status"` et `aria-live="polite"` : un lecteur d'écran l'annonce sans
 * interrompre ce qu'il lisait déjà, la même discipline que pour une erreur
 * (D50 encore, côté accessibilité plutôt que cloisonnement).
 */
export function RepliDeChargement() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-[50vh] items-center justify-center px-5 py-16"
    >
      <p className="text-app-encre-faible text-[13px]">
        {t("etat.chargement")}
      </p>
    </div>
  );
}
