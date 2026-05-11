// ============================================================
// Starlight Engine — World Data
// ============================================================

export const FURNITURE_CATALOG = [
  { id: 'chair', name: 'Wooden Chair', price: 50, icon: '\uD83E\uDE91', footprint: [1, 1], stackable: false, desc: 'A simple wooden chair.' },
  { id: 'table', name: 'Dining Table', price: 120, icon: '\uD83E\uDEB5', footprint: [2, 1], stackable: false, desc: 'Perfect for meals.' },
  { id: 'lamp', name: 'Golden Lamp', price: 80, icon: '\uD83D\uDE94', footprint: [1, 1], stackable: true, desc: 'Light up your room.' },
  { id: 'bed', name: 'Cozy Bed', price: 200, icon: '\uD83D\uDECF\uFE0F', footprint: [2, 2], stackable: false, desc: 'Sleep in comfort.' },
  { id: 'plant', name: 'Potted Plant', price: 40, icon: '\uD83E\uDEB4', footprint: [1, 1], stackable: true, desc: 'Bring nature indoors.' },
  { id: 'tv', name: 'Retro TV', price: 300, icon: '\uD83D\uDCFA', footprint: [1, 1], stackable: false, desc: 'Watch classic shows.' },
  { id: 'rug', name: 'Persian Rug', price: 150, icon: '\uD83E\uDDF6', footprint: [2, 2], stackable: false, desc: 'Adds warmth to floors.' },
  { id: 'sofa', name: 'Velvet Sofa', price: 250, icon: '\uD83D\uDECB\uFE0F', footprint: [2, 1], stackable: false, desc: 'Luxurious seating.' },
  { id: 'fridge', name: 'Cool Fridge', price: 180, icon: '\uD83E\uDDCA', footprint: [1, 1], stackable: false, desc: 'Keep food fresh.' },
  { id: 'bookshelf', name: 'Bookshelf', price: 160, icon: '\uD83D\uDCDA', footprint: [1, 1], stackable: false, desc: 'Store your books.' },
  { id: 'fountain', name: 'Water Fountain', price: 500, icon: '\u26F2', footprint: [2, 2], stackable: false, desc: 'Relaxing water feature.' },
  { id: 'piano', name: 'Grand Piano', price: 800, icon: '\uD83C\uDFB9', footprint: [2, 1], stackable: false, desc: 'Make beautiful music.' },
  { id: 'dragon', name: 'Toy Dragon', price: 1000, icon: '\uD83D\uDC09', footprint: [1, 1], stackable: true, desc: 'A rare collectible!' },
  { id: 'statue', name: 'Marble Statue', price: 750, icon: '\uD83D\uDDFF', footprint: [1, 1], stackable: false, desc: 'A work of art.' },
  { id: 'clock', name: 'Grandfather Clock', price: 350, icon: '\uD83D\uDD70\uFE0F', footprint: [1, 1], stackable: false, desc: 'Ticks and tocks.' },
  { id: 'chest', name: 'Treasure Chest', price: 450, icon: '\uD83D\uDCE6', footprint: [1, 1], stackable: false, desc: "What's inside?" },
  { id: 'mirror', name: 'Ornate Mirror', price: 280, icon: '\uD83E\uDE9F', footprint: [1, 1], stackable: false, desc: 'Reflect your style.' },
  { id: 'vase', name: 'Decorative Vase', price: 60, icon: '\uD83C\uDFFA', footprint: [1, 1], stackable: true, desc: 'Fine ceramic craftsmanship.' },
  { id: 'trophy', name: 'Gold Trophy', price: 600, icon: '\uD83C\uDFC6', footprint: [1, 1], stackable: true, desc: 'A symbol of victory.' },
  { id: 'jukebox', name: 'Retro Jukebox', price: 550, icon: '\uD83C\uDFB5', footprint: [1, 1], stackable: false, desc: 'Play your favorite tunes.' },
  { id: 'arcade', name: 'Arcade Machine', price: 700, icon: '\uD83C\uDFAE', footprint: [1, 1], stackable: false, desc: 'High score chasing.' },
  { id: 'barrel', name: 'Wooden Barrel', price: 45, icon: '\uD83E\uDE92', footprint: [1, 1], stackable: false, desc: 'Store goods or roll around.' },
  { id: 'bench', name: 'Park Bench', price: 120, icon: '\uD83E\uDE91', footprint: [2, 1], stackable: false, desc: 'Sit and enjoy the view.' },
  { id: 'fireplace', name: 'Stone Fireplace', price: 500, icon: '\uD83D\uDD25', footprint: [2, 1], stackable: false, desc: 'Warm and cozy.' },
  { id: 'chandelier', name: 'Crystal Chandelier', price: 450, icon: '\uD83D\uDCA1', footprint: [1, 1], stackable: true, desc: 'Dazzling light display.' },
  { id: 'neon_sign', name: 'Neon Sign', price: 300, icon: '\uD83D\uDD06', footprint: [1, 1], stackable: false, desc: 'Brighten up your space.' },
  { id: 'window', name: 'Bay Window', price: 220, icon: '\uD83D\uDED7', footprint: [1, 1], stackable: false, desc: 'Let the light in.' },
  { id: 'door', name: 'Wooden Door', price: 180, icon: '\uD83D\uDEAA', footprint: [1, 1], stackable: false, desc: 'Enter in style.' },
  { id: 'stove', name: 'Kitchen Stove', price: 320, icon: '\uD83C\uDF73', footprint: [1, 1], stackable: false, desc: 'Cook up a storm.' },
  { id: 'dresser', name: 'Wooden Dresser', price: 260, icon: '\uD83D\uDECB\uFE0F', footprint: [2, 1], stackable: false, desc: 'Organize your clothes.' },
  { id: 'wardrobe', name: 'Tall Wardrobe', price: 340, icon: '\uD83D\uDCBC', footprint: [1, 1], stackable: false, desc: 'Spacious clothing storage.' },
  { id: 'sink', name: 'Bathroom Sink', price: 200, icon: '\uD83D\uDEBF', footprint: [1, 1], stackable: false, desc: 'Wash up.' },
  { id: 'toilet', name: 'Porcelain Toilet', price: 150, icon: '\uD83D\uDEBD', footprint: [1, 1], stackable: false, desc: 'Essential comfort.' },
  { id: 'bathtub', name: 'Clawfoot Bathtub', price: 400, icon: '\uD83D\uDEC1', footprint: [2, 1], stackable: false, desc: 'Soak and relax.' },
  { id: 'pet_bed', name: 'Pet Bed', price: 80, icon: '\uD83D\uDC3E', footprint: [1, 1], stackable: false, desc: 'Comfy spot for pets.' },
  { id: 'food_bowl', name: 'Pet Bowl', price: 30, icon: '\uD83E\uDD63', footprint: [1, 1], stackable: true, desc: 'Feed your furry friends.' },
  { id: 'laptop', name: 'Laptop Computer', price: 500, icon: '\uD83D\uDCBB', footprint: [1, 1], stackable: false, desc: 'Stay connected.' },
  { id: 'phone', name: 'Rotary Phone', price: 90, icon: '\uD83D\uDCDE', footprint: [1, 1], stackable: true, desc: 'Old-school communication.' },
  { id: 'radio', name: 'Vintage Radio', price: 130, icon: '\uD83D\uDCFB', footprint: [1, 1], stackable: false, desc: 'Tune in to good vibes.' },
  { id: 'guitar', name: 'Acoustic Guitar', price: 350, icon: '\uD83C\uDFB8', footprint: [1, 1], stackable: false, desc: 'Strum a melody.' },
  { id: 'easel', name: 'Artist easel', price: 110, icon: '\uD83C\uDFA8', footprint: [1, 1], stackable: false, desc: 'Paint your masterpiece.' }
];

export const ROOM_TEMPLATES = [
  {
    id: 'lobby', name: 'Main Lobby', description: 'Welcome to Starlight Inn! The heart of the hotel.',
    width: 14, height: 12, floor: 'marble', wall: '#5D6D7E',
    map: [
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,0,0,0,0,0,0,1,1,1,1],[1,1,1,0,0,0,0,0,0,0,0,1,1,1],
      [1,1,0,0,0,0,0,0,0,0,0,0,1,1],[1,1,0,0,0,0,0,0,0,0,0,0,1,1],
      [1,1,0,0,0,0,0,0,0,0,0,0,1,1],[1,1,0,0,0,0,0,0,0,0,0,0,1,1],
      [1,1,1,0,0,0,0,0,0,0,0,1,1,1],[1,1,1,1,0,0,0,0,0,0,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1,1,1]
    ],
    furniture: [
      { type: 'sofa', x: 3, y: 4, z: 0 }, { type: 'sofa', x: 9, y: 4, z: 0 },
      { type: 'lamp', x: 6, y: 5, z: 0 }, { type: 'plant', x: 2, y: 9, z: 0 },
      { type: 'plant', x: 11, y: 2, z: 0 }, { type: 'fountain', x: 5, y: 6, z: 0 }
    ],
    scenery: [{ type: 'lobby_desk', x: 6, y: 2 }]
  },
  {
    id: 'beach', name: 'Sunny Beach', description: 'Relax by the waves and enjoy the sun.',
    width: 16, height: 12, floor: 'sand', wall: '#D4AC0D',
    map: [
      [1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0],[1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0],
      [1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0],[1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0],[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
    ],
    furniture: [
      { type: 'chair', x: 4, y: 5, z: 0 }, { type: 'chair', x: 6, y: 5, z: 0 },
      { type: 'table', x: 5, y: 5, z: 0 }, { type: 'plant', x: 1, y: 1, z: 0 },
      { type: 'plant', x: 14, y: 10, z: 0 }, { type: 'rug', x: 10, y: 7, z: 0 }
    ],
    scenery: [
      { type: 'palm_tree', x: 0, y: 0 }, { type: 'palm_tree', x: 15, y: 0 },
      { type: 'rock', x: 2, y: 10 }, { type: 'umbrella', x: 8, y: 4 }, { type: 'rock', x: 14, y: 3 }
    ]
  },
  {
    id: 'forest', name: 'Mystic Forest', description: 'Nature calls in this enchanted woodland.',
    width: 14, height: 14, floor: 'grass', wall: '#1E8449',
    map: [
      [0,0,1,1,1,1,1,1,1,1,1,1,0,0],[0,1,1,1,1,1,1,1,1,1,1,1,1,0],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [0,1,1,1,1,1,1,1,1,1,1,1,1,0],[0,0,1,1,1,1,1,1,1,1,1,1,0,0]
    ],
    furniture: [
      { type: 'plant', x: 2, y: 2, z: 0 }, { type: 'plant', x: 11, y: 11, z: 0 },
      { type: 'plant', x: 5, y: 8, z: 0 }, { type: 'plant', x: 8, y: 4, z: 0 },
      { type: 'chair', x: 6, y: 6, z: 0 }, { type: 'lamp', x: 7, y: 7, z: 0 },
      { type: 'dragon', x: 3, y: 10, z: 0 }
    ],
    scenery: [
      { type: 'rock', x: 1, y: 1 }, { type: 'bush', x: 12, y: 2 }, { type: 'bush', x: 2, y: 12 }, { type: 'rock', x: 12, y: 12 }
    ]
  },
  {
    id: 'game', name: 'Game Room', description: 'Play games and compete with friends!',
    width: 12, height: 12, floor: 'tile', wall: '#2C3E50',
    map: [
      [1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1]
    ],
    furniture: [
      { type: 'tv', x: 5, y: 5, z: 0 }, { type: 'sofa', x: 3, y: 7, z: 0 },
      { type: 'table', x: 8, y: 3, z: 0 }, { type: 'chair', x: 7, y: 3, z: 0 },
      { type: 'chair', x: 9, y: 3, z: 0 }, { type: 'bookshelf', x: 1, y: 1, z: 0 }
    ],
    scenery: [{ type: 'chalkboard', x: 5, y: 1 }]
  },
  {
    id: 'rooftop', name: 'Rooftop Lounge', description: 'Enjoy panoramic views of the city.',
    width: 12, height: 12, floor: 'stone', wall: '#5D6D7E',
    map: [
      [1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1]
    ],
    furniture: [
      { type: 'lamp', x: 2, y: 2, z: 0 }, { type: 'lamp', x: 9, y: 9, z: 0 },
      { type: 'sofa', x: 4, y: 5, z: 0 }, { type: 'table', x: 5, y: 6, z: 0 },
      { type: 'plant', x: 1, y: 10, z: 0 }, { type: 'plant', x: 10, y: 1, z: 0 }
    ],
    scenery: [{ type: 'streetlamp', x: 0, y: 5 }, { type: 'streetlamp', x: 11, y: 6 }]
  },
  {
    id: 'club', name: 'Night Club', description: 'Dance the night away under neon lights!',
    width: 14, height: 12, floor: 'checkered', wall: '#4A235A',
    map: [
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1,1,1]
    ],
    furniture: [
      { type: 'sofa', x: 2, y: 4, z: 0 }, { type: 'sofa', x: 10, y: 7, z: 0 },
      { type: 'table', x: 6, y: 5, z: 0 }, { type: 'lamp', x: 1, y: 1, z: 0 },
      { type: 'lamp', x: 12, y: 10, z: 0 }, { type: 'tv', x: 6, y: 2, z: 0 },
      { type: 'piano', x: 9, y: 9, z: 0 }
    ],
    scenery: [{ type: 'neon_light', x: 6, y: 0 }]
  },
  {
    id: 'pool', name: 'Swimming Pool', description: 'Take a swim and relax by the water.',
    width: 14, height: 10, floor: 'tile', wall: '#2980B9',
    map: [
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,0,0,0,0,0,0,0,0,0,0,1,1],[1,1,0,0,0,0,0,0,0,0,0,0,1,1],
      [1,1,0,0,0,0,0,0,0,0,0,0,1,1],[1,1,0,0,0,0,0,0,0,0,0,0,1,1],
      [1,1,0,0,0,0,0,0,0,0,0,0,1,1],[1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1,1,1]
    ],
    furniture: [
      { type: 'plant', x: 2, y: 2, z: 0 }, { type: 'plant', x: 11, y: 2, z: 0 },
      { type: 'plant', x: 2, y: 7, z: 0 }, { type: 'plant', x: 11, y: 7, z: 0 },
      { type: 'fountain', x: 6, y: 4, z: 0 }, { type: 'chair', x: 1, y: 1, z: 0 }
    ],
    scenery: [{ type: 'life_preserver', x: 1, y: 8 }, { type: 'life_preserver', x: 12, y: 8 }]
  },
  {
    id: 'restaurant', name: 'Restaurant', description: 'Fine dining with friends at the Inn.',
    width: 14, height: 12, floor: 'darkwood', wall: '#7B241C',
    map: [
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1,1,1]
    ],
    furniture: [
      { type: 'table', x: 3, y: 3, z: 0 }, { type: 'chair', x: 2, y: 3, z: 0 }, { type: 'chair', x: 4, y: 3, z: 0 },
      { type: 'table', x: 8, y: 3, z: 0 }, { type: 'chair', x: 7, y: 3, z: 0 }, { type: 'chair', x: 9, y: 3, z: 0 },
      { type: 'table', x: 5, y: 7, z: 0 }, { type: 'chair', x: 4, y: 7, z: 0 }, { type: 'chair', x: 6, y: 7, z: 0 },
      { type: 'lamp', x: 1, y: 1, z: 0 }, { type: 'lamp', x: 12, y: 10, z: 0 },
      { type: 'plant', x: 1, y: 10, z: 0 }, { type: 'plant', x: 12, y: 1, z: 0 }
    ],
    scenery: [{ type: 'dining_table', x: 6, y: 5 }]
  },
  {
    id: 'library', name: 'Library', description: 'Quiet reading and study space.',
    width: 12, height: 12, floor: 'wood', wall: '#5D4037',
    map: [
      [1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1]
    ],
    furniture: [
      { type: 'bookshelf', x: 1, y: 1, z: 0 }, { type: 'bookshelf', x: 2, y: 1, z: 0 },
      { type: 'bookshelf', x: 1, y: 10, z: 0 }, { type: 'bookshelf', x: 2, y: 10, z: 0 },
      { type: 'bookshelf', x: 9, y: 1, z: 0 }, { type: 'bookshelf', x: 10, y: 1, z: 0 },
      { type: 'bookshelf', x: 9, y: 10, z: 0 }, { type: 'bookshelf', x: 10, y: 10, z: 0 },
      { type: 'chair', x: 5, y: 5, z: 0 }, { type: 'table', x: 6, y: 5, z: 0 },
      { type: 'lamp', x: 5, y: 6, z: 0 }
    ],
    scenery: [{ type: 'bookshelf_wall', x: 5, y: 0 }]
  },
  {
    id: 'spa', name: 'Spa & Wellness', description: 'Relax and rejuvenate your senses.',
    width: 12, height: 10, floor: 'marble', wall: '#1ABC9C',
    map: [
      [1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1]
    ],
    furniture: [
      { type: 'plant', x: 1, y: 1, z: 0 }, { type: 'plant', x: 10, y: 8, z: 0 },
      { type: 'plant', x: 5, y: 4, z: 0 }, { type: 'plant', x: 6, y: 5, z: 0 },
      { type: 'fountain', x: 5, y: 4, z: 0 }, { type: 'sofa', x: 2, y: 2, z: 0 },
      { type: 'sofa', x: 8, y: 7, z: 0 }, { type: 'lamp', x: 1, y: 8, z: 0 }
    ],
    scenery: [{ type: 'spa_plant', x: 0, y: 4 }, { type: 'spa_plant', x: 11, y: 5 }]
  },
  {
    id: 'cinema', name: 'Cinema', description: 'Watch movies on the big screen.',
    width: 16, height: 10, floor: 'carpet', wall: '#2C3E50',
    map: [
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
    ],
    furniture: [
      { type: 'sofa', x: 2, y: 2, z: 0 }, { type: 'sofa', x: 5, y: 2, z: 0 }, { type: 'sofa', x: 8, y: 2, z: 0 },
      { type: 'sofa', x: 2, y: 5, z: 0 }, { type: 'sofa', x: 5, y: 5, z: 0 }, { type: 'sofa', x: 8, y: 5, z: 0 },
      { type: 'tv', x: 13, y: 4, z: 0 }, { type: 'lamp', x: 1, y: 1, z: 0 }, { type: 'lamp', x: 14, y: 8, z: 0 }
    ],
    scenery: [{ type: 'poster', x: 14, y: 1 }, { type: 'poster', x: 14, y: 8 }]
  },
  {
    id: 'garden', name: 'Garden', description: 'A peaceful outdoor garden retreat.',
    width: 14, height: 14, floor: 'grass', wall: '#27AE60',
    map: [
      [0,0,1,1,1,1,1,1,1,1,1,1,0,0],[0,1,1,1,1,1,1,1,1,1,1,1,1,0],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [0,1,1,1,1,1,1,1,1,1,1,1,1,0],[0,0,1,1,1,1,1,1,1,1,1,1,0,0]
    ],
    furniture: [
      { type: 'plant', x: 2, y: 2, z: 0 }, { type: 'plant', x: 11, y: 11, z: 0 },
      { type: 'plant', x: 5, y: 8, z: 0 }, { type: 'plant', x: 8, y: 4, z: 0 },
      { type: 'plant', x: 3, y: 10, z: 0 }, { type: 'plant', x: 10, y: 3, z: 0 },
      { type: 'fountain', x: 6, y: 6, z: 0 }, { type: 'chair', x: 6, y: 9, z: 0 },
      { type: 'chair', x: 9, y: 6, z: 0 }, { type: 'lamp', x: 1, y: 1, z: 0 }
    ],
    scenery: [
      { type: 'flower_patch', x: 1, y: 1 }, { type: 'flower_patch', x: 12, y: 12 },
      { type: 'bush', x: 6, y: 2 }, { type: 'bush', x: 2, y: 6 }
    ]
  },
  {
    id: 'arcade', name: 'Arcade', description: 'Classic games and fun for everyone.',
    width: 12, height: 12, floor: 'checkered', wall: '#8E44AD',
    map: [
      [1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1]
    ],
    furniture: [
      { type: 'tv', x: 2, y: 2, z: 0 }, { type: 'tv', x: 5, y: 2, z: 0 },
      { type: 'tv', x: 8, y: 2, z: 0 }, { type: 'table', x: 3, y: 6, z: 0 },
      { type: 'table', x: 7, y: 6, z: 0 }, { type: 'chair', x: 2, y: 6, z: 0 },
      { type: 'chair', x: 4, y: 6, z: 0 }, { type: 'chair', x: 6, y: 6, z: 0 },
      { type: 'chair', x: 8, y: 6, z: 0 }, { type: 'sofa', x: 2, y: 9, z: 0 },
      { type: 'lamp', x: 1, y: 1, z: 0 }, { type: 'lamp', x: 10, y: 10, z: 0 }
    ],
    scenery: [{ type: 'arcade_machine', x: 10, y: 1 }, { type: 'arcade_machine', x: 10, y: 4 }]
  },
  {
    id: 'cafe', name: 'Cozy Cafe', description: 'Grab a coffee and relax.',
    width: 12, height: 10, floor: 'darkwood', wall: '#6D4C41',
    map: [
      [1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1]
    ],
    furniture: [
      { type: 'table', x: 3, y: 3, z: 0 }, { type: 'chair', x: 2, y: 3, z: 0 }, { type: 'chair', x: 4, y: 3, z: 0 },
      { type: 'table', x: 7, y: 5, z: 0 }, { type: 'chair', x: 6, y: 5, z: 0 }, { type: 'chair', x: 8, y: 5, z: 0 },
      { type: 'lamp', x: 5, y: 7, z: 0 }, { type: 'plant', x: 1, y: 1, z: 0 }
    ],
    scenery: [{ type: 'dining_table', x: 5, y: 2 }]
  },
  {
    id: 'grand_library', name: 'Grand Library', description: 'Quiet please! Read and study.',
    width: 14, height: 12, floor: 'wood', wall: '#5D4037',
    map: [
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1,1,1]
    ],
    furniture: [
      { type: 'bookshelf', x: 1, y: 1, z: 0 }, { type: 'bookshelf', x: 3, y: 1, z: 0 },
      { type: 'bookshelf', x: 5, y: 1, z: 0 }, { type: 'bookshelf', x: 7, y: 1, z: 0 },
      { type: 'table', x: 4, y: 5, z: 0 }, { type: 'chair', x: 3, y: 5, z: 0 },
      { type: 'chair', x: 5, y: 5, z: 0 }, { type: 'lamp', x: 6, y: 6, z: 0 }
    ],
    scenery: [{ type: 'bookshelf_wall', x: 6, y: 0 }, { type: 'bookshelf_wall', x: 10, y: 0 }]
  },
  {
    id: 'royal_garden', name: 'Royal Garden', description: 'Flowers and fountains everywhere.',
    width: 14, height: 14, floor: 'grass', wall: '#27AE60',
    map: [
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1,1,1]
    ],
    furniture: [
      { type: 'fountain', x: 5, y: 5, z: 0 }, { type: 'plant', x: 2, y: 2, z: 0 },
      { type: 'plant', x: 11, y: 2, z: 0 }, { type: 'plant', x: 2, y: 11, z: 0 },
      { type: 'plant', x: 11, y: 11, z: 0 }, { type: 'chair', x: 4, y: 8, z: 0 },
      { type: 'chair', x: 8, y: 4, z: 0 }
    ],
    scenery: [
      { type: 'flower_patch', x: 1, y: 6 }, { type: 'flower_patch', x: 12, y: 7 },
      { type: 'bush', x: 0, y: 0 }, { type: 'bush', x: 13, y: 13 }
    ]
  }
];

export const SKIN_COLORS = ['#F5CBA7','#E0AC69','#8D5524','#C68642','#FFDBAC','#AA7C58','#F1C27D','#E8C39E'];
export const HAIR_COLORS = ['#090806','#2C1608','#71635A','#B7A69E','#D6C4C2','#B55239','#A52A2A','#DC143C','#4B0082','#228B22','#F1C40F','#D5DBDB'];
export const HAIR_STYLES = ['short','spiky','long','mohawk','bald','curly','bob'];
export const SHIRT_COLORS = ['#E74C3C','#3498DB','#2ECC71','#F1C40F','#9B59B6','#E67E22','#1ABC9C','#34495E','#FF6B6B','#4ECDC4','#FFFFFF','#111111'];
export const PANTS_COLORS = ['#2C3E50','#34495E','#1ABC9C','#8E44AD','#D35400','#7F8C8D','#2980B9','#27AE60','#C0392B','#000000'];
export const SHOE_COLORS = ['#555555','#333333','#8B4513','#000000','#FFFFFF','#C0392B'];
export const HAT_TYPES = ['none','cap','beanie','crown','wizard'];
export const GLASSES_TYPES = ['none','shades','round'];
