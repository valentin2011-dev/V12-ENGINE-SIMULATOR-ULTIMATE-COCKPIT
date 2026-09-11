[README.md](https://github.com/user-attachments/files/32116901/README.md)
# V12 Engine Simulator — ULTIMATE COCKPIT

Refonte complète de l'interface portrait + paysage.

## Interface
- Cockpit central avec gros compte-tours circulaire.
- Vitesse + rapport au centre.
- Bouton START ENGINE rouge au centre.
- Palettes + / − visuellement inspirées de vraies palettes de cockpit.
- Pedal box avec 3 pédales : DECEL / BRAKE / THROTTLE.
- COMFORT / SPORT / SPORT+.
- Track Cockpit dédié en paysage.

## Audio
Le système utilise directement l'enregistrement V12 original fourni : `assets/audio/v12_source.mp3`.

Le moteur audio Web Audio utilise plusieurs fenêtres du même enregistrement réel, crossfadées selon le régime, avec variation de playbackRate, filtre, compression, réponse à l'accélérateur, frein moteur et transitoires de changement de rapport. Aucun oscillateur synthétique n'est utilisé.

## Commandes
- START ENGINE : démarrer / arrêter.
- + / − : rapports.
- Pédale THROTTLE : accélérateur.
- Pédale DECEL : frein moteur.
- Pédale BRAKE : frein.
- Curseur THROTTLE : alternative tactile.
- SOUND ON/OFF : audio.
- Clavier : Espace = start, ←/→ = rapports, ↑/↓ = accélérateur.

## GitHub Pages
Publier tout le dossier. Garder `assets/audio/v12_source.mp3` au même emplacement.
