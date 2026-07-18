/* ==========================================================================
   G.S.R.S. — viewer.js
   A tiny dependency-free 3D solid viewer (canvas 2D + painter's algorithm).
   - Drag to rotate every shape and see its other sides.
   - Click a measurement name to highlight where it is on the shape.
   - Also renders small static thumbnails for the home page.
   Works entirely offline; no libraries.
   ========================================================================== */
window.GSRS = (function () {
  "use strict";

  /* ---- colours ---------------------------------------------------------- */
  var C_LIGHT = [206, 226, 247];  // lit face
  var C_DARK  = [79, 122, 176];   // shaded face
  var C_EDGE  = "#243a56";
  var C_HIDDEN = "#8fa5c0";       // dashed edges hidden behind the solid
  var C_HL    = "#e2571f";        // highlight (orange)
  var LIGHT   = normalize([-0.4, 0.62, 0.68]);

  /* ---- vector helpers --------------------------------------------------- */
  function normalize(v) {
    var m = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / m, v[1] / m, v[2] / m];
  }
  function sub(a, b) { return [a[0]-b[0], a[1]-b[1], a[2]-b[2]]; }
  function cross(a, b) {
    return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
  }
  function dot(a, b) { return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]; }
  function rot(p, rx, ry) {
    var x = p[0], y = p[1], z = p[2];
    var cy = Math.cos(ry), sy = Math.sin(ry);
    var x1 = x*cy + z*sy, z1 = -x*sy + z*cy;
    var cx = Math.cos(rx), sx = Math.sin(rx);
    var y2 = y*cx - z1*sx, z2 = y*sx + z1*cx;
    return [x1, y2, z2];
  }

  /* ---- geometry builders ------------------------------------------------ */
  // Regular n-gon prism, axis vertical (Y up); polygon lies in the XZ plane.
  function prism(n, r, h) {
    var top = [], bot = [], i, a;
    for (i = 0; i < n; i++) {
      a = Math.PI / 2 + i * 2 * Math.PI / n;
      top.push([r*Math.cos(a), h, r*Math.sin(a)]);
      bot.push([r*Math.cos(a), -h, r*Math.sin(a)]);
    }
    var verts = top.concat(bot);
    var faces = [];
    var t = []; for (i = 0; i < n; i++) t.push(i); faces.push(t);
    var b = []; for (i = n-1; i >= 0; i--) b.push(n+i); faces.push(b);
    for (i = 0; i < n; i++) {
      var j = (i+1) % n;
      faces.push([i, j, n+j, n+i]);
    }
    return { verts: verts, faces: faces };
  }

  // UV sphere scaled to (rx,ry,rz). half=true -> hemisphere (y>=0) + base disk.
  function ball(rx, ry, rz, latN, lonN, half) {
    var verts = [], faces = [], i, j;
    var lat0 = half ? 0 : -latN;      // latitude index range
    var rows = [];
    for (i = lat0; i <= latN; i++) {
      var phi = (i / (2*latN)) * Math.PI;          // -pi/2 .. pi/2
      var row = [];
      var y = Math.sin(phi);
      var cr = Math.cos(phi);
      for (j = 0; j < lonN; j++) {
        var th = j * 2 * Math.PI / lonN;
        row.push(verts.length);
        verts.push([rx*cr*Math.cos(th), ry*y, rz*cr*Math.sin(th)]);
      }
      rows.push(row);
    }
    for (i = 0; i < rows.length-1; i++) {
      for (j = 0; j < lonN; j++) {
        var j2 = (j+1) % lonN;
        faces.push([rows[i][j], rows[i][j2], rows[i+1][j2], rows[i+1][j]]);
      }
    }
    if (half) {
      // base disk at y=0 (first row is the equator)
      var eq = rows[0], center = verts.length;
      verts.push([0, 0, 0]);
      for (j = 0; j < lonN; j++)
        faces.push([center, eq[(j+1)%lonN], eq[j]]);
    }
    return { verts: verts, faces: faces };
  }

  // Cylinder, axis vertical, radius r, half-height h.
  function cyl(r, h, seg) {
    var verts = [], faces = [], top = [], bot = [], i;
    for (i = 0; i < seg; i++) {
      var a = i * 2 * Math.PI / seg;
      top.push(verts.length); verts.push([r*Math.cos(a), h, r*Math.sin(a)]);
    }
    for (i = 0; i < seg; i++) {
      var a2 = i * 2 * Math.PI / seg;
      bot.push(verts.length); verts.push([r*Math.cos(a2), -h, r*Math.sin(a2)]);
    }
    var tc = verts.length; verts.push([0, h, 0]);
    var bc = verts.length; verts.push([0, -h, 0]);
    for (i = 0; i < seg; i++) {
      var j = (i+1) % seg;
      faces.push([top[i], top[j], bot[j], bot[i]]);   // side
      faces.push([tc, top[j], top[i]]);               // top cap
      faces.push([bc, bot[i], bot[j]]);               // bottom cap
    }
    return { verts: verts, faces: faces };
  }

  // Cone, base radius r at y=-h, apex at y=+h2.
  function cone(r, h, apexY, seg) {
    var verts = [], faces = [], ring = [], i;
    for (i = 0; i < seg; i++) {
      var a = i * 2 * Math.PI / seg;
      ring.push(verts.length); verts.push([r*Math.cos(a), -h, r*Math.sin(a)]);
    }
    var apex = verts.length; verts.push([0, apexY, 0]);
    var bc = verts.length; verts.push([0, -h, 0]);
    for (i = 0; i < seg; i++) {
      var j = (i+1) % seg;
      faces.push([ring[i], ring[j], apex]);   // side
      faces.push([bc, ring[j], ring[i]]);      // base
    }
    return { verts: verts, faces: faces };
  }

  // Axis-aligned box from half-extents.
  function box(hx, hy, hz) {
    var v = [[-hx,-hy,-hz],[hx,-hy,-hz],[hx,hy,-hz],[-hx,hy,-hz],
             [-hx,-hy,hz],[hx,-hy,hz],[hx,hy,hz],[-hx,hy,hz]];
    var f = [[0,1,2,3],[7,6,5,4],[0,4,5,1],[1,5,6,2],[2,6,7,3],[3,7,4,0]];
    return { verts: v, faces: f };
  }
  // Square pyramid: base half-side ha, total height h.
  function pyr(ha, h) {
    var by = -h/2, ay = h/2;
    var v = [[-ha,by,-ha],[ha,by,-ha],[ha,by,ha],[-ha,by,ha],[0,ay,0]];
    var f = [[0,1,2,3],[0,1,4],[1,2,4],[2,3,4],[3,0,4]];
    return { verts: v, faces: f };
  }
  function scaleGeo(g, target) {
    var maxR = 0;
    g.verts.forEach(function (p) { maxR = Math.max(maxR, Math.hypot(p[0],p[1],p[2])); });
    var k = target / (maxR || 1);
    g.verts = g.verts.map(function (p) { return [p[0]*k, p[1]*k, p[2]*k]; });
    return g;
  }
  // Build a shape to scale from real dimensions (proportions preserved).
  function buildScaled(key, d) {
    var g, smooth = false;
    switch (key) {
      case "cube": g = box(1,1,1); break;
      case "cuboid": g = box(d.l, d.h, d.w); break;
      case "cylinder": g = cyl(d.r, d.h/2, 40); smooth = true; break;
      case "cone": g = cone(d.r, d.h/2, d.h/2, 40); smooth = true; break;
      case "sphere": g = ball(1,1,1, 16,28, false); smooth = true; break;
      case "hemisphere": g = ball(1,1,1, 16,28, true); smooth = true; break;
      case "ellipsoid": g = ball(d.a,d.b,d.c, 16,28, false); smooth = true; break;
      case "square-pyramid": g = pyr(d.a/2, d.h); break;
      case "triangular-prism": g = prism(3, d.a/Math.sqrt(3), d.L/2); break;
      case "pentagonal-prism": g = prism(5, d.a/(2*Math.sin(Math.PI/5)), d.h/2); break;
      case "hexagonal-prism": g = prism(6, d.a, d.h/2); break;
      default: g = SHAPES[key].build();
    }
    g.smooth = smooth; g.measures = [];
    return scaleGeo(g, 1.35);
  }

  /* ---- shape registry --------------------------------------------------- */
  // Each entry: name, category, build() -> {verts, faces, smooth, measures}
  // measures: [{key,label,segs:[[p0,p1],...]}]
  var S = 1;
  var SHAPES = {
    cube: {
      name: "Cube", cat: "boxes",
      build: function () {
        var v = [[-S,-S,-S],[S,-S,-S],[S,S,-S],[-S,S,-S],
                 [-S,-S,S],[S,-S,S],[S,S,S],[-S,S,S]];
        var f = [[0,1,2,3],[7,6,5,4],[0,4,5,1],[1,5,6,2],[2,6,7,3],[3,7,4,0]];
        return { verts: v, faces: f, smooth: false, measures: [
          { key:"edge", label:"Edge (s)", segs:[[[-S,-S,S],[S,-S,S]]] },
          { key:"face-diagonal", label:"Face diagonal", segs:[[[-S,-S,S],[S,S,S]]] },
          { key:"space-diagonal", label:"Space diagonal", segs:[[[-S,-S,-S],[S,S,S]]] }
        ]};
      }
    },
    cuboid: {
      name: "Cuboid", cat: "boxes",
      build: function () {
        var l=1.5, w=0.95, h=1.15;
        var v = [[-l,-h,-w],[l,-h,-w],[l,h,-w],[-l,h,-w],
                 [-l,-h,w],[l,-h,w],[l,h,w],[-l,h,w]];
        var f = [[0,1,2,3],[7,6,5,4],[0,4,5,1],[1,5,6,2],[2,6,7,3],[3,7,4,0]];
        return { verts: v, faces: f, smooth: false, measures: [
          { key:"length", label:"Length (l)", segs:[[[-l,-h,w],[l,-h,w]]] },
          { key:"width", label:"Width (w)", segs:[[[l,-h,-w],[l,-h,w]]] },
          { key:"height", label:"Height (h)", segs:[[[l,-h,w],[l,h,w]]] },
          { key:"space-diagonal", label:"Space diagonal", segs:[[[-l,-h,-w],[l,h,w]]] }
        ]};
      }
    },
    "triangular-prism": {
      name: "Triangular Prism", cat: "boxes",
      build: function () {
        var g = prism(3, 1.15, 1.4);
        var top = g.verts.slice(0,3);
        return { verts: g.verts, faces: g.faces, smooth:false, measures:[
          { key:"base-edge", label:"Base edge (a)", segs:[[top[0], top[1]]] },
          { key:"length", label:"Length (L)", segs:[[g.verts[0], g.verts[3]]] }
        ]};
      }
    },
    "pentagonal-prism": {
      name: "Pentagonal Prism", cat: "boxes",
      build: function () {
        var g = prism(5, 1.05, 1.35);
        return { verts: g.verts, faces: g.faces, smooth:false, measures:[
          { key:"base-edge", label:"Base edge (a)", segs:[[g.verts[0], g.verts[1]]] },
          { key:"height", label:"Height (h)", segs:[[g.verts[0], g.verts[5]]] }
        ]};
      }
    },
    "hexagonal-prism": {
      name: "Hexagonal Prism", cat: "boxes",
      build: function () {
        var g = prism(6, 1.05, 1.35);
        return { verts: g.verts, faces: g.faces, smooth:false, measures:[
          { key:"base-edge", label:"Base edge (a)", segs:[[g.verts[0], g.verts[1]]] },
          { key:"height", label:"Height (h)", segs:[[g.verts[0], g.verts[6]]] }
        ]};
      }
    },
    "square-pyramid": {
      name: "Square Pyramid", cat: "points",
      build: function () {
        var a=1.15, by=-0.7, ay=1.5;
        var v = [[-a,by,-a],[a,by,-a],[a,by,a],[-a,by,a],[0,ay,0]];
        var f = [[0,1,2,3],[0,1,4],[1,2,4],[2,3,4],[3,0,4]];
        return { verts:v, faces:f, smooth:false, measures:[
          { key:"base-edge", label:"Base edge (a)", segs:[[[-a,by,a],[a,by,a]]] },
          { key:"height", label:"Height (h)", segs:[[[0,by,0],[0,ay,0]]] },
          { key:"slant", label:"Slant height (l)", segs:[[[0,by,a],[0,ay,0]]] }
        ]};
      }
    },
    cone: {
      name: "Cone", cat: "points",
      build: function () {
        var r=1.1, h=0.75, ay=1.45;
        var g = cone(r, h, ay, 40);
        return { verts:g.verts, faces:g.faces, smooth:true, measures:[
          { key:"radius", label:"Radius (r)", segs:[[[0,-h,0],[r,-h,0]]] },
          { key:"height", label:"Height (h)", segs:[[[0,-h,0],[0,ay,0]]] },
          { key:"slant", label:"Slant height (l)", segs:[[[r,-h,0],[0,ay,0]]] }
        ]};
      }
    },
    sphere: {
      name: "Sphere", cat: "round",
      build: function () {
        var g = ball(1.25,1.25,1.25, 16, 28, false);
        return { verts:g.verts, faces:g.faces, smooth:true, measures:[
          { key:"radius", label:"Radius (r)", segs:[[[0,0,0],[1.25,0,0]]] },
          { key:"diameter", label:"Diameter (d)", segs:[[[-1.25,0,0],[1.25,0,0]]] }
        ]};
      }
    },
    cylinder: {
      name: "Cylinder", cat: "round",
      build: function () {
        var r=0.95, h=1.25;
        var g = cyl(r, h, 40);
        return { verts:g.verts, faces:g.faces, smooth:true, measures:[
          { key:"radius", label:"Radius (r)", segs:[[[0,h,0],[r,h,0]]] },
          { key:"height", label:"Height (h)", segs:[[[r,-h,0],[r,h,0]]] }
        ]};
      }
    },
    hemisphere: {
      name: "Hemisphere", cat: "round",
      build: function () {
        var g = ball(1.3,1.3,1.3, 16, 28, true);
        return { verts:g.verts, faces:g.faces, smooth:true, measures:[
          { key:"radius", label:"Radius (r)", segs:[[[0,0,0],[1.3,0,0]]] }
        ]};
      }
    },
    ellipsoid: {
      name: "Ellipsoid", cat: "round",
      build: function () {
        var a=1.5,b=0.95,c=0.7;
        var g = ball(a,b,c, 16, 28, false);
        return { verts:g.verts, faces:g.faces, smooth:true, measures:[
          { key:"a", label:"Semi-axis a", segs:[[[0,0,0],[a,0,0]]] },
          { key:"b", label:"Semi-axis b", segs:[[[0,0,0],[0,b,0]]] },
          { key:"c", label:"Semi-axis c", segs:[[[0,0,0],[0,0,c]]] }
        ]};
      }
    }
  };

  var ORDER = {
    boxes:  ["cube","cuboid","triangular-prism","pentagonal-prism","hexagonal-prism"],
    points: ["square-pyramid","cone"],
    round:  ["sphere","cylinder","hemisphere","ellipsoid"]
  };

  /* ---- prep: outward normals + edge map --------------------------------- */
  function prep(geo) {
    var centroid = [0,0,0], n = geo.verts.length, i, k;
    for (i = 0; i < n; i++) for (k = 0; k < 3; k++) centroid[k] += geo.verts[i][k]/n;
    geo.fnorm = geo.faces.map(function (f) {
      var nrm = normalize(cross(sub(geo.verts[f[1]], geo.verts[f[0]]),
                                sub(geo.verts[f[2]], geo.verts[f[0]])));
      var fc = [0,0,0];
      f.forEach(function (idx) { for (k=0;k<3;k++) fc[k]+=geo.verts[idx][k]/f.length; });
      if (dot(nrm, sub(fc, centroid)) < 0) nrm = [-nrm[0],-nrm[1],-nrm[2]];
      return nrm;
    });
    var em = {};
    geo.faces.forEach(function (f, fi) {
      for (i = 0; i < f.length; i++) {
        var a = f[i], b = f[(i+1)%f.length];
        var key = Math.min(a,b) + "_" + Math.max(a,b);
        (em[key] || (em[key] = { a:a, b:b, faces:[] })).faces.push(fi);
      }
    });
    geo.edges = Object.keys(em).map(function (k2) { return em[k2]; });
    // A "crease" is a real edge you'd draw (sharp fold). Smooth tessellation
    // seams on spheres/cylinders are not creases, so they stay invisible.
    geo.edges.forEach(function (e) {
      if (e.faces.length === 2) {
        e.crease = dot(geo.fnorm[e.faces[0]], geo.fnorm[e.faces[1]]) < 0.94;
      } else {
        e.crease = true;
      }
    });
    return geo;
  }

  /* ---- render ----------------------------------------------------------- */
  function render(ctx, W, H, geo, rx, ry, hlKey, dpr) {
    ctx.clearRect(0, 0, W, H);
    var i, k;
    var RV = geo.verts.map(function (p) { return rot(p, rx, ry); });
    var RN = geo.fnorm.map(function (nn) { return rot(nn, rx, ry); });
    var maxR = 0;
    geo.verts.forEach(function (p) { maxR = Math.max(maxR, Math.hypot(p[0],p[1],p[2])); });
    var pad = Math.min(W, H) * 0.08;
    var scale = Math.max(1, (Math.min(W, H) / 2 - pad) / maxR);
    var cx = W/2, cy = H/2;
    function P(v) { return [cx + v[0]*scale, cy - v[1]*scale]; }

    // faces back-to-front
    var order = geo.faces.map(function (f, fi) {
      var z = 0; f.forEach(function (idx) { z += RV[idx][2]/f.length; });
      return { fi: fi, z: z };
    }).sort(function (p, q) { return p.z - q.z; });

    order.forEach(function (o) {
      var f = geo.faces[o.fi], nrm = RN[o.fi];
      var b = 0.42 + 0.58 * Math.max(0, dot(nrm, LIGHT));
      var col = "rgb(" + Math.round(C_DARK[0]+(C_LIGHT[0]-C_DARK[0])*b) + "," +
                         Math.round(C_DARK[1]+(C_LIGHT[1]-C_DARK[1])*b) + "," +
                         Math.round(C_DARK[2]+(C_LIGHT[2]-C_DARK[2])*b) + ")";
      ctx.beginPath();
      f.forEach(function (idx, m) {
        var s = P(RV[idx]);
        if (m === 0) ctx.moveTo(s[0], s[1]); else ctx.lineTo(s[0], s[1]);
      });
      ctx.closePath();
      ctx.fillStyle = col;
      ctx.fill();
      if (geo.smooth) { ctx.strokeStyle = col; ctx.lineWidth = 1*dpr; ctx.stroke(); }
    });

    // Edges. Real edges (creases, outlines) are drawn every frame; the ones
    // facing away from you are dashed, exactly like a technical drawing.
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    var toDraw = [];
    geo.edges.forEach(function (e) {
      var front = 0;
      e.faces.forEach(function (fi) { if (RN[fi][2] > 0) front++; });
      var boundary = e.faces.length === 1;
      var silhouette = e.faces.length === 2 && front === 1;
      if (!(e.crease || boundary || silhouette)) return;
      toDraw.push({ e: e, hidden: front === 0 });
    });
    // hidden edges first, dashed and lighter
    ctx.setLineDash([5 * dpr, 4 * dpr]);
    ctx.strokeStyle = C_HIDDEN;
    ctx.lineWidth = 1.2 * dpr;
    toDraw.forEach(function (d) {
      if (!d.hidden) return;
      var s0 = P(RV[d.e.a]), s1 = P(RV[d.e.b]);
      ctx.beginPath(); ctx.moveTo(s0[0], s0[1]); ctx.lineTo(s1[0], s1[1]); ctx.stroke();
    });
    // visible edges solid on top
    ctx.setLineDash([]);
    ctx.strokeStyle = C_EDGE;
    ctx.lineWidth = 1.5 * dpr;
    toDraw.forEach(function (d) {
      if (d.hidden) return;
      var s0 = P(RV[d.e.a]), s1 = P(RV[d.e.b]);
      ctx.beginPath(); ctx.moveTo(s0[0], s0[1]); ctx.lineTo(s1[0], s1[1]); ctx.stroke();
    });

    // highlight measurement
    if (hlKey) {
      var meas = null;
      geo.measures.forEach(function (m) { if (m.key === hlKey) meas = m; });
      if (meas) meas.segs.forEach(function (seg) {
        var A = rot(seg[0], rx, ry), B = rot(seg[1], rx, ry);
        var behind = (A[2] + B[2]) / 2 < 0;
        var a = P(A), b = P(B);
        ctx.setLineDash(behind ? [6*dpr, 5*dpr] : []);
        ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 6*dpr;
        ctx.beginPath(); ctx.moveTo(a[0],a[1]); ctx.lineTo(b[0],b[1]); ctx.stroke();
        ctx.strokeStyle = C_HL; ctx.lineWidth = 3*dpr;
        ctx.beginPath(); ctx.moveTo(a[0],a[1]); ctx.lineTo(b[0],b[1]); ctx.stroke();
        ctx.setLineDash([]);
        [a, b].forEach(function (pt) {
          ctx.beginPath(); ctx.arc(pt[0], pt[1], 3.4*dpr, 0, 7);
          ctx.fillStyle = C_HL; ctx.fill();
          ctx.lineWidth = 1.5*dpr; ctx.strokeStyle = "#fff"; ctx.stroke();
        });
      });
    }
  }

  /* ---- mount ------------------------------------------------------------ */
  function sizeCanvas(canvas) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var rect = canvas.getBoundingClientRect();
    var w = rect.width || parseInt(canvas.getAttribute("width")) || 300;
    var h = rect.height || parseInt(canvas.getAttribute("height")) || 260;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    return dpr;
  }

  function mount(canvas, key, opts) {
    opts = opts || {};
    var geo = prep(opts.geo ? opts.geo : SHAPES[key].build());
    var ctx = canvas.getContext("2d");
    var rx = opts.rx != null ? opts.rx : -0.42;
    var ry = opts.ry != null ? opts.ry : 0.7;
    var hl = null;
    var dpr = sizeCanvas(canvas);
    var spin = opts.autospin !== false && opts.interactive;
    var dragging = false, lastX = 0, lastY = 0, idle = 0, stopped = false;

    function frame() {
      render(ctx, canvas.width, canvas.height, geo, rx, ry, hl, dpr);
    }
    function loop() {
      if (stopped) return;
      if (spin && !dragging) { ry += 0.006; }
      frame();
      if (opts.interactive) requestAnimationFrame(loop);
    }

    if (opts.interactive) {
      canvas.style.cursor = "grab";
      var down = function (e) {
        dragging = true; spin = false; idle = 0;
        canvas.style.cursor = "grabbing";
        var p = pt(e); lastX = p.x; lastY = p.y;
        e.preventDefault();
      };
      var move = function (e) {
        if (!dragging) return;
        var p = pt(e);
        ry += (p.x - lastX) * 0.01;
        rx += (p.y - lastY) * 0.01;
        rx = Math.max(-1.4, Math.min(1.4, rx));
        lastX = p.x; lastY = p.y;
        e.preventDefault();
      };
      var up = function () { dragging = false; canvas.style.cursor = "grab"; };
      function pt(e) {
        var t = e.touches ? e.touches[0] : e;
        return { x: t.clientX, y: t.clientY };
      }
      canvas.addEventListener("mousedown", down);
      window.addEventListener("mousemove", move);
      window.addEventListener("mouseup", up);
      canvas.addEventListener("touchstart", down, { passive:false });
      canvas.addEventListener("touchmove", move, { passive:false });
      canvas.addEventListener("touchend", up);
      loop();
    } else {
      frame();
    }

    return {
      geo: geo,
      setHighlight: function (k) { hl = k; if (!opts.interactive) frame(); },
      redraw: frame,
      stop: function () { stopped = true; },
      measures: geo.measures
    };
  }

  /* ======================================================================
     2D (flat) shapes — drawn face-on, with the same highlight system.
     ====================================================================== */
  function reg2(n, r, start) {
    var p = [], i;
    for (i = 0; i < n; i++) {
      var a = (start === undefined ? 90 : start) * Math.PI/180 + i * 2*Math.PI/n;
      p.push([r*Math.cos(a), r*Math.sin(a)]);
    }
    return p;
  }
  var SQ = [[-1,-1],[1,-1],[1,1],[-1,1]];
  var RECT = [[-1.4,-0.85],[1.4,-0.85],[1.4,0.85],[-1.4,0.85]];
  var TRI = reg2(3, 1.2);
  var PARA = [[-1.4,-0.75],[0.6,-0.75],[1.4,0.75],[-0.6,0.75]];
  var RHOM = [[0,-1.2],[1.05,0],[0,1.2],[-1.05,0]];
  var TRAP = [[-1.4,-0.75],[1.4,-0.75],[0.75,0.75],[-0.75,0.75]];

  var SHAPES2D = {
    circle:   { name:"Circle", round:{ a:1.2, b:1.2 }, measures:[
                  { key:"radius", label:"Radius (r)", segs:[[[0,0],[1.2,0]]] },
                  { key:"diameter", label:"Diameter (d)", segs:[[[-1.2,0],[1.2,0]]] } ] },
    ellipse:  { name:"Ellipse", round:{ a:1.45, b:0.9 }, measures:[
                  { key:"a", label:"Long radius (a)", segs:[[[0,0],[1.45,0]]] },
                  { key:"b", label:"Short radius (b)", segs:[[[0,0],[0,0.9]]] } ] },
    square:   { name:"Square", poly:SQ, measures:[
                  { key:"side", label:"Side (s)", segs:[[[-1,-1],[1,-1]]] },
                  { key:"diagonal", label:"Diagonal", segs:[[[-1,-1],[1,1]]] } ] },
    rectangle:{ name:"Rectangle", poly:RECT, measures:[
                  { key:"length", label:"Length (l)", segs:[[[-1.4,-0.85],[1.4,-0.85]]] },
                  { key:"width", label:"Width (w)", segs:[[[1.4,-0.85],[1.4,0.85]]] },
                  { key:"diagonal", label:"Diagonal", segs:[[[-1.4,-0.85],[1.4,0.85]]] } ] },
    triangle: { name:"Triangle", poly:TRI, measures:[
                  { key:"side", label:"Side (a)", segs:[[TRI[1],TRI[2]]] },
                  { key:"height", label:"Height (h)", segs:[[[0,TRI[1][1]],[0,TRI[0][1]]]] } ] },
    parallelogram:{ name:"Parallelogram", poly:PARA, measures:[
                  { key:"base", label:"Base (b)", segs:[[[-1.4,-0.75],[0.6,-0.75]]] },
                  { key:"height", label:"Height (h)", segs:[[[-0.6,-0.75],[-0.6,0.75]]] },
                  { key:"side", label:"Slanted side", segs:[[[0.6,-0.75],[1.4,0.75]]] } ] },
    rhombus:  { name:"Rhombus", poly:RHOM, measures:[
                  { key:"side", label:"Side (s)", segs:[[RHOM[0],RHOM[1]]] },
                  { key:"d1", label:"Long diagonal", segs:[[[0,-1.2],[0,1.2]]] },
                  { key:"d2", label:"Short diagonal", segs:[[[-1.05,0],[1.05,0]]] } ] },
    trapezoid:{ name:"Trapezoid", poly:TRAP, measures:[
                  { key:"a", label:"Bottom base (a)", segs:[[[-1.4,-0.75],[1.4,-0.75]]] },
                  { key:"b", label:"Top base (b)", segs:[[[-0.75,0.75],[0.75,0.75]]] },
                  { key:"height", label:"Height (h)", segs:[[[0,-0.75],[0,0.75]]] } ] },
    pentagon: { name:"Pentagon", poly:reg2(5,1.2), measures:[
                  { key:"side", label:"Side (s)", segs:[[reg2(5,1.2)[1], reg2(5,1.2)[2]]] } ] },
    hexagon:  { name:"Hexagon", poly:reg2(6,1.2,0), measures:[
                  { key:"side", label:"Side (s)", segs:[[reg2(6,1.2,0)[0], reg2(6,1.2,0)[1]]] } ] }
  };

  function render2D(ctx, W, H, sh, hlKey, dpr) {
    ctx.clearRect(0, 0, W, H);
    // padding scales with the canvas so tiny thumbnails stay valid
    var pad = Math.min(W, H) * 0.10;
    var maxR = 1.5;
    var scale = Math.max(1, (Math.min(W, H) / 2 - pad) / maxR);
    var cx = W/2, cy = H/2;
    function P(p) { return [cx + p[0]*scale, cy - p[1]*scale]; }

    ctx.lineJoin = "round"; ctx.lineCap = "round";
    var grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "rgb(206,226,247)");
    grad.addColorStop(1, "rgb(150,186,226)");

    if (sh.round) {
      ctx.beginPath();
      ctx.ellipse(cx, cy, sh.round.a*scale, sh.round.b*scale, 0, 0, Math.PI*2);
      ctx.fillStyle = grad; ctx.fill();
      ctx.strokeStyle = C_EDGE; ctx.lineWidth = 2*dpr; ctx.stroke();
    } else {
      ctx.beginPath();
      sh.poly.forEach(function (p, i) {
        var s = P(p);
        if (i === 0) ctx.moveTo(s[0], s[1]); else ctx.lineTo(s[0], s[1]);
      });
      ctx.closePath();
      ctx.fillStyle = grad; ctx.fill();
      ctx.strokeStyle = C_EDGE; ctx.lineWidth = 2*dpr; ctx.stroke();
    }

    if (hlKey) {
      var m = null;
      sh.measures.forEach(function (x) { if (x.key === hlKey) m = x; });
      if (m) m.segs.forEach(function (seg) {
        var a = P(seg[0]), b = P(seg[1]);
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 6*dpr;
        ctx.beginPath(); ctx.moveTo(a[0],a[1]); ctx.lineTo(b[0],b[1]); ctx.stroke();
        ctx.strokeStyle = C_HL; ctx.lineWidth = 3*dpr;
        ctx.beginPath(); ctx.moveTo(a[0],a[1]); ctx.lineTo(b[0],b[1]); ctx.stroke();
        [a,b].forEach(function (pt) {
          ctx.beginPath(); ctx.arc(pt[0], pt[1], 3.4*dpr, 0, 7);
          ctx.fillStyle = C_HL; ctx.fill();
          ctx.lineWidth = 1.5*dpr; ctx.strokeStyle = "#fff"; ctx.stroke();
        });
      });
    }
  }

  function mount2D(canvas, key) {
    var sh = SHAPES2D[key];
    if (!sh) return null;
    var ctx = canvas.getContext("2d");
    var dpr = sizeCanvas(canvas);
    var hl = null;
    function frame() { render2D(ctx, canvas.width, canvas.height, sh, hl, dpr); }
    frame();
    return {
      setHighlight: function (k) { hl = k; frame(); },
      redraw: frame,
      stop: function () {},
      measures: sh.measures
    };
  }

  return {
    mount2D: mount2D,
    SHAPES2D: SHAPES2D,
    mountViewer: function (canvas, key) { return mount(canvas, key, { interactive:true }); },
    mountThumb:  function (canvas, key) { return mount(canvas, key, { interactive:false, rx:-0.5, ry:0.7 }); },
    // Draw an arbitrary (to-scale) geometry, optionally draggable.
    mountGeo: function (canvas, geo, interactive) {
      return mount(canvas, null, { interactive: !!interactive, geo: geo, rx:-0.42, ry:0.7 });
    },
    buildScaled: buildScaled,
    SHAPES: SHAPES,
    ORDER: ORDER
  };
})();
