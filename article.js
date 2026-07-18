/* G.S.R.S. — article.js
   Mounts the shape viewer on each article page (interactive 3D solids, or a
   flat 2D diagram) and builds the "show on shape" measurement buttons. */
document.addEventListener("DOMContentLoaded", function () {
  if (!window.GSRS) return;

  function wire(canvas, viewer) {
    var fig = canvas.closest(".shape-figure");
    var box = fig && fig.querySelector(".measure-buttons");
    if (!box || !viewer) return;
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
  }

  /* 3D solids — draggable */
  document.querySelectorAll(".shape-viewer").forEach(function (canvas) {
    var key = canvas.getAttribute("data-shape");
    if (!GSRS.SHAPES[key]) return;
    wire(canvas, GSRS.mountViewer(canvas, key));
  });

  /* 2D flat shapes */
  document.querySelectorAll(".shape-viewer-2d").forEach(function (canvas) {
    var key = canvas.getAttribute("data-shape2d");
    if (!GSRS.SHAPES2D[key]) return;
    wire(canvas, GSRS.mount2D(canvas, key));
  });
});
