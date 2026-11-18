"use client";

import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialogue } from "@/components/ui/dialogue";
import {
  SelecteurRecherche,
  type OptionRecherche,
} from "@/components/ui/selecteur-recherche";
import { t } from "@/lib/i18n/fr";
import { libelleChampObligatoire } from "@/lib/i18n/obligatoire";

type OptionSite = OptionRecherche & { readonly clientId: string };

/**
 * LE DIALOGUE « DÉPLACER LA MACHINE » (9L20-DEPLACER-MACHINE, décision
 * d'Alexis du 10/11/2026) — même patron que `DialogueSuspendre`
 * (`components/interventions/dialogue-suspendre.tsx`) : un `<form>` POST
 * natif dans un `Dialogue` générique, soumis par le bouton du pied.
 *
 * `/api/recherche/sites` est appelée SANS `parametres={{client:…}}` — à la
 * différence de `FormulaireMachine` en création, qui restreint au client déjà
 * choisi : ici, la recherche porte sur TOUTE la société, puisque le site
 * cible peut appartenir à un autre client (confirmation explicite). Chaque
 * résultat porte déjà `clientId` (`app/api/recherche/sites/route.ts`), ce qui
 * permet de savoir, CÔTÉ CLIENT, si la case de confirmation doit apparaître —
 * le serveur revalide cette même condition, jamais sur la seule foi de ce
 * que ce composant affiche.
 */
export function DialogueDeplacerMachine({
  machineId,
  clientActuelId,
}: Readonly<{
  readonly machineId: string;
  readonly clientActuelId: string;
}>) {
  const idFormulaire = useId();
  const [siteChoisi, setSiteChoisi] = useState<OptionSite | null>(null);
  const autreClient =
    siteChoisi !== null && siteChoisi.clientId !== clientActuelId;

  return (
    <Dialogue
      declencheur={(ouvrir) => (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={ouvrir}
          data-action="deplacer-machine"
        >
          {t("machine.deplacer.bouton")}
        </Button>
      )}
      titre={t("machine.deplacer.titre_prefixe")}
      enfants={() => (
        <form
          id={idFormulaire}
          action={`/api/machines/${machineId}/deplacer`}
          method="post"
          className="flex flex-col gap-3"
        >
          <SelecteurRecherche<OptionSite>
            nom="nouveau_site_id"
            url="/api/recherche/sites"
            libelle={libelleChampObligatoire(t("machine.deplacer.champ_site"))}
            libelleAucunResultat={t("selecteur.aucun_resultat")}
            libelleVoirPlus={t("selecteur.voir_plus")}
            obligatoire
            onChoix={setSiteChoisi}
          />
          {autreClient ? (
            <label className="flex items-start gap-2 text-13 font-bold">
              <input
                type="checkbox"
                name="confirmation_autre_client"
                value="oui"
              />
              {t("machine.deplacer.confirmation_autre_client")}
            </label>
          ) : null}
        </form>
      )}
      pied={(fermer) => (
        <>
          <Button type="button" variant="outline" size="sm" onClick={fermer}>
            {t("machine.deplacer.fermer")}
          </Button>
          <Button type="submit" form={idFormulaire} size="sm">
            {t("machine.deplacer.bouton")}
          </Button>
        </>
      )}
    />
  );
}
