# Monibook

Reconstruction complète de Monibook. L'ancienne version a été faite avec
Lovable ; cette base repart de zéro, proprement. Ne rien reprendre de
l'ancien code sans le relire et le réécrire selon les règles ci-dessous.

Stack : React + TypeScript + Tailwind + shadcn/ui, Supabase (Postgres,
Auth, Storage, Realtime, Edge Functions).

## 1. Le produit

Monibook est une suite de création de produits digitaux. Un créateur y :

- trouve une niche ;
- génère un ebook complet en PDF ;
- produit ses visuels publicitaires ;
- produit ses vidéos ;
- rédige ses textes de vente.

Tout s'organise autour d'un objet **Projet**. Chaque création appartient
à un projet.

## 2. Règles absolues

Ces règles ne se négocient pas. Un code qui en viole une est un bug.

### Secrets

- Aucune clé d'API ne doit apparaître côté client. Tout appel à un
  service externe passe par une Edge Function.

### Prestataires externes

- Aucun nom de prestataire externe ne doit apparaître dans l'interface ni
  dans le code métier.
- Les prestataires vivent derrière une couche d'abstraction nommée par
  service : `text`, `image`, `video`, `voice`, `ads`. Le code métier
  n'appelle que ces services.
- L'utilisateur ne voit que Monibook.

### Générations

- Toute génération coûteuse est un **job** enregistré en base, avec
  statut et progression.
- Jamais de génération dans la requête HTTP.
- Jamais de sauvegarde qui dépend du navigateur resté ouvert : le
  résultat est persisté côté serveur, que l'utilisateur soit encore là
  ou non.

### Crédits

- Les crédits sont **réservés** au lancement d'un job, **débités** à la
  réussite, **libérés** à l'échec.
- Le solde se calcule depuis la table append-only `credit_transactions`,
  jamais depuis une colonne modifiable.
- Le coût en crédits est affiché à l'utilisateur avant chaque action.
- Le mot « illimité » est interdit dans toute l'interface.

### Accès

- Il n'existe aucun plan d'abonnement. L'accès est binaire :
  `has_access` vrai ou faux.
- Ne jamais coder de vérification de niveau de plan.

### Actifs

- Tout actif généré porte un `project_id`.

### Edge Functions

- Chaque Edge Function valide ses entrées avec zod.
- Chaque Edge Function vérifie l'identité de l'appelant à partir de son
  jeton d'authentification.
- Ne jamais faire confiance à un `user_id` venant du corps de la requête.

## 3. Interface

- Tout en français, vouvoiement.
- Prix en FCFA sans décimale, au format `1 500 FCFA`.
- Mobile d'abord : chaque écran est conçu en 360 px avant d'être adapté
  au bureau.
- Prévoir des connexions lentes : images compressées, chargements légers.
- Jamais d'élément d'interface non fonctionnel : pas de barre de
  recherche décorative, pas de « bientôt disponible ». Ce qui n'est pas
  prêt n'apparaît pas.

## 4. Conventions

- Migrations SQL versionnées dans `supabase/migrations`.
- Montants et crédits en entiers, jamais en flottant.
- Toute opération sur l'argent est atomique et journalisée dans
  `audit_log`.

## 5. Repères techniques

- Barème et choix des fournisseurs : table `settings` (`credit_costs`
  lisible par le client, `providers` réservé au serveur). Un type de job
  sans prix dans `credit_costs` ne peut pas être lancé.
- Crédits et jobs ne bougent que par les fonctions SQL `create_job`,
  `claim_jobs`, `set_job_progress`, `complete_job`, `fail_job`,
  `recover_stale_jobs` (rôle service uniquement). Ne jamais écrire
  directement dans `jobs` ou `credit_transactions`.
- Fournisseurs : `supabase/functions/_shared/services/<service>/`. Un
  adaptateur par fournisseur, déclaré dans le `index.ts` du service ; ses
  clés sont des secrets d'Edge Function.
- Ajouter un module de génération : un exécuteur dans
  `_shared/jobs/kinds/` déclaré dans `registry.ts`, un formulaire de
  lancement dans `src/features/projects/launchers/` déclaré dans
  `modules.ts` (ou un onglet complet `Tab`), puis un prix dans
  `settings.credit_costs`. L'onglet n'apparaît qu'une fois les trois en
  place.
- Contexte projet : les exécuteurs lisent le projet (offre comprise :
  bénéfices, appel à l'action, garantie) et l'ebook via
  `_shared/projects/context.ts` (`loadOwnedProject`,
  `renderProjectBrief`). Un formulaire pré-remplit depuis le projet et
  n'y enregistre que ce qui manquait.
- Visuels : un lot `ad_visuals` = 4 concepts, chaque visuel stocké dès
  qu'il existe sous `{user}/{projet}/visuals/{job}/` ; les actifs sont
  déclarés à la fin, avec le débit. Textes : un type de job `copy_*` par
  type de texte ; les variations restent dans la sortie du job, le texte
  choisi est enregistré dans `copy_texts`.
- Tests : `npm test` et `npx tsc -b` (client),
  `deno task test` dans `supabase/functions`,
  `supabase/tests/db/run.sh no-defaults` (base, Postgres local).
