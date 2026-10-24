import { Carte } from "@/components/ui/carte";

/**
 * UNE SECTION NUMÉROTÉE DE FORMULAIRE (TP-UX5-1-FORMULAIRES, maquette du
 * 28/09) — `<span class="step-no">1</span>Qui et où` : une pastille et un
 * titre, jamais recopiés à la main par chaque écran qui en a besoin.
 *
 * `numero` est FACULTATIF (9EK-TP-UX5-2-CREATIONS-1) — une section qui ne
 * compte pas d'étapes (« Identité », sur `/clients/nouveau`) rend son titre
 * SANS pastille, plutôt que d'inventer un numéro qui ne correspond à rien.
 *
 * **L'ENCADRÉ BLANC (audit du 21/10/2026, 9G9A)** — `docs/audits/9F6/ecrans/
 * clients-nouveau` et `interventions-nouvelle` dessinent chaque section DANS
 * une carte blanche, jamais flottante sur le fond gris ; c'est déjà la forme
 * de `formulaire-machine.tsx` en MODIFICATION. `SectionFormulaire` porte
 * désormais la même carte que le reste du dépôt (`Carte`, 9G9D,
 * 25/10/2026) plutôt qu'un fond/bordure recopiés à la main — le titre, lui,
 * reste écrit ici : sa pastille numérotée n'a pas d'équivalent dans l'en-tête
 * de `Carte`. **Écart assumé, nommé plutôt que caché** : quand un formulaire
 * enchaîne plusieurs `SectionFormulaire`, la maquette les dessine dans UNE
 * SEULE carte continue ; poser la carte ICI, au niveau du composant plutôt
 * que du formulaire appelant, en fait une carte PAR section (empilées avec
 * un espace entre elles) — jamais de contenu nu, au prix d'une carte
 * continue qui redevient plusieurs.
 */
export function SectionFormulaire({
  numero,
  titre,
  children,
}: Readonly<{
  numero?: number;
  titre: string;
  children: React.ReactNode;
}>) {
  return (
    <Carte className="flex flex-col gap-4 px-4 py-4">
      <h2 className="flex items-center gap-2 text-15 font-bold">
        {numero === undefined ? null : (
          <span className="bg-app-marque text-app-marque-encre flex h-6 w-6 flex-none items-center justify-center rounded-full text-12 font-extrabold">
            {numero}
          </span>
        )}
        {titre}
      </h2>
      {children}
    </Carte>
  );
}
