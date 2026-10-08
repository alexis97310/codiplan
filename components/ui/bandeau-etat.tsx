import { CLASSES_TON, type TonMessage } from "@/lib/theme/statuts";
import { cn } from "@/lib/utils";

/**
 * LE BANDEAU D'ÉTAT DE LA FICHE (9EE-TP-UX4-1-FICHE-INTERVENTION-1) —
 * QUATRE tons, là où `Message` (`components/ui/message.tsx`) n'en porte que
 * trois. La maquette du 28/09 (`alertBox()`, :1836-1839) écrit un ton
 * « information » que `TonMessage` (`lib/theme/statuts.ts`) ne porte pas :
 * ce composant l'ajoute par ses PROPRES jetons `app-bleu-*` — les mêmes que
 * le bandeau de reprise d'import employait déjà en clair — jamais une
 * cinquième couleur.
 *
 * *Quasi-doublon de `Message`, délibérément* : les deux portent un titre en
 * gras suivi d'un texte et un `role` qui suit le ton, mais `Message` sert un
 * ÉVÉNEMENT (succès/avertissement/refus d'un geste qu'on vient de faire) et
 * celui-ci sert un ÉTAT COURANT de la fiche (y compris « tout va bien, en
 * information ») — les fondre aurait ajouté un quatrième ton à un composant
 * dont `TonMessage` est la liste fermée ailleurs dans le dépôt.
 */
export type TonBandeauEtat = TonMessage | "information";

const CLASSES_INFORMATION =
  "border-app-bleu-bord bg-app-bleu-fond text-app-bleu-encre";

function classesDuTon(ton: TonBandeauEtat): string {
  return ton === "information" ? CLASSES_INFORMATION : CLASSES_TON[ton];
}

export function BandeauEtat({
  ton,
  titre,
  texte,
  className,
}: Readonly<{
  ton: TonBandeauEtat;
  titre: string;
  texte?: string;
  className?: string;
}>) {
  return (
    <div
      role={ton === "refus" ? "alert" : "status"}
      className={cn(
        "rounded-md border px-3.5 py-2.5 text-13 font-bold",
        classesDuTon(ton),
        className,
      )}
    >
      <span className="font-bold">{titre}</span>
      {texte === undefined ? null : (
        <span className="font-normal"> {texte}</span>
      )}
    </div>
  );
}
