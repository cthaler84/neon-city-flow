// Trackpad-First Camera, Drag Painting, Keyboard Shortcuts, and HUD Sync
(() => {
  const sim = window.CitySim;
  const ren = window.CityRender;
  const canvas = document.getElementById('city-canvas');
  const ctx = canvas.getContext('2d');

  let W = window.innerWidth;
  let H = window.innerHeight;
  let DPR = Math.min(window.devicePixelRatio || 1, 2);

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  window.addEventListener('resize', resize);

  const el = {
    pop: document.getElementById('m-pop'),
    credits: document.getElementById('m-credits'),
    income: document.getElementById('m-income'),
    power: document.getElementById('m-power'),
    flow: document.getElementById('m-flow'),
    dock: document.getElementById('tool-dock'),
    toast: document.getElementById('toast'),
    hoverCard: document.getElementById('hover-card'),
    hoverTitle: document.getElementById('hover-title'),
    hoverBadge: document.getElementById('hover-badge'),
    hoverDetail: document.getElementById('hover-detail'),
    msText: document.getElementById('ms-text'),
    msFill: document.getElementById('milestone-fill'),
    btnSandbox: document.getElementById('btn-sandbox'),
    btnHeat: document.getElementById('btn-heat'),
    btnTime: document.getElementById('btn-time'),
    btnCenter: document.getElementById('btn-center'),
    btnNew: document.getElementById('btn-new'),
    btnSfx: document.getElementById('btn-sfx'),
    btnMusic: document.getElementById('btn-music')
  };

  let toastTimer = 0;
  function showToast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.add('show');
    toastTimer = 2.8;
  }
  sim.state.onToast = showToast;

  // Build bottom tool dock
  function renderDock() {
    el.dock.innerHTML = '';
    for (const tool of sim.TOOLS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `tool-btn${sim.state.activeTool === tool.id ? ' selected' : ''}`;
      btn.title = tool.desc;
      const costText = sim.state.sandbox ? 'FREE' : (tool.cost > 0 ? `${tool.cost} cr` : '—');
      btn.innerHTML = `
        <span class="tool-key">${tool.key}</span>
        <span class="tool-icon">${tool.icon}</span>
        <span class="tool-name">${tool.name}</span>
        <span class="tool-cost">${costText}</span>
      `;
      btn.addEventListener('click', () => selectTool(tool.id));
      el.dock.appendChild(btn);
    }
    canvas.classList.toggle('pan-mode', sim.state.activeTool === 'pan' || spaceHeld);
  }

  function selectTool(id) {
    window.CityAudio.unlock();
    sim.state.activeTool = id;
    renderDock();
  }

  // Trackpad-First Pointer / Wheel / Keyboard State
  let isDown = false;
  let isPanning = false;
  let spaceHeld = false;
  let lastPx = 0, lastPy = 0;
  let lastPaintedKey = '';
  const keys = new Set();

  function updateHoverCard(gx, gy) {
    const t = sim.getTile(gx, gy);
    if (!t) {
      el.hoverCard.classList.remove('visible');
      return;
    }
    const labels = {
      empty: 'Open Land', water: 'Neon River', road: t.base === 'water' ? 'Neon Bridge' : 'Neon Road',
      avenue: t.base === 'water' ? 'Hyper-Bridge' : 'Hyper-Avenue',
      res: `Housing Tower`, com: `Commercial Plaza`, ind: `Tech Fab`,
      power: 'Fusion Core', park: 'Eco-Park', skyport: 'Drone Skyport'
    };
    const toolDef = sim.TOOLS.find(x => x.id === sim.state.activeTool);
    el.hoverTitle.textContent = labels[t.type] || t.type;
    el.hoverBadge.textContent = sim.isZone(t) ? `Lv ${t.level}` : (t.powered ? '⚡ Powered' : '');
    const lines = [];
    if (sim.isZone(t)) {
      lines.push(t.powered ? 'Status: Powered & Active' : 'Needs road connected to Fusion Core');
      if (t.parkBoost > 0.1) lines.push('Eco-Park Boost: Active (+Growth)');
    } else if (sim.isRoad(t)) {
      lines.push(`Traffic Load: ${Math.round(t.congestion * 100)}%`);
      if (t.type === 'road') lines.push('Tip: Paint Hyper-Ave over jammed streets');
    } else if (toolDef) {
      lines.push(`${toolDef.icon} ${toolDef.name}: ${toolDef.desc}`);
    }
    el.hoverDetail.textContent = lines.join(' · ');
    el.hoverCard.classList.add('visible');
  }

  function paintAtClient(cx, cy) {
    const g = ren.toGrid(cx, cy);
    const key = `${g.x},${g.y}`;
    if (key === lastPaintedKey) return;
    lastPaintedKey = key;
    sim.placeTile(g.x, g.y, sim.state.activeTool);
    updateHoverCard(g.x, g.y);
  }

  canvas.addEventListener('pointerdown', (e) => {
    window.CityAudio.unlock();
    isDown = true;
    lastPx = e.clientX;
    lastPy = e.clientY;
    lastPaintedKey = '';
    if (e.button === 2 || e.button === 1 || spaceHeld || sim.state.activeTool === 'pan') {
      isPanning = true;
      canvas.classList.add('pan-mode');
    } else {
      isPanning = false;
      paintAtClient(e.clientX, e.clientY);
    }
  });

  window.addEventListener('pointermove', (e) => {
    if (!isDown && e.target !== canvas) {
      ren.view.hoverX = -1;
      ren.view.hoverY = -1;
      el.hoverCard.classList.remove('visible');
      return;
    }
    const g = ren.toGrid(e.clientX, e.clientY);
    ren.view.hoverX = g.x;
    ren.view.hoverY = g.y;
    if (!isDown) {
      updateHoverCard(g.x, g.y);
      return;
    }
    if (isPanning) {
      ren.view.x += e.clientX - lastPx;
      ren.view.y += e.clientY - lastPy;
      lastPx = e.clientX;
      lastPy = e.clientY;
    } else {
      paintAtClient(e.clientX, e.clientY);
    }
  });

  window.addEventListener('pointerup', () => {
    isDown = false;
    isPanning = false;
    lastPaintedKey = '';
    canvas.classList.toggle('pan-mode', sim.state.activeTool === 'pan' || spaceHeld);
  });

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // Trackpad two-finger scroll/pinch: pinch zooms smoothly, 2-finger pan scrolls map OR zoom!
  // On Windows precision trackpads: pinch sends wheel with ctrlKey=true; two-finger swipe sends deltaX/deltaY!
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (e.ctrlKey || Math.abs(e.deltaX) < 1 && Math.abs(e.deltaY) >= 40) {
      // Smooth zoom anchored under cursor
      const factor = e.deltaY < 0 ? 1.1 : 0.91;
      const nextZoom = Math.max(ren.view.minZoom, Math.min(ren.view.maxZoom, ren.view.zoom * factor));
      const scale = nextZoom / ren.view.zoom;
      ren.view.x = e.clientX - (e.clientX - ren.view.x) * scale;
      ren.view.y = e.clientY - (e.clientY - ren.view.y) * scale;
      ren.view.zoom = nextZoom;
    } else {
      // Silky 2-finger trackpad pan!
      ren.view.x -= e.deltaX * 0.85;
      ren.view.y -= e.deltaY * 0.85;
    }
  }, { passive: false });

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      e.preventDefault();
      spaceHeld = true;
      canvas.classList.add('pan-mode');
    }
    keys.add(e.code);
    const keyTool = sim.TOOLS.find(t => t.key.toLowerCase() === e.key.toLowerCase());
    if (keyTool) selectTool(keyTool.id);
    if (e.key === 'c' || e.key === 'C') ren.centerOn(sim.GRID * 0.5, sim.GRID * 0.5, W, H);
    if (e.key === '+' || e.key === '=') ren.view.zoom = Math.min(ren.view.maxZoom, ren.view.zoom * 1.15);
    if (e.key === '-') ren.view.zoom = Math.max(ren.view.minZoom, ren.view.zoom * 0.87);
  });

  window.addEventListener('keyup', (e) => {
    keys.delete(e.code);
    if (e.code === 'Space') {
      spaceHeld = false;
      canvas.classList.toggle('pan-mode', sim.state.activeTool === 'pan');
    }
  });

  // Top Bar Controls
  document.querySelectorAll('.speed-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      window.CityAudio.unlock();
      sim.state.speed = Number(btn.dataset.speed);
      document.querySelectorAll('.speed-btn').forEach(b => b.classList.toggle('active', b === btn));
    });
  });

  el.btnSandbox.addEventListener('click', () => {
    window.CityAudio.unlock();
    sim.state.sandbox = !sim.state.sandbox;
    el.btnSandbox.classList.toggle('active', sim.state.sandbox);
    el.btnSandbox.textContent = sim.state.sandbox ? '∞ Sandbox ON' : '∞ Sandbox';
    renderDock();
    showToast(sim.state.sandbox ? 'Sandbox ON — Unlimited Credits!' : 'Budget Mode Active');
  });

  el.btnHeat.addEventListener('click', () => {
    sim.state.showHeat = !sim.state.showHeat;
    el.btnHeat.classList.toggle('active', sim.state.showHeat);
  });

  el.btnTime.addEventListener('click', () => {
    const order = ['midnight', 'dusk', 'auto'];
    const labels = { midnight: '🌙 Midnight', dusk: '🌆 Dusk', auto: '🌓 Cycle' };
    const next = order[(order.indexOf(sim.state.cycleMode) + 1) % order.length];
    sim.state.cycleMode = next;
    el.btnTime.textContent = labels[next];
  });

  el.btnCenter.addEventListener('click', () => {
    ren.view.zoom = 1.05;
    ren.centerOn(sim.GRID * 0.5, sim.GRID * 0.5, W, H);
  });

  el.btnNew.addEventListener('click', () => {
    window.CityAudio.unlock();
    sim.seedStarterCity();
    ren.centerOn(sim.GRID * 0.5, sim.GRID * 0.5, W, H);
    showToast('Fresh Riverfront City Seeded!');
  });

  el.btnSfx.addEventListener('click', () => {
    const on = window.CityAudio.toggleSfx();
    el.btnSfx.textContent = on ? '🔊' : '🔇';
    el.btnSfx.classList.toggle('off', !on);
  });

  el.btnMusic.addEventListener('click', () => {
    const on = window.CityAudio.toggleMusic();
    el.btnMusic.textContent = on ? '🎵 Lo-Fi' : '🎵 Off';
    el.btnMusic.classList.toggle('off', !on);
  });

  function updateHUD() {
    el.pop.textContent = sim.state.population;
    el.credits.textContent = sim.state.sandbox ? '∞' : `${sim.state.credits}`;
    el.income.textContent = sim.state.sandbox ? 'FREE' : `+${sim.state.incomePerMin}/m`;
    el.power.textContent = `${sim.state.powerUse}/${sim.state.powerGen} MW`;
    el.power.className = `metric-val ${sim.state.powerUse > sim.state.powerGen ? 'rose' : 'violet'}`;
    el.flow.textContent = `${sim.state.flowPct}%`;
    el.flow.className = `metric-val ${sim.state.flowPct >= 75 ? 'emerald' : (sim.state.flowPct >= 50 ? 'amber' : 'rose')}`;

    const ms = sim.MILESTONES[sim.state.milestoneIdx];
    if (ms) {
      const pct = Math.min(100, (sim.state.population / ms.pop) * 100);
      el.msText.textContent = `Next: ${ms.name} (${sim.state.population}/${ms.pop} pop)`;
      el.msFill.style.width = `${pct}%`;
    } else {
      el.msText.textContent = `★ Skylines Apex Achieved (${sim.cars.length} cars · ${sim.drones.length} drones)`;
      el.msFill.style.width = '100%';
    }
  }

  let lastTs = performance.now();
  function loop(ts) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, Math.max(0.001, (ts - lastTs) / 1000));
    lastTs = ts;

    // Optional WASD/Arrow gentle pan
    const panSpd = 420 * dt;
    if (keys.has('KeyW') || keys.has('ArrowUp')) ren.view.y += panSpd;
    if (keys.has('KeyS') || keys.has('ArrowDown')) ren.view.y -= panSpd;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) ren.view.x += panSpd;
    if (keys.has('KeyD') || keys.has('ArrowRight')) ren.view.x -= panSpd;

    if (toastTimer > 0) {
      toastTimer -= dt;
      if (toastTimer <= 0) el.toast.classList.remove('show');
    }

    sim.step(dt);
    ren.render(ctx, W, H, sim, ts * 0.001);
    updateHUD();
  }

  // Boot into a living, glowing starter riverfront city!
  resize();
  sim.seedStarterCity();
  ren.centerOn(sim.GRID * 0.5, sim.GRID * 0.5, W, H);
  renderDock();
  showToast('Welcome to Neon City Flow — Paint roads & zones, two-finger scroll to pan!');
  requestAnimationFrame(loop);
})();
