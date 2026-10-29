// What the garage can do to the Renault, and what each thing changes. Bought upgrades are saved with
// the car; the engine tune can also come as a mission reward.
export const UPGRADES = [
  { id: 'engine', name: 'כוונון מנוע', note: 'מהירה וחזקה יותר', price: 600 },
  { id: 'tires', name: 'צמיגים חדשים', note: 'אחיזה טובה יותר בפניות', price: 350 },
  { id: 'brakes', name: 'בלמים', note: 'עוצרת מהר יותר', price: 300 },
  { id: 'body', name: 'חיזוק מרכב', note: 'פחות נזק במכות', price: 450 },
];
export const COLORS = [
  { id: 'white', name: 'לבן', hex: '#f3f4f6', price: 0 },
  { id: 'red', name: 'אדום', hex: '#b8322a', price: 200 },
  { id: 'black', name: 'שחור', hex: '#1e2024', price: 200 },
  { id: 'blue', name: 'כחול', hex: '#2f5e8f', price: 200 },
  { id: 'silver', name: 'כסוף', hex: '#a9b0b7', price: 200 },
  { id: 'sand', name: 'חול', hex: '#d9c9a0', price: 200 },
];
export const repairCost = (health) => Math.ceil((100 - health) * 2.5);

// set a car's numbers from what it has
export function applyUpgrades(car, owned) {
  const has = (id) => owned.includes(id);
  car.maxSpeed = has('engine') ? 33 : 30;
  car.accel = has('engine') ? 8.4 : 7.2;
  car.tune.grip = has('tires') ? 1.18 : 1;
  car.tune.brake = has('brakes') ? 1.25 : 1;
  car.tune.armor = has('body') ? 0.65 : 1;
}
