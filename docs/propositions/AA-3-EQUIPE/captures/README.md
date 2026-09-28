# Captures — AA-3-EQUIPE

Fiche de modification d'un technicien (`/parametres/equipe`), déjà rattaché à une agence
désactivée APRÈS coup (fait antérieur — la décision D134, même précédent que
`9AY-AA-G1-AGENCE-PROPRE-CHOIX-SITES`, appliquée ici à un technicien plutôt qu'à un site).

Scène forgée par `tests/e2e/captures-aa3-equipe.spec.ts` (env `CAPTURES_AA3`), préfixe
`AA3CAP-` : une agence `AA3CAP-INACTIVE` (`actif=false`) et un technicien `AA3CAP-Technicien`
déjà rattaché à elle, créés directement en base en `beforeAll`, supprimés en `afterAll`.

- `fiche-technicien-avant-*.png` — rejoué sur le code d'AVANT ce ticket (`git stash` du code
  livré, capture prise, changements restaurés) : le menu « Agence de rattachement » de la fiche
  de modification ne propose que les agences ACTIVES (`agencesDisponibles`), donc AUCUNE option
  ne porte l'identifiant de `AA3CAP-INACTIVE` — le navigateur retombe silencieusement sur la
  PREMIÈRE agence active du menu (« Dolbeau »), alors que la table au-dessus affiche bien
  « AA3CAP-INACTIVE » comme rattachement réel. Le prochain « Enregistrer » aurait donc dératé le
  rattachement du technicien vers Dolbeau, sans que rien ne l'ait demandé.
- `fiche-technicien-apres-*.png` — après le commit AA-3-EQUIPE :
  `agencesProposablesPourTechnicien` (`lib/techniciens/depot.ts`) garde l'agence ACTUELLE du
  technicien dans son propre menu, même inactive — le select affiche et sélectionne bien
  « AA3CAP-INACTIVE — AA3CAP-INACTIVE (inactive) ».

À 1280 et 375 px.
