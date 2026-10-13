"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Icone } from "@/components/ui/icone";
import { t } from "@/lib/i18n/fr";

/**
 * LE MENU « ⋯ » GÉNÉRIQUE (9ES-TP-UX4-3-FICHE-GESTES-1, décision n° 63
 * d'Alexis du 08/10/2026) — le patron derrière le menu « Plus d'actions » de
 * l'en-tête de la fiche intervention (maquette, `icon: "more"`).
 *
 * **Même patron qu'un menu déjà existant** (`MenuCreer`,
 * `components/navigation/menu-creer.tsx`) : Escape et le clic hors du menu
 * le ferment, posés à la main parce que CE menu n'est PAS un `<dialog>`
 * (contrairement à `Dialogue`) — un `role="menu"` ordinaire, pour qu'un
 * geste de ce menu puisse ensuite ouvrir un vrai dialogue sans l'imbriquer
 * dans un `<dialog>` déjà ouvert.
 *
 * **`children`, jamais un render prop** (DÉFAUT mesuré par le pilote sur le
 * serveur de test, 9ES-TP-UX4-3-FICHE-GESTES-1) : la fiche qui pose ce menu
 * est un COMPOSANT SERVEUR, et React ne laisse jamais passer une FONCTION
 * d'un composant serveur à un composant client (seule une Server Action,
 * marquée `"use server"`, le peut) — React échouait au rendu, « Functions
 * cannot be passed directly to Client Components ». Les entrées restent
 * laissées à l'appelant, mais comme de vrais éléments déjà composés ; celles
 * qui doivent refermer le menu (« Annuler… ») lisent `useFermerMenuPlus`
 * plutôt que de recevoir `fermer` en argument.
 *
 * **↑/↓ déplacent le focus d'une entrée à l'autre, avec rebouclage** (solde
 * 181, 9EW-SOLDE-DIALOGUES-FICHE) — `ArrowDown` depuis la dernière entrée (ou
 * depuis le bouton « ⋯ » lui-même, juste après l'ouverture) revient à la
 * première ; `ArrowUp` depuis la première revient à la dernière. Lues parmi
 * `[role="menuitem"]`, jamais une liste fixe : ce menu n'en connaît jamais le
 * nombre à l'avance (`children` composés par l'appelant).
 *
 * **Jamais capturées hors de ce menu** (régression 9EWA1-CORRECTIF-FLECHES-
 * MENU-DIALOGUE, publiée en production par erreur dans 9EW) — les dialogues
 * « Annuler… » et « Changer de technicien… » s'ouvrent DEPUIS ce menu et
 * vivent dans son conteneur (un `<dialog>` n'a pas besoin d'être porté
 * ailleurs dans le DOM pour `showModal()`) : l'écouteur, posé sur `document`,
 * avalait leurs ↑/↓ même une fois le focus dans le `<textarea>` du motif ou
 * le `<select>` du technicien. Trois gardes, dans l'ordre : un `dialog[open]`
 * existe quelque part dans le document (ce menu n'ouvre jamais lui-même de
 * second menu PAR-DESSUS un dialogue, donc un dialogue ouvert ne peut venir
 * que de ses propres entrées) ; le focus (`document.activeElement`, jamais
 * `evenement.target` — un clavier cible toujours l'élément actif, mais les
 * épreuves de ce fichier déclenchent l'évènement sur `document` lui-même)
 * n'est pas dans CE conteneur ; le focus est un champ de saisie
 * (`input`/`textarea`/`select`/`[contenteditable]`) — ce dernier cas ne
 * couvre aujourd'hui aucune situation que le premier ne couvre déjà (aucune
 * entrée de ce menu n'est elle-même un champ), posé par anticipation.
 */
function estUnChampDeSaisie(element: Node | null): boolean {
  if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement
  ) {
    return true;
  }
  return element instanceof HTMLElement && element.isContentEditable;
}
const ContexteFermerMenuPlus = createContext<(() => void) | null>(null);

/**
 * LE `fermer` DU MENU « ⋯ » QUI ENTOURE CE COMPOSANT, S'IL Y EN A UN — une
 * fonction qui ne fait rien hors d'un `MenuPlus` (un déclencheur de dialogue
 * réutilisé ailleurs, sans menu autour, reste alors sans effet plutôt qu'en
 * erreur).
 */
export function useFermerMenuPlus(): () => void {
  const fermer = useContext(ContexteFermerMenuPlus);
  return fermer ?? (() => {});
}

export function MenuPlus({
  children,
}: Readonly<{
  readonly children: ReactNode;
}>) {
  const [ouvert, setOuvert] = useState(false);
  const conteneurRef = useRef<HTMLDivElement | null>(null);
  const boutonRef = useRef<HTMLButtonElement | null>(null);

  // FERME ET REND LE FOCUS AU BOUTON « ⋯ » (solde 164, 9EU-SOLDE-FICHE-
  // PLANNING) — par Escape, OU par la fermeture d'un dialogue ouvert DEPUIS
  // ce menu (`ContexteFermerMenuPlus`, lu par `useFermerMenuPlus`) : dans ce
  // second cas, l'élément qui avait le focus au moment du `showModal()` (le
  // menuitem cliqué) est démonté avec le menu, et le focus NATIF du
  // `<dialog>` qui se ferme retomberait sur `<body>` faute de mieux. Jamais
  // posé sur le clic extérieur : cliquer ailleurs donne déjà le focus à ce
  // qui a été cliqué, le reprendre ici l'écraserait.
  function fermerEtRendreFocus(): void {
    setOuvert(false);
    // DIFFÉRÉ (`setTimeout`, jamais synchrone) : quand ce menu entoure un
    // `Dialogue` qui se ferme, Échap fait tourner DEUX restaurations de
    // focus concurrentes — la nôtre, posée ici, et celle, NATIVE, du
    // `<dialog>` qui se ferme (HTML §4.11.4, « closing the dialog » restaure
    // le focus sur l'élément qui l'avait AVANT `showModal()`, ici le
    // `menuitem` cliqué). La native tourne APRÈS l'évènement `close` qui
    // déclenche cette fonction — un appel synchrone ici perdrait toujours
    // contre elle, puis le `menuitem` restauré serait démonté par ce même
    // `setOuvert(false)` et le focus retomberait sur `<body>` (le défaut
    // mesuré, solde 164). Reporté d'un tour de boucle, cet appel s'exécute
    // APRÈS la restauration native ET après le démontage du menu.
    setTimeout(() => boutonRef.current?.focus(), 0);
  }

  useEffect(() => {
    if (!ouvert) {
      return;
    }
    function surClicExterieur(evenement: MouseEvent): void {
      if (!conteneurRef.current?.contains(evenement.target as Node)) {
        setOuvert(false);
      }
    }
    function surTouche(evenement: KeyboardEvent): void {
      if (evenement.key === "Escape") {
        // UN DIALOGUE OUVERT DEPUIS CE MENU GÈRE SON PROPRE ÉCHAP (régression
        // 9EWA1-CORRECTIF-FLECHES-MENU-DIALOGUE) — fermer ICI, à l'aveugle,
        // démontait le dialogue EN MÊME TEMPS que son évènement natif
        // `cancel` pouvait encore l'empêcher (`components/ui/dialogue.tsx`,
        // champ modifié) : les deux chemins voulaient fermer, jusqu'à ce que
        // `cancel` puisse refuser. Laisser le dialogue décider — sa
        // fermeture, native ou non, appelle déjà `auFermer` (`useFermerMenuPlus`),
        // qui referme ce menu par le chemin existant.
        if (document.querySelector("dialog[open]") !== null) {
          return;
        }
        fermerEtRendreFocus();
        return;
      }
      if (evenement.key !== "ArrowDown" && evenement.key !== "ArrowUp") {
        return;
      }
      if (document.querySelector("dialog[open]") !== null) {
        return;
      }
      const focus = document.activeElement;
      if (!(focus instanceof Node) || !conteneurRef.current?.contains(focus)) {
        return;
      }
      if (estUnChampDeSaisie(focus)) {
        return;
      }
      const entrees = Array.from(
        conteneurRef.current?.querySelectorAll<HTMLElement>(
          '[role="menuitem"]',
        ) ?? [],
      );
      if (entrees.length === 0) {
        return;
      }
      evenement.preventDefault();
      const indexActuel = entrees.indexOf(
        document.activeElement as HTMLElement,
      );
      const indexSuivant =
        evenement.key === "ArrowDown"
          ? indexActuel === -1
            ? 0
            : (indexActuel + 1) % entrees.length
          : indexActuel === -1
            ? entrees.length - 1
            : (indexActuel - 1 + entrees.length) % entrees.length;
      entrees[indexSuivant]?.focus();
    }
    document.addEventListener("mousedown", surClicExterieur);
    document.addEventListener("keydown", surTouche);
    return () => {
      document.removeEventListener("mousedown", surClicExterieur);
      document.removeEventListener("keydown", surTouche);
    };
  }, [ouvert]);

  return (
    <div ref={conteneurRef} className="relative shrink-0">
      <Button
        ref={boutonRef}
        type="button"
        variant="outline"
        size="icon"
        aria-label={t("ui.menu_plus.titre")}
        aria-haspopup="menu"
        aria-expanded={ouvert}
        onClick={() => setOuvert((v) => !v)}
      >
        <Icone nom="more" taille={18} />
      </Button>
      {!ouvert ? null : (
        <div
          role="menu"
          aria-label={t("ui.menu_plus.titre")}
          className="border-app-bord bg-app-surface absolute top-full right-0 z-40 mt-1.5 w-[220px] rounded-lg border p-1.5 shadow-xl"
        >
          <ContexteFermerMenuPlus.Provider value={fermerEtRendreFocus}>
            {children}
          </ContexteFermerMenuPlus.Provider>
        </div>
      )}
    </div>
  );
}
