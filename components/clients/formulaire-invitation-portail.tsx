"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { estCleTraduction, t } from "@/lib/i18n/fr";

type EtatInvitation =
  | { readonly etape: "repos" }
  | { readonly etape: "en_cours" }
  | { readonly etape: "lien"; readonly url: string }
  | { readonly etape: "deja_actif" }
  | { readonly etape: "refus"; readonly motif: string }
  | { readonly etape: "erreur" };

/**
 * « INVITER AU PORTAIL » (9J02A-REPRISE-9J02, D96, D230) — un courriel, et le
 * lien de premier accès à copier : sans nom de domaine, Resend ne peut pas
 * envoyer ce lien — l'administrateur le copie ici et le transmet lui-même.
 * **La personne choisit toujours elle-même son mot de passe.**
 *
 * **`router.refresh()` après un succès** (invitation ou révocation) : la
 * liste des comptes du portail est un RENDU SERVEUR (la page lit
 * `comptesDuPortailDuClient`), ce composant ne la tient pas en état local —
 * deux sources de vérité divergeraient au premier écart.
 *
 * **Le lien reste affiché EN CLAIR tant que cet état vit** (9J21) — Alexis
 * l'a cherché à l'écran le 06/11 et n'a trouvé que le message disant qu'il
 * était copié. Il ne vient JAMAIS de la base (il ne peut l'être : la route ne
 * le journalise ni ne le relit) et disparaît au rechargement de la page —
 * seul l'état React de CE composant le porte.
 *
 * **Le message d'une invitation ne survit pas à la saisie suivante** (9J21,
 * point 2) : modifier le champ courriel revient à l'état `repos`, pour que
 * le message affiché parle toujours de l'invitation qui vient d'être faite,
 * jamais de la précédente.
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
    setEtat({ etape: "lien", url: corps.url });
  }

  function surSaisie(valeur: string): void {
    setEmail(valeur);
    if (etat.etape !== "en_cours") {
      setEtat({ etape: "repos" });
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
          onChange={(evenement) => surSaisie(evenement.currentTarget.value)}
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
      {etat.etape === "lien" ? (
        <div className="flex flex-col gap-1">
          <p role="status" className="text-app-encre-faible text-12 font-bold">
            {t("clients.acces.lien_copie")}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              readOnly
              value={etat.url}
              onFocus={(evenement) => evenement.currentTarget.select()}
              className="border-app-bord bg-app-surface min-w-0 flex-1 rounded-md border px-2 py-1 text-13 font-bold"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                void navigator.clipboard.writeText(etat.url).catch(() => {});
              }}
            >
              {t("clients.acces.copier_lien")}
            </Button>
          </div>
        </div>
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
    </form>
  );
}
