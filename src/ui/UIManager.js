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

  setTypingIndicator(visible, text = '') {
    const bar = document.getElementById('typingIndicatorBar');
    if (!bar) return;
    bar.classList.toggle('visible', visible);
    bar.textContent = visible ? (text || 'You are typing...') : '';
  }
}
