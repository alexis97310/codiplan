"use client";

/**
 * LA LISTE QUI SE SOUMET AU CHANGEMENT (9EH-TP-UX-PL-PLANNING-1, D190,
 * filtres de la maquette du 28/09, `.pf`) — même patron que
 * `components/tableau-de-bord/select-priorites.tsx` : un `<select>` qui
 * appelle `requestSubmit()` sur SON formulaire ancêtre au `change`, jamais un
 * état React. Le filtre reste dans l'URL (le formulaire reste `GET`), et un
 * navigateur sans JavaScript garde le bouton de secours du formulaire.
 */
export function ListeQuiFiltre({
  name,
  defaultValue,
  className,
  children,
}: Readonly<{
  name: string;
  defaultValue: string;
  className?: string;
  children: React.ReactNode;
}>) {
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      onChange={(evenement) => evenement.currentTarget.form?.requestSubmit()}
      className={className}
    >
      {children}
    </select>
  );
}
