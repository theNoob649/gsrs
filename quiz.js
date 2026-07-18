/* G.S.R.S. — quiz.js
   Two endless, randomized quiz modes:
     • Shapes     — a to-scale, spinnable shape; name it, count its parts,
                    or work out its volume / surface area.
     • Vocabulary — geometry words and what they mean.
   Questions are generated fresh every time, so they never run in a loop. */
(function () {
  "use strict";

  function randInt(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function r1(x) { return Math.round(x * 10) / 10; }

  var PI = Math.PI, S3 = Math.sqrt(3), S5 = Math.sqrt(5);
  var PENT = 0.25 * Math.sqrt(5 * (5 + 2 * S5));

  /* ---- shape data ------------------------------------------------------- */
  var SHAPES = {
    cube: { name: "Cube", poly: { Faces: 6, Edges: 12, Corners: 8 },
      gen: function () { return { s: randInt(2, 9) }; },
      dims: function (d) { return "side s = " + d.s + " cm"; },
      vol: function (d) { return Math.pow(d.s, 3); }, volF: function (d) { return "V = s³ = " + d.s + "³"; },
      surf: function (d) { return 6 * d.s * d.s; }, surfF: function (d) { return "SA = 6 × s² = 6 × " + d.s + "²"; } },
    cuboid: { name: "Cuboid", poly: { Faces: 6, Edges: 12, Corners: 8 },
      gen: function () { return { l: randInt(2, 9), w: randInt(2, 8), h: randInt(2, 8) }; },
      dims: function (d) { return "length " + d.l + ", width " + d.w + ", height " + d.h + " cm"; },
      vol: function (d) { return d.l * d.w * d.h; }, volF: function (d) { return "V = l × w × h = " + d.l + " × " + d.w + " × " + d.h; },
      surf: function (d) { return 2 * (d.l*d.w + d.l*d.h + d.w*d.h); }, surfF: function () { return "SA = 2(lw + lh + wh)"; } },
    "triangular-prism": { name: "Triangular Prism", poly: { Faces: 5, Edges: 9, Corners: 6 },
      gen: function () { return { a: randInt(3, 8), L: randInt(4, 12) }; },
      dims: function (d) { return "triangle side a = " + d.a + ", length L = " + d.L + " cm"; },
      vol: function (d) { return (S3/4) * d.a * d.a * d.L; }, volF: function () { return "V = (√3⁄4)a² × L"; },
      surf: function (d) { return 2*(S3/4)*d.a*d.a + 3*d.a*d.L; }, surfF: function () { return "SA = 2 × (√3⁄4)a² + 3aL"; } },
    "pentagonal-prism": { name: "Pentagonal Prism", poly: { Faces: 7, Edges: 15, Corners: 10 },
      gen: function () { return { a: randInt(3, 7), h: randInt(4, 12) }; },
      dims: function (d) { return "base side a = " + d.a + ", height h = " + d.h + " cm"; },
      vol: function (d) { return PENT * d.a * d.a * d.h; }, volF: function () { return "V = 1.72 × a² × h"; },
      surf: function (d) { return 2*PENT*d.a*d.a + 5*d.a*d.h; }, surfF: function () { return "SA = 2 × 1.72a² + 5ah"; } },
    "hexagonal-prism": { name: "Hexagonal Prism", poly: { Faces: 8, Edges: 18, Corners: 12 },
      gen: function () { return { a: randInt(3, 7), h: randInt(4, 12) }; },
      dims: function (d) { return "base side a = " + d.a + ", height h = " + d.h + " cm"; },
      vol: function (d) { return (3*S3/2) * d.a * d.a * d.h; }, volF: function () { return "V = (3√3⁄2)a² × h"; },
      surf: function (d) { return 3*S3*d.a*d.a + 6*d.a*d.h; }, surfF: function () { return "SA = 3√3 a² + 6ah"; } },
    "square-pyramid": { name: "Square Pyramid", poly: { Faces: 5, Edges: 8, Corners: 5 },
      gen: function () { return { a: randInt(3, 8), h: randInt(3, 9) }; },
      dims: function (d) { return "base a = " + d.a + ", height h = " + d.h + " cm"; },
      vol: function (d) { return (1/3) * d.a * d.a * d.h; }, volF: function (d) { return "V = (1⁄3)a²h = (1⁄3) × " + d.a + "² × " + d.h; },
      surf: function (d) { var l = Math.sqrt(d.h*d.h + (d.a/2)*(d.a/2)); return d.a*d.a + 2*d.a*l; },
      surfF: function () { return "SA = a² + 2a·l   (l = √(h² + (a⁄2)²))"; } },
    cone: { name: "Cone", poly: null,
      gen: function () { return { r: randInt(2, 6), h: randInt(3, 10) }; },
      dims: function (d) { return "radius r = " + d.r + ", height h = " + d.h + " cm"; },
      vol: function (d) { return (1/3) * PI * d.r * d.r * d.h; }, volF: function () { return "V = (1⁄3)πr²h"; },
      surf: function (d) { var l = Math.sqrt(d.r*d.r + d.h*d.h); return PI*d.r*(d.r + l); }, surfF: function () { return "SA = πr(r + l)   (l = √(r²+h²))"; } },
    cylinder: { name: "Cylinder", poly: null,
      gen: function () { return { r: randInt(2, 6), h: randInt(3, 10) }; },
      dims: function (d) { return "radius r = " + d.r + ", height h = " + d.h + " cm"; },
      vol: function (d) { return PI * d.r * d.r * d.h; }, volF: function () { return "V = πr²h"; },
      surf: function (d) { return 2*PI*d.r*(d.r + d.h); }, surfF: function () { return "SA = 2πr(r + h)"; } },
    sphere: { name: "Sphere", poly: null,
      gen: function () { return { r: randInt(2, 7) }; },
      dims: function (d) { return "radius r = " + d.r + " cm"; },
      vol: function (d) { return (4/3) * PI * Math.pow(d.r, 3); }, volF: function () { return "V = (4⁄3)πr³"; },
      surf: function (d) { return 4 * PI * d.r * d.r; }, surfF: function () { return "SA = 4πr²"; } },
    hemisphere: { name: "Hemisphere", poly: null,
      gen: function () { return { r: randInt(2, 7) }; },
      dims: function (d) { return "radius r = " + d.r + " cm"; },
      vol: function (d) { return (2/3) * PI * Math.pow(d.r, 3); }, volF: function () { return "V = (2⁄3)πr³"; },
      surf: function (d) { return 3 * PI * d.r * d.r; }, surfF: function () { return "SA = 3πr²"; } },
    ellipsoid: { name: "Ellipsoid", poly: null,
      gen: function () { return { a: randInt(2, 6), b: randInt(2, 5), c: randInt(2, 5) }; },
      dims: function (d) { return "semi-axes a = " + d.a + ", b = " + d.b + ", c = " + d.c + " cm"; },
      vol: function (d) { return (4/3) * PI * d.a * d.b * d.c; }, volF: function () { return "V = (4⁄3)πabc"; },
      surf: null, surfF: null }
  };
  var KEYS = Object.keys(SHAPES);
  var NAMES = KEYS.map(function (k) { return SHAPES[k].name; });

  /* ---- vocabulary data -------------------------------------------------- */
  var VOCAB = [
    ["Face", "A flat surface on a solid shape"],
    ["Edge", "The line where two faces meet"],
    ["Vertex", "A corner where edges meet"],
    ["Radius", "The distance from the centre of a circle to its edge"],
    ["Diameter", "The distance straight across a circle through the centre"],
    ["Circumference", "The distance all the way around a circle"],
    ["Perimeter", "The total distance around the outside of a flat shape"],
    ["Area", "The amount of space inside a flat shape"],
    ["Volume", "The amount of space inside a solid shape"],
    ["Surface area", "The total area of all the outside surfaces of a solid"],
    ["Parallel", "Two lines that stay the same distance apart and never meet"],
    ["Perpendicular", "Two lines that meet at a right angle"],
    ["Right angle", "A square corner, exactly 90 degrees"],
    ["Diagonal", "A straight line joining two corners that are not next to each other"],
    ["Line of symmetry", "A line that cuts a shape into two matching halves"],
    ["Congruent", "Exactly the same shape and the same size"],
    ["Base", "The flat surface a shape sits on"],
    ["Apex", "The pointed top of a cone or a pyramid"],
    ["Polygon", "A flat shape made only of straight sides"],
    ["Polyhedron", "A solid shape whose faces are all flat"],
    ["Prism", "A solid with two matching ends joined by rectangles"],
    ["Pyramid", "A solid with a flat base whose sides meet at a point"],
    ["Equilateral", "Having all sides the same length"],
    ["Isosceles", "Having exactly two sides the same length"],
    ["Slant height", "The distance along the sloping surface from the apex to the base edge"],
    ["Cross-section", "The flat shape you see when you slice straight through a solid"]
  ];

  /* ---- question builders ------------------------------------------------ */
  function shapeQuestion() {
    var key = pick(KEYS), sh = SHAPES[key], d = sh.gen();
    var types = ["identify", "volume"];
    if (sh.poly) types.push("count");
    if (sh.surf) types.push("surface");
    var type = pick(types);
    var q = { mode: "number", geo: GSRS.buildScaled(key, d), dimsText: sh.dims(d) };

    if (type === "identify") {
      q.mode = "choice";
      q.text = "What is the name of this shape?";
      var others = shuffle(NAMES.filter(function (n) { return n !== sh.name; })).slice(0, 3);
      others.push(sh.name);
      q.choices = shuffle(others);
      q.answer = sh.name;
      q.right = "That's right — it's a " + sh.name + "!";
      q.wrong = "Not quite — this one is a " + sh.name + ".";
    } else if (type === "count") {
      var part = pick(Object.keys(sh.poly));
      q.text = "How many " + part.toLowerCase() + " does this " + sh.name.toLowerCase() + " have?";
      q.answer = sh.poly[part]; q.exact = true;
      q.solution = "A " + sh.name.toLowerCase() + " has " + sh.poly[part] + " " + part.toLowerCase() + ".";
    } else if (type === "volume") {
      var v = sh.vol(d);
      q.text = "Find the VOLUME of this " + sh.name.toLowerCase() + ".";
      q.answer = v; q.tol = Math.max(1, 0.03 * Math.abs(v));
      q.unit = "cm³";
      q.solution = sh.volF(d) + " ≈ " + r1(v) + " cm³";
    } else {
      var s = sh.surf(d);
      q.text = "Find the SURFACE AREA of this " + sh.name.toLowerCase() + ".";
      q.answer = s; q.tol = Math.max(1, 0.03 * Math.abs(s));
      q.unit = "cm²";
      q.solution = sh.surfF(d) + " ≈ " + r1(s) + " cm²";
    }
    return q;
  }

  function vocabQuestion() {
    var entry = pick(VOCAB);
    var term = entry[0], def = entry[1];
    var q = { mode: "choice", geo: null };
    if (Math.random() < 0.5) {
      // definition -> word
      q.text = "Which word means: “" + def + "”?";
      var terms = shuffle(VOCAB.filter(function (e) { return e[0] !== term; }))
                    .slice(0, 3).map(function (e) { return e[0]; });
      terms.push(term);
      q.choices = shuffle(terms);
      q.answer = term;
      q.right = "Correct — that's what “" + term + "” means.";
      q.wrong = "The answer is “" + term + "”: " + def + ".";
    } else {
      // word -> definition
      q.text = "What does “" + term + "” mean?";
      var defs = shuffle(VOCAB.filter(function (e) { return e[0] !== term; }))
                   .slice(0, 3).map(function (e) { return e[1]; });
      defs.push(def);
      q.choices = shuffle(defs);
      q.answer = def;
      q.right = "Correct! " + term + ": " + def + ".";
      q.wrong = "“" + term + "” means: " + def + ".";
    }
    return q;
  }

  /* ---- UI --------------------------------------------------------------- */
  var el = {}, current = null, viewer = null, correct = 0, total = 0,
      answered = false, mode = "shapes";

  function mountFigure(geo) {
    if (viewer) { viewer.stop(); viewer = null; }
    el.figure.innerHTML = "";
    var c = document.createElement("canvas");
    c.className = "quiz-canvas";
    el.figure.appendChild(c);
    viewer = GSRS.mountGeo(c, geo, true);
  }

  function render(q) {
    answered = false;
    if (q.geo) {
      el.figure.hidden = false; el.dims.hidden = false;
      mountFigure(q.geo);
      el.dims.textContent = q.dimsText;
    } else {
      if (viewer) { viewer.stop(); viewer = null; }
      el.figure.innerHTML = ""; el.figure.hidden = true; el.dims.hidden = true;
    }
    el.question.textContent = q.text;
    el.feedback.textContent = ""; el.feedback.className = "quiz-feedback";
    el.next.hidden = true;
    el.answer.innerHTML = "";

    if (q.mode === "choice") {
      el.check.hidden = true;
      var longest = q.choices.reduce(function (m, c) { return Math.max(m, c.length); }, 0);
      q.choices.forEach(function (ch) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "quiz-choice" + (longest > 34 ? " long" : "");
        b.textContent = ch;
        b.addEventListener("click", function () { if (!answered) selectChoice(b, ch); });
        el.answer.appendChild(b);
      });
    } else {
      el.check.hidden = false; el.check.disabled = false;
      var row = document.createElement("div"); row.className = "quiz-input-row";
      var inp = document.createElement("input");
      inp.type = "text"; inp.inputMode = "decimal"; inp.className = "quiz-input"; inp.id = "quiz-input";
      inp.placeholder = q.exact ? "how many?" : "your answer";
      inp.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); checkNumber(); } });
      row.appendChild(inp);
      if (q.unit) {
        var u = document.createElement("span"); u.className = "quiz-unit";
        u.textContent = q.unit; row.appendChild(u);
      }
      el.answer.appendChild(row);
      if (!q.exact) {
        var hint = document.createElement("p"); hint.className = "quiz-hint";
        hint.textContent = "Tip: use π ≈ 3.14, then round to the nearest whole number.";
        el.answer.appendChild(hint);
      }
      inp.focus();
    }
  }

  function selectChoice(btn, ch) {
    answered = true; total++;
    var ok = ch === current.answer;
    Array.prototype.forEach.call(el.answer.children, function (b) {
      b.disabled = true;
      if (b.textContent === current.answer) b.classList.add("correct");
      else if (b === btn) b.classList.add("wrong");
    });
    finish(ok, ok ? current.right : current.wrong);
  }

  function checkNumber() {
    if (answered) return;
    var inp = document.getElementById("quiz-input");
    var val = parseFloat((inp.value || "").replace(/[^0-9.\-]/g, ""));
    if (isNaN(val)) {
      el.feedback.textContent = "Type a number first.";
      el.feedback.className = "quiz-feedback warn"; return;
    }
    answered = true; total++;
    var ok = current.exact ? (Math.round(val) === current.answer)
                           : (Math.abs(val - current.answer) <= current.tol);
    inp.disabled = true;
    finish(ok, (ok ? "Nice work! " : "Close! ") + current.solution);
  }

  function finish(ok, msg) {
    if (ok) correct++;
    el.feedback.textContent = (ok ? "✓ " : "✗ ") + msg;
    el.feedback.className = "quiz-feedback " + (ok ? "good" : "bad");
    el.check.hidden = true; el.next.hidden = false; el.next.focus();
    el.score.textContent = "Score: " + correct + " / " + total;
  }

  function next() {
    current = (mode === "vocab") ? vocabQuestion() : shapeQuestion();
    render(current);
  }

  function setMode(m) {
    mode = m;
    correct = 0; total = 0;
    el.score.textContent = "Score: 0 / 0";
    el.tabs.forEach(function (t) {
      t.classList.toggle("active", t.getAttribute("data-mode") === m);
    });
    next();
  }

  document.addEventListener("DOMContentLoaded", function () {
    if (!window.GSRS) return;
    el.figure = document.getElementById("quiz-figure");
    el.dims = document.getElementById("quiz-dims");
    el.question = document.getElementById("quiz-question");
    el.answer = document.getElementById("quiz-answer");
    el.check = document.getElementById("quiz-check");
    el.next = document.getElementById("quiz-next");
    el.feedback = document.getElementById("quiz-feedback");
    el.score = document.getElementById("quiz-score");
    el.tabs = Array.prototype.slice.call(document.querySelectorAll(".mode-tab"));

    el.check.addEventListener("click", checkNumber);
    el.next.addEventListener("click", next);
    el.tabs.forEach(function (t) {
      t.addEventListener("click", function () { setMode(t.getAttribute("data-mode")); });
    });
    setMode("shapes");
  });
})();
