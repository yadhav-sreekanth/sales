/* ============ Yadhav Finance — App Controller ============ */
(async function () {
  const loader = document.getElementById('page-loader');

  // ---- Auth guard ----
  const { data: sessionData } = await window.sb.auth.getSession();
  if (!sessionData.session) {
    window.location.replace('/index.html');
    return;
  }
  const user = sessionData.session.user;
  const userId = user.id;

  // Ensure profile row exists
  await window.sb.from('profiles').upsert(
    {
      id: userId,
      email: user.email,
      full_name: 'Yadhav Sreekanth'
    },
    { onConflict: 'id' }
  );

  // ---- State ----
  const state = {
    earnings: [],
    expenses: [],
    clients: [],
    projects: [],
    notes: [],
    profile: null
  };
  const charts = {};

  // ---- Theme ----
  const themeToggle = document.getElementById('theme-toggle');
  const applyTheme = (t) => {
    document.documentElement.classList.toggle('dark', t === 'dark');
    themeToggle.innerHTML =
      t === 'dark' ? '<i data-lucide="sun"></i>' : '<i data-lucide="moon"></i>';
    lucide.createIcons();
  };
  applyTheme(localStorage.getItem('theme') || 'light');
  themeToggle.addEventListener('click', () => {
    const cur = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    const next = cur === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', next);
    applyTheme(next);
    Object.values(charts).forEach((c) => c && c.update());
  });

  // ---- Navigation ----
  document.querySelectorAll('.nav-item[data-view]').forEach((el) => {
    el.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach((n) => n.classList.remove('active'));
      el.classList.add('active');
      document.querySelectorAll('.section').forEach((s) => s.classList.remove('active'));
      document.getElementById('view-' + el.dataset.view).classList.add('active');
      document.getElementById('sidebar').classList.remove('open');
      document.getElementById('sb-backdrop').classList.remove('show');
      if (el.dataset.view === 'analytics') renderAnalytics();
      lucide.createIcons();
    });
  });
  document.getElementById('mobile-menu').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sb-backdrop').classList.toggle('show');
  });
  document.getElementById('sb-backdrop').addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sb-backdrop').classList.remove('show');
  });

  // ---- Sign out ----
  document.getElementById('logout-btn').addEventListener('click', async () => {
    await window.sb.auth.signOut();
    window.location.replace('/index.html');
  });

  // ---- Modal helpers ----
  const openModal = (id) => document.getElementById(id).classList.add('show');
  const closeModal = (id) => document.getElementById(id).classList.remove('show');
  document.querySelectorAll('[data-close]').forEach((b) =>
    b.addEventListener('click', () => {
      b.closest('.modal-backdrop').classList.remove('show');
    })
  );
  document.querySelectorAll('.modal-backdrop').forEach((m) =>
    m.addEventListener('click', (e) => {
      if (e.target === m) m.classList.remove('show');
    })
  );

  // ---- Data loaders ----
  async function loadAll() {
    const [e, x, c, p, n, pr] = await Promise.all([
      window.sb
        .from('earnings')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false }),
      window.sb
        .from('expenses')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false }),
      window.sb
        .from('clients')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
      window.sb
        .from('projects')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
      window.sb
        .from('notes')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
      window.sb.from('profiles').select('*').eq('id', userId).maybeSingle()
    ]);
    state.earnings = e.data || [];
    state.expenses = x.data || [];
    state.clients = c.data || [];
    state.projects = p.data || [];
    state.notes = n.data || [];
    state.profile = pr.data || { full_name: 'Yadhav Sreekanth', email: user.email };
    renderAll();
  }

  // ---- Renderers ----
  function renderAll() {
    renderStats();
    renderRecent();
    renderNotes();
    renderEarningsTable();
    renderExpensesTable();
    renderClients();
    renderProjects();
    renderOverviewChart();
    renderSettings();
    lucide.createIcons();
  }

  function totals() {
    const earned = state.earnings.reduce((s, r) => s + Number(r.amount || 0), 0);
    const spent = state.expenses.reduce((s, r) => s + Number(r.amount || 0), 0);
    const now = new Date();
    const monthly = state.earnings
      .filter((r) => {
        const d = new Date(r.date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((s, r) => s + Number(r.amount || 0), 0);
    const clientNames = new Set(
      state.earnings.map((r) => (r.client_name || '').trim()).filter(Boolean)
    );
    return {
      earned,
      spent,
      balance: earned - spent,
      monthly,
      clients: clientNames.size || state.clients.length,
      orders: state.earnings.length
    };
  }

  function animateNumber(el, target, isMoney = true) {
    const start = 0,
      dur = 700,
      t0 = performance.now();
    const step = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      const v = Math.round(start + (target - start) * (1 - Math.pow(1 - p, 3)));
      el.textContent = isMoney ? window.fmtINR(v) : String(v);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function renderStats() {
    const t = totals();
    animateNumber(document.getElementById('stat-earned'), t.earned);
    animateNumber(document.getElementById('stat-spent'), t.spent);
    animateNumber(document.getElementById('stat-balance'), t.balance);
    animateNumber(document.getElementById('stat-clients'), t.clients, false);
    animateNumber(document.getElementById('stat-orders'), t.orders, false);
    animateNumber(document.getElementById('stat-month'), t.monthly);
  }

  function renderRecent() {
    const tx = [];
    state.earnings
      .slice(0, 6)
      .forEach((e) =>
        tx.push({
          kind: 'earn',
          label: earningLabel(e),
          sub: window.fmtDate(e.date) + ' · ' + typeLabel(e.earning_type),
          amt: e.amount
        })
      );
    state.expenses
      .slice(0, 6)
      .forEach((x) =>
        tx.push({
          kind: 'spend',
          label: x.expense_name,
          sub: window.fmtDate(x.date) + ' · ' + capitalize(x.category),
          amt: -x.amount
        })
      );
    tx.sort((a, b) => Math.abs(b.amt) - Math.abs(a.amt));
    const el = document.getElementById('recent-list');
    if (!tx.length) {
      el.innerHTML = `<div class="empty"><i data-lucide="inbox"></i><div>No transactions yet</div></div>`;
      lucide.createIcons();
      return;
    }
    el.innerHTML = tx
      .slice(0, 8)
      .map(
        (r) => `
      <div class="panel-row">
        <div class="ico ${r.kind === 'spend' ? 'danger' : 'success'}"><i data-lucide="${r.kind === 'spend' ? 'arrow-down-right' : 'arrow-up-right'}"></i></div>
        <div class="meta"><div class="t">${escapeHtml(r.label)}</div><div class="s">${escapeHtml(r.sub)}</div></div>
        <div class="amt ${r.amt < 0 ? 'neg' : 'pos'}">${r.amt < 0 ? '−' : '+'}${window.fmtINR(Math.abs(r.amt))}</div>
      </div>`
      )
      .join('');
    lucide.createIcons();
  }

  function earningLabel(e) {
    if (e.earning_type === 'pocket_money') return e.source || 'Pocket money';
    if (e.earning_type === 'web_development')
      return e.website_name || e.client_name || 'Web project';
    if (e.earning_type === 'powerpoint_design')
      return e.topic_name || 'PPT — ' + (e.client_name || '');
    if (e.earning_type === 'poster_design')
      return e.poster_topic || 'Poster — ' + (e.client_name || '');
    return e.description || 'Other';
  }
  function typeLabel(t) {
    return (
      {
        web_development: 'Web Development',
        powerpoint_design: 'PowerPoint Design',
        poster_design: 'Poster Design',
        pocket_money: 'Pocket Money',
        other: 'Other'
      }[t] || t
    );
  }
  function capitalize(s) {
    return s ? s[0].toUpperCase() + s.slice(1) : '';
  }
  function escapeHtml(s) {
    return String(s ?? '').replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  }

  // ---- Earnings table ----
  let earningsFilter = '';
  document.getElementById('search-earnings').addEventListener('input', (e) => {
    earningsFilter = e.target.value.toLowerCase();
    renderEarningsTable();
  });
  function renderEarningsTable() {
    const rows = state.earnings.filter((r) => {
      if (!earningsFilter) return true;
      return JSON.stringify(r).toLowerCase().includes(earningsFilter);
    });
    const tbody = document.getElementById('earnings-tbody');
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="6"><div class="empty"><i data-lucide="inbox"></i><div>No earnings yet — click "Add Earning"</div></div></td></tr>`;
      lucide.createIcons();
      return;
    }
    tbody.innerHTML = rows
      .map(
        (r) => `
      <tr>
        <td>${window.fmtDate(r.date)}</td>
        <td><span class="badge">${typeLabel(r.earning_type)}</span></td>
        <td>${escapeHtml(r.client_name || r.source || '—')}</td>
        <td>${escapeHtml(earningLabel(r))}</td>
        <td style="text-align:right;font-weight:700;color:var(--success)">${window.fmtINR(r.amount)}</td>
        <td><div class="row-actions">
          <button class="btn btn-sm btn-ghost" data-del-earning="${r.id}"><i data-lucide="trash-2" style="width:14px;height:14px;color:var(--danger)"></i></button>
        </div></td>
      </tr>`
      )
      .join('');
    tbody
      .querySelectorAll('[data-del-earning]')
      .forEach((b) => b.addEventListener('click', () => deleteEarning(b.dataset.delEarning)));
    lucide.createIcons();
  }

  // ---- Expenses table ----
  let expensesFilter = '';
  document.getElementById('search-expenses').addEventListener('input', (e) => {
    expensesFilter = e.target.value.toLowerCase();
    renderExpensesTable();
  });
  function renderExpensesTable() {
    const rows = state.expenses.filter(
      (r) => !expensesFilter || JSON.stringify(r).toLowerCase().includes(expensesFilter)
    );
    const tbody = document.getElementById('expenses-tbody');
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="6"><div class="empty"><i data-lucide="inbox"></i><div>No expenses yet — click "Add Expense"</div></div></td></tr>`;
      lucide.createIcons();
      return;
    }
    tbody.innerHTML = rows
      .map(
        (r) => `
      <tr>
        <td>${window.fmtDate(r.date)}</td>
        <td><span class="badge warning">${capitalize(r.category)}</span></td>
        <td>${escapeHtml(r.expense_name)}</td>
        <td style="color:var(--text-muted);font-size:13px">${escapeHtml(r.notes || '—')}</td>
        <td style="text-align:right;font-weight:700;color:var(--danger)">−${window.fmtINR(r.amount)}</td>
        <td><div class="row-actions">
          <button class="btn btn-sm btn-ghost" data-del-expense="${r.id}"><i data-lucide="trash-2" style="width:14px;height:14px;color:var(--danger)"></i></button>
        </div></td>
      </tr>`
      )
      .join('');
    tbody
      .querySelectorAll('[data-del-expense]')
      .forEach((b) => b.addEventListener('click', () => deleteExpense(b.dataset.delExpense)));
    lucide.createIcons();
  }

  // ---- Clients ----
  let clientsFilter = '';
  document.getElementById('search-clients').addEventListener('input', (e) => {
    clientsFilter = e.target.value.toLowerCase();
    renderClients();
  });
  function clientAggregates() {
    const map = new Map();
    state.earnings.forEach((e) => {
      const name = (e.client_name || '').trim();
      if (!name) return;
      if (!map.has(name))
        map.set(name, {
          name,
          phone: e.client_phone || '',
          total: 0,
          projects: 0,
          links: new Set(),
          items: []
        });
      const c = map.get(name);
      c.total += Number(e.amount || 0);
      c.projects += 1;
      if (e.website_link) c.links.add(e.website_link);
      if (e.client_phone) c.phone = e.client_phone;
      c.items.push(e);
    });
    return [...map.values()].sort((a, b) => b.total - a.total);
  }
  function renderClients() {
    const list = clientAggregates().filter(
      (c) =>
        !clientsFilter ||
        c.name.toLowerCase().includes(clientsFilter) ||
        c.phone.toLowerCase().includes(clientsFilter)
    );
    const grid = document.getElementById('clients-grid');
    if (!list.length) {
      grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><i data-lucide="users"></i><div>No clients yet — add an earning with a client name</div></div>`;
      lucide.createIcons();
      return;
    }
    grid.innerHTML = list
      .map(
        (c) => `
      <div class="client-card" data-client="${escapeHtml(c.name)}">
        <div class="glow"></div>
        <div class="name">${escapeHtml(c.name)}</div>
        <div class="phone"><i data-lucide="phone" style="width:12px;height:12px;display:inline"></i> ${escapeHtml(c.phone || '—')}</div>
        <div class="stats">
          <div><div class="v" style="color:var(--success)">${window.fmtINR(c.total)}</div><div class="l">Earned</div></div>
          <div><div class="v">${c.projects}</div><div class="l">Projects</div></div>
        </div>
        ${
          c.links.size
            ? `<div style="margin-top:10px;font-size:12px;color:var(--primary);word-break:break-all">${[
                ...c.links
              ]
                .slice(0, 1)
                .map((l) => `<a href="${escapeHtml(l)}" target="_blank">${escapeHtml(l)}</a>`)
                .join('')}</div>`
            : ''
        }
      </div>`
      )
      .join('');
    grid
      .querySelectorAll('[data-client]')
      .forEach((card) => card.addEventListener('click', () => openClient(card.dataset.client)));
    lucide.createIcons();
  }
  function openClient(name) {
    const c = clientAggregates().find((x) => x.name === name);
    if (!c) return;
    document.getElementById('client-title').textContent = name;
    document.getElementById('client-body').innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:18px">
        <div class="stat-card" style="--accent-grad: var(--grad-success)"><div class="glow"></div><div class="label">Total earned</div><div class="value" style="font-size:22px">${window.fmtINR(c.total)}</div></div>
        <div class="stat-card"><div class="glow"></div><div class="label">Projects</div><div class="value" style="font-size:22px">${c.projects}</div></div>
      </div>
      <h3 style="margin-bottom:10px">Projects & orders</h3>
      ${c.items
        .map(
          (e) => `
        <div class="panel-row">
          <div class="ico"><i data-lucide="briefcase"></i></div>
          <div class="meta"><div class="t">${escapeHtml(earningLabel(e))}</div><div class="s">${typeLabel(e.earning_type)} · ${window.fmtDate(e.date)}</div></div>
          <div class="amt pos">${window.fmtINR(e.amount)}</div>
        </div>`
        )
        .join('')}
    `;
    openModal('modal-client');
    lucide.createIcons();
  }

  // ---- Projects ----
  function renderProjects() {
    // Derive projects from earnings if projects table empty
    const list = state.projects.length
      ? state.projects
      : state.earnings.map((e) => ({
          id: e.id,
          project_name: earningLabel(e),
          project_type: typeLabel(e.earning_type),
          status:
            e.delivery_date && new Date(e.delivery_date) > new Date() ? 'ongoing' : 'completed',
          amount: e.amount,
          deadline: e.delivery_date || e.date,
          description: e.project_description || e.description || ''
        }));
    const grid = document.getElementById('projects-grid');
    if (!list.length) {
      grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><i data-lucide="folder-open"></i><div>No projects yet — add earnings to see projects here</div></div>`;
      lucide.createIcons();
      return;
    }
    grid.innerHTML = list
      .map((p) => {
        const status = p.status || 'ongoing';
        const badge =
          status === 'completed' ? 'success' : status === 'cancelled' ? 'danger' : 'warning';
        return `
      <div class="project-card">
        <div class="glow"></div>
        <div style="display:flex;align-items:start;gap:10px">
          <div style="flex:1"><div class="name">${escapeHtml(p.project_name)}</div>
          <div class="meta">${escapeHtml(p.project_type)}</div></div>
          <span class="badge ${badge}">${status}</span>
        </div>
        <div class="stats">
          <div><div class="v" style="color:var(--success)">${window.fmtINR(p.amount)}</div><div class="l">Earned</div></div>
          <div><div class="v" style="font-size:14px">${window.fmtDate(p.deadline)}</div><div class="l">Deadline</div></div>
        </div>
      </div>`;
      })
      .join('');
    lucide.createIcons();
  }

  // ---- Charts ----
  function chartColors() {
    const dark = document.documentElement.classList.contains('dark');
    return {
      grid: dark ? 'rgba(255,255,255,0.06)' : 'rgba(20,22,60,0.06)',
      text: dark ? '#cbd5e1' : '#475569'
    };
  }
  function last6Months() {
    const arr = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      arr.push({
        label: d.toLocaleString('en-IN', { month: 'short' }),
        y: d.getFullYear(),
        m: d.getMonth()
      });
    }
    return arr;
  }
  function bucketByMonth(items, dateKey = 'date') {
    const months = last6Months();
    const sums = months.map(() => 0);
    items.forEach((it) => {
      const d = new Date(it[dateKey]);
      months.forEach((mo, i) => {
        if (d.getMonth() === mo.m && d.getFullYear() === mo.y) sums[i] += Number(it.amount || 0);
      });
    });
    return { labels: months.map((m) => m.label), sums };
  }
  function renderOverviewChart() {
    const c = chartColors();
    const e = bucketByMonth(state.earnings);
    const x = bucketByMonth(state.expenses);
    const ctx = document.getElementById('chart-overview');
    if (!ctx) return;
    charts.overview && charts.overview.destroy();
    const grad1 = ctx.getContext('2d').createLinearGradient(0, 0, 0, 280);
    grad1.addColorStop(0, 'rgba(109,92,255,0.45)');
    grad1.addColorStop(1, 'rgba(109,92,255,0)');
    const grad2 = ctx.getContext('2d').createLinearGradient(0, 0, 0, 280);
    grad2.addColorStop(0, 'rgba(239,68,68,0.35)');
    grad2.addColorStop(1, 'rgba(239,68,68,0)');
    charts.overview = new Chart(ctx, {
      type: 'line',
      data: {
        labels: e.labels,
        datasets: [
          {
            label: 'Earned',
            data: e.sums,
            borderColor: '#6d5cff',
            backgroundColor: grad1,
            fill: true,
            tension: 0.4,
            borderWidth: 3,
            pointRadius: 4,
            pointBackgroundColor: '#6d5cff'
          },
          {
            label: 'Spent',
            data: x.sums,
            borderColor: '#ef4444',
            backgroundColor: grad2,
            fill: true,
            tension: 0.4,
            borderWidth: 3,
            pointRadius: 4,
            pointBackgroundColor: '#ef4444'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: c.text } } },
        scales: {
          x: { grid: { color: c.grid }, ticks: { color: c.text } },
          y: {
            grid: { color: c.grid },
            ticks: { color: c.text, callback: (v) => '₹' + v.toLocaleString('en-IN') }
          }
        },
        animation: { duration: 900, easing: 'easeOutQuart' }
      }
    });
  }

  function renderAnalytics() {
    const c = chartColors();
    const eM = bucketByMonth(state.earnings);
    const xM = bucketByMonth(state.expenses);

    // Earnings by type
    const byType = {};
    state.earnings.forEach((e) => {
      byType[e.earning_type] = (byType[e.earning_type] || 0) + Number(e.amount || 0);
    });
    const byCat = {};
    state.expenses.forEach((e) => {
      byCat[e.category] = (byCat[e.category] || 0) + Number(e.amount || 0);
    });

    const palette = [
      '#6d5cff',
      '#22d3ee',
      '#10b981',
      '#f59e0b',
      '#ef4444',
      '#8b5cf6',
      '#ec4899',
      '#14b8a6'
    ];

    const mk = (id, type, labels, data, label, color) => {
      const el = document.getElementById(id);
      if (!el) return;
      charts[id] && charts[id].destroy();
      let bg = color;
      if (type === 'line' || type === 'bar') {
        const g = el.getContext('2d').createLinearGradient(0, 0, 0, 280);
        g.addColorStop(0, hexA(color, 0.55));
        g.addColorStop(1, hexA(color, 0.02));
        bg = g;
      }
      charts[id] = new Chart(el, {
        type,
        data: {
          labels,
          datasets: [
            {
              label,
              data,
              backgroundColor: type === 'doughnut' ? palette : bg,
              borderColor: color,
              borderWidth: type === 'doughnut' ? 0 : 3,
              fill: type !== 'doughnut',
              tension: 0.4,
              pointRadius: 4
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: type === 'doughnut', position: 'bottom', labels: { color: c.text } }
          },
          scales:
            type === 'doughnut'
              ? {}
              : {
                  x: { grid: { color: c.grid }, ticks: { color: c.text } },
                  y: {
                    grid: { color: c.grid },
                    ticks: { color: c.text, callback: (v) => '₹' + v.toLocaleString('en-IN') }
                  }
                },
          animation: { duration: 800 }
        }
      });
    };
    mk('chart-earnings', 'line', eM.labels, eM.sums, 'Earnings', '#10b981');
    mk('chart-spending', 'bar', xM.labels, xM.sums, 'Spending', '#ef4444');
    mk(
      'chart-earn-type',
      'doughnut',
      Object.keys(byType).map(typeLabel),
      Object.values(byType),
      'Earnings',
      '#6d5cff'
    );
    mk(
      'chart-spend-cat',
      'doughnut',
      Object.keys(byCat).map(capitalize),
      Object.values(byCat),
      'Spending',
      '#ef4444'
    );

    // KPIs
    const topType = Object.entries(byType).sort((a, b) => b[1] - a[1])[0];
    document.getElementById('an-top-cat').textContent = topType ? typeLabel(topType[0]) : '—';
    document.getElementById('an-top-cat-amt').textContent = topType
      ? window.fmtINR(topType[1])
      : '';
    const bigSpend = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];
    document.getElementById('an-big-spend').textContent = bigSpend ? capitalize(bigSpend[0]) : '—';
    document.getElementById('an-big-spend-amt').textContent = bigSpend
      ? window.fmtINR(bigSpend[1])
      : '';
    const avg = eM.sums.reduce((a, b) => a + b, 0) / 6;
    document.getElementById('an-avg-month').textContent = window.fmtINR(avg);
    const t = totals();
    const rate = t.earned > 0 ? Math.round((t.balance / t.earned) * 100) : 0;
    document.getElementById('an-savings').textContent = rate + '%';
  }
  function hexA(hex, a) {
    const h = hex.replace('#', '');
    const r = parseInt(h.slice(0, 2), 16),
      g = parseInt(h.slice(2, 4), 16),
      b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  }

  // ---- Calendar ----
  (function calendar() {
    const el = document.getElementById('calendar');
    const now = new Date();
    const y = now.getFullYear(),
      m = now.getMonth();
    const first = new Date(y, m, 1).getDay();
    const days = new Date(y, m + 1, 0).getDate();
    const headers = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
      .map((d) => `<div class="h">${d}</div>`)
      .join('');
    let cells = '';
    for (let i = 0; i < first; i++) cells += `<div class="d muted"></div>`;
    for (let d = 1; d <= days; d++) {
      cells += `<div class="d ${d === now.getDate() ? 'today' : ''}">${d}</div>`;
    }
    el.innerHTML = headers + cells;
  })();

  // ---- Quotes ----
  (function quote() {
    const quotes = [
      ['Money grows on the tree of persistence.', 'Japanese Proverb'],
      ['Beware of little expenses; a small leak will sink a great ship.', 'Benjamin Franklin'],
      ["Don't tell me what you value, show me your budget.", 'Joe Biden'],
      ['The art is not in making money, but in keeping it.', 'Proverb'],
      ['A budget is telling your money where to go.', 'Dave Ramsey'],
      ["It's not how much money you make, but how much you keep.", 'Robert Kiyosaki']
    ];
    const q = quotes[Math.floor(Math.random() * quotes.length)];
    document.getElementById('quote-text').textContent = q[0];
    document.getElementById('quote-author').textContent = '— ' + q[1];
  })();

  // ---- Notes ----
  function renderNotes() {
    const el = document.getElementById('notes-list');
    if (!state.notes.length) {
      el.innerHTML = `<div style="font-size:13px;color:var(--text-muted)">No notes yet. Click "Add" to create one.</div>`;
      return;
    }
    el.innerHTML = state.notes
      .slice(0, 6)
      .map(
        (n) => `
      <div class="note-item">
        <i data-lucide="dot" style="width:16px;height:16px;color:var(--primary)"></i>
        <div><div style="font-weight:600">${escapeHtml(n.title || 'Note')}</div><div style="color:var(--text-muted);font-size:12px">${escapeHtml(n.content)}</div></div>
        <i data-lucide="x" class="x" data-del-note="${n.id}" style="width:14px;height:14px"></i>
      </div>`
      )
      .join('');
    el.querySelectorAll('[data-del-note]').forEach((b) =>
      b.addEventListener('click', async () => {
        await window.sb.from('notes').delete().eq('id', b.dataset.delNote);
        window.showToast('Note deleted', 'success');
        loadAll();
      })
    );
    lucide.createIcons();
  }
  document
    .getElementById('add-note-quick')
    .addEventListener('click', () => openModal('modal-note'));
  document.getElementById('save-note').addEventListener('click', async () => {
    const title = document.getElementById('n-title').value.trim();
    const content = document.getElementById('n-content').value.trim();
    if (!content) return window.showToast('Note content required', 'error');
    const { error } = await window.sb.from('notes').insert({ user_id: userId, title, content });
    if (error) return window.showToast(error.message, 'error');
    document.getElementById('n-title').value = '';
    document.getElementById('n-content').value = '';
    closeModal('modal-note');
    window.showToast('Note saved', 'success');
    loadAll();
  });

  // ---- Earnings modal: dynamic fields ----
  const eType = document.getElementById('e-type');
  const eFields = document.getElementById('e-fields');
  function buildEarningFields() {
    const t = eType.value;
    const today = new Date().toISOString().slice(0, 10);
    const cur = (id, lbl, type = 'text') =>
      `<div class="field"><label>${lbl}</label><input id="${id}" type="${type}" ${type === 'date' ? `value="${today}"` : ''} /></div>`;
    const ta = (id, lbl) =>
      `<div class="field"><label>${lbl}</label><textarea id="${id}"></textarea></div>`;
    let html = '';
    if (t === 'web_development') {
      html = `<div class="grid-2">${cur('e-client', 'Client name')}${cur('e-phone', 'Client phone')}</div>
        <div class="grid-2">${cur('e-website', 'Website name')}${cur('e-link', 'Website link', 'url')}</div>
        <div class="grid-2">${cur('e-amount', 'Amount earned (₹)', 'number')}${cur('e-date', 'Date', 'date')}</div>
        ${ta('e-desc', 'Project description')}`;
    } else if (t === 'powerpoint_design') {
      html = `<div class="grid-2">${cur('e-client', 'Client name')}${cur('e-phone', 'Client phone')}</div>
        ${cur('e-topic', 'Topic name')}
        <div class="grid-2">${cur('e-slides', 'Number of slides', 'number')}${cur('e-amount', 'Amount earned (₹)', 'number')}</div>
        ${cur('e-date', 'Date', 'date')}`;
    } else if (t === 'poster_design') {
      html = `<div class="grid-2">${cur('e-client', 'Client name')}${cur('e-phone', 'Client phone')}</div>
        ${cur('e-poster', 'Poster topic')}
        <div class="grid-2">${cur('e-amount', 'Amount earned (₹)', 'number')}${cur('e-delivery', 'Delivery date', 'date')}</div>`;
    } else if (t === 'pocket_money') {
      html = `${cur('e-source', 'Source')}
        <div class="grid-2">${cur('e-amount', 'Amount (₹)', 'number')}${cur('e-date', 'Date', 'date')}</div>`;
    } else {
      html = `${cur('e-source', 'Source / description')}
        <div class="grid-2">${cur('e-amount', 'Amount (₹)', 'number')}${cur('e-date', 'Date', 'date')}</div>`;
    }
    eFields.innerHTML = html;
  }
  eType.addEventListener('change', buildEarningFields);
  document.getElementById('open-earning').addEventListener('click', () => {
    buildEarningFields();
    openModal('modal-earning');
  });
  document.querySelectorAll('[data-action="add-earning"]').forEach((b) =>
    b.addEventListener('click', () => {
      buildEarningFields();
      openModal('modal-earning');
    })
  );

  document.getElementById('save-earning').addEventListener('click', async () => {
    const t = eType.value;
    const val = (id) => {
      const el = document.getElementById(id);
      return el ? el.value : null;
    };
    const row = { user_id: userId, earning_type: t, amount: Number(val('e-amount') || 0) };
    if (!row.amount || row.amount < 0) return window.showToast('Enter a valid amount', 'error');
    if (t === 'web_development') {
      row.client_name = val('e-client');
      row.client_phone = val('e-phone');
      row.website_name = val('e-website');
      row.website_link = val('e-link');
      row.project_description = val('e-desc');
      row.date = val('e-date');
    } else if (t === 'powerpoint_design') {
      row.client_name = val('e-client');
      row.client_phone = val('e-phone');
      row.topic_name = val('e-topic');
      row.number_of_slides = Number(val('e-slides') || 0);
      row.date = val('e-date');
    } else if (t === 'poster_design') {
      row.client_name = val('e-client');
      row.client_phone = val('e-phone');
      row.poster_topic = val('e-poster');
      row.delivery_date = val('e-delivery');
      row.date = val('e-delivery');
    } else if (t === 'pocket_money') {
      row.source = val('e-source');
      row.date = val('e-date');
    } else {
      row.source = val('e-source');
      row.description = val('e-source');
      row.date = val('e-date');
    }
    if (!row.date) row.date = new Date().toISOString().slice(0, 10);

    const { data: inserted, error } = await window.sb
      .from('earnings')
      .insert(row)
      .select()
      .single();
    if (error) return window.showToast(error.message, 'error');

    // Upsert client
    if (row.client_name) {
      const existing = state.clients.find(
        (c) => c.client_name?.toLowerCase() === row.client_name.toLowerCase()
      );
      if (existing) {
        await window.sb
          .from('clients')
          .update({
            total_earned: Number(existing.total_earned || 0) + row.amount,
            total_projects: Number(existing.total_projects || 0) + 1,
            client_phone: row.client_phone || existing.client_phone,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id);
      } else {
        await window.sb.from('clients').insert({
          user_id: userId,
          client_name: row.client_name,
          client_phone: row.client_phone,
          total_earned: row.amount,
          total_projects: 1
        });
      }
    }

    closeModal('modal-earning');
    window.showToast('Earning added ✨', 'success');
    loadAll();
  });

  async function deleteEarning(id) {
    if (!confirm('Delete this earning?')) return;
    const { error } = await window.sb.from('earnings').delete().eq('id', id);
    if (error) return window.showToast(error.message, 'error');
    window.showToast('Earning deleted', 'success');
    loadAll();
  }

  // ---- Expense ----
  document.getElementById('open-expense').addEventListener('click', () => {
    document.getElementById('x-date').value = new Date().toISOString().slice(0, 10);
    openModal('modal-expense');
  });
  document.querySelectorAll('[data-action="add-expense"]').forEach((b) =>
    b.addEventListener('click', () => {
      document.getElementById('x-date').value = new Date().toISOString().slice(0, 10);
      openModal('modal-expense');
    })
  );
  document.getElementById('save-expense').addEventListener('click', async () => {
    const row = {
      user_id: userId,
      category: document.getElementById('x-cat').value,
      expense_name: document.getElementById('x-name').value.trim(),
      amount: Number(document.getElementById('x-amount').value || 0),
      date: document.getElementById('x-date').value || new Date().toISOString().slice(0, 10),
      notes: document.getElementById('x-notes').value.trim()
    };
    if (!row.expense_name) return window.showToast('Expense name required', 'error');
    if (!row.amount || row.amount < 0) return window.showToast('Enter a valid amount', 'error');
    const { error } = await window.sb.from('expenses').insert(row);
    if (error) return window.showToast(error.message, 'error');
    document.getElementById('x-name').value = '';
    document.getElementById('x-amount').value = '';
    document.getElementById('x-notes').value = '';
    closeModal('modal-expense');
    window.showToast('Expense recorded', 'success');
    loadAll();
  });
  async function deleteExpense(id) {
    if (!confirm('Delete this expense?')) return;
    const { error } = await window.sb.from('expenses').delete().eq('id', id);
    if (error) return window.showToast(error.message, 'error');
    window.showToast('Expense deleted', 'success');
    loadAll();
  }

  // ---- Quick actions ----
  document
    .querySelectorAll('[data-action="add-note"]')
    .forEach((b) => b.addEventListener('click', () => openModal('modal-note')));
  document.querySelectorAll('[data-action="view-clients"]').forEach((b) =>
    b.addEventListener('click', () => {
      document.querySelector('.nav-item[data-view="clients"]').click();
    })
  );

  // ---- Settings ----
  function renderSettings() {
    document.getElementById('pf-name').value = state.profile?.full_name || 'Yadhav Sreekanth';
    document.getElementById('pf-email').value = state.profile?.email || user.email;
  }
  document.getElementById('save-profile').addEventListener('click', async () => {
    const full_name = document.getElementById('pf-name').value.trim();
    const { error } = await window.sb
      .from('profiles')
      .upsert({ id: userId, email: user.email, full_name });
    if (error) return window.showToast(error.message, 'error');
    document.getElementById('avatar-btn').textContent = (full_name || 'YS')
      .split(' ')
      .map((s) => s[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
    window.showToast('Profile updated', 'success');
    state.profile.full_name = full_name;
  });

  // ---- Notifications ----
  document.getElementById('notif-btn').addEventListener('click', () => {
    const t = totals();
    window.showToast(`You've earned ${window.fmtINR(t.monthly)} this month 🎉`, 'success');
  });
  document
    .getElementById('avatar-btn')
    .addEventListener('click', () =>
      document.querySelector('.nav-item[data-view="settings"]').click()
    );

  // ---- Export ----
  document.getElementById('export-xls').addEventListener('click', () => {
    const rows = [['Type', 'Date', 'Category/Kind', 'Name', 'Amount (INR)']];
    state.earnings.forEach((e) =>
      rows.push(['Earning', e.date, typeLabel(e.earning_type), earningLabel(e), e.amount])
    );
    state.expenses.forEach((x) =>
      rows.push(['Expense', x.date, x.category, x.expense_name, -x.amount])
    );
    const csv = rows
      .map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'yadhav-finance.csv';
    a.click();
    URL.revokeObjectURL(url);
    window.showToast('CSV downloaded', 'success');
  });
  document.getElementById('export-pdf').addEventListener('click', () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const t = totals();
    doc.setFontSize(20);
    doc.setTextColor(109, 92, 255);
    doc.text('Yadhav Finance Dashboard', 14, 18);
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text('yadhav.website · ' + new Date().toLocaleDateString('en-IN'), 14, 25);
    doc.setTextColor(20);
    doc.setFontSize(12);
    let y = 38;
    const line = (k, v) => {
      doc.text(k, 14, y);
      doc.text(v, 120, y);
      y += 8;
    };
    line('Total earned', 'INR ' + t.earned.toLocaleString('en-IN'));
    line('Total spent', 'INR ' + t.spent.toLocaleString('en-IN'));
    line('Balance', 'INR ' + t.balance.toLocaleString('en-IN'));
    line('Clients', String(t.clients));
    line('Orders', String(t.orders));
    line('This month', 'INR ' + t.monthly.toLocaleString('en-IN'));
    y += 6;
    doc.setFontSize(13);
    doc.text('Recent earnings', 14, y);
    y += 8;
    doc.setFontSize(10);
    state.earnings.slice(0, 12).forEach((e) => {
      doc.text(`${e.date}  ${typeLabel(e.earning_type)}  ${earningLabel(e).slice(0, 32)}`, 14, y);
      doc.text('INR ' + Number(e.amount).toLocaleString('en-IN'), 160, y);
      y += 6;
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
    });
    doc.save('yadhav-finance.pdf');
    window.showToast('PDF downloaded', 'success');
  });

  // ---- Init ----
  lucide.createIcons();
  await loadAll();
  loader.classList.add('hidden');
})().catch((err) => {
  console.error(err);
  alert('Failed to load app: ' + err.message);
});
