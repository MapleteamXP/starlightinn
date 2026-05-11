// ============================================================
// Starlight Inn — Network Manager (WebSocket Client)
// ============================================================

import { Avatar } from '../world/Avatar.js';

const WS_URL = typeof window !== 'undefined'
  ? (window.location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + (window.location.hostname === 'localhost' ? 'localhost:3000' : window.location.host)
  : 'ws://localhost:3000';

export class NetworkManager {
  constructor(game) {
    this.game = game;
    this.ws = null;
    this.connected = false;
    this.connecting = false;
    this.reconnectTimer = null;
    this.reconnectDelay = 3000;
    this.maxReconnectDelay = 30000;
    this.pingInterval = null;
    this.localMode = true; // Start in offline mode
    this.playerId = null;
    this.remotePlayers = new Map(); // id -> {x, y, facing, name, outfit, targetX, targetY}
    this.pendingMessages = [];
    this.lastMoveSend = 0;
    this.moveThrottle = 80; // ms between move packets
  }

  connect(playerName, outfit) {
    if (this.connected || this.connecting) return;
    this.connecting = true;
    this.localMode = false;

    try {
      this.ws = new WebSocket(WS_URL);

      this.ws.onopen = () => {
        this.connecting = false;
        this.connected = true;
        this.reconnectDelay = 3000;
        console.log('[NET] Connected to server');

        // Authenticate
        this.send({
          type: 'auth',
          id: this.playerId || localStorage.getItem('starlight_player_id'),
          name: playerName,
          outfit
        });

        // Flush pending messages
        while (this.pendingMessages.length > 0) {
          const msg = this.pendingMessages.shift();
          this.send(msg);
        }

        // Start ping
        this.pingInterval = setInterval(() => {
          this.send({ type: 'ping', time: Date.now() });
        }, 15000);

        if (this.game && this.game.uiManager) {
          this.game.uiManager.showNotification('Connected to online server!', 'success');
        }
      };

      this.ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          this.handleMessage(msg);
        } catch (e) {
          console.error('[NET] Failed to parse message:', e);
        }
      };

      this.ws.onclose = () => {
        this.connected = false;
        this.connecting = false;
        clearInterval(this.pingInterval);
        console.log('[NET] Disconnected from server');

        // Clear remote players
        this.remotePlayers.clear();

        if (this.game && this.game.uiManager) {
          this.game.uiManager.showNotification('Server disconnected. Playing offline.', 'error');
        }

        // Auto-reconnect
        this.reconnectTimer = setTimeout(() => {
          this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, this.maxReconnectDelay);
          this.connect(playerName, outfit);
        }, this.reconnectDelay);
      };

      this.ws.onerror = (err) => {
        console.error('[NET] WebSocket error:', err);
        this.localMode = true;
        this.connecting = false;
      };
    } catch (e) {
      console.error('[NET] Failed to connect:', e);
      this.localMode = true;
      this.connecting = false;
    }
  }

  disconnect() {
    clearTimeout(this.reconnectTimer);
    clearInterval(this.pingInterval);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
    this.connecting = false;
    this.localMode = true;
    this.remotePlayers.clear();
  }

  send(msg) {
    if (this.connected && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    } else if (!this.localMode) {
      this.pendingMessages.push(msg);
    }
  }

  handleMessage(msg) {
    switch (msg.type) {
      case 'welcome':
        console.log('[NET] Server welcome:', msg.server);
        break;

      case 'auth_success':
        this.playerId = msg.id;
        localStorage.setItem('starlight_player_id', msg.id);
        console.log('[NET] Authenticated as', msg.name);
        // Auto-join current room
        if (this.game && this.game.room) {
          this.joinRoom(this.game.room.id, this.game.player.x, this.game.player.y);
        }
        break;

      case 'room_state':
        // Populate remote players
        this.remotePlayers.clear();
        if (msg.players) {
          msg.players.forEach(p => {
            if (p.id !== this.playerId) {
              this.remotePlayers.set(p.id, { ...p, targetX: p.x, targetY: p.y });
            }
          });
        }
        if (this.game && this.game.uiManager) {
          this.game.uiManager.showNotification(`${msg.players ? msg.players.length : 0} players in ${msg.roomName}`, 'info');
        }
        break;

      case 'player_joined':
        if (msg.player && msg.player.id !== this.playerId) {
          this.remotePlayers.set(msg.player.id, { ...msg.player, targetX: msg.player.x, targetY: msg.player.y });
          if (this.game && this.game.uiManager) {
            this.game.uiManager.showNotification(`${msg.player.name} joined the room`, 'info');
          }
        }
        break;

      case 'player_left':
        this.remotePlayers.delete(msg.id);
        if (this.game && this.game.uiManager) {
          this.game.uiManager.showNotification(`${msg.name} left the room`, 'info');
        }
        break;

      case 'player_moved':
        if (msg.id !== this.playerId) {
          const rp = this.remotePlayers.get(msg.id);
          if (rp) {
            rp.targetX = msg.x;
            rp.targetY = msg.y;
            rp.facing = msg.facing;
          }
        }
        break;

      case 'chat':
        if (msg.id !== this.playerId && this.game && this.game.chatManager) {
          this.game.chatManager.addHistory(msg.name, msg.text,
            new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            msg.chatType || 'normal'
          );
          // Also show bubble for remote player if we can find them
          const rp = this.remotePlayers.get(msg.id);
          if (rp && this.game.room) {
            const avatar = this.game.room.avatars.find(a => a.id === `remote_${msg.id}`);
            if (avatar) {
              avatar.say(msg.text, '#fffde7', msg.chatType || 'normal');
            }
          }
        }
        break;

      case 'global_chat':
        if (msg.id !== this.playerId && this.game && this.game.chatManager) {
          this.game.chatManager.addHistory(`[Global] ${msg.name}`, msg.text,
            new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            'global'
          );
        }
        break;

      case 'whisper':
        if (this.game && this.game.chatManager) {
          this.game.chatManager.addHistory(`Whisper from ${msg.from}`, msg.text,
            new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            'whisper'
          );
          if (this.game.uiManager) {
            this.game.uiManager.showNotification(`Whisper from ${msg.from}`, 'info');
          }
        }
        break;

      case 'emote':
        if (msg.id !== this.playerId) {
          const rp = this.remotePlayers.get(msg.id);
          if (rp && this.game && this.game.room) {
            const avatar = this.game.room.avatars.find(a => a.id === `remote_${msg.id}`);
            if (avatar) {
              if (msg.emote === 'wave') { avatar.isWaving = true; avatar.waveTimer = 0; }
              else if (msg.emote === 'dance') { avatar.isDancing = !avatar.isDancing; }
            }
          }
        }
        break;

      case 'furniture_placed':
        if (this.game && this.game.room && msg.by !== this.playerId) {
          this.game.room.furniture.push(msg.furniture);
        }
        break;

      case 'furniture_removed':
        if (this.game && this.game.room && msg.by !== this.playerId) {
          this.game.room.furniture = this.game.room.furniture.filter(f =>
            !(f.x === msg.x && f.y === msg.y)
          );
        }
        break;

      case 'pong':
        const latency = Date.now() - msg.time;
        // Could display latency somewhere
        break;

      case 'error':
        console.error('[NET] Server error:', msg.message);
        if (this.game && this.game.uiManager) {
          this.game.uiManager.showNotification(msg.message, 'error');
        }
        break;
    }
  }

  // ── Outbound Actions ──
  joinRoom(roomId, x, y) {
    this.send({ type: 'join_room', roomId, x, y });
  }

  move(x, y, facing) {
    const now = Date.now();
    if (now - this.lastMoveSend < this.moveThrottle) return;
    this.lastMoveSend = now;
    this.send({ type: 'move', x, y, facing });
  }

  chat(text, chatType = 'normal') {
    this.send({ type: 'chat', text, chatType });
  }

  globalChat(text) {
    this.send({ type: 'global_chat', text });
  }

  whisper(targetId, text) {
    this.send({ type: 'whisper', targetId, text });
  }

  emote(emoteName) {
    this.send({ type: 'emote', emote: emoteName });
  }

  placeFurniture(furniture) {
    this.send({ type: 'place_furniture', furniture });
  }

  removeFurniture(x, y, furnitureType) {
    this.send({ type: 'remove_furniture', x, y, furnitureType });
  }

  getRooms() {
    this.send({ type: 'get_rooms' });
  }

  // ── Remote Player Update (called every frame) ──
  updateRemotePlayers(dt) {
    for (const [id, rp] of this.remotePlayers) {
      // Smooth interpolation toward target position
      const lerpSpeed = 8 * dt;
      rp.x += (rp.targetX - rp.x) * Math.min(lerpSpeed, 1);
      rp.y += (rp.targetY - rp.y) * Math.min(lerpSpeed, 1);

      // Sync with in-room avatar
      if (this.game && this.game.room) {
        let avatar = this.game.room.avatars.find(a => a.id === `remote_${id}`);
        if (!avatar) {
          avatar = this.createRemoteAvatar(rp);
          this.game.room.avatars.push(avatar);
        }
        avatar.x = rp.x;
        avatar.y = rp.y;
        avatar.facing = rp.facing || 'se';
        // Mark as walking if moving
        const dx = rp.targetX - rp.x;
        const dy = rp.targetY - rp.y;
        avatar.isWalking = Math.abs(dx) > 0.05 || Math.abs(dy) > 0.05;
      }
    }

    // Remove avatars for disconnected players
    if (this.game && this.game.room) {
      this.game.room.avatars = this.game.room.avatars.filter(a => {
        if (!a.id.startsWith('remote_')) return true;
        const rid = a.id.slice(7);
        return this.remotePlayers.has(rid);
      });
    }
  }

  createRemoteAvatar(rp) {
    const outfit = rp.outfit || {};
    return new Avatar(rp.name || 'Unknown', rp.x, rp.y, {
      id: `remote_${rp.id}`,
      skinColor: outfit.skinColor || '#F5CBA7',
      hairColor: outfit.hairColor || '#5D4037',
      hairStyle: outfit.hairStyle || 'short',
      shirtColor: outfit.shirtColor || '#3498DB',
      pantsColor: outfit.pantsColor || '#2C3E50',
      shoeColor: outfit.shoeColor || '#555555',
      hatType: outfit.hatType || 'none',
      glassesType: outfit.glassesType || 'none',
      isNPC: false,
      facing: rp.facing || 'se',
      game: this.game
    });
  }
}
