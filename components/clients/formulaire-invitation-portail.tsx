"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { estCleTraduction, t } from "@/lib/i18n/fr";

type EtatInvitation =
  | { readonly etape: "repos" }
  | { readonly etape: "en_cours" }
  | { readonly etape: "copie" }
  | { readonly etape: "deja_actif" }
  | { readonly etape: "a_copier_a_la_main"; readonly url: string }
  | { readonly etape: "refus"; readonly motif: string }
  | { readonly etape: "erreur" };

/**
 * « INVITER AU PORTAIL » (9J02A-REPRISE-9J02, D96, D230) — un courriel, et le
 * lien de premier accès à copier, sur le MÊME modèle que
 * `components/equipe/bouton-copier-lien.tsx` (D170) : sans nom de domaine,
 * Resend ne peut pas envoyer ce lien — l'administrateur le copie ici et le
 * transmet lui-même. **La personne choisit toujours elle-même son mot de
 * passe.**
 *
 * **`router.refresh()` après un succès** (invitation ou révocation) : la
 * liste des comptes du portail est un RENDU SERVEUR (la page lit
 * `comptesDuPortailDuClient`), ce composant ne la tient pas en état local —
 * deux sources de vérité divergeraient au premier écart.
 */
export function FormulaireInvitationPortail({
  clientId,
}: Readonly<{ readonly clientId: string }>) {
  const router = useRouter();
  const idChamp = useId();
  const [email, setEmail] = useState("");
  const [etat, setEtat] = useState<EtatInvitation>({ etape: "repos" });

  async function inviter() {
    setEtat({ etape: "en_cours" });
    let reponse: Response;
    try {
      reponse = await fetch(`/api/clients/${clientId}/inviter`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } catch {
      setEtat({ etape: "erreur" });
      return;
    }
    const corps: Readonly<{
      readonly url?: unknown;
      readonly dejaActif?: unknown;
      readonly erreur?: unknown;
    }> = await reponse.json();
    if (typeof corps.erreur === "string") {
      setEtat({ etape: "refus", motif: corps.erreur });
      return;
    }
    setEmail("");
    router.refresh();
    if (corps.dejaActif === true) {
      setEtat({ etape: "deja_actif" });
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
    const cle = `clients.acces.refus.${motif}`;
    return estCleTraduction(cle) ? t(cle) : t("clients.acces.refus.erreur");
  }

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(evenement) => {
        evenement.preventDefault();
        void inviter();
      }}
    >
      <label
        htmlFor={idChamp}
        className="text-app-encre-faible text-12 font-bold"
      >
        {t("clients.acces.email_libelle")}
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          id={idChamp}
          type="email"
          required
          value={email}
          onChange={(evenement) => setEmail(evenement.currentTarget.value)}
          className="border-app-bord bg-app-surface min-w-0 flex-1 rounded-md border px-2 py-1 text-13 font-bold"
        />
        <Button
          type="submit"
          variant="outline"
          size="sm"
          disabled={etat.etape === "en_cours"}
        >
          {t("clients.acces.inviter")}
        </Button>
      </div>
      {etat.etape === "copie" ? (
        <p role="status" className="text-app-encre-faible text-12 font-bold">
          {t("clients.acces.lien_copie")}
        </p>
      ) : null}
      {etat.etape === "deja_actif" ? (
        <p role="status" className="text-app-encre-faible text-12 font-bold">
          {t("clients.acces.deja_actif")}
        </p>
      ) : null}
      {etat.etape === "erreur" ? (
        <p role="status" className="text-app-orange-encre text-12 font-bold">
          {t("clients.acces.copier_lien_erreur")}
        </p>
      ) : null}
      {etat.etape === "refus" ? (
        <p role="status" className="text-app-orange-encre text-12 font-bold">
          {libelleRefus(etat.motif)}
        </p>
      ) : null}
      {etat.etape === "a_copier_a_la_main" ? (
        <div className="flex flex-col gap-1">
          <span className="text-app-encre-faible text-12 font-bold">
            {t("clients.acces.copier_lien_presse_papiers_indisponible")}
          </span>
          <input
            type="text"
            readOnly
            value={etat.url}
            onFocus={(evenement) => evenement.currentTarget.select()}
            className="border-app-bord bg-app-surface rounded-md border px-2 py-1 text-13 font-bold"
          />
        </div>
      ) : null}
    </form>
  );
}
