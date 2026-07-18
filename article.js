/* G.S.R.S. — article.js
   Mounts the interactive 3D viewer on each shape page and builds the
   "show on shape" measurement buttons that highlight parts of the solid. */
document.addEventListener("DOMContentLoaded", function () {
  document.querySelectorAll(".shape-viewer").forEach(function (canvas) {
    var key = canvas.getAttribute("data-shape");
    if (!window.GSRS || !GSRS.SHAPES[key]) return;

    var viewer = GSRS.mountViewer(canvas, key);
    var box = canvas.closest(".shape-figure").querySelector(".measure-buttons");
    if (!box) return;

    var active = null;
    viewer.measures.forEach(function (m) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "measure-btn";
      b.textContent = m.label;
      b.addEventListener("click", function () {
        if (active === b) {
          viewer.setHighlight(null);
          b.classList.remove("on");
          active = null;
        } else {
          if (active) active.classList.remove("on");
          viewer.setHighlight(m.key);
          b.classList.add("on");
          active = b;
        }
      });
      box.appendChild(b);
    });
  });
});
