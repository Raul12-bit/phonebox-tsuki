// Detailed drawing kit for the "manga page" Tsuki wallpaper. Same character design as the panel mascot, with manga
// finishing: screentone shading, hair shine, detailed eyes, outfit details, chibi expressions, clouds, petals, moon.
var D = (function () {
  var BOW = 'M0 0 C-11 -13 -24 -6 -17 7 C-12 13 -4 7 0 0 Z M0 0 C11 -13 24 -6 17 7 C12 13 4 7 0 0 Z';
  var BANGS = 'M46 118 C44 72 70 50 100 50 C130 50 156 72 154 118 C150 112 148 106 147 99 C145 107 141 112 136 115 C139 104 137 94 131 87 C129 97 124 105 117 109 C120 98 118 88 112 81 C108 91 104 97 99 101 C98 92 94 85 88 80 C84 89 82 98 83 108 C77 103 73 96 71 88 C65 95 62 104 63 114 C58 110 55 106 53 100 C51 107 48 112 46 118 Z';
  var HEART = 'M0 8 C-8 3 -12 -1 -12 -5 C-12 -9 -9 -11 -6 -11 C-3 -11 -1 -9 0 -7 C1 -9 3 -11 6 -11 C9 -11 12 -9 12 -5 C12 -1 8 3 0 8 Z';
  var seed = 11;
  function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
  function reseed(n) { seed = n; }
  var n = 0; function uid(p) { return p + (++n); }

  var defs =
    '<defs>' +
    '<pattern id="tone" width="9" height="9" patternUnits="userSpaceOnUse"><circle cx="4.5" cy="4.5" r="1.7" fill="#fff"/></pattern>' +
    '<pattern id="toneS" width="12" height="12" patternUnits="userSpaceOnUse"><circle cx="6" cy="6" r="1.4" fill="#fff"/></pattern>' +
    '<pattern id="toneD" width="3.2" height="3.2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><circle cx="1.6" cy="1.6" r=".75" fill="#fff"/></pattern>' +
    '<pattern id="toneK" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><circle cx="2.5" cy="2.5" r="1.15" fill="#0b0b0b"/></pattern>' +
    '<pattern id="toneK2" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><circle cx="2" cy="2" r="1.35" fill="#0b0b0b"/></pattern>' +
    '<pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><path d="M0 3 H6" stroke="#fff" stroke-width=".9"/></pattern>' +
    '<linearGradient id="fadeUp" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>' +
    '<linearGradient id="fadeDown" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>' +
    '<style>.ln{fill:#0b0b0b;stroke:#fff;stroke-width:2;stroke-linejoin:round;stroke-linecap:round}.st{fill:none;stroke:#fff;stroke-width:2;stroke-linejoin:round;stroke-linecap:round}' +
    '.wh{fill:#fff}.ink{fill:#0b0b0b}text{font-family:"Yu Gothic UI","Yu Gothic",Meiryo,"Noto Sans JP",sans-serif}</style>' +
    '</defs>';

  function star(x, y, s, o) {
    return '<path fill="#fff" opacity="' + (o == null ? 1 : o) + '" transform="translate(' + x + ' ' + y + ') scale(' + s + ')" d="M0 -10 L2.4 -2.4 L10 0 L2.4 2.4 L0 10 L-2.4 2.4 L-10 0 L-2.4 -2.4 Z"/>';
  }
  function heart(x, y, s, filled, rot) {
    return '<path transform="translate(' + x + ' ' + y + ') rotate(' + (rot || 0) + ') scale(' + s + ')" fill="' + (filled ? '#fff' : '#0b0b0b') + '" stroke="#fff" stroke-width="' + (2 / s) + '" d="' + HEART + '"/>';
  }
  function petal(x, y, s, rot) {  // sakura petal with its notch
    return '<g transform="translate(' + x + ' ' + y + ') rotate(' + rot + ') scale(' + s + ')">' +
      '<path fill="#0b0b0b" stroke="#fff" stroke-width="' + (1.6 / s) + '" stroke-linejoin="round" d="M0 10 C-6 6 -9 -2 -6 -8 C-4 -11 -1 -10 0 -7 C1 -10 4 -11 6 -8 C9 -2 6 6 0 10 Z"/>' +
      '<path fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="' + (1 / s) + '" d="M0 7 L0 -3"/></g>';
  }
  function petals(x0, y0, x1, y1, count, smin, smax) {
    var s = '';
    for (var i = 0; i < count; i++) s += petal(x0 + rnd() * (x1 - x0), y0 + rnd() * (y1 - y0), smin + rnd() * (smax - smin), rnd() * 360);
    return s;
  }
  function stars(x0, y0, x1, y1, count, smin, smax) {
    var s = '';
    for (var i = 0; i < count; i++) {
      var x = x0 + rnd() * (x1 - x0), y = y0 + rnd() * (y1 - y0);
      s += rnd() < .55 ? '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + (.8 + rnd() * 1.6).toFixed(2) + '" fill="#fff" opacity="' + (.35 + rnd() * .5).toFixed(2) + '"/>'
        : star(x.toFixed(1), y.toFixed(1), (smin + rnd() * (smax - smin)).toFixed(2), .9);
    }
    return s;
  }
  function focus(cx, cy, r0, r1, count, op) {  // 集中線
    var s = '';
    for (var i = 0; i < count; i++) {
      var a = i / count * Math.PI * 2 + rnd() * .04, w = .002 + rnd() * .007, ri = r0 + rnd() * (r1 - r0) * .3;
      s += '<path d="M' + (cx + Math.cos(a) * ri).toFixed(1) + ' ' + (cy + Math.sin(a) * ri).toFixed(1) + ' L' + (cx + Math.cos(a - w) * r1).toFixed(1) + ' ' + (cy + Math.sin(a - w) * r1).toFixed(1) +
        ' L' + (cx + Math.cos(a + w) * r1).toFixed(1) + ' ' + (cy + Math.sin(a + w) * r1).toFixed(1) + ' Z"/>';
    }
    return '<g fill="#fff" opacity="' + op + '">' + s + '</g>';
  }
  // manga cloud: the union outline of overlapping bumps (white ring under, black discs over), flat bottom, tone shadow
  function cloud(x, y, w, h, bumps) {
    var circles = [], i, r;
    for (i = 0; i < bumps; i++) {
      r = h * (.45 + rnd() * .55);
      circles.push([x + (i + .5) * w / bumps + (rnd() - .5) * w / bumps * .4, y - r * (.35 + rnd() * .35), r]);
    }
    var id = uid('cl'), under = '', over = '';
    circles.forEach(function (c) { under += '<circle cx="' + c[0].toFixed(1) + '" cy="' + c[1].toFixed(1) + '" r="' + (c[2] + 1.6).toFixed(1) + '" fill="#fff"/>'; over += '<circle cx="' + c[0].toFixed(1) + '" cy="' + c[1].toFixed(1) + '" r="' + c[2].toFixed(1) + '" fill="#0b0b0b"/>'; });
    var clip = '<clipPath id="' + id + '"><rect x="' + (x - h * 2) + '" y="' + (y - h * 3) + '" width="' + (w + h * 4) + '" height="' + (h * 3) + '"/></clipPath>';
    var tone = '<g clip-path="url(#' + id + ')">' + over.replace(/fill="#0b0b0b"/g, 'fill="url(#toneD)" opacity=".28"') + '</g>';
    return clip + '<g clip-path="url(#' + id + ')">' + under + over + '</g>' + tone +
      '<path d="M' + (x - h) + ' ' + y + ' H' + (x + w + h) + '" stroke="#fff" stroke-width="2"/>' +
      circles.slice(0, 3).map(function (c) { return '<path fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="1.4" d="M' + (c[0] - c[2] * .4).toFixed(1) + ' ' + (c[1] + c[2] * .2).toFixed(1) + ' q' + (c[2] * .3).toFixed(1) + ' -' + (c[2] * .3).toFixed(1) + ' ' + (c[2] * .6).toFixed(1) + ' 0"/>'; }).join('');
  }
  // crescent moon with craters, inner shading and halo rings
  function moon(cx, cy, r) {
    var id = uid('mn'), ox = cx + r * .42, oy = cy - r * .26, orr = r * .86, s = '';
    s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r * 1.18) + '" fill="none" stroke="#fff" stroke-opacity=".12" stroke-width="2"/>';
    s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r * 1.36) + '" fill="none" stroke="#fff" stroke-opacity=".06" stroke-width="2" stroke-dasharray="4 10"/>';
    s += '<mask id="' + id + '"><rect x="-5000" y="-5000" width="10000" height="10000" fill="#000"/><circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="#fff"/><circle cx="' + ox + '" cy="' + oy + '" r="' + orr + '" fill="#000"/></mask>';
    s += '<clipPath id="' + id + 'c"><circle cx="' + cx + '" cy="' + cy + '" r="' + r + '"/></clipPath>';
    var craters = '';
    for (var i = 0; i < 16; i++) {
      var a = rnd() * Math.PI * 2, d = rnd() * r * .92, cr = r * (.03 + rnd() * .09);
      var kx = (cx + Math.cos(a) * d).toFixed(1), ky = (cy + Math.sin(a) * d).toFixed(1);
      craters += '<circle cx="' + kx + '" cy="' + ky + '" r="' + cr.toFixed(1) + '" fill="url(#toneK)" stroke="#0b0b0b" stroke-width="1.4"/>' +
        '<path fill="none" stroke="#0b0b0b" stroke-width="1.6" stroke-linecap="round" d="M' + (kx - cr * .75).toFixed(1) + ' ' + (ky - cr * .2).toFixed(1) + ' q' + (cr * .75).toFixed(1) + ' -' + (cr * .75).toFixed(1) + ' ' + (cr * 1.5).toFixed(1) + ' 0"/>';
    }
    s += '<g mask="url(#' + id + ')"><circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="#fff"/>' +
      // shading towards the inner edge, a darker band right at it, then the craters
      '<circle cx="' + ox + '" cy="' + oy + '" r="' + (orr * 1.16) + '" fill="url(#toneK)" opacity=".7"/>' +
      '<circle cx="' + ox + '" cy="' + oy + '" r="' + (orr * 1.06) + '" fill="url(#toneK2)" opacity=".8"/>' +
      craters +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r - 3) + '" fill="none" stroke="#0b0b0b" stroke-width="6"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r - 2) + '" fill="none" stroke="#fff" stroke-width="4"/></g>';
    s += '<circle cx="' + ox + '" cy="' + oy + '" r="' + orr + '" fill="none" stroke="#fff" stroke-width="4" clip-path="url(#' + id + 'c)"/>';
    return s;
  }

  // ---------------------------------------------------------------- the detailed character (200 x 250 space)
  function shine() {  // hair "angel ring": small white diamonds along an arc over the bangs
    var s = '';
    for (var i = 0; i < 9; i++) {
      if (i === 4) continue;  // a gap in the middle, like a real highlight
      var t = i / 8, x = 66 + t * 68, y = 66 - Math.sin(Math.PI * t) * 8, h = 2 + Math.sin(Math.PI * t) * 1.6, w = .75;
      s += '<path fill="#fff" opacity=".85" d="M' + (x - w).toFixed(2) + ' ' + y.toFixed(2) + ' L' + x.toFixed(2) + ' ' + (y - h).toFixed(2) + ' L' + (x + w).toFixed(2) + ' ' + y.toFixed(2) + ' L' + x.toFixed(2) + ' ' + (y + h * .8).toFixed(2) + ' Z"/>';
    }
    return s;
  }
  function eye(cx, cy, look, flip) {  // flip = 1 for her right eye (viewer's left), -1 for the other
    var ix = cx + look, id = uid('ir');
    return '<ellipse class="wh" cx="' + cx + '" cy="' + cy + '" rx="11.5" ry="13.5"/>' +
      '<clipPath id="' + id + '"><ellipse cx="' + cx + '" cy="' + cy + '" rx="11.5" ry="13.5"/></clipPath>' +
      '<g clip-path="url(#' + id + ')">' +
        '<ellipse class="ink" cx="' + ix + '" cy="' + (cy + 2) + '" rx="8.6" ry="11"/>' +
        '<ellipse cx="' + ix + '" cy="' + (cy + 6) + '" rx="7.4" ry="6.4" fill="url(#toneD)" opacity=".55"/>' +
        '<ellipse cx="' + ix + '" cy="' + (cy + 3) + '" rx="5.6" ry="7.4" fill="none" stroke="#fff" stroke-width=".8" stroke-opacity=".5"/>' +
        '<ellipse class="ink" cx="' + ix + '" cy="' + (cy + 2) + '" rx="3.4" ry="5"/>' +
        '<path fill="#0b0b0b" opacity=".55" d="M' + (cx - 12) + ' ' + (cy - 14) + ' H' + (cx + 12) + ' V' + (cy - 10) + ' Q' + cx + ' ' + (cy - 7) + ' ' + (cx - 12) + ' ' + (cy - 10) + ' Z"/>' +
      '</g>' +
      '<circle class="wh" cx="' + (ix - 3.6) + '" cy="' + (cy - 1.8) + '" r="3.5"/><circle class="wh" cx="' + (ix + 3.4) + '" cy="' + (cy + 6.8) + '" r="1.6"/>' +
      star(ix + 3.8, cy - 3.6, .22) +
      // upper lash with flicks at the outer corner, lower lash marks
      '<path class="st" style="stroke-width:3.6" d="M' + (cx - 13) + ' ' + (cy - 6) + ' Q' + cx + ' ' + (cy - 20) + ' ' + (cx + 13) + ' ' + (cy - 8) + '"/>' +
      '<path class="st" style="stroke-width:1.8" d="M' + (cx - 13 * flip) + ' ' + (cy - 6 - (flip < 0 ? 2 : 0)) + ' l' + (-5 * flip) + ' -3 M' + (cx - 11 * flip) + ' ' + (cy - 10) + ' l' + (-4 * flip) + ' -4 M' + (cx - 8 * flip) + ' ' + (cy - 13) + ' l' + (-2.5 * flip) + ' -4"/>' +
      '<path class="st" style="stroke-width:1.2;stroke-opacity:.8" d="M' + (cx - 7) + ' ' + (cy + 14.5) + ' q7 2.5 14 0 M' + (cx - 10.5 * flip) + ' ' + (cy + 11) + ' l' + (-2 * flip) + ' 2"/>';
  }
  function girl() {
    var face = uid('face'), neck = uid('neck'), torso = uid('torso');
    return '' +
    // tails with tone shading on their inner side
    '<g><path class="ln" d="M48 82 C22 98 14 140 22 178 C26 200 18 218 8 230 C30 228 40 212 40 190 C40 160 42 124 60 98 Z"/>' +
      '<path fill="url(#toneD)" opacity=".5" d="M56 96 C42 120 40 160 40 190 C40 205 34 218 26 226 C34 214 36 200 34 186 C32 156 36 124 50 100 Z"/>' +
      '<path class="st" style="stroke-width:1.1;stroke-opacity:.6" d="M40 104 C28 128 24 158 28 190 M48 120 C40 146 38 170 36 196"/>' +
      '<path class="st" d="M8 230 C1 236 5 245 14 241"/></g>' +
    '<g><path class="ln" d="M152 82 C178 98 186 140 178 178 C174 200 182 218 192 230 C170 228 160 212 160 190 C160 160 158 124 140 98 Z"/>' +
      '<path fill="url(#toneD)" opacity=".5" d="M144 96 C158 120 160 160 160 190 C160 205 166 218 174 226 C166 214 164 200 166 186 C168 156 164 124 150 100 Z"/>' +
      '<path class="st" style="stroke-width:1.1;stroke-opacity:.6" d="M160 104 C172 128 176 158 172 190 M152 120 C160 146 162 170 164 196"/>' +
      '<path class="st" d="M192 230 C199 236 195 245 186 241"/></g>' +
    // body: neck with shadow, uniform with tone, sailor collar with stripes, big bow, crossed arms with cuffs
    '<clipPath id="' + neck + '"><path d="M92 158 L92 176 L108 176 L108 158 Z"/></clipPath>' +
    '<path class="ln" d="M92 158 L92 176 L108 176 L108 158 Z"/><path clip-path="url(#' + neck + ')" fill="url(#toneD)" opacity=".7" d="M90 156 H110 V166 Q100 172 90 166 Z"/>' +
    '<clipPath id="' + torso + '"><path d="M60 190 C64 177 136 177 140 190 L152 252 L48 252 Z"/></clipPath>' +
    '<path class="ln" d="M60 190 C64 177 136 177 140 190 L152 252 L48 252 Z"/>' +
    '<g clip-path="url(#' + torso + ')"><rect x="40" y="176" width="26" height="80" fill="url(#toneD)" opacity=".55"/><rect x="134" y="176" width="26" height="80" fill="url(#toneD)" opacity=".55"/>' +
      '<path class="st" style="stroke-width:1;stroke-opacity:.5" d="M70 236 Q74 246 72 252 M130 236 Q126 246 128 252"/></g>' +
    '<path class="wh" d="M68 182 L100 210 L132 182 L125 178 L100 200 L75 178 Z"/>' +
    '<path fill="none" stroke="#0b0b0b" stroke-width="1.3" d="M73 183 L100 206.5 L127 183 M76.5 183 L100 203.5 L123.5 183"/>' +
    '<g transform="translate(100 210)"><path class="wh" d="M0 0 C-8 -9 -19 -8 -17 2 C-16 9 -6 7 0 0 Z M0 0 C8 -9 19 -8 17 2 C16 9 6 7 0 0 Z"/>' +
      '<path fill="none" stroke="#0b0b0b" stroke-width="1" d="M-4 -1 C-9 -5 -13 -4 -14 0 M4 -1 C9 -5 13 -4 14 0"/>' +
      '<path class="wh" d="M-2 2 L-8 16 L-3 15 L0 19 Z M2 2 L8 16 L3 15 L0 19 Z"/><circle class="ink" r="3.4" stroke="#fff" stroke-width="1.4"/></g>' +
    '<rect class="ln" x="54" y="218" width="68" height="18" rx="9" transform="rotate(-7 88 227)"/>' +
    '<rect class="ln" x="78" y="218" width="68" height="18" rx="9" transform="rotate(7 112 227)"/>' +
    '<path class="st" style="stroke-width:1.3" d="M63 222 l1.5 13 M67 221 l1.5 13 M137 222 l-1.5 13 M133 221 l-1.5 13"/>' +
    // head
    '<g transform="rotate(-6 100 168)">' +
      '<path class="ln" d="M44 120 C38 60 70 34 100 34 C130 34 162 60 156 120 L160 176 C150 170 140 170 132 174 L128 150 L72 150 L68 174 C60 170 50 170 40 176 Z"/>' +
      '<path fill="url(#toneD)" opacity=".45" d="M44 120 L40 176 C50 170 60 170 68 174 L72 150 L60 150 C52 140 46 130 44 120 Z M156 120 L160 176 C150 170 140 170 132 174 L128 150 L140 150 C148 140 154 130 156 120 Z"/>' +
      '<clipPath id="' + face + '"><ellipse cx="100" cy="122" rx="52" ry="47"/></clipPath>' +
      '<ellipse class="ln" cx="100" cy="122" rx="52" ry="47"/>' +
      '<path clip-path="url(#' + face + ')" fill="url(#toneD)" opacity=".5" transform="translate(0 6)" d="' + BANGS + '"/>' +
      '<path class="ln" d="M50 110 C45 138 47 160 56 178 C58 158 59 136 62 118 Z"/><path class="ln" d="M150 110 C155 138 153 160 144 178 C142 158 141 136 138 118 Z"/>' +
      '<path fill="url(#toneD)" opacity=".5" d="M52 118 C49 140 50 156 55 170 C56 152 57 136 58 122 Z M148 118 C151 140 150 156 145 170 C144 152 143 136 142 122 Z"/>' +
      '<path class="ln" d="' + BANGS + '"/>' +
      '<path fill="url(#toneD)" opacity=".38" d="M52 104 C58 92 72 82 88 80 C84 89 82 98 83 108 C77 103 73 96 71 88 C65 95 62 104 63 114 C58 110 55 106 53 100 Z M148 104 C142 92 128 84 112 81 C118 88 120 98 117 109 C124 105 129 97 131 87 C137 94 139 104 136 115 C141 112 145 107 147 99 Z"/>' +
      shine() +
      '<path class="st" style="stroke-width:1.1;stroke-opacity:.6" d="M100 56 C99 70 100 84 99 96 M88 60 C86 68 86 74 88 80 M112 60 C114 68 114 74 112 80 M72 70 C70 76 70 82 71 88 M128 70 C130 76 130 82 131 87 M80 54 C76 60 74 66 74 72 M120 54 C124 60 126 66 126 72"/>' +
      '<path class="st" d="M102 36 C95 22 106 12 114 18 C107 18 103 23 105 35"/><path class="st" style="stroke-width:1;stroke-opacity:.6" d="M104 26 C103 22 106 19 109 19"/>' +
      '<g transform="translate(48 80)"><path class="wh" d="' + BOW + '"/><path fill="none" stroke="#0b0b0b" stroke-width="1" d="M-4 -1 C-10 -6 -16 -5 -18 0 M4 -1 C10 -6 16 -5 18 0"/><circle class="ink" r="3.8" stroke="#fff" stroke-width="1.6"/></g>' +
      '<g transform="translate(152 80)"><path class="wh" d="' + BOW + '"/><path fill="none" stroke="#0b0b0b" stroke-width="1" d="M-4 -1 C-10 -6 -16 -5 -18 0 M4 -1 C10 -6 16 -5 18 0"/><circle class="ink" r="3.8" stroke="#fff" stroke-width="1.6"/></g>' +
      // crescent hair clip (月)
      '<path class="wh" transform="translate(137 98) rotate(-20)" d="M0 -7 A7 7 0 1 0 6 5 A5.4 5.4 0 1 1 0 -7 Z"/>' + star(147, 94, .2) +
      // brows, eyes (looking away), blush, pout, hmph puff, sweat
      '<path class="st" style="stroke-width:2.4" d="M66 103 Q76 98 88 105"/><path class="st" style="stroke-width:2.4" d="M134 103 Q124 98 112 105"/>' +
      eye(79, 128, -3, 1) + eye(121, 128, -3, -1) +
      '<ellipse cx="68" cy="147" rx="12" ry="6.5" fill="#fff" fill-opacity=".13"/><ellipse cx="132" cy="147" rx="12" ry="6.5" fill="#fff" fill-opacity=".13"/>' +
      '<path class="st" style="stroke-width:1.6" d="M60 150 l5 -6 M66 151 l5 -6 M72 152 l5 -6 M123 152 l5 -6 M129 151 l5 -6 M135 150 l5 -6"/>' +
      '<path class="st" style="stroke-width:1.1;stroke-opacity:.7" d="M98 141 l1.4 1.6"/>' +
      '<path class="st" d="M94 154 Q100 150 106 154"/><path class="wh" d="M102.6 152.6 L104 156.2 L105.4 152.9 Z"/>' +
      '<path class="st" style="stroke-width:1.6" d="M150 150 q8 -2 10 -8 M154 156 q9 0 13 -5"/>' +
    '</g>';
  }

  // ---------------------------------------------------------------- chibi heads for the small panels (100 x 92 space)
  function chibi(mood) {
    var base =
      '<path class="ln" d="M10 60 C6 26 28 8 50 8 C72 8 94 26 90 60 L93 90 L7 90 Z"/>' +
      '<path class="ln" d="M12 40 C-2 52 -4 76 2 90 L14 90 C12 74 14 56 22 44 Z"/><path class="ln" d="M88 40 C102 52 104 76 98 90 L86 90 C88 74 86 56 78 44 Z"/>' +
      '<ellipse class="ln" cx="50" cy="56" rx="34" ry="31"/>' +
      '<path class="ln" d="M17 54 C16 24 33 14 50 14 C67 14 84 24 83 54 C80 50 78 46 77 42 C76 47 73 50 70 52 C71 45 70 39 66 35 C64 41 61 45 57 47 C58 40 57 34 54 30 C52 36 49 40 46 42 C45 36 43 32 39 30 C37 35 36 41 37 47 C33 44 31 40 30 35 C26 40 25 46 26 52 C23 50 21 47 20 43 C19 47 18 51 17 54 Z"/>' +
      '<g transform="translate(17 27) scale(.62)"><path class="wh" d="' + BOW + '"/><circle class="ink" r="3.8" stroke="#fff" stroke-width="1.6"/></g>' +
      '<g transform="translate(83 27) scale(.62)"><path class="wh" d="' + BOW + '"/><circle class="ink" r="3.8" stroke="#fff" stroke-width="1.6"/></g>' +
      '<path class="st" d="M51 9 C47 0 55 -6 60 -2 C55 -2 52 1 53 8"/>';
    var blush = '<path class="st" style="stroke-width:1.1;stroke-opacity:.85" d="M24 72 l3 -3 M28 73 l3 -3 M32 74 l3 -3 M66 74 l3 -3 M70 73 l3 -3 M74 72 l3 -3"/>';
    var openEyes = '<ellipse class="wh" cx="38" cy="60" rx="7.5" ry="9"/><ellipse class="wh" cx="62" cy="60" rx="7.5" ry="9"/>' +
      '<ellipse class="ink" cx="38.6" cy="61.5" rx="5.6" ry="7.2"/><ellipse class="ink" cx="61.4" cy="61.5" rx="5.6" ry="7.2"/>' +
      '<circle class="wh" cx="36.2" cy="58.6" r="2.3"/><circle class="wh" cx="59" cy="58.6" r="2.3"/>' +
      '<path class="st" style="stroke-width:2.4" d="M29.5 56 Q38 47 46.5 55 M53.5 55 Q62 47 70.5 56"/>';
    if (mood === 'angry') return base + openEyes.replace(/r="2.3"/g, 'r="1.6"') +
      '<path class="st" style="stroke-width:2.6" d="M28 46 L45 52 M72 46 L55 52"/>' + blush +
      '<path class="ln" d="M42 78 Q50 70 58 78 Q50 84 42 78 Z"/><path class="wh" d="M52.5 74.6 L53.7 77.6 L55 75.2 Z"/>' +
      '<path class="st" style="stroke-width:2.4" d="M80 12 l6 6 M86 12 l-6 6 M77 8 q4 4 0 8 M89 8 q-4 4 0 8"/>';
    if (mood === 'shy') return base +
      '<path class="st" style="stroke-width:2.6" d="M30 62 Q38 53 46 62 M54 62 Q62 53 70 62"/>' +
      '<ellipse cx="27" cy="72" rx="9" ry="5" fill="#fff" fill-opacity=".18"/><ellipse cx="73" cy="72" rx="9" ry="5" fill="#fff" fill-opacity=".18"/>' + blush +
      '<path class="st" d="M44 75 Q50 81 56 75"/><path class="wh" d="M52 75.8 L53.2 78.6 L54.4 76.2 Z"/>';
    if (mood === 'sleep') return base +
      '<path class="st" style="stroke-width:2.4" d="M30 60 Q38 65 46 60 M54 60 Q62 65 70 60"/>' + blush +
      '<ellipse class="st" cx="50" cy="76" rx="3" ry="2.4"/><circle cx="58" cy="70" r="5" fill="none" stroke="#fff" stroke-width="1.4"/><circle cx="56.5" cy="68.5" r="1.2" fill="#fff"/>';
    return base + openEyes + blush + '<path class="st" d="M46 76 Q50 73.5 54 76"/><path class="wh" d="M51.6 75 L52.6 77.4 L53.6 75.2 Z"/>';
  }
  return { defs: defs, star: star, heart: heart, petal: petal, petals: petals, stars: stars, focus: focus, cloud: cloud, moon: moon,
           girl: girl, chibi: chibi, reseed: reseed, rnd: rnd };
})();
