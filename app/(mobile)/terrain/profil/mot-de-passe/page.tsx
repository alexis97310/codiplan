import type { Metadata } from "next";

import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Champ } from "@/components/session/formulaire";
import { ChampsNouveauMotDePasse } from "@/components/session/champs-nouveau-mot-de-passe";
import { Button } from "@/components/ui/button";
import { Message } from "@/components/ui/message";
import { LONGUEUR_MINIMALE } from "@/lib/auth/premier-acces";
import { obtenirSession } from "@/lib/auth/session";
import { estCleTraduction, t } from "@/lib/i18n/fr";
import { libelleChampObligatoire } from "@/lib/i18n/obligatoire";
import { perimetreDuPlanning } from "@/lib/interventions/perimetre-technicien";
import { type TonMessage } from "@/lib/theme/statuts";

export const metadata: Metadata = { title: t("terrain.mot_de_passe.titre") };

/**
 * CHANGER SON MOT DE PASSE DEPUIS LE TERRAIN (9L46-FINITIONS-LISTE-
 * TELEPHONE-MDP-TECHNICIEN) — le pendant, pour `/terrain/profil`, de
 * `/mon-compte` au bureau (9I9-MON-COMPTE).
 *
 * **Même route, même geste, même garde que le bureau** — cet écran ne porte
 * AUCUNE règle de mot de passe propre : il POSTE au même
 * `/api/session/mon-compte/mot-de-passe`, qui relit lui-même l'identité
 * depuis la session (`exigerSessionActive`) et décide SEUL de la
 * redirection selon le rôle. Seule la mise en page change.
 *
 * Même garde que `/terrain/profil` — un rôle à accès complet n'a pas de
 * profil terrain, et n'a donc pas davantage ce sous-écran.
 */
export default async function PageMotDePasseTerrain({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await obtenirSession(await headers());
  if (session === null) {
    redirect("/connexion");
  }
  if (session.contexte.societeId === null || session.contexte.role === null) {
    redirect("/arrivee");
  }
  const contexte = {
    ...session.contexte,
    societeId: session.contexte.societeId,
    role: session.contexte.role,
  };

  const perimetre = perimetreDuPlanning(contexte);
  if (perimetre.acces === "complet") {
    redirect("/planning");
  }
  if (perimetre.acces === "aucun") {
    redirect("/arrivee");
  }

  const motif = (await searchParams).motif;

  return (
    <main className="flex flex-col gap-4">
      <Link
        href="/terrain/profil"
        className="text-app-encre-faible text-16 font-bold"
      >
        {t("terrain.mot_de_passe.retour")}
      </Link>

      <h1 className="text-24 font-extrabold tracking-tight">
        {t("terrain.mot_de_passe.titre")}
      </h1>

      {typeof motif === "string" && estCleTraduction(motif) ? (
        <Message ton={tonDuMotif(motif)} titre={t(motif)} />
      ) : null}

      <form
        action="/api/session/mon-compte/mot-de-passe"
        method="post"
        className="flex flex-col gap-4"
      >
        <Champ
          nom="motDePasseActuel"
          type="password"
          libelle={libelleChampObligatoire(t("mon_compte.mot_de_passe.actuel"))}
          autoComplete="current-password"
        />
        <ChampsNouveauMotDePasse
          libelleMotDePasse={libelleChampObligatoire(
            t("mon_compte.mot_de_passe.nouveau"),
          )}
          libelleConfirmation={libelleChampObligatoire(
            t("mon_compte.mot_de_passe.confirmation"),
          )}
          texteRegleLongueur={t("mon_compte.mot_de_passe.regle_longueur")}
          texteRegleConfirmation={t(
            "mon_compte.mot_de_passe.regle_confirmation",
          )}
          longueurMinimale={LONGUEUR_MINIMALE}
        />
        <Button type="submit" size="lg" className="w-full">
          {t("mon_compte.mot_de_passe.valider")}
        </Button>
      </form>
    </main>
  );
}

/** Succès et refus affichent le MÊME motif, sous un ton distinct (D188) — même liste que `/mon-compte`. */
const MOTIFS_SUCCES: ReadonlySet<string> = new Set([
  "mon_compte.mot_de_passe.abouti",
]);

function tonDuMotif(motif: string): TonMessage {
  return MOTIFS_SUCCES.has(motif) ? "succes" : "refus";
}
