// ============================================================
// Starlight Engine — NPC Manager
// ============================================================

import { Avatar } from '../world/Avatar.js';
import { randInt, randChoice } from '../engine/Core.js';

const NPC_NAMES = ['Alice','Bob','Charlie','Diana','Evan','Fiona','George','Hannah','Ivy','Jack'];
const SKINS = ['#F5CBA7','#E0AC69','#8D5524','#C68642','#FFDBAC','#AA7C58'];
const HAIRS = ['#5D4037','#E67E22','#F1C40F','#2C3E50','#8E44AD','#E74C3C','#D5DBDB'];
const SHIRTS = ['#E74C3C','#2ECC71','#9B59B6','#1ABC9C','#E67E22','#3498DB','#F39C12'];
const STYLES = ['short','long','spiky','mohawk','bald','curly','bob'];
const HATS = ['none','none','none','cap','beanie','crown','wizard'];
const GLASSES = ['none','none','none','shades','round'];

export class NPCManager {
  constructor(game) {
    this.game = game;
    this.npcs = [];
  }

  spawn(count, room, player) {
    this.npcs = [];
    if (count <= 0 || !room) return this.npcs;
    for (let i = 0; i < count; i++) {
      let nx, ny, attempts = 0;
      do {
        nx = randInt(0, room.width - 1);
        ny = randInt(0, room.height - 1);
        attempts++;
      } while ((!room.isWalkable(nx, ny) || (player && nx === player.x && ny === player.y)) && attempts < 50);

      const npc = new Avatar(randChoice(NPC_NAMES), nx, ny, {
        skinColor: randChoice(SKINS),
        hairColor: randChoice(HAIRS),
        hairStyle: randChoice(STYLES),
        shirtColor: randChoice(SHIRTS),
        pantsColor: '#2C3E50',
        shoeColor: '#444',
        hatType: randChoice(HATS),
        glassesType: randChoice(GLASSES),
        isNPC: true,
        speed: 0.06 + Math.random() * 0.04,
        game: this.game
      });
      this.npcs.push(npc);
    }
    return this.npcs;
  }

  update(dt, room) {
    this.npcs.forEach(npc => {
      npc.update(dt, room);
      // NPC furniture interaction
      if (!npc.isWalking && !npc.isSitting && Math.random() < 0.001) {
        const seat = this._findNearbySeat(npc, room);
        if (seat) npc.moveTo(seat.x, seat.y, room);
      }
      if (!npc.isWalking && !npc.isSitting && npc.path.length === 0 && Math.random() < 0.0005) {
        const nearSeat = room.furniture.find(f => ['chair','sofa','bench','bed'].includes(f.type) && Math.abs(f.x - npc.x) < 1.5 && Math.abs(f.y - npc.y) < 1.5);
        if (nearSeat) { npc.isSitting = true; npc.sitTimer = randInt(5, 15); }
      }
      if (npc.isSitting) {
        npc.sitTimer -= dt;
        if (npc.sitTimer <= 0) { npc.isSitting = false; }
        if (!npc.isWalking && Math.random() < 0.0003) { npc.isDancing = !npc.isDancing; }
      }
    });

    // Proximity greetings
    if (this.game.settings.safeMode) return;
    const player = this.game.player;
    if (!player) return;
    this.npcs.forEach(npc => {
      if (npc.chatTimer > 0) return;
      const dx = npc.x - player.x;
      const dy = npc.y - player.y;
      if (Math.abs(dx) < 2 && Math.abs(dy) < 2 && Math.random() < 0.005) {
        const greetings = ['Hi!', 'Hello!', 'Hey there!', 'Nice to see you!', 'Welcome!'];
        npc.say(randChoice(greetings), '#fffde7', 'normal');
      }
    });
  }

  _findNearbySeat(npc, room) {
    const seats = room.furniture.filter(f => ['chair','sofa','bench','bed'].includes(f.type));
    if (seats.length === 0) return null;
    const available = seats.filter(s => !room.avatars.some(a => a !== npc && Math.round(a.x) === s.x && Math.round(a.y) === s.y));
    if (available.length === 0) return null;
    available.sort((a, b) => {
      const da = Math.abs(a.x - npc.x) + Math.abs(a.y - npc.y);
      const db = Math.abs(b.x - npc.x) + Math.abs(b.y - npc.y);
      return da - db;
    });
    return available[0];
  }
}
