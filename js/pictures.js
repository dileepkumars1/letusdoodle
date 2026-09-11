// Registry of all coloring pictures, in the order they unlock.
export const PICTURES = [
  { id: 'cat', title: 'Cute Cat', theme: 'Animals', svg: 'assets/pictures/cat.svg' },
  { id: 'sun-clouds', title: 'Sunny Sky', theme: 'Nature', svg: 'assets/pictures/sun-clouds.svg' },
  { id: 'car', title: 'Zoomy Car', theme: 'Vehicles', svg: 'assets/pictures/car.svg' },
  { id: 'flower', title: 'Pretty Flower', theme: 'Nature', svg: 'assets/pictures/flower.svg' },
  { id: 'dog', title: 'Happy Dog', theme: 'Animals', svg: 'assets/pictures/dog.svg' },
  { id: 'balloon', title: 'Balloons', theme: 'Fun', svg: 'assets/pictures/balloon.svg' },
  { id: 'rocket', title: 'Space Rocket', theme: 'Vehicles', svg: 'assets/pictures/rocket.svg' },
  { id: 'fish', title: 'Little Fish', theme: 'Animals', svg: 'assets/pictures/fish.svg' },
  { id: 'house', title: 'Cozy House', theme: 'Fun', svg: 'assets/pictures/house.svg' },
  { id: 'butterfly', title: 'Butterfly', theme: 'Animals', svg: 'assets/pictures/butterfly.svg' },
  { id: 'sailboat', title: 'Sailboat', theme: 'Vehicles', svg: 'assets/pictures/sailboat.svg' },
  { id: 'tree', title: 'Big Tree', theme: 'Nature', svg: 'assets/pictures/tree.svg' },
  { id: 'owl', title: 'Wise Owl', theme: 'Animals', svg: 'assets/pictures/owl.svg' },
  { id: 'ice-cream', title: 'Ice Cream', theme: 'Fun', svg: 'assets/pictures/ice-cream.svg' },
  { id: 'rainbow', title: 'Rainbow', theme: 'Nature', svg: 'assets/pictures/rainbow.svg' },
  { id: 'elephant', title: 'Elephant', theme: 'Animals', svg: 'assets/pictures/elephant.svg' },
  { id: 'train', title: 'Choo-Choo Train', theme: 'Vehicles', svg: 'assets/pictures/train.svg' },
  { id: 'turtle', title: 'Slow Turtle', theme: 'Animals', svg: 'assets/pictures/turtle.svg' },
];

export function pictureIndex(id) {
  return PICTURES.findIndex((p) => p.id === id);
}
