import { Icone, type NomIcone } from "@/components/ui/icone";

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
 *
 * ## `titre` ET `icone` — LA MAQUETTE DU 28/09 N'EST PLUS MUETTE (TP-UX1-3)
 *
 * `.empty` EXISTE désormais dans `maquette-toutes-pages.html` (`empty()`,
 * :1833-1835, :344-348) : une boîte de 48 px (`app-bleu-fond`/`app-marque`,
 * rayon 14 — `--radius-lg`, D124), un TITRE en gras (16 px), puis le texte
 * (`max-width:46ch`). **`titre` reste FACULTATIF, et son absence rend
 * EXACTEMENT le DOM d'avant ce ticket** (`tests/unit/ui/composants-base.test.tsx`
 * le garde) : la maquette n'a jamais dessiné cet état SANS titre, et
 * réinventer une règle pour ce cas serait une lecture, pas une confrontation.
 * `icone` vaut `inbox` par défaut — le même défaut que `empty()`.
 *
 * **LE TEXTE PASSE À 14 PX, GRAISSE 400 (choix du pilote, « laissé au
 * pilote » du 30/09/2026 ; D144)** — `.empty p` n'a pas de taille propre
 * dans la maquette, donc hérite du corps (`body{font:400 14px/1.45}`, :43),
 * et la spécification du 28/09 pose le texte courant à « 14 px, 400 » (§3.2
 * :225). Le 12 px en gras d'avant ce ticket n'était pas une lecture de la
 * maquette : aucune des deux ne dessinait `.empty` à l'époque de ce choix.
 * `EtatVide` n'a encore AUCUN appelant dans `app/` (voir la passation) : ce
 * changement ne déplace aucun écran.
 */
export function EtatVide({
  titre,
  icone = "inbox",
  action,
  children,
}: Readonly<{
  /** Le POURQUOI du vide. Absent, le rendu d'avant ce ticket ne change pas. */
  titre?: string;
  icone?: NomIcone;
  children: React.ReactNode;
  /** Un lien vers ce qui lèverait le vide — jamais un bouton qui écrit ici. */
  action?: React.ReactNode;
}>) {
  if (titre === undefined) {
    return (
      <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
        <p className="text-app-encre-faible text-14">{children}</p>
        {action === undefined ? null : action}
      </div>
    );
  }
  return (
    <div className="px-[20px] py-[36px] text-center">
      <div className="bg-app-bleu-fond text-app-marque mx-auto mb-[12px] flex h-[48px] w-[48px] items-center justify-center rounded-lg">
        <Icone nom={icone} taille={22} />
      </div>
      <b className="text-app-encre mb-[4px] block text-16">{titre}</b>
      <p className="text-app-encre-faible mx-auto max-w-[46ch] text-14">
        {children}
      </p>
      {action === undefined ? null : <div className="mt-[14px]">{action}</div>}
    </div>
  );
}
