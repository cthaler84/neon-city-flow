// Mini Neon City Flow — Core Simulation (Grid, Power BFS, Pathfinding, Traffic, Drones, Growth)
window.CitySim = (() => {
  const GRID = 28;

  const TOOLS = [
    { id: 'road',    name: 'Neon Road',   icon: '🛣️', cost: 10,  key: '1', color: '#38bdf8', desc: 'Connects zones & conducts power. Drag across river for auto-bridge.' },
    { id: 'avenue',  name: 'Hyper-Ave',   icon: '🚄', cost: 35,  key: '2', color: '#22d3ee', desc: '2x speed expressway! Paint over jammed roads to clear traffic.' },
    { id: 'res',     name: 'Housing',     icon: '🏠', cost: 45,  key: '3', color: '#22d3ee', desc: 'Neon residential pods. Spawns commuters & grows into tall towers.' },
    { id: 'com',     name: 'Commercial',  icon: '🏢', cost: 60,  key: '4', color: '#f472b6', desc: 'Holo-plazas & synth markets. Generates credits when commuters arrive.' },
    { id: 'ind',     name: 'Tech Fab',    icon: '🏭', cost: 70,  key: '5', color: '#fbbf24', desc: 'Clean neon fabrication hub. Dispatches delivery vans & cargo drones.' },
    { id: 'power',   name: 'Fusion Core', icon: '⚡', cost: 130, key: '6', color: '#a78bfa', desc: 'Generates 180 MW clean power. Flows automatically along roads.' },
    { id: 'park',    name: 'Eco-Park',    icon: '🌳', cost: 50,  key: '7', color: '#34d399', desc: 'Holo-trees & plaza. Boosts happiness & skyscraper upgrades nearby.' },
    { id: 'skyport', name: 'Skyport',     icon: '🛸', cost: 160, key: '8', color: '#38bdf8', desc: 'Launches 3 autonomous flying cargo drones that bypass road traffic.' },
    { id: 'bulldoze',name: 'Bulldoze',    icon: '💥', cost: 0,   key: 'X', color: '#fb7185', desc: 'Clear any tile cleanly with partial credit refund.' },
    { id: 'pan',     name: 'Pan View',    icon: '✋', cost: 0,   key: 'H', color: '#94a3b8', desc: 'Glide camera smoothly with trackpad (or hold Space anytime).' }
  ];

  const MILESTONES = [
    { name: 'Neon Outpost',     pop: 60,   reward: 220 },
    { name: 'Riverfront Grid',  pop: 180,  reward: 420 },
    { name: 'Synth District',   pop: 420,  reward: 700 },
    { name: 'Cyber Metropolis', pop: 850,  reward: 1200 },
    { name: 'Skylines Apex',    pop: 1500, reward: 2500 }
  ];

  const DIRS = [
    { dx: 0, dy: -1, bit: 1 }, // N
    { dx: 1, dy: 0,  bit: 2 }, // E
    { dx: 0, dy: 1,  bit: 4 }, // S
    { dx: -1, dy: 0, bit: 8 }  // W
  ];

  let tiles = [];
  let cars = [];
  let drones = [];
  let powerPulses = [];
  let fireworks = [];

  const state = {
    gridSize: GRID,
    credits: 950,
    sandbox: false,
    speed: 1,
    timeOfDay: 0.92, // starts in rich midnight neon!
    cycleMode: 'midnight', // midnight | auto | dusk
    simTime: 0,
    population: 0,
    incomePerMin: 0,
    powerGen: 0,
    powerUse: 0,
    flowPct: 100,
    milestoneIdx: 0,
    activeTool: 'road',
    showHeat: false,
    trafficPhase: 0,
    onToast: null
  };

  function idx(x, y) { return y * GRID + x; }
  function inBounds(x, y) { return x >= 0 && y >= 0 && x < GRID && y < GRID; }
  function getTile(x, y) { return inBounds(x, y) ? tiles[idx(x, y)] : null; }
  function isRoad(t) { return t && (t.type === 'road' || t.type === 'avenue'); }
  function isZone(t) { return t && (t.type === 'res' || t.type === 'com' || t.type === 'ind'); }

  function createEmptyMap(seedOffset = Math.random() * 100) {
    tiles = new Array(GRID * GRID);
    cars = [];
    drones = [];
    powerPulses = [];
    fireworks = [];

    const phaseA = seedOffset;
    const phaseB = seedOffset * 0.7 + 1.3;
    for (let y = 0; y < GRID; y++) {
      const riverCenter = GRID * 0.54 + Math.sin(y * 0.24 + phaseA) * 3.1 + Math.cos(y * 0.11 + phaseB) * 1.4;
      for (let x = 0; x < GRID; x++) {
        const distRiver = Math.abs(x - riverCenter);
        const water = distRiver < 1.35;
        tiles[idx(x, y)] = {
          x, y,
          base: water ? 'water' : 'land',
          type: water ? 'water' : 'empty',
          level: 1,
          powered: false,
          roadMask: 0,
          parkBoost: 0,
          growth: 0,
          popScale: 1, // bounce-in animation (0 -> 1)
          congestion: 0,
          variant: (x * 17 + y * 31) % 4,
          seed: Math.random()
        };
      }
    }
    state.credits = 950;
    state.simTime = 0;
    state.milestoneIdx = 0;
    recomputeNetwork();
  }

  function seedStarterCity() {
    createEmptyMap(1.1);
    const savedSandbox = state.sandbox;
    state.sandbox = true;

    // Locate river X near middle row so our starter bridge crosses cleanly!
    const midY = 13;
    let riverX = 14;
    for (let x = 6; x < 22; x++) {
      if (getTile(x, midY).base === 'water') { riverX = x; break; }
    }
    const leftX = Math.max(5, riverX - 5);
    const rightX = Math.min(GRID - 5, riverX + 4);

    // Main horizontal boulevard + bridge across the river
    for (let x = leftX; x <= rightX; x++) placeTile(x, midY, 'avenue', true);
    // West neighborhood loop
    for (let y = midY - 3; y <= midY + 3; y++) {
      placeTile(leftX, y, 'road', true);
      placeTile(leftX + 3, y, 'road', true);
    }
    for (let x = leftX; x <= leftX + 3; x++) {
      placeTile(x, midY - 3, 'road', true);
      placeTile(x, midY + 3, 'road', true);
    }
    // East commercial waterfront loop
    for (let y = midY - 2; y <= midY + 2; y++) {
      placeTile(rightX, y, 'road', true);
      placeTile(rightX - 2, y, 'road', true);
    }
    for (let x = rightX - 2; x <= rightX; x++) {
      placeTile(x, midY - 2, 'road', true);
      placeTile(x, midY + 2, 'road', true);
    }

    // Power Core + Park + Starter Homes on West Bank
    placeTile(leftX + 1, midY - 2, 'power', true);
    placeTile(leftX + 2, midY - 2, 'park', true);
    placeTile(leftX + 1, midY - 1, 'res', true);
    placeTile(leftX + 2, midY - 1, 'res', true);
    placeTile(leftX + 1, midY + 1, 'res', true);
    placeTile(leftX + 2, midY + 1, 'res', true);
    placeTile(leftX + 1, midY + 2, 'res', true);
    placeTile(leftX - 1, midY - 1, 'res', true);

    // Shops, Tech Fab & Drone Skyport on East Bank
    placeTile(rightX - 1, midY - 1, 'com', true);
    placeTile(rightX - 1, midY + 1, 'com', true);
    placeTile(rightX + 1, midY - 1, 'com', true);
    placeTile(rightX + 1, midY + 1, 'ind', true);
    placeTile(rightX - 1, midY - 3, 'skyport', true);
    placeTile(rightX, midY - 3, 'road', true);

    // Bump a couple starter towers to Lv 2 so the skyline immediately pops
    const tA = getTile(rightX - 1, midY - 1);
    if (tA && tA.type === 'com') tA.level = 2;
    const tB = getTile(leftX + 2, midY - 1);
    if (tB && tB.type === 'res') tB.level = 2;

    state.sandbox = savedSandbox;
    state.credits = 1200;
    recomputeNetwork();
    // Pre-spawn a lively initial batch of cars and drones
    for (let i = 0; i < 16; i++) spawnCar();
    syncDrones();
  }

  function getToolCost(toolId, tile) {
    if (state.sandbox) return 0;
    const def = TOOLS.find(t => t.id === toolId);
    if (!def) return 0;
    if ((toolId === 'road' || toolId === 'avenue') && tile && tile.base === 'water') {
      return def.cost * 2; // Bridge cost
    }
    return def.cost;
  }

  function placeTile(x, y, toolId, silent = false) {
    const t = getTile(x, y);
    if (!t) return false;
    if (toolId === 'pan') return false;

    if (toolId === 'bulldoze') {
      if (t.type === 'empty' || t.type === 'water') return false;
      const refund = t.type === 'road' ? 5 : 20;
      if (!state.sandbox) state.credits += refund;
      t.type = t.base === 'water' ? 'water' : 'empty';
      t.level = 1;
      t.growth = 0;
      t.congestion = 0;
      if (!silent) window.CityAudio.bulldoze();
      recomputeNetwork();
      return true;
    }

    // Cannot place non-road buildings on water
    if (t.base === 'water' && toolId !== 'road' && toolId !== 'avenue') {
      if (!silent) {
        window.CityAudio.error();
        if (state.onToast) state.onToast('Only Neon Roads & Hyper-Avenues can bridge water!');
      }
      return false;
    }

    // Ignore no-op repaint
    if (t.type === toolId) return false;
    // Allow upgrading road -> avenue smoothly; otherwise require empty (or water for bridges)
    const canOverwrite = (t.type === 'empty') ||
      (t.base === 'water' && t.type === 'water' && (toolId === 'road' || toolId === 'avenue')) ||
      (t.type === 'road' && toolId === 'avenue');
    if (!canOverwrite) return false;

    const cost = getToolCost(toolId, t);
    if (!state.sandbox && state.credits < cost) {
      if (!silent) {
        window.CityAudio.error();
        if (state.onToast) state.onToast(`Need ${cost} cr — or flip Sandbox ON for unlimited credits!`);
      }
      return false;
    }

    if (!state.sandbox) state.credits -= cost;
    t.type = toolId;
    t.level = 1;
    t.growth = 0;
    t.popScale = 0.05;
    t.congestion = 0;

    if (!silent) {
      if (toolId === 'road' || toolId === 'avenue') window.CityAudio.paintRoad();
      else window.CityAudio.placeBuilding(toolId);
    }
    recomputeNetwork();
    return true;
  }

  function recomputeNetwork() {
    let powerGen = 0;
    let powerUse = 0;
    let pop = 0;
    let income = 0;

    // 1. Road masks & clear flags
    for (const t of tiles) {
      t.powered = false;
      t.parkBoost = 0;
      if (isRoad(t)) {
        let mask = 0;
        for (const d of DIRS) {
          const n = getTile(t.x + d.dx, t.y + d.dy);
          if (isRoad(n)) mask |= d.bit;
        }
        t.roadMask = mask;
      } else {
        t.roadMask = 0;
      }
    }

    // 2. Park aura (radius 3) & Power BFS
    const queue = [];
    for (const t of tiles) {
      if (t.type === 'park') {
        for (let dy = -3; dy <= 3; dy++) {
          for (let dx = -3; dx <= 3; dx++) {
            const dist = Math.hypot(dx, dy);
            if (dist <= 3.2) {
              const nb = getTile(t.x + dx, t.y + dy);
              if (nb) nb.parkBoost = Math.min(2, nb.parkBoost + (1 - dist / 3.6));
            }
          }
        }
      }
      if (t.type === 'power') {
        powerGen += 180;
        t.powered = true;
        // Energize radius-2 local halo + any touching roads
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const nb = getTile(t.x + dx, t.y + dy);
            if (nb && !nb.powered && nb.type !== 'empty' && nb.type !== 'water') {
              nb.powered = true;
              queue.push(nb);
            }
          }
        }
      }
    }

    // Conduct power smoothly along roads and touching buildings
    let head = 0;
    while (head < queue.length) {
      const cur = queue[head++];
      if (!isRoad(cur) && cur.type !== 'power') continue;
      for (const d of DIRS) {
        const nb = getTile(cur.x + d.dx, cur.y + d.dy);
        if (!nb || nb.powered || nb.type === 'empty' || nb.type === 'water') continue;
        nb.powered = true;
        if (isRoad(nb)) queue.push(nb);
      }
    }

    // 3. Tally demand, population & base income
    for (const t of tiles) {
      if (t.type === 'res') {
        powerUse += 4 * t.level;
        if (t.powered) pop += t.level === 1 ? 14 : (t.level === 2 ? 36 : 75);
      } else if (t.type === 'com') {
        powerUse += 6 * t.level;
        if (t.powered) income += t.level === 1 ? 12 : (t.level === 2 ? 28 : 58);
      } else if (t.type === 'ind') {
        powerUse += 8 * t.level;
        if (t.powered) income += t.level === 1 ? 15 : (t.level === 2 ? 34 : 65);
      } else if (t.type === 'skyport') {
        powerUse += 14;
        if (t.powered) income += 24;
      }
    }

    // If grid is overloaded, keep things fun (scale income softly instead of blacking out everything)
    const powerRatio = powerUse > 0 ? Math.min(1, powerGen / powerUse) : 1;
    state.powerGen = powerGen;
    state.powerUse = powerUse;
    state.population = pop;
    state.incomePerMin = Math.round(income * (0.4 + 0.6 * powerRatio));
  }

  function adjacentRoad(t) {
    for (const d of DIRS) {
      const nb = getTile(t.x + d.dx, t.y + d.dy);
      if (isRoad(nb)) return nb;
    }
    return null;
  }

  // BFS Shortest Road Path
  function findRoadPath(startRoad, endRoad) {
    if (!startRoad || !endRoad || startRoad === endRoad) return null;
    const prev = new Int16Array(GRID * GRID).fill(-1);
    const startI = idx(startRoad.x, startRoad.y);
    const endI = idx(endRoad.x, endRoad.y);
    const q = [startI];
    prev[startI] = startI;
    let head = 0;
    let found = false;

    while (head < q.length) {
      const ci = q[head++];
      if (ci === endI) { found = true; break; }
      const cx = ci % GRID;
      const cy = (ci / GRID) | 0;
      for (const d of DIRS) {
        const nx = cx + d.dx, ny = cy + d.dy;
        if (!inBounds(nx, ny)) continue;
        const ni = idx(nx, ny);
        if (prev[ni] !== -1) continue;
        if (!isRoad(tiles[ni])) continue;
        prev[ni] = ci;
        q.push(ni);
      }
    }
    if (!found) return null;
    const path = [];
    let cur = endI;
    while (cur !== startI) {
      path.push({ x: cur % GRID, y: (cur / GRID) | 0 });
      cur = prev[cur];
    }
    path.push({ x: startRoad.x, y: startRoad.y });
    path.reverse();
    return path;
  }

  function spawnCar() {
    if (cars.length >= 160) return;
    const origins = [];
    const dests = [];
    for (const t of tiles) {
      if (!t.powered) continue;
      if (t.type === 'res' || t.type === 'ind') {
        const r = adjacentRoad(t);
        if (r) origins.push({ tile: t, road: r });
      }
      if (t.type === 'com' || t.type === 'ind' || t.type === 'skyport' || t.type === 'park') {
        const r = adjacentRoad(t);
        if (r) dests.push({ tile: t, road: r });
      }
    }
    if (origins.length === 0 || dests.length === 0) return;
    const o = origins[(Math.random() * origins.length) | 0];
    const d = dests[(Math.random() * dests.length) | 0];
    if (o.road === d.road) return;
    const path = findRoadPath(o.road, d.road);
    if (!path || path.length < 2) return;

    const palette = o.tile.type === 'ind'
      ? ['#fbbf24', '#fb923c']
      : ['#22d3ee', '#34d399', '#f472b6', '#a78bfa', '#38bdf8'];
    cars.push({
      path,
      seg: 0,
      t: Math.random() * 0.25,
      speed: 1.55 + Math.random() * 0.55,
      curSpeed: 1.5,
      color: palette[(Math.random() * palette.length) | 0],
      destType: d.tile.type,
      destTile: d.tile,
      braking: false,
      x: path[0].x,
      y: path[0].y,
      dx: path[1].x - path[0].x,
      dy: path[1].y - path[0].y
    });
  }

  function syncDrones() {
    const hubs = tiles.filter(t => t.powered && (t.type === 'skyport' || (t.type === 'ind' && t.level >= 2)));
    const targets = tiles.filter(t => t.powered && (t.type === 'com' || t.type === 'res' || t.type === 'skyport'));
    const desired = Math.min(36, hubs.reduce((s, h) => s + (h.type === 'skyport' ? 3 : 1), 0));
    while (drones.length < desired && hubs.length > 0 && targets.length > 1) {
      const h = hubs[(Math.random() * hubs.length) | 0];
      const dest = targets[(Math.random() * targets.length) | 0];
      if (dest === h) break;
      drones.push({
        sx: h.x, sy: h.y,
        ex: dest.x, ey: dest.y,
        t: Math.random(),
        speed: 0.24 + Math.random() * 0.14,
        alt: 28 + Math.random() * 24,
        color: h.type === 'skyport' ? '#22d3ee' : '#fbbf24'
      });
    }
    if (drones.length > desired) drones.length = desired;
  }

  function spawnPowerPulse() {
    if (powerPulses.length > 26) return;
    const cores = tiles.filter(t => t.type === 'power');
    if (cores.length === 0) return;
    const core = cores[(Math.random() * cores.length) | 0];
    let startRoad = null;
    for (let dy = -2; dy <= 2 && !startRoad; dy++) {
      for (let dx = -2; dx <= 2 && !startRoad; dx++) {
        const nb = getTile(core.x + dx, core.y + dy);
        if (isRoad(nb)) startRoad = nb;
      }
    }
    if (!startRoad) return;
    powerPulses.push({ x: startRoad.x, y: startRoad.y, nx: startRoad.x, ny: startRoad.y, t: 1, hops: 10, prevX: -1, prevY: -1 });
  }

  function triggerFireworks() {
    const powered = tiles.filter(t => t.powered && isZone(t));
    for (let i = 0; i < 6; i++) {
      const anchor = powered.length > 0 ? powered[(Math.random() * powered.length) | 0] : { x: 13, y: 13 };
      const colors = ['#22d3ee', '#34d399', '#f472b6', '#fbbf24', '#a78bfa'];
      const col = colors[i % colors.length];
      for (let p = 0; p < 14; p++) {
        const a = (p / 14) * Math.PI * 2;
        const spd = 25 + Math.random() * 55;
        fireworks.push({
          gx: anchor.x + (Math.random() - 0.5) * 3,
          gy: anchor.y + (Math.random() - 0.5) * 3,
          z: 55 + Math.random() * 45,
          vx: Math.cos(a) * spd,
          vy: Math.sin(a) * spd,
          vz: 15 + Math.random() * 35,
          life: 1.1 + Math.random() * 0.5,
          maxLife: 1.5,
          color: col
        });
      }
    }
  }

  let carSpawnAcc = 0;
  let incomeAcc = 0;
  let growthAcc = 0;
  let pulseAcc = 0;

  function step(rawDt) {
    const dt = rawDt * state.speed;
    if (dt <= 0) return;

    state.simTime += dt;
    state.trafficPhase += dt;

    if (state.cycleMode === 'auto') {
      state.timeOfDay = (state.timeOfDay + dt * 0.008) % 1;
    } else if (state.cycleMode === 'midnight') {
      state.timeOfDay = 0.92;
    } else {
      state.timeOfDay = 0.72; // Golden dusk
    }

    // Pop-in animation & congestion decay
    for (const t of tiles) {
      if (t.popScale < 1) t.popScale = Math.min(1, t.popScale + rawDt * 5.2);
      if (t.congestion > 0) t.congestion = Math.max(0, t.congestion - dt * 0.25);
    }

    // Spawn cars steadily proportional to city size
    carSpawnAcc += dt;
    const targetCars = Math.min(150, Math.max(12, Math.floor(state.population * 0.35)));
    if (carSpawnAcc >= 0.22) {
      carSpawnAcc = 0;
      if (cars.length < targetCars) spawnCar();
    }

    // Update cars with right-lane spacing & intersection traffic lights
    let totalBraking = 0;
    const cellBusy = new Map();
    for (let i = 0; i < cars.length; i++) {
      const c = cars[i];
      const curNode = c.path[c.seg];
      const key = `${curNode.x},${curNode.y},${c.dx},${c.dy}`;
      const list = cellBusy.get(key);
      if (list) list.push(c);
      else cellBusy.set(key, [c]);
    }

    const nsGreen = Math.floor(state.trafficPhase / 3.4) % 2 === 0;
    for (let i = cars.length - 1; i >= 0; i--) {
      const c = cars[i];
      const a = c.path[c.seg];
      const b = c.path[c.seg + 1];
      if (!a || !b) { cars.splice(i, 1); continue; }
      const tileA = getTile(a.x, a.y);
      const tileB = getTile(b.x, b.y);
      if (!isRoad(tileA) || !isRoad(tileB)) { cars.splice(i, 1); continue; }

      c.dx = b.x - a.x;
      c.dy = b.y - a.y;
      const roadBoost = tileA.type === 'avenue' ? 1.95 : 1.0;
      let targetSpd = c.speed * roadBoost;
      c.braking = false;

      // Traffic light pause when entering a 4-way intersection (mask === 15)
      if (tileB.roadMask === 15 && c.t > 0.62 && c.t < 0.92) {
        const movingNS = Math.abs(c.dy) > 0;
        if (movingNS !== nsGreen) {
          targetSpd = 0;
          c.braking = true;
        }
      }

      // Maintain clean gap behind car ahead in same lane
      const sameLane = cellBusy.get(`${a.x},${a.y},${c.dx},${c.dy}`);
      if (sameLane && sameLane.length > 1) {
        for (const other of sameLane) {
          if (other !== c && other.t > c.t && other.t - c.t < 0.34) {
            targetSpd = Math.min(targetSpd, other.curSpeed * 0.45);
            c.braking = true;
          }
        }
      }

      c.curSpeed += (targetSpd - c.curSpeed) * Math.min(1, dt * 9);
      c.t += c.curSpeed * dt;
      if (c.braking) {
        totalBraking++;
        tileA.congestion = Math.min(1, tileA.congestion + dt * 0.42);
      }

      if (c.t >= 1) {
        c.t -= 1;
        c.seg++;
        if (c.seg >= c.path.length - 1) {
          // Arrived! Boost destination growth & earn mini-credit
          if (c.destTile && isZone(c.destTile) && c.destTile.powered) {
            c.destTile.growth += 0.14 + c.destTile.parkBoost * 0.12;
          }
          if (!state.sandbox && c.destType === 'com') state.credits += 2;
          cars.splice(i, 1);
          continue;
        }
      }
      const p0 = c.path[c.seg];
      const p1 = c.path[c.seg + 1];
      c.x = p0.x + (p1.x - p0.x) * c.t;
      c.y = p0.y + (p1.y - p0.y) * c.t;
    }

    const flowNow = cars.length > 0 ? Math.round(100 - (totalBraking / cars.length) * 65) : 100;
    state.flowPct = Math.round(state.flowPct * 0.92 + Math.max(25, Math.min(100, flowNow)) * 0.08);

    // Update Flying Drones
    const droneTargets = tiles.filter(t => t.powered && (t.type === 'com' || t.type === 'res' || t.type === 'ind' || t.type === 'skyport'));
    for (const d of drones) {
      d.t += d.speed * dt;
      if (d.t >= 1) {
        d.t = 0;
        d.sx = d.ex;
        d.sy = d.ey;
        if (droneTargets.length > 1) {
          const next = droneTargets[(Math.random() * droneTargets.length) | 0];
          d.ex = next.x;
          d.ey = next.y;
          if (!state.sandbox) state.credits += 3;
        }
      }
    }

    // Power pulses along roads
    pulseAcc += dt;
    if (pulseAcc >= 0.45) {
      pulseAcc = 0;
      spawnPowerPulse();
    }
    for (let i = powerPulses.length - 1; i >= 0; i--) {
      const p = powerPulses[i];
      p.t += dt * 4.8;
      if (p.t >= 1) {
        p.t = 0;
        p.hops--;
        if (p.hops <= 0) { powerPulses.splice(i, 1); continue; }
        const cx = p.nx, cy = p.ny;
        const cands = [];
        for (const d of DIRS) {
          const nb = getTile(cx + d.dx, cy + d.dy);
          if (isRoad(nb) && !(nb.x === p.prevX && nb.y === p.prevY)) cands.push(nb);
        }
        if (cands.length === 0) { powerPulses.splice(i, 1); continue; }
        const pick = cands[(Math.random() * cands.length) | 0];
        p.prevX = cx; p.prevY = cy;
        p.x = cx; p.y = cy;
        p.nx = pick.x; p.ny = pick.y;
      }
    }

    // Fireworks particles
    for (let i = fireworks.length - 1; i >= 0; i--) {
      const f = fireworks[i];
      f.life -= rawDt;
      f.vz -= 45 * rawDt;
      f.z = Math.max(0, f.z + f.vz * rawDt);
      f.gx += (f.vx * rawDt) / 40;
      f.gy += (f.vy * rawDt) / 40;
      if (f.life <= 0) fireworks.splice(i, 1);
    }

    // Passive Income Tick & Building Skyscraper Level-Ups
    incomeAcc += dt;
    if (incomeAcc >= 2.0) {
      incomeAcc = 0;
      if (!state.sandbox) {
        state.credits += Math.max(2, Math.round(state.incomePerMin / 30));
      }
      syncDrones();
    }

    growthAcc += dt;
    if (growthAcc >= 1.4) {
      growthAcc = 0;
      let anyLeveled = false;
      const powerOk = state.powerGen >= state.powerUse * 0.85;
      for (const t of tiles) {
        if (!isZone(t) || !t.powered || t.level >= 3) continue;
        if (adjacentRoad(t) && powerOk) {
          t.growth += 0.08 + t.parkBoost * 0.14;
          const threshold = t.level === 1 ? 1.4 : 3.2;
          if (t.growth >= threshold && (t.level === 1 || t.parkBoost > 0.1 || state.flowPct >= 65)) {
            t.level++;
            t.growth = 0;
            t.popScale = 0.45;
            anyLeveled = true;
          }
        }
      }
      if (anyLeveled) {
        window.CityAudio.upgradeTower();
        recomputeNetwork();
        syncDrones();
      }
      // Check milestones
      if (state.milestoneIdx < MILESTONES.length) {
        const m = MILESTONES[state.milestoneIdx];
        if (state.population >= m.pop) {
          state.milestoneIdx++;
          if (!state.sandbox) state.credits += m.reward;
          window.CityAudio.milestone();
          triggerFireworks();
          if (state.onToast) state.onToast(`🎆 MILESTONE: ${m.name.toUpperCase()}! (+${m.reward} cr)`);
        }
      }
    }
  }

  return {
    GRID,
    TOOLS,
    MILESTONES,
    state,
    get tiles() { return tiles; },
    get cars() { return cars; },
    get drones() { return drones; },
    get powerPulses() { return powerPulses; },
    get fireworks() { return fireworks; },
    getTile,
    isRoad,
    isZone,
    getToolCost,
    createEmptyMap,
    seedStarterCity,
    placeTile,
    recomputeNetwork,
    step
  };
})();
