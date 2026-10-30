// The phone: a list of the friends Nehorai has met, each with a button to call. The game stops while
// it is open. A call a mission is waiting for moves the mission on (the contact is highlighted and the
// phone button shows a dot); any other call is a short chat, and Dolev, once he is in the crew, comes over.
import { VOICES } from './dialogue.js';
import { onPress } from '../input/controls.js';

const $ = (id) => document.getElementById(id);
const PEOPLE = [
  { id: 'avraham', name: 'אברהם', needs: 'friends' },
  { id: 'yonati', name: 'יונתי', needs: 'friends' },
  { id: 'erez', name: 'ארז', needs: 'friends' },
  { id: 'muller', name: 'מולר', needs: 'friends' },
  { id: 'dolev', name: 'דולב', needs: 'dolev' },
  { id: 'hadar', name: 'הדר', needs: 'hadar' },
];

export class Phone {
  constructor(game) {
    this.game = game;
    this.isOpen = false;
    this.btn = $('phoneBtn');
    this.panel = $('phone');
    this.list = $('contacts');
    onPress(this.btn, () => this.open());
    $('phoneClose').addEventListener('click', () => this.close());
    this.shown = '';
  }

  contacts() { return PEOPLE.filter((p) => this.game.has(p.needs)); }

  // once a frame: show the button when there is someone to call, with a dot when a mission wants a call
  refresh() {
    const people = this.contacts(), wanted = this.game.wantedCall();
    const key = `${people.length}:${wanted}:${this.game.mode}`;
    if (key === this.shown) return;
    this.shown = key;
    this.btn.hidden = !people.length;
    $('phoneBadge').hidden = !wanted;
  }

  open() {
    if (this.isOpen || this.game.hold || this.game.cutscene) return;
    this.isOpen = true;
    this.game.hold = true;
    this.game.controls.reset();
    this.game.controls.enabled = false;
    const wanted = this.game.wantedCall();
    this.list.replaceChildren(...this.contacts().map((p) => {
      const row = document.createElement('div');
      row.className = 'contact';
      const name = document.createElement('span');
      name.className = 'contact-name';
      const dot = document.createElement('span');
      dot.className = 'contact-dot';
      dot.style.background = VOICES[p.name] || 'var(--accent)';
      name.append(dot, p.name);
      const note = this.game.contactNote(p.id);
      if (note) { const small = document.createElement('small'); small.textContent = note; name.append(small); }
      const call = document.createElement('button');
      call.type = 'button';
      call.textContent = 'להתקשר';
      call.setAttribute('aria-label', `להתקשר ל${p.name}`);
      if (wanted === p.id) call.classList.add('wanted');
      call.dataset.id = p.id;
      call.addEventListener('click', () => { this.close(); this.game.call(p.id); });
      row.append(name, call);
      return row;
    }));
    this.panel.hidden = false;
    this.list.querySelector('button')?.focus({ preventScroll: true });
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.panel.hidden = true;
    this.game.hold = false;
    this.game.controls.enabled = true;
  }
}
