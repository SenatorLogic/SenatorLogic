// Mobile navigation toggle.
(function () {
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('main-nav');
  if (!toggle || !nav) return;

  toggle.addEventListener('click', function () {
    var open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
  });
})();

// Show a chosen photo before the form is submitted.
(function () {
  var input = document.getElementById('photo');
  if (!input) return;

  input.addEventListener('change', function () {
    var file = input.files && input.files[0];
    if (!file) return;

    var preview = document.getElementById('photo-preview');
    if (!preview) {
      preview = document.createElement('img');
      preview.id = 'photo-preview';
      preview.className = 'avatar sm';
      preview.alt = 'Selected photo';
      preview.style.display = 'inline-grid';
      preview.style.marginTop = '10px';
      input.insertAdjacentElement('afterend', preview);
    }
    preview.src = URL.createObjectURL(file);
  });
})();

// Install support so members can add the site to a phone home screen.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').catch(function () {
      /* offline support is optional */
    });
  });
}
