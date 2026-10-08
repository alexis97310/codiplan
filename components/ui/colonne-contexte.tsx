/**
 * LA COLONNE DE CONTEXTE — GÉNÉRIQUE (9EE-TP-UX4-1-FICHE-INTERVENTION-2) :
 * un simple conteneur collant, sans aucun contenu propre (`children` seul),
 * pour que la fiche site (9EF-1, à venir) la reprenne avec SA propre carte
 * de contexte plutôt que de recopier la mise en page.
 *
 * **Jamais un `<aside>`** — la fiche qui l'emploie porte déjà le SIEN pour
 * ses actions ; un second `<aside>` dans `<main>` casserait tout sélecteur
 * `main aside` qui suppose qu'il n'y en a qu'un.
 *
 * `lg:sticky`, décalée sous le bandeau fixe du bureau (64 px) — même repère
 * que la carte QR de `app/(back-office)/parc/[id]/page.tsx`. Pleine largeur
 * et remise dans le flux normal sous ce seuil, APRÈS le contenu principal
 * dans l'ordre du document.
 */
export function ColonneContexte({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex flex-col gap-4 lg:sticky lg:top-[88px] lg:self-start">
      {children}
    </div>
  );
}
