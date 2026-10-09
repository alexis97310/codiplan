import type { Metadata } from "next";

import Link from "next/link";

import { MarqueClaire } from "@/components/navigation/marque";
import { CadreAcces } from "@/components/session/cadre-acces";
import { t } from "@/lib/i18n/fr";

export const metadata: Metadata = { title: t("mot_de_passe_oublie.titre") };

/**
 * MOT DE PASSE OUBLIÉ — TEXTE SEUL (QE-18 a, D162, 9DJ-TP-ACC1 ; au gabarit
 * de la maquette du 28/09, D188, partie 7).
 *
 * Décision du pilote (28/09/2026, précisée le 03/10) : aucun formulaire,
 * aucune route publique de réinitialisation. Le seul chemin qui ouvre un
 * accès est désormais administratif — l'administrateur de la société envoie
 * (ou réémet) un lien depuis Équipe (`lib/auth/acces-technicien.ts`). Cette
 * page ne fait donc rien d'autre que NOMMER ce chemin.
 *
 * **Ni `obtenirSession` ni `etatArrivee`** (`tests/unit/auth/chrome.test.ts`)
 * — un composant SYNCHRONE, comme avant ce lot : aucune lecture de session
 * ne s'ajoute pour poser deux colonnes et un lien.
 */
export default function PageMotDePasseOublie() {
  return (
    <>
      <MarqueClaire accueil="/" />
      <CadreAcces>
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4">
          {/* « ← Retour à la connexion » EN TÊTE (M:5471) — même cible que
              le lien d'aujourd'hui, seul le texte et la position changent
              (`mot_de_passe_oublie.retour` reste défini, inutilisé ici). */}
          <Link
            href="/connexion"
            className="text-sm font-medium underline underline-offset-2"
          >
            {t("mot_de_passe_oublie.retour_fleche")}
          </Link>

          <h1 className="text-2xl font-semibold tracking-tight">
            {t("mot_de_passe_oublie.titre")}
          </h1>
          <p className="text-muted-foreground text-sm">
            {t("mot_de_passe_oublie.texte")}
          </p>
          {/* LE SECOND PARAGRAPHE (M:5472) — la durée dite ici est celle du
              PRODUIT (`lib/courriel/premier-acces.ts`), jamais mesurée sur
              la bibliothèque qui l'implémente. */}
          <p className="text-muted-foreground text-sm">
            {t("mot_de_passe_oublie.texte_envoi")}
          </p>
        </main>
      </CadreAcces>
    </>
  );
}
