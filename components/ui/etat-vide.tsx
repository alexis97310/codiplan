/**
 * L'ÉTAT VIDE — dire « rien », plutôt que de le laisser deviner (AT-04).
 *
 * ## La maquette est MUETTE sur ce cas, et c'est écrit plutôt que tu
 *
 * Ses écrans sont peuplés de données de démonstration : elle ne montre jamais
 * un tableau, une carte ou une liste sans rien à y mettre. *« Ce qu'elle ne
 * dit pas reste libre »* (§1) — la forme retenue ici reprend le seul jeton
 * qu'elle porte pour un texte secondaire, `.muted{color:var(--gris);
 * font-size:12px}`, et l'étend en un bloc centré : un jugement, pas une
 * lecture, et il est écrit comme tel plutôt que confronté par un gardien qui
 * n'aurait rien à lire.
 *
 * ## Pourquoi un composant à part de `LignePleine`
 *
 * `LignePleine` (`components/ui/tableau.tsx`) dit « rien » À L'INTÉRIEUR d'un
 * tableau — une `<tr>` qui occupe toutes ses colonnes. Cette carte-ci dit
 * « rien » LÀ OÙ IL N'Y A PAS DE TABLEAU DU TOUT : une famille sans modèle, un
 * parc sans recherche encore lancée. *Les deux répondent à la même question —
 * « le vide est-il une absence de données ou une panne d'affichage ? » — dans
 * deux structures HTML qui ne peuvent pas partager une balise*, exactement la
 * raison pour laquelle `Tableau` refuse déjà de rembourrer son contenu.
 */
export function EtatVide({
  children,
  action,
}: Readonly<{
  children: React.ReactNode;
  /** Un lien vers ce qui lèverait le vide — jamais un bouton qui écrit ici. */
  action?: React.ReactNode;
}>) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
      <p className="text-app-encre-faible text-[12px]">{children}</p>
      {action === undefined ? null : action}
    </div>
  );
}
