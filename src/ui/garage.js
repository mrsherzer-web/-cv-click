// The garage screen ("Junction Garage", invented for the game): repair the Renault, repaint it, or buy
// an upgrade. Every button says its price and is only enabled when it can actually be done.
import { UPGRADES, COLORS, repairCost } from '../vehicle/upgrades.js';

const $ = (id) => document.getElementById(id);

export class Garage {
  constructor(game) {
    this.game = game;
    this.isOpen = false;
    $('garageClose').addEventListener('click', () => this.close());
    $('repairBtn').addEventListener('click', () => this.buy('repair'));
  }

  open() {
    if (this.isOpen) return;
    this.isOpen = true;
    const g = this.game;
    g.hold = true;
    g.controls.reset();
    g.controls.enabled = false;
    this.render();
    $('garage').hidden = false;
    $('garageClose').focus({ preventScroll: true });
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    $('garage').hidden = true;
    const g = this.game;
    g.hold = false;
    g.controls.enabled = true;
    g.save();
  }

  render(note = '') {
    const g = this.game, car = g.car, money = g.progress.money, owned = g.ownedUpgrades();
    const cost = repairCost(car.health);
    $('garageHealth').textContent = `מצב הרכב: ${Math.round(car.health)}%`;
    const rb = $('repairBtn');
    rb.textContent = cost ? `לתקן · ${cost} ₪` : 'הרכב שלם';
    rb.disabled = !cost || money < cost;
    $('swatches').replaceChildren(...COLORS.map((c) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'swatch';
      b.style.background = c.hex;
      const current = g.progress.car.color === c.hex;
      b.setAttribute('aria-pressed', String(current));
      b.setAttribute('aria-label', `${c.name}${c.price ? ` · ${c.price} ₪` : ''}`);
      b.title = b.getAttribute('aria-label');
      b.disabled = current || money < c.price;
      b.addEventListener('click', () => this.buy('paint', c));
      return b;
    }));
    $('upgrades').replaceChildren(...UPGRADES.map((u) => {
      const row = document.createElement('div');
      row.className = 'upgrade';
      const label = document.createElement('div');
      label.innerHTML = `<b></b><small></small>`;
      label.querySelector('b').textContent = u.name;
      label.querySelector('small').textContent = u.note;
      let right;
      if (owned.includes(u.id)) { right = document.createElement('span'); right.className = 'owned'; right.textContent = 'מותקן'; }
      else {
        right = document.createElement('button');
        right.type = 'button';
        right.className = 'buy';
        right.textContent = `${u.price} ₪`;
        right.setAttribute('aria-label', `לקנות ${u.name} ב־${u.price} ₪`);
        right.disabled = money < u.price;
        right.dataset.id = u.id;
        right.addEventListener('click', () => this.buy('upgrade', u));
      }
      row.append(label, right);
      return row;
    }));
    $('garageNote').textContent = note || `בכיס: ${money.toLocaleString('he-IL')} ₪`;
  }

  buy(kind, item) {
    const g = this.game, car = g.car;
    let note = '';
    if (kind === 'repair') {
      const cost = repairCost(car.health);
      if (!cost || g.progress.money < cost) return;
      g.addMoney(-cost);
      car.repair();
      note = 'הרנו כמו חדשה.';
    } else if (kind === 'paint') {
      if (g.progress.money < item.price) return;
      g.addMoney(-item.price);
      g.paintCar(item.hex);
      note = `צבע חדש: ${item.name}.`;
    } else if (kind === 'upgrade') {
      if (g.progress.money < item.price || g.ownedUpgrades().includes(item.id)) return;
      g.addMoney(-item.price);
      g.progress.car.upgrades.push(item.id);
      g.applyCar();
      note = `הותקן: ${item.name}.`;
    }
    this.render(note);
  }
}
