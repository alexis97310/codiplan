"use client";

import { useId } from "react";

import { Button } from "@/components/ui/button";
import { Dialogue } from "@/components/ui/dialogue";
import { MenuPlus, useFermerMenuPlus } from "@/components/ui/menu-plus";
import { BoutonCopierLien } from "@/components/equipe/bouton-copier-lien";
import { t } from "@/lib/i18n/fr";

import { premierMot } from "./presentation";

/**
 * LE MENU « … » D'UN ACCÈS DÉJÀ ACTIF (point 3, D86, décision n° 86
 * d'Alexis du 13/10/2026 ; maquette `c-acces-menu`/`c-lien`,
 * `maquette-toutes-pages.html:4689-4698`) — un seul geste, « Envoyer un
 * nouveau lien d'accès » (mot de passe oublié) : le cliquet de D65 est
 * sauté POUR CE GESTE SEUL (`lib/auth/lien-d-acces.ts`, `OptionsEnvoiLien`).
 * Le PREMIER envoi garde son refus intact.
 *
 * Partagé entre un technicien et un compte de bureau — seule la route
 * d'action varie (`/api/equipe/<id>/nouveau-lien` ou
 * `/api/equipe/bureau/<id>/nouveau-lien`).
 *
 * **ÉCART NOMMÉ** : `MenuPlus` (`components/ui/menu-plus.tsx`, hors
 * territoire de ce lot) pose un `aria-label` FIXE (« Plus d'actions »),
 * jamais personnalisé par nom — la maquette veut « Autres gestes pour
 * <nom> ». Documenté en passation plutôt que modifié.
 *
 * **« Copier le lien d'accès » (`actionCopier`, 9I6B-LIEN-ACCES-A-COPIER,
 * D170)** — seconde entrée, ajoutée à celle qui existait déjà : sans nom de
 * domaine, personne d'autre qu'Alexis ne reçoit de courriel, et c'est le
 * SEUL moyen de faire parvenir un nouveau lien à qui a déjà un accès actif
 * (mot de passe oublié).
 *
 * **`copieNouveauLienAutorisee` (décision B d'Alexis, 30/10/2026, 9I7D)** —
 * `false` pour un compte de direction ou un autre administrateur de société
 * (`estCibleProtegeeCopieNouveauLien`, `lib/auth/acces-bureau.ts`) : l'entrée
 * « Copier le lien d'accès » disparaît du menu plutôt que d'exposer un
 * bouton que le serveur refuserait quand même. Par défaut `true` — jamais
 * concerné pour un technicien, qui n'a aucun de ces deux rôles.
 */
export function MenuGestesAccesActif({
  nom,
  courriel,
  action,
  actionCopier,
  copieNouveauLienAutorisee = true,
  prefixeMotifRefus = "equipe.acces.refus.",
}: Readonly<{
  readonly nom: string;
  readonly courriel: string;
  readonly action: string;
  readonly actionCopier: string;
  readonly copieNouveauLienAutorisee?: boolean;
  readonly prefixeMotifRefus?: string;
}>) {
  return (
    <MenuPlus>
      <EntreeNouveauLien nom={nom} courriel={courriel} action={action} />
      {copieNouveauLienAutorisee ? (
        <EntreeCopierLien
          nom={nom}
          courriel={courriel}
          action={actionCopier}
          prefixeMotifRefus={prefixeMotifRefus}
        />
      ) : null}
    </MenuPlus>
  );
}

function EntreeNouveauLien({
  nom,
  courriel,
  action,
}: Readonly<{
  readonly nom: string;
  readonly courriel: string;
  readonly action: string;
}>) {
  const idFormulaire = useId();
  // FERME LE MENU QUAND LE DIALOGUE SE FERME, JAMAIS AVANT — même piège,
  // même parade que `DialogueAnnuler` (`components/interventions/
  // dialogue-annuler.tsx`), voir la docstring de `Dialogue`.
  const fermerMenu = useFermerMenuPlus();

  return (
    <Dialogue
      auFermer={fermerMenu}
      declencheur={(ouvrir) => (
        <button
          type="button"
          role="menuitem"
          onClick={ouvrir}
          className="hover:bg-app-fond flex w-full flex-col items-start gap-0.5 rounded-md px-2.5 py-2 text-left"
        >
          <span className="text-13 font-bold">
            {t("equipe.menu.nouveau_lien")}
          </span>
          <span className="text-app-encre-faible text-12 font-bold">
            {t("equipe.menu.nouveau_lien_sous_titre")}
          </span>
        </button>
      )}
      titre={`${t("equipe.dialogue.nouveau_lien_titre_prefixe")} ${nom}`}
      enfants={() => (
        <form
          id={idFormulaire}
          action={action}
          method="post"
          className="flex flex-col gap-3"
        >
          <p className="text-13 font-bold">{courriel}</p>
          <p className="text-app-encre-faible text-13 font-bold">
            {t("equipe.dialogue.nouveau_lien_texte_1")} {premierMot(nom)}{" "}
            {t("equipe.dialogue.nouveau_lien_texte_2")}
          </p>
        </form>
      )}
      pied={(fermer) => (
        <>
          <Button type="button" variant="outline" size="sm" onClick={fermer}>
            {t("equipe.volet.annuler")}
          </Button>
          <Button type="submit" form={idFormulaire} variant="default" size="sm">
            {t("equipe.dialogue.envoyer")}
          </Button>
        </>
      )}
    />
  );
}

/**
 * « COPIER LE LIEN D'ACCÈS », DEPUIS LE MENU D'UN ACCÈS DÉJÀ ACTIF (9I6B-
 * LIEN-ACCES-A-COPIER, D170) — même cliquet sauté que `EntreeNouveauLien`
 * (`options.nouveauLien`, `lib/auth/lien-d-acces.ts`), mais la suite diffère
 * totalement : `BoutonCopierLien` n'envoie aucun courriel, elle rend l'URL en
 * JSON et la pose dans le presse-papiers — c'est pourquoi ce dialogue n'a
 * aucun bouton d'action dans son pied, `BoutonCopierLien` porte le sien.
 */
function EntreeCopierLien({
  nom,
  courriel,
  action,
  prefixeMotifRefus,
}: Readonly<{
  readonly nom: string;
  readonly courriel: string;
  readonly action: string;
  readonly prefixeMotifRefus: string;
}>) {
  const fermerMenu = useFermerMenuPlus();

  return (
    <Dialogue
      auFermer={fermerMenu}
      declencheur={(ouvrir) => (
        <button
          type="button"
          role="menuitem"
          onClick={ouvrir}
          className="hover:bg-app-fond flex w-full flex-col items-start gap-0.5 rounded-md px-2.5 py-2 text-left"
        >
          <span className="text-13 font-bold">
            {t("equipe.acces.copier_lien")}
          </span>
          <span className="text-app-encre-faible text-12 font-bold">
            {t("equipe.menu.nouveau_lien_sous_titre")}
          </span>
        </button>
      )}
      titre={`${t("equipe.dialogue.copier_lien_titre_prefixe")} ${nom}`}
      enfants={() => (
        <div className="flex flex-col gap-3">
          <p className="text-13 font-bold">{courriel}</p>
          <p className="text-app-encre-faible text-13 font-bold">
            {t("equipe.dialogue.copier_lien_texte_1")} {premierMot(nom)}{" "}
            {t("equipe.dialogue.copier_lien_texte_2")}
          </p>
          <BoutonCopierLien action={action} prefixeMotifRefus={prefixeMotifRefus} />
        </div>
      )}
      pied={(fermer) => (
        <Button type="button" variant="outline" size="sm" onClick={fermer}>
          {t("equipe.volet.annuler")}
        </Button>
      )}
    />
  );
}
