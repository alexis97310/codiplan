import { Button } from "@/components/ui/button";
import { estCleTraduction, t } from "@/lib/i18n/fr";

/**
 * LES TROIS PIÈCES DU PREMIER ÉCRAN (ticket L1-02f).
 *
 * Elles ne connaissent aucune couleur : elles nomment les variables que la mise
 * en page racine a posées depuis la charte de la société active (L0-09).
 * L'encre est celle que `lib/theme/contraste.ts` a CALCULÉE pour ce fond.
 *
 * Elles ne portent non plus **aucune chaîne visible** : tout libellé leur est
 * passé, et vient du dictionnaire. C'est la coupure de L0-11 — ce qu'un humain
 * lit en se servant de l'application passe par `lib/i18n/fr.ts`.
 */

export function Formulaire({
  action,
  titre,
  accroche,
  valider,
  children,
}: {
  action: string;
  titre: string;
  accroche?: string;
  valider: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{titre}</h1>
        {accroche === undefined ? null : (
          <p className="text-muted-foreground text-sm">{accroche}</p>
        )}
      </div>
      {/* `method="post"` sur une route : le formulaire fonctionne sans
          JavaScript, et la réponse porte ses `Set-Cookie` sans qu'aucune couche
          ne s'interpose. */}
      <form action={action} method="post" className="flex flex-col gap-4">
        {children}
        <Button type="submit">{valider}</Button>
      </form>
    </main>
  );
}

export function Champ({
  nom,
  type,
  libelle,
  motif,
}: {
  nom: string;
  type: "text" | "email" | "password";
  libelle: string;
  motif?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium">
      {libelle}
      <input
        name={nom}
        type={type}
        required
        pattern={motif}
        autoComplete={type === "password" ? "current-password" : "on"}
        className="border-input bg-background rounded-md border px-3 py-2 text-sm font-normal"
      />
    </label>
  );
}

/**
 * Un message rendu à l'écran — par sa CLÉ, jamais par son texte.
 *
 * **Le paramètre vient de l'URL, donc de l'extérieur.** Il n'est affiché que
 * s'il désigne une clé du dictionnaire : sans ce filtre, n'importe qui pourrait
 * faire écrire n'importe quoi à la page en forgeant un lien. Une chaîne
 * inconnue n'affiche rien du tout.
 */
export function Message({ motif }: { motif?: string }) {
  if (motif === undefined || !estCleTraduction(motif)) {
    return null;
  }
  return (
    <p
      role="status"
      className="border-input text-muted-foreground rounded-md border px-3 py-2 text-sm"
    >
      {t(motif)}
    </p>
  );
}
