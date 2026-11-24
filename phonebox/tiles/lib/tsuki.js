/* ツキ (Tsuki) rig. Shared by tiles/mascot.html and tiles/idle.html: apply.py inlines this file where a tile says
 * __INCLUDE_TSUKI__ (tiles are sandboxed srcdoc iframes, so they cannot load scripts of their own).
 *
 * Tsuki.create(g, opts) draws her into an SVG <g> (character coordinates: 200 x 250, face centred at 100,122) and
 * returns a rig:
 *   rig.mood('shy')            face preset: eyes, mouth, brows, blush, effects, gaze, head tilt (see MOODS)
 *   rig.face({e, m, b, bl, fx}) set single slots; rig.look(dx, dy) moves the irises (clamped, clipped to the eye)
 *   rig.pose('hold' | {...})   arms: each arm is a tube shoulder -> elbow -> hand, so a pose is just 2 x 2 points
 *   rig.props([...])           held props follow a hand ({k, at: 'R'}), loose props sit at {x, y}
 *   rig.tilt(deg, dx, dy)      head (and twin tails) transform; rig.acc('cap glasses'); rig.outfit('pj')
 *   rig.blink()                one stepped blink (two repaints), only when the eyes are open
 * Every change is a class / attribute swap: no transitions and no endless animation here, so the caller decides
 * how often the phone repaints (the Redmi A5 WebView needs ~20 ms per frame; see README, "Smoothness").
 */
var Tsuki = (function () {
  var NS = 'http://www.w3.org/2000/svg', uid = 0;

  // ---- which drawn parts each slot value shows -------------------------------------------------------------------
  var EYES = {
    open: 'eoL eoR eiL eiR elL elR', half: 'eoL eoR eiL eiR elid', small: 'eoL eoR esL esR elL elR',
    sparkle: 'eoL eoR epL epR elL elR', heart: 'eoL eoR ehL ehR elL elR', happy: 'ehap', sleep: 'eslp', closed: 'eclo',
    tight: 'etight', spiral: 'eoL eoR ewL ewR elL elR', teary: 'eoL eoR eiL eiR elL elR etear', cry: 'etight ecry',
    wink: 'eoL eiL elL ewink', dot: 'edot', down: 'eoL eoR eiL eiR elid2'
  };
  var MOUTHS = ['fang', 'smile', 'open', 'shout', 'frown', 'o', 'flat', 'wavy', 'cat', 'pout', 'chew', 'chew2', 'yawn',
                'tongue', 'grit', 'wail', 'sleepo'];
  var BROWS = ['n', 'a', 'w', 'r'];
  var FX = ['anger', 'sweat', 'spark', 'hearts', 'gloom', 'q', 'ex', 'lines', 'notes', 'notes2', 'zzz', 'zzz2', 'bubble',
            'bubble2', 'steam', 'dots', 'puff', 'tearpop'];

  // ---- moods: e(yes) m(outh) b(rows) bl(ush 0-2) fx look tilt ----------------------------------------------------
  var MOODS = {
    normal:     { e: 'open', m: 'fang', b: 'n', bl: 1 },
    tsun:       { e: 'half', m: 'pout', b: 'a', bl: 1, look: [5, 1], tilt: 5 },
    angry:      { e: 'open', m: 'shout', b: 'a', bl: 1, fx: 'anger' },
    rage:       { e: 'tight', m: 'shout', b: 'a', bl: 2, fx: 'anger steam' },
    shy:        { e: 'open', m: 'wavy', b: 'w', bl: 2, look: [-4, 4], tilt: -6, fx: 'sweat' },
    flustered:  { e: 'spiral', m: 'wavy', b: 'w', bl: 2, fx: 'sweat lines' },
    happy:      { e: 'happy', m: 'open', b: 'n', bl: 1, fx: 'spark' },
    love:       { e: 'heart', m: 'smile', b: 'w', bl: 2, fx: 'hearts', tilt: -4 },
    smug:       { e: 'half', m: 'cat', b: 'n', bl: 0, tilt: 5 },
    surprised:  { e: 'small', m: 'o', b: 'r', bl: 0, fx: 'ex lines' },
    sad:        { e: 'teary', m: 'frown', b: 'w', bl: 0, fx: 'gloom', look: [0, 3] },
    cry:        { e: 'cry', m: 'wail', b: 'w', bl: 1 },
    sleepy:     { e: 'down', m: 'flat', b: 'w', bl: 0, tilt: -5 },
    yawn:       { e: 'tight', m: 'yawn', b: 'w', bl: 0, fx: 'tearpop' },
    sleep:      { e: 'sleep', m: 'sleepo', b: 'n', bl: 1, fx: 'zzz bubble', tilt: -9 },
    pout:       { e: 'open', m: 'pout', b: 'a', bl: 2, fx: 'puff' },
    wink:       { e: 'wink', m: 'tongue', b: 'n', bl: 1, fx: 'spark' },
    eat:        { e: 'happy', m: 'chew', b: 'n', bl: 1 },
    think:      { e: 'open', m: 'flat', b: 'r', bl: 0, fx: 'q', look: [4, -5], tilt: 4 },
    determined: { e: 'sparkle', m: 'grit', b: 'a', bl: 0, fx: 'spark' },
    bored:      { e: 'dot', m: 'flat', b: 'n', bl: 0, fx: 'dots' },
    pat:        { e: 'happy', m: 'smile', b: 'w', bl: 2, fx: 'hearts', tilt: -7 },
    laugh:      { e: 'tight', m: 'open', b: 'w', bl: 2, fx: 'spark' },
    shock:      { e: 'small', m: 'wail', b: 'w', bl: 0, fx: 'gloom sweat' },
    read:       { e: 'down', m: 'fang', b: 'n', bl: 1 },
    focus:      { e: 'down', m: 'flat', b: 'a', bl: 0 }
  };

  // ---- poses: arms as [elbowX, elbowY, handX, handY, hand] per side ------------------------------------------------
  var SHOULDER = { L: [64, 195], R: [136, 195] };
  var POSES = {
    cross:  { L: [50, 230, 122, 226, 'none'], R: [150, 228, 80, 218, 'none'], order: 'RL' },
    hips:   { L: [38, 216, 62, 244, 'fist'], R: [162, 216, 138, 244, 'fist'] },
    wave:   { L: [54, 232, 82, 240, 'fist'], R: [166, 178, 160, 138, 'open'] },
    wave2:  { L: [54, 232, 82, 240, 'fist'], R: [168, 180, 170, 140, 'open'] },
    peace:  { L: [40, 218, 62, 244, 'fist'], R: [158, 196, 140, 158, 'v'] },
    point:  { L: [40, 218, 62, 244, 'fist'], R: [156, 222, 120, 204, 'point'] },
    cover:  { L: [44, 212, 66, 152, 'open'], R: [156, 212, 134, 152, 'open'] },
    fists:  { L: [46, 226, 74, 204, 'fist'], R: [154, 226, 126, 204, 'fist'] },
    fists2: { L: [46, 222, 72, 196, 'fist'], R: [154, 222, 128, 196, 'fist'] },
    hold:   { L: [52, 230, 90, 214, 'fist'], R: [148, 230, 110, 214, 'fist'] },
    offer:  { L: [50, 226, 88, 206, 'fist'], R: [150, 226, 112, 206, 'fist'] },
    shy:    { L: [52, 232, 95, 214, 'point'], R: [148, 232, 105, 214, 'point'], fingers: true },
    yawn:   { L: [50, 230, 122, 226, 'none'], R: [158, 210, 112, 164, 'open'], order: 'LR' },
    up:     { L: [34, 140, 62, 42, 'open'], R: [166, 140, 138, 42, 'open'], back: true },
    think:  { L: [50, 230, 124, 228, 'none'], R: [150, 226, 108, 170, 'fist'], order: 'LR' },
    heart:  { L: [48, 222, 92, 200, 'open'], R: [152, 222, 108, 200, 'open'], heart: true },
    rest:   { L: [46, 232, 76, 246, 'fist'], R: [154, 232, 124, 246, 'fist'] }
  };

  // ---- props (local coordinates; a held prop has the hand at 0,0) --------------------------------------------------
  var HEART = 'M0 7s-7-4.4-9.3-8.6C-11 -4.6-9.4-8-6-8c2 0 3.3 1.1 4 2.3.4.7 1.6.7 2 0C.7-6.9 2-8 4-8c3.4 0 5 3.4 3.3 6.4C5 2.6 0 7 0 7z';
  var PROPS = {
    strawberry: '<g transform="translate(0 -10)"><path class="ln" d="M0 -8C9 -8 11 0 6 7 3 11 -3 11 -6 7 -11 0 -9 -8 0 -8Z"/>' +
      '<path class="wh" d="M-3 -3h1.6v1.6h-1.6zM3 -2h1.6v1.6h-1.6zM0 3h1.6v1.6h-1.6zM-4 3h1.6v1.6h-1.6zM4 4h1.6v1.6h-1.6z"/>' +
      '<path class="st" d="M-6 -9l6 3 6 -3M0 -6v-6"/></g>',
    onigiri: '<g transform="translate(0 -11)"><path class="whs" d="M0 -11C5 -11 14 4 12 8 10 12 -10 12 -12 8 -14 4 -5 -11 0 -11Z"/>' +
      '<rect class="ln" x="-6" y="1" width="12" height="10" rx="1.5"/></g>',
    pudding: '<g transform="translate(0 -12)"><ellipse class="ln" cx="0" cy="11" rx="14" ry="3.5"/><path class="whs" d="M-8 -5h16l3 15h-22z"/>' +
      '<path class="ln" d="M-8 -5C-7 -10 7 -10 8 -5Z"/><circle class="wh" cx="3" cy="-11" r="2.2"/></g>',
    tea: '<g transform="translate(2 -9)"><path class="ln" d="M-8 -7h16v9a6 6 0 0 1 -6 6h-4a6 6 0 0 1 -6 -6z"/>' +
      '<path class="st" d="M8 -4c5 0 5 7 0 7"/><path class="st" style="stroke-width:1.2;stroke-opacity:.5" d="M-5 -3h10"/>' +
      '<g class="steam"><path class="st" style="stroke-width:1.4;stroke-opacity:.7" d="M-3 -11c-2 -3 2 -5 0 -8M3 -11c-2 -3 2 -5 0 -8"/></g></g>',
    chocolate: '<g transform="translate(0 -10) rotate(-12)"><rect class="ln" x="-9" y="-12" width="18" height="24" rx="2"/>' +
      '<path class="st" style="stroke-width:1.2" d="M-9 -4h18M-9 4h18M0 -12v24"/><path class="whs" d="M-9 4h18v8h-18z"/></g>',
    pepper: '<g transform="translate(0 -11)"><path class="ln" d="M-8 -6C-14 0 -10 12 -3 11 0 13 3 13 5 11 12 11 13 0 8 -6 4 -9 -4 -9 -8 -6Z"/>' +
      '<path class="st" d="M0 -8c0 -3 2 -5 5 -5M-3 -2c-1 4 -1 8 1 11"/></g>',
    flower: '<g transform="translate(0 -14)"><path class="st" d="M0 2v20M0 14c4 -4 8 -4 9 -2"/>' +
      '<circle class="whs" cx="0" cy="-6" r="4.5"/><circle class="whs" cx="6" cy="-1" r="4.5"/><circle class="whs" cx="4" cy="5" r="4.5"/>' +
      '<circle class="whs" cx="-4" cy="5" r="4.5"/><circle class="whs" cx="-6" cy="-1" r="4.5"/><circle class="ln" cx="0" cy="0.5" r="3"/></g>',
    gift: '<g transform="translate(0 -12)"><rect class="ln" x="-11" y="-7" width="22" height="18" rx="2"/><path class="whs" d="M-2 -7h4v18h-4zM-11 0h22v3h-22z"/>' +
      '<path class="whs" d="M0 -7C-4 -15 -12 -12 -7 -7ZM0 -7C4 -15 12 -12 7 -7Z"/></g>',
    bunny: '<g transform="translate(0 -14)"><path class="ln" d="M-6 -6C-9 -22 -3 -24 -2 -8M6 -6C9 -22 3 -24 2 -8"/>' +
      '<circle class="ln" cx="0" cy="2" r="10"/><circle class="wh" cx="-3.5" cy="1" r="1.4"/><circle class="wh" cx="3.5" cy="1" r="1.4"/>' +
      '<path class="st" style="stroke-width:1.3" d="M-1.5 5q1.5 1.5 3 0"/></g>',
    manga: '<g transform="translate(0 -12) rotate(-8)"><rect class="ln" x="-10" y="-13" width="20" height="26" rx="1.5"/>' +
      '<path class="whs" d="M-10 -13h4v26h-4z"/><text class="jp" x="2" y="2" text-anchor="middle" font-size="6.5" style="fill:var(--tk-line)">マンガ</text></g>',
    letter: '<g transform="translate(0 -10) rotate(-6)"><rect class="whs" x="-13" y="-9" width="26" height="18" rx="1.5"/>' +
      '<path class="sti" d="M-13 -9l13 10 13 -10"/><path class="ln" transform="translate(0 2) scale(.55)" d="' + HEART + '"/></g>',
    rock: '<g transform="translate(0 -8)"><path class="ln" d="M-10 4C-12 -2 -6 -8 0 -8 7 -8 11 -3 10 3 9 7 -8 8 -10 4Z"/>' +
      '<path class="st" style="stroke-width:1.1;stroke-opacity:.6" d="M-4 -3l3 2M3 -4l2 3"/></g>',
    // ---- activity props --------------------------------------------------------------------------------------------
    book: '<g><path class="whs" d="M-28 -2C-18 -6 -6 -6 0 -1 6 -6 18 -6 28 -2V-30C18 -34 6 -34 0 -29 -6 -34 -18 -34 -28 -30Z"/>' +
      '<path class="sti" style="stroke-width:1;stroke-opacity:.55" d="M-23 -26h17M-23 -21h17M-23 -16h13M-23 -11h16M5 -26h17M5 -21h17M5 -16h11M5 -11h17"/>' +
      '<path class="sti" d="M0 -29V-1"/></g>',
    bookflip: '<g><path class="whs" d="M-28 -2C-18 -6 -6 -6 0 -1 6 -6 18 -6 28 -2V-30C18 -34 6 -34 0 -29 -6 -34 -18 -34 -28 -30Z"/>' +
      '<path class="whs" d="M0 -29C6 -40 16 -44 22 -40 16 -30 8 -12 0 -1Z"/>' +
      '<path class="sti" style="stroke-width:1;stroke-opacity:.55" d="M-23 -26h17M-23 -21h17M-23 -16h13M-23 -11h16"/></g>',
    cup: '<g transform="translate(0 -6)"><path class="ln" d="M-7 -8h14v9a6 6 0 0 1 -6 6h-2a6 6 0 0 1 -6 -6z"/><path class="st" d="M7 -5c5 0 5 7 0 7"/></g>',
    steam1: '<path class="st" style="stroke-width:1.4;stroke-opacity:.75" d="M-3 -18c-3 -3 3 -6 0 -10M3 -17c-3 -3 3 -6 0 -10"/>',
    steam2: '<path class="st" style="stroke-width:1.4;stroke-opacity:.75" d="M-3 -18c3 -3 -3 -6 0 -10M3 -17c3 -3 -3 -6 0 -10"/>',
    console: '<g><rect class="ln" x="-26" y="-14" width="52" height="24" rx="10"/><rect class="whs" x="-11" y="-10" width="22" height="15" rx="2"/>' +
      '<path class="st" style="stroke-width:2.2" d="M-21 -2h7M-17.5 -5.5v7"/><circle class="wh" cx="17" cy="-4" r="2"/><circle class="wh" cx="21" cy="0" r="2"/>' +
      '<path class="sti" style="stroke-width:1.2" d="M-7 0l3 -3 3 2 4 -4"/></g>',
    phone: '<g><rect class="ln" x="-7" y="-13" width="14" height="24" rx="3"/><rect class="whs" x="-5" y="-10" width="10" height="17" rx="1"/>' +
      '<path class="sti" style="stroke-width:1" d="M-3 -7h6M-3 -4h4M-3 -1h6M-3 2h3"/></g>',
    pen: '<path class="whs" d="M0 0L-4 -22 -1 -23 3 -1Z"/>',
    sketch: '<g><path class="whs" d="M-30 -4L24 -10 30 8 -24 14Z"/><path class="sti" style="stroke-width:1.1" d="M-14 2c4 -6 10 -6 12 0M-12 6c3 2 7 2 9 0"/>' +
      '<circle class="sti" style="stroke-width:1.1" cx="-8" cy="1" r="9"/></g>',
    doodle: '<g><rect class="whs" x="-26" y="-34" width="52" height="38" rx="2"/>' +
      '<circle class="sti" style="stroke-width:1.3" cx="0" cy="-17" r="10"/><path class="sti" style="stroke-width:1.3" d="M-4 -19h.1M4 -19h.1M-3 -13q3 2 6 0M-14 -2c2 -6 26 -6 28 0"/>' +
      '<path class="ink" transform="translate(16 -28) scale(.35)" d="' + HEART + '"/></g>',
    laptop: '<g><path class="ln" d="M-30 0L-26 -34H26L30 0Z"/><text class="jp" x="0" y="-14" text-anchor="middle" font-size="11" style="fill:var(--tk-line)">月</text>' +
      '<rect class="ln" x="-36" y="0" width="72" height="5" rx="2"/></g>',
    plant: '<g><path class="ln" d="M-11 0h22l-3 16h-16z"/><path class="ln" d="M0 0C-2 -10 -14 -16 -18 -10 -12 -9 -6 -6 0 0ZM0 0C2 -12 12 -22 18 -16 12 -12 6 -8 0 0ZM0 0C0 -10 -4 -20 0 -26 4 -20 1 -10 0 0Z"/></g>',
    can: '<g><path class="ln" d="M-12 -10h20v18h-20z"/><path class="st" d="M8 -6L24 -18M-12 -6c-7 0 -7 10 0 10"/><circle class="wh" cx="24" cy="-18" r="2"/></g>',
    drops: '<path class="wh" d="M0 0l1.5 3a1.5 1.5 0 1 1 -3 0z M6 7l1.5 3a1.5 1.5 0 1 1 -3 0z M-5 9l1.5 3a1.5 1.5 0 1 1 -3 0z"/>',
    needles: '<g><path class="whs" d="M-16 -16L10 4 12 2 -14 -18Z M16 -16L-10 4 -12 2 14 -18Z"/><circle class="wh" cx="-15" cy="-17" r="2.4"/><circle class="wh" cx="15" cy="-17" r="2.4"/></g>',
    scarf: '<g><path class="ln" d="M-12 0h24v30h-24z"/><path class="st" style="stroke-width:1.1;stroke-opacity:.6" d="M-12 6h24M-12 12h24M-12 18h24M-12 24h24"/></g>',
    notebook: '<g><path class="whs" d="M-30 -2L26 -8 30 10 -26 16Z"/><path class="sti" style="stroke-width:1;stroke-opacity:.5" d="M-22 2l42 -5M-21 7l42 -5M-20 12l30 -3"/></g>',
    brush: '<g><rect class="ln" x="-3" y="-2" width="6" height="16" rx="3"/><path class="whs" d="M-7 -14h14v12h-14z"/><path class="sti" style="stroke-width:1" d="M-4 -14v-3M0 -14v-3M4 -14v-3"/></g>',
    cat: '<g><path class="ln" d="M-18 0C-20 -14 -14 -22 -14 -22L-8 -16C-4 -18 4 -18 8 -16L14 -22C14 -22 20 -14 18 0Z"/>' +
      '<path class="ln" d="M-18 0C-22 8 -14 12 0 12 14 12 22 8 18 0Z"/><path class="st" d="M18 6c8 -2 10 -10 6 -14"/>' +
      '<g class="cat-open"><circle class="wh" cx="-6" cy="-8" r="2"/><circle class="wh" cx="6" cy="-8" r="2"/></g>' +
      '<path class="st cat-closed" style="stroke-width:1.5" d="M-9 -8q3 -3 6 0M3 -8q3 -3 6 0"/>' +
      '<path class="st" style="stroke-width:1.2" d="M-2 -4l2 1.5 2 -1.5M-14 -5h-7M-14 -2h-7M14 -5h7M14 -2h7"/></g>',
    lamp: '<g><path class="ln" d="M-12 0h24l-4 -4h-16z"/><path class="st" d="M0 -4L-8 -30 10 -46"/><path class="ln" d="M4 -50L20 -40 12 -30 0 -42Z"/></g>',
    pillow: '<g><path class="ln" d="M-52 -12C-54 -22 -44 -26 -34 -24H34C44 -26 54 -22 52 -12V12C54 22 44 26 34 24H-34C-44 26 -54 22 -52 12Z"/>' +
      '<path class="st" style="stroke-width:1.1;stroke-opacity:.5" d="M-40 -16Q0 -10 40 -16M-38 18Q0 12 38 18"/>' +
      '<text class="jp" x="0" y="5" text-anchor="middle" font-size="11" style="fill:var(--tk-line);opacity:.6">月</text></g>',
    plush: '<g><path class="ln" d="M-8 -16C-13 -36 -4 -38 -2 -18M8 -16C13 -36 4 -38 2 -18"/><circle class="ln" cx="0" cy="-6" r="13"/>' +
      '<path class="ln" d="M-12 4C-16 22 16 22 12 4Z"/><path class="st" style="stroke-width:1.4" d="M-6 -7q2 -2 4 0M2 -7q2 -2 4 0M-1.5 -1q1.5 1.5 3 0"/></g>',
    mug: '<g><path class="ln" d="M-7 -14h14v14h-14z"/><path class="st" d="M7 -10c5 0 5 7 0 7"/><text class="jp" x="0" y="-4" text-anchor="middle" font-size="6.5" style="fill:var(--tk-line)">月</text></g>',
    books: '<g><rect class="ln" x="-16" y="-8" width="32" height="8" rx="1"/><rect class="whs" x="-14" y="-15" width="28" height="7" rx="1"/><rect class="ln" x="-12" y="-22" width="26" height="7" rx="1"/></g>',
    headphones: '' // drawn as an accessory (acc-phones)
  };

  // ---- the drawing -------------------------------------------------------------------------------------------------
  function headSVG(p) {
    var lash = 'style="stroke-width:3.4"';
    return '' +
      '<clipPath id="' + p + 'cL"><ellipse cx="79" cy="128" rx="11.5" ry="13.5"/></clipPath>' +
      '<clipPath id="' + p + 'cR"><ellipse cx="121" cy="128" rx="11.5" ry="13.5"/></clipPath>' +
      '<path class="ln" d="M44 120C38 60 70 34 100 34 130 34 162 60 156 120L160 176C150 170 140 170 132 174L128 150 72 150 68 174C60 170 50 170 40 176Z"/>' +
      '<ellipse class="ln" cx="100" cy="122" rx="52" ry="47"/>' +
      '<path class="ln" d="M50 110C45 138 47 160 56 178 58 158 59 136 62 118Z"/><path class="ln" d="M150 110C155 138 153 160 144 178 142 158 141 136 138 118Z"/>' +
      // brows sit under the bangs' tips
      '<path class="st v b-n" style="stroke-width:2.4" d="M66 104Q76 100 88 106M134 104Q124 100 112 106"/>' +
      '<path class="st v b-a" style="stroke-width:2.6" d="M65 100L88 109M135 100L112 109"/>' +
      '<path class="st v b-w" style="stroke-width:2.4" d="M66 107Q76 101 88 99M134 107Q124 101 112 99"/>' +
      '<path class="st v b-r" style="stroke-width:2.4" d="M66 100Q77 93 88 99M134 100Q123 93 112 99"/>' +
      '<path class="ln" d="M46 118C44 72 70 50 100 50 130 50 156 72 154 118 150 112 148 106 147 99 145 107 141 112 136 115 139 104 137 94 131 87 129 97 124 105 117 109 120 98 118 88 112 81 108 91 104 97 99 101 98 92 94 85 88 80 84 89 82 98 83 108 77 103 73 96 71 88 65 95 62 104 63 114 58 110 55 106 53 100 51 107 48 112 46 118Z"/>' +
      '<path class="st" style="stroke-width:1.1;stroke-opacity:.55" d="M100 56C99 70 100 84 99 96M88 60C86 68 86 74 88 80M112 60C114 68 114 74 112 80M72 70C70 76 70 82 71 88M128 70C130 76 130 82 131 87"/>' +
      '<g class="fx-gloom v"><path class="st" style="stroke-width:1.3;stroke-opacity:.55" d="M74 86v18M82 82v24M90 80v26M98 80v26M106 80v26M114 81v25M122 84v21"/></g>' +
      '<g class="ahoge"><path class="st" d="M102 36C95 22 106 12 114 18 107 18 103 23 105 35"/></g>' +
      '<g class="ribbons"><g transform="translate(48 80)"><path class="wh" d="M0 0C-11 -13 -24 -6 -17 7 -12 13 -4 7 0 0ZM0 0C11 -13 24 -6 17 7 12 13 4 7 0 0Z"/><circle class="ink" r="3.8" style="stroke:var(--tk-line);stroke-width:1.6"/></g>' +
      '<g transform="translate(152 80)"><path class="wh" d="M0 0C-11 -13 -24 -6 -17 7 -12 13 -4 7 0 0ZM0 0C11 -13 24 -6 17 7 12 13 4 7 0 0Z"/><circle class="ink" r="3.8" style="stroke:var(--tk-line);stroke-width:1.6"/></g></g>' +
      // night cap (pyjamas): covers the crown, droops to the right, pompom
      '<g class="v acc-cap"><path class="ln" d="M46 92C44 52 74 36 102 38 132 38 150 54 156 78 168 92 176 110 180 128 172 118 162 106 154 98 150 94 120 86 100 86 78 86 56 90 46 92Z"/>' +
      '<path class="whs" d="M44 96C42 88 52 84 100 82 148 84 158 88 156 96 154 102 146 98 100 96 54 98 46 102 44 96Z"/>' +
      '<circle class="whs" cx="181" cy="132" r="8"/><path class="st" style="stroke-width:1.1;stroke-opacity:.5" d="M80 60l4 4M84 60l-4 4M120 54l4 4M124 54l-4 4M140 72l3 3M143 72l-3 3"/></g>' +
      // eyes: whites, irises (clipped, they move with rig.look), lash lines on top
      '<ellipse class="wh v eoL" cx="79" cy="128" rx="11.5" ry="13.5"/><ellipse class="wh v eoR" cx="121" cy="128" rx="11.5" ry="13.5"/>' +
      '<g clip-path="url(#' + p + 'cL)"><g class="irisL">' + iris(80, 79, 'L') + '</g></g>' +
      '<g clip-path="url(#' + p + 'cR)"><g class="irisR">' + iris(120, 121, 'R') + '</g></g>' +
      '<path class="ink v elid" d="M64 130Q79 125 94 130L94 110 64 110ZM106 130Q121 125 136 130L136 110 106 110Z"/>' +
      '<path class="st v elid" style="stroke-width:2.8" d="M65 130Q79 125 93 130M107 130Q121 125 135 130"/>' +
      '<path class="ink v elid2" d="M64 125Q79 121 94 125L94 110 64 110ZM106 125Q121 121 136 125L136 110 106 110Z"/>' +
      '<path class="st v elid2" style="stroke-width:3" d="M65 125Q79 120 93 125M107 125Q121 120 135 125"/>' +
      '<path class="st v elL" ' + lash + ' d="M66 122Q79 108 92 120"/><path class="st v elL" style="stroke-width:2.2" d="M66 122l-4 -3"/>' +
      '<path class="st v elR" ' + lash + ' d="M108 120Q121 108 134 122"/><path class="st v elR" style="stroke-width:2.2" d="M134 122l4 -3"/>' +
      '<path class="st v ehap" style="stroke-width:3" d="M68 130Q79 118 90 130M110 130Q121 118 132 130"/>' +
      '<path class="st v eslp" style="stroke-width:2.6" d="M68 128Q79 134 90 128M110 128Q121 134 132 128M70 130l-3 3M130 130l3 3"/>' +
      '<path class="st v eclo" style="stroke-width:2.8" d="M67 129Q79 132 91 129M109 129Q121 132 133 129"/>' +
      '<path class="st v etight" style="stroke-width:3" d="M70 120L87 128 70 136M130 120L113 128 130 136"/>' +
      '<path class="st v ewink" style="stroke-width:3" d="M110 130Q121 118 132 130M131 126l4 -2"/>' +
      '<g class="v edot"><circle class="wh" cx="79" cy="128" r="3.2"/><circle class="wh" cx="121" cy="128" r="3.2"/></g>' +
      '<g class="v etear"><path class="st" style="stroke-width:1.6" d="M68 140Q79 144 90 140M110 140Q121 144 132 140"/>' +
      '<path class="whs" d="M70 142l2.4 5a2.4 2.4 0 1 1 -4.8 0zM130 142l2.4 5a2.4 2.4 0 1 1 -4.8 0z"/></g>' +
      '<g class="v ecry"><path class="st" style="stroke-width:4;stroke-opacity:.9" d="M72 136C70 148 73 158 68 168M128 136C130 148 127 158 132 168"/></g>' +
      // blush
      '<g class="v bl1"><ellipse cx="68" cy="146" rx="9" ry="4.5" style="fill:var(--tk-line);fill-opacity:.1"/><ellipse cx="132" cy="146" rx="9" ry="4.5" style="fill:var(--tk-line);fill-opacity:.1"/>' +
      '<path class="st" style="stroke-width:1.3" d="M62 148l4 -4M67 149l4 -4M72 150l4 -4M124 150l4 -4M129 149l4 -4M134 148l4 -4"/></g>' +
      '<g class="v bl2"><ellipse cx="68" cy="146" rx="12" ry="6.5" style="fill:var(--tk-line);fill-opacity:.16"/><ellipse cx="132" cy="146" rx="12" ry="6.5" style="fill:var(--tk-line);fill-opacity:.16"/>' +
      '<path class="st" style="stroke-width:1.5" d="M58 150l5 -6M64 151l5 -6M70 152l5 -6M76 151l4 -5M120 151l4 -5M125 152l5 -6M131 151l5 -6M137 150l5 -6"/></g>' +
      // mouths
      '<g class="v m-fang"><path class="st" d="M94 154Q100 150 106 154"/><path class="wh" d="M102.6 152.6L104 156.2 105.4 152.9Z"/></g>' +
      '<g class="v m-smile"><path class="st" d="M93 152Q100 160 107 152"/><path class="wh" d="M102.6 153.6L104 156.8 105.2 154Z"/></g>' +
      '<g class="v m-open"><path class="ln" d="M90 151Q100 153 110 151 108 165 100 165 92 165 90 151Z"/><path class="st" style="stroke-width:1.2" d="M95 160.5Q100 157.5 105 160.5"/></g>' +
      '<g class="v m-shout"><path class="ln" d="M90 150H110Q105 167 100 167 95 167 90 150Z"/><path class="wh" d="M103 150.5L104.8 155 106.6 150.8Z"/></g>' +
      '<path class="st v m-frown" d="M93 158Q100 151 107 158"/>' +
      '<ellipse class="ln v m-o" cx="100" cy="156" rx="3.6" ry="4.6"/>' +
      '<path class="st v m-flat" d="M95 155h10"/>' +
      '<path class="st v m-wavy" d="M89 155q2.75 -3.5 5.5 0t5.5 0 5.5 0 5.5 0"/>' +
      '<path class="st v m-cat" d="M91 153q4.5 4 9 0q4.5 4 9 0"/>' +
      '<g class="v m-pout"><path class="st" d="M96 157q4 -5 8 0"/></g>' +
      '<g class="v m-chew"><path class="st" d="M94 153q6 6 12 0"/><path class="st" style="stroke-width:1.6" d="M147 140q4 6 0 12"/></g>' +
      '<g class="v m-chew2"><path class="st" d="M95 156q5 -3 10 0"/><path class="st" style="stroke-width:1.6" d="M53 140q-4 6 0 12"/></g>' +
      '<ellipse class="ln v m-yawn" cx="100" cy="157" rx="5.5" ry="7.5"/>' +
      '<g class="v m-tongue"><path class="st" d="M93 153Q100 157 107 153"/><path class="ln" d="M98 154.5q0 7 3.5 7t3.5 -7z"/></g>' +
      '<g class="v m-grit"><path class="ln" d="M90 151h20v6.5h-20z"/><path class="st" style="stroke-width:1.2" d="M90 154.3h20M95 151v6.5M100 151v6.5M105 151v6.5"/></g>' +
      '<path class="ln v m-wail" d="M89 160Q100 147 111 160 100 167 89 160Z"/>' +
      '<ellipse class="st v m-sleepo" cx="99" cy="155" rx="3" ry="2.2"/>' +
      // effects around the head
      '<path class="st v fx-anger" style="stroke-width:2.6" d="M150 50q6 2 7 8M168 50q-6 2 -7 8M150 68q6 -2 7 -8M168 68q-6 -2 -7 -8"/>' +
      '<path class="ln v fx-sweat" d="M150 94C154 102 158 106 154 111 150 115 144 111 146 105 147 101 149 98 150 94Z"/>' +
      '<g class="v fx-spark">' + star(34, 70, 7) + star(170, 58, 6) + star(162, 140, 4.5) + '</g>' +
      '<g class="v fx-hearts"><path class="wh" transform="translate(32 76) scale(.7)" d="' + HEART + '"/><path class="wh" transform="translate(168 62) scale(.55)" d="' + HEART + '"/><path class="wh" transform="translate(174 118) scale(.45)" d="' + HEART + '"/></g>' +
      '<text class="v fx-q" x="158" y="64" style="font:900 30px Roboto,sans-serif;fill:var(--tk-ink);stroke:var(--tk-line);stroke-width:1.8;paint-order:stroke">?</text>' +
      '<text class="v fx-ex" x="160" y="64" style="font:900 32px Roboto,sans-serif;fill:var(--tk-ink);stroke:var(--tk-line);stroke-width:1.8;paint-order:stroke">!</text>' +
      '<path class="st v fx-lines" style="stroke-width:2" d="M36 96l-12 -6M32 116h-14M40 76l-10 -10M164 96l12 -6M168 116h14M160 76l10 -10"/>' +
      '<g class="v fx-notes"><text x="164" y="70" style="font:700 22px sans-serif;fill:var(--tk-line)">♪</text><text x="22" y="92" style="font:700 16px sans-serif;fill:var(--tk-line)">♫</text></g>' +
      '<g class="v fx-notes2"><text x="170" y="58" style="font:700 18px sans-serif;fill:var(--tk-line)">♫</text><text x="26" y="78" style="font:700 20px sans-serif;fill:var(--tk-line)">♪</text></g>' +
      '<g class="v fx-zzz"><text x="150" y="60" style="font:600 12px Roboto,sans-serif;fill:var(--tk-line)">z</text><text x="160" y="46" style="font:600 16px Roboto,sans-serif;fill:var(--tk-line)">Z</text></g>' +
      '<g class="v fx-zzz2"><text x="156" y="54" style="font:600 13px Roboto,sans-serif;fill:var(--tk-line)">z</text><text x="168" y="38" style="font:600 19px Roboto,sans-serif;fill:var(--tk-line)">Z</text></g>' +
      '<circle class="v fx-bubble" cx="113" cy="148" r="5" style="fill:none;stroke:var(--tk-line);stroke-width:1.3"/>' +
      '<g class="v fx-bubble2"><circle cx="115" cy="148" r="8.5" style="fill:var(--tk-line);fill-opacity:.06;stroke:var(--tk-line);stroke-width:1.3"/><path class="st" style="stroke-width:1" d="M111 144q2 -2 4 -1"/></g>' +
      '<g class="v fx-steam"><path class="ln" d="M30 64c-6 0 -8 -8 -2 -10 0 -6 8 -8 11 -3 5 -3 11 2 8 7 3 4 -1 9 -6 7Z"/><path class="ln" d="M170 64c6 0 8 -8 2 -10 0 -6 -8 -8 -11 -3 -5 -3 -11 2 -8 7 -3 4 1 9 6 7Z"/></g>' +
      '<text class="v fx-dots" x="150" y="66" style="font:900 22px Roboto,sans-serif;fill:var(--tk-line);letter-spacing:-2px">…</text>' +
      '<g class="v fx-puff"><path class="st" style="stroke-width:1.8" d="M49 136q-6 9 0 18M151 136q6 9 0 18"/></g>' +
      '<path class="whs v fx-tearpop" d="M90 124l2.4 5a2.4 2.4 0 1 1 -4.8 0z"/>' +
      // accessories over the face
      '<g class="v acc-glasses"><circle cx="79" cy="129" r="15" style="fill:var(--tk-line);fill-opacity:.06;stroke:var(--tk-line);stroke-width:2"/>' +
      '<circle cx="121" cy="129" r="15" style="fill:var(--tk-line);fill-opacity:.06;stroke:var(--tk-line);stroke-width:2"/><path class="st" d="M94 127q6 -4 12 0M64 126l-12 -4M136 126l12 -4"/>' +
      '<path class="st" style="stroke-width:1.4;stroke-opacity:.6" d="M70 120l5 -4M112 120l5 -4"/></g>' +
      '<g class="v acc-phones"><path class="st" style="stroke-width:7" d="M42 116C36 46 164 46 158 116"/><path class="sti" style="stroke-width:3.6" d="M42 116C36 46 164 46 158 116"/>' +
      '<rect class="ln" x="32" y="106" width="16" height="32" rx="7"/><rect class="ln" x="152" y="106" width="16" height="32" rx="7"/>' +
      '<path class="st" style="stroke-width:1.2;stroke-opacity:.6" d="M37 114v16M163 114v16"/></g>';
  }
  function iris(cx, sx, s) {
    return '' +
      '<g class="v ei' + s + '"><ellipse class="ink" cx="' + cx + '" cy="130" rx="8.6" ry="11"/><ellipse cx="' + cx + '" cy="131" rx="5.6" ry="7.4" style="fill:none;stroke:var(--tk-line);stroke-width:.8;stroke-opacity:.45"/>' +
      '<circle class="wh" cx="' + (cx - 3.5) + '" cy="126.5" r="3.4"/><circle class="wh" cx="' + (cx + 3.5) + '" cy="135" r="1.6"/></g>' +
      '<g class="v es' + s + '"><ellipse class="ink" cx="' + sx + '" cy="129" rx="4.4" ry="5.8"/><circle class="wh" cx="' + (sx - 1.5) + '" cy="127" r="1.5"/></g>' +
      '<g class="v ep' + s + '"><ellipse class="ink" cx="' + cx + '" cy="130" rx="8.8" ry="11.2"/><circle class="wh" cx="' + (cx - 3.5) + '" cy="125.5" r="4"/>' +
      star(cx + 3, 134, 3.4) + '<circle class="wh" cx="' + (cx - 4) + '" cy="136" r="1.2"/></g>' +
      '<g class="v eh' + s + '"><path class="ink" transform="translate(' + cx + ' 130) scale(1.05)" d="' + HEART + '"/><circle class="wh" cx="' + (cx - 3.2) + '" cy="125.6" r="2.2"/></g>' +
      '<g class="v ew' + s + '"><path class="sti" style="stroke-width:1.5" d="M' + sx + ' 128m-1 0a1.5 1.5 0 1 1 3 0a3 3 0 1 1 -6 0a4.5 4.5 0 1 1 9 0a6 6 0 1 1 -12 0a7.5 7.5 0 1 1 15 0"/></g>';
  }
  function star(x, y, r) {
    var a = r * 0.3;
    return '<path class="wh" d="M' + x + ' ' + (y - r) + 'L' + (x + a) + ' ' + (y - a) + ' ' + (x + r) + ' ' + y + ' ' + (x + a) + ' ' + (y + a) + ' ' + x + ' ' + (y + r) + ' ' +
      (x - a) + ' ' + (y + a) + ' ' + (x - r) + ' ' + y + ' ' + (x - a) + ' ' + (y - a) + 'Z"/>';
  }
  function tailsSVG() {
    return '<path class="ln" d="M48 82C22 98 14 140 22 178 26 200 18 218 8 230 30 228 40 212 40 190 40 160 42 124 60 98Z"/><path class="st" d="M8 230C1 236 5 245 14 241"/>' +
      '<path class="ln" d="M152 82C178 98 186 140 178 178 174 200 182 218 192 230 170 228 160 212 160 190 160 160 158 124 140 98Z"/><path class="st" d="M192 230C199 236 195 245 186 241"/>' +
      '<path class="st" style="stroke-width:1.1;stroke-opacity:.45" d="M38 110C30 140 30 170 34 196M162 110C170 140 170 170 166 196"/>';
  }
  function torsoSVG() {
    return '<path class="ln" d="M92 160L92 178 108 178 108 160Z"/>' +
      '<path class="ln" d="M58 192C62 178 138 178 142 192L156 262 44 262Z"/>' +
      // sailor uniform
      '<g class="v o-sailor"><path class="wh" d="M70 182L100 208 130 182 124 179 100 199 76 179Z"/>' +
      '<path class="sti" style="stroke-width:1.4" d="M77 186L100 205 123 186"/>' +
      '<path class="wh" d="M100 208L89 202 90 216ZM100 208L111 202 110 216Z"/><circle class="ink" cx="100" cy="208" r="3" style="stroke:var(--tk-line);stroke-width:1.4"/></g>' +
      // pyjamas: round collar, buttons, little moons
      '<g class="v o-pj"><path class="whs" d="M74 181Q86 196 100 188 114 196 126 181 118 178 100 184 82 178 74 181Z"/>' +
      '<path class="st" style="stroke-width:1.3" d="M100 188V262"/><circle class="wh" cx="104" cy="204" r="1.8"/><circle class="wh" cx="104" cy="222" r="1.8"/><circle class="wh" cx="104" cy="240" r="1.8"/>' +
      '<path class="wh" style="opacity:.55" d="M74 214a4 4 0 1 0 5 5 3.2 3.2 0 1 1 -5 -5zM124 232a4 4 0 1 0 5 5 3.2 3.2 0 1 1 -5 -5zM80 246l1 2 2 1 -2 1 -1 2 -1 -2 -2 -1 2 -1z"/></g>';
  }

  // arm = tube from the shoulder through the elbow to the hand, a white cuff band near the wrist, then the hand
  function arm(side, a) {
    var s = SHOULDER[side], ex = a[0], ey = a[1], hx = a[2], hy = a[3], hand = a[4] || 'fist';
    var d = 'M' + s[0] + ' ' + s[1] + 'Q' + ex + ' ' + ey + ' ' + hx + ' ' + hy;
    var vx = ex - hx, vy = ey - hy, L = Math.sqrt(vx * vx + vy * vy) || 1; vx /= L; vy /= L;
    var c1 = (hx + vx * 6.5).toFixed(1) + ' ' + (hy + vy * 6.5).toFixed(1), c2 = (hx + vx * 10).toFixed(1) + ' ' + (hy + vy * 10).toFixed(1);
    var ang = Math.atan2(-vy, -vx) * 180 / Math.PI;
    return '<path class="tw" d="' + d + '"/><path class="ti" d="' + d + '"/>' +
      '<path class="cuff" d="M' + c1 + 'L' + c2 + '"/>' +
      (hand === 'none' ? '' : '<g transform="translate(' + hx + ' ' + hy + ') rotate(' + ang.toFixed(1) + ')">' + HANDS[hand] + '</g>');
  }
  var HANDS = {
    fist: '<circle class="ln" cx="1" cy="0" r="6.4"/><path class="st" style="stroke-width:1.2" d="M3 -3.5q2.6 1.5 2.6 3.5"/>',
    open: '<path class="ln" d="M-3 -6.5C4 -9 13 -7 13 0 13 7 4 9 -3 6.5Z"/><path class="st" style="stroke-width:1.1" d="M5 -2.6h7M5 1.4h7M2 -6.8l3 -3.5"/>',
    v: '<circle class="ln" cx="0" cy="1" r="6.2"/><path class="tw" style="stroke-width:6" d="M2 -3L13 -9M3 0L14 -2"/><path class="ti" style="stroke-width:2.6" d="M2 -3L13 -9M3 0L14 -2"/>',
    point: '<circle class="ln" cx="0" cy="0" r="6.2"/><path class="tw" style="stroke-width:6" d="M3 -1.5L13 -1.5"/><path class="ti" style="stroke-width:2.6" d="M3 -1.5L13 -1.5"/>'
  };

  // ---- CSS for every slot value, generated once per document -------------------------------------------------------
  function css() {
    if (document.getElementById('tk-css')) return;
    var r = [
      ':root{--tk-line:#fff;--tk-ink:#0b0b0b}',  // on :root, so a wrapper can recolour everything inside (night = dimmer)
      '.tk .ln{fill:var(--tk-ink);stroke:var(--tk-line);stroke-width:2;stroke-linejoin:round;stroke-linecap:round}',
      '.tk .st{fill:none;stroke:var(--tk-line);stroke-width:2;stroke-linejoin:round;stroke-linecap:round}',
      '.tk .sti{fill:none;stroke:var(--tk-ink);stroke-width:1.6;stroke-linejoin:round;stroke-linecap:round}',
      '.tk .whs{fill:var(--tk-line);stroke:var(--tk-ink);stroke-width:1.4;stroke-linejoin:round}',
      '.tk .wh{fill:var(--tk-line)}.tk .ink{fill:var(--tk-ink)}',
      '.tk .tw{fill:none;stroke:var(--tk-line);stroke-width:14.6;stroke-linecap:round;stroke-linejoin:round}',
      '.tk .ti{fill:none;stroke:var(--tk-ink);stroke-width:11;stroke-linecap:round;stroke-linejoin:round}',
      '.tk .cuff{fill:none;stroke:var(--tk-line);stroke-width:11}',
      '.tk .jp{font-family:"Noto Sans CJK JP","Noto Sans JP","Yu Gothic",sans-serif;font-weight:700}',
      '.tk .v{display:none}',
      '.tk .cat-closed{display:none}.tk.cat-purr .cat-closed{display:inline}.tk.cat-purr .cat-open{display:none}',
      '.tk[data-acc~="cap"] .ribbons{display:none}'
    ];
    Object.keys(EYES).forEach(function (k) {
      r.push(EYES[k].split(' ').map(function (c) { return '.tk[data-e="' + k + '"] .' + c; }).join(',') + '{display:inline}');
    });
    MOUTHS.forEach(function (k) { r.push('.tk[data-m="' + k + '"] .m-' + k + '{display:inline}'); });
    BROWS.forEach(function (k) { r.push('.tk[data-b="' + k + '"] .b-' + k + '{display:inline}'); });
    r.push('.tk[data-bl="1"] .bl1,.tk[data-bl="2"] .bl2{display:inline}');
    FX.forEach(function (k) { r.push('.tk[data-fx~="' + k + '"] .fx-' + k + '{display:inline}'); });
    ['cap', 'glasses', 'phones'].forEach(function (k) { r.push('.tk[data-acc~="' + k + '"] .acc-' + k + '{display:inline}'); });
    r.push('.tk:not([data-outfit="pj"]) .o-sailor,.tk[data-outfit="pj"] .o-pj{display:inline}');
    var s = document.createElement('style'); s.id = 'tk-css'; s.textContent = r.join('\n');
    document.head.appendChild(s);
  }

  function el(tag, cls) { var e = document.createElementNS(NS, tag); if (cls) e.setAttribute('class', cls); return e; }

  function create(g, opts) {
    opts = opts || {}; css();
    var p = 'tk' + (++uid) + '-';
    g.classList.add('tk');
    var tails = el('g', 'tails'), torso = el('g', 'torso'), head = el('g', 'head'), back = el('g', 'props-back'),
        arms = el('g', 'arms'), front = el('g', 'props-front');
    tails.innerHTML = tailsSVG(); torso.innerHTML = torsoSVG(); head.innerHTML = headSVG(p);
    [tails, torso, head, back, arms, front].forEach(function (x) { g.appendChild(x); });
    var irisL = head.querySelector('.irisL'), irisR = head.querySelector('.irisR');
    var cur = { e: 'open', m: 'fang', b: 'n', bl: 1, fx: '' }, curMood = 'normal', blinking = false, poseName = '', lookXY = [0, 0];

    function face(f) {
      for (var k in f) if (f[k] != null) { cur[k] = f[k]; g.setAttribute('data-' + k, f[k]); }
    }
    function look(dx, dy) {
      dx = Math.max(-4.5, Math.min(4.5, dx || 0)); dy = Math.max(-4, Math.min(4, dy || 0));
      if (dx === lookXY[0] && dy === lookXY[1]) return;
      lookXY = [dx, dy];
      var t = dx || dy ? 'translate(' + dx.toFixed(1) + ' ' + dy.toFixed(1) + ')' : '';
      irisL.setAttribute('transform', t); irisR.setAttribute('transform', t);
    }
    function tilt(deg, dx, dy) {
      var t = (deg ? 'rotate(' + deg + ' 100 168)' : '') + (dx || dy ? ' translate(' + (dx || 0) + ' ' + (dy || 0) + ')' : '');
      head.setAttribute('transform', t); tails.setAttribute('transform', t);
    }
    function mood(name, keepLook) {
      var m = MOODS[name] || MOODS.normal; curMood = MOODS[name] ? name : 'normal';
      face({ e: m.e, m: m.m, b: m.b, bl: m.bl, fx: m.fx || '' });
      if (!keepLook) look(m.look ? m.look[0] : 0, m.look ? m.look[1] : 0);
      tilt(m.tilt || 0);
      return m;
    }
    function pose(pz) {
      var P = typeof pz === 'string' ? POSES[pz] : pz;
      if (!P) return;
      poseName = typeof pz === 'string' ? pz : '';
      var order = (P.order || 'LR').split(''), html = '';
      order.forEach(function (side) { if (P[side]) html += arm(side, P[side]); });
      if (P.heart) html += '<path class="st" style="stroke-width:2.4" transform="translate(100 196) scale(1.3)" d="' + HEART + '"/>';
      arms.innerHTML = html;
      // arms raised beside the head go behind it (stretching); everything else is in front of the body
      if (P.back) { if (arms.nextSibling !== head) g.insertBefore(arms, head); } else if (arms.nextSibling !== front) g.insertBefore(arms, front);
      g.setAttribute('data-pose', poseName);
      return P;
    }
    // props: [{k, at:'L'|'R', dx, dy, r, s, front}] held (relative to that hand of the current pose),
    // or {k, x, y, r, s, front} loose. frontEl: where `front` props go (a scene puts them above its desk).
    function props(list, P, frontEl) {
      P = P || POSES[poseName] || {};
      var b = '', f = '';
      (list || []).forEach(function (it) {
        var x = it.x || 0, y = it.y || 0;
        if (it.at && P[it.at]) { x = P[it.at][2] + (it.dx || 0); y = P[it.at][3] + (it.dy || 0); }
        var m = '<g transform="translate(' + x + ' ' + y + ')' + (it.r ? ' rotate(' + it.r + ')' : '') + (it.s ? ' scale(' + it.s + ')' : '') + '">' + (PROPS[it.k] || '') + '</g>';
        if (it.front) f += m; else b += m;
      });
      back.innerHTML = b; (frontEl || front).innerHTML = f;
    }
    function blink() {
      if (blinking || !/^(open|half|sparkle|heart|small|teary|down)$/.test(cur.e)) return;
      blinking = true; var e = cur.e;
      g.setAttribute('data-e', 'closed');
      setTimeout(function () { blinking = false; if (g.getAttribute('data-e') === 'closed') g.setAttribute('data-e', e); }, 130);
    }
    if (opts.outfit) g.setAttribute('data-outfit', opts.outfit);
    if (opts.acc) g.setAttribute('data-acc', opts.acc);
    mood(opts.mood || 'normal'); pose(opts.pose || 'cross');
    return {
      g: g, head: head, face: face, look: look, tilt: tilt, mood: mood, pose: pose, props: props, blink: blink,
      acc: function (a) { g.setAttribute('data-acc', a || ''); },
      outfit: function (o) { g.setAttribute('data-outfit', o || ''); },
      get moodName() { return curMood; }, get poseName() { return poseName; }, get faceNow() { return cur; }
    };
  }

  // a standalone prop as its own little <svg> (icons on the mascot's food / gift sheets)
  function icon(k, vb) {
    css();
    return '<svg class="tk" viewBox="' + (vb || '-18 -32 36 36') + '">' + (PROPS[k] || '') + '</svg>';
  }

  return { create: create, icon: icon, MOODS: MOODS, POSES: POSES, PROPS: PROPS, HEART: HEART, SHOULDER: SHOULDER };
})();
