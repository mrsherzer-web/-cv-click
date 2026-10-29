// Nehorai, built from his spec in the cast roster.
import { makeCharacter } from '../characters/builder.js';
import { ROSTER } from '../characters/roster.js';

export const makeNehorai = () => makeCharacter(ROSTER.nehorai);
