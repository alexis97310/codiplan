import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * L'ACTION PRIMAIRE D'UN ÉCRAN — une seule apparence, un seul endroit.
 *
 * ## UNE COULEUR, UN SENS
 *
 * Le bouton d'action primaire portait `bg-app-accent`, c'est-à-dire **le rouge
 * de la marque**. Or ce rouge sert déjà deux fois : *la marque* — la barre, la
 * pastille de société — et *l'alerte* — le statut « en cours », les messages de
 * refus. **Un troisième sens sur la même couleur est une couleur qui ne dit
 * plus rien** : un œil qui voit du rouge partout cesse de le lire comme un
 * signal.
 *
 * L'action primaire prend donc le **bleu plein** — `--app-bleu-plein`, le même
 * jeton que le statut « affectée » et que les bordures de bloc. *Aucune couleur
 * n'est écrite ici* : les jetons vivent dans `app/globals.css`, sous la seule
 * forme qu'une feuille de style admet pour une couleur (D95, `lib/theme/`).
 *
 * ## CE QUE LA MAQUETTE EN DIT, ET CE QU'ELLE N'EN DIT PAS
 *
 * **Elle ne porte AUCUN bouton de création en version bureau.** Ce n'est pas
 * une contradiction avec elle, c'est un **SILENCE** : D95 lui donne foi sur ce
 * qu'elle MONTRE, et *« ce qu'elle ne dit pas reste libre, et un écart s'écrit
 * avec sa mesure et le point précis où elle est muette »*. Le point est celui-ci
 * — il n'existe pas de bouton de création dans la maquette de bureau —, et le
 * choix du bleu se justifie donc par la règle de l'écart, jamais par une
 * imitation.
 *
 * ## POURQUOI UN COMPOSANT PLUTÔT QUE CINQ CORRECTIONS
 *
 * La classe était recopiée à l'identique dans **cinq** écrans. *Une liste close
 * recopiée « pour la lisibilité » devient fausse le jour où la première
 * grandit, sans rougir* (§9, 01/09) — et ici la sixième recopie serait née de la
 * couleur d'avant. `tests/unit/theme/action-primaire.test.ts` refuse désormais
 * qu'un écran écrive cette apparence lui-même.
 */

const APPARENCE =
  "bg-app-bleu-plein text-app-bleu-plein-encre inline-flex w-fit items-center " +
  "justify-center rounded-md px-4 py-2 text-[13px] font-bold";

/** L'action primaire qui SOUMET un formulaire. */
export function ActionPrimaire({
  children,
  className,
  type = "submit",
}: Readonly<{
  children: React.ReactNode;
  className?: string;
  type?: "submit" | "button";
}>) {
  return (
    <button type={type} className={cn(APPARENCE, className)}>
      {children}
    </button>
  );
}

/**
 * L'action primaire qui MÈNE quelque part.
 *
 * Elle partage l'apparence et **pas la balise** : un lien n'est pas un bouton
 * pour un lecteur d'écran, et le rendre comme tel ferait perdre à l'usager la
 * seule information qui compte — *va-t-on quelque part, ou se passe-t-il
 * quelque chose ?*
 */
export function LienPrimaire({
  href,
  children,
  className,
}: Readonly<{
  href: string;
  children: React.ReactNode;
  className?: string;
}>) {
  return (
    <Link href={href} className={cn(APPARENCE, className)}>
      {children}
    </Link>
  );
}
