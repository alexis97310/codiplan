import type { Metadata } from "next";

import { Champ, Formulaire, Message } from "@/components/session/formulaire";
import { t } from "@/lib/i18n/fr";

export const metadata: Metadata = { title: t("premier_acces.titre") };

/**
 * PREMIER ACCÈS — L'ÉCRAN OÙ L'ON CHOISIT SON MOT DE PASSE (D65).
 *
 * ## Ce qu'il répare, et il a été mesuré
 *
 * Le geste d'amorçage délivre une URL de premier accès depuis le 09/09/2026,
 * et sa redirection finale pointe sur `/premier-acces` — écrit deux fois dans
 * `lib/auth/amorcage.ts`. **Cet écran n'existait pas.** Mesuré le 11/09/2026 en
 * suivant le lien réellement émis par `--reemettre` : la chaîne de la
 * bibliothèque aboutit à `/premier-acces?token=…`, qui rend **404**.
 *
 * *La conséquence n'était pas cosmétique : c'est la SEULE porte d'entrée d'une
 * base neuve.* Le seed n'attribue aucun mot de passe — il n'en existe aucun
 * tant qu'une personne n'en a pas choisi un —, et l'unique chemin pour en
 * choisir un est ce lien. Une base de démonstration parfaitement peuplée était
 * donc inaccessible à quiconque, et rien ne le disait : *le silence a la forme
 * du succès (§9, 31/08).*
 *
 * ## Le jeton vit dans l'URL, et nulle part ailleurs
 *
 * Il arrive en paramètre de requête parce que c'est la bibliothèque qui l'y
 * met, à la fin de sa propre redirection. Il n'est ni recopié en base, ni posé
 * en cookie : il est repassé tel quel dans un champ caché, et consommé par la
 * route. **Un jeton absent ne donne pas un formulaire muet** — l'écran le dit,
 * plutôt que de laisser quelqu'un saisir deux fois un mot de passe pour rien.
 *
 * ## Ce qu'il ne fait PAS
 *
 * Il n'ouvre aucune session et n'énumère rien. Un lien invalide et un lien
 * expiré rendent le MÊME refus : les distinguer ferait un oracle sur
 * l'existence d'un compte (D35, D50).
 */
export default async function PagePremierAcces({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parametres = await searchParams;
  const jeton = parametres.token;
  const motif = parametres.motif;

  if (typeof jeton !== "string" || jeton.trim() === "") {
    return (
      <Formulaire
        action="/connexion"
        titre={t("premier_acces.titre")}
        accroche={t("premier_acces.accroche")}
        valider={t("connexion.valider")}
      >
        <Message motif="premier_acces.sans_jeton" />
      </Formulaire>
    );
  }

  return (
    <Formulaire
      action="/api/session/premier-acces"
      titre={t("premier_acces.titre")}
      accroche={t("premier_acces.accroche")}
      valider={t("premier_acces.valider")}
    >
      <Message motif={typeof motif === "string" ? motif : undefined} />
      {/* Le jeton repasse tel quel : il vient de la bibliothèque, il n'est ni
          réécrit ni interprété ici. */}
      <input type="hidden" name="jeton" value={jeton} />
      <Champ
        nom="motDePasse"
        type="password"
        libelle={t("premier_acces.mot_de_passe")}
      />
      <Champ
        nom="confirmation"
        type="password"
        libelle={t("premier_acces.confirmation")}
      />
    </Formulaire>
  );
}
