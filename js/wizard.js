const $ = (id) => document.getElementById(id);
const NAMES = ['Data pribadi', 'Kontak & domisili', 'Preferensi'];

export function initWizard() {
  const form = $('registerForm'), steps = [...form.querySelectorAll('fieldset')];
  const prev = $('stepPrev'), next = $('stepNext'), submit = $('regSubmit'), prog = $('regProgress');
  let i = 0;

  function show(n) {
    i = n;
    steps.forEach((f, k) => f.classList.toggle('hidden', k !== i));
    prev.classList.toggle('hidden', i === 0);
    next.classList.toggle('hidden', i === steps.length - 1);
    submit.classList.toggle('hidden', i !== steps.length - 1);
    const bar = document.createElement('div'); bar.className = 'step-bar';
    steps.forEach((_, k) => { const s = document.createElement('span'); if (k <= i) s.className = 'on'; bar.append(s); });
    const t = document.createElement('p'); t.className = 'dash-text-sm'; t.textContent = `Langkah ${i + 1} dari ${steps.length}: ${NAMES[i]}`;
    prog.replaceChildren(bar, t);
  }

  function valid() {
    for (const c of steps[i].querySelectorAll('input,select,textarea')) if (!c.checkValidity()) { c.reportValidity(); return false; }
    const cf = $('konfirmasi');
    if (i === 0 && $('password').value !== cf.value) {
      cf.setCustomValidity('Konfirmasi kata sandi tidak cocok.'); cf.reportValidity(); cf.setCustomValidity(''); return false;
    }
    return true;
  }

  next.addEventListener('click', () => { if (valid()) { show(i + 1); form.scrollIntoView({ behavior: 'smooth', block: 'start' }); } });
  prev.addEventListener('click', () => show(i - 1));
  form.addEventListener('submit', (e) => {
    if (i < steps.length - 1) { e.stopImmediatePropagation(); e.preventDefault(); next.click(); }
    else if (!valid()) { e.stopImmediatePropagation(); e.preventDefault(); }
  }, true);
  form.addEventListener('reset', () => setTimeout(() => show(0)));
  show(0);
}
