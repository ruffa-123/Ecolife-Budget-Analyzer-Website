// Shared JS for nav active state + Planner logic
document.addEventListener('DOMContentLoaded', ()=> {
  // highlight current nav link
  const links = document.querySelectorAll('.main-nav .nav-link');
  links.forEach(a => {
    if (a.href === location.href || location.href.endsWith(a.getAttribute('href'))) {
      a.classList.add('active');
      a.style.boxShadow = 'inset 0 -3px 0 rgba(255,255,255,0.12)';
    }
  });

  // Planner page logic
  if (document.getElementById('budgetForm')) {
    plannerInit();
  }
});

function plannerInit() {
  const addBtn = document.getElementById('addExpense');
  const extra = document.getElementById('extraExpenses');
  const calcBtn = document.getElementById('calcBtn');
  const saveBtn = document.getElementById('saveBtn');
  const clearBtn = document.getElementById('clearBtn');

  addBtn.addEventListener('click', addExpenseRow);
  calcBtn.addEventListener('click', calculate);
  saveBtn.addEventListener('click', savePlan);
  clearBtn.addEventListener('click', clearForm);
  document.getElementById('extraExpenses').addEventListener('click', e => {
    if (e.target && e.target.classList.contains('remove-expense')) {
      e.target.closest('.expense-row').remove();
    }
  });

  loadSavedPlans();
}

function addExpenseRow(){
  const container = document.getElementById('extraExpenses');
  const row = document.createElement('div');
  row.className = 'expense-row';
  row.innerHTML = `
    <input type="text" class="expense-name" placeholder="Category (e.g., Groceries)" required>
    <input type="number" class="expense-amt" placeholder="0.00" min="0" step="0.01" required>
    <select class="expense-tag">
      <option value="neutral">Neutral</option>
      <option value="sustainable">Sustainable</option>
      <option value="unsustainable">Unsustainable</option>
    </select>
    <button type="button" class="remove-expense" title="Remove">✕</button>
  `;
  container.appendChild(row);
}

function parseMoney(v){
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function calculate(){
  // base entries include the first expense-row already in HTML
  const income = parseMoney(document.getElementById('income').value);
  const name = (document.getElementById('planName').value || 'Plan');
  const expenseRows = Array.from(document.querySelectorAll('.expense-row'));
  let total = 0;
  let sustainable = 0;
  let unsustainable = 0;
  let neutral = 0;
  const breakdown = {};

  expenseRows.forEach(r => {
    const cat = r.querySelector('.expense-name').value || 'Other';
    const amt = parseMoney(r.querySelector('.expense-amt').value);
    const tag = r.querySelector('.expense-tag').value;
    total += amt;
    breakdown[cat] = (breakdown[cat] || 0) + amt;
    if (tag === 'sustainable') sustainable += amt;
    else if (tag === 'unsustainable') unsustainable += amt;
    else neutral += amt;
  });

  // display summary
  const balance = income - total;
  document.getElementById('sIncome').innerText = income.toFixed(2);
  document.getElementById('sExpenses').innerText = total.toFixed(2);
  document.getElementById('sBalance').innerText = balance.toFixed(2);

  // Eco-Score calculation (simple, transparent):
  // Start with 50. Add up to +30 for higher sustainable share, subtract up to -40 for high unsustainable share,
  // and small bonus for balance (>10% savings).
  // step-by-step to avoid arithmetic slip:
  // sustainableShare = sustainable / (total || 1)
  // unsustainableShare = unsustainable / (total || 1)
  const denom = total > 0 ? total : 1;
  const sustainableShare = sustainable / denom; // between 0..1
  const unsustainableShare = unsustainable / denom;

  // compute increments
  let score = 50; // baseline
  // add sustainable: up to +30 (if sustainableShare = 1)
  score += Math.round(sustainableShare * 30);
  // subtract unsustainable: up to -40
  score -= Math.round(unsustainableShare * 40);
  // bonus if balance >= 10% of income -> +10
  if (income > 0 && balance >= income * 0.10) score += 10;
  // clamp 0..100
  if (score < 0) score = 0;
  if (score > 100) score = 100;

  // advice
  const adviceEl = document.getElementById('ecoAdvice');
  if (score >= 80) {
    adviceEl.innerText = 'Excellent — your plan strongly favors sustainable choices and savings.';
  } else if (score >= 60) {
    adviceEl.innerText = 'Good — some sustainable choices. Consider shifting more to low-carbon options.';
  } else if (score >= 40) {
    adviceEl.innerText = 'Fair — there are improvements available: public transit, local produce, repair-first.';
  } else {
    adviceEl.innerText = 'Low — high share of unsustainable spending. Prioritize reuse, repair, and public transport.';
  }
  document.getElementById('ecoMeter').innerText = score + ' / 100';

  // draw pie chart for top categories
  drawPie(breakdown);

  // show save button when calculated
  document.getElementById('saveBtn').disabled = false;
}

function drawPie(breakdown){
  const canvas = document.getElementById('pie');
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0,0,w,h);

  const entries = Object.entries(breakdown);
  if (entries.length === 0) {
    ctx.fillStyle = '#f3f5f7';
    ctx.font = '14px sans-serif';
    ctx.fillText('No expense data', 10, 20);
    return;
  }

  const total = entries.reduce((s,[k,v]) => s + v, 0) || 1;
  // colors (repeating)
  const colors = ['#4CAF50','#81C784','#FFB74D','#64B5F6','#BA68C8','#E57373','#AED581'];
  let start = -Math.PI / 2;
  entries.forEach((entry, i) => {
    const value = entry[1];
    const slice = (value / total) * (Math.PI * 2);
    ctx.beginPath();
    ctx.moveTo(w/2, h/2);
    ctx.arc(w/2, h/2, Math.min(w,h)/2 - 10, start, start + slice);
    ctx.closePath();
    ctx.fillStyle = colors[i % colors.length];
    ctx.fill();
    start += slice;
  });

  // legend
  ctx.font = '12px sans-serif';
  let ly = 12;
  entries.forEach((entry, i) => {
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(6, ly, 10, 10);
    ctx.fillStyle = '#111827';
    ctx.fillText(entry[0] + ' — ₱' + entry[1].toFixed(2), 22, ly + 10);
    ly += 16;
  });
}

// localStorage save/load
function savePlan(){
  const planName = (document.getElementById('planName').value || 'Plan');
  const income = parseMoney(document.getElementById('income').value);
  const rows = Array.from(document.querySelectorAll('.expense-row')).map(r => ({
    name: r.querySelector('.expense-name').value,
    amt: parseMoney(r.querySelector('.expense-amt').value),
    tag: r.querySelector('.expense-tag').value
  }));
  const saved = JSON.parse(localStorage.getItem('ecoPlans') || '[]');
  saved.push({id:Date.now(), name:planName, income, rows});
  localStorage.setItem('ecoPlans', JSON.stringify(saved));
  loadSavedPlans();
  alert('Plan saved locally. (Demo only)');
}

function loadSavedPlans(){
  const list = document.getElementById('savedPlans');
  list.innerHTML = '';
  const saved = JSON.parse(localStorage.getItem('ecoPlans') || '[]');
  saved.reverse().forEach(plan => {
    const li = document.createElement('li');
    li.innerHTML = `<span>${escapeHtml(plan.name)} — ₱${Number(plan.income).toFixed(2)}</span>
      <div>
        <button onclick='loadPlan(${plan.id})'>Load</button>
        <button onclick='deletePlan(${plan.id})'>Delete</button>
      </div>`;
    list.appendChild(li);
  });
}

function deletePlan(id){
  const saved = JSON.parse(localStorage.getItem('ecoPlans') || '[]');
  const filtered = saved.filter(p => p.id !== id);
  localStorage.setItem('ecoPlans', JSON.stringify(filtered));
  loadSavedPlans();
}

function loadPlan(id){
  const saved = JSON.parse(localStorage.getItem('ecoPlans') || '[]');
  const plan = saved.find(p => p.id === id);
  if (!plan) return;
  document.getElementById('planName').value = plan.name;
  document.getElementById('income').value = plan.income;
  // remove existing extra rows
  document.querySelectorAll('#extraExpenses .expense-row').forEach(n => n.remove());
  // fill first expense-row and extras
  const rows = plan.rows;
  // ensure there is at least one base row on the form (first)
  const allRows = document.querySelectorAll('.expense-row');
  if (allRows.length === 0) {
    addExpenseRow();
  }
  // populate: set first row, then add more if needed
  rows.forEach((r, idx) => {
    if (idx === 0) {
      const first = document.querySelector('.expense-row');
      first.querySelector('.expense-name').value = r.name;
      first.querySelector('.expense-amt').value = r.amt;
      first.querySelector('.expense-tag').value = r.tag;
    } else {
      addExpenseRow();
      const created = document.querySelectorAll('#extraExpenses .expense-row');
      const last = created[created.length - 1];
      last.querySelector('.expense-name').value = r.name;
      last.querySelector('.expense-amt').value = r.amt;
      last.querySelector('.expense-tag').value = r.tag;
    }
  });
  calculate();
}

function clearForm(){
  document.getElementById('budgetForm').reset();
  // remove extra entries
  document.getElementById('extraExpenses').innerHTML = '';
  // reset displays
  document.getElementById('sIncome').innerText = '0.00';
  document.getElementById('sExpenses').innerText = '0.00';
  document.getElementById('sBalance').innerText = '0.00';
  document.getElementById('ecoMeter').innerText = '—';
  document.getElementById('ecoAdvice').innerText = 'Calculate to see advice.';
  const canvas = document.getElementById('pie');
  if (canvas) canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);
}

// helpers
function parseMoney(v){ const n = parseFloat(v); return Number.isFinite(n) ? n : 0; }
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
