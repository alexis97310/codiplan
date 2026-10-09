import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Carte } from "@/components/ui/carte";
import { t } from "@/lib/i18n/fr";

/**
 * « ACCÈS À OUVRIR » — administrateur de société (`accesCard`, maquette
 * :2838-2842 ; 9EG-TP-UX6-TABLEAU-DE-BORD-2).
 *
 * La MÊME population que la tuile (`techniciensAccesAOuvrir`,
 * `lib/tableau-de-bord/lectures.ts`) — jamais une seconde lecture.
 *
 * **Le bouton POSTE à la route existante** (`app/api/equipe/[id]/envoyer-
 * acces`), SANS la toucher : elle répond par une redirection vers
 * `/parametres/equipe`, donc le compte rendu de l'envoi se lit là-bas, jamais
 * ici (voir la passation).
 */
export type LigneAccesAOuvrirAffichee = {
  readonly utilisateurId: string;
  readonly nom: string;
  readonly etatLibelle: string;
  readonly boutonLibelle: string;
};

export function BlocAccesAOuvrir({
  lignes,
}: Readonly<{ lignes: readonly LigneAccesAOuvrirAffichee[] }>) {
  return (
    <Carte
      titre={t("tableau_de_bord.tuile_acces_a_ouvrir")}
      icone="key"
      compte={lignes.length}
      action={{
        libelle: t("equipe.titre"),
        href: "/parametres/equipe?acces=a-ouvrir",
      }}
      pied={<span>{t("tableau_de_bord.acces_pied")}</span>}
    >
      <div data-bloc="acces-a-ouvrir-liste">
        {lignes.map((ligne) => (
          <div
            key={ligne.utilisateurId}
            className="border-app-bord flex items-center gap-[10px] border-b px-[16px] py-[12px] last:border-b-0"
          >
            <Avatar identifiant={ligne.utilisateurId} nom={ligne.nom} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-13 font-bold">{ligne.nom}</p>
              <p className="text-app-encre-faible truncate text-12 font-bold">
                {ligne.etatLibelle}
              </p>
            </div>
            <form
              action={`/api/equipe/${ligne.utilisateurId}/envoyer-acces`}
              method="post"
            >
              <Button type="submit" variant="outline" size="sm">
                {ligne.boutonLibelle}
              </Button>
            </form>
          </div>
        ))}
      </div>
    </Carte>
  );
}
