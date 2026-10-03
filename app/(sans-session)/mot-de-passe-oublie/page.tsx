import type { Metadata } from "next";

import Link from "next/link";

import { MarqueClaire } from "@/components/navigation/marque";
import { t } from "@/lib/i18n/fr";

export const metadata: Metadata = { title: t("mot_de_passe_oublie.titre") };

/**
 * MOT DE PASSE OUBLIÉ — TEXTE SEUL (QE-18 a, D162, 9DJ-TP-ACC1).
 *
 * Décision du pilote (28/09/2026, précisée le 03/10) : aucun formulaire,
 * aucune route publique de réinitialisation. Le seul chemin qui ouvre un
 * accès est désormais administratif — l'administrateur de la société envoie
 * (ou réémet) un lien depuis Équipe (`lib/auth/acces-technicien.ts`). Cette
 * page ne fait donc rien d'autre que NOMMER ce chemin.
 */
export default function PageMotDePasseOublie() {
  return (
    <>
      <MarqueClaire accueil="/" />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("mot_de_passe_oublie.titre")}
        </h1>
        <p className="text-muted-foreground text-sm">
          {t("mot_de_passe_oublie.texte")}
        </p>
        <Link
          href="/connexion"
          className="text-sm font-medium underline underline-offset-2"
        >
          {t("mot_de_passe_oublie.retour")}
        </Link>
      </main>
    </>
  );
}
