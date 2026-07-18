/* G.S.R.S. — script.js  (home page)
   - Mounts a small 3D thumbnail on every shape card.
   - Live-filters the shape list as you type. */
document.addEventListener("DOMContentLoaded", function () {

  /* thumbnails */
  if (window.GSRS) {
    document.querySelectorAll("canvas.thumb").forEach(function (c) {
      var k = c.getAttribute("data-shape");
      if (GSRS.SHAPES[k]) GSRS.mountThumb(c, k);
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
