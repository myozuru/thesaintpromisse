export function random(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

let _id = 0;
export function generateDiceId() {
  _id++;
  return `${_id}`;
}
