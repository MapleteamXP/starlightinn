// ============================================================
// Starlight Engine — UI Manager
// ============================================================

export class UIManager {
  constructor(game) {
    this.game = game;
    this.overlay = document.getElementById('uiOverlay');
  }

  createPanels() {
    if (!this.overlay) return;
    // Navigator
    this._ensurePanel('navigatorPanel', 'Room Navigator', `
      <div style="margin-bottom:8px;font-size:12px;color:var(--habbo-text-dim);">Public Rooms</div>
      <div class="room-list" id="publicRoomList"></div>
      <div style="margin:12px 0 8px;font-size:12px;color:var(--habbo-text-dim);">Your Rooms</div>
      <div class="room-list" id="userRoomList"></div>
      <div style="margin:12px 0 8px;font-size:12px;color:var(--habbo-text-dim);">Room Themes</div>
      <div class="theme-list" id="themeList"></div>
    `);
    // Catalog
    this._ensurePanel('catalogPanel', 'Furniture Catalog', `<div class="catalog-grid" id="catalogGrid"></div>`);
    // Inventory
    this._ensurePanel('inventoryPanel', 'My Inventory', `
      <div class="inv-grid" id="inventoryGrid"></div>
      <div style="margin-top:10px;font-size:11px;color:var(--habbo-text-dim);text-align:center;">Click an item to select it, then click a tile to place.</div>
    `);
    // Settings
    this._ensurePanel('settingsPanel', 'Settings', `
      <div class="setting-row"><label>Show Minimap</label><input type="checkbox" id="settingMinimap" checked></div>
      <div class="setting-row"><label>Show Names</label><input type="checkbox" id="settingNames" checked></div>
      <div class="setting-row"><label>Chat Bubbles</label><input type="checkbox" id="settingChat" checked></div>
      <div class="setting-row"><label>NPC Count</label><select id="settingNPCs"><option value="0">None</option><option value="3" selected>3</option><option value="5">5</option><option value="8">8</option></select></div>
      <div class="setting-row"><label>Camera Speed</label><input type="range" id="settingCamSpeed" min="1" max="10" value="5"></div>
      <div class="setting-row"><label>Sound Effects</label><input type="checkbox" id="settingSound"></div>
      <div class="setting-row"><label>Safe Mode</label><input type="checkbox" id="settingSafeMode"></div>
      <div style="margin-top:12px;font-size:11px;color:var(--habbo-text-dim);text-align:center;">Starlight Inn v2.0<br>Built with Starlight Engine</div>
    `);
    // Customize
    this._ensurePanel('customizePanel', 'Customize Avatar', `
      <div class="customize-preview"><canvas id="previewCanvas" width="88" height="128"></canvas></div>
      <div class="customize-row"><label>Skin</label><div class="color-presets" id="skinPresets"></div></div>
      <div class="customize-row"><label>Hair Color</label><div class="color-presets" id="hairPresets"></div></div>
      <div class="customize-row"><label>Hair Style</label><select id="hairStyleSelect"><option value="short">Short</option><option value="spiky">Spiky</option><option value="long">Long</option><option value="mohawk">Mohawk</option><option value="bald">Bald</option><option value="curly">Curly</option><option value="bob">Bob</option></select></div>
      <div class="customize-row"><label>Shirt</label><div class="color-presets" id="shirtPresets"></div></div>
      <div class="customize-row"><label>Pants</label><div class="color-presets" id="pantsPresets"></div></div>
      <div class="customize-row"><label>Shoes</label><div class="color-presets" id="shoePresets"></div></div>
      <div class="customize-row"><label>Hat</label><select id="hatSelect"><option value="none">None</option><option value="cap">Cap</option><option value="beanie">Beanie</option><option value="crown">Crown</option><option value="wizard">Wizard Hat</option></select></div>
      <div class="customize-row"><label>Glasses</label><select id="glassesSelect"><option value="none">None</option><option value="shades">Shades</option><option value="round">Round</option></select></div>
      <div class="customize-actions"><button class="btn-random" id="btnRandomLook">Random</button><button class="btn-save" id="btnSaveLook">Save Look</button></div>
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
    // Achievements
    this._ensurePanel('achievementsPanel', 'Achievements', `<div class="achieve-list" id="achieveList"></div>`);
    // Leaderboard
    this._ensurePanel('leaderboardPanel', 'High Scores', `<div id="leaderboardContent"></div>`);
    // Crafting
    this._ensurePanel('craftingPanel', 'Crafting Workshop', `<div class="craft-list" id="craftList"></div>`);
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

  showNotification(text, type = 'info') {
    const area = document.getElementById('notificationArea');
    if (!area) return;
    const notif = document.createElement('div');
    notif.className = 'notification';
    notif.style.borderLeftColor = type === 'error' ? 'var(--habbo-danger)' : (type === 'success' ? 'var(--habbo-success)' : 'var(--habbo-accent)');
    notif.textContent = text;
    area.appendChild(notif);
    setTimeout(() => {
      notif.style.opacity = '0';
      notif.style.transform = 'translateX(30px)';
      setTimeout(() => notif.remove(), 300);
    }, 3000);
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

  renderNavigator(rooms, onSelect) {
    const publicList = document.getElementById('publicRoomList');
    if (!publicList) return;
    publicList.innerHTML = '';
    rooms.forEach(room => {
      const div = document.createElement('div');
      div.className = 'room-item';
      div.innerHTML = `<div class="room-name">${room.name}</div><div class="room-desc">${room.description}</div><div class="room-meta">${Math.floor(Math.random() * 18 + 3)} users online</div>`;
      div.addEventListener('click', () => onSelect && onSelect(room));
      publicList.appendChild(div);
    });
    const userList = document.getElementById('userRoomList');
    if (!userList) return;
    userList.innerHTML = '';
    const myRoomDiv = document.createElement('div');
    myRoomDiv.className = 'room-item';
    myRoomDiv.innerHTML = `<div class="room-name">My Room</div><div class="room-desc">Your personal customizable space</div><div class="room-meta">Owner: You</div>`;
    myRoomDiv.addEventListener('click', () => {
      const userTemplate = { id: 'myroom', name: 'My Room', description: 'Your personal space at Starlight Inn', width: 10, height: 10, floor: 'wood', wall: '#8B4513', map: Array.from({length:10},()=>Array(10).fill(1)), furniture: [] };
      onSelect && onSelect(userTemplate);
    });
    userList.appendChild(myRoomDiv);
  }

  renderCatalog(items, currency, onBuy) {
    const grid = document.getElementById('catalogGrid');
    if (!grid) return;
    grid.innerHTML = '';
    items.forEach(item => {
      const div = document.createElement('div');
      div.className = 'catalog-item';
      div.title = item.desc;
      div.innerHTML = `<div class="cat-icon">${item.icon}</div><div class="cat-name">${item.name}</div><div class="cat-price">\u2605 ${item.price}</div>`;
      div.addEventListener('click', () => onBuy && onBuy(item));
      grid.appendChild(div);
    });
  }

  renderInventory(inventory, selected, onSelect) {
    const grid = document.getElementById('inventoryGrid');
    if (!grid) return;
    grid.innerHTML = '';
    const items = Object.entries(inventory);
    if (items.length === 0) {
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--habbo-text-dim);padding:20px;">Your inventory is empty. Visit the catalog to buy furniture!</div>';
      return;
    }
    items.forEach(([type, count]) => {
      const div = document.createElement('div');
      div.className = 'inv-item';
      div.innerHTML = `<div>${type}</div><div class="inv-count">x${count}</div>`;
      if (selected === type) {
        div.style.borderColor = 'var(--habbo-accent)';
        div.style.background = 'rgba(244,208,63,0.25)';
      }
      div.addEventListener('click', () => onSelect && onSelect(type));
      grid.appendChild(div);
    });
  }

  renderCustomizePanel(customize, onChange, onSave, onRandom) {
    // Update selects
    const hairStyleSelect = document.getElementById('hairStyleSelect');
    const hatSelect = document.getElementById('hatSelect');
    const glassesSelect = document.getElementById('glassesSelect');
    if (hairStyleSelect) hairStyleSelect.value = customize.hairStyle;
    if (hatSelect) hatSelect.value = customize.hatType;
    if (glassesSelect) glassesSelect.value = customize.glassesType;

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

  renderFriends(friends, onGift) {
    const list = document.getElementById('friendList');
    if (!list) return;
    list.innerHTML = '';
    if (friends.length === 0) {
      list.innerHTML = '<div style="text-align:center;color:var(--habbo-text-dim);padding:20px;">No friends yet. Visit rooms to meet people!</div>';
      return;
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

  renderPetPanel(petSystem, onAdopt, onFeed, onPlay, onRest) {
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
        <div style="font-size:11px;color:var(--habbo-text-dim);margin-bottom:12px;">${pet.type.toUpperCase()}</div>
        <div class="pet-stat"><label>Hunger</label><div class="pet-bar"><div style="width:${pet.hunger}%;background:#e74c3c;"></div></div></div>
        <div class="pet-stat"><label>Happiness</label><div class="pet-bar"><div style="width:${pet.happiness}%;background:#f4d03f;"></div></div></div>
        <div class="pet-stat"><label>Energy</label><div class="pet-bar"><div style="width:${pet.energy}%;background:#3498db;"></div></div></div>
        <div style="display:flex;gap:8px;margin-top:14px;">
          <button id="petFeed" class="pet-action">🍖 Feed</button>
          <button id="petPlay" class="pet-action">🎾 Play</button>
          <button id="petRest" class="pet-action">💤 Rest</button>
        </div>
        <button id="petRelease" style="margin-top:10px;background:transparent;border:1px solid var(--habbo-danger);color:var(--habbo-danger);padding:4px 10px;border-radius:4px;font-size:11px;cursor:pointer;">Release Pet</button>
      </div>`;
    document.getElementById('petFeed')?.addEventListener('click', onFeed);
    document.getElementById('petPlay')?.addEventListener('click', onPlay);
    document.getElementById('petRest')?.addEventListener('click', onRest);
    document.getElementById('petRelease')?.addEventListener('click', () => onAdopt && onAdopt(null));
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

  renderLeaderboard(games, getScores) {
    const content = document.getElementById('leaderboardContent');
    if (!content) return;
    let html = '';
    games.forEach(g => {
      const scores = getScores(g.id);
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
  }

  renderAchievements(list) {
    const container = document.getElementById('achieveList');
    if (!container) return;
    container.innerHTML = '';
    let completed = 0;
    list.forEach(a => {
      if (a.unlocked) completed++;
      const div = document.createElement('div');
      div.className = 'achieve-item' + (a.unlocked ? ' unlocked' : '');
      div.innerHTML = `
        <div class="achieve-icon">${a.icon}</div>
        <div class="achieve-info">
          <div class="achieve-name">${a.name}</div>
          <div class="achieve-desc">${a.desc}</div>
          <div class="achieve-bar"><div style="width:${a.percent}%"></div></div>
        </div>
        <div class="achieve-reward">${a.unlocked ? '✓' : '★' + a.reward}</div>
      `;
      container.appendChild(div);
    });
    const header = document.createElement('div');
    header.style.cssText = 'text-align:center;margin-bottom:12px;font-size:13px;color:var(--habbo-accent);font-weight:700;';
    header.textContent = `${completed}/${list.length} Completed`;
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

  setTypingIndicator(visible, text = '') {
    const bar = document.getElementById('typingIndicatorBar');
    if (!bar) return;
    bar.classList.toggle('visible', visible);
    bar.textContent = visible ? (text || 'You are typing...') : '';
  }
}
