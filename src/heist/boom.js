/* Chapter 3: explosions and gadgets — sticky bombs, the gas-cylinder trap, nitro. Contract: crew_spec.md section E2. */
const HBoom = {
  bombs: 0, nitro: { owned: false, charge: 1 },
  init(H) {}, reset() {}, explode(x, y, z, o) { return 0; }, dropBomb(car) {}, placeTrap(x, z) {}, detonateTrap() {}, updateNitro(dt, car, held) {},
};
window.HBoom = HBoom;
