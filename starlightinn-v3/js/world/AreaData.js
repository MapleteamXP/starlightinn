/**
 * AreaData.js
 * ===========
 * Defines all 14 areas in the Starlight Inn world.
 * Each area has a unique palette, decorations, NPCs, ambient particles,
 * music theme, and lighting style to create a distinct cozy atmosphere.
 *
 * @module world/AreaData
 */

// ------------------------------------------------------------------
// Area definitions
// ------------------------------------------------------------------

export const AREAS = {
  /**
   * 1. Starlight Hub — The central meeting point.
   * Twilight purples, candlelit warmth, the heart of the inn.
   */
  hub: {
    id: 'hub',
    name: 'Starlight Hub',
    emoji: '🌟',
    bg: ['#1a1a2e', '#16213e'],
    floorColor: '#2d4a3e',
    floorY: 0.35,
    decorations: [
      { emoji: '🛋️', x: 0.15, y: 0.60, name: 'cozy couch' },
      { emoji: '🕯️', x: 0.50, y: 0.55, name: 'flickering candle' },
      { emoji: '📚', x: 0.80, y: 0.65, name: 'bookshelf' },
      { emoji: '🪴', x: 0.30, y: 0.70, name: 'potted plant' },
      { emoji: '🐈', x: 0.70, y: 0.75, name: 'sleepy cat' },
      { emoji: '🕰️', x: 0.08, y: 0.45, name: 'grand clock' }
    ],
    npcs: [
      {
        id: 'innkeeper',
        name: 'Mira',
        emoji: '🧙‍♀️',
        x: 0.50,
        y: 0.50,
        color: '#ffd700',
        dialogue: [
          'Welcome to Starlight Inn! ✨',
          'Make yourself at home.',
          'The treehouse is lovely this time of night.',
          'Have you visited the Ember Café yet?'
        ],
        behavior: 'idle',
        moveRange: 0.05
      },
      {
        id: 'bard',
        name: 'Lyric',
        emoji: '🎻',
        x: 0.25,
        y: 0.58,
        color: '#ff6b9d',
        dialogue: [
          'I wrote a new song about the Whisper Forest.',
          'Music sounds sweeter under starlight.',
          'Would you like to hear a lullaby?'
        ],
        behavior: 'idle',
        moveRange: 0.02
      }
    ],
    ambient: { particleType: 'firefly', density: 18 },
    music: 'warm_lounge',
    lighting: 'candlelit'
  },

  /**
   * 2. Moon Beach — A tranquil shoreline bathed in silver moonlight.
   * Warm sand, gentle waves, scattered shells, and a crackling bonfire.
   */
  moonbeach: {
    id: 'moonbeach',
    name: 'Moon Beach',
    emoji: '🌙',
    bg: ['#0f2027', '#203a43', '#2c5364'],
    floorColor: '#c2b280',
    floorY: 0.42,
    decorations: [
      { emoji: '🐚', x: 0.12, y: 0.78, name: 'spiral shell' },
      { emoji: '🔥', x: 0.55, y: 0.65, name: 'bonfire' },
      { emoji: '🏖️', x: 0.30, y: 0.72, name: 'beach blanket' },
      { emoji: '⭐', x: 0.75, y: 0.20, name: 'bright star' },
      { emoji: '🦀', x: 0.85, y: 0.80, name: 'tiny crab' },
      { emoji: '🍹', x: 0.45, y: 0.68, name: 'tropical drink' }
    ],
    npcs: [
      {
        id: 'shellcollector',
        name: 'Pearl',
        emoji: '🧜‍♀️',
        x: 0.40,
        y: 0.60,
        color: '#a8e6cf',
        dialogue: [
          'The moon makes the shells glow tonight.',
          'I found a pearl as big as your thumb!',
          'Sit by the fire and warm your toes.'
        ],
        behavior: 'wander',
        moveRange: 0.15
      },
      {
        id: 'stargazer',
        name: 'Orion',
        emoji: '🔭',
        x: 0.65,
        y: 0.55,
        color: '#dfe6e9',
        dialogue: [
          'See that constellation? It is called the Dream Weaver.',
          'The tide matches the rhythm of the stars.',
          'Make a wish on a falling star.'
        ],
        behavior: 'idle',
        moveRange: 0.03
      }
    ],
    ambient: { particleType: 'sparkle', density: 12 },
    music: 'ocean_ambient',
    lighting: 'moonlit'
  },

  /**
   * 3. Whisper Forest — A deep, ancient woodland at night.
   * Dark emerald canopy, bioluminescent mushrooms, and hooting owls.
   */
  whisperforest: {
    id: 'whisperforest',
    name: 'Whisper Forest',
    emoji: '🌲',
    bg: ['#0b1d13', '#1b4332', '#2d6a4f'],
    floorColor: '#3a5a40',
    floorY: 0.38,
    decorations: [
      { emoji: '🍄', x: 0.20, y: 0.75, name: 'glowing mushroom' },
      { emoji: '🦉', x: 0.80, y: 0.25, name: 'wise owl' },
      { emoji: '🪵', x: 0.45, y: 0.70, name: 'fallen log' },
      { emoji: '🕸️', x: 0.10, y: 0.30, name: 'silken web' },
      { emoji: '🌿', x: 0.65, y: 0.68, name: 'fern cluster' },
      { emoji: '🦊', x: 0.35, y: 0.80, name: 'curious fox' }
    ],
    npcs: [
      {
        id: 'forestdruid',
        name: 'Sylva',
        emoji: '🧝‍♀️',
        x: 0.50,
        y: 0.55,
        color: '#95d5b2',
        dialogue: [
          'The trees remember every secret ever whispered.',
          'Follow the fireflies to find hidden glades.',
          'Even the mushrooms have stories to tell.'
        ],
        behavior: 'wander',
        moveRange: 0.12
      },
      {
        id: 'owlkeeper',
        name: 'Hoot',
        emoji: '🦉',
        x: 0.75,
        y: 0.30,
        color: '#d4a373',
        dialogue: [
          'Hoo-hoo! Welcome to my branch.',
          'The forest is oldest in the east.',
          'Night is when the woods truly wake.'
        ],
        behavior: 'idle',
        moveRange: 0.01
      }
    ],
    ambient: { particleType: 'firefly', density: 25 },
    music: 'forest_night',
    lighting: 'bioluminescent'
  },

  /**
   * 4. Cloud Treehouse — A cozy loft among the treetops.
   * Warm wood, paper lanterns, and the soft patter of optional rain.
   */
  cloudtreehouse: {
    id: 'cloudtreehouse',
    name: 'Cloud Treehouse',
    emoji: '🌳',
    bg: ['#3e2723', '#5d4037', '#8d6e63'],
    floorColor: '#6d4c41',
    floorY: 0.40,
    decorations: [
      { emoji: '🏮', x: 0.25, y: 0.35, name: 'paper lantern' },
      { emoji: '🪟', x: 0.60, y: 0.30, name: 'round window' },
      { emoji: '🛏️', x: 0.75, y: 0.60, name: 'hammock' },
      { emoji: '📖', x: 0.40, y: 0.65, name: 'open journal' },
      { emoji: '🍵', x: 0.50, y: 0.62, name: 'steaming tea' },
      { emoji: '🧦', x: 0.15, y: 0.70, name: 'knitted socks' }
    ],
    npcs: [
      {
        id: 'treehousekeeper',
        name: 'Wren',
        emoji: '🧚',
        x: 0.50,
        y: 0.50,
        color: '#ffcc80',
        dialogue: [
          'The clouds look like cotton candy today.',
          'Rain on the roof is the best lullaby.',
          'I have been reading stories from this old journal.'
        ],
        behavior: 'idle',
        moveRange: 0.06
      }
    ],
    ambient: { particleType: 'petal', density: 8 },
    music: 'acoustic_guitar',
    lighting: 'lanternlight'
  },

  /**
   * 5. Sunflower Park — A cheerful daytime meadow.
   * Bright yellows, a bubbling fountain, and wooden benches.
   */
  sunflowerpark: {
    id: 'sunflowerpark',
    name: 'Sunflower Park',
    emoji: '🌻',
    bg: ['#1a535c', '#4ecdc4', '#ffe66d'],
    floorColor: '#7cb342',
    floorY: 0.36,
    decorations: [
      { emoji: '🌻', x: 0.20, y: 0.72, name: 'sunflower patch' },
      { emoji: '⛲', x: 0.50, y: 0.55, name: 'stone fountain' },
      { emoji: '🪑', x: 0.75, y: 0.65, name: 'park bench' },
      { emoji: '🐝', x: 0.35, y: 0.68, name: 'busy bee' },
      { emoji: '🦋', x: 0.60, y: 0.50, name: 'colorful butterfly' },
      { emoji: '🎈', x: 0.10, y: 0.25, name: 'lost balloon' }
    ],
    npcs: [
      {
        id: 'gardener',
        name: 'Daisy',
        emoji: '👩‍🌾',
        x: 0.45,
        y: 0.60,
        color: '#ffe082',
        dialogue: [
          'Sunflowers always face the light.',
          'I planted these seeds last spring.',
          'The fountain water is perfect for wishes!'
        ],
        behavior: 'wander',
        moveRange: 0.10
      },
      {
        id: 'picnickid',
        name: 'Pip',
        emoji: '🧒',
        x: 0.70,
        y: 0.70,
        color: '#ffab91',
        dialogue: [
          'I saw a frog in the fountain!',
          'My sandwich tastes better outside.',
          'Can we fly the kite later?'
        ],
        behavior: 'idle',
        moveRange: 0.08
      }
    ],
    ambient: { particleType: 'petal', density: 15 },
    music: 'ukulele_day',
    lighting: 'sunny'
  },

  /**
   * 6. Crystal Island — A floating isle of shimmering gemstones.
   * Deep blues and violet, waterfalls, crystal formations, rope bridges.
   */
  crystalisland: {
    id: 'crystalisland',
    name: 'Crystal Island',
    emoji: '💎',
    bg: ['#1a0b2e', '#311b54', '#432874'],
    floorColor: '#4a4e69',
    floorY: 0.33,
    decorations: [
      { emoji: '💎', x: 0.25, y: 0.50, name: 'giant crystal' },
      { emoji: '🌊', x: 0.55, y: 0.45, name: 'waterfall' },
      { emoji: '🌉', x: 0.80, y: 0.55, name: 'rope bridge' },
      { emoji: '🔮', x: 0.40, y: 0.65, name: 'scrying orb' },
      { emoji: '✨', x: 0.70, y: 0.25, name: 'magic sparkles' },
      { emoji: '🐉', x: 0.15, y: 0.60, name: 'small wyrmling' }
    ],
    npcs: [
      {
        id: 'gemkeeper',
        name: 'Celeste',
        emoji: '👸',
        x: 0.50,
        y: 0.52,
        color: '#c77dff',
        dialogue: [
          'These crystals sing when the moon is full.',
          'The waterfall comes from the sky itself.',
          'Touch a crystal and feel its warmth.'
        ],
        behavior: 'idle',
        moveRange: 0.04
      },
      {
        id: 'bridgeguard',
        name: 'Rook',
        emoji: '🛡️',
        x: 0.78,
        y: 0.52,
        color: '#9d4edd',
        dialogue: [
          'The bridge holds all who cross with kindness.',
          'I have guarded this path for a hundred years.',
          'The island floats on starlight, not wind.'
        ],
        behavior: 'idle',
        moveRange: 0.02
      }
    ],
    ambient: { particleType: 'sparkle', density: 22 },
    music: 'ethereal_chimes',
    lighting: 'crystalline'
  },

  /**
   * 7. Aurora Lounge — A plush observatory beneath dancing northern lights.
   * Velvet furniture, champagne flutes, and shifting curtains of color.
   */
  auroralounge: {
    id: 'auroralounge',
    name: 'Aurora Lounge',
    emoji: '🌌',
    bg: ['#0a0e17', '#1b263b', '#2a6f6f'],
    floorColor: '#1d3557',
    floorY: 0.34,
    decorations: [
      { emoji: '🍸', x: 0.50, y: 0.58, name: 'champagne flute' },
      { emoji: '🛋️', x: 0.20, y: 0.62, name: 'velvet sofa' },
      { emoji: '🪞', x: 0.75, y: 0.40, name: 'gilded mirror' },
      { emoji: '🎆', x: 0.35, y: 0.25, name: 'aurora glow' },
      { emoji: '🕯️', x: 0.60, y: 0.55, name: 'crystal candle' },
      { emoji: '🎻', x: 0.10, y: 0.65, name: 'cello in corner' }
    ],
    npcs: [
      {
        id: 'loungehost',
        name: 'Aurora',
        emoji: '💃',
        x: 0.50,
        y: 0.50,
        color: '#e0aaff',
        dialogue: [
          'The lights tonight are especially vibrant.',
          'Velvet and starlight — the perfect pairing.',
          'May I pour you something sparkling?'
        ],
        behavior: 'idle',
        moveRange: 0.05
      },
      {
        id: 'poet',
        name: 'Vesper',
        emoji: '📝',
        x: 0.25,
        y: 0.60,
        color: '#c8b6ff',
        dialogue: [
          'I am writing a poem about green flames in the sky.',
          'Words feel lighter here.',
          'Read my latest verse? It is about longing.'
        ],
        behavior: 'idle',
        moveRange: 0.03
      }
    ],
    ambient: { particleType: 'sparkle', density: 16 },
    music: 'jazz_noir',
    lighting: 'aurora'
  },

  /**
   * 8. Ember Café — A warm coffeehouse alive with jazz and steam.
   * Copper accents, pastry displays, and the scent of roasted beans.
   */
  embercafe: {
    id: 'embercafe',
    name: 'Ember Café',
    emoji: '☕',
    bg: ['#2d1b15', '#4a2c27', '#6d4c41'],
    floorColor: '#5d4037',
    floorY: 0.37,
    decorations: [
      { emoji: '☕', x: 0.50, y: 0.58, name: 'latte art' },
      { emoji: '🥐', x: 0.30, y: 0.55, name: 'croissant tray' },
      { emoji: '🎷', x: 0.10, y: 0.65, name: 'saxophone' },
      { emoji: '🍰', x: 0.70, y: 0.60, name: 'cake slice' },
      { emoji: '🪴', x: 0.85, y: 0.50, name: 'coffee plant' },
      { emoji: '📰', x: 0.15, y: 0.70, name: 'morning paper' }
    ],
    npcs: [
      {
        id: 'barista',
        name: 'Roast',
        emoji: '👨‍🍳',
        x: 0.50,
        y: 0.48,
        color: '#ffab91',
        dialogue: [
          'The beans were roasted at dawn.',
          'Try the cinnamon swirl — it is fresh.',
          'Jazz and java, the perfect blend.'
        ],
        behavior: 'idle',
        moveRange: 0.04
      },
      {
        id: 'regular',
        name: 'Mocha',
        emoji: '🐕',
        x: 0.65,
        y: 0.72,
        color: '#8d6e63',
        dialogue: [
          'Woof! (This spot is mine.)',
          'Woof! (Got any treats?)',
          'Woof! (The jazz soothes my soul.)'
        ],
        behavior: 'idle',
        moveRange: 0.01
      }
    ],
    ambient: { particleType: 'steam', density: 14 },
    music: 'coffeehouse_jazz',
    lighting: 'warm_spotlight'
  },

  /**
   * 9. Misty Library — An ancient archive of floating dust and towering shelves.
   * Dark amber light, rolling ladders, and the hush of centuries.
   */
  mistylibrary: {
    id: 'mistylibrary',
    name: 'Misty Library',
    emoji: '📜',
    bg: ['#1c0f0a', '#3e2723', '#5d4037'],
    floorColor: '#4e342e',
    floorY: 0.35,
    decorations: [
      { emoji: '📚', x: 0.15, y: 0.45, name: 'towering shelf' },
      { emoji: '🪜', x: 0.55, y: 0.55, name: 'rolling ladder' },
      { emoji: '🔮', x: 0.80, y: 0.50, name: 'reading orb' },
      { emoji: '🪶', x: 0.40, y: 0.65, name: 'quill pen' },
      { emoji: '📜', x: 0.70, y: 0.70, name: 'ancient scroll' },
      { emoji: '🕯️', x: 0.30, y: 0.55, name: 'wax candle' }
    ],
    npcs: [
      {
        id: 'librarian',
        name: 'Tome',
        emoji: '👴',
        x: 0.50,
        y: 0.50,
        color: '#bcaaa4',
        dialogue: [
          'Shh... the books are sleeping.',
          'Every volume here has a heartbeat.',
          'I have read the stars in these pages.'
        ],
        behavior: 'wander',
        moveRange: 0.08
      },
      {
        id: 'cat',
        name: 'Scroll',
        emoji: '🐱',
        x: 0.75,
        y: 0.60,
        color: '#a1887f',
        dialogue: [
          'Purr... (This shelf is warm.)',
          'Purr... (I knocked a book down earlier.)',
          'Purr... (Feed me, then read.)'
        ],
        behavior: 'idle',
        moveRange: 0.02
      }
    ],
    ambient: { particleType: 'dust', density: 20 },
    music: 'soft_piano',
    lighting: 'amber_glow'
  },

  /**
   * 10. Stardust Theater — A grand stage draped in velvet curtains.
   * Deep purples, a single spotlight, and the promise of performance.
   */
  stardusttheater: {
    id: 'stardusttheater',
    name: 'Stardust Theater',
    emoji: '🎭',
    bg: ['#1a0a2e', '#2d1b4e', '#432c7a'],
    floorColor: '#3d2c5e',
    floorY: 0.36,
    decorations: [
      { emoji: '🎭', x: 0.50, y: 0.42, name: 'comedy mask' },
      { emoji: '🎪', x: 0.20, y: 0.30, name: 'velvet curtain' },
      { emoji: '🎤', x: 0.50, y: 0.48, name: 'stage mic' },
      { emoji: '💡', x: 0.50, y: 0.20, name: 'spotlight' },
      { emoji: '🎟️', x: 0.10, y: 0.70, name: 'ticket stub' },
      { emoji: '🌹', x: 0.80, y: 0.60, name: 'thrown rose' }
    ],
    npcs: [
      {
        id: 'director',
        name: 'Stage',
        emoji: '🎬',
        x: 0.45,
        y: 0.55,
        color: '#e0aaff',
        dialogue: [
          'Places everyone! Showtime in five.',
          'The spotlight reveals truth.',
          'Every soul is a performer here.'
        ],
        behavior: 'idle',
        moveRange: 0.06
      },
      {
        id: 'magician',
        name: 'Presto',
        emoji: '🎩',
        x: 0.60,
        y: 0.50,
        color: '#ffcc80',
        dialogue: [
          'Pick a card, any card.',
          'Is this your thought? I can read minds.',
          'Abracadabra! ...Did you blink?'
        ],
        behavior: 'idle',
        moveRange: 0.05
      }
    ],
    ambient: { particleType: 'sparkle', density: 18 },
    music: 'theatrical_brass',
    lighting: 'spotlit'
  },

  /**
   * 11. Twilight Garden — A romantic courtyard at dusk.
   * Fading pinks, climbing roses, a trickling fountain, and firefly lanterns.
   */
  twilightgarden: {
    id: 'twilightgarden',
    name: 'Twilight Garden',
    emoji: '🌷',
    bg: ['#2d132c', '#5c2751', '#9d4edd'],
    floorColor: '#4a4e69',
    floorY: 0.38,
    decorations: [
      { emoji: '🌹', x: 0.20, y: 0.65, name: 'climbing roses' },
      { emoji: '⛲', x: 0.50, y: 0.55, name: 'marble fountain' },
      { emoji: '🪑', x: 0.75, y: 0.62, name: 'wrought bench' },
      { emoji: '🐇', x: 0.35, y: 0.75, name: 'garden rabbit' },
      { emoji: '🦋', x: 0.60, y: 0.45, name: 'evening moth' },
      { emoji: '🌙', x: 0.85, y: 0.20, name: 'rising crescent' }
    ],
    npcs: [
      {
        id: 'gardencaretaker',
        name: 'Rosemary',
        emoji: '👩‍🌾',
        x: 0.50,
        y: 0.58,
        color: '#ffccd5',
        dialogue: [
          'The roses only bloom at twilight.',
          'Sit by the fountain and listen to the water.',
          'Every petal holds a drop of sunset.'
        ],
        behavior: 'wander',
        moveRange: 0.10
      },
      {
        id: 'ghost',
        name: 'Luna',
        emoji: '👻',
        x: 0.30,
        y: 0.50,
        color: '#e0e1dd',
        dialogue: [
          'Do not be afraid. I am just a soft breeze.',
          'I used to tend these roses long ago.',
          'Twilight is when the veil is thinnest.'
        ],
        behavior: 'idle',
        moveRange: 0.03
      }
    ],
    ambient: { particleType: 'firefly', density: 16 },
    music: 'strings_dusk',
    lighting: 'twilight_glow'
  },

  /**
   * 12. Comet Arcade — A neon-lit den of retro games and glowing machines.
   * Dark space, high-score bleeps, and cascading ticket printers.
   */
  cometarcade: {
    id: 'cometarcade',
    name: 'Comet Arcade',
    emoji: '👾',
    bg: ['#0a0a0a', '#1a0a2e', '#240046'],
    floorColor: '#240046',
    floorY: 0.40,
    decorations: [
      { emoji: '👾', x: 0.25, y: 0.45, name: 'arcade cabinet' },
      { emoji: '🕹️', x: 0.55, y: 0.55, name: 'joystick' },
      { emoji: '🎰', x: 0.75, y: 0.50, name: 'prize machine' },
      { emoji: '🎟️', x: 0.40, y: 0.70, name: 'ticket pile' },
      { emoji: '🏆', x: 0.15, y: 0.35, name: 'high score trophy' },
      { emoji: '🍕', x: 0.85, y: 0.65, name: 'arcade pizza' }
    ],
    npcs: [
      {
        id: 'arcadekid',
        name: 'Pixel',
        emoji: '🧑‍💻',
        x: 0.50,
        y: 0.52,
        color: '#00ff9d',
        dialogue: [
          'I hold the record on Comet Blaster!',
          'Insert coin to continue... metaphorically.',
          'The neon never sleeps in here.'
        ],
        behavior: 'idle',
        moveRange: 0.07
      },
      {
        id: 'prizemonkey',
        name: 'Jack',
        emoji: '🐵',
        x: 0.70,
        y: 0.45,
        color: '#ffea00',
        dialogue: [
          'Ooh ooh! Win me a banana plush!',
          'That claw machine is rigged, I swear.',
          'Tickets tickets tickets!'
        ],
        behavior: 'idle',
        moveRange: 0.05
      }
    ],
    ambient: { particleType: 'sparkle', density: 10 },
    music: 'chiptune_bop',
    lighting: 'neon_pulse'
  },

  /**
   * 13. Dream Bedroom — A sanctuary of soft pastels and whispered lullabies.
   * Canopy bed, fuzzy slippers, and a dream catcher swaying gently.
   */
  dreambedroom: {
    id: 'dreambedroom',
    name: 'Dream Bedroom',
    emoji: '🛏️',
    bg: ['#2d1b2e', '#4a3b4d', '#7d5a7d'],
    floorColor: '#5e4b5a',
    floorY: 0.39,
    decorations: [
      { emoji: '🛏️', x: 0.50, y: 0.55, name: 'canopy bed' },
      { emoji: '🩴', x: 0.40, y: 0.70, name: 'fuzzy slippers' },
      { emoji: '🪶', x: 0.75, y: 0.30, name: 'dream catcher' },
      { emoji: '🧸', x: 0.20, y: 0.62, name: 'teddy bear' },
      { emoji: '🕯️', x: 0.60, y: 0.58, name: 'bedside candle' },
      { emoji: '📖', x: 0.30, y: 0.65, name: 'bedtime story' }
    ],
    npcs: [
      {
        id: 'sleepkeeper',
        name: 'Nox',
        emoji: '😴',
        x: 0.55,
        y: 0.55,
        color: '#d8bbff',
        dialogue: [
          'Yawn... is it bedtime yet?',
          'The dream catcher filters out nightmares.',
          'Rest your head. The stars will watch over you.'
        ],
        behavior: 'idle',
        moveRange: 0.02
      },
      {
        id: 'sheep',
        name: 'Wooliam',
        emoji: '🐑',
        x: 0.80,
        y: 0.65,
        color: '#ede0d4',
        dialogue: [
          'Baa! (I am counting humans tonight.)',
          'Baa! (Jumping over moons is tiring.)',
          'Baa! (Sweet dreams, friend.)'
        ],
        behavior: 'idle',
        moveRange: 0.01
      }
    ],
    ambient: { particleType: 'dust', density: 10 },
    music: 'lullaby_harp',
    lighting: 'soft_glow'
  },

  /**
   * 14. Meteor Market — A bustling bazaar of wonders under shooting stars.
   * Warm lanterns, colorful stalls, treasures, and friendly haggling.
   */
  meteormarket: {
    id: 'meteormarket',
    name: 'Meteor Market',
    emoji: '🏪',
    bg: ['#1b1b1e', '#2c2c34', '#4a3b32'],
    floorColor: '#5d4037',
    floorY: 0.37,
    decorations: [
      { emoji: '🏪', x: 0.25, y: 0.50, name: 'cloth stall' },
      { emoji: '🏺', x: 0.50, y: 0.55, name: 'pottery rack' },
      { emoji: '💍', x: 0.75, y: 0.50, name: 'jewelry tray' },
      { emoji: '🧺', x: 0.40, y: 0.65, name: 'woven basket' },
      { emoji: '🌶️', x: 0.60, y: 0.60, name: 'spice sacks' },
      { emoji: '🐫', x: 0.15, y: 0.70, name: 'pack camel' }
    ],
    npcs: [
      {
        id: 'merchant',
        name: 'Zara',
        emoji: '🧕',
        x: 0.50,
        y: 0.52,
        color: '#ffb703',
        dialogue: [
          'Finest silk this side of the Milky Way!',
          'Haggle with your heart, not your coin.',
          'That meteorite fragment is one of a kind!'
        ],
        behavior: 'wander',
        moveRange: 0.12
      },
      {
        id: 'musician',
        name: 'Sitar',
        emoji: '🪕',
        x: 0.30,
        y: 0.60,
        color: '#fb8500',
        dialogue: [
          'My tunes draw customers from three galaxies.',
          'Play a song, get a discount.',
          'The strings hum with starlight.'
        ],
        behavior: 'idle',
        moveRange: 0.04
      },
      {
        id: 'fortuneteller',
        name: 'Myst',
        emoji: '🔮',
        x: 0.70,
        y: 0.48,
        color: '#9d4edd',
        dialogue: [
          'Your fortune is written in stardust.',
          'Cross my palm with silver... or cookies.',
          'I see great adventure in your future!'
        ],
        behavior: 'idle',
        moveRange: 0.03
      }
    ],
    ambient: { particleType: 'sparkle', density: 14 },
    music: 'bazaar_strings',
    lighting: 'lantern_festival'
  }
};

// ------------------------------------------------------------------
// Metadata helpers
// ------------------------------------------------------------------

/**
 * Canonical ordering of all area IDs.
 * Used for navigation UI, map layouts, and sequential traversal.
 * @type {string[]}
 */
export const AREA_ORDER = [
  'hub', 'moonbeach', 'whisperforest', 'cloudtreehouse',
  'sunflowerpark', 'crystalisland', 'auroralounge', 'embercafe',
  'mistylibrary', 'stardusttheater', 'twilightgarden', 'cometarcade',
  'dreambedroom', 'meteormarket'
];

/**
 * Human-readable area names for quick UI labels.
 * @type {Object<string, string>}
 */
export const AREA_NAMES = Object.fromEntries(
  AREA_ORDER.map(id => [id, AREAS[id].name])
);

/**
 * Emoji icons mapped to each area for map pins and HUD.
 * @type {Object<string, string>}
 */
export const AREA_EMOJIS = Object.fromEntries(
  AREA_ORDER.map(id => [id, AREAS[id].emoji])
);

/**
 * Music tracks assigned to each area.
 * @type {Object<string, string>}
 */
export const AREA_MUSIC = Object.fromEntries(
  AREA_ORDER.map(id => [id, AREAS[id].music])
);

/**
 * Lighting themes per area for renderer post-processing.
 * @type {Object<string, string>}
 */
export const AREA_LIGHTING = Object.fromEntries(
  AREA_ORDER.map(id => [id, AREAS[id].lighting])
);

// ------------------------------------------------------------------
// Lookup helpers
// ------------------------------------------------------------------

/**
 * Retrieve a single area definition by its ID.
 * @param {string} id
 * @returns {Object|undefined}
 */
export function getArea(id) {
  return AREAS[id];
}

/**
 * Retrieve a list of all area definitions in canonical order.
 * @returns {Object[]}
 */
export function getAreaList() {
  return AREA_ORDER.map(id => AREAS[id]);
}

/**
 * Check whether an area ID exists in the world.
 * @param {string} id
 * @returns {boolean}
 */
export function areaExists(id) {
  return id in AREAS;
}

/**
 * Get the next area in canonical order, wrapping to the first.
 * @param {string} currentId
 * @returns {Object}
 */
export function getNextArea(currentId) {
  const idx = AREA_ORDER.indexOf(currentId);
  const nextIdx = (idx + 1) % AREA_ORDER.length;
  return AREAS[AREA_ORDER[nextIdx]];
}

/**
 * Get the previous area in canonical order, wrapping to the last.
 * @param {string} currentId
 * @returns {Object}
 */
export function getPrevArea(currentId) {
  const idx = AREA_ORDER.indexOf(currentId);
  const prevIdx = (idx - 1 + AREA_ORDER.length) % AREA_ORDER.length;
  return AREAS[AREA_ORDER[prevIdx]];
}

/**
 * Return the total count of defined areas.
 * @returns {number}
 */
export function getAreaCount() {
  return AREA_ORDER.length;
}

/**
 * Get the 0-based index of an area in canonical order.
 * @param {string} id
 * @returns {number}
 */
export function getAreaIndex(id) {
  return AREA_ORDER.indexOf(id);
}
