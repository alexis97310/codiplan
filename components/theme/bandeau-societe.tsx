import { t } from "@/lib/i18n/fr";
import type { ThemeSociete } from "@/lib/theme/theme";

/**
 * Bandeau d'identité de la société active (ticket L0-09).
 *
 * Il ne connaît aucune couleur : il nomme les variables posées par le serveur.
 * Basculer de société change donc son rendu sans qu'une ligne de ce fichier
 * bouge — c'est exactement le critère d'acceptation du ticket.
 *
 * L'encre est celle que `lib/theme/contraste.ts` a CALCULÉE pour ce fond : sur
 * un jaune pâle elle est noire, sur un bleu profond elle est blanche. Le texte
 * reste lisible quelle que soit la couleur choisie par le client, et la règle
 * qui le garantit est un rapport de contraste d'au moins 4,5:1.
 *
 * Le logo de société est hors périmètre du ticket — il suppose un stockage de
 * fichiers — et rien ici ne l'empêche : il viendrait se poser devant le nom,
 * lu depuis `societe.logo_url`, sans changer le mécanisme.
 */
export function BandeauSociete({ theme }: { theme: ThemeSociete }) {
  return (
    <div
      data-origine-theme={theme.origine}
      className="bg-societe-primaire text-societe-primaire-encre flex items-center justify-between gap-4 rounded-lg px-4 py-3"
    >
      <span className="text-base font-semibold tracking-tight">
        {theme.nom}
      </span>
      <span className="bg-societe-accent text-societe-accent-encre rounded-md px-2 py-1 text-xs font-medium">
        {t(theme.origine === "defaut" ? "theme.neutre" : "theme.societe")}
      </span>
    </div>
  );
}
