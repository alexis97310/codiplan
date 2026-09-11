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
 *
 * ## CE QUE D95 CHANGE : SA FORME, JAMAIS SON RÔLE
 *
 * Il était un bandeau pleine largeur posé au-dessus du contenu de chaque page.
 * La maquette ne porte pas de bandeau : elle met l'identité de la société dans
 * une PASTILLE, à droite de la barre de navigation (`.socsel`). C'est la forme
 * rendue désormais — et c'est la seule chose qui change. Il nomme toujours les
 * mêmes variables, il ne connaît toujours aucune couleur, et basculer de
 * société change toujours son rendu sans qu'une ligne bouge ici.
 *
 * *Le libellé « charte de la société » / « thème neutre » reste rendu, et il
 * reste utile : c'est lui qui distingue, à l'œil, une société qui a choisi ses
 * couleurs d'une société qui n'en a pas — un état représentable, pas un
 * oubli.*
 */
export function BandeauSociete({ theme }: { theme: ThemeSociete }) {
  return (
    <div
      data-origine-theme={theme.origine}
      className="bg-societe-primaire text-societe-primaire-encre flex items-center gap-2 rounded-md px-3 py-1.5"
    >
      <span className="text-[12.5px] font-bold tracking-tight">
        {theme.nom}
      </span>
      <span className="bg-societe-accent text-societe-accent-encre rounded px-1.5 py-0.5 text-[10px] font-semibold">
        {t(theme.origine === "defaut" ? "theme.neutre" : "theme.societe")}
      </span>
    </div>
  );
}
