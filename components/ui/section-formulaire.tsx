/**
 * UNE SECTION NUMÉROTÉE DE FORMULAIRE (TP-UX5-1-FORMULAIRES, maquette du
 * 28/09) — `<span class="step-no">1</span>Qui et où` : une pastille et un
 * titre, jamais recopiés à la main par chaque écran qui en a besoin.
 *
 * `numero` est FACULTATIF (9EK-TP-UX5-2-CREATIONS-1) — une section qui ne
 * compte pas d'étapes (« Identité », sur `/clients/nouveau`) rend son titre
 * SANS pastille, plutôt que d'inventer un numéro qui ne correspond à rien.
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
    <section className="flex flex-col gap-4">
      <h2 className="flex items-center gap-2 text-15 font-bold">
        {numero === undefined ? null : (
          <span className="bg-app-marque text-app-marque-encre flex h-6 w-6 flex-none items-center justify-center rounded-full text-12 font-extrabold">
            {numero}
          </span>
        )}
        {titre}
      </h2>
      {children}
    </section>
  );
}
