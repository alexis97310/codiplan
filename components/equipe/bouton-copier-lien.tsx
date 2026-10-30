"use client";

import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { estCleTraduction, t } from "@/lib/i18n/fr";

type EtatCopie =
  | { readonly etape: "repos" }
  | { readonly etape: "en_cours" }
  | { readonly etape: "copie" }
  | { readonly etape: "a_copier_a_la_main"; readonly url: string }
  | { readonly etape: "refus"; readonly motif: string }
  | { readonly etape: "erreur" };

/**
 * « COPIER LE LIEN D'ACCÈS » (9I6B-LIEN-ACCES-A-COPIER, D170, 29/10/2026) —
 * posé là où l'écran propose déjà « Envoyer »/« Renvoyer le lien d'accès » :
 * sans nom de domaine, Resend refuse le courriel à quiconque n'est pas
 * Alexis — ce bouton reste le SEUL moyen pour l'administrateur de faire
 * parvenir le lien à qui n'est pas lui. **La personne choisit toujours
 * elle-même son mot de passe** : ce composant ne le voit, ni ne le demande,
 * jamais.
 *
 * **L'URL ne vit que dans l'état de CE composant**, le temps de l'écrire au
 * presse-papiers (`navigator.clipboard.writeText`) — jamais dans un attribut
 * DOM persistant, l'historique, ni bien sûr une requête de journal : la
 * route appelée (`action`) la rend en JSON et ne la journalise jamais (voir
 * `lib/auth/lien-d-acces.ts`, `copierLienDAccesPartage`). Si le navigateur
 * refuse le presse-papiers, elle est montrée UNE SEULE FOIS, dans un champ en
 * lecture seule sélectionnable — jamais écrite ailleurs.
 *
 * **Le motif NOMMÉ du refus, affiché** (B5, relecture de 9I6B) — la route
 * rend `{ erreur: resultat.motif }` EN 200 (jamais un code d'échec HTTP : un
 * refus nommé n'est pas une panne) ; ce composant le distingue désormais
 * d'une vraie panne (réseau, presse-papiers mis à part) et affiche le texte
 * propre à CE motif plutôt que « Le lien n'a pas pu être copié. » pour tout.
 * `prefixeMotifRefus` choisit le dictionnaire du bon domaine — technicien ou
 * compte de bureau, dont les motifs ne sont pas tous les mêmes
 * (`cible_protegee`, décision B, D223, n'existe que pour un compte de
 * bureau).
 */
export function BoutonCopierLien({
  action,
  prefixeMotifRefus = "equipe.acces.refus.",
}: Readonly<{
  readonly action: string;
  readonly prefixeMotifRefus?: string;
}>) {
  const [etat, setEtat] = useState<EtatCopie>({ etape: "repos" });
  const idChamp = useId();

  async function copier() {
    setEtat({ etape: "en_cours" });
    let reponse: Response;
    try {
      reponse = await fetch(action, { method: "POST" });
    } catch {
      setEtat({ etape: "erreur" });
      return;
    }
    if (!reponse.ok) {
      setEtat({ etape: "erreur" });
      return;
    }
    const corps: { readonly url?: unknown; readonly erreur?: unknown } =
      await reponse.json();
    if (typeof corps.erreur === "string") {
      setEtat({ etape: "refus", motif: corps.erreur });
      return;
    }
    if (typeof corps.url !== "string" || corps.url === "") {
      setEtat({ etape: "erreur" });
      return;
    }
    try {
      await navigator.clipboard.writeText(corps.url);
      setEtat({ etape: "copie" });
    } catch {
      setEtat({ etape: "a_copier_a_la_main", url: corps.url });
    }
  }

  function libelleRefus(motif: string): string {
    const cle = `${prefixeMotifRefus}${motif}`;
    return estCleTraduction(cle)
      ? t(cle)
      : t("equipe.acces.copier_lien_erreur");
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={etat.etape === "en_cours"}
        onClick={() => void copier()}
      >
        {t("equipe.acces.copier_lien")}
      </Button>
      {etat.etape === "copie" ? (
        <p role="status" className="text-app-encre-faible text-12 font-bold">
          {t("equipe.acces.lien_copie")}
        </p>
      ) : null}
      {etat.etape === "erreur" ? (
        <p role="status" className="text-app-orange-encre text-12 font-bold">
          {t("equipe.acces.copier_lien_erreur")}
        </p>
      ) : null}
      {etat.etape === "refus" ? (
        <p role="status" className="text-app-orange-encre text-12 font-bold">
          {libelleRefus(etat.motif)}
        </p>
      ) : null}
      {etat.etape === "a_copier_a_la_main" ? (
        <div className="flex flex-col gap-1">
          <label
            htmlFor={idChamp}
            className="text-app-encre-faible text-12 font-bold"
          >
            {t("equipe.acces.copier_lien_presse_papiers_indisponible")}
          </label>
          <input
            id={idChamp}
            type="text"
            readOnly
            value={etat.url}
            onFocus={(evenement) => evenement.currentTarget.select()}
            className="border-app-bord bg-app-surface rounded-md border px-2 py-1 text-13 font-bold"
          />
        </div>
      ) : null}
    </div>
  );
}
