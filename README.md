# Spotails - Cocktail Music Experience 123

Spotails est un site dédié à l'art du cocktail, inspiré par l'univers musical. Le site permet aux utilisateurs de découvrir une variété de cocktails soigneusement sélectionnés, tout en étant immergés dans un univers visuel dynamique, où chaque cocktail est lié à une thématique musicale. En utilisant **Spotail**, les utilisateurs peuvent consulter des informations détaillées sur chaque cocktail, incluant des images, des ingrédients, des recettes et bien plus.

## Technologies Utilisées

### Frontend
- **React.js** : Pour la gestion dynamique de l'interface utilisateur.
- **Bootstrap** : Framework CSS pour la mise en page et les composants.
- **Framer Motion** : Pour les animations et transitions du site.

### Backend
- **Node.js** avec **Express.js** : Pour la gestion du serveur backend et des API.
- **MongoDB** : Base de données NoSQL pour stocker les informations des cocktails, utilisateurs et autres données liées à l'application.
- **JWT (JSON Web Tokens)** : Pour gérer les sessions utilisateurs et sécuriser l'accès aux routes privées.
- **Bcrypt.js** : Pour le hachage et la gestion des mots de passe des utilisateurs.
- **Multer** : Pour gérer l'upload des fichiers (images des cocktails).

### Fonctionnalités

1. **Page d'Accueil (Landing Page)** :
    - Page designée présentant l'application Spotails et promouvant les cocktails thématiques.
    - **Framer Motion** est utilisé pour les animations de cette page.

2. **Page Liste des Cocktails** :
    - Affichage de tous les cocktails disponibles avec un système de tri par favoris.

3. **Page Produit d'un Cocktail** :
    - Chaque cocktail a sa propre page produit contenant :
        - **Image** du cocktail
        - **Bannière** du cocktail
        - **Ingrédients** du cocktail
        - **Recette** détaillée
        - **Description** du cocktail
        - **Référence** à son thème

4. **Gestion des Utilisateurs (Admin)** :
    - **Inscription/Connexion des utilisateurs** via un système sécurisé avec JWT.
    - L'admin peut gérer les utilisateurs inscrits :
        - **Consulter** la liste des utilisateurs. (avec barre de recherche)
        - **Réinitialiser** les mots de passe des utilisateurs en cas de besoin.
        - **Supprimer des utilisateurs** si nécessaire.

5. **Gestion des Cocktails (Admin)** :
    - L'admin peut ajouter, modifier ou supprimer des cocktails via une interface d'administration.
    - Ajout d'images et gestion des propriétés comme le nom, le thème, les ingrédients, la recette, etc.

## Installation du Projet

### Prérequis

1. **Node.js** et **npm** doivent être installés sur votre machine.
2. Une base de données **MongoDB** doit être configurée (ou utiliser MongoDB Community Server).

### Étapes d'Installation

1. Clonez ce repository sur votre machine.
   ```bash
   git clone https://github.com/DallasJr/Spotails.git
   cd spotails
   ```

2. Installez les dépendances pour le backend :
   ```bash
   cd backend
   npm install
   ```

3. Installez les dépendances pour le frontend :
   ```bash
   cd frontend
   npm install
   ```

4. Une connexion MongoDB doit être accessible sous ces informations là (la base de donnée "Spotails" sera crée automatiquement) :
   ```env
   PORT=5000
   MONGO_URI=mongodb://127.0.0.1:27017/spotails
   JWT_SECRET=gYxeeJn72wOOBoPPCB0dwJ13Wp5Pzjs7UwKNwT8A4hRs9KM3U89ih9P8jJGpT8qkfafmpED5eNWlH8dtqq1BA
   ```
   - Modifiez ces informations seulement si votre connexion MongoDB est autre part.
   - Ne touchez pas à JWT_SECRET.
   

5. Lancez le serveur backend :
   ```bash
   cd backend
   npm run dev
   ```

6. Lancez l'application frontend :
   ```bash
   cd frontend
   npm start
   ```

## Admin Dashboard

L'admin a un tableau de bord accessible pour gérer :
- **Les utilisateurs inscrits** : Vue d'ensemble des utilisateurs avec possibilité de réinitialiser leur mot de passe et supprimer l'utilisateur.
- **Les cocktails** : Ajouter, modifier et supprimer des cocktails.

## Auteurs

- Dallas
- Yoann
