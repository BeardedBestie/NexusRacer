import { SHIPS, WEAPONS, resolveStats } from './ships.js';
import { IS_TOUCH, STEER } from './touch.js';
import { icon } from './icons.js';

/** The on-screen deck, spelled out with the same glyphs the buttons carry. */
const DECK_LEGEND = [
  ['throttle', 'throttle'], ['boost', 'boost'], ['brake', 'airbrake'],
  ['primary', 'primary'], ['secondary', 'secondary'], ['ability', 'ability'],
  ['lock', 'target'], ['cam', 'camera'], ['pause', 'pause'],
].map(([k, l]) => `<span class="legend">${icon(k)}${l}</span>`).join('');

const MODES = [
  { v: 'free', l: 'Open' }, { v: 'race', l: 'Ring Race' }, { v: 'chill', l: 'Chill' },
];

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
button,.chip,.tab,.slot,.navbtn{pointer-events:auto}

.scan{position:absolute;inset:0;pointer-events:none;z-index:3;
  background:repeating-linear-gradient(to bottom,rgba(94,242,255,.03) 0 1px,transparent 1px 3px);
  mix-blend-mode:screen;opacity:.55}
.vig{position:absolute;inset:0;pointer-events:none;z-index:2;
  background:radial-gradient(ellipse at center,transparent 42%,rgba(2,4,12,.7) 100%)}

/* ======================= SPLASH ======================= */
#splash{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;
  justify-content:center;gap:0;z-index:6;
  background:radial-gradient(ellipse at 50% 55%,rgba(10,20,50,.25) 0%,rgba(3,5,14,.86) 70%)}
#splash .kicker{font-size:clamp(9px,1.15vw,12px);letter-spacing:.36em;color:#5ef2ff;opacity:.78;
  margin-bottom:14px;text-align:center;max-width:92vw;line-height:1.7;
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
#splash .cta{margin-top:34px;animation:fadeUp 1s .45s ease-out both}
#splash .hint{margin-top:20px;font-size:11px;letter-spacing:.26em;color:#5b7a9c;
  animation:pulse 2.2s infinite}
#splash .credits{position:absolute;left:0;right:0;bottom:26px;text-align:center;
  animation:fadeUp 1.2s .7s ease-out both;padding:0 20px}
#splash .credits .by{font-size:13px;letter-spacing:.16em;color:#8fb0d4;margin-bottom:9px}
#splash .credits .by a{color:#b6ff3d;text-decoration:none;font-weight:700;
  border-bottom:1px solid rgba(182,255,61,.35);padding-bottom:1px;transition:.15s}
#splash .credits .by a:hover{color:#d8ffa0;border-bottom-color:#b6ff3d;
  text-shadow:0 0 14px rgba(182,255,61,.55)}
#splash .credits .stack{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;
  gap:7px;font-size:11.5px;letter-spacing:.1em}
#splash .credits .stack .lbl{color:#5b7a9c;letter-spacing:.24em;margin-right:3px}
#splash .credits .stack .sep{color:#3d5570}
#splash .credits .stack a{color:#8fb0d4;text-decoration:none;transition:.15s;
  border-bottom:1px solid transparent}
#splash .credits .stack a em{font-style:normal;color:#5b7a9c;font-size:10.5px}
#splash .credits .stack a:hover{color:#5ef2ff;border-bottom-color:rgba(94,242,255,.5);
  text-shadow:0 0 12px rgba(94,242,255,.5)}
#splash .credits a{pointer-events:auto}
@media (max-height:680px){ #splash .credits{position:static;margin-top:22px} }
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
.topbar .mark{height:clamp(34px,4.2vw,52px);width:auto;display:block;flex:0 0 auto;
  filter:drop-shadow(0 0 16px rgba(94,242,255,.4))}
.topbar .mark-text{font-size:22px;font-weight:700;letter-spacing:.16em;
  background:linear-gradient(92deg,#5ef2ff,#b6ff3d 50%,#ff4fd8);
  -webkit-background-clip:text;background-clip:text;color:transparent}
.tabs{display:flex;gap:8px}
.tab{padding:9px 20px;border:1px solid rgba(120,150,200,.22);border-radius:2px;cursor:pointer;
  font-size:12.5px;letter-spacing:.18em;color:#8fa9c8;background:rgba(8,14,32,.55);transition:.14s;
  text-transform:uppercase;font-weight:600}
.tab:hover{border-color:rgba(94,242,255,.6);color:#e8f4ff}
.tab.sel{border-color:#5ef2ff;color:#0a1a24;background:#5ef2ff;
  box-shadow:0 0 24px rgba(94,242,255,.35)}
.tab.chill.sel{border-color:#7affd6;background:#7affd6;box-shadow:0 0 24px rgba(122,255,214,.35)}
.tab.chill:hover{border-color:rgba(122,255,214,.7)}
.topbar .spacer{flex:1}
.topbar .mode-note{font-size:11.5px;color:#6d88ab;max-width:330px;line-height:1.45;text-align:right}

/* The middle column is a window onto the hangar canvas, so it must not eat
   pointer events — only the panels either side and the controls do. These need
   to out-specify the '#menu > *' rule, hence the #menu prefixes. */
.stage{display:grid;grid-template-columns:250px 1fr 296px;gap:0;min-height:0}
#menu .stage{pointer-events:none}
#menu .rail,#menu .specs{pointer-events:auto}
#menu .viewport{pointer-events:none}
#menu .viewport .foot,#menu .viewport .foot *{pointer-events:auto}
#menu .viewport .ctl{pointer-events:none}

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
  align-items:center;padding:8px 0 14px;min-height:0;cursor:grab}
.viewport .title{text-align:center;pointer-events:none;width:100%;max-width:100%;padding:0 12px}
/* Display face for hull names. Condensed grotesques first (present on most
   macOS/Windows installs), with a heavy fallback chain — deliberately a
   different voice from the UI text, not just the body font scaled up. */
.viewport .title .nm{
  font-family:"Avenir Next Condensed","HelveticaNeue-CondensedBlack",
    "Helvetica Neue Condensed","Franklin Gothic Medium Cond","Oswald",
    "Impact","Haettenschweiler","Arial Narrow",sans-serif;
  font-weight:800;font-size:clamp(24px,3.6vw,54px);line-height:.94;
  max-width:100%;overflow-wrap:normal;
  letter-spacing:.045em;text-transform:uppercase;
  transform:skewX(-5deg);
  background:linear-gradient(178deg,#ffffff 4%,#e6f4ff 34%,
    color-mix(in srgb,var(--acc) 78%,#ffffff) 76%,
    color-mix(in srgb,var(--acc) 92%,#000000) 100%);
  -webkit-background-clip:text;background-clip:text;color:transparent;
  -webkit-text-stroke:.7px color-mix(in srgb,var(--acc) 55%,transparent);
  filter:drop-shadow(0 0 26px color-mix(in srgb,var(--acc) 62%,transparent))
         drop-shadow(0 2px 0 rgba(0,0,0,.45));
  padding:0 .08em}
.viewport .title .kl{font-family:"Avenir Next Condensed","Oswald","Arial Narrow",inherit;
  font-size:12px;font-weight:600;letter-spacing:.5em;color:var(--acc);margin-top:6px;
  text-transform:uppercase;text-indent:.5em;
  text-shadow:0 0 14px color-mix(in srgb,var(--acc) 70%,transparent)}
.viewport .blurb{max-width:480px;margin:8px auto 0;font-size:12.5px;color:#8ea6c6;line-height:1.5;
  font-style:italic;text-align:center}
/* Prev/next racer. This is the primary way to change hull on a phone, where
   the rail is off-screen, so the targets stay thumb-sized at every width. */
.viewport .ctl{display:flex;flex-direction:column;align-items:center}
.viewport .foot{display:flex;align-items:center;gap:14px;
  padding:7px 9px;border:1px solid rgba(120,150,200,.24);border-radius:99px;
  /* Sits over the hull on a phone, so it needs a real ground, not a tint. */
  background:rgba(4,8,20,.84);backdrop-filter:blur(6px);
  box-shadow:0 6px 24px rgba(0,0,0,.45)}
.navbtn{width:46px;height:46px;border:1px solid color-mix(in srgb,var(--acc) 55%,transparent);
  background:color-mix(in srgb,var(--acc) 12%,rgba(8,14,32,.7));color:#e8f4ff;cursor:pointer;
  border-radius:50%;font-size:16px;line-height:1;font-family:inherit;transition:.13s;
  display:flex;align-items:center;justify-content:center;padding:0;
  -webkit-tap-highlight-color:transparent;touch-action:manipulation}
.navbtn:hover{border-color:var(--acc);background:color-mix(in srgb,var(--acc) 28%,transparent);
  box-shadow:0 0 20px color-mix(in srgb,var(--acc) 40%,transparent)}
.navbtn:active{transform:scale(.93)}
.navlbl{text-align:center;min-width:78px;pointer-events:none}
.navlbl .cnt{font-size:14px;letter-spacing:.1em;color:#7f97b8;font-family:ui-monospace,monospace}
.navlbl .cnt b{color:var(--acc);font-size:17px}
.navlbl .cap{font-size:9px;letter-spacing:.3em;color:#5b7a9c;margin-top:2px;text-transform:uppercase}
.draghint{font-size:9.5px;letter-spacing:.2em;color:#44607f;margin-top:8px}
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

/* The dock is down to two controls: the gear that opens everything else, and
   Launch. That is what buys the hull its screen back on a phone. */
.dock{display:flex;align-items:center;gap:16px;padding:12px 26px 16px;
  background:linear-gradient(0deg,rgba(4,8,20,.94),rgba(4,8,20,0));flex-wrap:wrap}
.gear{display:flex;align-items:center;gap:9px;padding:10px 16px;cursor:pointer;
  border:1px solid rgba(120,150,200,.3);border-radius:99px;background:rgba(8,14,32,.6);
  color:#9db6d6;font-family:inherit;font-size:11.5px;font-weight:600;letter-spacing:.18em;
  text-transform:uppercase;transition:.14s;-webkit-tap-highlight-color:transparent}
.gear svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.6;
  stroke-linejoin:round;flex:0 0 auto}
.gear:hover{border-color:#5ef2ff;color:#e8f4ff;background:rgba(94,242,255,.12)}
.gear:hover svg{transform:rotate(35deg)}
.gear svg{transition:transform .35s cubic-bezier(.2,.8,.2,1)}
.dockread{font-size:11px;letter-spacing:.16em;color:#5b7a9c;text-transform:uppercase}

/* Roster warm-up: a hairline at the very bottom of the hangar, gone once the
   last hull is cached. */
#menu #warm{position:absolute;left:0;right:0;bottom:0;height:2px;pointer-events:none;
  background:rgba(94,242,255,.1);transition:opacity .6s;z-index:6}
#menu #warm.done{opacity:0}
#menu #warm b{display:block;height:100%;width:0;
  background:linear-gradient(90deg,#5ef2ff,#b6ff3d);
  box-shadow:0 0 8px rgba(94,242,255,.7);transition:width .3s ease-out}

/* ==================== SETTINGS PANEL ==================== */
#settings{position:absolute;inset:0;z-index:9;display:flex;align-items:center;
  justify-content:center;padding:20px;background:rgba(3,6,16,.76);
  backdrop-filter:blur(6px);pointer-events:auto;overflow-y:auto}
.scard{width:min(430px,100%);max-height:100%;display:flex;flex-direction:column;gap:14px;
  padding:20px 22px 22px;border:1px solid rgba(94,242,255,.24);border-radius:4px;
  background:linear-gradient(160deg,rgba(20,32,64,.96),rgba(8,12,28,.98));
  box-shadow:0 24px 70px rgba(0,0,0,.6);position:relative}
.scard::before{content:'';position:absolute;top:0;left:0;width:44px;height:2px;background:#5ef2ff}
.shead{display:flex;align-items:center;justify-content:space-between;gap:12px}
.shead h3{font-size:12px;color:#5ef2ff;letter-spacing:.3em}
.sclose{width:36px;height:36px;flex:0 0 auto;border:1px solid rgba(120,150,200,.3);
  border-radius:50%;background:rgba(8,14,32,.6);color:#9db6d6;cursor:pointer;
  font-family:inherit;font-size:14px;line-height:1;transition:.13s;
  -webkit-tap-highlight-color:transparent}
.sclose:hover{border-color:#ff4fd8;color:#ffd8f4;background:rgba(255,79,216,.14)}
.sbody{display:flex;flex-direction:column;gap:13px;overflow-y:auto;min-height:0}
.sbody .opt{display:flex;flex-direction:column;align-items:stretch;gap:7px}
.sbody .opt > .lb{font-size:9px}
.sbody .chips{flex-wrap:wrap}
.sbody .keys{max-width:100%;padding-top:4px;border-top:1px solid rgba(120,150,200,.13)}
.scard .btn{width:100%;padding:13px 0}

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
.keys .ico{width:13px;height:13px;fill:currentColor;color:#9db6d6}
.keys .steerline{display:flex;align-items:center;gap:5px;flex-wrap:wrap}
.keys .deckline{display:flex;flex-wrap:wrap;gap:5px 12px;margin-top:5px}
.legend{display:inline-flex;align-items:center;gap:5px}
#pause .keys{justify-content:center}
#pause .keys .steerline,#pause .keys .deckline{justify-content:center}

/* ======================= HUD ======================= */
#hud{position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity .4s;z-index:4}
#hud.on{opacity:1}
.hcorner{position:absolute;padding:12px 14px;background:rgba(6,10,24,.42);
  border:1px solid rgba(94,242,255,.18);border-radius:3px;backdrop-filter:blur(3px);z-index:2}
#hLeft{left:22px;bottom:22px;min-width:170px}
#hRight{right:22px;bottom:22px;text-align:right}
#hTop{left:50%;top:18px;transform:translateX(-50%);text-align:center;min-width:290px}
#hScore{right:22px;top:18px;text-align:right}
#hBoard{left:22px;top:18px;min-width:190px}
#hRadar{left:22px;top:18px;padding:10px}
#hRadar.shift{top:210px}
#hRadar canvas{display:block;image-rendering:auto}
#hRadar .rlegend{display:flex;gap:9px;margin-top:7px;font-size:9px;letter-spacing:.1em;color:#6d88ab}
#hRadar .rlegend i{display:inline-block;width:6px;height:6px;border-radius:50%;margin-right:3px;
  vertical-align:middle}
#hGoal{left:50%;bottom:22px;transform:translateX(-50%);min-width:150px;text-align:center}
#hGoal .stat{justify-content:center}
#hGoal .track{height:6px;background:rgba(255,255,255,.1);border-radius:3px;overflow:hidden;margin-top:6px}
#hGoal .track b{display:block;height:100%;background:linear-gradient(90deg,#5ef2ff,#b6ff3d);transition:width .25s}

.big{font-size:30px;font-weight:700;line-height:1;color:#e8f4ff;text-shadow:0 0 16px rgba(94,242,255,.4)}
.huge{font-size:34px;font-weight:700;line-height:1;color:inherit}
.unit{font-size:11px;color:#6d88ab;letter-spacing:.2em;margin-left:5px}
.lbl{font-size:10px;letter-spacing:.22em;color:#6d88ab}

/* ---- icon-led readouts ----
   One glyph in place of a label and a unit. Sized in em so an icon tracks the
   number beside it, and coloured by currentColor so a state class tints both at
   once. */
.ico{width:1em;height:1em;fill:currentColor;flex:0 0 auto;display:block}
.stat{display:flex;align-items:center;gap:7px;color:#8fb0d4}
.stat .v{font-size:14px;font-weight:600;color:#c8dcf2;font-variant-numeric:tabular-nums}
.stat.lead{gap:9px;color:#5ef2ff}
.stat.lead .ico{width:19px;height:19px}
.stat.trail{margin-top:8px;font-size:13px;opacity:.85}
.stat .combo{font-size:15px;font-weight:700;color:#ff4fd8;
  text-shadow:0 0 12px rgba(255,79,216,.6)}
.statrow{display:flex;gap:13px;margin-top:6px;justify-content:inherit}
.statrow .stat{font-size:12px}
.statrow .stat .v{font-size:12.5px}
#hScore .statrow{justify-content:flex-end}

/* Gauge rows: icon, then bar. The icon carries the warning colour, so a low
   hull reads before the bar length has to be measured. */
.grow{display:grid;grid-template-columns:15px 1fr;gap:9px;align-items:center;margin-top:7px;
  color:#6d88ab}
.grow.warn{color:#ff4d3d}
.grow.warn .ico{animation:warnpulse 1s ease-in-out infinite}
@keyframes warnpulse{0%,100%{opacity:.55}50%{opacity:1}}
.gauge{height:7px;background:rgba(255,255,255,.09);border-radius:2px;overflow:hidden}
.gauge b{display:block;height:100%;transition:width .08s linear}
.g-boost b{background:linear-gradient(90deg,#5ef2ff,#b6ff3d)}
.g-heat b{background:linear-gradient(90deg,#ffd66b,#ff4d3d)}
.g-hull b{background:linear-gradient(90deg,#b6ff3d,#5ef2ff)}
.g-hull.low b{background:linear-gradient(90deg,#ff4d3d,#ffb347)}

/* Armament: three glyphs that say ready / spent / cooling by colour alone. */
.arms{display:flex;gap:14px;align-items:center;justify-content:flex-end}
.wchip{display:flex;align-items:center;gap:5px;font-size:15px;font-weight:700;
  font-variant-numeric:tabular-nums;transition:color .15s}
.wchip .ico{width:20px;height:20px}
.wchip.ready{color:#b6ff3d;filter:drop-shadow(0 0 7px rgba(182,255,61,.45))}
.wchip.hot{color:#ff4d3d;filter:drop-shadow(0 0 8px rgba(255,77,61,.5))}
.wchip.spent,.wchip.wait{color:#4d6884}

/* Top banner: clock, and a note line only when there is something to say. */
.clock{justify-content:center;color:#5ef2ff}
.clock .ico{width:17px;height:17px}
.clock .v{font-size:20px}
.clock.crit{color:#ff4d3d}
.clock.crit .huge{color:#ff4d3d}
.note{display:flex;align-items:center;justify-content:center;gap:6px;margin-top:4px;
  font-size:11px;letter-spacing:.14em;color:#6d88ab}
.note .ico{width:13px;height:13px}
.note.hot{color:#ff4d3d}
.rhead{margin-bottom:6px;font-size:11px}
.rhead .ico{width:14px;height:14px}
.rhead .v{font-size:11px;letter-spacing:.14em;color:#8fb0d4;font-weight:500}
#hBoard .r{display:flex;justify-content:space-between;font-size:12.5px;padding:2.5px 0;color:#93aac9}
#ui.touch #hBoard .r{font-size:11px;padding:1.5px 0;gap:10px}
#hBoard .r.me{color:#b6ff3d;font-weight:700}
#hBoard .r .p{width:20px;color:#5b7a9c}

#crosshair{position:absolute;left:50%;top:50%;width:44px;height:44px;z-index:1;
  transform:translate(-50%,-50%);will-change:transform}
#reticles{position:absolute;inset:0;width:100%;height:100%;z-index:0}
#stickwell{position:absolute;left:50%;top:50%;width:2px;height:2px}
#stickwell svg{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);overflow:visible}
#toast{position:absolute;left:50%;top:22%;transform:translateX(-50%);text-align:center;z-index:3}
#hails{position:absolute;left:50%;bottom:16%;transform:translateX(-50%);width:min(620px,80vw);
  display:flex;flex-direction:column;align-items:center;gap:8px;z-index:5;pointer-events:none}
.hail{opacity:0;animation:hailIn 9s ease-out forwards;text-align:center;
  padding:11px 20px;border-left:2px solid #7affd6;border-radius:2px;
  background:linear-gradient(90deg,rgba(122,255,214,.09),rgba(6,14,26,.34))}
.hail .who{font-size:10px;letter-spacing:.3em;color:#7affd6;margin-bottom:4px}
.hail .what{font-size:15.5px;color:#dff7ee;line-height:1.45;font-style:italic}
@keyframes hailIn{
  0%{opacity:0;transform:translateY(14px)}
  8%{opacity:1;transform:none}
  78%{opacity:1;transform:none}
  100%{opacity:0;transform:translateY(-10px)}}
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
  .stage{grid-template-columns:190px 1fr 240px}
  .viewport .blurb{display:none}
  .topbar .mode-note{display:none}
}
/* Narrow screens drop the spec sheet, then the rail, rather than clipping. */
@media (max-width:860px){
  .stage{grid-template-columns:180px 1fr}
  .specs{display:none}
}
/* Phone width: the rail is gone, so the viewport's prev/next is the only way
   through the roster — and the spec sheet folds back in underneath the hull so
   picking a racer blind is not the price of a small screen. */
@media (max-width:620px){
  .stage{grid-template-columns:1fr;grid-template-rows:minmax(150px,1fr) auto}
  .rail{display:none}
  /* The hangar canvas runs the full height behind the menu, so the spec sheet
     needs its own ground once it sits on top of the hull rather than beside it. */
  .specs{display:flex;padding:8px 14px 10px;gap:7px;max-height:32vh;
    background:linear-gradient(180deg,rgba(4,8,20,.96),rgba(5,9,22,.99));
    border-top:1px solid rgba(94,242,255,.16)}
  .specs h3{padding-top:0;font-size:9px}
  .dock{gap:10px;padding:8px 12px 12px}
  .dockread{display:none}
  .gear{padding:11px 16px}
  .chip{padding:7px 12px;font-size:11px}
  .topbar{padding:8px 12px;gap:10px}
  .topbar .mark{height:26px}
  .topbar .tabs{flex-wrap:wrap;gap:5px}
  /* Tabs are a hit target, so they keep a fingertip's height as type shrinks. */
  .tab{padding:9px 13px;font-size:11px;letter-spacing:.1em}
  .viewport{padding:4px 0 10px}
  /* The hint would otherwise land on the spec sheet's top edge; put it above
     the pill instead of below it. */
  .viewport .ctl{flex-direction:column-reverse}
  .draghint{margin:0 0 7px}
  .viewport .title .nm{font-size:clamp(22px,7.2vw,38px)}
  .viewport .title .kl{font-size:10px;letter-spacing:.34em}
  #settings{padding:12px}
  .scard{padding:16px 16px 18px;gap:12px}
}
/* Landscape on a handset: height is the scarce axis. Keep the hull big, let the
   dock scroll rather than shove the launch button off the bottom. */
@media (orientation:landscape) and (max-height:560px){
  .stage{grid-template-columns:1fr;grid-template-rows:1fr}
  .rail,.specs{display:none}
  .topbar{padding:6px 12px}
  .topbar .mark{height:30px}
  .viewport{padding:2px 0 8px}
  .viewport .title .nm{font-size:clamp(20px,4.4vw,34px)}
  .viewport .foot{gap:10px;padding:5px 7px}
  .navbtn{width:42px;height:42px}
  .dock{padding:6px 12px 10px;gap:10px}
  .dockread{display:none}
  .draghint{display:none}
  #settings{padding:10px}
  .scard{padding:14px 16px 16px;gap:10px;width:min(560px,100%)}
  .sbody{gap:10px}
  /* Two option rows abreast: the panel has to fit a 330px-tall landscape phone
     without the Done button falling off the bottom. */
  .sbody{display:grid;grid-template-columns:1fr 1fr;gap:10px 18px}
  .sbody .keys{grid-column:1/-1}
}

/* ================= ON-SCREEN CONTROLS (touch builds) =================
   The thumb deck owns the bottom corners, so the instruments move clear of it
   and everything shrinks a step. Driven by a class main.js sets, not a media
   query, because it tracks whether the deck is actually on screen. */
#ui.touch .hcorner{padding:8px 10px}
#ui.touch .big{font-size:23px}
/* Mobile keeps only what is read mid-flight. The scanner legend teaches the dot
   colours once and then costs a corner of the screen forever; altitude and the
   note line are glanceable-nice, not load-bearing. */
#ui.touch #hRadar .rlegend{display:none}
#ui.touch .stat.trail{display:none}
#ui.touch .note{display:none}
#ui.touch .arms{gap:11px}
#ui.touch .wchip{font-size:13px}
#ui.touch .wchip .ico{width:17px;height:17px}
#ui.touch .stat.lead .ico{width:16px;height:16px}
#ui.touch .statrow{gap:10px;margin-top:4px}
#ui.touch .grow{grid-template-columns:13px 1fr;gap:7px;margin-top:6px}
#ui.touch #hRadar{left:calc(12px + env(safe-area-inset-left));
  top:calc(10px + env(safe-area-inset-top));padding:8px}
#ui.touch #hRadar canvas{width:118px;height:118px}
/* Race mode: the board above the scanner is three rows on a phone, not six, so
   the scanner sits much closer than the desktop offset assumed. */
#ui.touch #hRadar.shift{top:calc(92px + env(safe-area-inset-top))}
#ui.touch #hRadar .rlegend{font-size:8px;gap:6px;margin-top:5px}
#ui.touch #hBoard{left:calc(12px + env(safe-area-inset-left));
  top:calc(10px + env(safe-area-inset-top));min-width:150px;font-size:11px}
#ui.touch #hScore{right:calc(12px + env(safe-area-inset-right));
  top:calc(10px + env(safe-area-inset-top))}
#ui.touch #hRight{right:calc(12px + env(safe-area-inset-right));bottom:auto;
  top:calc(78px + env(safe-area-inset-top));min-width:0;max-width:52vw}
#ui.touch #hGoal{bottom:auto;top:calc(96px + env(safe-area-inset-top));min-width:170px}
#ui.touch #hLeft{left:calc(12px + env(safe-area-inset-left));
  bottom:calc(204px + env(safe-area-inset-bottom));min-width:172px}
@media (orientation:portrait){
  /* The scanner legend is what makes that panel wide; wrapping it keeps the
     panel off the score readout on a 390px-wide handset. */
  #ui.touch #hRadar .rlegend{flex-wrap:wrap;max-width:126px}
  /* Portrait stacks the scanner over the altimeter, so the mission banner has to
     drop below both. */
  #ui.touch #hTop{top:calc(226px + env(safe-area-inset-top));min-width:0;max-width:92vw}
  #ui.touch #hGoal{top:calc(318px + env(safe-area-inset-top))}
  /* The key deck wraps to three rows here, so the instruments lift clear of it. */
  #ui.touch #hLeft{bottom:calc(248px + env(safe-area-inset-bottom))}
}
@media (orientation:landscape) and (max-height:560px){
  /* Tuck the instruments into the gap between the throttle rail and the key
     deck instead of stacking above the rail, which would run off the top. */
  #ui.touch #hLeft{left:calc(82px + env(safe-area-inset-left));
    bottom:calc(14px + env(safe-area-inset-bottom));min-width:0;max-width:34vw}
  #ui.touch #hRadar canvas{width:96px;height:96px}
  #ui.touch #hRadar.shift{top:calc(86px + env(safe-area-inset-top))}
}
`;

export class HUD {
  constructor(root) {
    this.root = root;
    // Everything the on-screen deck displaces is repositioned off this class.
    if (IS_TOUCH) root.classList.add('touch');
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
          <div class="stat rhead">${icon('scan')}<span class="v"><span id="rrange">6.0</span>KM</span></div>
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
        <div id="hails"></div>
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
      hails: root.querySelector('#hails'),
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
    this.steer = localStorage.getItem('nexusracer.steer') === STEER.TOUCH ? STEER.TOUCH : STEER.TILT;
    this.settingsOpen = false;
    this.preloaded = 0;
    this.previewState = 'ready';
  }

  // -------------------------------------------------------------- splash ---
  showSplash(onEnter) {
    this.splash.classList.remove('hidden');
    this.menu.classList.add('hidden');
    this.hud.classList.remove('on');
    this.hud.style.opacity = '';
    this.splash.innerHTML = `
      <div class="kicker">OC AI BUILDERS LIGHTNING HACKATHON ▸ MONDAY AUGUST 17, 2026</div>
      <img class="logo" src="${import.meta.env.BASE_URL}nexusracer_logo.png" alt="NEXUS RACER"
           onerror="this.outerHTML='&lt;div class=\'logo-text\'&gt;&lt;span&gt;NEXUS&lt;/span&gt;&lt;span&gt;RACER&lt;/span&gt;&lt;/div&gt;'">
      <div class="rule"></div>
      <div class="sub">${SHIPS.length} CRAFT · ENDLESS PROCEDURAL WORLD · THREE WAYS TO FLY</div>
      <div class="cta"><button class="btn" id="enter">Enter Hangar</button></div>
      <div class="hint">${IS_TOUCH ? 'TAP TO BEGIN' : 'PRESS ENTER'}</div>
      <div class="credits">
        <div class="by">Created by
          <a href="https://www.linkedin.com/in/beardedbestie" target="_blank" rel="noopener">Grant Walker</a>
        </div>
        <div class="stack">
          <span class="lbl">Built with</span>
          <a href="https://claude.com/claude-code" target="_blank" rel="noopener">Claude Code <em>Opus 5</em></a>
          <span class="sep">·</span>
          <a href="https://www.meshy.ai/?utm_source=workshop&amp;utm_medium=referral-program&amp;utm_content=R35HU7&amp;share_type=invite-friends" target="_blank" rel="noopener">Meshy</a>
          <span class="sep">·</span>
          <a href="https://suno.com/invite/@beardedbestie" target="_blank" rel="noopener">Suno</a>
          <span class="sep">·</span>
          <a href="https://www.midjourney.com/" target="_blank" rel="noopener">Midjourney</a>
          <span class="sep">·</span>
          <a href="https://try.elevenlabs.io/gbmvamvgnr30" target="_blank" rel="noopener">ElevenLabs</a>
        </div>
      </div>
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
    this.settingsOpen = false;
    this.splash.classList.add('hidden');
    this.menu.classList.remove('hidden');
    this.hud.classList.remove('on');
    this.hud.style.opacity = '';
    this.onLaunch = onLaunch;
    this._renderMenu();
    this.onPreview?.(this.ship());
  }

  hideMenu() {
    this.menu.classList.add('hidden');
    this.splash.classList.add('hidden');
    this.hud.classList.add('on');
    this.hud.style.opacity = this.ambience ?? 1;
  }

  ship() { return SHIPS.find((s) => s.id === this.selectedShip); }

  /** Select by id — the rail's slots and the viewport's prev/next share this. */
  pickShip(id) {
    if (id === this.selectedShip) return;
    this.selectedShip = id;
    this.onUi?.();
    this._renderMenu();
    this.onPreview?.(this.ship());
  }

  openSettings(on) {
    this.settingsOpen = on;
    this.menu.querySelector('#settings')?.classList.toggle('hidden', !on);
    this.onUi?.();
  }

  /** Force the steering mode in from outside, e.g. when tilt turns out dead. */
  setSteer(mode) {
    this.steer = mode;
    if (!this.menu.classList.contains('hidden')) this._renderMenu();
  }

  /**
   * Walk the roster by one, wrapping at both ends. This is the only way to
   * change hull once the screen is too narrow for the rail, so it must never
   * dead-end at the first or last slot.
   */
  stepShip(dir) {
    const i = SHIPS.findIndex((s) => s.id === this.selectedShip);
    const n = SHIPS.length;
    this.pickShip(SHIPS[(((i + dir) % n) + n) % n].id);
  }

  /**
   * Roster warm-up progress: a hairline across the bottom of the hangar that
   * retires itself when the last hull lands. Deliberately not a dialog — it is
   * background work the player never has to wait for.
   */
  setPreload(done, total) {
    const bar = this.menu.querySelector('#warm b');
    if (bar) bar.style.width = `${(done / total * 100).toFixed(1)}%`;
    if (done >= total) this.menu.querySelector('#warm')?.classList.add('done');
    this.preloaded = done;
  }

  setPreviewState(s) {
    this.previewState = s;
    const chip = this.menu.querySelector('.loadchip');
    const btn = this.menu.querySelector('#launch');
    if (chip) chip.style.display = s === 'loading' ? '' : 'none';
    if (btn) btn.disabled = s === 'loading';
  }

  _renderMenu() {
    // The whole menu is re-rendered on every change, so hold the ship rail's
    // scroll position — otherwise picking a hull further down snaps you back
    // to the top of the list while its model loads.
    const railScroll = this.menu.querySelector('.rail')?.scrollTop ?? 0;
    const specScroll = this.menu.querySelector('.specs')?.scrollTop ?? 0;

    const ship = this.ship();
    const shipIdx = SHIPS.findIndex((s) => s.id === ship.id);
    const st = resolveStats(ship);
    const pw = WEAPONS[ship.primary], sw = WEAPONS[ship.secondary];
    const race = this.selectedMode === 'race';

    this.menu.innerHTML = `
      <div class="topbar">
        <img class="mark" src="${import.meta.env.BASE_URL}nexusracer_logo.png" alt="NEXUS RACER"
             onerror="this.outerHTML='&lt;div class=\'mark-text\'&gt;NEXUS RACER&lt;/div&gt;'">
        <div class="tabs">
          ${MODES.map((m) => `
            <div class="tab ${m.v === 'chill' ? 'chill ' : ''}${this.selectedMode === m.v ? 'sel' : ''}"
                 data-mode="${m.v}">${m.l}</div>`).join('')}
        </div>
        <div class="spacer"></div>
        <div class="mode-note">${
          this.selectedMode === 'chill'
            ? 'No hostiles, no objectives, no clock. Other craft drift past on their own business — talk to them or don\'t. The HUD fades away as you settle in.'
            : race
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
          <div class="ctl">
            <div class="foot">
              <button class="navbtn" data-step="-1" aria-label="Previous racer">◀</button>
              <div class="navlbl">
                <div class="cnt"><b>${String(shipIdx + 1).padStart(2, '0')}</b> / ${String(SHIPS.length).padStart(2, '0')}</div>
                <div class="cap">Racer</div>
              </div>
              <button class="navbtn" data-step="1" aria-label="Next racer">▶</button>
            </div>
            <div class="draghint">Drag the hull to turn it</div>
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
        <button class="gear" id="gear" aria-label="Settings" title="Settings">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/>
            <path d="M19.4 13.6a7.6 7.6 0 0 0 0-3.2l1.9-1.4-1.9-3.3-2.2.9a7.7 7.7 0 0 0-2.8-1.6L14 2.5h-3.8l-.4 2.4a7.7 7.7 0 0 0-2.8 1.6l-2.2-.9L2.9 9l1.9 1.4a7.6 7.6 0 0 0 0 3.2L2.9 15l1.9 3.3 2.2-.9a7.7 7.7 0 0 0 2.8 1.6l.4 2.4H14l.4-2.4a7.7 7.7 0 0 0 2.8-1.6l2.2.9 1.9-3.3-1.9-1.4Z"/>
          </svg>
          <span>Settings</span>
        </button>
        <div class="dockread">${this.selectedMode === 'chill'
          ? 'No clock, no goal'
          : `${this.goal ? `${this.goal} ${this.selectedMode === 'race' ? 'gates' : 'pickups'}` : 'Endless'} · ${
              this.assist === 'assisted' ? 'Assisted' : 'Standard'}`}</div>
        <div class="spacer"></div>
        <button class="btn" id="launch" ${this.previewState === 'loading' ? 'disabled' : ''}>Launch ▸</button>
      </div>

      <div id="warm" class="${this.preloaded >= SHIPS.length ? 'done' : ''}"><b style="width:${
        ((this.preloaded ?? 0) / SHIPS.length * 100).toFixed(1)}%"></b></div>

      <div id="settings" class="${this.settingsOpen ? '' : 'hidden'}">
        <div class="scard">
          <div class="shead">
            <h3>Settings</h3>
            <button class="sclose" id="sclose" aria-label="Close settings">✕</button>
          </div>
          <div class="sbody">
            ${this.selectedMode === 'chill' ? '' : `
            <div class="opt"><div class="lb">GOAL</div><div class="chips">
              ${GOALS.map((g) => `<div class="chip ${this.goal === g.v ? 'sel' : ''}" data-goal="${g.v}">${g.l}</div>`).join('')}
            </div></div>`}
            <div class="opt"><div class="lb">ASSIST</div><div class="chips">
              <div class="chip ${this.assist === 'assisted' ? 'sel' : ''}" data-assist="assisted">Assisted</div>
              <div class="chip ${this.assist === 'standard' ? 'sel' : ''}" data-assist="standard">Standard</div>
            </div></div>
            ${IS_TOUCH ? `
            <div class="opt"><div class="lb">STEERING</div><div class="chips">
              <div class="chip ${this.steer === STEER.TILT ? 'sel' : ''}" data-steer="${STEER.TILT}">Tilt</div>
              <div class="chip ${this.steer === STEER.TOUCH ? 'sel' : ''}" data-steer="${STEER.TOUCH}">Touch</div>
            </div></div>` : ''}
            <div class="opt"><div class="lb">${IS_TOUCH ? 'SENS' : 'MOUSE'}</div><div class="chips">
              ${SENS.map((x) => `<div class="chip ${this.sens === x.v ? 'sel' : ''}" data-sens="${x.v}">${x.l}</div>`).join('')}
            </div></div>
            <div class="opt"><div class="lb">AUDIO</div><div class="chips">
              <div class="chip ${this.muted ? 'sel' : ''}" data-mute="1">Muted</div>
              <div class="chip ${this.muted ? '' : 'sel'}" data-mute="0">On</div>
            </div></div>
            <div class="keys">${IS_TOUCH ? `
              <div class="steerline"><b>${this.steer === STEER.TOUCH ? 'FINGER' : 'TILT'}</b> ${this.steer === STEER.TOUCH
                ? 'hold anywhere on the left and move around to steer'
                : `lean the handset to bank and dive — tap ${icon('gyro')} to re-zero`}</div>
              <div class="deckline">${DECK_LEGEND}</div>
            ` : `
              <b>MOUSE</b> virtual stick — holds its bank, so lean into a turn · <b>X</b> recentre<br>
              <b>W/S</b> throttle · <b>A/D</b> roll · <b>Q/E</b> rudder · <b>SHIFT</b> boost · <b>CTRL</b> brake<br>
              <b>LMB</b> primary · <b>RMB/F</b> secondary · <b>R</b> ability · <b>C</b> camera ·
              <b>T</b> cycle target · <b>M</b> mute · <b>ESC</b> pause
            `}</div>
          </div>
          <button class="btn" id="sdone">Done</button>
        </div>
      </div>
    `;

    const q = (sel, fn) => this.menu.querySelectorAll(sel).forEach((n) => { n.onclick = () => fn(n); });
    // The panel re-renders with the rest of the menu on every change, so its
    // open state lives on the instance rather than in the DOM.
    const gear = this.menu.querySelector('#gear');
    if (gear) gear.onclick = () => this.openSettings(true);
    for (const id of ['#sclose', '#sdone']) {
      const n = this.menu.querySelector(id);
      if (n) n.onclick = () => this.openSettings(false);
    }
    // Tapping the backdrop dismisses; clicks inside the card must not.
    const panel = this.menu.querySelector('#settings');
    if (panel) {
      panel.onclick = (e) => { if (e.target === panel) this.openSettings(false); };
    }
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
    q('[data-step]', (n) => this.stepShip(Number(n.dataset.step)));
    q('[data-steer]', (n) => { this.steer = n.dataset.steer; this.onSteer?.(this.steer); this._renderMenu(); });
    q('[data-ship]', (n) => this.pickShip(n.dataset.ship));
    const rail = this.menu.querySelector('.rail');
    if (rail) rail.scrollTop = railScroll;
    const specs = this.menu.querySelector('.specs');
    if (specs) specs.scrollTop = specScroll;

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
  /**
   * The whole instrument set is icon-led: a glyph replaces every label and unit,
   * which is what lets four panels of stacked text collapse into readouts a
   * glance can take in at speed. Weapon *names* are gone from the HUD entirely —
   * they are fixed by the hull you picked, so they cost pixels every frame to
   * tell you something you already know. They survive as tooltips on desktop.
   */
  setHUD(d) {
    this.el.left.innerHTML = `
      <div class="stat lead">${icon('speed')}<span class="big">${Math.round(d.speed)}</span></div>
      <div class="grow">${icon('boost')}<div class="gauge g-boost"><b style="width:${d.boost * 100}%"></b></div></div>
      <div class="grow ${d.heat > 0.82 ? 'warn' : ''}">${icon('heat')}<div class="gauge g-heat"><b style="width:${d.heat * 100}%"></b></div></div>
      <div class="grow ${d.hull < 0.3 ? 'warn' : ''}">${icon('hull')}<div class="gauge g-hull ${d.hull < 0.3 ? 'low' : ''}"><b style="width:${d.hull * 100}%"></b></div></div>
      <div class="stat trail">${icon('alt')}<span class="v">${Math.round(d.alt)}</span></div>`;

    this.el.right.innerHTML = `
      <div class="arms">
        <div class="wchip ${d.overheat ? 'hot' : 'ready'}" title="${d.weaponName}">${icon('primary')}</div>
        <div class="wchip ${d.ammo ? 'ready' : 'spent'}" title="${d.secondaryName}">${icon('secondary')}<span>${d.ammo}</span></div>
        <div class="wchip ${d.abilityReady ? 'ready' : 'wait'}" title="${d.abilityName}">${icon('ability')}${
          d.abilityReady ? '' : `<span>${Math.ceil(d.abilityCd)}</span>`}</div>
      </div>`;

    this.el.score.innerHTML = `
      <div class="stat lead">${icon('score')}<span class="big">${d.score.toLocaleString()}</span>${
        d.combo > 2 ? `<span class="combo">×${d.combo}</span>` : ''}</div>
      ${d.stats?.length ? `<div class="statrow">${d.stats.map(([k, v]) =>
        `<span class="stat">${icon(k)}<span class="v">${v}</span></span>`).join('')}</div>` : ''}`;

    if (d.goal) {
      this.el.goal.style.display = '';
      this.el.goal.innerHTML = `
        <div class="stat">${icon(d.goal.icon)}<span class="v">${d.goal.have} / ${d.goal.need}</span></div>
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

    // Chrome (dish, rings, sweep, rim) can fade out independently of the
    // contacts, so Chill mode can strip the instrument and keep the dots.
    const chrome = this.chromeAlpha ?? 1;
    const contact = this.keepScanner ? Math.max(0.55, chrome) : 1;

    ctx.save();
    ctx.globalAlpha = chrome;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(6,16,34,${0.72 * chrome})`; ctx.fill();
    ctx.clip();

    ctx.globalAlpha = chrome;
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
      grad.addColorStop(0, `rgba(94,242,255,${0.22 * chrome})`);
      grad.addColorStop(0.12, 'rgba(94,242,255,0)');
      grad.addColorStop(1, 'rgba(94,242,255,0)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
    }

    // blips, rotated into ship-relative space
    ctx.globalAlpha = 1;
    const c = Math.cos(-heading), s = Math.sin(-heading);
    for (const b of blips) {
      const dx = b.x - px, dz = b.z - pz;
      const rx = dx * c - dz * s;
      const rz = dx * s + dz * c;
      const d = Math.hypot(rx, rz);
      const clamped = Math.min(d, range);
      const k = clamped / range;                       // 0 at the ship, 1 at the rim
      const kr = k * R;
      const ang = Math.atan2(rx, -rz);
      const bx = cx + Math.sin(ang) * kr;
      const by = cy - Math.cos(ang) * kr;

      // Distance read-off: a blip starts as a solid dot and hollows out into a
      // ring as it approaches the rim, so nothing ever vanishes off the edge.
      const e = Math.max(0, Math.min(1, (k - 0.35) / 0.65));
      const edge = e * e * (3 - 2 * e);                // smoothstep
      const fade = (1 - 0.55 * edge) * contact;
      const size = b.size ?? 3;

      ctx.strokeStyle = b.color;
      ctx.fillStyle = b.color;

      if (b.kind === 'gate' || b.kind === 'site') {
        ctx.globalAlpha = fade * 0.9;
        ctx.lineWidth = b.kind === 'site' ? 2 : 1.6;
        ctx.beginPath();
        ctx.arc(bx, by, size + 1.5, 0, Math.PI * 2);
        ctx.stroke();
        if (b.kind === 'site' && edge < 0.9) {
          ctx.globalAlpha = fade * (1 - edge) * 0.6;
          ctx.beginPath();
          ctx.arc(bx, by, size * 0.42, 0, Math.PI * 2);
          ctx.fill();
        }
        continue;
      }

      // solid core, fading out toward the rim
      if (edge < 1) {
        ctx.globalAlpha = fade * (1 - edge);
        ctx.shadowColor = b.color;
        ctx.shadowBlur = 7 * (1 - edge);
        ctx.beginPath();
        ctx.arc(bx, by, size, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      // outline, fading in as the core fades out
      if (edge > 0) {
        ctx.globalAlpha = fade * Math.max(edge, 0.25);
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(bx, by, size * (1 + 0.15 * edge), 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // rim + own ship
    ctx.globalAlpha = chrome;
    ctx.strokeStyle = 'rgba(94,242,255,.5)'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = contact;
    ctx.fillStyle = '#b6ff3d';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 6); ctx.lineTo(cx - 4.2, cy + 5); ctx.lineTo(cx + 4.2, cy + 5);
    ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;

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

      // Chill mode: no brackets, no lock, no threat read — just how far away
      // the other pilot is, in a calm blue.
      if (s.quiet) {
        // ghosts out alongside the scanner dots, never all the way to nothing
        ctx.globalAlpha = 0.75 * Math.max(0.4, this.chromeAlpha ?? 1);
        ctx.fillStyle = col;
        ctx.font = '11px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${(s.dist / 1000).toFixed(1)}km`, s.x, s.y + r + 16);
        ctx.globalAlpha = 1;
        continue;
      }
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
      // A phone screen cannot carry a name and a range under every contact — at
      // race speeds five of them stack into one illegible smear over the ship.
      // Brackets still mark all of them; only the lock gets words.
      if (!IS_TOUCH || s.locked) {
        ctx.fillStyle = col;
        ctx.font = '10px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${(s.dist / 1000).toFixed(1)}km${s.name ? ' · ' + s.name : ''}`,
          s.x, s.y + r + (s.hp01 < 1 ? 22 : 18));
      }
    }
    ctx.globalAlpha = 1;
  }

  /**
   * Global HUD presence, 1 to 0. Chill mode eases this toward a 5% ghost over
   * five minutes so the instruments get out of the way of the view.
   */
  setAmbience(a, keepScanner = false) {
    this.ambience = a;
    this.keepScanner = keepScanner;
    if (!this.hud.classList.contains('on')) { this.hud.style.opacity = ''; return; }

    if (!keepScanner) {
      this.hud.style.opacity = a;
      this.chromeAlpha = 1;
      return;
    }

    // Chill mode: the instruments dissolve completely, but the scanner's dots
    // stay — all you are left with is where you are relative to everyone else.
    this.hud.style.opacity = 1;
    this.chromeAlpha = a;
    for (const el of [this.el.left, this.el.right, this.el.score, this.el.top,
                      this.el.board, this.el.goal, this.el.cross]) {
      if (el) el.style.opacity = a;
    }
    const r = this.el.radar;
    r.style.background = `rgba(6,10,24,${(0.42 * a).toFixed(3)})`;
    r.style.borderColor = `rgba(94,242,255,${(0.18 * a).toFixed(3)})`;
    r.style.backdropFilter = a > 0.2 ? 'blur(3px)' : 'none';
    for (const el of r.querySelectorAll('.lbl, .rlegend')) el.style.opacity = a;
  }

  /** Move the reticle with the virtual stick so its deflection is visible. */
  setStick(x, y) {
    const reach = Math.min(innerWidth, innerHeight) * 0.19;
    this.el.cross.style.transform =
      `translate(calc(-50% + ${(x * reach).toFixed(1)}px), calc(-50% + ${(y * reach).toFixed(1)}px))`;
  }

  /** A passing pilot says hello. Stays legible even once the HUD has faded. */
  hail(who, what) {
    const n = document.createElement('div');
    n.className = 'hail';
    n.innerHTML = `<div class="who">${who}</div><div class="what">${what}</div>`;
    this.el.hails.appendChild(n);
    while (this.el.hails.children.length > 3) this.el.hails.firstChild.remove();
    setTimeout(() => n.remove(), 9200);
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
      <div class="keys" style="max-width:460px;text-align:center;margin:0 auto">${IS_TOUCH ? `
        <div class="steerline">${this.steer === STEER.TOUCH
          ? 'Hold anywhere on the left of the glass and move around to steer'
          : `Lean the handset to bank and dive · ${icon('gyro')} re-zeroes it`}</div>
        <div class="deckline">${DECK_LEGEND}</div>` : `
        MOUSE virtual stick (holds its bank) · X recentre · W/S throttle · A/D roll · Q/E rudder<br>
        SHIFT boost · CTRL brake<br>
        LMB primary · RMB/F secondary · R ability · T cycle target · C camera · M mute`}</div>`;
    this.root.appendChild(wrap);
    wrap.querySelector('#res').onclick = () => { wrap.remove(); onResume(); };
    wrap.querySelector('#men').onclick = () => { wrap.remove(); onMenu(); };
  }
}
