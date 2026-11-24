/* Chapter 3 "THE CREW": the three playable crew members (Yoav, Hadar, Ido) and GTA-style character switching
   (crew wheel, sky-cam transition, seated passengers, abilities). Contract: scratchpad crew_spec.md section C. */
const HCrew = {
  active: false, members: [],
  setup(H, opts) {},
  cur() { return null; },
  member(id) { return null; },
  stop() { this.active = false; this.members = []; },
};
window.HCrew = HCrew;
