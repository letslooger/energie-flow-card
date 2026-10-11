# Energie Flow Card

🇬🇧 English version: [README.md](README.md)

Une carte Home Assistant animée : soleil, batterie, réseau, maison et voiture, avec l'énergie qui circule en temps réel.

## Installation

1. Copie `energie-flow-card.js` dans le dossier `/config/www/` de Home Assistant.
2. Paramètres > Tableaux de bord > ⋮ > Ressources > Ajouter une ressource :
   - URL : `/local/energie-flow-card.js?v=1`
   - Type : Module JavaScript
3. Sur ton tableau de bord : Modifier > Ajouter une carte > Manuel, puis colle le contenu de `exemple_config.yaml`.
4. Remplace les `sensor.xxx` par tes propres capteurs et enregistre.

Si une valeur s'affiche à l'envers (batterie ou réseau), passe `invert_battery` ou `invert_grid` à `true`.
Après une mise à jour du fichier, change `?v=1` en `?v=2` pour forcer le rafraîchissement.
