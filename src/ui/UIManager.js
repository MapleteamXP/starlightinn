// ============================================================
// Starlight Engine — UI Manager
// ============================================================

export class UIManager {
  constructor(game) {
    this.game = game;
    this.overlay = document.getElementById('uiOverlay');
    this.notificationHistory = [];
  }

  createPanels() {
    if (!this.overlay) return;
    // Navigator
    this._ensurePanel('navigatorPanel', 'Room Navigator', `
      <input type="text" id="roomSearchInput" placeholder="Search rooms..." style="width:100%;padding:6px 10px;margin-bottom:10px;border:1px solid var(--habbo-panel-border);border-radius:6px;background:var(--habbo-dark);color:white;font-family:inherit;font-size:12px;box-sizing:border-box;">
      <div style="margin-bottom:8px;font-size:12px;color:var(--habbo-text-dim);">Public Rooms</div>
      <div class="room-list" id="publicRoomList"></div>
      <div style="margin:12px 0 8px;font-size:12px;color:var(--habbo-text-dim);">Your Rooms</div>
      <div class="room-list" id="userRoomList"></div>
      <div style="margin:12px 0 8px;font-size:12px;color:var(--habbo-text-dim);">Room Themes</div>
      <div class="theme-list" id="themeList"></div>
      <div style="margin:12px 0 8px;font-size:12px;color:var(--habbo-text-dim);">Room Size</div>
      <div class="theme-list" id="expansionList"></div>
    `);
    // Catalog
    this._ensurePanel('catalogPanel', 'Furniture Catalog', `
      <input type="text" id="catalogSearchInput" placeholder="Search catalog..." style="width:100%;padding:6px 10px;margin-bottom:10px;border:1px solid var(--habbo-panel-border);border-radius:6px;background:var(--habbo-dark);color:white;font-family:inherit;font-size:12px;box-sizing:border-box;">
      <div class="catalog-tabs" id="catalogTabs"></div>
      <div class="catalog-grid" id="catalogGrid"></div>
    `);
    // Inventory
    this._ensurePanel('inventoryPanel', 'My Inventory', `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <span style="font-size:11px;color:var(--habbo-text-dim);">Click to select, right-click to sell one</span>
        <button id="btnSellAll" style="padding:4px 10px;background:var(--habbo-danger);color:white;border:none;border-radius:4px;font-size:11px;cursor:pointer;font-family:inherit;font-weight:700;">Sell All</button>
      </div>
      <div id="favBar" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;min-height:0;"></div>
      <div style="display:flex;gap:6px;margin-bottom:8px;">
        <button id="invSortName" style="padding:3px 8px;background:var(--habbo-dark);color:var(--habbo-text-dim);border:1px solid var(--habbo-panel-border);border-radius:4px;font-size:10px;cursor:pointer;font-family:inherit;">A-Z</button>
        <button id="invSortCount" style="padding:3px 8px;background:var(--habbo-dark);color:var(--habbo-text-dim);border:1px solid var(--habbo-panel-border);border-radius:4px;font-size:10px;cursor:pointer;font-family:inherit;">Count</button>
      </div>
      <div class="inv-grid" id="inventoryGrid"></div>
      <div style="margin-top:10px;font-size:11px;color:var(--habbo-text-dim);text-align:center;">Click an item to select it, then click a tile to place. Star items to quick-access them.</div>
    `);
    // Settings
    this._ensurePanel('settingsPanel', 'Settings', `
      <div class="setting-row"><label>Show Minimap</label><input type="checkbox" id="settingMinimap" checked></div>
      <div class="setting-row"><label>Show Names</label><input type="checkbox" id="settingNames" checked></div>
      <div class="setting-row"><label>Chat Bubbles</label><input type="checkbox" id="settingChat" checked></div>
      <div class="setting-row"><label>NPC Count</label><select id="settingNPCs"><option value="0">None</option><option value="3" selected>3</option><option value="5">5</option><option value="8">8</option></select></div>
      <div class="setting-row"><label>Camera Speed</label><input type="range" id="settingCamSpeed" min="1" max="10" value="5"></div>
      <div class="setting-row"><label>Sound Effects</label><input type="checkbox" id="settingSound"></div>
      <div class="setting-row"><label>Sound Volume</label><input type="range" id="settingVolume" min="0" max="100" value="50"></div>
      <div class="setting-row"><label>Safe Mode</label><input type="checkbox" id="settingSafeMode"></div>
      <div class="setting-row"><label>Weather Effects</label><input type="checkbox" id="settingWeather" checked></div>
      <div class="setting-row"><label>Chat Timestamps</label><input type="checkbox" id="settingTimestamps" checked></div>
      <div class="setting-row"><label>Bubble Duration</label><input type="range" id="settingBubbleDuration" min="1" max="10" value="4.5" step="0.5"></div>
      <div class="setting-row"><label>Export Save</label><button id="btnExportSave" style="padding:4px 10px;background:var(--habbo-light);color:white;border:1px solid var(--habbo-panel-border);border-radius:4px;cursor:pointer;font-family:inherit;font-size:12px;">Download</button></div>
      <div class="setting-row"><label>Import Save</label><button id="btnImportSave" style="padding:4px 10px;background:var(--habbo-light);color:white;border:1px solid var(--habbo-panel-border);border-radius:4px;cursor:pointer;font-family:inherit;font-size:12px;">Upload</button></div>
      <input type="file" id="importFileInput" style="display:none;" accept=".json">
      <div style="margin-top:12px;font-size:11px;color:var(--habbo-text-dim);text-align:center;">Starlight Inn v2.1<br>Built with Starlight Engine</div>
    `);
    // Customize
    this._ensurePanel('customizePanel', 'Customize Avatar', `
      <div class="customize-preview"><canvas id="previewCanvas" width="88" height="128"></canvas></div>
      <div class="customize-row"><label>Skin</label><div class="color-presets" id="skinPresets"></div></div>
      <div class="customize-row"><label>Hair Color</label><div class="color-presets" id="hairPresets"></div></div>
      <div class="customize-row"><label>Hair Style</label><select id="hairStyleSelect"><option value="short">Short</option><option value="spiky">Spiky</option><option value="long">Long</option><option value="mohawk">Mohawk</option><option value="bald">Bald</option><option value="curly">Curly</option><option value="bob">Bob</option><option value="ponytail">Ponytail</option><option value="buzz">Buzz Cut</option></select></div>
      <div class="customize-row"><label>Shirt</label><div class="color-presets" id="shirtPresets"></div></div>
      <div class="customize-row"><label>Pants</label><div class="color-presets" id="pantsPresets"></div></div>
      <div class="customize-row"><label>Shoes</label><div class="color-presets" id="shoePresets"></div></div>
      <div class="customize-row"><label>Hat</label><select id="hatSelect"><option value="none">None</option><option value="cap">Cap</option><option value="beanie">Beanie</option><option value="crown">Crown</option><option value="wizard">Wizard Hat</option><option value="bowler">Bowler</option></select></div>
      <div class="customize-row"><label>Glasses</label><select id="glassesSelect"><option value="none">None</option><option value="shades">Shades</option><option value="round">Round</option><option value="heart">Heart</option></select></div>
      <div class="customize-row"><label>Title</label><select id="titleSelect" style="flex:1;"></select></div>
      <div class="customize-actions"><button class="btn-random" id="btnRandomLook">Random</button><button class="btn-save" id="btnSaveLook">Save Look</button></div>
      <div style="margin-top:12px;border-top:1px solid rgba(255,255,255,0.1);padding-top:10px;"><div style="font-size:12px;font-weight:700;color:var(--habbo-accent);margin-bottom:6px;">Wardrobe Presets (1-5)</div><div class="wardrobe-slots" id="wardrobeSlots"></div></div>
    `);
    // Chat History
    this._ensurePanel('chatPanel', 'Chat History', `<div class="chat-history" id="chatHistory"></div>`);
    // Minigames
    this._ensurePanel('minigamePanel', 'Minigames', `
      <div class="minigame-list" id="minigameList"></div>
      <div style="margin-top:10px;font-size:11px;color:var(--habbo-text-dim);text-align:center;">Earn coins by playing minigames!</div>
    `);
    // Friends
    this._ensurePanel('friendsPanel', 'Friends', `<div class="friend-list" id="friendList"></div>`);
    // Pet
    this._ensurePanel('petPanel', 'My Pet', `<div id="petContent"></div>`);
    // Daily Rewards
    this._ensurePanel('dailyRewardPanel', 'Daily Rewards', `<div id="dailyRewardContent"></div>`);
    this._ensurePanel('jukeboxPanel', 'Jukebox', `<div id="jukeboxContent"></div>`);
    // Achievements
    this._ensurePanel('achievementsPanel', 'Achievements', `<div class="achieve-list" id="achieveList"></div>`);
    // Leaderboard
    this._ensurePanel('leaderboardPanel', 'High Scores', `<div id="leaderboardContent"></div>`);
    // Crafting
    this._ensurePanel('craftingPanel', 'Crafting Workshop', `<div class="craft-list" id="craftList"></div>`);
    // Stats
    this._ensurePanel('statsPanel', 'Player Stats', `<div class="stats-list" id="statsList"></div>`);
    this._ensurePanel('collectionPanel', 'Collection', `<div class="collection-list" id="collectionList"></div>`);
    // Shortcuts
    this._ensurePanel('shortcutsPanel', 'Keyboard Shortcuts', `<div class="shortcuts-list" id="shortcutsList"></div>`);
    // Clubs
    this._ensurePanel('clubsPanel', 'Clubs & Groups', `<div id="clubsContent"></div>`);
    this._ensurePanel('marketplacePanel', 'Marketplace', `<div id="marketplaceContent"></div>`);
    // Challenges
    this._ensurePanel('challengesPanel', 'Daily Challenges', `<div class="challenge-list" id="challengeList"></div>`);
    this._ensurePanel('questPanel', 'Active Quest', `<div id="questContent"></div>`);
    // Notifications
    this._ensurePanel('notificationsPanel', 'Notification History', `<div class="notif-history" id="notifHistory"></div>`);
    this._ensurePanel('inboxPanel', 'Mailbox', `<div class="inbox-list" id="inboxList"></div>`);
    // Gallery
    this._ensurePanel('galleryPanel', 'Screenshot Gallery', `<div class="gallery-grid" id="galleryGrid"></div>`);
    // Chat color popover
    if (!document.getElementById('chatColorPopover')) {
      const popover = document.createElement('div');
      popover.className = 'chat-color-popover';
      popover.id = 'chatColorPopover';
      const colors = ['#fffde7','#ffffff','#e3f2fd','#f3e5f5','#e8f5e9','#ffebee','#fff3e0','#fce4ec','#e0f7fa','#f5f5f5','#212121','#f9fbe7'];
      colors.forEach((c, i) => {
        const swatch = document.createElement('div');
        swatch.className = 'chat-color-swatch' + (i === 0 ? ' active' : '');
        swatch.dataset.color = c;
        swatch.style.background = c;
        if (c === '#212121') swatch.style.borderColor = '#555';
        popover.appendChild(swatch);
      });
      document.getElementById('chatBar')?.appendChild(popover);
    }
  }

  _ensurePanel(id, title, bodyHtml) {
    if (document.getElementById(id)) return;
    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.id = id;
    panel.innerHTML = `
      <div class="panel-header"><span class="panel-title">${title}</span><button class="panel-close" data-panel="${id}">&times;</button></div>
      <div class="panel-body">${bodyHtml}</div>
    `;
    this.overlay.appendChild(panel);
  }

  togglePanel(id) {
    const panel = document.getElementById(id);
    if (!panel) return;
    const isOpen = panel.classList.contains('open');
    this.closeAllPanels();
    if (!isOpen) panel.classList.add('open');
  }

  closeAllPanels() {
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('open'));
  }

  showNotification(text, type = 'info', duration = 3000) {
    const area = document.getElementById('notificationArea');
    if (!area) return;
    const notif = document.createElement('div');
    notif.className = 'notification';
    notif.style.borderLeftColor = type === 'error' ? 'var(--habbo-danger)' : (type === 'success' ? 'var(--habbo-success)' : 'var(--habbo-accent)');
    notif.textContent = text;
    area.appendChild(notif);
    this.notificationHistory.unshift({ text, type, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
    if (this.notificationHistory.length > 30) this.notificationHistory.pop();
    setTimeout(() => {
      notif.style.opacity = '0';
      notif.style.transform = 'translateX(30px)';
      setTimeout(() => notif.remove(), 300);
    }, duration);
  }

  showNPCTrade(npc, items, onBuy) {
    const existing = document.getElementById('npcTrade');
    if (existing) existing.remove();
    const div = document.createElement('div');
    div.id = 'npcTrade';
    div.className = 'npc-profile';
    div.style.maxWidth = '260px';
    let html = `<div class="npc-profile-header"><span style="font-size:24px;">💼</span><div><div style="font-weight:700;font-size:14px;">${npc.name}'s Shop</div><div style="font-size:11px;color:var(--habbo-text-dim);">Limited time offers!</div></div><button class="npc-profile-close">&times;</button></div>`;
    html += `<div style="display:flex;flex-direction:column;gap:6px;margin-top:10px;">`;
    items.forEach(item => {
      const rarityColor = item.price >= 500 ? '#f4d03f' : (item.price >= 200 ? '#e67e22' : '#aaa');
      const rarityStars = item.price >= 500 ? '★★★' : (item.price >= 200 ? '★★' : '★');
      html += `<div style="display:flex;align-items:center;justify-content:space-between;padding:6px;background:rgba(0,0,0,0.15);border-radius:6px;border-left:2px solid ${rarityColor};">
        <span style="font-size:12px;">${item.icon} ${item.name} <span style="font-size:9px;color:${rarityColor};">${rarityStars}</span></span>
        <button class="trade-buy" data-id="${item.id}" style="padding:4px 10px;background:var(--habbo-accent);color:var(--habbo-dark);border:none;border-radius:5px;font-weight:700;font-size:11px;cursor:pointer;">★${item.price}</button>
      </div>`;
    });
    html += `</div>`;
    div.innerHTML = html;
    document.body.appendChild(div);
    div.querySelector('.npc-profile-close').addEventListener('click', () => div.remove());
    div.querySelectorAll('.trade-buy').forEach(btn => {
      btn.addEventListener('click', () => {
        const item = items.find(i => i.id === btn.dataset.id);
        if (item) onBuy && onBuy(item);
      });
    });
    setTimeout(() => { if (div.parentNode) div.remove(); }, 15000);
  }

  renderGallery() {
    const grid = document.getElementById('galleryGrid');
    if (!grid) return;
    let gallery = [];
    try { gallery = JSON.parse(localStorage.getItem('starlight_gallery')) || []; } catch (e) {}
    grid.innerHTML = '';
    if (gallery.length === 0) {
      grid.innerHTML = '<div style="text-align:center;color:var(--habbo-text-dim);padding:20px;">No screenshots yet. Press P for photo mode, then S to save!</div>';
      return;
    }
    gallery.forEach((shot, i) => {
      const div = document.createElement('div');
      div.className = 'gallery-item';
      div.innerHTML = `<img src="${shot.data}" style="width:100%;border-radius:6px;display:block;"><div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px;"><span style="font-size:10px;color:var(--habbo-text-dim);">#${i + 1} — ${new Date(shot.date).toLocaleDateString()}</span><button class="gallery-dl" data-idx="${i}" style="padding:2px 8px;background:var(--habbo-light);color:white;border:none;border-radius:4px;font-size:9px;cursor:pointer;font-family:inherit;">Download</button></div>`;
      grid.appendChild(div);
    });
    grid.querySelectorAll('.gallery-dl').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx);
        const shot = gallery[idx];
        if (shot) {
          const a = document.createElement('a');
          a.href = shot.data;
          a.download = `starlight-screenshot-${idx + 1}.png`;
          a.click();
        }
      });
    });
  }

  renderNotificationHistory() {
    const list = document.getElementById('notifHistory');
    if (!list) return;
    list.innerHTML = '';
    if (this.notificationHistory.length === 0) {
      list.innerHTML = '<div style="text-align:center;color:var(--habbo-text-dim);padding:20px;">No notifications yet.</div>';
      return;
    }
    this.notificationHistory.forEach(n => {
      const div = document.createElement('div');
      div.className = 'notif-history-item';
      const color = n.type === 'error' ? 'var(--habbo-danger)' : (n.type === 'success' ? 'var(--habbo-success)' : 'var(--habbo-accent)');
      div.innerHTML = `<span style="color:${color};font-weight:700;">●</span> <span>${n.text}</span><span style="color:var(--habbo-text-dim);font-size:11px;margin-left:auto;">${n.time}</span>`;
      list.appendChild(div);
    });
  }

  _getRoomOccupancy(roomId) {
    // Deterministic pseudo-random based on room id and time of day
    const hour = new Date().getHours();
    const base = { lobby: 24, beach: 12, forest: 8, game: 18, rooftop: 6, club: 20, pool: 14, restaurant: 10, library: 7, spa: 9, cinema: 11, garden: 13, arcade_room: 16 }[roomId] || 8;
    const variance = Math.floor(Math.sin(Date.now() / 3600000 + roomId.length) * 6 + 6);
    const timeMod = (hour >= 18 || hour <= 2) ? 1.4 : (hour >= 9 && hour <= 17) ? 1.0 : 0.6;
    return Math.floor((base + variance) * timeMod);
  }

  showBotDialog(bot, dialogItems) {
    const existing = document.getElementById('botDialog');
    if (existing) existing.remove();
    const div = document.createElement('div');
    div.id = 'botDialog';
    div.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:280px;background:var(--habbo-panel);border:2px solid var(--habbo-accent);border-radius:12px;padding:16px;z-index:400;box-shadow:0 8px 32px rgba(0,0,0,0.4);font-family:Nunito,sans-serif;color:#fff;';
    div.innerHTML = `
      <div style="text-align:center;font-size:32px;margin-bottom:8px;">${bot.emoji}</div>
      <div style="text-align:center;font-weight:700;margin-bottom:4px;">${bot.name}</div>
      <div style="text-align:center;font-size:12px;color:var(--habbo-text-dim);margin-bottom:14px;">${bot.greeting}</div>
      <div id="botDialogActions" style="display:flex;flex-direction:column;gap:6px;"></div>
    `;
    document.body.appendChild(div);
    const actionsDiv = div.querySelector('#botDialogActions');
    if (dialogItems && dialogItems.length > 0) {
      dialogItems.forEach(item => {
        const btn = document.createElement('button');
        btn.textContent = item.text;
        btn.style.cssText = 'padding:8px;background:var(--habbo-dark);color:white;border:1px solid var(--habbo-panel-border);border-radius:8px;font-family:inherit;font-size:12px;cursor:pointer;font-weight:700;transition:all 0.15s;';
        btn.addEventListener('mouseenter', () => btn.style.background = 'var(--habbo-light)');
        btn.addEventListener('mouseleave', () => btn.style.background = 'var(--habbo-dark)');
        btn.addEventListener('click', () => { item.action(); if (item.text.includes('close') || item.text.includes('Goodbye') || item.text.includes('later') || item.text.includes('today')) div.remove(); });
        actionsDiv.appendChild(btn);
      });
    }
    setTimeout(() => { if (div.parentNode) div.remove(); }, 15000);
  }

  showRateRoomDialog(onRate) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:3000;';
    const panel = document.createElement('div');
    panel.style.cssText = 'background:var(--habbo-dark);border:2px solid var(--habbo-accent);border-radius:12px;padding:20px;width:260px;text-align:center;color:#fff;font-family:inherit;';
    let selected = 0;
    const renderStars = () => {
      let stars = '';
      for (let i = 1; i <= 5; i++) {
        stars += `<span class="rate-star" data-val="${i}" style="font-size:28px;cursor:pointer;color:${i <= selected ? 'var(--habbo-accent)' : '#555'};">★</span>`;
      }
      return stars;
    };
    panel.innerHTML = `
      <div style="font-size:28px;margin-bottom:6px;">⭐</div>
      <div style="font-weight:700;margin-bottom:12px;">Rate This Room</div>
      <div id="rateStars" style="margin-bottom:12px;">${renderStars()}</div>
      <textarea id="rateReview" placeholder="Write a quick review... (optional)" maxlength="80" style="width:100%;padding:8px;border-radius:8px;border:1px solid var(--habbo-panel-border);background:var(--habbo-dark);color:#fff;font-family:inherit;font-size:12px;resize:none;box-sizing:border-box;margin-bottom:12px;"></textarea>
      <div style="display:flex;gap:8px;">
        <button id="rateCancel" style="flex:1;padding:8px;border:none;border-radius:8px;background:#555;color:#fff;cursor:pointer;font-family:inherit;">Cancel</button>
        <button id="rateSubmit" style="flex:1;padding:8px;border:none;border-radius:8px;background:var(--habbo-accent);color:var(--habbo-dark);cursor:pointer;font-family:inherit;font-weight:700;">Submit</button>
      </div>
    `;
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    panel.querySelectorAll('.rate-star').forEach(star => {
      star.addEventListener('click', () => { selected = parseInt(star.dataset.val); document.getElementById('rateStars').innerHTML = renderStars(); });
    });
    panel.querySelector('#rateCancel')?.addEventListener('click', () => overlay.remove());
    panel.querySelector('#rateSubmit')?.addEventListener('click', () => {
      if (selected > 0) {
        const review = document.getElementById('rateReview')?.value || '';
        onRate && onRate(selected, review);
      }
      overlay.remove();
    });
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  }

  showOutfitCode(code) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:3000;';
    const panel = document.createElement('div');
    panel.style.cssText = 'background:var(--habbo-dark);border:2px solid var(--habbo-accent);border-radius:12px;padding:20px;width:320px;text-align:center;color:#fff;font-family:inherit;';
    panel.innerHTML = `
      <div style="font-size:24px;margin-bottom:8px;">📋</div>
      <div style="font-weight:700;margin-bottom:8px;">Outfit Code</div>
      <div style="background:rgba(0,0,0,0.3);padding:10px;border-radius:8px;font-size:11px;word-break:break-all;margin-bottom:12px;font-family:monospace;color:var(--habbo-accent);">${code}</div>
      <button id="btnCopyCode" style="padding:8px 16px;background:var(--habbo-accent);color:var(--habbo-dark);border:none;border-radius:8px;font-weight:700;cursor:pointer;font-family:inherit;">Copy to Clipboard</button>
      <button id="btnCloseCode" style="margin-left:8px;padding:8px 16px;background:#555;color:#fff;border:none;border-radius:8px;cursor:pointer;font-family:inherit;">Close</button>
    `;
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    panel.querySelector('#btnCloseCode')?.addEventListener('click', () => overlay.remove());
    panel.querySelector('#btnCopyCode')?.addEventListener('click', () => {
      navigator.clipboard?.writeText(code).then(() => this.showNotification('Copied!', 'success')).catch(() => this.showNotification('Copy failed', 'error'));
    });
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  }

  showDoorbell(roomName, onKnock) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:3000;';
    const panel = document.createElement('div');
    panel.style.cssText = 'background:var(--habbo-dark);border:2px solid var(--habbo-accent);border-radius:12px;padding:20px;width:240px;text-align:center;color:#fff;font-family:inherit;';
    panel.innerHTML = `
      <div style="font-size:32px;margin-bottom:8px;">🔒</div>
      <div style="font-weight:700;margin-bottom:4px;">${roomName}</div>
      <div style="font-size:12px;color:var(--habbo-text-dim);margin-bottom:16px;">This room is private. Knock to request entry.</div>
      <div style="display:flex;gap:8px;">
        <button id="dbCancel" style="flex:1;padding:8px;border:none;border-radius:8px;background:#555;color:#fff;cursor:pointer;font-family:inherit;">Cancel</button>
        <button id="dbKnock" style="flex:1;padding:8px;border:none;border-radius:8px;background:var(--habbo-accent);color:var(--habbo-dark);cursor:pointer;font-family:inherit;font-weight:700;">Knock</button>
      </div>
    `;
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    panel.querySelector('#dbCancel')?.addEventListener('click', () => overlay.remove());
    panel.querySelector('#dbKnock')?.addEventListener('click', () => { onKnock && onKnock(); overlay.remove(); });
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  }

  showAchievementPopup(ach) {
    const existing = document.querySelector('.achievement-popup');
    if (existing) existing.remove();
    const div = document.createElement('div');
    div.className = 'achievement-popup';
    div.innerHTML = `
      <div class="ach-pop-icon">${ach.icon}</div>
      <div class="ach-pop-title">Achievement Unlocked!</div>
      <div style="font-weight:700;color:#fff;margin:4px 0;">${ach.name}</div>
      <div class="ach-pop-text">${ach.desc} — +★${ach.reward}</div>
    `;
    document.body.appendChild(div);
    setTimeout(() => { if (div.parentNode) div.remove(); }, 3500);
  }

  renderExpansions(expansions, currentSize, currency, onExpand) {
    const list = document.getElementById('expansionList');
    if (!list) return;
    list.innerHTML = '';
    expansions.forEach(e => {
      const div = document.createElement('div');
      div.className = 'room-item';
      const isCurrent = e.size === currentSize;
      div.innerHTML = `<div class="room-name">${e.size}x${e.size}</div><div class="room-desc">${e.size * e.size} tiles</div><div class="room-meta">${isCurrent ? 'Current' : (e.price === 0 ? 'Free' : '\u2605 ' + e.price)}</div>`;
      div.addEventListener('click', () => {
        if (!isCurrent) onExpand && onExpand(e);
      });
      list.appendChild(div);
    });
  }

  renderThemes(themes, owned, current, currency, onBuy, onApply) {
    const list = document.getElementById('themeList');
    if (!list) return;
    list.innerHTML = '';
    themes.forEach(t => {
      const isOwned = owned.includes(t.id) || t.price === 0;
      const isCurrent = current === t.id;
      const div = document.createElement('div');
      div.className = 'room-item';
      div.innerHTML = `
        <div class="room-name">${t.name}</div>
        <div class="room-desc">${t.floor} floor · ${t.wall} walls</div>
        <div class="room-meta">${isCurrent ? 'Active' : (isOwned ? 'Owned' : '\u2605 ' + t.price)}</div>
      `;
      div.addEventListener('click', () => {
        if (isCurrent) return;
        if (isOwned) onApply && onApply(t);
        else onBuy && onBuy(t);
      });
      list.appendChild(div);
    });
  }

  renderNavigator(rooms, recent, onSelect, onRenameMyRoom, myRoomPrivate, onTogglePrivacy, searchQuery = '', bookmarks, onToggleBookmark, visitorLog = [], getRoomRating = null) {
    const publicList = document.getElementById('publicRoomList');
    if (!publicList) return;
    publicList.innerHTML = '';
    const q = searchQuery.toLowerCase();
    let filtered = q ? rooms.filter(r => r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q)) : rooms;
    // Sort bookmarked rooms first
    if (bookmarks) {
      filtered = [...filtered].sort((a, b) => {
        const ab = bookmarks.has(a.id) ? 1 : 0;
        const bb = bookmarks.has(b.id) ? 1 : 0;
        return bb - ab;
      });
    }
    filtered.forEach(room => {
      const div = document.createElement('div');
      div.className = 'room-item';
      const occupancy = this._getRoomOccupancy(room.id);
      const isBookmarked = bookmarks && bookmarks.has(room.id);
      const avg = getRoomRating ? getRoomRating(room.id) : 0;
      const stars = avg > 0 ? '★'.repeat(Math.round(avg)) + '☆'.repeat(5 - Math.round(avg)) + ` ${avg.toFixed(1)}` : '';
      div.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;"><span class="room-name">${room.name}</span><span class="bookmark-star" data-id="${room.id}" style="cursor:pointer;font-size:14px;color:${isBookmarked ? 'var(--habbo-accent)' : 'var(--habbo-text-dim)'};">${isBookmarked ? '\u2605' : '\u2606'}</span></div><div class="room-desc">${room.description}</div><div class="room-meta">${occupancy} users online ${occupancy > 15 ? '🔥' : ''} <span style="color:var(--habbo-accent);">${stars}</span></div>`;
      div.addEventListener('click', e => {
        if (e.target.classList.contains('bookmark-star')) {
          e.stopPropagation();
          onToggleBookmark && onToggleBookmark(room.id);
        } else {
          onSelect && onSelect(room);
        }
      });
      publicList.appendChild(div);
    });
    const userList = document.getElementById('userRoomList');
    if (!userList) return;
    userList.innerHTML = '';
    const myRoomDiv = document.createElement('div');
    myRoomDiv.className = 'room-item';
    myRoomDiv.innerHTML = `<div class="room-name">My Room ${myRoomPrivate ? '🔒' : '🌐'}</div><div class="room-desc">Your personal customizable space</div><div class="room-meta">${myRoomPrivate ? 'Private' : 'Public'} · Owner: You</div>`;
    myRoomDiv.addEventListener('click', () => {
      const userTemplate = { id: 'myroom', name: 'My Room', description: 'Your personal space at Starlight Inn', width: 10, height: 10, floor: 'wood', wall: '#8B4513', map: Array.from({length:10},()=>Array(10).fill(1)), furniture: [] };
      onSelect && onSelect(userTemplate);
    });
    userList.appendChild(myRoomDiv);
    if (onTogglePrivacy) {
      const privDiv = document.createElement('div');
      privDiv.style.cssText = 'margin-top:6px;display:flex;align-items:center;gap:8px;font-size:12px;color:var(--habbo-text-dim);';
      privDiv.innerHTML = `<input type="checkbox" id="myRoomPrivacy" ${myRoomPrivate ? 'checked' : ''} style="cursor:pointer;"><label for="myRoomPrivacy" style="cursor:pointer;">Make My Room private</label>`;
      userList.appendChild(privDiv);
      document.getElementById('myRoomPrivacy')?.addEventListener('change', e => { onTogglePrivacy(e.target.checked); });
    }
    if (onRenameMyRoom) {
      const renameDiv = document.createElement('div');
      renameDiv.style.cssText = 'margin-top:8px;display:flex;gap:6px;';
      renameDiv.innerHTML = `<input type="text" id="myRoomNameInput" placeholder="Rename My Room..." maxlength="20" style="flex:1;padding:6px 8px;border:1px solid var(--habbo-panel-border);border-radius:6px;background:var(--habbo-dark);color:white;font-family:inherit;font-size:12px;"><button id="myRoomRenameBtn" style="padding:6px 12px;background:var(--habbo-light);color:white;border:none;border-radius:6px;font-weight:700;font-size:11px;cursor:pointer;">Rename</button>`;
      userList.appendChild(renameDiv);
      document.getElementById('myRoomRenameBtn')?.addEventListener('click', () => {
        const input = document.getElementById('myRoomNameInput');
        if (input && input.value.trim()) { onRenameMyRoom(input.value.trim()); input.value = ''; }
      });
    }
    // Layout export/import
    const layoutDiv = document.createElement('div');
    layoutDiv.style.cssText = 'margin-top:8px;display:flex;gap:6px;';
    layoutDiv.innerHTML = `<button id="btnExportLayout" style="flex:1;padding:6px 8px;background:var(--habbo-dark);color:var(--habbo-text);border:1px solid var(--habbo-panel-border);border-radius:6px;font-family:inherit;font-size:11px;cursor:pointer;font-weight:700;">\u{1F4BE} Export Layout</button><button id="btnImportLayout" style="flex:1;padding:6px 8px;background:var(--habbo-dark);color:var(--habbo-text);border:1px solid var(--habbo-panel-border);border-radius:6px;font-family:inherit;font-size:11px;cursor:pointer;font-weight:700;">\u{1F4C1} Import Layout</button><input type="file" id="importLayoutFile" accept=".json" style="display:none;">`;
    userList.appendChild(layoutDiv);
    if (recent && recent.length > 0) {
      const recentDiv = document.createElement('div');
      recentDiv.style.cssText = 'margin-top:12px;font-size:12px;color:var(--habbo-text-dim);';
      recentDiv.textContent = 'Recently Visited';
      userList.appendChild(recentDiv);
      recent.forEach(r => {
        const div = document.createElement('div');
        div.className = 'room-item';
        div.innerHTML = `<div class="room-name">${r.name}</div><div class="room-meta">${new Date(r.time).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</div>`;
        div.addEventListener('click', () => {
          const room = rooms.find(x => x.id === r.id);
          if (room) onSelect && onSelect(room);
        });
        userList.appendChild(div);
      });
    }
    // Visitor log
    if (visitorLog && visitorLog.length > 0) {
      const visDiv = document.createElement('div');
      visDiv.style.cssText = 'margin-top:12px;font-size:12px;color:var(--habbo-text-dim);';
      visDiv.textContent = `Recent Visitors (${visitorLog.length})`;
      userList.appendChild(visDiv);
      visitorLog.slice(0, 5).forEach(v => {
        const div = document.createElement('div');
        div.className = 'room-item';
        div.innerHTML = `<div class="room-name">${v.name}</div><div class="room-meta">${new Date(v.time).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</div>`;
        userList.appendChild(div);
      });
    }
  }

  renderCatalog(items, categories, activeCategory, currency, onBuy, onCategory, searchQuery = '') {
    const tabs = document.getElementById('catalogTabs');
    if (tabs) {
      tabs.innerHTML = '';
      categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'catalog-tab' + (cat.id === activeCategory ? ' active' : '');
        btn.textContent = `${cat.icon} ${cat.name}`;
        btn.addEventListener('click', () => onCategory && onCategory(cat.id));
        tabs.appendChild(btn);
      });
    }
    const grid = document.getElementById('catalogGrid');
    if (!grid) return;
    grid.innerHTML = '';
    const q = searchQuery.toLowerCase();
    const filtered = q ? items.filter(i => i.name.toLowerCase().includes(q) || i.id.toLowerCase().includes(q)) : items;
    if (filtered.length === 0) {
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--habbo-text-dim);padding:20px;">No items match your search.</div>';
      return;
    }
    filtered.forEach(item => {
      const div = document.createElement('div');
      div.className = 'catalog-item';
      div.title = item.desc;
      const rarity = item.price >= 500 ? '★★★' : (item.price >= 200 ? '★★' : '★');
      const rarityColor = item.price >= 500 ? '#f4d03f' : (item.price >= 200 ? '#e67e22' : '#aaa');
      div.innerHTML = `<div class="cat-rarity" style="color:${rarityColor}">${rarity}</div><div class="cat-icon">${item.icon}</div><div class="cat-name">${item.name}</div><div class="cat-price">\u2605 ${item.price}</div>`;
      div.addEventListener('click', () => this.showCatalogBuyPopup(item, currency, onBuy));
      grid.appendChild(div);
    });
  }

  showCatalogBuyPopup(item, currency, onBuy) {
    let quantity = 1;
    const overlay = document.createElement('div');
    overlay.id = 'catalogBuyOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:3000;';
    const panel = document.createElement('div');
    panel.style.cssText = 'background:var(--habbo-dark);border:2px solid var(--habbo-accent);border-radius:12px;padding:20px;width:260px;color:#fff;font-family:inherit;';
    const updateTotal = () => {
      const total = item.price * quantity;
      const canAfford = total <= currency;
      panel.innerHTML = `
        <div style="text-align:center;font-size:32px;margin-bottom:8px;">${item.icon}</div>
        <div style="text-align:center;font-weight:700;margin-bottom:4px;">${item.name}</div>
        <div style="text-align:center;font-size:12px;color:var(--habbo-text-dim);margin-bottom:12px;">${item.desc}</div>
        <div style="display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:12px;">
          <button id="cbqMinus" style="width:28px;height:28px;border-radius:50%;border:none;background:var(--habbo-light);color:#fff;font-size:16px;cursor:pointer;">-</button>
          <span id="cbqNum" style="font-size:18px;font-weight:700;width:30px;text-align:center;">${quantity}</span>
          <button id="cbqPlus" style="width:28px;height:28px;border-radius:50%;border:none;background:var(--habbo-light);color:#fff;font-size:16px;cursor:pointer;">+</button>
        </div>
        <div style="text-align:center;margin-bottom:16px;font-size:14px;">Total: <span style="color:${canAfford ? 'var(--habbo-accent)' : '#e74c3c'};font-weight:700;">★${total}</span></div>
        <div style="display:flex;gap:8px;">
          <button id="cbqCancel" style="flex:1;padding:8px;border:none;border-radius:8px;background:#555;color:#fff;cursor:pointer;font-family:inherit;">Cancel</button>
          <button id="cbqBuy" style="flex:1;padding:8px;border:none;border-radius:8px;background:${canAfford ? 'var(--habbo-accent)' : '#777'};color:#fff;cursor:${canAfford ? 'pointer' : 'not-allowed'};font-family:inherit;font-weight:700;" ${canAfford ? '' : 'disabled'}>Buy</button>
        </div>
      `;
      panel.querySelector('#cbqMinus')?.addEventListener('click', () => { if (quantity > 1) { quantity--; updateTotal(); } });
      panel.querySelector('#cbqPlus')?.addEventListener('click', () => { if (quantity < 10) { quantity++; updateTotal(); } });
      panel.querySelector('#cbqCancel')?.addEventListener('click', () => overlay.remove());
      panel.querySelector('#cbqBuy')?.addEventListener('click', () => { onBuy && onBuy(item, quantity); overlay.remove(); });
    };
    updateTotal();
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  }

  renderInventory(inventory, selected, onSelect, onSell, onSellAll, favorites, onToggleFavorite, sortBy, onSort, getRarityColor) {
    const grid = document.getElementById('inventoryGrid');
    const favBar = document.getElementById('favBar');
    if (!grid) return;
    grid.innerHTML = '';
    if (favBar) {
      favBar.innerHTML = '';
      const favItems = Object.keys(inventory).filter(type => favorites.has(type));
      if (favItems.length > 0) {
        favItems.forEach(type => {
          const btn = document.createElement('button');
          btn.style.cssText = 'padding:4px 10px;background:var(--habbo-light);color:white;border:none;border-radius:12px;font-size:11px;cursor:pointer;font-family:inherit;font-weight:700;white-space:nowrap;';
          btn.textContent = '\u2b50 ' + type;
          btn.addEventListener('click', () => onSelect && onSelect(type));
          favBar.appendChild(btn);
        });
      } else {
        favBar.innerHTML = '<span style="font-size:11px;color:var(--habbo-text-dim);">Star items to quick-access them here</span>';
      }
    }
    // Sort buttons
    const sortNameBtn = document.getElementById('invSortName');
    const sortCountBtn = document.getElementById('invSortCount');
    if (sortNameBtn) {
      sortNameBtn.style.color = sortBy === 'name' ? 'var(--habbo-accent)' : 'var(--habbo-text-dim)';
      const newBtn = sortNameBtn.cloneNode(true);
      sortNameBtn.parentNode.replaceChild(newBtn, sortNameBtn);
      newBtn.addEventListener('click', () => onSort && onSort('name'));
    }
    if (sortCountBtn) {
      sortCountBtn.style.color = sortBy === 'count' ? 'var(--habbo-accent)' : 'var(--habbo-text-dim)';
      const newBtn = sortCountBtn.cloneNode(true);
      sortCountBtn.parentNode.replaceChild(newBtn, sortCountBtn);
      newBtn.addEventListener('click', () => onSort && onSort('count'));
    }
    let items = Object.entries(inventory);
    if (sortBy === 'name') items.sort((a, b) => a[0].localeCompare(b[0]));
    else if (sortBy === 'count') items.sort((a, b) => b[1] - a[1]);
    if (items.length === 0) {
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--habbo-text-dim);padding:20px;">Your inventory is empty. Visit the catalog to buy furniture!</div>';
      return;
    }
    items.forEach(([type, count]) => {
      const div = document.createElement('div');
      div.className = 'inv-item';
      const isFav = favorites && favorites.has(type);
      const rarityColor = getRarityColor ? getRarityColor(type) : null;
      div.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;"><span>${type}</span><span class="fav-star" data-type="${type}" style="cursor:pointer;font-size:14px;color:${isFav ? 'var(--habbo-accent)' : 'var(--habbo-text-dim)'};">${isFav ? '\u2605' : '\u2606'}</span></div><div class="inv-count">x${count}</div>`;
      if (selected === type) {
        div.style.borderColor = 'var(--habbo-accent)';
        div.style.background = 'rgba(244,208,63,0.25)';
      } else if (rarityColor) {
        div.style.borderColor = rarityColor;
      }
      div.addEventListener('click', e => {
        if (e.target.classList.contains('fav-star')) {
          e.stopPropagation();
          onToggleFavorite && onToggleFavorite(type);
        } else {
          onSelect && onSelect(type);
        }
      });
      if (onSell) {
        div.addEventListener('contextmenu', e => { e.preventDefault(); e.stopPropagation(); onSell(type); });
      }
      grid.appendChild(div);
    });
    const sellAllBtn = document.getElementById('btnSellAll');
    if (sellAllBtn) {
      const newBtn = sellAllBtn.cloneNode(true);
      sellAllBtn.parentNode.replaceChild(newBtn, sellAllBtn);
      newBtn.addEventListener('click', () => {
        if (items.length === 0) return;
        if (confirm(`Sell ALL ${items.length} item types for half value?`)) {
          onSellAll && onSellAll();
        }
      });
    }
  }

  renderCustomizePanel(customize, onChange, onSave, onRandom, titles, currentTitle, onTitleChange, wardrobePresets, onWardrobeSave, onWardrobeApply, onWardrobeDelete, onExport, onImport) {
    // Update selects
    const hairStyleSelect = document.getElementById('hairStyleSelect');
    const hatSelect = document.getElementById('hatSelect');
    const glassesSelect = document.getElementById('glassesSelect');
    if (hairStyleSelect) hairStyleSelect.value = customize.hairStyle;
    if (hatSelect) hatSelect.value = customize.hatType;
    if (glassesSelect) glassesSelect.value = customize.glassesType;

    const titleSelect = document.getElementById('titleSelect');
    if (titleSelect && titles) {
      titleSelect.innerHTML = '';
      titles.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t;
        opt.textContent = t;
        if (t === currentTitle) opt.selected = true;
        titleSelect.appendChild(opt);
      });
      const newSelect = titleSelect.cloneNode(true);
      titleSelect.parentNode.replaceChild(newSelect, titleSelect);
      newSelect.addEventListener('change', e => onTitleChange && onTitleChange(e.target.value));
    }

    this.renderColorPresets('skinPresets', ['#F5CBA7','#E0AC69','#8D5524','#C68642','#FFDBAC','#AA7C58','#F1C27D','#E8C39E'], customize.skinColor, 'skinColor', onChange);
    this.renderColorPresets('hairPresets', ['#090806','#2C1608','#71635A','#B7A69E','#D6C4C2','#B55239','#A52A2A','#DC143C','#4B0082','#228B22','#F1C40F','#D5DBDB'], customize.hairColor, 'hairColor', onChange);
    this.renderColorPresets('shirtPresets', ['#E74C3C','#3498DB','#2ECC71','#F1C40F','#9B59B6','#E67E22','#1ABC9C','#34495E','#FF6B6B','#4ECDC4','#FFFFFF','#111111'], customize.shirtColor, 'shirtColor', onChange);
    this.renderColorPresets('pantsPresets', ['#2C3E50','#34495E','#1ABC9C','#8E44AD','#D35400','#7F8C8D','#2980B9','#27AE60','#C0392B','#000000'], customize.pantsColor, 'pantsColor', onChange);
    this.renderColorPresets('shoePresets', ['#555555','#333333','#8B4513','#000000','#FFFFFF','#C0392B'], customize.shoeColor, 'shoeColor', onChange);

    // Wire buttons
    const btnSave = document.getElementById('btnSaveLook');
    const btnRandom = document.getElementById('btnRandomLook');
    if (btnSave) {
      const newBtn = btnSave.cloneNode(true);
      btnSave.parentNode.replaceChild(newBtn, btnSave);
      newBtn.addEventListener('click', onSave);
    }
    if (btnRandom) {
      const newBtn = btnRandom.cloneNode(true);
      btnRandom.parentNode.replaceChild(newBtn, btnRandom);
      newBtn.addEventListener('click', onRandom);
    }

    this.renderCustomizePreview(customize);

    // Wardrobe presets
    const wardrobeContainer = document.getElementById('wardrobeSlots');
    if (wardrobeContainer && wardrobePresets) {
      // Export/import row
      const exportRow = document.createElement('div');
      exportRow.style.cssText = 'display:flex;gap:6px;margin-bottom:8px;';
      exportRow.innerHTML = `<button id="btnExportOutfit" style="flex:1;padding:5px 8px;background:var(--habbo-dark);color:var(--habbo-text);border:1px solid var(--habbo-panel-border);border-radius:6px;font-size:11px;cursor:pointer;font-family:inherit;font-weight:700;">📋 Export Code</button><button id="btnImportOutfit" style="flex:1;padding:5px 8px;background:var(--habbo-dark);color:var(--habbo-text);border:1px solid var(--habbo-panel-border);border-radius:6px;font-size:11px;cursor:pointer;font-family:inherit;font-weight:700;">📥 Import Code</button>`;
      wardrobeContainer.parentNode.insertBefore(exportRow, wardrobeContainer);
      document.getElementById('btnExportOutfit')?.addEventListener('click', () => onExport && onExport());
      document.getElementById('btnImportOutfit')?.addEventListener('click', () => {
        const code = prompt('Paste outfit code:');
        if (code) onImport && onImport(code);
      });
      
      wardrobeContainer.innerHTML = '';
      wardrobePresets.forEach((preset, idx) => {
        const slot = document.createElement('div');
        slot.className = 'wardrobe-slot' + (preset ? ' filled' : '');
        slot.style.cssText = 'width:44px;height:52px;border-radius:8px;border:2px solid rgba(255,255,255,0.15);display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;transition:all 0.2s;position:relative;background:rgba(0,0,0,0.2);';
        if (preset) {
          slot.style.borderColor = 'var(--habbo-accent)';
          slot.innerHTML = `<div style="font-size:18px;">${preset.hatType !== 'none' ? '👤' : '👕'}</div><div style="font-size:9px;color:#aaa;margin-top:2px;">${idx + 1}</div>`;
          slot.title = `Apply outfit ${idx + 1}`;
          slot.addEventListener('click', () => onWardrobeApply && onWardrobeApply(idx));
          const del = document.createElement('div');
          del.innerHTML = '×';
          del.style.cssText = 'position:absolute;top:-4px;right:-4px;width:14px;height:14px;border-radius:50%;background:#e74c3c;color:#fff;font-size:10px;display:flex;align-items:center;justify-content:center;cursor:pointer;';
          del.addEventListener('click', ev => { ev.stopPropagation(); onWardrobeDelete && onWardrobeDelete(idx); });
          slot.appendChild(del);
        } else {
          slot.innerHTML = `<div style="font-size:16px;color:#666;">+</div><div style="font-size:9px;color:#666;margin-top:2px;">${idx + 1}</div>`;
          slot.title = `Save current look to slot ${idx + 1}`;
          slot.addEventListener('click', () => onWardrobeSave && onWardrobeSave(idx));
        }
        slot.addEventListener('mouseenter', () => slot.style.transform = 'scale(1.08)');
        slot.addEventListener('mouseleave', () => slot.style.transform = 'scale(1)');
        wardrobeContainer.appendChild(slot);
      });
      wardrobeContainer.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;';
    }
  }

  renderColorPresets(containerId, colors, current, key, onChange) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    colors.forEach(color => {
      const swatch = document.createElement('div');
      swatch.className = 'color-swatch' + (color === current ? ' active' : '');
      swatch.style.backgroundColor = color;
      swatch.addEventListener('click', () => onChange && onChange(key, color));
      container.appendChild(swatch);
    });
  }

  renderCustomizePreview(customize) {
    const canvas = document.getElementById('previewCanvas');
    if (!canvas) return;
    // Will be drawn by Game which imports Generator
    const event = new CustomEvent('renderPreview', { detail: customize });
    canvas.dispatchEvent(event);
  }

  updateCurrency(amount) {
    const el = document.getElementById('currencyDisplay');
    if (el) el.textContent = amount.toLocaleString();
  }

  updateLevelDisplay(prog) {
    const el = document.getElementById('levelDisplay');
    if (el) el.textContent = `Lv. ${prog.level} ${prog.title}`;
  }

  updateChallengeBadge(text) {
    const el = document.getElementById('challengeBadge');
    if (!el) return;
    if (text) { el.textContent = text; el.style.display = 'block'; }
    else { el.style.display = 'none'; }
  }

  updateToolButtons(selectedTool) {
    document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
    const map = { walk: 'toolWalk', place: 'toolPlace', pick: 'toolPick' };
    const id = map[selectedTool];
    if (id) {
      const btn = document.getElementById(id);
      if (btn) btn.classList.add('active');
    }
  }

  renderMinigamePanel(games, onLaunch) {
    const list = document.getElementById('minigameList');
    if (!list) return;
    list.innerHTML = '';
    games.forEach(g => {
      const div = document.createElement('div');
      div.className = 'room-item';
      div.innerHTML = `<div class="room-name">${g.name}</div><div class="room-desc">${g.desc}</div><div class="room-meta">Reward: \u2605 ${g.reward}</div>`;
      div.addEventListener('click', () => onLaunch && onLaunch(g));
      list.appendChild(div);
    });
  }

  renderFriends(friends, onGift, onGiftAll) {
    const list = document.getElementById('friendList');
    if (!list) return;
    list.innerHTML = '';
    if (friends.length === 0) {
      list.innerHTML = '<div style="text-align:center;color:var(--habbo-text-dim);padding:20px;">No friends yet. Visit rooms to meet people!</div>';
      return;
    }
    if (onGiftAll) {
      const header = document.createElement('div');
      header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;';
      header.innerHTML = `<span style="font-size:12px;color:var(--habbo-text-dim);">${friends.length} friends</span><button id="btnGiftAll" style="padding:4px 10px;background:var(--habbo-accent);color:var(--habbo-dark);border:none;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;">Gift All 🎁</button>`;
      list.appendChild(header);
      document.getElementById('btnGiftAll')?.addEventListener('click', () => onGiftAll());
    }
    friends.forEach(f => {
      const div = document.createElement('div');
      div.className = 'friend-item';
      const statusColor = f.status === 'online' ? '#2ecc71' : (f.status === 'away' ? '#f39c12' : '#7f8c8d');
      div.innerHTML = `
        <div class="friend-row">
          <span class="friend-name">${f.name}</span>
          <span class="friend-status" style="color:${statusColor}">${f.status}</span>
        </div>
        <div class="friend-meta">Room: ${f.room} | Friendship: ${f.friendship}/100</div>
        <div class="friend-bar"><div style="width:${f.friendship}%;background:${statusColor};height:4px;border-radius:2px;"></div></div>
      `;
      list.appendChild(div);
    });
  }

  renderPetPanel(petSystem, onAdopt, onFeed, onPlay, onRest, onRename) {
    const content = document.getElementById('petContent');
    if (!content) return;
    const pet = petSystem.pet;
    if (!pet) {
      content.innerHTML = `
        <div style="text-align:center;padding:20px;">
          <div style="font-size:48px;margin-bottom:12px;">🐾</div>
          <div style="color:var(--habbo-text-dim);margin-bottom:16px;">You don't have a pet yet!</div>
          <div class="pet-adopt-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">
            <button class="pet-adopt-btn" data-type="dog">🐶 Dog</button>
            <button class="pet-adopt-btn" data-type="cat">🐱 Cat</button>
            <button class="pet-adopt-btn" data-type="bird">🐦 Bird</button>
            <button class="pet-adopt-btn" data-type="dragon">🐲 Dragon</button>
            <button class="pet-adopt-btn" data-type="bunny">🐰 Bunny</button>
          </div>
        </div>`;
      content.querySelectorAll('.pet-adopt-btn').forEach(btn => {
        btn.addEventListener('click', () => onAdopt && onAdopt(btn.dataset.type));
      });
      return;
    }
    const emoji = petSystem.getEmoji();
    content.innerHTML = `
      <div style="text-align:center;padding:12px;">
        <div style="font-size:56px;margin-bottom:4px;">${emoji}</div>
        <div style="font-weight:700;font-size:16px;">${pet.name}</div>
        <div style="font-size:11px;color:var(--habbo-text-dim);margin-bottom:4px;">${pet.type.toUpperCase()} — Level ${pet.level} ${petSystem.getStage()?.icon || ''}</div>
        <div style="font-size:10px;color:var(--habbo-accent);font-weight:700;margin-bottom:8px;">${petSystem.getStage()?.name || ''} Stage</div>
        <div class="pet-stat"><label>XP</label><div class="pet-bar"><div style="width:${(pet.xp / (pet.level * 100)) * 100}%;background:#9b59b6;"></div></div></div>
        <div class="pet-stat"><label>Hunger</label><div class="pet-bar"><div style="width:${pet.hunger}%;background:#e74c3c;"></div></div></div>
        <div class="pet-stat"><label>Happiness</label><div class="pet-bar"><div style="width:${pet.happiness}%;background:#f4d03f;"></div></div></div>
        <div class="pet-stat"><label>Energy</label><div class="pet-bar"><div style="width:${pet.energy}%;background:#3498db;"></div></div></div>
        <div style="display:flex;gap:8px;margin-top:14px;">
          <button id="petFeed" class="pet-action">🍖 Feed</button>
          <button id="petPlay" class="pet-action">🎾 Play</button>
          <button id="petRest" class="pet-action">💤 Rest</button>
        </div>
        <div style="display:flex;gap:8px;margin-top:10px;">
          <input id="petRenameInput" type="text" placeholder="New name..." maxlength="12" style="flex:1;padding:6px 8px;border:1px solid var(--habbo-panel-border);border-radius:6px;background:var(--habbo-dark);color:white;font-family:inherit;font-size:12px;">
          <button id="petRename" style="padding:6px 12px;background:var(--habbo-light);color:white;border:none;border-radius:6px;font-weight:700;font-size:11px;cursor:pointer;">Rename</button>
        </div>
        <button id="petRelease" style="margin-top:10px;background:transparent;border:1px solid var(--habbo-danger);color:var(--habbo-danger);padding:4px 10px;border-radius:4px;font-size:11px;cursor:pointer;">Release Pet</button>
      </div>`;
    document.getElementById('petFeed')?.addEventListener('click', onFeed);
    document.getElementById('petPlay')?.addEventListener('click', onPlay);
    document.getElementById('petRest')?.addEventListener('click', onRest);
    document.getElementById('petRename')?.addEventListener('click', () => {
      const input = document.getElementById('petRenameInput');
      if (input && input.value.trim() && onRename) { onRename(input.value.trim()); input.value = ''; }
    });
    document.getElementById('petRelease')?.addEventListener('click', () => onAdopt && onAdopt(null));
  }

  showNPCProfile(npc, tier, onWalk, onTrade) {
    const existing = document.getElementById('npcProfile');
    if (existing) existing.remove();
    const div = document.createElement('div');
    div.id = 'npcProfile';
    div.className = 'npc-profile';
    const tierColor = tier === 'Best Friend' ? '#e74c3c' : (tier === 'Close Friend' ? '#9b59b6' : (tier === 'Friend' ? '#2ecc71' : '#95a5a6'));
    const hearts = npc.relationship >= 80 ? '❤️❤️❤️' : (npc.relationship >= 50 ? '❤️❤️' : (npc.relationship >= 20 ? '❤️' : ''));
    div.innerHTML = `
      <div class="npc-profile-header">
        <span style="font-size:28px;">${npc.hatType !== 'none' ? '🎩' : '👤'}</span>
        <div>
          <div style="font-weight:700;font-size:15px;">${npc.name}</div>
          <div style="font-size:11px;color:${tierColor};font-weight:700;">${tier} ${hearts}</div>
          <div style="font-size:10px;color:var(--habbo-text-dim);">${npc.isFollower ? '👥 Following you' : (npc.isSitting ? 'Sitting' : (npc.isDancing ? 'Dancing' : 'Walking around'))}</div>
        </div>
        <button class="npc-profile-close">&times;</button>
      </div>
      <div style="display:flex;gap:8px;margin-top:10px;">
        <button class="npc-action" id="npcWalk">Walk Here</button>
        <button class="npc-action" id="npcWave">Wave</button>
        <button class="npc-action" id="npcTrade">Trade</button>
      </div>
    `;
    document.body.appendChild(div);
    div.querySelector('.npc-profile-close').addEventListener('click', () => div.remove());
    div.querySelector('#npcWalk').addEventListener('click', () => { div.remove(); onWalk && onWalk(); });
    div.querySelector('#npcWave').addEventListener('click', () => {
      npc.say('Hey there! 👋', '#fffde7', 'normal');
      div.remove();
    });
    div.querySelector('#npcTrade').addEventListener('click', () => { div.remove(); onTrade && onTrade(npc); });
    setTimeout(() => { if (div.parentNode) div.remove(); }, 8000);
  }

  showPlayerProfile(avatar, actions, isRemote = false, remoteId = null, isIgnored = false, achievements = [], isBanned = false) {
    const existing = document.getElementById('playerProfile');
    if (existing) existing.remove();
    const div = document.createElement('div');
    div.id = 'playerProfile';
    div.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:280px;background:var(--habbo-panel);border:1px solid var(--habbo-panel-border);border-radius:12px;padding:16px;z-index:400;box-shadow:0 8px 32px rgba(0,0,0,0.4);font-family:Nunito,sans-serif;';

    const hatEmoji = { none: '', cap: '🧢', beanie: '🎩', crown: '👑', wizard: '🧙', bowler: '🎩' };
    const glassesEmoji = { none: '', shades: '🕶️', round: '👓', heart: '💖' };
    const hairEmoji = { short: '💇', spiky: '⚡', long: '💁', mohawk: '🎸', bald: '✨', curly: '🌀', bob: '💇‍♀️', ponytail: '🎀', buzz: '✂️' };

    div.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
        <div style="display:flex;gap:10px;align-items:center;">
          <div style="width:48px;height:48px;background:var(--habbo-dark);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:24px;border:2px solid var(--habbo-light);">
            ${avatar.hatType !== 'none' ? hatEmoji[avatar.hatType] : (avatar.hairStyle ? hairEmoji[avatar.hairStyle] || '👤' : '👤')}
          </div>
          <div>
            <div style="font-weight:700;font-size:15px;color:white;">${avatar.name}</div>
            <div style="font-size:11px;color:var(--habbo-text-dim);">${isRemote ? '🌐 Online Player' : (avatar.isNPC ? '🤖 NPC' : 'You')}</div>
          </div>
        </div>
        <button id="ppClose" style="background:transparent;border:none;color:var(--habbo-text-dim);font-size:18px;cursor:pointer;padding:0;width:24px;height:24px;">&times;</button>
      </div>
      <div style="background:var(--habbo-dark);border-radius:8px;padding:10px;margin-bottom:12px;">
        <div style="font-size:11px;color:var(--habbo-text-dim);margin-bottom:6px;">Outfit</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;font-size:11px;align-items:center;">
          <span style="display:flex;align-items:center;gap:4px;background:rgba(255,255,255,0.08);padding:3px 8px;border-radius:10px;color:white;">👕 <span style="width:12px;height:12px;border-radius:50%;background:${avatar.shirtColor || '#999'};border:1px solid rgba(255,255,255,0.3);"></span></span>
          <span style="display:flex;align-items:center;gap:4px;background:rgba(255,255,255,0.08);padding:3px 8px;border-radius:10px;color:white;">👖 <span style="width:12px;height:12px;border-radius:50%;background:${avatar.pantsColor || '#999'};border:1px solid rgba(255,255,255,0.3);"></span></span>
          <span style="display:flex;align-items:center;gap:4px;background:rgba(255,255,255,0.08);padding:3px 8px;border-radius:10px;color:white;">👟 <span style="width:12px;height:12px;border-radius:50%;background:${avatar.shoeColor || '#999'};border:1px solid rgba(255,255,255,0.3);"></span></span>
          ${avatar.hatType !== 'none' ? `<span style="background:rgba(255,255,255,0.08);padding:3px 8px;border-radius:10px;color:white;">${hatEmoji[avatar.hatType]} ${avatar.hatType}</span>` : ''}
          ${avatar.glassesType !== 'none' ? `<span style="background:rgba(255,255,255,0.08);padding:3px 8px;border-radius:10px;color:white;">${glassesEmoji[avatar.glassesType]} ${avatar.glassesType}</span>` : ''}
        </div>
      </div>
      ${achievements.length > 0 ? `<div style="background:var(--habbo-dark);border-radius:8px;padding:10px;margin-bottom:12px;"><div style="font-size:11px;color:var(--habbo-text-dim);margin-bottom:6px;">Achievements</div><div style="display:flex;gap:6px;flex-wrap:wrap;font-size:16px;">${achievements.map(a => `<span title="${a.name}">${a.icon}</span>`).join('')}</div></div>` : ''}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <button id="ppWalk" style="padding:8px;background:var(--habbo-light);color:white;border:none;border-radius:6px;font-weight:700;font-size:12px;cursor:pointer;font-family:inherit;">🚶 Walk To</button>
        ${isRemote ? `<button id="ppWhisper" style="padding:8px;background:var(--habbo-dark);color:var(--habbo-text);border:1px solid var(--habbo-panel-border);border-radius:6px;font-weight:700;font-size:12px;cursor:pointer;font-family:inherit;">💬 Whisper</button>` : ''}
        ${isRemote ? `<button id="ppFriend" style="padding:8px;background:var(--habbo-dark);color:var(--habbo-text);border:1px solid var(--habbo-panel-border);border-radius:6px;font-weight:700;font-size:12px;cursor:pointer;font-family:inherit;">⭐ Add Friend</button>` : ''}
        ${isRemote ? `<button id="ppTrade" style="padding:8px;background:var(--habbo-dark);color:var(--habbo-text);border:1px solid var(--habbo-panel-border);border-radius:6px;font-weight:700;font-size:12px;cursor:pointer;font-family:inherit;">🤝 Trade</button>` : ''}
        ${isRemote ? `<button id="ppIgnore" style="padding:8px;background:${isIgnored ? '#e74c3c' : 'var(--habbo-dark)'};color:#fff;border:1px solid var(--habbo-panel-border);border-radius:6px;font-weight:700;font-size:12px;cursor:pointer;font-family:inherit;">${isIgnored ? 'Unignore' : '🚫 Ignore'}</button>` : ''}
        ${isRemote ? `<button id="ppBan" style="padding:8px;background:${isBanned ? '#e74c3c' : 'var(--habbo-dark)'};color:#fff;border:1px solid var(--habbo-panel-border);border-radius:6px;font-weight:700;font-size:12px;cursor:pointer;font-family:inherit;">${isBanned ? 'Unban' : '🔨 Ban'}</button>` : ''}
      </div>
    `;
    document.body.appendChild(div);
    document.getElementById('ppClose')?.addEventListener('click', () => div.remove());
    document.getElementById('ppWalk')?.addEventListener('click', () => { div.remove(); actions.onWalk && actions.onWalk(); });
    if (isRemote) {
      document.getElementById('ppWhisper')?.addEventListener('click', () => { div.remove(); actions.onWhisper && actions.onWhisper(); });
      document.getElementById('ppFriend')?.addEventListener('click', () => { div.remove(); actions.onFriend && actions.onFriend(); });
      document.getElementById('ppTrade')?.addEventListener('click', () => { div.remove(); actions.onTrade && actions.onTrade(); });
      document.getElementById('ppIgnore')?.addEventListener('click', () => { div.remove(); actions.onIgnore && actions.onIgnore(); });
      document.getElementById('ppBan')?.addEventListener('click', () => { div.remove(); actions.onBan && actions.onBan(); });
    }
    setTimeout(() => { if (div.parentNode) div.remove(); }, 12000);
  }

  renderChallenges(challenges) {
    const list = document.getElementById('challengeList');
    if (!list) return;
    list.innerHTML = '';
    if (challenges.length === 0) {
      list.innerHTML = '<div style="text-align:center;color:var(--habbo-text-dim);padding:20px;">No active challenges.</div>';
      return;
    }
    challenges.forEach(c => {
      const div = document.createElement('div');
      div.className = 'challenge-item' + (c.done ? ' done' : '');
      div.innerHTML = `
        <div class="challenge-row">
          <span class="challenge-name">${c.name}</span>
          <span class="challenge-reward">★${c.reward}</span>
        </div>
        <div class="challenge-desc">${c.desc}</div>
        <div class="challenge-bar"><div style="width:${c.percent}%"></div></div>
        <div style="font-size:10px;color:var(--habbo-text-dim);text-align:right;">${c.current}/${c.target}</div>
      `;
      list.appendChild(div);
    });
  }

  renderShortcuts(shortcuts) {
    const list = document.getElementById('shortcutsList');
    if (!list) return;
    list.innerHTML = '';
    shortcuts.forEach(s => {
      const div = document.createElement('div');
      div.className = 'shortcut-row';
      div.innerHTML = `<span class="shortcut-key">${s.key}</span><span class="shortcut-action">${s.action}</span>`;
      list.appendChild(div);
    });
  }

  renderClubsPanel(clubSystem, onCreate, onJoin, onLeave, onDelete) {
    const content = document.getElementById('clubsContent');
    if (!content) return;
    const myClubs = clubSystem.getMyClubs();
    const allClubs = clubSystem.getAll();
    let html = `<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;">`;
    html += `<input type="text" id="clubNameInput" placeholder="Club name..." maxlength="20" style="flex:1;min-width:120px;padding:6px 10px;border-radius:8px;border:1px solid var(--habbo-panel-border);background:var(--habbo-dark);color:#fff;font-family:inherit;font-size:12px;">`;
    html += `<select id="clubColorSelect" style="padding:6px;border-radius:8px;border:1px solid var(--habbo-panel-border);background:var(--habbo-dark);color:#fff;font-family:inherit;font-size:12px;">`;
    clubSystem.getBadgeColors().forEach(c => html += `<option value="${c}" style="background:${c}">${c}</option>`);
    html += `</select>`;
    html += `<select id="clubIconSelect" style="padding:6px;border-radius:8px;border:1px solid var(--habbo-panel-border);background:var(--habbo-dark);color:#fff;font-family:inherit;font-size:12px;">`;
    clubSystem.getBadgeIcons().forEach(i => html += `<option value="${i}">${i}</option>`);
    html += `</select>`;
    html += `<button id="btnCreateClub" style="padding:6px 14px;background:var(--habbo-accent);color:var(--habbo-dark);border:none;border-radius:8px;font-weight:700;cursor:pointer;font-family:inherit;font-size:12px;">Create</button>`;
    html += `</div>`;

    if (myClubs.length > 0) {
      html += `<div style="font-size:12px;font-weight:700;color:var(--habbo-accent);margin-bottom:8px;">My Clubs</div>`;
      html += `<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:14px;">`;
      myClubs.forEach(c => {
        html += `<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:rgba(0,0,0,0.2);border-radius:8px;border-left:4px solid ${c.badgeColor};">`;
        html += `<div style="display:flex;align-items:center;gap:8px;"><span style="font-size:20px;">${c.badgeIcon}</span><div><div style="font-weight:700;font-size:13px;">${c.name}</div><div style="font-size:10px;color:var(--habbo-text-dim);">${c.members.length} members</div></div></div>`;
        html += `<button class="btn-leave-club" data-id="${c.id}" style="padding:4px 10px;background:#e74c3c;color:#fff;border:none;border-radius:6px;font-size:11px;cursor:pointer;font-family:inherit;">Leave</button>`;
        html += `</div>`;
      });
      html += `</div>`;
    }

    if (allClubs.length > 0) {
      html += `<div style="font-size:12px;font-weight:700;color:var(--habbo-accent);margin-bottom:8px;">All Clubs</div>`;
      html += `<div style="display:flex;flex-direction:column;gap:6px;">`;
      allClubs.forEach(c => {
        const isMember = clubSystem.myClubs.has(c.id);
        html += `<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:rgba(0,0,0,0.2);border-radius:8px;border-left:4px solid ${c.badgeColor};">`;
        html += `<div style="display:flex;align-items:center;gap:8px;"><span style="font-size:20px;">${c.badgeIcon}</span><div><div style="font-weight:700;font-size:13px;">${c.name}</div><div style="font-size:10px;color:var(--habbo-text-dim);">${c.members.length} members</div></div></div>`;
        if (isMember) {
          html += `<button class="btn-leave-club" data-id="${c.id}" style="padding:4px 10px;background:#e74c3c;color:#fff;border:none;border-radius:6px;font-size:11px;cursor:pointer;font-family:inherit;">Leave</button>`;
        } else {
          html += `<button class="btn-join-club" data-id="${c.id}" style="padding:4px 10px;background:var(--habbo-accent);color:var(--habbo-dark);border:none;border-radius:6px;font-size:11px;cursor:pointer;font-family:inherit;font-weight:700;">Join</button>`;
        }
        html += `</div>`;
      });
      html += `</div>`;
    } else {
      html += `<div style="text-align:center;color:var(--habbo-text-dim);font-size:12px;padding:20px;">No clubs yet. Create the first one!</div>`;
    }
    content.innerHTML = html;

    document.getElementById('btnCreateClub')?.addEventListener('click', () => {
      const name = document.getElementById('clubNameInput')?.value;
      const color = document.getElementById('clubColorSelect')?.value;
      const icon = document.getElementById('clubIconSelect')?.value;
      onCreate && onCreate(name, color, icon);
    });
    content.querySelectorAll('.btn-join-club').forEach(btn => {
      btn.addEventListener('click', () => onJoin && onJoin(btn.dataset.id));
    });
    content.querySelectorAll('.btn-leave-club').forEach(btn => {
      btn.addEventListener('click', () => onLeave && onLeave(btn.dataset.id));
    });
  }

  renderMarketplace(marketplace, inventoryItems, onBuy, onList, onCancel) {
    const content = document.getElementById('marketplaceContent');
    if (!content) return;
    const listings = marketplace.getListings();
    let html = `<div style="display:flex;gap:8px;margin-bottom:12px;align-items:center;">`;
    html += `<input type="text" id="mpSearch" placeholder="Search items..." style="flex:1;padding:6px 10px;border-radius:8px;border:1px solid var(--habbo-panel-border);background:var(--habbo-dark);color:#fff;font-family:inherit;font-size:12px;">`;
    html += `<button id="mpSearchBtn" style="padding:6px 12px;background:var(--habbo-light);color:#fff;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-family:inherit;font-size:12px;">🔍</button>`;
    html += `</div>`;

    if (listings.length > 0) {
      html += `<div style="font-size:12px;font-weight:700;color:var(--habbo-accent);margin-bottom:8px;">Available Listings</div>`;
      html += `<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:14px;">`;
      listings.forEach(l => {
        const isMine = !l.npc;
        html += `<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:rgba(0,0,0,0.2);border-radius:8px;">`;
        html += `<div style="display:flex;align-items:center;gap:8px;"><span style="font-size:20px;">${l.icon}</span><div><div style="font-weight:700;font-size:13px;">${l.itemName}</div><div style="font-size:10px;color:var(--habbo-text-dim);">Seller: ${l.seller}</div></div></div>`;
        html += `<div style="display:flex;align-items:center;gap:8px;"><span style="font-weight:700;color:var(--habbo-accent);">★${l.price}</span>`;
        if (isMine) {
          html += `<button class="btn-cancel-listing" data-id="${l.id}" style="padding:4px 10px;background:#e74c3c;color:#fff;border:none;border-radius:6px;font-size:11px;cursor:pointer;font-family:inherit;">Cancel</button>`;
        } else {
          html += `<button class="btn-buy-listing" data-id="${l.id}" style="padding:4px 10px;background:var(--habbo-accent);color:var(--habbo-dark);border:none;border-radius:6px;font-size:11px;cursor:pointer;font-family:inherit;font-weight:700;">Buy</button>`;
        }
        html += `</div></div>`;
      });
      html += `</div>`;
    } else {
      html += `<div style="text-align:center;color:var(--habbo-text-dim);font-size:12px;padding:20px;">No listings available.</div>`;
    }

    if (inventoryItems.length > 0) {
      html += `<div style="font-size:12px;font-weight:700;color:var(--habbo-accent);margin-bottom:8px;">Sell Your Items</div>`;
      html += `<div style="display:flex;flex-direction:column;gap:6px;">`;
      inventoryItems.forEach(item => {
        html += `<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:rgba(0,0,0,0.2);border-radius:8px;">`;
        html += `<div style="display:flex;align-items:center;gap:8px;"><span style="font-size:20px;">${item.icon}</span><div><div style="font-weight:700;font-size:13px;">${item.name}</div><div style="font-size:10px;color:var(--habbo-text-dim);">You have ${item.count}</div></div></div>`;
        html += `<button class="btn-list-item" data-type="${item.type}" data-price="${Math.floor(item.price * 0.9)}" style="padding:4px 10px;background:var(--habbo-light);color:#fff;border:none;border-radius:6px;font-size:11px;cursor:pointer;font-family:inherit;">List ★${Math.floor(item.price * 0.9)}</button>`;
        html += `</div>`;
      });
      html += `</div>`;
    }
    content.innerHTML = html;

    document.getElementById('mpSearchBtn')?.addEventListener('click', () => {
      const q = document.getElementById('mpSearch')?.value || '';
      // Re-render with search results would need re-call to game method; for now just show notification
      if (q) this.showNotification('Search applied — refresh panel to see results', 'info');
    });
    content.querySelectorAll('.btn-buy-listing').forEach(btn => {
      btn.addEventListener('click', () => onBuy && onBuy(btn.dataset.id));
    });
    content.querySelectorAll('.btn-cancel-listing').forEach(btn => {
      btn.addEventListener('click', () => onCancel && onCancel(btn.dataset.id));
    });
    content.querySelectorAll('.btn-list-item').forEach(btn => {
      btn.addEventListener('click', () => onList && onList(btn.dataset.type, parseInt(btn.dataset.price)));
    });
  }

  renderStats(stats) {
    const list = document.getElementById('statsList');
    if (!list) return;
    list.innerHTML = '';
    stats.forEach(s => {
      const div = document.createElement('div');
      div.className = 'stat-row';
      div.innerHTML = `<span class="stat-label">${s.label}</span><span class="stat-value">${s.value}</span>`;
      list.appendChild(div);
    });
  }

  renderInbox(messages, onRead, onDelete) {
    const list = document.getElementById('inboxList');
    if (!list) return;
    list.innerHTML = '';
    if (messages.length === 0) {
      list.innerHTML = '<div style="text-align:center;color:var(--habbo-text-dim);padding:20px;font-size:13px;">Your mailbox is empty.</div>';
      return;
    }
    messages.forEach(m => {
      const div = document.createElement('div');
      div.className = 'room-item';
      div.style.cssText = `opacity:${m.read ? 0.7 : 1};border-left:3px solid ${m.read ? 'var(--habbo-panel-border)' : 'var(--habbo-accent)'};`;
      const dateStr = new Date(m.time).toLocaleDateString();
      div.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div class="room-name" style="font-size:13px;">${m.read ? '' : '<span style="color:var(--habbo-accent);">\u25CF </span>'}${m.subject}</div>
          <div style="font-size:10px;color:var(--habbo-text-dim);">${dateStr}</div>
        </div>
        <div class="room-desc" style="font-size:11px;">From: ${m.from}</div>
        <div style="font-size:12px;color:var(--habbo-text-dim);margin-top:4px;">${m.body}</div>
        ${m.reward && !m.rewardClaimed ? `<div style="margin-top:6px;color:var(--habbo-success);font-size:11px;font-weight:700;">Reward: \u2605${m.reward} — click to claim</div>` : ''}
        <div style="display:flex;gap:6px;margin-top:8px;">
          <button class="inbox-read-btn" data-id="${m.id}" style="padding:3px 10px;background:var(--habbo-light);color:white;border:none;border-radius:4px;font-size:11px;cursor:pointer;font-family:inherit;">${m.read ? 'Read' : 'Open'}</button>
          <button class="inbox-del-btn" data-id="${m.id}" style="padding:3px 10px;background:var(--habbo-danger);color:white;border:none;border-radius:4px;font-size:11px;cursor:pointer;font-family:inherit;">Delete</button>
        </div>
      `;
      list.appendChild(div);
    });
    list.querySelectorAll('.inbox-read-btn').forEach(btn => {
      btn.addEventListener('click', () => onRead && onRead(parseFloat(btn.dataset.id)));
    });
    list.querySelectorAll('.inbox-del-btn').forEach(btn => {
      btn.addEventListener('click', () => onDelete && onDelete(parseFloat(btn.dataset.id)));
    });
  }

  renderCollection(catalog, ownedTypes, totalCount) {
    const list = document.getElementById('collectionList');
    if (!list) return;
    const owned = new Set(ownedTypes);
    const percent = Math.round((owned.size / catalog.length) * 100);
    let html = `<div style="margin-bottom:12px;text-align:center;">
      <div style="font-size:22px;font-weight:800;color:var(--habbo-accent);">${owned.size} / ${catalog.length}</div>
      <div style="font-size:12px;color:var(--habbo-text-dim);">${percent}% complete · ${totalCount} total items</div>
      <div style="width:100%;height:8px;background:var(--habbo-dark);border-radius:4px;margin-top:8px;overflow:hidden;">
        <div style="width:${percent}%;height:100%;background:var(--habbo-accent);border-radius:4px;transition:width 0.5s;"></div>
      </div>
    </div>`;
    html += `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;">`;
    catalog.forEach(item => {
      const has = owned.has(item.id);
      html += `<div style="padding:6px;border-radius:6px;text-align:center;font-size:11px;border:1px solid ${has ? 'var(--habbo-accent)' : 'var(--habbo-panel-border)'};background:${has ? 'rgba(244,208,63,0.1)' : 'var(--habbo-dark)'};color:${has ? 'white' : 'var(--habbo-text-dim)'};">
        <div style="font-size:18px;">${has ? item.icon : '?'}</div>
        <div style="margin-top:2px;">${has ? item.name : '???'}</div>
      </div>`;
    });
    html += `</div>`;
    list.innerHTML = html;
  }

  renderCrafting(recipes, onCraft) {
    const list = document.getElementById('craftList');
    if (!list) return;
    list.innerHTML = '';
    recipes.forEach(r => {
      const div = document.createElement('div');
      div.className = 'craft-item';
      const ingText = Object.entries(r.ingredients).map(([k, v]) => `${v}x ${k}`).join(' + ');
      div.innerHTML = `
        <div class="craft-row">
          <span class="craft-name">${r.name}</span>
          <button class="craft-btn" data-id="${r.id}" ${r.canCraft ? '' : 'disabled'}>Craft</button>
        </div>
        <div class="craft-ing">${ingText} → ${r.outputCount}x ${r.output}</div>
      `;
      list.appendChild(div);
    });
    list.querySelectorAll('.craft-btn').forEach(btn => {
      btn.addEventListener('click', () => onCraft && onCraft(btn.dataset.id));
    });
  }

  renderQuest(quest, onClaim) {
    const content = document.getElementById('questContent');
    if (!content) return;
    if (!quest) {
      content.innerHTML = '<div style="text-align:center;color:var(--habbo-text-dim);padding:20px;font-size:13px;">No active quest. Check back soon!</div>';
      return;
    }
    const isComplete = quest.progress >= quest.amount;
    const pct = Math.min(100, Math.floor((quest.progress / quest.amount) * 100));
    content.innerHTML = `
      <div style="text-align:center;margin-bottom:12px;">
        <div style="font-size:16px;font-weight:700;color:var(--habbo-accent);">${quest.name}</div>
        <div style="font-size:12px;color:var(--habbo-text-dim);margin-top:4px;">${quest.desc}</div>
      </div>
      <div style="width:100%;height:10px;background:var(--habbo-dark);border-radius:5px;overflow:hidden;margin-bottom:8px;">
        <div style="width:${pct}%;height:100%;background:${isComplete ? 'var(--habbo-success)' : 'var(--habbo-accent)'};border-radius:5px;transition:width 0.3s;"></div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:12px;">
        <span>${quest.progress} / ${quest.amount}</span>
        <span style="color:var(--habbo-success);font-weight:700;">Reward: \u2605${quest.reward}</span>
      </div>
      <button id="btnClaimQuest" style="width:100%;padding:8px;background:${isComplete ? 'var(--habbo-success)' : 'var(--habbo-dark)'};color:${isComplete ? 'white' : 'var(--habbo-text-dim)'};border:none;border-radius:6px;font-family:inherit;font-weight:700;cursor:${isComplete ? 'pointer' : 'not-allowed'};" ${isComplete ? '' : 'disabled'}>Claim Reward</button>
    `;
    document.getElementById('btnClaimQuest')?.addEventListener('click', () => onClaim && onClaim());
  }

  renderLeaderboard(games, getScores, filter, onFilter) {
    const content = document.getElementById('leaderboardContent');
    if (!content) return;
    let html = `<div style="display:flex;gap:6px;margin-bottom:12px;">
      <button class="lb-tab${filter === 'all' ? ' active' : ''}" data-filter="all">All Time</button>
      <button class="lb-tab${filter === 'today' ? ' active' : ''}" data-filter="today">Today</button>
    </div>`;
    games.forEach(g => {
      const scores = getScores(g.id, filter);
      html += `<div style="margin-bottom:16px;"><div style="font-weight:700;font-size:14px;color:var(--habbo-accent);margin-bottom:6px;">${g.name}</div>`;
      if (scores.length === 0) {
        html += `<div style="font-size:12px;color:var(--habbo-text-dim);">No scores yet. Play to set a record!</div>`;
      } else {
        html += `<div style="display:flex;flex-direction:column;gap:4px;">`;
        scores.forEach((s, i) => {
          const medal = i === 0 ? '🥇' : (i === 1 ? '🥈' : (i === 2 ? '🥉' : `${i + 1}.`));
          html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;background:rgba(0,0,0,0.15);border-radius:6px;font-size:12px;">
            <span>${medal} Score: <b>${s.score}</b></span>
            <span style="color:var(--habbo-text-dim);">${new Date(s.date).toLocaleDateString()}</span>
          </div>`;
        });
        html += `</div>`;
      }
      html += `</div>`;
    });
    content.innerHTML = html;
    content.querySelectorAll('.lb-tab').forEach(btn => {
      btn.addEventListener('click', () => onFilter && onFilter(btn.dataset.filter));
    });
  }

  renderAchievements(list) {
    const container = document.getElementById('achieveList');
    if (!container) return;
    container.innerHTML = '';
    let completed = 0;
    let visible = 0;
    list.forEach(a => {
      if (a.unlocked) completed++;
      const div = document.createElement('div');
      if (a.hidden) {
        // Locked secret achievement — mystery card
        div.className = 'achieve-item secret';
        div.innerHTML = `
          <div class="achieve-icon">❓</div>
          <div class="achieve-info">
            <div class="achieve-name">???</div>
            <div class="achieve-desc">Secret achievement — unlock to reveal!</div>
            <div class="achieve-bar"><div style="width:0%"></div></div>
          </div>
          <div class="achieve-reward">🔒</div>
        `;
        container.appendChild(div);
        return;
      }
      visible++;
      div.className = 'achieve-item' + (a.unlocked ? ' unlocked' : '') + (a.secret ? ' secret unlocked' : '');
      div.innerHTML = `
        <div class="achieve-icon">${a.icon}</div>
        <div class="achieve-info">
          <div class="achieve-name">${a.name}${a.secret ? ' ✨' : ''}</div>
          <div class="achieve-desc">${a.desc}</div>
          <div class="achieve-bar"><div style="width:${a.percent}%"></div></div>
        </div>
        <div class="achieve-reward">${a.unlocked ? '✓' : '★' + a.reward}</div>
      `;
      container.appendChild(div);
    });
    const hiddenCount = list.filter(a => a.hidden).length;
    const secretUnlocked = list.filter(a => a.secret && a.unlocked).length;
    const header = document.createElement('div');
    header.style.cssText = 'text-align:center;margin-bottom:12px;font-size:13px;color:var(--habbo-accent);font-weight:700;';
    header.textContent = `${completed}/${visible} Completed${hiddenCount > 0 ? ` (+${hiddenCount} secret hidden)` : ''}${secretUnlocked > 0 ? ` — ${secretUnlocked} secret found!` : ''}`;
    container.insertBefore(header, container.firstChild);
  }

  showDailyRewardPanel(dailySystem, onClaim) {
    const content = document.getElementById('dailyRewardContent');
    if (!content) return;
    const canClaim = dailySystem.canClaim();
    const table = dailySystem.getRewardsTable();
    let html = `<div style="text-align:center;padding:8px 0;"><div style="font-size:14px;font-weight:700;">Streak: ${dailySystem.streak} days</div></div>`;
    html += `<div class="daily-grid" style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px;margin-bottom:14px;">`;
    table.forEach(r => {
      const cls = r.claimed ? 'daily-cell claimed' : (r.current ? 'daily-cell current' : 'daily-cell');
      html += `<div class="${cls}" style="text-align:center;padding:8px 4px;border-radius:8px;background:${r.claimed ? 'rgba(46,204,113,0.2)' : (r.current ? 'rgba(244,208,63,0.2)' : 'rgba(0,0,0,0.15)')};border:2px solid ${r.claimed ? '#2ecc71' : (r.current ? '#f4d03f' : 'transparent')};">
        <div style="font-size:10px;color:var(--habbo-text-dim);">Day ${r.index}</div>
        <div style="font-size:16px;margin:2px 0;">${r.item || '★'}</div>
        <div style="font-size:11px;font-weight:700;">${r.coins}</div>
      </div>`;
    });
    html += `</div>`;
    if (canClaim) {
      html += `<button id="dailyClaimBtn" style="width:100%;padding:10px;background:var(--habbo-accent);color:var(--habbo-dark);border:none;border-radius:8px;font-weight:800;font-size:14px;cursor:pointer;">Claim Reward!</button>`;
    } else {
      html += `<div style="text-align:center;color:var(--habbo-text-dim);font-size:12px;">Come back tomorrow for your next reward!</div>`;
    }
    content.innerHTML = html;
    document.getElementById('dailyClaimBtn')?.addEventListener('click', onClaim);
    this.closeAllPanels();
    document.getElementById('dailyRewardPanel')?.classList.add('open');
  }

  showJukeboxPanel(tracks, currentTrack, volume, onPlay, onStop, onVolumeChange, onShuffle, sequencer, onSequencerToggle, onSequencerPlay, onSequencerSave, onSequencerBpm) {
    const content = document.getElementById('jukeboxContent');
    if (!content) return;
    const tab = sequencer?.tab || 'tracks';
    let html = `<div style="display:flex;gap:4px;margin-bottom:10px;"><button id="jbTabTracks" style="flex:1;padding:8px;background:${tab === 'tracks' ? 'var(--habbo-accent)' : 'var(--habbo-light)'};color:${tab === 'tracks' ? 'var(--habbo-dark)' : '#fff'};border:none;border-radius:8px;font-weight:700;font-size:12px;cursor:pointer;font-family:inherit;">🎵 Tracks</button><button id="jbTabComposer" style="flex:1;padding:8px;background:${tab === 'composer' ? 'var(--habbo-accent)' : 'var(--habbo-light)'};color:${tab === 'composer' ? 'var(--habbo-dark)' : '#fff'};border:none;border-radius:8px;font-weight:700;font-size:12px;cursor:pointer;font-family:inherit;">🎹 Composer</button></div>`;
    if (tab === 'tracks') {
      html += `<div style="text-align:center;padding:4px 0;"><div style="font-size:12px;color:var(--habbo-text-dim);">Select a track</div></div>`;
      html += `<div style="display:flex;flex-direction:column;gap:8px;">`;
      tracks.forEach(t => {
        const isPlaying = currentTrack === t.id;
        html += `<button class="jukebox-track" data-id="${t.id}" style="padding:12px;background:${isPlaying ? 'rgba(244,208,63,0.15)' : 'var(--habbo-dark)'};border:1px solid ${isPlaying ? 'var(--habbo-accent)' : 'var(--habbo-panel-border)'};border-radius:8px;color:white;font-family:inherit;font-size:13px;cursor:pointer;display:flex;align-items:center;gap:10px;text-align:left;">
          <span style="font-size:20px;">${t.emoji}</span>
          <span style="flex:1;font-weight:700;">${t.name}</span>
          ${isPlaying ? '<span style="color:var(--habbo-accent);font-size:11px;">▶ Playing</span>' : ''}
        </button>`;
      });
      html += `</div>`;
      html += `<div style="margin-top:12px;display:flex;align-items:center;gap:8px;"><span style="font-size:12px;color:var(--habbo-text-dim);">Vol</span><input type="range" id="jukeboxVol" min="0" max="1" step="0.05" value="${volume}" style="flex:1;"></div>`;
      html += `<div style="margin-top:10px;display:flex;gap:8px;"><button id="jukeboxShuffle" style="flex:1;padding:10px;background:var(--habbo-light);color:white;border:none;border-radius:8px;font-weight:700;font-size:12px;cursor:pointer;font-family:inherit;">🔀 Shuffle</button><button id="jukeboxStop" style="flex:1;padding:10px;background:var(--habbo-danger);color:white;border:none;border-radius:8px;font-weight:700;font-size:12px;cursor:pointer;font-family:inherit;">⏹ Stop</button></div>`;
    } else {
      html += `<div style="text-align:center;padding:4px 0;"><div style="font-size:12px;color:var(--habbo-text-dim);">Click cells to toggle notes</div></div>`;
      html += `<div style="display:grid;grid-template-columns:repeat(8,1fr);gap:3px;margin-bottom:10px;">`;
      const noteEmojis = ['🎵','🎶','🎼','🎹','🎸'];
      for (let n = sequencer.notes.length - 1; n >= 0; n--) {
        for (let s = 0; s < sequencer.steps; s++) {
          const on = sequencer.grid[s][n];
          html += `<button class="seq-cell" data-step="${s}" data-note="${n}" style="padding:6px 0;background:${on ? 'var(--habbo-accent)' : 'rgba(0,0,0,0.2)'};color:${on ? 'var(--habbo-dark)' : '#fff'};border:1px solid var(--habbo-panel-border);border-radius:4px;font-size:14px;cursor:pointer;font-family:inherit;">${on ? noteEmojis[n] : ''}</button>`;
        }
      }
      html += `</div>`;
      html += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;"><span style="font-size:12px;color:var(--habbo-text-dim);">BPM</span><input type="range" id="seqBpm" min="60" max="200" step="5" value="${sequencer.bpm}" style="flex:1;"><span id="seqBpmVal" style="font-size:12px;color:var(--habbo-text-dim);min-width:36px;text-align:right;">${sequencer.bpm}</span></div>`;
      html += `<div style="display:flex;gap:8px;"><button id="seqPlay" style="flex:1;padding:10px;background:var(--habbo-accent);color:var(--habbo-dark);border:none;border-radius:8px;font-weight:700;font-size:12px;cursor:pointer;font-family:inherit;">▶ Play</button><button id="seqSave" style="flex:1;padding:10px;background:var(--habbo-light);color:white;border:none;border-radius:8px;font-weight:700;font-size:12px;cursor:pointer;font-family:inherit;">💾 Save</button><button id="seqClear" style="flex:1;padding:10px;background:var(--habbo-danger);color:white;border:none;border-radius:8px;font-weight:700;font-size:12px;cursor:pointer;font-family:inherit;">🗑 Clear</button></div>`;
    }
    content.innerHTML = html;
    content.querySelectorAll('.jukebox-track').forEach(btn => {
      btn.addEventListener('click', () => onPlay && onPlay(btn.dataset.id));
    });
    document.getElementById('jukeboxStop')?.addEventListener('click', onStop);
    document.getElementById('jukeboxShuffle')?.addEventListener('click', onShuffle);
    document.getElementById('jukeboxVol')?.addEventListener('input', e => onVolumeChange && onVolumeChange(parseFloat(e.target.value)));
    document.getElementById('jbTabTracks')?.addEventListener('click', () => onSequencerToggle && onSequencerToggle('tracks'));
    document.getElementById('jbTabComposer')?.addEventListener('click', () => onSequencerToggle && onSequencerToggle('composer'));
    document.getElementById('seqBpm')?.addEventListener('input', e => {
      const val = parseInt(e.target.value);
      document.getElementById('seqBpmVal').textContent = val;
      onSequencerBpm && onSequencerBpm(val);
    });
    content.querySelectorAll('.seq-cell').forEach(cell => {
      cell.addEventListener('click', () => {
        const s = parseInt(cell.dataset.step);
        const n = parseInt(cell.dataset.note);
        onSequencerToggle && onSequencerToggle('toggle', s, n);
      });
    });
    document.getElementById('seqPlay')?.addEventListener('click', onSequencerPlay);
    document.getElementById('seqSave')?.addEventListener('click', onSequencerSave);
    document.getElementById('seqClear')?.addEventListener('click', () => onSequencerToggle && onSequencerToggle('clear'));
    this.closeAllPanels();
    document.getElementById('jukeboxPanel')?.classList.add('open');
  }

  setTypingIndicator(visible, text = '') {
    const bar = document.getElementById('typingIndicatorBar');
    if (!bar) return;
    bar.classList.toggle('visible', visible);
    bar.textContent = visible ? (text || 'You are typing...') : '';
  }
}
