import { SHIPS, WEAPONS, resolveStats } from './ships.js';

const GOALS = [
  { v: 0, l: 'Endless' }, { v: 10, l: '10' }, { v: 25, l: '25' }, { v: 50, l: '50' },
];

const SENS = [
  { v: 0.55, l: 'Low' }, { v: 1, l: 'Normal' }, { v: 1.7, l: 'High' },
];

const STAT_ROWS = [
  ['accel', 'ACCEL'], ['speed', 'TOP SPEED'], ['handling', 'HANDLING'],
  ['boost', 'BOOST'], ['hull', 'HULL'], ['mass', 'MASS'],
];

const CSS = `
#ui{font-family:"Rajdhani","Chakra Petch",ui-sans-serif,system-ui,sans-serif;letter-spacing:.02em}
#ui h1,#ui h2,#ui h3{margin:0;font-weight:700;letter-spacing:.12em;text-transform:uppercase}
.hidden{display:none !important}

/* #ui itself is pointer-events:none so the canvas stays clickable during play;
   every interactive overlay has to opt back in. */
#splash,#menu,#pause,#results,#loading{pointer-events:auto}
#hud,#dmg,.scan,.vig{pointer-events:none}
button,.chip,.tab,.slot,.rotbtn{pointer-events:auto}

.scan{position:absolute;inset:0;pointer-events:none;z-index:3;
  background:repeating-linear-gradient(to bottom,rgba(94,242,255,.03) 0 1px,transparent 1px 3px);
  mix-blend-mode:screen;opacity:.55}
.vig{position:absolute;inset:0;pointer-events:none;z-index:2;
  background:radial-gradient(ellipse at center,transparent 42%,rgba(2,4,12,.7) 100%)}

/* ======================= SPLASH ======================= */
#splash{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;
  justify-content:center;gap:0;z-index:6;
  background:radial-gradient(ellipse at 50% 55%,rgba(10,20,50,.25) 0%,rgba(3,5,14,.86) 70%)}
#splash .kicker{font-size:12px;letter-spacing:.6em;color:#5ef2ff;opacity:.75;margin-bottom:14px;
  animation:fadeUp .8s ease-out both}
#splash .logo{width:min(560px,74vw);height:auto;display:block;
  filter:drop-shadow(0 0 42px rgba(94,242,255,.45)) drop-shadow(0 0 14px rgba(120,255,180,.3));
  animation:fadeUp .9s .08s ease-out both}
/* fallback wordmark if the logo asset is missing */
#splash .logo-text{font-size:clamp(48px,9vw,124px);font-weight:700;letter-spacing:.06em;line-height:.94;
  text-align:center;background:linear-gradient(96deg,#5ef2ff 0%,#b6ff3d 42%,#ff4fd8 100%);
  -webkit-background-clip:text;background-clip:text;color:transparent;
  filter:drop-shadow(0 0 34px rgba(94,242,255,.45));animation:fadeUp .9s .08s ease-out both}
#splash .logo-text span{display:block}
#splash .rule{width:min(560px,70vw);height:1px;margin:26px 0 20px;
  background:linear-gradient(90deg,transparent,#5ef2ff,#ff4fd8,transparent);opacity:.65;
  animation:widen 1s .3s ease-out both}
#splash .sub{font-size:13.5px;letter-spacing:.34em;color:#8fb0d4;text-align:center;
  animation:fadeUp 1s .28s ease-out both}
#splash .cta{margin-top:38px;animation:fadeUp 1s .45s ease-out both}
#splash .hint{margin-top:20px;font-size:11px;letter-spacing:.26em;color:#5b7a9c;
  animation:pulse 2.2s infinite}
@keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
@keyframes widen{from{opacity:0;transform:scaleX(.2)}to{opacity:.65;transform:none}}
@keyframes pulse{0%,100%{opacity:.4}50%{opacity:1}}

.btn{padding:14px 40px;border:1px solid #b6ff3d;background:rgba(120,200,40,.13);color:#d8ffa0;
  font-size:15px;font-weight:700;letter-spacing:.22em;cursor:pointer;border-radius:2px;
  text-transform:uppercase;transition:.15s;font-family:inherit;position:relative}
.btn:hover{background:#b6ff3d;color:#06210b;box-shadow:0 0 34px rgba(182,255,61,.45)}
.btn:disabled{opacity:.35;cursor:default;box-shadow:none;background:transparent}
.btn.ghost{border-color:rgba(140,170,210,.34);background:transparent;color:#9db6d6;
  font-size:12px;padding:11px 20px;letter-spacing:.18em}
.btn.ghost:hover{background:rgba(140,170,210,.14);color:#e8f4ff;box-shadow:none}

/* ======================= HANGAR ======================= */
#menu{position:absolute;inset:0;z-index:5;display:grid;
  grid-template-rows:auto 1fr auto;pointer-events:none}
#menu > *{pointer-events:auto}

.topbar{display:flex;align-items:center;gap:26px;padding:16px 26px;
  background:linear-gradient(180deg,rgba(4,8,20,.92),rgba(4,8,20,0))}
.topbar .mark{font-size:22px;font-weight:700;letter-spacing:.16em;
  background:linear-gradient(92deg,#5ef2ff,#b6ff3d 50%,#ff4fd8);
  -webkit-background-clip:text;background-clip:text;color:transparent}
.tabs{display:flex;gap:8px}
.tab{padding:9px 20px;border:1px solid rgba(120,150,200,.22);border-radius:2px;cursor:pointer;
  font-size:12.5px;letter-spacing:.18em;color:#8fa9c8;background:rgba(8,14,32,.55);transition:.14s;
  text-transform:uppercase;font-weight:600}
.tab:hover{border-color:rgba(94,242,255,.6);color:#e8f4ff}
.tab.sel{border-color:#5ef2ff;color:#0a1a24;background:#5ef2ff;
  box-shadow:0 0 24px rgba(94,242,255,.35)}
.topbar .spacer{flex:1}
.topbar .mode-note{font-size:11.5px;color:#6d88ab;max-width:330px;line-height:1.45;text-align:right}

.stage{display:grid;grid-template-columns:250px 1fr 296px;gap:0;min-height:0}

.rail{padding:0 12px 12px 20px;overflow-y:auto;display:flex;flex-direction:column;gap:6px}
.rail::-webkit-scrollbar{width:5px}
.rail::-webkit-scrollbar-thumb{background:rgba(94,242,255,.3);border-radius:3px}
.rail h3{font-size:10px;color:#5ef2ff;letter-spacing:.28em;padding:4px 0 8px;position:sticky;top:0;
  background:linear-gradient(180deg,rgba(4,8,20,.95),rgba(4,8,20,.6));backdrop-filter:blur(3px);z-index:1}
.slot{display:flex;align-items:center;gap:10px;padding:9px 11px;cursor:pointer;
  border:1px solid rgba(120,150,200,.14);border-left:2px solid var(--acc);
  background:linear-gradient(90deg,color-mix(in srgb,var(--acc) 9%,transparent),rgba(6,11,26,.62));
  transition:.13s;border-radius:2px}
.slot:hover{transform:translateX(4px);border-color:rgba(94,242,255,.5)}
.slot.sel{background:linear-gradient(90deg,color-mix(in srgb,var(--acc) 30%,transparent),rgba(6,11,26,.7));
  border-color:var(--acc);box-shadow:0 0 20px color-mix(in srgb,var(--acc) 24%,transparent)}
.slot .idx{font-size:10px;color:#5b7a9c;font-family:ui-monospace,monospace;width:16px}
.slot .txt{flex:1;min-width:0}
.slot .nm{font-size:11.5px;font-weight:700;letter-spacing:.05em;color:#e8f4ff;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.slot .kl{font-size:9.5px;letter-spacing:.16em;color:var(--acc);margin-top:1px}

.viewport{position:relative;display:flex;flex-direction:column;justify-content:space-between;
  align-items:center;padding:8px 0 14px;min-height:0}
.viewport .title{text-align:center;pointer-events:none}
.viewport .title .nm{font-size:clamp(26px,3.4vw,46px);font-weight:700;letter-spacing:.1em;color:#fff;
  text-shadow:0 0 30px color-mix(in srgb,var(--acc) 70%,transparent)}
.viewport .title .kl{font-size:11.5px;letter-spacing:.42em;color:var(--acc);margin-top:2px}
.viewport .blurb{max-width:480px;margin:8px auto 0;font-size:12.5px;color:#8ea6c6;line-height:1.5;
  font-style:italic;text-align:center}
.viewport .foot{display:flex;align-items:center;gap:10px}
.rotbtn{width:34px;height:30px;border:1px solid rgba(120,150,200,.3);background:rgba(8,14,32,.6);
  color:#9db6d6;cursor:pointer;border-radius:2px;font-size:13px;font-family:inherit;transition:.13s}
.rotbtn:hover{border-color:#5ef2ff;color:#e8f4ff}
.rotlbl{font-size:10px;letter-spacing:.2em;color:#5b7a9c}
.loadchip{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);
  font-size:11px;letter-spacing:.3em;color:#5ef2ff;pointer-events:none}
.loadchip::after{content:'';display:block;width:120px;height:2px;margin-top:10px;
  background:linear-gradient(90deg,transparent,#5ef2ff,transparent);animation:sweep 1.1s infinite}
@keyframes sweep{0%{transform:translateX(-40px);opacity:.2}50%{opacity:1}100%{transform:translateX(40px);opacity:.2}}

.specs{padding:0 20px 12px 12px;overflow-y:auto;display:flex;flex-direction:column;gap:11px}
.specs::-webkit-scrollbar{width:5px}
.specs::-webkit-scrollbar-thumb{background:rgba(94,242,255,.3);border-radius:3px}
.specs h3{font-size:10px;color:#5ef2ff;letter-spacing:.28em;padding-top:4px}
.bars{display:flex;flex-direction:column;gap:6px}
.bar{display:grid;grid-template-columns:66px 1fr 24px;align-items:center;gap:8px}
.bar span{font-size:9.5px;letter-spacing:.16em;color:#7f97b8}
.bar .t{height:6px;background:rgba(255,255,255,.08);border-radius:2px;overflow:hidden}
.bar .t b{display:block;height:100%;background:linear-gradient(90deg,var(--acc),#fff);
  box-shadow:0 0 9px var(--acc);transition:width .3s cubic-bezier(.2,.8,.2,1)}
.bar em{font-size:10.5px;color:#c8dcf2;font-style:normal;text-align:right}
.wrow{display:flex;justify-content:space-between;gap:10px;font-size:12px;padding:7px 9px;
  background:rgba(94,242,255,.055);border-left:2px solid var(--acc);border-radius:1px}
.wrow .k{color:#7f97b8;letter-spacing:.16em;font-size:9.5px}
.wrow .v{color:#e8f4ff;font-weight:600}
.abil{padding:9px;background:rgba(182,255,61,.07);border-left:2px solid #b6ff3d;border-radius:1px}
.abil .an{font-size:12px;font-weight:700;color:#b6ff3d;letter-spacing:.08em}
.abil .ad{font-size:11px;color:#9db8a0;margin-top:3px;line-height:1.4}
.derived{font-size:10.5px;color:#6d84a5;line-height:1.7;font-family:ui-monospace,monospace}

.dock{display:flex;align-items:center;gap:22px;padding:14px 26px 18px;
  background:linear-gradient(0deg,rgba(4,8,20,.94),rgba(4,8,20,0));flex-wrap:wrap}
.opt{display:flex;align-items:center;gap:8px}
.opt > .lb{font-size:9.5px;letter-spacing:.24em;color:#5b7a9c}
.chips{display:flex;gap:5px}
.chip{padding:6px 13px;border:1px solid rgba(120,150,200,.24);border-radius:99px;cursor:pointer;
  font-size:11.5px;letter-spacing:.08em;color:#9db6d6;background:rgba(8,14,32,.55);transition:.13s}
.chip:hover{border-color:rgba(94,242,255,.6);color:#e8f4ff}
.chip.sel{border-color:#b6ff3d;background:rgba(120,200,40,.16);color:#d8ffa0;font-weight:700}
.dock .spacer{flex:1}
.keys{font-size:10.5px;color:#5b7a9c;line-height:1.65;max-width:430px}
.keys b{color:#9db6d6;font-weight:600}

/* ======================= HUD ======================= */
#hud{position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity .4s;z-index:4}
#hud.on{opacity:1}
.hcorner{position:absolute;padding:12px 14px;background:rgba(6,10,24,.42);
  border:1px solid rgba(94,242,255,.18);border-radius:3px;backdrop-filter:blur(3px);z-index:2}
#hLeft{left:22px;bottom:22px;min-width:210px}
#hRight{right:22px;bottom:22px;min-width:190px;text-align:right}
#hTop{left:50%;top:18px;transform:translateX(-50%);text-align:center;min-width:290px}
#hScore{right:22px;top:18px;text-align:right}
#hBoard{left:22px;top:18px;min-width:190px}
#hRadar{left:22px;top:18px;padding:10px}
#hRadar.shift{top:210px}
#hRadar canvas{display:block;image-rendering:auto}
#hRadar .rlegend{display:flex;gap:9px;margin-top:7px;font-size:9px;letter-spacing:.1em;color:#6d88ab}
#hRadar .rlegend i{display:inline-block;width:6px;height:6px;border-radius:50%;margin-right:3px;
  vertical-align:middle}
#hGoal{left:50%;bottom:22px;transform:translateX(-50%);min-width:230px;text-align:center}
#hGoal .track{height:6px;background:rgba(255,255,255,.1);border-radius:3px;overflow:hidden;margin-top:6px}
#hGoal .track b{display:block;height:100%;background:linear-gradient(90deg,#5ef2ff,#b6ff3d);transition:width .25s}

.big{font-size:34px;font-weight:700;line-height:1;color:#e8f4ff;text-shadow:0 0 16px rgba(94,242,255,.4)}
.unit{font-size:11px;color:#6d88ab;letter-spacing:.2em;margin-left:5px}
.lbl{font-size:10px;letter-spacing:.22em;color:#6d88ab}
.gauge{height:9px;background:rgba(255,255,255,.09);border-radius:2px;overflow:hidden;margin-top:5px}
.gauge b{display:block;height:100%;transition:width .08s linear}
.g-boost b{background:linear-gradient(90deg,#5ef2ff,#b6ff3d)}
.g-heat b{background:linear-gradient(90deg,#ffd66b,#ff4d3d)}
.g-hull b{background:linear-gradient(90deg,#b6ff3d,#5ef2ff)}
.g-hull.low b{background:linear-gradient(90deg,#ff4d3d,#ffb347)}
.rowbar{display:grid;grid-template-columns:44px 1fr;gap:8px;align-items:center;margin-top:8px}
.rowbar .lbl{text-align:left}
#hBoard .r{display:flex;justify-content:space-between;font-size:12.5px;padding:2.5px 0;color:#93aac9}
#hBoard .r.me{color:#b6ff3d;font-weight:700}
#hBoard .r .p{width:20px;color:#5b7a9c}

#crosshair{position:absolute;left:50%;top:50%;width:44px;height:44px;z-index:1;
  transform:translate(-50%,-50%);will-change:transform}
#reticles{position:absolute;inset:0;width:100%;height:100%;z-index:0}
#stickwell{position:absolute;left:50%;top:50%;width:2px;height:2px}
#stickwell svg{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);overflow:visible}
#toast{position:absolute;left:50%;top:22%;transform:translateX(-50%);text-align:center;z-index:3}
.tmsg{font-size:26px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;
  text-shadow:0 0 22px currentColor;animation:pop .5s ease-out;margin-bottom:4px}
@keyframes pop{from{transform:scale(.7);opacity:0}to{transform:scale(1);opacity:1}}
#pops{position:absolute;inset:0;overflow:hidden}
.pop{position:absolute;font-size:15px;font-weight:700;animation:rise 1.1s ease-out forwards;
  text-shadow:0 0 10px currentColor}
@keyframes rise{from{transform:translateY(0);opacity:1}to{transform:translateY(-70px);opacity:0}}
#dmg{position:absolute;inset:0;pointer-events:none;opacity:0;z-index:4;
  background:radial-gradient(ellipse at center,transparent 40%,rgba(255,40,40,.55) 100%)}

#pause,#results{position:absolute;inset:0;background:rgba(4,7,18,.88);display:flex;
  align-items:center;justify-content:center;flex-direction:column;gap:16px;backdrop-filter:blur(7px);z-index:8}
.rcard{width:min(520px,90vw);padding:30px 34px;background:linear-gradient(160deg,rgba(20,32,64,.9),rgba(8,12,28,.94));
  border:1px solid rgba(94,242,255,.24);border-radius:3px;position:relative}
.rcard::before{content:'';position:absolute;top:0;left:0;width:40px;height:2px;background:#5ef2ff}
.rrow{display:flex;justify-content:space-between;padding:9px 0;
  border-bottom:1px solid rgba(120,150,200,.13);font-size:15px}
.rrow .k{color:#7f97b8;letter-spacing:.14em;font-size:12px}
.rrow .v{color:#e8f4ff;font-weight:700}
.rrow .v.total{font-size:28px;color:#b6ff3d}

#loading{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;
  justify-content:center;gap:14px;background:rgba(3,4,12,.94);z-index:20}
#loading .lb{width:280px;height:3px;background:rgba(255,255,255,.1);overflow:hidden}
#loading .lb b{display:block;height:100%;width:0;background:linear-gradient(90deg,#5ef2ff,#b6ff3d);transition:width .2s}
#loading .lt{font-size:12px;letter-spacing:.3em;color:#5ef2ff}

@media (max-width:1080px){
  .stage{grid-template-columns:180px 1fr 240px}
  .viewport .blurb{display:none}
}
`;

export class HUD {
  constructor(root) {
    this.root = root;
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    root.innerHTML = `
      <div class="vig"></div><div class="scan"></div>
      <div id="splash" class="hidden"></div>
      <div id="menu" class="hidden"></div>
      <div id="hud">
        <div id="hBoard" class="hcorner"></div>
        <div id="hRadar" class="hcorner">
          <div class="lbl" style="margin-bottom:6px">SCANNER · <span id="rrange">6.0</span>KM</div>
          <canvas width="176" height="176"></canvas>
          <div class="rlegend" id="rlegend"></div>
        </div>
        <div id="hTop" class="hcorner"></div>
        <div id="hScore" class="hcorner"></div>
        <div id="hLeft" class="hcorner"></div>
        <div id="hRight" class="hcorner"></div>
        <div id="hGoal" class="hcorner"></div>
        <canvas id="reticles"></canvas>
        <div id="stickwell">
          <svg width="2" height="2" viewBox="-140 -140 280 280">
            <circle cx="0" cy="0" r="118" fill="none" stroke="#5ef2ff" stroke-opacity=".1"
                    stroke-width="1.5" stroke-dasharray="4 7"/>
          </svg>
        </div>
        <svg id="crosshair" viewBox="0 0 44 44">
          <circle cx="22" cy="22" r="15" fill="none" stroke="#5ef2ff" stroke-opacity=".45" stroke-width="1"/>
          <path d="M22 4v7M22 33v7M4 22h7M33 22h7" stroke="#5ef2ff" stroke-width="1.4" stroke-opacity=".85"/>
          <circle cx="22" cy="22" r="1.6" fill="#b6ff3d"/>
        </svg>
        <div id="toast"></div>
        <div id="pops"></div>
      </div>
      <div id="dmg"></div>
      <div id="loading" class="hidden"></div>
    `;

    this.splash = root.querySelector('#splash');
    this.menu = root.querySelector('#menu');
    this.hud = root.querySelector('#hud');
    this.el = {
      board: root.querySelector('#hBoard'), top: root.querySelector('#hTop'),
      score: root.querySelector('#hScore'), left: root.querySelector('#hLeft'),
      right: root.querySelector('#hRight'), goal: root.querySelector('#hGoal'),
      toast: root.querySelector('#toast'), pops: root.querySelector('#pops'),
      dmg: root.querySelector('#dmg'), loading: root.querySelector('#loading'),
      radar: root.querySelector('#hRadar'),
      radarCanvas: root.querySelector('#hRadar canvas'),
      radarRange: root.querySelector('#rrange'),
      radarLegend: root.querySelector('#rlegend'),
      cross: root.querySelector('#crosshair'),
      reticles: root.querySelector('#reticles'),
    };
    this.rctx = this.el.radarCanvas.getContext('2d');
    this.tctx = this.el.reticles.getContext('2d');
    this._sizeReticles();
    addEventListener('resize', () => this._sizeReticles());

    this.selectedShip = SHIPS[0].id;
    this.selectedMode = 'free';
    this.assist = 'assisted';
    this.goal = 0;
    this.muted = false;
    this.sens = Number(localStorage.getItem('nexusracer.sens') || 1);
    this.previewState = 'ready';
  }

  // -------------------------------------------------------------- splash ---
  showSplash(onEnter) {
    this.splash.classList.remove('hidden');
    this.menu.classList.add('hidden');
    this.hud.classList.remove('on');
    this.splash.innerHTML = `
      <div class="kicker">ANTHROPIC HACK ▸ FLIGHT DIVISION</div>
      <img class="logo" src="${import.meta.env.BASE_URL}nexusracer_logo.png" alt="NEXUS RACER"
           onerror="this.outerHTML='&lt;div class=\'logo-text\'&gt;&lt;span&gt;NEXUS&lt;/span&gt;&lt;span&gt;RACER&lt;/span&gt;&lt;/div&gt;'">
      <div class="rule"></div>
      <div class="sub">${SHIPS.length} CRAFT · ENDLESS PROCEDURAL WORLD · TWO WAYS TO FLY</div>
      <div class="cta"><button class="btn" id="enter">Enter Hangar</button></div>
      <div class="hint">PRESS ENTER</div>
    `;
    const go = () => { this.splash.classList.add('hidden'); onEnter(); };
    this.splash.querySelector('#enter').onclick = go;
    this._splashKey = (e) => {
      if (this.splash.classList.contains('hidden')) return;
      if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); go(); }
    };
    addEventListener('keydown', this._splashKey);
  }

  // -------------------------------------------------------------- hangar ---
  showMenu(onLaunch) {
    this.splash.classList.add('hidden');
    this.menu.classList.remove('hidden');
    this.hud.classList.remove('on');
    this.onLaunch = onLaunch;
    this._renderMenu();
    this.onPreview?.(this.ship());
  }

  hideMenu() {
    this.menu.classList.add('hidden');
    this.splash.classList.add('hidden');
    this.hud.classList.add('on');
  }

  ship() { return SHIPS.find((s) => s.id === this.selectedShip); }

  setPreviewState(s) {
    this.previewState = s;
    const chip = this.menu.querySelector('.loadchip');
    const btn = this.menu.querySelector('#launch');
    if (chip) chip.style.display = s === 'loading' ? '' : 'none';
    if (btn) btn.disabled = s === 'loading';
  }

  _renderMenu() {
    const ship = this.ship();
    const st = resolveStats(ship);
    const pw = WEAPONS[ship.primary], sw = WEAPONS[ship.secondary];
    const race = this.selectedMode === 'race';

    this.menu.innerHTML = `
      <div class="topbar">
        <div class="mark">NEXUS RACER</div>
        <div class="tabs">
          <div class="tab ${race ? '' : 'sel'}" data-mode="free">Free Range</div>
          <div class="tab ${race ? 'sel' : ''}" data-mode="race">Endless Circuit</div>
        </div>
        <div class="spacer"></div>
        <div class="mode-note">${race
          ? 'Infinite gate track, five rivals, a clock that only gates can refill. Weapons are legal.'
          : 'Endless procedural world. Hunt shards and Nexus cores, fight drones, fly wherever you like.'}</div>
      </div>

      <div class="stage">
        <div class="rail">
          <h3>Hangar · ${SHIPS.length}</h3>
          ${SHIPS.map((s, i) => `
            <div class="slot ${s.id === this.selectedShip ? 'sel' : ''}" data-ship="${s.id}" style="--acc:${s.accent}">
              <div class="idx">${String(i + 1).padStart(2, '0')}</div>
              <div class="txt"><div class="nm">${s.name}</div><div class="kl">${s.klass}</div></div>
            </div>`).join('')}
        </div>

        <div class="viewport" style="--acc:${ship.accent}">
          <div class="title">
            <div class="nm">${ship.name}</div>
            <div class="kl">${ship.klass}</div>
            <div class="blurb">${ship.blurb}</div>
          </div>
          <div class="loadchip" style="display:${this.previewState === 'loading' ? '' : 'none'}">LOADING HULL</div>
          <div class="foot">
            <button class="rotbtn" data-rot="-1">◀</button>
            <div class="rotlbl">MODEL FACING</div>
            <button class="rotbtn" data-rot="1">▶</button>
            <button class="rotbtn" data-rot="0" title="Reset to auto-detected facing">⟲</button>
          </div>
        </div>

        <div class="specs" style="--acc:${ship.accent}">
          <h3>Flight Profile</h3>
          <div class="bars">
            ${STAT_ROWS.map(([k, l]) => `
              <div class="bar"><span>${l}</span>
                <div class="t"><b style="width:${ship.stats[k] * 10}%"></b></div>
                <em>${ship.stats[k].toFixed(1)}</em></div>`).join('')}
          </div>
          <h3>Armament</h3>
          <div class="wrow">
            <div><div class="k">PRIMARY</div><div class="v">${pw.name}</div></div>
            <div style="text-align:right"><div class="k">DPS≈</div>
              <div class="v">${pw.kind === 'beam' ? pw.dps : Math.round(pw.dmg * (pw.rof ?? 1) * (pw.salvo ?? 1))}</div></div>
          </div>
          <div class="wrow">
            <div><div class="k">SECONDARY</div><div class="v">${sw.name}</div></div>
            <div style="text-align:right"><div class="k">ROUNDS</div><div class="v">${ship.secondaryAmmo}</div></div>
          </div>
          <h3>Signature Ability</h3>
          <div class="abil">
            <div class="an">◈ ${ship.ability.name}</div>
            <div class="ad">${ship.ability.desc} · ${ship.ability.cd}s cooldown</div>
          </div>
          <div class="derived">
            MAX ${Math.round(st.maxSpeed)} m/s<br>
            HULL ${Math.round(st.hullMax)} · BOOST ${Math.round(st.boostMax)}<br>
            ${ship.magnet ? `MAGNET ×${ship.magnet.toFixed(1)}<br>` : ''}${ship.scoreMult ? `SCORE ×${ship.scoreMult}<br>` : ''}
          </div>
        </div>
      </div>

      <div class="dock">
        <div class="opt"><div class="lb">GOAL</div><div class="chips">
          ${GOALS.map((g) => `<div class="chip ${this.goal === g.v ? 'sel' : ''}" data-goal="${g.v}">${g.l}</div>`).join('')}
        </div></div>
        <div class="opt"><div class="lb">ASSIST</div><div class="chips">
          <div class="chip ${this.assist === 'assisted' ? 'sel' : ''}" data-assist="assisted">Assisted</div>
          <div class="chip ${this.assist === 'standard' ? 'sel' : ''}" data-assist="standard">Standard</div>
        </div></div>
        <div class="opt"><div class="lb">MOUSE</div><div class="chips">
          ${SENS.map((x) => `<div class="chip ${this.sens === x.v ? 'sel' : ''}" data-sens="${x.v}">${x.l}</div>`).join('')}
        </div></div>
        <div class="opt"><div class="lb">AUDIO</div><div class="chips">
          <div class="chip ${this.muted ? 'sel' : ''}" data-mute="1">Muted</div>
          <div class="chip ${this.muted ? '' : 'sel'}" data-mute="0">On</div>
        </div></div>
        <div class="spacer"></div>
        <div class="keys">
          <b>MOUSE</b> virtual stick — holds its bank, so lean into a turn · <b>X</b> recentre<br>
          <b>W/S</b> throttle · <b>A/D</b> roll · <b>Q/E</b> rudder · <b>SHIFT</b> boost · <b>CTRL</b> brake<br>
          <b>LMB</b> primary · <b>RMB/F</b> secondary · <b>R</b> ability · <b>C</b> camera ·
          <b>T</b> cycle target · <b>M</b> mute · <b>ESC</b> pause
        </div>
        <button class="btn" id="launch" ${this.previewState === 'loading' ? 'disabled' : ''}>Launch ▸</button>
      </div>
    `;

    const q = (sel, fn) => this.menu.querySelectorAll(sel).forEach((n) => { n.onclick = () => fn(n); });
    q('[data-mode]', (n) => { this.selectedMode = n.dataset.mode; this.onUi?.(); this._renderMenu(); });
    q('[data-goal]', (n) => { this.goal = Number(n.dataset.goal); this.onUi?.(); this._renderMenu(); });
    q('[data-assist]', (n) => { this.assist = n.dataset.assist; this.onUi?.(); this._renderMenu(); });
    q('[data-sens]', (n) => {
      this.sens = Number(n.dataset.sens);
      localStorage.setItem('nexusracer.sens', String(this.sens));
      this.onSens?.(this.sens);
      this.onUi?.();
      this._renderMenu();
    });
    q('[data-mute]', (n) => { this.muted = n.dataset.mute === '1'; this.onMuteChange?.(this.muted); this._renderMenu(); });
    q('[data-rot]', (n) => this.onRotate?.(Number(n.dataset.rot)));
    q('[data-ship]', (n) => {
      if (n.dataset.ship === this.selectedShip) return;
      this.selectedShip = n.dataset.ship;
      this.onUi?.();
      this._renderMenu();
      this.onPreview?.(this.ship());
    });
    this.menu.querySelector('#launch').onclick = () => this.onLaunch?.({
      ship: this.selectedShip, mode: this.selectedMode, assist: this.assist, goal: this.goal,
    });
  }

  // ------------------------------------------------------------- loading ---
  showLoading(text = 'SPINNING UP') {
    this.el.loading.classList.remove('hidden');
    this.el.loading.innerHTML = `<div class="lt">${text}</div><div class="lb"><b></b></div>`;
  }
  setProgress(p) {
    const b = this.el.loading.querySelector('b');
    if (b) b.style.width = `${Math.round(p * 100)}%`;
  }
  hideLoading() { this.el.loading.classList.add('hidden'); }

  // ----------------------------------------------------------------- hud ---
  setHUD(d) {
    this.el.left.innerHTML = `
      <div class="lbl">VELOCITY</div>
      <div><span class="big">${Math.round(d.speed)}</span><span class="unit">M/S</span></div>
      <div class="rowbar"><div class="lbl">BST</div><div class="gauge g-boost"><b style="width:${d.boost * 100}%"></b></div></div>
      <div class="rowbar"><div class="lbl">HEAT</div><div class="gauge g-heat"><b style="width:${d.heat * 100}%"></b></div></div>
      <div class="rowbar"><div class="lbl">HULL</div><div class="gauge g-hull ${d.hull < 0.3 ? 'low' : ''}"><b style="width:${d.hull * 100}%"></b></div></div>`;
    this.el.right.innerHTML = `
      <div class="lbl">ALTITUDE</div>
      <div><span class="big">${Math.round(d.alt)}</span><span class="unit">M</span></div>
      <div style="margin-top:8px" class="lbl">AGL ${Math.round(d.agl)}m</div>
      <div style="margin-top:6px;font-size:13px;color:#c8dcf2">${d.weaponName} ·
        <span style="color:${d.overheat ? '#ff4d3d' : '#b6ff3d'}">${d.overheat ? 'OVERHEAT' : 'READY'}</span></div>
      <div style="font-size:13px;color:#ffb347">${d.secondaryName} ×${d.ammo}</div>
      <div style="margin-top:6px;font-size:12px;color:${d.abilityReady ? '#b6ff3d' : '#5c7a9c'}">
        ◈ ${d.abilityName} ${d.abilityReady ? '[R]' : Math.ceil(d.abilityCd) + 's'}</div>`;
    this.el.score.innerHTML = `<div class="lbl">SCORE</div>
      <div><span class="big">${d.score.toLocaleString()}</span></div>
      ${d.sub ? `<div class="lbl" style="margin-top:4px">${d.sub}</div>` : ''}`;

    if (d.goal) {
      this.el.goal.style.display = '';
      this.el.goal.innerHTML = `<div class="lbl">${d.goal.label}</div>
        <div style="font-size:19px;color:#e8f4ff;margin-top:2px">${d.goal.have} / ${d.goal.need}</div>
        <div class="track"><b style="width:${Math.min(100, (d.goal.have / d.goal.need) * 100)}%"></b></div>`;
    } else this.el.goal.style.display = 'none';

    this.el.top.innerHTML = d.top ?? '';
    this.el.board.innerHTML = d.board ?? '';
    this.el.board.style.display = d.board ? '' : 'none';
  }


  /**
   * Top-down scanner. `blips` are {x, z, color, kind, size} in world space;
   * the view rotates so the nose is always up.
   */
  drawRadar({ px, pz, heading, range, blips, show = true, shifted = false, legend }) {
    this.el.radar.style.display = show ? '' : 'none';
    this.el.radar.classList.toggle('shift', shifted);
    if (!show) return;
    const ctx = this.rctx;
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const cx = W / 2, cy = H / 2, R = W / 2 - 4;
    ctx.clearRect(0, 0, W, H);

    // dish
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(6,16,34,.72)'; ctx.fill();
    ctx.clip();

    ctx.strokeStyle = 'rgba(94,242,255,.16)'; ctx.lineWidth = 1;
    for (let i = 1; i <= 3; i++) {
      ctx.beginPath(); ctx.arc(cx, cy, (R * i) / 3, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R);
    ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy);
    ctx.stroke();

    // sweep
    const sweep = (performance.now() / 1400) % 1;
    const a0 = sweep * Math.PI * 2 - Math.PI / 2;
    const grad = ctx.createConicGradient
      ? ctx.createConicGradient(a0, cx, cy)
      : null;
    if (grad) {
      grad.addColorStop(0, 'rgba(94,242,255,.22)');
      grad.addColorStop(0.12, 'rgba(94,242,255,0)');
      grad.addColorStop(1, 'rgba(94,242,255,0)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
    }

    // blips, rotated into ship-relative space
    const c = Math.cos(-heading), s = Math.sin(-heading);
    for (const b of blips) {
      const dx = b.x - px, dz = b.z - pz;
      const rx = dx * c - dz * s;
      const rz = dx * s + dz * c;
      const d = Math.hypot(rx, rz);
      const clamped = Math.min(d, range);
      const k = (clamped / range) * R;
      const ang = Math.atan2(rx, -rz);
      const bx = cx + Math.sin(ang) * k;
      const by = cy - Math.cos(ang) * k;
      const edge = d > range;
      const size = edge ? 2 : (b.size ?? 3);
      ctx.globalAlpha = edge ? 0.4 : 1;
      ctx.fillStyle = b.color;
      if (b.kind === 'gate') {
        ctx.globalAlpha = edge ? 0.4 : 0.9;
        ctx.strokeStyle = b.color; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(bx, by, size + 1.5, 0, Math.PI * 2); ctx.stroke();
      } else {
        ctx.shadowColor = b.color; ctx.shadowBlur = edge ? 0 : 7;
        ctx.beginPath(); ctx.arc(bx, by, size, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // rim + own ship
    ctx.strokeStyle = 'rgba(94,242,255,.5)'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#b6ff3d';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 6); ctx.lineTo(cx - 4.2, cy + 5); ctx.lineTo(cx + 4.2, cy + 5);
    ctx.closePath(); ctx.fill();

    this.el.radarRange.textContent = (range / 1000).toFixed(1);
    if (legend && this._legendKey !== legend.key) {
      this._legendKey = legend.key;
      this.el.radarLegend.innerHTML = legend.items
        .map(([c, l]) => `<span><i style="background:${c}"></i>${l}</span>`).join('');
    }
  }


  _sizeReticles() {
    const c = this.el.reticles;
    const dpr = Math.min(devicePixelRatio, 2);
    c.width = innerWidth * dpr;
    c.height = innerHeight * dpr;
    this.tctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /**
   * Targeting overlay: a bracket around every hostile, a hard lock ring on the
   * current target, and an edge arrow when it drifts off-screen.
   */
  drawTargets(list, show = true) {
    const ctx = this.tctx;
    const W = innerWidth, H = innerHeight;
    ctx.clearRect(0, 0, W, H);
    if (!show || !list.length) return;
    const t = performance.now() / 1000;

    for (const s of list) {
      if (s.behind) {
        if (!s.locked) continue;
        // locked target behind us: point at it from the screen edge
        const ang = Math.atan2(s.y - H / 2, s.x - W / 2) + Math.PI;
        const ex = W / 2 + Math.cos(ang) * Math.min(W, H) * 0.36;
        const ey = H / 2 + Math.sin(ang) * Math.min(W, H) * 0.36;
        ctx.save();
        ctx.translate(ex, ey);
        ctx.rotate(ang);
        ctx.fillStyle = '#ffb347';
        ctx.beginPath();
        ctx.moveTo(13, 0); ctx.lineTo(-7, 8); ctx.lineTo(-7, -8);
        ctx.closePath(); ctx.fill();
        ctx.restore();
        continue;
      }

      const r = s.r;
      const col = s.locked ? '#ff4d3d' : s.color;
      ctx.globalAlpha = s.locked ? 1 : 0.62;
      ctx.strokeStyle = col;
      ctx.lineWidth = s.locked ? 2 : 1.4;

      // corner brackets
      const arm = Math.max(7, r * 0.42);
      ctx.beginPath();
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const cx = s.x + sx * r, cy = s.y + sy * r;
        ctx.moveTo(cx - sx * arm, cy); ctx.lineTo(cx, cy);
        ctx.lineTo(cx, cy - sy * arm);
      }
      ctx.stroke();

      if (s.locked) {
        // closing ring while the lock settles, then a steady ring
        ctx.beginPath();
        const closing = 1 - s.lockT;
        ctx.arc(s.x, s.y, r * (1 + closing * 1.5), 0, Math.PI * 2);
        ctx.globalAlpha = 0.35 + 0.4 * s.lockT;
        ctx.stroke();

        if (s.lockT > 0.85) {
          ctx.globalAlpha = 0.85 + Math.sin(t * 9) * 0.15;
          ctx.beginPath();
          ctx.arc(s.x, s.y, r * 1.22, 0, Math.PI * 2);
          ctx.setLineDash([5, 6]);
          ctx.lineDashOffset = -t * 26;
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = '#ff4d3d';
          ctx.font = '600 11px ui-monospace, monospace';
          ctx.textAlign = 'center';
          ctx.fillText('LOCK', s.x, s.y - r - 14);
        }
      }

      // health pip + range
      ctx.globalAlpha = s.locked ? 0.95 : 0.5;
      if (s.hp01 < 1) {
        const bw = r * 1.5;
        ctx.fillStyle = 'rgba(0,0,0,.45)';
        ctx.fillRect(s.x - bw / 2, s.y + r + 7, bw, 3);
        ctx.fillStyle = s.hp01 > 0.4 ? '#b6ff3d' : '#ff4d3d';
        ctx.fillRect(s.x - bw / 2, s.y + r + 7, bw * s.hp01, 3);
      }
      ctx.fillStyle = col;
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${(s.dist / 1000).toFixed(1)}km${s.name ? ' · ' + s.name : ''}`,
        s.x, s.y + r + (s.hp01 < 1 ? 22 : 18));
    }
    ctx.globalAlpha = 1;
  }

  /** Move the reticle with the virtual stick so its deflection is visible. */
  setStick(x, y) {
    const reach = Math.min(innerWidth, innerHeight) * 0.19;
    this.el.cross.style.transform =
      `translate(calc(-50% + ${(x * reach).toFixed(1)}px), calc(-50% + ${(y * reach).toFixed(1)}px))`;
  }

  toast(msg, color = '#5ef2ff', ttl = 1400) {
    const n = document.createElement('div');
    n.className = 'tmsg'; n.style.color = color; n.textContent = msg;
    this.el.toast.appendChild(n);
    setTimeout(() => n.remove(), ttl);
  }

  pop(msg, color = '#b6ff3d') {
    const n = document.createElement('div');
    n.className = 'pop'; n.style.color = color;
    n.style.left = `${48 + Math.random() * 8}%`;
    n.style.top = `${52 + Math.random() * 6}%`;
    n.textContent = msg;
    this.el.pops.appendChild(n);
    setTimeout(() => n.remove(), 1100);
  }

  /** Full-screen colour flash — explosions, hits, big events. */
  flash(color = '#ffffff', strength = 0.7) {
    const d = this.el.dmg;
    d.style.transition = 'none';
    d.style.background = `radial-gradient(ellipse at center, ${color} 0%, ${color} 30%, transparent 85%)`;
    d.style.opacity = strength;
    requestAnimationFrame(() => {
      d.style.transition = 'opacity .8s';
      d.style.opacity = 0;
    });
  }

  flashDamage(amount = 1) {
    const d = this.el.dmg;
    d.style.transition = 'none';
    d.style.background = 'radial-gradient(ellipse at center,transparent 40%,rgba(255,40,40,.55) 100%)';
    d.style.opacity = Math.min(0.9, 0.25 + amount * 0.5);
    requestAnimationFrame(() => { d.style.transition = 'opacity .5s'; d.style.opacity = 0; });
  }

  showResults(rows, onAgain, onMenu) {
    const wrap = document.createElement('div');
    wrap.id = 'results';
    wrap.innerHTML = `
      <div class="rcard">
        <h3 style="padding-bottom:14px;font-size:13px;color:#5ef2ff">${rows.title}</h3>
        ${rows.lines.map((l) => `<div class="rrow"><div class="k">${l[0]}</div><div class="v ${l[2] || ''}">${l[1]}</div></div>`).join('')}
        <div style="display:flex;gap:10px;margin-top:22px">
          <button class="btn" id="again">Fly Again</button>
          <button class="btn ghost" id="tomenu">Hangar</button>
        </div>
      </div>`;
    this.root.appendChild(wrap);
    wrap.querySelector('#again').onclick = () => { wrap.remove(); onAgain(); };
    wrap.querySelector('#tomenu').onclick = () => { wrap.remove(); onMenu(); };
  }

  showPause(onResume, onMenu) {
    const wrap = document.createElement('div');
    wrap.id = 'pause';
    wrap.innerHTML = `
      <h2 style="font-size:26px;color:#5ef2ff;letter-spacing:.3em">PAUSED</h2>
      <div style="display:flex;gap:10px">
        <button class="btn" id="res">Resume</button>
        <button class="btn ghost" id="men">Hangar</button>
      </div>
      <div style="font-size:11.5px;color:#6d84a5;max-width:440px;text-align:center;line-height:1.7">
        MOUSE virtual stick (holds its bank) · X recentre · W/S throttle · A/D roll · Q/E rudder<br>
        SHIFT boost · CTRL brake<br>
        LMB primary · RMB/F secondary · R ability · T cycle target · C camera · M mute</div>`;
    this.root.appendChild(wrap);
    wrap.querySelector('#res').onclick = () => { wrap.remove(); onResume(); };
    wrap.querySelector('#men').onclick = () => { wrap.remove(); onMenu(); };
  }
}
