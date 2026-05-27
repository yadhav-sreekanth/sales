window.showToast = function (text, type = 'info') {
  const wrap =
    document.getElementById('toasts') ||
    (() => {
      const w = document.createElement('div');
      w.id = 'toasts';
      w.className = 'toast-wrap';
      document.body.appendChild(w);
      return w;
    })();
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  const icon = type === 'success' ? 'check-circle' : type === 'error' ? 'alert-circle' : 'info';
  t.innerHTML = `<i data-lucide="${icon}" style="width:18px;height:18px;color:var(--${type === 'error' ? 'danger' : type === 'success' ? 'success' : 'primary'})"></i><div style="flex:1;font-size:14px;font-weight:500">${text}</div>`;
  wrap.appendChild(t);
  if (window.lucide) lucide.createIcons();
  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transform = 'translateX(120%)';
    t.style.transition = 'all 0.3s';
  }, 3000);
  setTimeout(() => t.remove(), 3400);
};
