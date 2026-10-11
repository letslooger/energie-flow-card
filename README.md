# Energie Flow Card

An animated Home Assistant card: sun, battery, grid, house and car, with energy flowing in real time.

🇫🇷 Version française : [LISEZMOI.md](LISEZMOI.md)

## Installation

1. Copy `energie-flow-card.js` into Home Assistant's `/config/www/` folder.
2. Settings > Dashboards > ⋮ > Resources > Add resource:
   - URL: `/local/energie-flow-card.js?v=1`
   - Type: JavaScript module
3. On your dashboard: Edit > Add card > Manual, then paste the content of `exemple_config.yaml`.
4. Replace each `sensor.xxx` with your own sensors and save.

If a value shows the wrong way round (battery or grid), set `invert_battery` or `invert_grid` to `true`.
After updating the file, change `?v=1` to `?v=2` to force a refresh.

Note: the card's on-screen labels are in French.
