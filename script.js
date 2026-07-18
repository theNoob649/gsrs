/* G.S.R.S. — home page live shape search.
   Filters the categorized shape list as you type; hides empty categories
   and shows a "no results" note when nothing matches. Progressive
   enhancement: with JS off, the full list is still fully browsable. */
(function () {
  document.addEventListener('DOMContentLoaded', function () {
    var input = document.getElementById('shape-search');
    if (!input) return;

    var cats = Array.prototype.slice.call(document.querySelectorAll('.shape-cat'));
    var noResults = document.querySelector('.no-results');

    function apply() {
      var q = input.value.trim().toLowerCase();
      var anyVisible = false;

      cats.forEach(function (cat) {
        var links = Array.prototype.slice.call(cat.querySelectorAll('.shape-links a'));
        var catHasMatch = false;

        links.forEach(function (a) {
          var match = a.textContent.toLowerCase().indexOf(q) !== -1;
          a.style.display = match ? '' : 'none';
          if (match) catHasMatch = true;
        });

        cat.style.display = catHasMatch ? '' : 'none';
        if (catHasMatch) anyVisible = true;
      });

      if (noResults) noResults.hidden = anyVisible;
    }

    input.addEventListener('input', apply);
  });
})();
