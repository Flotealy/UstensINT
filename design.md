# Charte Graphique & Architecture Design Frontend (CookIt)

Ce document spécifie le système de design et l'ergonomie de l'application CookIt. Le design de CookIt s'inspire du concept de **"Magazine Éditorial"** : une interface épurée, une typographie contrastée combinant un empattement classique (serif) et un style moderne sans-serif, ainsi qu'une palette de couleurs cohérente basée sur des tonalités de bleu-turquoise et de papier frais.

---

## 1. Principes & Vision du Design

Le design de CookIt repose sur trois piliers :
1. **Clarté Éditoriale** : Les recettes de cuisine sont présentées comme dans un livre de recettes papier haut de gamme. Les polices et espacements favorisent la lecture active en cuisine.
2. **Ergonomie Modulaire** : L'édition d'une recette ou la composition d'un menu se fait par blocs réordonnables, réduisant la friction cognitive.
3. **Palette Turquoise Cohérente** : Les couleurs de l'interface reflètent directement les styles configurés dans les templates d'export PDF LaTeX (`cookit.sty`), assurant une continuité visuelle parfaite entre le web et le papier.

---

## 2. Design Tokens (Système de Design)

Les variables globales sont définies dans `index.css` et servent de référence unique pour toute l'interface.

### Palette de Couleurs

| Rôle | Variable CSS | Valeur Hexa | Usage / Rendu |
| :--- | :--- | :--- | :--- |
| **Fond (Canvas)** | `--bg` | `#eef3f4` | Fond papier froid légèrement bleuté |
| **Surfaces** | `--surface` | `#ffffff` | Cartes, panneaux, formulaires |
| **Surfaces teintées**| `--surface-tint` | `#e2eff1` | Zones de dépôt, en-têtes alternatifs |
| **Bordures & Lignes**| `--line` / `--line-soft`| `#cbdde0` / `#e1ebed`| Séparateurs fins |
| **Texte Principal** | `--ink` / `--ink-strong`| `#0f2a31` / `#04181e`| Noir avec sous-ton turquoise |
| **Texte Secondaire** | `--ink-soft` | `#4c6a72` | Légendes, placeholders, textes d'aide |
| **Primaire** | `--primary` | `#0d6284` | Boutons d'action principaux, liens |
| **Primaire Foncé** | `--primary-deep` | `#012d38` | Barre latérale (Sidebar), en-têtes de recette |
| **Primaire Doux** | `--primary-soft` | `#d6e8ee` | Badges, boutons secondaires |
| **Accentuation** | `--accent` | `#48bcbc` | Indicateur d'état actif, boutons de confirmation |
| **Accentuation Foncé**| `--accent-deep` | `#2f9a9a` | Survol des boutons d'action |
| **Sémantique Danger** | `--berry` / `--danger` | `#d23c3c` | Suppressions, alertes d'erreur, états destructifs |

> [!NOTE]
> Les couleurs secondaires de section (`--herb` pour le vert et `--butter` pour le bleu-jaune doux) permettent de distinguer visuellement les sous-recettes ou les types d'ingrédients. Le rouge (`--berry`) est réservé **exclusivement** aux actions destructives ou critiques.

### Typographie

CookIt utilise une combinaison de deux polices chargées via Google Fonts :
- **Serif (Titres)** : `"Newsreader"` (ou Georgia). Apporte le côté littéraire, haut de gamme et magazine aux titres de pages (`h1`, `h2`, `h3`) et aux en-têtes de recettes.
- **Sans-serif (Interface & Saisie)** : `"Roboto"` (ou polices système). Utilisé pour le corps de texte, les formulaires, les boutons et les tableaux afin de garantir une lisibilité optimale et un aspect utilitaire propre.

### Formes & Profondeur

Le design utilise des angles arrondis et des ombres douces basées sur le ton turquoise foncé (`--primary-deep`) pour donner du relief sans surcharger :
- **Rayon large (`--radius-lg` : 18px)** : Pour les grands conteneurs de page (`.panel`, `.card`).
- **Rayon moyen (`--radius-md` : 12px)** : Pour les éléments de navigation et les boutons de navigation.
- **Rayon petit (`--radius-sm` : 9px)** : Pour les boutons d'action, les champs de saisie et les sélections.
- **Ombres (`--shadow-soft` & `--shadow-lift`)** : Effet de surélévation progressif lors du survol ou du glisser-déposer.

---

## 3. Structure Layout & Shell de l'Application

L'application utilise un gabarit à deux zones principales (`.app-shell`) :
1. **La Sidebar (Rail de navigation de gauche)** :
   - Fixée à gauche (`width: 88px`), de couleur foncée (`--primary-deep`).
   - Contient le logo blob CookIt en haut, suivi d'un empilement vertical d'icônes avec libellés textuels compacts (Recherche, Générateur, Menu, Recettes, Ingrédients, Admin).
   - Comporte un indicateur vertical turquoise vif (`--accent`) à gauche de l'onglet actif.
   - En bas, affiche l'avatar de l'utilisateur avec une pastille colorée représentant son rôle (ex. rouge pour `admin`, bleu pour `editor`, vert pour `viewer`).
2. **Le Contenu Principal (`.app-content`)** :
   - S'étend sur le reste de la largeur disponible.
   - Affiche une barre d'action supérieure (`.actionbar`) collée au défilement (`position: sticky`), contenant le titre de la page actuelle et les actions contextuelles rapides (ex: Enregistrer, Exporter en PDF).

---

## 4. Interfaces & Écrans Spécifiques

### Page de Connexion (LoginPage)
- **Design Split-screen** : À gauche, un grand panneau sombre de couleur `--primary-deep` avec un dégradé radial lumineux, présentant le titre du site ("CookIt"), la baseline éditoriale et une fine ligne d'accentuation. À droite, un espace clair centré hébergeant le formulaire de connexion.
- **Accès Invité** : Permet une connexion instantanée en tant que visiteur en un clic via un bouton discret sous le formulaire.

### Générateur de Recettes (GeneratorPage)
C'est le cœur de l'application. La page est divisée en deux colonnes asymétriques :
- **Zone Principale (Gauche)** : L'éditeur de document de recette. Permet de définir le titre, la durée, le nombre de portions, le niveau de difficulté, un texte d'en-tête, et de gérer une liste dynamique de sections.
- **Barre Latérale d'Édition (Droite - width: 320px)** : Contient les boutons rapides pour ajouter des sections (ex. "Ajouter une sous-recette", "Ajouter un bloc de texte"), éditer les encarts en bas de page, ou voir l'historique.

### Menu & Liste de Courses (MenuPage)
- Permet de planifier un repas en ajoutant des recettes de la base et en définissant le nombre de lots (batches) ou portions souhaitées.
- **Calculateur de Coût** : Affiche un graphique ou un résumé des coûts estimés de la liste de courses en fonction des prix unitaires enregistrés pour les ingrédients.
- **Liste consolidée (ShoppingList)** : Combine automatiquement les ingrédients identiques issus de différentes recettes, fait la somme des quantités requises et les classe par rayon/catégorie pour faciliter l'achat.

### Tableaux d'Administration et Tables de Données
- Utilisés dans `AdminPage` et `IngredientsPage`.
- Structure épurée : En-têtes de colonnes en majuscules discrètes (`--ink-soft`), lignes séparées par des bordures ultra-fines (`--line-soft`), et alignement propre.
- Présence d'actions en fin de ligne (modifier, supprimer) représentées par des boutons arrondis et réactifs.

---

## 5. Composants Dynamiques & Micro-interactions

### Éditeur RichText (RichTextEditor)
- Encapsule un élément HTML `contentEditable` stylisé à l'image d'une zone de texte classique.
- Propose une barre d'outils flottante discrète dans le coin inférieur droit permettant de mettre en gras (`B`) ou en italique (`I`) la sélection textuelle, s'activant uniquement au focus pour éviter d'encombrer l'écran.

### Glisser-Déposer (Reorder & Drag)
- Les sections de recettes (sous-recettes et textes) intègrent une poignée de déplacement (`.grip`).
- L'action de survol change le curseur en `grab` et applique une légère élévation visuelle (`--shadow-lift` et translation vers le haut) sur le conteneur déplacé pour matérialiser l'interaction.

### Saisie Assistée d'Ingrédients (AddIngredientModal)
- Modale adaptative s'ouvrant par-dessus l'éditeur de recette.
- Propose une recherche semi-automatique avec suggestions basées sur la table des ingrédients en base de données (`DbIngredient`), évitant les erreurs de saisie et assurant l'harmonisation des unités par défaut.
