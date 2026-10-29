// The viewer at the lookout plaza: always there to use, a look out over the coastal plain to the sea.
import { near } from './missions.js';

export class Lookout {
  constructor(world) {
    this.world = world;
    this.state = 'ready';  // ready → looking → ready (counts uses)
    this.uses = 0;
  }

  interaction(game) {
    const t = this.world.places.telescope;
    if (game.mode !== 'foot' || game.follow.override || this.state === 'looking' || !near(game.player.pos, t, 2.6)) return null;
    return { label: 'להסתכל', priority: 2, run: () => this.look(game) };
  }

  look(game) {
    const t = this.world.places.telescope;
    this.state = 'looking';
    this.uses++;
    const from = { x: t.x + t.dx * 0.5, y: t.y + 1.4, z: t.z + t.dz * 0.5 };
    const look = { x: t.x + t.dx * 400, y: t.y - 40, z: t.z + t.dz * 400 };
    game.follow.shot(from, look, 5.5);
    game.dialogue.play([{ who: '', text: 'מכאן רואים את מישור החוף עד הים, ואת הארובות של חדרה.', ms: 5200 }]).then(() => { this.state = 'ready'; });
  }
}
