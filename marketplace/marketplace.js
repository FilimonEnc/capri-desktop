'use strict';

// Marketplace client logic
const API_BASE = 'http://127.0.0.1:47823';

const connectionStatusEl = document.getElementById('connectionStatus');
const skillsGridEl = document.getElementById('skillsGrid');
const categoryNavEl = document.getElementById('categoryNav');
const refreshBtn = document.getElementById('refreshBtn');

const customModal = document.getElementById('customModal');
const openCustomModalBtn = document.getElementById('openCustomModalBtn');
const closeModalBtn = document.getElementById('closeModalBtn');
const cancelModalBtn = document.getElementById('cancelModalBtn');
const saveCustomSkillBtn = document.getElementById('saveCustomSkillBtn');

let allSkills = [];
let currentCategory = 'all';

async function checkHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`, { method: 'GET' });
    const data = await res.json();
    if (data.ok && data.name === 'capri') {
      connectionStatusEl.className = 'connection-status online';
      connectionStatusEl.querySelector('.status-text').textContent = `Связь установлена (PID: ${data.pid})`;
      return true;
    }
  } catch {
    connectionStatusEl.className = 'connection-status offline';
    connectionStatusEl.querySelector('.status-text').textContent = 'Капри не запущена (Автономный режим)';
  }
  return false;
}

async function fetchSkills() {
  try {
    const res = await fetch(`${API_BASE}/api/skills`);
    if (res.ok) {
      allSkills = await res.json();
      renderSkills();
      return;
    }
  } catch {}
  // Fallback demo data if offline
  allSkills = [
    {
      id: 'weather', name: 'Weather Forecast / Погода', category: 'utilities', author: 'Capri Team', icon: '🌤️',
      description: 'Узнавай погоду в любом городе мира через открытый API без API ключей.',
      tags: ['weather', 'api', 'online', 'погода'], installed: true, enabled: true
    },
    {
      id: 'calculator', name: 'Cyber Calculator / Калькулятор', category: 'productivity', author: 'Capri Team', icon: '🧮',
      description: 'Быстрые вычисления и математические операции прямо в диалоге.',
      tags: ['math', 'calc', 'калькулятор'], installed: true, enabled: true
    },
    {
      id: 'coin_dice', name: 'Dice & Coin Decider / Рандомайзер', category: 'fun', author: 'Capri Team', icon: '🎲',
      description: 'Бросок кубика, подбрасывание монетки или выбор между вариантами.',
      tags: ['dice', 'coin', 'random'], installed: true, enabled: true
    },
    {
      id: 'cyber_quotes', name: 'Night City Quotes / Цитаты Найт-Сити', category: 'fun', author: 'Capri Team', icon: '⚡',
      description: 'Культовые фразы, мудрость улиц Найт-Сити и киберпанк-мотивация.',
      tags: ['quotes', 'cyberpunk', 'lore'], installed: true, enabled: true
    },
    {
      id: 'dev_tools', name: 'Dev Utilities / Инструменты разработчика', category: 'development', author: 'Capri Team', icon: '💻',
      description: 'Генерация UUID, unix timestamp, base64 кодирование и декодирование.',
      tags: ['dev', 'uuid', 'base64', 'timestamp'], installed: false, enabled: false
    }
  ];
  renderSkills();
}

function renderSkills() {
  const filtered = currentCategory === 'all' 
    ? allSkills 
    : allSkills.filter(s => s.category === currentCategory);

  if (filtered.length === 0) {
    skillsGridEl.innerHTML = '<div style="color: var(--text-muted); padding: 2rem;">В этой категории пока нет навыков.</div>';
    return;
  }

  skillsGridEl.innerHTML = filtered.map(skill => `
    <div class="skill-card" data-id="${skill.id}">
      <div>
        <div class="card-header">
          <div class="skill-icon">${skill.icon || '⚡'}</div>
          <div class="card-meta">
            <h3>${skill.name}</h3>
            <span class="author-tag">by ${skill.author || 'Cyberpunk'}</span>
          </div>
        </div>
        <p class="card-desc">${skill.description}</p>
        <div class="card-tags">
          ${(skill.tags || []).map(t => `<span class="tag">#${t}</span>`).join('')}
        </div>
      </div>
      <div class="card-actions">
        ${skill.installed ? `
          <button class="btn-toggle ${skill.enabled ? 'enabled' : 'disabled'}" onclick="toggleSkill('${skill.id}', ${!skill.enabled})">
            ${skill.enabled ? '● ВКЛЮЧЕНО' : '○ ВЫКЛЮЧЕНО'}
          </button>
          <button class="btn btn-secondary" style="padding: 0.4rem 0.8rem; font-size: 0.75rem;" onclick="uninstallSkill('${skill.id}')">
            УДАЛИТЬ
          </button>
        ` : `
          <button class="btn-install" onclick="installSkill('${skill.id}')">
            + УСТАНОВИТЬ
          </button>
        `}
      </div>
    </div>
  `).join('');
}

window.toggleSkill = async function(id, enable) {
  try {
    const res = await fetch(`${API_BASE}/api/skills/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, enabled: enable })
    });
    if (res.ok) {
      await fetchSkills();
      return;
    }
  } catch {}
  // Offline update
  const s = allSkills.find(item => item.id === id);
  if (s) s.enabled = enable;
  renderSkills();
};

window.installSkill = async function(id) {
  try {
    const res = await fetch(`${API_BASE}/api/skills/install`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    if (res.ok) {
      await fetchSkills();
      return;
    }
  } catch {}
  const s = allSkills.find(item => item.id === id);
  if (s) {
    s.installed = true;
    s.enabled = true;
  }
  renderSkills();
};

window.uninstallSkill = async function(id) {
  try {
    const res = await fetch(`${API_BASE}/api/skills/uninstall`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    if (res.ok) {
      await fetchSkills();
      return;
    }
  } catch {}
  const s = allSkills.find(item => item.id === id);
  if (s) {
    s.installed = false;
    s.enabled = false;
  }
  renderSkills();
};

// Categories filter
categoryNavEl.addEventListener('click', (e) => {
  if (e.target.classList.contains('cat-btn')) {
    categoryNavEl.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    currentCategory = e.target.dataset.cat;
    renderSkills();
  }
});

refreshBtn.addEventListener('click', async () => {
  await checkHealth();
  await fetchSkills();
});

// Modal: Custom skill creation
openCustomModalBtn.addEventListener('click', () => customModal.classList.add('active'));
closeModalBtn.addEventListener('click', () => customModal.classList.remove('active'));
cancelModalBtn.addEventListener('click', () => customModal.classList.remove('active'));

saveCustomSkillBtn.addEventListener('click', async () => {
  const id = document.getElementById('skillIdInput').value.trim();
  const name = document.getElementById('skillNameInput').value.trim();
  const description = document.getElementById('skillDescInput').value.trim();
  const pattern = document.getElementById('skillPatternInput').value.trim();
  const replyTemplate = document.getElementById('skillReplyInput').value.trim();

  if (!id || !name || !pattern || !replyTemplate) {
    alert('Пожалуйста, заполни все обязательные поля (ID, название, шаблон триггера и ответ).');
    return;
  }

  const spec = { id, name, description, pattern, replyTemplate, category: 'custom', icon: '⚡' };
  try {
    await fetch(`${API_BASE}/api/skills/custom`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(spec)
    });
  } catch {}

  customModal.classList.remove('active');
  await fetchSkills();
});

// Init
checkHealth();
fetchSkills();
setInterval(checkHealth, 5000);
