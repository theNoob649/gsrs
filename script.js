/* G.S.R.S. — script.js  (home page)
   - Mounts a small 3D thumbnail on every shape card.
   - Live-filters the shape list as you type. */
document.addEventListener("DOMContentLoaded", function () {

  /* thumbnails — 3D solids and 2D flat shapes */
  if (window.GSRS) {
    document.querySelectorAll("canvas.thumb").forEach(function (c) {
      var k3 = c.getAttribute("data-shape");
      var k2 = c.getAttribute("data-shape2d");
      try {
        if (k3 && GSRS.SHAPES[k3]) GSRS.mountThumb(c, k3);
        else if (k2 && GSRS.SHAPES2D[k2]) GSRS.mount2D(c, k2);
      } catch (err) {
        // one bad thumbnail must never stop the rest from drawing
        if (window.console) console.error("thumbnail failed:", k3 || k2, err);
      }
    });
  }

  /* search */
  var input = document.getElementById("shape-search");
  if (!input) return;
  var cats = Array.prototype.slice.call(document.querySelectorAll(".shape-cat"));
  var noResults = document.querySelector(".no-results");

  input.addEventListener("input", function () {
    var q = input.value.trim().toLowerCase();
    var anyVisible = false;
    cats.forEach(function (cat) {
      var links = Array.prototype.slice.call(cat.querySelectorAll(".shape-links a"));
      var catHasMatch = false;
      links.forEach(function (a) {
        var match = a.textContent.toLowerCase().indexOf(q) !== -1;
        a.style.display = match ? "" : "none";
        if (match) catHasMatch = true;
      });
      cat.style.display = catHasMatch ? "" : "none";
      if (catHasMatch) anyVisible = true;
    });
    if (noResults) noResults.hidden = anyVisible;
  });
});
