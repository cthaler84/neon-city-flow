// 2.5D Isometric Neon City Renderer
window.CityRender = (() => {
  const TW = 56;
  const TH = 28;

  const view = {
    x: 0,
    y: 0,
    zoom: 1.05,
    minZoom: 0.55,
    maxZoom: 2.35,
    hoverX: -1,
    hoverY: -1
  };

  function centerOn(gx, gy, W, H) {
    const isoX = (gx - gy) * (TW * 0.5) * view.zoom;
    const isoY = (gx + gy) * (TH * 0.5) * view.zoom;
    view.x = W * 0.5 - isoX;
    view.y = H * 0.52 - isoY;
  }

  function toScreen(gx, gy, z = 0) {
    return {
      x: (gx - gy) * (TW * 0.5) * view.zoom + view.x,
      y: (gx + gy) * (TH * 0.5) * view.zoom - z * view.zoom + view.y
    };
  }

  function toGrid(sx, sy) {
    const rx = (sx - view.x) / (TW * 0.5 * view.zoom);
    const ry = (sy - view.y) / (TH * 0.5 * view.zoom);
    return {
      x: Math.floor((rx + ry) * 0.5),
      y: Math.floor((ry - rx) * 0.5)
    };
  }

  function diamondPath(ctx, cx, cy, hw, hh) {
    ctx.beginPath();
    ctx.moveTo(cx, cy - hh);
    ctx.lineTo(cx + hw, cy);
    ctx.lineTo(cx, cy + hh);
    ctx.lineTo(cx - hw, cy);
    ctx.closePath();
  }

  // Draw an extruded 3D isometric box centered on tile (gx+0.5, gy+0.5)
  function drawIsoBox(ctx, gx, gy, scaleW, height, topCol, leftCol, rightCol, glowCol = null, windowsCol = null, winRows = 0) {
    const z = view.zoom;
    const base = toScreen(gx + 0.5, gy + 0.5, 0);
    const hw = (TW * 0.44 * scaleW) * z;
    const hh = (TH * 0.44 * scaleW) * z;
    const h = height * z;

    // Left wall
    ctx.fillStyle = leftCol;
    ctx.beginPath();
    ctx.moveTo(base.x - hw, base.y);
    ctx.lineTo(base.x, base.y + hh);
    ctx.lineTo(base.x, base.y + hh - h);
    ctx.lineTo(base.x - hw, base.y - h);
    ctx.closePath();
    ctx.fill();

    // Right wall
    ctx.fillStyle = rightCol;
    ctx.beginPath();
    ctx.moveTo(base.x + hw, base.y);
    ctx.lineTo(base.x, base.y + hh);
    ctx.lineTo(base.x, base.y + hh - h);
    ctx.lineTo(base.x + hw, base.y - h);
    ctx.closePath();
    ctx.fill();

    // Lit neon window stripes along both walls
    if (windowsCol && winRows > 0 && h > 10 * z) {
      ctx.strokeStyle = windowsCol;
      ctx.lineWidth = Math.max(1, 1.8 * z);
      for (let r = 1; r <= winRows; r++) {
        const wy = (r / (winRows + 1)) * h;
        ctx.beginPath();
        ctx.moveTo(base.x - hw * 0.82, base.y - wy + hh * 0.16);
        ctx.lineTo(base.x - hw * 0.16, base.y - wy + hh * 0.84);
        ctx.moveTo(base.x + hw * 0.16, base.y - wy + hh * 0.84);
        ctx.lineTo(base.x + hw * 0.82, base.y - wy + hh * 0.16);
        ctx.stroke();
      }
    }

    // Rooftop
    ctx.save();
    if (glowCol) {
      ctx.shadowColor = glowCol;
      ctx.shadowBlur = 12 * z;
    }
    ctx.fillStyle = topCol;
    diamondPath(ctx, base.x, base.y - h, hw, hh);
    ctx.fill();
    if (glowCol) {
      ctx.strokeStyle = glowCol;
      ctx.lineWidth = Math.max(0.8, 1.3 * z);
      ctx.stroke();
    }
    ctx.restore();
    return { x: base.x, y: base.y - h, hw, hh };
  }

  function drawRoadTile(ctx, t, sim, nowSec) {
    const z = view.zoom;
    const c = toScreen(t.x + 0.5, t.y + 0.5, 0);
    const isAve = t.type === 'avenue';
    const isBridge = t.base === 'water';

    // Elevated glowing bridge deck over river
    if (isBridge) {
      const hw = TW * 0.49 * z, hh = TH * 0.49 * z;
      ctx.fillStyle = '#0f172a';
      diamondPath(ctx, c.x, c.y - 2 * z, hw, hh);
      ctx.fill();
      ctx.strokeStyle = isAve ? '#22d3ee' : '#38bdf8';
      ctx.lineWidth = 1.6 * z;
      ctx.stroke();
    }

    const roadW = (isAve ? 16 : 12) * z;
    const laneCol = sim.state.showHeat && t.congestion > 0.12
      ? (t.congestion > 0.55 ? '#fb7185' : '#fbbf24')
      : (isAve ? '#22d3ee' : (t.powered ? '#38bdf8' : '#475569'));

    const arms = [
      { bit: 1, gx: t.x + 0.5, gy: t.y },
      { bit: 2, gx: t.x + 1.0, gy: t.y + 0.5 },
      { bit: 4, gx: t.x + 0.5, gy: t.y + 1.0 },
      { bit: 8, gx: t.x,       gy: t.y + 0.5 }
    ];

    // Dark asphalt base
    ctx.lineCap = 'round';
    ctx.strokeStyle = isAve ? '#16243d' : '#121b2e';
    ctx.lineWidth = roadW;
    ctx.beginPath();
    let any = false;
    for (const arm of arms) {
      if (t.roadMask & arm.bit) {
        const pt = toScreen(arm.gx, arm.gy, 0);
        ctx.moveTo(c.x, c.y);
        ctx.lineTo(pt.x, pt.y);
        any = true;
      }
    }
    if (!any) {
      ctx.moveTo(c.x - 1, c.y);
      ctx.lineTo(c.x + 1, c.y);
    }
    ctx.stroke();

    // Glowing neon center / rail stripe
    ctx.save();
    ctx.strokeStyle = laneCol;
    ctx.globalAlpha = isAve ? 0.85 : 0.58;
    ctx.lineWidth = (isAve ? 2.8 : 1.5) * z;
    if (isAve) {
      ctx.shadowColor = laneCol;
      ctx.shadowBlur = 8 * z;
    } else {
      ctx.setLineDash([4 * z, 4 * z]);
    }
    ctx.beginPath();
    for (const arm of arms) {
      if (t.roadMask & arm.bit) {
        const pt = toScreen(arm.gx, arm.gy, 0);
        ctx.moveTo(c.x, c.y);
        ctx.lineTo(pt.x, pt.y);
      }
    }
    ctx.stroke();
    ctx.restore();

    // Animated traffic light indicator at 4-way intersections
    if (t.roadMask === 15) {
      const nsGreen = Math.floor(sim.state.trafficPhase / 3.4) % 2 === 0;
      ctx.save();
      ctx.fillStyle = nsGreen ? '#34d399' : '#fb7185';
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 8 * z;
      ctx.beginPath();
      ctx.arc(c.x, c.y - 3 * z, 2.5 * z, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Cable-stayed bridge pylon & glowing cables over water!
    if (isBridge) {
      const pylonH = (isAve ? 34 : 26) * z;
      ctx.save();
      ctx.strokeStyle = isAve ? '#22d3ee' : '#38bdf8';
      ctx.lineWidth = 2.2 * z;
      ctx.beginPath();
      ctx.moveTo(c.x, c.y - 2 * z);
      ctx.lineTo(c.x, c.y - pylonH);
      ctx.stroke();
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 1.0 * z;
      ctx.beginPath();
      ctx.moveTo(c.x, c.y - pylonH);
      ctx.lineTo(c.x - TW * 0.38 * z, c.y);
      ctx.moveTo(c.x, c.y - pylonH);
      ctx.lineTo(c.x + TW * 0.38 * z, c.y);
      ctx.stroke();
      ctx.fillStyle = '#e0f2fe';
      ctx.beginPath();
      ctx.arc(c.x, c.y - pylonH, 2.2 * z, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawBuilding(ctx, t, nowSec) {
    const z = view.zoom;
    const bounce = Math.sin(t.popScale * Math.PI * 0.5);
    const dim = t.powered ? 1 : 0.48;

    ctx.save();
    ctx.globalAlpha = dim;

    if (t.type === 'res') {
      const h = (18 + t.level * 17 + t.variant * 3) * bounce;
      const top = drawIsoBox(
        ctx, t.x, t.y, 0.78, h,
        t.level >= 3 ? '#164e63' : '#133a4f',
        '#0c2436',
        '#113248',
        t.powered ? '#22d3ee' : '#475569',
        t.powered ? 'rgba(103, 232, 249, 0.72)' : null,
        t.level + 1
      );
      if (t.level >= 3 && t.powered) {
        // Spire beacon
        ctx.strokeStyle = '#67e8f9';
        ctx.lineWidth = 1.8 * z;
        ctx.beginPath();
        ctx.moveTo(top.x, top.y);
        ctx.lineTo(top.x, top.y - 14 * z);
        ctx.stroke();
        ctx.fillStyle = '#34d399';
        ctx.beginPath();
        ctx.arc(top.x, top.y - 14 * z, 2.4 * z, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (t.type === 'com') {
      const h = (22 + t.level * 22 + t.variant * 4) * bounce;
      const top = drawIsoBox(
        ctx, t.x, t.y, 0.84, h,
        t.level >= 3 ? '#501746' : '#3b1538',
        '#220c27',
        '#331036',
        t.powered ? '#f472b6' : '#475569',
        t.powered ? 'rgba(244, 114, 182, 0.8)' : null,
        t.level + 2
      );
      // Floating holo-ring sign above Lv 2+ Commercial plazas
      if (t.level >= 2 && t.powered) {
        const hover = Math.sin(nowSec * 3 + t.seed * 6) * 2.5 * z;
        ctx.save();
        ctx.strokeStyle = t.level === 3 ? '#fde047' : '#f472b6';
        ctx.lineWidth = 1.8 * z;
        ctx.shadowColor = ctx.strokeStyle;
        ctx.shadowBlur = 10 * z;
        ctx.beginPath();
        ctx.ellipse(top.x, top.y - 8 * z + hover, 9 * z, 4.5 * z, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    } else if (t.type === 'ind') {
      const h = (18 + t.level * 14) * bounce;
      const top = drawIsoBox(
        ctx, t.x, t.y, 0.86, h,
        '#472a0b',
        '#261607',
        '#38200a',
        t.powered ? '#fbbf24' : '#475569',
        t.powered ? 'rgba(251, 191, 36, 0.72)' : null,
        t.level
      );
      // Pulsing assembly stacks
      if (t.powered) {
        const pulse = 0.55 + Math.sin(nowSec * 5 + t.seed * 8) * 0.45;
        ctx.fillStyle = `rgba(251, 191, 36, ${pulse.toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(top.x - 4 * z, top.y - 2 * z, 3.2 * z, 0, Math.PI * 2);
        ctx.arc(top.x + 5 * z, top.y + 1 * z, 2.6 * z, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (t.type === 'power') {
      const h = 16 * bounce;
      const top = drawIsoBox(
        ctx, t.x, t.y, 0.86, h,
        '#2e1065',
        '#1a0b3b',
        '#240e52',
        '#a78bfa',
        'rgba(167, 139, 250, 0.8)',
        1
      );
      // Levitating Fusion Sphere + rotating plasma halo
      const bob = Math.sin(nowSec * 3.4 + t.seed * 6) * 3.5 * z;
      const cy = top.y - 16 * z + bob;
      ctx.save();
      ctx.shadowColor = '#a78bfa';
      ctx.shadowBlur = 18 * z;
      ctx.strokeStyle = '#c4b5fd';
      ctx.lineWidth = 1.8 * z;
      ctx.beginPath();
      ctx.ellipse(top.x, cy, 13 * z, 5.5 * z, Math.sin(nowSec * 1.4) * 0.35, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#ede9fe';
      ctx.beginPath();
      ctx.arc(top.x, cy, 6.2 * z, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (t.type === 'park') {
      const top = drawIsoBox(ctx, t.x, t.y, 0.9, 5 * bounce, '#064e3b', '#042f2e', '#065f46', '#34d399', null, 0);
      // Glowing cyber bonsai / holo trees + central fountain
      const treePos = [[-9, -1], [8, -2], [0, 4]];
      ctx.save();
      ctx.shadowColor = '#34d399';
      ctx.shadowBlur = 10 * z;
      for (const [ox, oy] of treePos) {
        const tx = top.x + ox * z, ty = top.y + oy * z;
        ctx.strokeStyle = '#6ee7b7';
        ctx.lineWidth = 1.6 * z;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(tx, ty - 9 * z);
        ctx.stroke();
        ctx.fillStyle = '#34d399';
        ctx.beginPath();
        ctx.arc(tx, ty - 11 * z, 4.6 * z, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#67e8f9';
      ctx.beginPath();
      ctx.arc(top.x, top.y - 1 * z, 3.2 * z, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (t.type === 'skyport') {
      const top = drawIsoBox(ctx, t.x, t.y, 0.92, 14 * bounce, '#0f2942', '#0b1c30', '#12263f', '#22d3ee', 'rgba(34,211,238,0.65)', 1);
      // Animated cyan landing ring
      ctx.save();
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 2 * z;
      ctx.shadowColor = '#22d3ee';
      ctx.shadowBlur = 12 * z;
      ctx.beginPath();
      ctx.ellipse(top.x, top.y, 12 * z, 6 * z, 0, nowSec * 1.5, nowSec * 1.5 + Math.PI * 1.55);
      ctx.stroke();
      ctx.fillStyle = '#e0f2fe';
      ctx.font = `900 ${Math.max(8, Math.round(9 * z))}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('H', top.x, top.y);
      ctx.restore();
    }

    ctx.restore();

    // Unpowered indicator badge
    if (!t.powered && t.type !== 'park' && t.type !== 'power') {
      const pt = toScreen(t.x + 0.5, t.y + 0.5, 28 + Math.sin(nowSec * 5) * 3);
      ctx.save();
      ctx.font = `${Math.max(10, Math.round(12 * z))}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('⚡', pt.x, pt.y);
      ctx.restore();
    }
  }

  function render(ctx, W, H, sim, nowSec) {
    // Sky backdrop (Midnight Neon vs Golden Dusk vs Auto cycle)
    const tod = sim.state.timeOfDay;
    const isDusk = tod > 0.62 && tod < 0.82;
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    if (isDusk) {
      bgGrad.addColorStop(0, '#140c29');
      bgGrad.addColorStop(0.55, '#1e1338');
      bgGrad.addColorStop(1, '#0c0d1f');
    } else {
      bgGrad.addColorStop(0, '#040712');
      bgGrad.addColorStop(0.55, '#070e1f');
      bgGrad.addColorStop(1, '#040814');
    }
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    const z = view.zoom;
    const hw = TW * 0.5 * z;
    const hh = TH * 0.5 * z;
    const G = sim.GRID;

    // 1. Ground, Water & Roads pass
    for (let sum = 0; sum <= (G - 1) * 2; sum++) {
      for (let x = Math.max(0, sum - (G - 1)); x <= Math.min(G - 1, sum); x++) {
        const y = sum - x;
        const t = sim.getTile(x, y);
        const c = toScreen(x + 0.5, y + 0.5, 0);
        if (c.x < -TW * z || c.x > W + TW * z || c.y < -80 * z || c.y > H + 80 * z) continue;

        diamondPath(ctx, c.x, c.y, hw, hh);
        if (t.base === 'water') {
          const wave = Math.sin(nowSec * 2.2 + x * 0.7 + y * 0.5) * 0.5 + 0.5;
          ctx.fillStyle = `rgb(${Math.round(6 + wave * 8)}, ${Math.round(28 + wave * 18)}, ${Math.round(54 + wave * 24)})`;
          ctx.fill();
          ctx.strokeStyle = `rgba(34, 211, 238, ${(0.08 + wave * 0.14).toFixed(3)})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        } else {
          const parkGlow = t.parkBoost > 0.2;
          ctx.fillStyle = parkGlow ? '#0a1c22' : ((x + y) % 2 === 0 ? '#0a1122' : '#0c1428');
          ctx.fill();
          ctx.strokeStyle = parkGlow ? 'rgba(52, 211, 153, 0.14)' : 'rgba(56, 189, 248, 0.075)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        if (sim.isRoad(t)) drawRoadTile(ctx, t, sim, nowSec);
      }
    }

    // 2. Power Pulses gliding down roads
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of sim.powerPulses) {
      const gx = p.x + (p.nx - p.x) * p.t + 0.5;
      const gy = p.y + (p.ny - p.y) * p.t + 0.5;
      const pt = toScreen(gx, gy, 1);
      ctx.fillStyle = '#c084fc';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 3.2 * z, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 3. Hover Preview & Aura Ring (for Power Core / Eco-Park)
    if (view.hoverX >= 0 && view.hoverY >= 0 && view.hoverX < G && view.hoverY < G && sim.state.activeTool !== 'pan') {
      const ht = sim.getTile(view.hoverX, view.hoverY);
      const hc = toScreen(view.hoverX + 0.5, view.hoverY + 0.5, 0);
      const tool = sim.state.activeTool;
      const blocked = ht.base === 'water' && tool !== 'road' && tool !== 'avenue' && tool !== 'bulldoze';
      const col = tool === 'bulldoze' ? '#fb7185' : (blocked ? '#ef4444' : '#22d3ee');

      // Show effect radius for Park (3) or Fusion Core (2)
      if (tool === 'park' || tool === 'power') {
        const rad = tool === 'park' ? 3 : 2;
        ctx.save();
        ctx.strokeStyle = tool === 'park' ? 'rgba(52,211,153,0.4)' : 'rgba(167,139,250,0.45)';
        ctx.lineWidth = 2 * z;
        ctx.beginPath();
        ctx.ellipse(hc.x, hc.y, TW * (rad + 0.3) * 0.5 * z, TH * (rad + 0.3) * 0.5 * z, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      ctx.save();
      diamondPath(ctx, hc.x, hc.y, hw, hh);
      ctx.fillStyle = `${col}33`;
      ctx.fill();
      ctx.strokeStyle = col;
      ctx.lineWidth = 2 * z;
      ctx.stroke();
      ctx.restore();
    }

    // 4. Right-Lane Glowing Cars (rendered before tall buildings or interleaved cleanly)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const c of sim.cars) {
      // Right-hand lane perpendicular vector in grid space
      const rx = -c.dy * 0.17;
      const ry = c.dx * 0.17;
      const pt = toScreen(c.x + 0.5 + rx, c.y + 0.5 + ry, 2.5);
      // Soft tail glow
      ctx.fillStyle = c.braking ? '#fb7185' : c.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, (c.braking ? 3.2 : 2.6) * z, 0, Math.PI * 2);
      ctx.fill();
      // Crisp bright headlight core
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 1.15 * z, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 5. Extruded 3D Isometric Buildings (Strict Back-to-Front Painter's Order!)
    for (let sum = 0; sum <= (G - 1) * 2; sum++) {
      for (let x = Math.max(0, sum - (G - 1)); x <= Math.min(G - 1, sum); x++) {
        const y = sum - x;
        const t = sim.getTile(x, y);
        if (t.type !== 'empty' && t.type !== 'water' && !sim.isRoad(t)) {
          const c = toScreen(x + 0.5, y + 0.5, 0);
          if (c.x < -90 * z || c.x > W + 90 * z || c.y < -120 * z || c.y > H + 120 * z) continue;
          drawBuilding(ctx, t, nowSec);
        }
      }
    }

    // 6. Flying Autonomous Neon Cargo Drones (gliding high above skyline with ground shadows!)
    for (const d of sim.drones) {
      const gx = d.sx + (d.ex - d.sx) * d.t + 0.5;
      const gy = d.sy + (d.ey - d.sy) * d.t + 0.5;
      const alt = 22 + Math.sin(d.t * Math.PI) * d.alt;
      const shadow = toScreen(gx, gy, 1);
      const pos = toScreen(gx, gy, alt);

      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.beginPath();
      ctx.ellipse(shadow.x, shadow.y, 4.5 * z, 2.2 * z, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = d.color;
      ctx.shadowColor = d.color;
      ctx.shadowBlur = 10 * z;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 3.2 * z, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 1.3 * z, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 7. Milestone Fireworks over the skyline!
    if (sim.fireworks.length > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const f of sim.fireworks) {
        const p = toScreen(f.gx, f.gy, f.z);
        ctx.globalAlpha = Math.max(0, f.life / f.maxLife);
        ctx.fillStyle = f.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3 * z, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  return { view, centerOn, toScreen, toGrid, render };
})();
