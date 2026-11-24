/* Chapter 3 "THE CREW": the mission script (Phase 2). Until then a placeholder: the hero and a car downtown. */
const HCrewStory = {
  H: null,
  begin(H, free) {
    this.H = H;
    const x = -105, z = 3.5;
    H.spawnPlayer(x + 3, z + 3, Math.PI / 2);
    H.setPlayerCar(H.makeCar('sports', x, z, Math.PI / 2));
    H.tod = 1.35; H.todTarget = null; H.applyTod();
    HAI.maxTraffic = 12; HAI.patrols = 0;
    H.state = 'play';
  },
  update(dt) {},
  blips() { return []; },
  safeZone(x, z) { return false; },
  onEnterCar(v) {}, onExitCar(v) {},
  fail(kind) { const H = this.H; if (H.state !== 'play') return; HAI.reset(); H.player.hp = 100; if (H.player.inCar) H.exitCar(); },
  stop() { this.H = null; },
};
window.HCrewStory = HCrewStory;
