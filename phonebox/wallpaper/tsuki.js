// Shared drawing for the Tsuki wallpapers: the character (same design as the panel mascot, a "looking away, pouting"
// tsundere pose), the crescent moon (月 = tsuki), manga focus lines, screentone and sparkles. Pure SVG strings.
var TSUKI = (function () {
  var NS = 'http://www.w3.org/2000/svg';
  var BOW = 'M0 0 C-11 -13 -24 -6 -17 7 C-12 13 -4 7 0 0 Z M0 0 C11 -13 24 -6 17 7 C12 13 4 7 0 0 Z';
  function star(x, y, s, o) {
    return '<path fill="#fff" opacity="' + (o || 1) + '" transform="translate(' + x + ' ' + y + ') scale(' + s + ')" d="M0 -10 L2.6 -2.6 L10 0 L2.6 2.6 L0 10 L-2.6 2.6 L-10 0 L-2.6 -2.6 Z"/>';
  }
  function heart(x, y, s, filled) {
    return '<path transform="translate(' + x + ' ' + y + ') scale(' + s + ')" fill="' + (filled ? '#fff' : 'none') + '" stroke="#fff" stroke-width="' + (2 / s) + '" ' +
      'd="M0 8 C-8 3 -12 -1 -12 -5 C-12 -9 -9 -11 -6 -11 C-3 -11 -1 -9 0 -7 C1 -9 3 -11 6 -11 C9 -11 12 -9 12 -5 C12 -1 8 3 0 8 Z"/>';
  }
  // the character in her own 200 x 250 coordinate space
  var girl =
    '<g class="tailL"><path class="ln" d="M48 82 C22 98 14 140 22 178 C26 200 18 218 8 230 C30 228 40 212 40 190 C40 160 42 124 60 98 Z"/><path class="st" d="M8 230 C1 236 5 245 14 241"/></g>' +
    '<g class="tailR"><path class="ln" d="M152 82 C178 98 186 140 178 178 C174 200 182 218 192 230 C170 228 160 212 160 190 C160 160 158 124 140 98 Z"/><path class="st" d="M192 230 C199 236 195 245 186 241"/></g>' +
    '<path class="ln" d="M92 160 L92 176 L108 176 L108 160 Z"/>' +
    '<path class="ln" d="M60 190 C64 177 136 177 140 190 L152 252 L48 252 Z"/>' +
    '<path class="wh" d="M70 182 L100 208 L130 182 L124 179 L100 199 L76 179 Z"/>' +
    '<path class="st" style="stroke:#0b0b0b;stroke-width:1.4" d="M77 186 L100 205 L123 186"/>' +
    '<path class="wh" d="M100 208 L89 202 L90 216 Z M100 208 L111 202 L110 216 Z"/><circle class="ink" cx="100" cy="208" r="3" stroke="#fff" stroke-width="1.4"/>' +
    '<rect class="ln" x="54" y="216" width="68" height="18" rx="9" transform="rotate(-7 88 225)"/>' +
    '<rect class="ln" x="78" y="216" width="68" height="18" rx="9" transform="rotate(7 112 225)"/>' +
    '<path class="st" d="M62 222 l4 -1 M134 222 l-4 -1" style="stroke-width:1.4"/>' +
    '<g transform="rotate(-6 100 168)">' +
      '<path class="ln" d="M44 120 C38 60 70 34 100 34 C130 34 162 60 156 120 L160 176 C150 170 140 170 132 174 L128 150 L72 150 L68 174 C60 170 50 170 40 176 Z"/>' +
      '<ellipse class="ln" cx="100" cy="122" rx="52" ry="47"/>' +
      '<path class="ln" d="M50 110 C45 138 47 160 56 178 C58 158 59 136 62 118 Z"/><path class="ln" d="M150 110 C155 138 153 160 144 178 C142 158 141 136 138 118 Z"/>' +
      '<path class="ln" d="M46 118 C44 72 70 50 100 50 C130 50 156 72 154 118 C150 112 148 106 147 99 C145 107 141 112 136 115 C139 104 137 94 131 87 C129 97 124 105 117 109 C120 98 118 88 112 81 C108 91 104 97 99 101 C98 92 94 85 88 80 C84 89 82 98 83 108 C77 103 73 96 71 88 C65 95 62 104 63 114 C58 110 55 106 53 100 C51 107 48 112 46 118 Z"/>' +
      '<path class="st" style="stroke-width:1.1;stroke-opacity:.55" d="M100 56 C99 70 100 84 99 96 M88 60 C86 68 86 74 88 80 M112 60 C114 68 114 74 112 80 M72 70 C70 76 70 82 71 88 M128 70 C130 76 130 82 131 87"/>' +
      '<path class="st" d="M102 36 C95 22 106 12 114 18 C107 18 103 23 105 35"/>' +
      '<g transform="translate(48 80)"><path class="wh" d="' + BOW + '"/><circle class="ink" r="3.8" stroke="#fff" stroke-width="1.6"/></g>' +
      '<g transform="translate(152 80)"><path class="wh" d="' + BOW + '"/><circle class="ink" r="3.8" stroke="#fff" stroke-width="1.6"/></g>' +
      // brows: a little worried-angry, the classic "it's not like I care" face
      '<path class="st" style="stroke-width:2.4" d="M66 103 Q76 98 88 105"/><path class="st" style="stroke-width:2.4" d="M134 103 Q124 98 112 105"/>' +
      // eyes looking away (irises shifted to her right)
      '<ellipse class="wh" cx="79" cy="128" rx="11.5" ry="13.5"/><ellipse class="wh" cx="121" cy="128" rx="11.5" ry="13.5"/>' +
      '<ellipse class="ink" cx="76" cy="130" rx="8.6" ry="11"/><ellipse cx="76" cy="131" rx="5.6" ry="7.4" fill="none" stroke="#fff" stroke-width=".8" stroke-opacity=".45"/>' +
      '<circle class="wh" cx="72.5" cy="126.5" r="3.4"/><circle class="wh" cx="79.5" cy="135" r="1.6"/>' +
      '<ellipse class="ink" cx="116" cy="130" rx="8.6" ry="11"/><ellipse cx="116" cy="131" rx="5.6" ry="7.4" fill="none" stroke="#fff" stroke-width=".8" stroke-opacity=".45"/>' +
      '<circle class="wh" cx="112.5" cy="126.5" r="3.4"/><circle class="wh" cx="119.5" cy="135" r="1.6"/>' +
      '<path class="st" style="stroke-width:3.4" d="M66 122 Q79 108 92 120 M108 120 Q121 108 134 122"/><path class="st" style="stroke-width:2.2" d="M66 122 l-4 -3 M134 122 l4 -3"/>' +
      // strong blush
      '<ellipse cx="68" cy="146" rx="11" ry="6" fill="#fff" fill-opacity=".2"/><ellipse cx="132" cy="146" rx="11" ry="6" fill="#fff" fill-opacity=".2"/>' +
      '<path class="st" style="stroke-width:1.6" d="M60 150 l5 -6 M66 151 l5 -6 M72 152 l5 -6 M123 152 l5 -6 M129 151 l5 -6 M135 150 l5 -6"/>' +
      // pout with a fang
      '<path class="st" d="M94 154 Q100 150 106 154"/><path class="wh" d="M102.6 152.6 L104 156.2 L105.4 152.9 Z"/>' +
      // a puff of "hmph"
      '<path class="st" style="stroke-width:1.6" d="M150 150 q8 -2 10 -8 M154 156 q9 0 13 -5"/>' +
    '</g>';
  // manga focus lines (集中線) around a point, deterministic so every render is identical
  function focus(cx, cy, r0, r1, n, op) {
    var s = '', seed = 7;
    function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
    for (var i = 0; i < n; i++) {
      var a = i / n * Math.PI * 2 + rnd() * .03, w = .002 + rnd() * .006, ri = r0 + rnd() * (r1 - r0) * .25;
      var x1 = cx + Math.cos(a - w) * r1, y1 = cy + Math.sin(a - w) * r1, x2 = cx + Math.cos(a + w) * r1, y2 = cy + Math.sin(a + w) * r1;
      var xi = cx + Math.cos(a) * ri, yi = cy + Math.sin(a) * ri;
      s += '<path d="M' + xi.toFixed(1) + ' ' + yi.toFixed(1) + ' L' + x1.toFixed(1) + ' ' + y1.toFixed(1) + ' L' + x2.toFixed(1) + ' ' + y2.toFixed(1) + ' Z"/>';
    }
    return '<g fill="#fff" opacity="' + op + '">' + s + '</g>';
  }
  function moon(cx, cy, r, id) {  // crescent filled with screentone, cut by an offset circle
    return '<mask id="' + id + '"><rect x="0" y="0" width="100%" height="100%" fill="#000"/><circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="#fff"/>' +
      '<circle cx="' + (cx + r * .42) + '" cy="' + (cy - r * .26) + '" r="' + (r * .86) + '" fill="#000"/></mask>' +
      '<clipPath id="' + id + 'c"><circle cx="' + cx + '" cy="' + cy + '" r="' + r + '"/></clipPath>' +
      '<g mask="url(#' + id + ')"><circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="url(#tone)"/><circle cx="' + cx + '" cy="' + cy + '" r="' + (r - 2) + '" fill="none" stroke="#fff" stroke-width="4"/></g>' +
      // the inner edge: the cutting circle's outline, kept only where it lies inside the moon
      '<circle cx="' + (cx + r * .42) + '" cy="' + (cy - r * .26) + '" r="' + (r * .86) + '" fill="none" stroke="#fff" stroke-width="3" clip-path="url(#' + id + 'c)"/>';
  }
  var defs = '<defs><pattern id="tone" width="9" height="9" patternUnits="userSpaceOnUse"><circle cx="4.5" cy="4.5" r="1.7" fill="#fff"/></pattern>' +
    '<pattern id="toneS" width="12" height="12" patternUnits="userSpaceOnUse"><circle cx="6" cy="6" r="1.5" fill="#fff"/></pattern>' +
    '<style>.ln{fill:#0b0b0b;stroke:#fff;stroke-width:2;stroke-linejoin:round;stroke-linecap:round}.st{fill:none;stroke:#fff;stroke-width:2;stroke-linejoin:round;stroke-linecap:round}.wh{fill:#fff}.ink{fill:#0b0b0b}</style></defs>';
  return { girl: girl, star: star, heart: heart, focus: focus, moon: moon, defs: defs, NS: NS };
})();
