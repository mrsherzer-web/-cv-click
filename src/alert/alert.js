// The alert: how hot things are with the Sharks (a crew invented for the game). It rises when Nehorai is
// seen where he shouldn't be and while their cars chase him, and cools down with time. Shown as a small
// meter under the money, only while it is above zero. Rival crews only: no police in this game.
export class Alert {
  constructor(game) {
    this.game = game;
    this.level = game.progress.alert || 0;   // 0..100
    this.chasing = false;                    // a chase is on (see vehicle/chaser.js)
    this.label = '';
  }

  raise(amount) { this.level = Math.min(100, this.level + amount); }
  lower(amount) { this.level = Math.max(0, this.level - amount); }

  // 'calm', 'watch' (they are looking), 'chase'
  get state() { return this.chasing ? 'chase' : this.level >= 35 ? 'watch' : 'calm'; }

  update(dt) {
    // cools down by itself, slowly, when nobody is chasing
    if (!this.chasing && this.level > 0) this.lower(dt * (this.game.missions.active ? 0.6 : 1.4));
    this.game.progress.alert = Math.round(this.level);
    const label = this.chasing ? 'מרדף' : this.level >= 35 ? 'הכרישים מחפשים' : this.level > 0 ? 'שקט, בינתיים' : '';
    this.game.hud.setAlert(this.level / 100, label, this.state);
  }
}
