"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { type Fuseau } from "@/lib/calendar/fuseau";
import { t } from "@/lib/i18n/fr";
import {
  ajouterSaisie,
  listerFilePourIntervention,
  nouvelleOperation,
} from "@/lib/terrain/file-saisies";

import { heureLocale } from "./presentation";

/**
 * UNE FONCTION, JAMAIS UN `const` AU TEXTE CALCULÉ PAR TERNAIRE — même piège
 * que documenté en tête de `rapport-automatique.tsx` (gardien L0-11) : un
 * `t("...")` niché dans une ternaire affectée à un `const` s'y résout avec un
 * contexte vide, et la CLÉ elle-même serait signalée comme une chaîne écrite
 * en dur plutôt que reconnue comme un accès au dictionnaire.
 */
function libelleDuBouton(
  iciEffectif: boolean,
  actionLocale: "demarrer" | "arreter" | null,
  enPause: boolean,
): string {
  if (iciEffectif) {
    return t("terrain.compteur.pause");
  }
  if (actionLocale === null && enPause) {
    return t("terrain.compteur.reprendre");
  }
  return t("terrain.compteur.demarrer");
}

/**
 * LE BOUTON DU COMPTEUR, CAPABLE DE FILE (9F4H3-HORS-RESEAU-ENVOYER, point 1)
 * — REMPLACE le `<form action=… method="post">` posé par le ticket R5-02
 * (D119), qui ne survivait pas à une coupure réseau : un formulaire natif
 * hors ligne échoue dans le navigateur, sans que rien ne garde le geste.
 *
 * ## LA DERNIÈRE SAISIE LOCALE L'EMPORTE SUR `ici` DU SERVEUR
 *
 * `ici`/`enPause` sont la vérité SERVEUR au moment du rendu. Si une saisie
 * « démarrer »/« arrêter » est déjà en file pour cette intervention (coupure
 * en cours, ou rechargement avant que « Envoyer » n'ait réussi), c'est ELLE
 * qui décide du prochain geste et du libellé — sinon un second clic
 * proposerait encore « Démarrer » après un démarrage déjà mis en file.
 */
export function BoutonCompteurTerrain({
  interventionId,
  utilisateurId,
  societeId,
  ici,
  enPause,
  fuseau,
}: {
  readonly interventionId: string;
  readonly utilisateurId: string;
  readonly societeId: string;
  readonly ici: boolean;
  readonly enPause: boolean;
  readonly fuseau: Fuseau;
}) {
  const router = useRouter();
  const [actionLocale, setActionLocale] = useState<
    "demarrer" | "arreter" | null
  >(null);
  const [instantLocal, setInstantLocal] = useState<string | null>(null);
  const [enEnvoi, setEnEnvoi] = useState(false);
  // JAMAIS « GARDÉ » SANS PREUVE (point 2, 9F4H3A) — posé quand `ajouterSaisie`
  // échoue réellement à écrire dans IndexedDB : le geste n'a alors nulle
  // part où attendre, et l'écran ne doit pas laisser croire le contraire.
  const [echecGarde, setEchecGarde] = useState(false);

  useEffect(() => {
    void listerFilePourIntervention(interventionId, {
      utilisateurId,
      societeId,
    }).then((entrees) => {
      const compteurs = entrees.filter(
        (e): e is typeof e & { geste: { type: "compteur" } } =>
          e.geste.type === "compteur",
      );
      const derniere = compteurs.at(-1);
      if (derniere !== undefined && derniere.geste.type === "compteur") {
        setActionLocale(derniere.geste.action);
        setInstantLocal(derniere.instantAppareil);
      }
    });
  }, [interventionId, utilisateurId, societeId]);

  const iciEffectif = actionLocale === null ? ici : actionLocale === "demarrer";
  const gesteSuivant: "demarrer" | "arreter" = iciEffectif
    ? "arreter"
    : "demarrer";
  const libelle = libelleDuBouton(iciEffectif, actionLocale, enPause);

  async function onClick(): Promise<void> {
    setEnEnvoi(true);
    setEchecGarde(false);
    // UN IDENTIFIANT DÈS LE PREMIER ESSAI (point 3, C7) — fabriqué AVANT cet
    // envoi, jamais après son échec : en « lie-fi » (la requête aboutit, mais
    // la réponse se perd), le serveur a déjà ouvert/fermé le segment sous CET
    // `operation_id` ; un renvoi par la file qui en fabriquerait un second
    // ne retrouverait pas le même segment, et le second geste serait refusé
    // (« déjà en cours » / « aucun en cours ») sans jamais pouvoir repartir.
    const operation = nouvelleOperation();
    const corps = new FormData();
    corps.set("geste", gesteSuivant);
    corps.set("operation_id", operation.id);
    corps.set("instant_appareil", operation.instantAppareil);
    try {
      const reponseServeur = await fetch(
        `/api/terrain/${interventionId}/compteur`,
        {
          method: "POST",
          body: corps,
          headers: { Accept: "application/json" },
        },
      );
      const resultat = (await reponseServeur.json()) as {
        readonly ok: boolean;
        readonly motif: string | null;
      };
      if (resultat.ok) {
        router.refresh();
        return;
      }
    } catch {
      const resultat = await ajouterSaisie({
        interventionId,
        utilisateurId,
        societeId,
        geste: { type: "compteur", action: gesteSuivant },
        id: operation.id,
        instantAppareil: operation.instantAppareil,
      });
      if (resultat.gardee) {
        setActionLocale(gesteSuivant);
        setInstantLocal(operation.instantAppareil);
      } else {
        setEchecGarde(true);
      }
    } finally {
      setEnEnvoi(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        size="lg"
        className="w-full text-16"
        disabled={enEnvoi}
        onClick={() => void onClick()}
      >
        {libelle}
      </Button>
      {echecGarde ? (
        <p
          role="status"
          className="border-app-rouge-bord bg-app-rouge-fond text-app-rouge-encre rounded-md border px-3 py-2 text-16 font-bold"
        >
          {t("terrain.file.echec_gardee")}
        </p>
      ) : null}
      {actionLocale === null || instantLocal === null ? null : (
        <p
          role="status"
          className="border-app-orange-bord bg-app-orange-fond text-app-orange-encre rounded-md border px-3 py-2 text-16 font-bold"
        >
          {actionLocale === "demarrer"
            ? t("terrain.compteur.hors_reseau_depuis")
            : t("terrain.compteur.hors_reseau_arrete")}{" "}
          {heureLocale(new Date(instantLocal), fuseau)}{" "}
          {t("terrain.compteur.heure_appareil")}
        </p>
      )}
    </>
  );
}
