/* Chapter 3: IRONSIDE ARMORY — the gun-store interior and its purchase menu. Contract: crew_spec.md section D. */
const HShop = {
  open(H, opts) { if (opts && opts.onDone) opts.onDone({ bought: (opts.items || []).filter(i => i.required).map(i => i.id), spent: 0, left: opts.budget || 0 }); },
  close(silent) {},
};
window.HShop = HShop;
