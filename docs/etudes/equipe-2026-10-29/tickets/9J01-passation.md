# 9J01-DOC-PARCOURS-1 — passation

Budget : T0 15:31 (Pacific/Noumea), limite 90 min. Terminé sans dépasser T0+60 — aucun point renvoyé en
« à faire » faute de temps.

## Point par point

1. **Lecture de la migration.** `prisma/migrations/20260923130000_parcours_1_creer_puis_planifier/migration.sql`
   lue en entier (138 lignes). La garde (lignes 65-116, pas seulement le `COMMENT ON CONSTRAINT` final aux
   lignes 121-122) vérifie d'abord, sous `NO FORCE ROW LEVEL SECURITY` posé et constaté, qu'aucune
   intervention n'a déjà deux machines, et échoue en les nommant plutôt que de choisir à leur place.
2. **Numérotation.** Le ticket supposait D221 comme dernière décision ; `grep -oE "^## D[0-9]+" |
   sort -V | tail -1` donnait **D227** au moment d'écrire. Section posée en **D228**, comme le ticket
   autorisait explicitement dans ce cas.
3. **Section D228 ajoutée**, en fin de `docs/arbitrages.md` — aucune section existante modifiée. Reprend :
   la date (23/09/2026), l'auteur (Alexis), ce que le chapitre 7/M3 et D103 (`docs/arbitrages.md:3436`)
   permettaient avant (plusieurs lignes machine, chacune avec sa checklist), ce que PARCOURS-1 referme (une
   machine au plus, contrainte posée VALIDÉE), et le texte exact du `COMMENT ON CONSTRAINT`, cité
   `fichier:ligne` plutôt que paraphrasé. Marquée **À VALIDER PAR ALEXIS** en tête, avec condition de
   réouverture vérifiable (le jour où une visite doit à nouveau couvrir plusieurs machines).
4. **Écart réel trouvé et nommé, pas corrigé.** RG-INT-01 (chapitre 10) porte aujourd'hui, mot pour mot :
   *« Elle PEUT en porter une ou plusieurs (`intervention_machine`) »* — texte amendé en dernier par D16 et
   D120 (15/09/2026), donc ANTÉRIEUR à PARCOURS-1 (23/09/2026) et jamais mis à jour depuis. **Le chapitre 10
   contredit aujourd'hui, mot pour mot, la contrainte que la base impose depuis le 23/09.** Aucun gardien
   existant ne le voyait : `cablage-arbitrages.test.ts` ne tient que les paires de sa liste
   `CABLAGE_ATTENDU`, écrite à la main, et D228 n'y figurait pas avant ce ticket puisqu'il n'existait pas.
   `docs/cahier-des-charges.md` est hors du territoire de ce ticket (limité à l'ajout d'une section à
   `docs/arbitrages.md`) : **je n'ai pas touché RG-INT-01.** C'est noté dans D228 elle-même (section « Écart
   mesuré ») et répété ici — c'est le point qui demande vraiment une réponse d'Alexis, pas la simple
   confirmation du texte recopié.
5. **Câblage des cinq citations existantes (étape 5 du ticket).** Vérifié : aucun gardien du dépôt
   (`cablage-arbitrages`, `amendements-arbitrages`, `citations-decisions-code`) ne porte de mécanisme pour
   une mention en PROSE du mot « PARCOURS-1 » — tous les trois ne reconnaissent que des références
   numérotées `Dxx`. Les cinq citations existantes (`docs/arbitrages.md:5015,5021,5033,6223,6876` au moment
   d'écrire — décalées de leurs numéros de ligne annoncés dans le ticket, 4997/5003/5015/6205/6858, par la
   croissance normale du document depuis sa rédaction) continuent de nommer « PARCOURS-1 » en texte libre,
   pas « D228 » : aucun gardien ne l'exige, donc **je n'ai inventé aucun mécanisme de câblage**. Elles restent
   lisibles et correctes (le mot « PARCOURS-1 » désigne sans ambiguïté la même décision, maintenant écrite).

## Ce qui reste à faire (prochaine reprise)

1. **Décision d'Alexis sur l'écart RG-INT-01 / PARCOURS-1** (point 4 ci-dessus) : soit RG-INT-01 se
   réécrit pour dire « une machine au plus » (et D228 gagne alors sa ligne `**Règles amendées :**
   RG-INT-01`, câblée dans `cablage-arbitrages.test.ts` → `CABLAGE_ATTENDU`), soit PARCOURS-1 doit être
   revu si « une ou plusieurs » était en fait la bonne règle et la contrainte DB un excès. Les deux options
   ont un coût réel (une migration pour retirer la contrainte, ou une phrase du chapitre 10 à corriger) :
   à trancher par Alexis, pas par cette session.
2. Confirmation d'Alexis sur le texte de D228 lui-même (marque « À VALIDER PAR ALEXIS »).

## Vérification jouée

`CI=1 pnpm verify` lancé en un seul appel, sortie dans `docs/etudes/equipe-2026-10-29/tickets/9J01-verify.txt`.
