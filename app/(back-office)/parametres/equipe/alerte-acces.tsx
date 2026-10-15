"use client";

import { useId } from "react";

import { Button } from "@/components/ui/button";
import { Dialogue } from "@/components/ui/dialogue";
import { Icone } from "@/components/ui/icone";
import type { EtatAcces } from "@/lib/auth/acces-technicien";
import { t } from "@/lib/i18n/fr";
import { dernierMot, trierAlphanumeriquement } from "@/lib/tri/collation";

import {
  boutonToutEnvoyer,
  ligneDialogueToutEnvoyer,
  libelleVoirAccesAOuvrir,
  titreAlerteAccesAOuvrir,
  titreDialogueToutEnvoyer,
} from "./presentation";

/** Une personne comptée par l'alerte — technicien ou compte de bureau. */
export type PersonneAccesAOuvrir = {
  readonly utilisateurId: string;
  readonly nom: string;
  readonly email: string;
  readonly etat: EtatAcces;
};

/**
 * L'ALERTE « N PERSONNE(S) NE PEUVENT PAS ENCORE SE CONNECTER » (point 2,
 * 9EY-EQUIPE-ALERTE-TOUT-ENVOYER ; maquette `maquette-toutes-pages.html:4678`)
 * — vue par défaut SEULEMENT (jamais dans `?acces=a-ouvrir`, qui porte le même
 * geste dans sa barre de filtre).
 *
 * **AUCUN `role="status"`** — contrairement aux bandeaux de motif de
 * `page.tsx` : cette alerte reste visible tant que la population n'est pas
 * vide, indépendamment de toute action de l'écran. Six épreuves existantes
 * (`equipe.spec.ts`, `habilitations.spec.ts`, `pg-g16-statut-ressource.spec.ts`,
 * `acces-technicien.spec.ts`) exigent `[role='status']` count 0 après une
 * action sans rapport, sur une scène qui compte déjà des personnes sans accès
 * actif — un rôle vivant ferait rougir les six.
 */
export function AlerteAccesAOuvrir({
  nombre,
  hrefVoir,
  personnes,
  peutEnvoyer,
  retenirAccesAOuvrir,
}: Readonly<{
  readonly nombre: number;
  readonly hrefVoir: string;
  readonly personnes: readonly PersonneAccesAOuvrir[];
  readonly peutEnvoyer: boolean;
  readonly retenirAccesAOuvrir: boolean;
}>) {
  if (nombre === 0) {
    return null;
  }
  return (
    <div className="border-app-orange-bord bg-app-orange-fond text-app-orange-encre flex flex-wrap items-center justify-between gap-3 rounded-md border px-3.5 py-2.5">
      <div className="flex flex-col gap-0.5">
        <p className="text-13 font-bold">{titreAlerteAccesAOuvrir(nombre)}</p>
        <p className="text-12 font-bold">{t("equipe.alerte.texte")}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <a href={hrefVoir} className="text-[12px] font-bold underline">
          {libelleVoirAccesAOuvrir(nombre)}
        </a>
        {peutEnvoyer ? (
          <BoutonToutEnvoyer
            nombre={nombre}
            personnes={personnes}
            retenirAccesAOuvrir={retenirAccesAOuvrir}
          />
        ) : (
          <span className="text-12 font-bold">
            {t("equipe.alerte.sans_droit")}
          </span>
        )}
      </div>
    </div>
  );
}

export function BoutonToutEnvoyer({
  nombre,
  personnes,
  retenirAccesAOuvrir,
}: Readonly<{
  readonly nombre: number;
  readonly personnes: readonly PersonneAccesAOuvrir[];
  readonly retenirAccesAOuvrir: boolean;
}>) {
  const idFormulaire = useId();
  const triees = trierAlphanumeriquement(personnes, (personne) =>
    dernierMot(personne.nom),
  );

  return (
    <Dialogue
      declencheur={(ouvrir) => (
        <Button
          type="button"
          variant="default"
          size="sm"
          onClick={ouvrir}
          className="gap-1.5"
        >
          <Icone nom="send" taille={16} />
          {t("equipe.alerte.tout_envoyer")}
        </Button>
      )}
      titre={titreDialogueToutEnvoyer(nombre)}
      enfants={() => (
        <form
          id={idFormulaire}
          action="/api/equipe/envoyer-acces/tous"
          method="post"
          className="flex flex-col gap-3"
        >
          {retenirAccesAOuvrir ? (
            <input type="hidden" name="acces_a_ouvrir" value="1" />
          ) : null}
          <ul className="flex flex-col gap-1.5">
            {triees.map((personne) => (
              <li key={personne.utilisateurId} className="text-13 font-bold">
                {ligneDialogueToutEnvoyer(personne)}
              </li>
            ))}
          </ul>
          <p className="text-app-encre-faible text-12 font-bold">
            {t("equipe.dialogue.tout_envoyer.note")}
          </p>
        </form>
      )}
      pied={(fermer) => (
        <>
          <Button type="button" variant="outline" size="sm" onClick={fermer}>
            {t("equipe.volet.annuler")}
          </Button>
          <Button type="submit" form={idFormulaire} variant="default" size="sm">
            {boutonToutEnvoyer(nombre)}
          </Button>
        </>
      )}
    />
  );
}
