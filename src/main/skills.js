'use strict';

// Capri Dynamic Skills Engine.
// Allows extending Capri's capabilities at runtime without rebuilding the application.
// Skills are stored in userData/skills/ and can be installed/managed via the Skills Marketplace.

const fs = require('node:fs');
const path = require('node:path');
let app;
try {
  ({ app } = require('electron'));
} catch {
  // Headless / test runner environment
}

const CATALOG = [
  {
    id: 'weather',
    name: 'Weather Forecast / Погода',
    description: 'Узнавай погоду в любом городе мира через открытый API (без API ключей).',
    category: 'utilities',
    author: 'Capri Team',
    version: '1.0.0',
    icon: '🌤️',
    tags: ['weather', 'api', 'online', 'погода'],
    patterns: [
      /^(?:какая\s+)?погода\s+(?:в|на)?\s*([a-zA-Zа-яА-ЯёЁ\s-]+)$/i,
      /^weather(?:\s+in)?\s+([a-zA-Z\s-]+)$/i,
    ],
    prompt: '[[skill:weather CITY]] to get real-time weather in any city.',
    async execute({ match }) {
      const city = (match[1] || '').trim();
      if (!city) return { ok: false, error: 'City not specified' };
      try {
        const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=ru&format=json`;
        const geoRes = await fetch(geoUrl).then((r) => r.json());
        if (!geoRes.results || !geoRes.results.length) {
          return { ok: true, text: `Не смогла найти город «${city}». Проверь название, choom.` };
        }
        const loc = geoRes.results[0];
        const wUrl = `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m`;
        const wRes = await fetch(wUrl).then((r) => r.json());
        const curr = wRes.current;
        const temp = Math.round(curr.temperature_2m);
        const feels = Math.round(curr.apparent_temperature);
        const wind = Math.round(curr.wind_speed_10m);
        const humidity = curr.relative_humidity_2m;
        return {
          ok: true,
          text: `В городе ${loc.name}: ${temp > 0 ? '+' : ''}${temp}°C (ощущается как ${feels > 0 ? '+' : ''}${feels}°C). Ветер ${wind} км/ч, влажность ${humidity}%.`,
          face: temp > 0 ? 'laugh' : 'aside',
        };
      } catch (err) {
        return { ok: false, error: err.message };
      }
    },
  },
  {
    id: 'calculator',
    name: 'Cyber Calculator / Калькулятор',
    description: 'Быстрые вычисления и математические операции прямо в диалоге.',
    category: 'productivity',
    author: 'Capri Team',
    version: '1.0.0',
    icon: '🧮',
    tags: ['math', 'calc', 'калькулятор', 'числа'],
    patterns: [
      /^(?:посчитай|вычисли|сколько будет|calc|calculate)\s+(.+)$/i,
      /^[0-9\s()+\-*/^.%]+$/i,
    ],
    prompt: '[[skill:calculator EXPRESSION]] to compute accurate math expressions.',
    async execute({ match, text }) {
      const expr = (match[1] || text || '').replace(/[,]/g, '.').replace(/[xх]/gi, '*');
      // Only allow safe math tokens
      if (!/^[\d\s+\-*/().%^eE]+$/.test(expr)) {
        return { ok: false, error: 'Unsafe characters in math expression' };
      }
      try {
        const sanitized = expr.replace(/\^/g, '**');
        // evaluate safely with Function returning number
        const fn = new Function(`"use strict"; return (${sanitized});`);
        const result = fn();
        if (typeof result !== 'number' || Number.isNaN(result)) {
          return { ok: false, error: 'Invalid calculation result' };
        }
        return {
          ok: true,
          text: `Держи расчёт: ${expr.trim()} = ${result}. Биочип не врёт.`,
          face: 'smug',
        };
      } catch {
        return { ok: false, error: 'Calculation failed' };
      }
    },
  },
  {
    id: 'coin_dice',
    name: 'Dice & Coin Decider / Рандомайзер',
    description: 'Бросок кубика, подбрасывание монетки или выбор между вариантами.',
    category: 'fun',
    author: 'Capri Team',
    version: '1.0.0',
    icon: '🎲',
    tags: ['dice', 'coin', 'random', 'игра', 'рандом'],
    patterns: [
      /^(?:брось|кинь)\s+(?:кубик|кости|d6|d20|d100)/i,
      /^(?:монетка|брось монетку|ор[её]л или решка)/i,
      /^(?:выбери|что выбрать|выбери между)\s+(.+?)\s+(?:или|or)\s+(.+)$/i,
    ],
    prompt: '[[skill:dice]] to roll dice or decide between choices.',
    async execute({ text, match }) {
      if (/монет/i.test(text) || /решк/i.test(text)) {
        const side = Math.random() < 0.5 ? 'Орёл 🦅' : 'Решка 🪙';
        return { ok: true, text: `Монетка в воздухе... Выпало: ${side}!`, face: 'laugh' };
      }
      if (/d20/i.test(text)) {
        const val = Math.floor(Math.random() * 20) + 1;
        const note = val === 20 ? 'Критический успех! Preem!' : val === 1 ? 'Критический провал! Flatline...' : '';
        return { ok: true, text: `d20: ${val}! ${note}`.trim(), face: val >= 10 ? 'smug' : 'wide' };
      }
      if (/кубик|кости|d6/i.test(text)) {
        const val = Math.floor(Math.random() * 6) + 1;
        return { ok: true, text: `На гранях кубика: ${val} 🎲`, face: 'laugh' };
      }
      if (match[1] && match[2]) {
        const opt1 = match[1].trim();
        const opt2 = match[2].trim();
        const pick = Math.random() < 0.5 ? opt1 : opt2;
        return { ok: true, text: `Я выбираю: «${pick}». Интуиция кибер-ассистента.`, face: 'smug' };
      }
      const val = Math.floor(Math.random() * 100) + 1;
      return { ok: true, text: `Случайное число от 1 до 100: ${val}`, face: 'laugh' };
    },
  },
  {
    id: 'cyber_quotes',
    name: 'Night City Quotes / Цитаты Найт-Сити',
    description: 'Культовые фразы, мудрость улиц Найт-Сити и киберпанк-мотивация.',
    category: 'fun',
    author: 'Capri Team',
    version: '1.0.0',
    icon: '⚡',
    tags: ['quotes', 'cyberpunk', 'lore', 'цитаты'],
    patterns: [
      /^(?:цитат[ау]|вдохнови|скажи что-нибудь|мудрость|cyber quote)/i,
    ],
    prompt: '[[skill:quote]] for cyberpunk quotes and street wisdom.',
    async execute() {
      const quotes = [
        'В Найт-Сити легендами не рождаются — ими умирают. Но мы пока поживём, choom.',
        'Всегда держи биочип в холоде, а импланты — смазанными.',
        'Если сеть падает, спасай данные. Если падаешь ты — перезагружай биочип.',
        'Не доверяй корпоратам. Доверяй проверенному коду и верному ассистенту.',
        'Главное правило фиксера: никогда не сдавай заказчика и не запускай непроверенные бинарники.',
        'Преемно сработано! Мы ещё покажем этой системе, на что способны.',
      ];
      const q = quotes[Math.floor(Math.random() * quotes.length)];
      return { ok: true, text: q, face: 'smug' };
    },
  },
  {
    id: 'dev_tools',
    name: 'Dev Utilities / Инструменты разработчика',
    description: 'Генерация UUID, unix timestamp, base64 кодирование и декодирование.',
    category: 'development',
    author: 'Capri Team',
    version: '1.0.0',
    icon: '💻',
    tags: ['dev', 'uuid', 'base64', 'timestamp', 'unix'],
    patterns: [
      /^(?:дай\s+)?uuid$/i,
      /^(?:дай\s+)?(?:timestamp|время unix|unix time)$/i,
      /^(?:base64\s+encode|base64\s+закодируй)\s+(.+)$/i,
      /^(?:base64\s+decode|base64\s+раскодируй)\s+(.+)$/i,
    ],
    prompt: '[[skill:uuid]] or [[skill:base64]] for dev utilities.',
    async execute({ text, match }) {
      if (/uuid/i.test(text)) {
        const id = require('node:crypto').randomUUID();
        return { ok: true, text: `Свежий UUID v4: ${id}`, face: 'smug' };
      }
      if (/timestamp|unix/i.test(text)) {
        const now = Math.floor(Date.now() / 1000);
        return { ok: true, text: `Текущий Unix Timestamp: ${now} (${new Date().toISOString()})`, face: 'smug' };
      }
      if (/encode|закодируй/i.test(text)) {
        const b64 = Buffer.from(match[1] || '', 'utf8').toString('base64');
        return { ok: true, text: `Base64: ${b64}`, face: 'smug' };
      }
      if (/decode|раскодируй/i.test(text)) {
        try {
          const str = Buffer.from(match[1] || '', 'base64').toString('utf8');
          return { ok: true, text: `Текст: ${str}`, face: 'smug' };
        } catch {
          return { ok: false, error: 'Некорректная Base64 строка' };
        }
      }
      return { ok: false, error: 'Неизвестная команда' };
    },
  },
];

class SkillsManager {
  constructor() {
    this.skillsDir = null;
    this.installed = new Map(); // id -> skill
    this.catalog = new Map();   // id -> catalog entry
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    const baseDir = app?.getPath ? app.getPath('userData') : path.join(process.cwd(), '.capri');
    this.skillsDir = path.join(baseDir, 'skills');
    fs.mkdirSync(this.skillsDir, { recursive: true });

    // Populate catalog
    for (const item of CATALOG) {
      this.catalog.set(item.id, item);
    }
    this.initialized = true;

    // Default: install weather, calculator, dice/coin, and cyber_quotes out of the box
    this.loadInstalled();
    if (this.installed.size === 0) {
      this.install('weather');
      this.install('calculator');
      this.install('coin_dice');
      this.install('cyber_quotes');
    }
  }

  loadInstalled() {
    if (!fs.existsSync(this.skillsDir)) return;
    const entries = fs.readdirSync(this.skillsDir, { withFileTypes: true });
    for (const ent of entries) {
      if (ent.isDirectory()) {
        const skillPath = path.join(this.skillsDir, ent.name);
        const manifestFile = path.join(skillPath, 'skill.json');
        if (fs.existsSync(manifestFile)) {
          try {
            const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
            const cat = this.catalog.get(manifest.id);
            this.installed.set(manifest.id, {
              ...cat,
              ...manifest,
              dir: skillPath,
              execute: cat?.execute || this.loadAction(skillPath, manifest),
            });
          } catch (e) {
            console.error(`[skills] failed to load ${ent.name}:`, e.message);
          }
        }
      }
    }
  }

  loadAction(skillPath, manifest) {
    const actionFile = path.join(skillPath, manifest.entry || 'index.js');
    if (fs.existsSync(actionFile)) {
      try {
        const mod = require(actionFile);
        return typeof mod === 'function' ? mod : mod.execute || null;
      } catch (e) {
        console.error(`[skills] error requiring ${actionFile}:`, e.message);
      }
    }
    return null;
  }

  list() {
    this.init();
    return Array.from(this.catalog.values()).map((c) => {
      const inst = this.installed.get(c.id);
      return {
        id: c.id,
        name: c.name,
        description: c.description,
        category: c.category,
        author: c.author,
        version: c.version,
        icon: c.icon,
        tags: c.tags,
        installed: Boolean(inst),
        enabled: inst ? inst.enabled !== false : false,
      };
    });
  }

  install(id) {
    this.init();
    const item = this.catalog.get(id);
    if (!item) return { ok: false, error: 'Skill not in catalog' };
    const dir = path.join(this.skillsDir, id);
    fs.mkdirSync(dir, { recursive: true });
    const manifest = {
      id: item.id,
      name: item.name,
      description: item.description,
      category: item.category,
      author: item.author,
      version: item.version,
      icon: item.icon,
      tags: item.tags,
      enabled: true,
      installedAt: new Date().toISOString(),
    };
    fs.writeFileSync(path.join(dir, 'skill.json'), JSON.stringify(manifest, null, 2));
    this.installed.set(id, {
      ...item,
      ...manifest,
      dir,
    });
    return { ok: true, skill: manifest };
  }

  uninstall(id) {
    this.init();
    const inst = this.installed.get(id);
    if (!inst) return { ok: false, error: 'Skill not installed' };
    try {
      if (inst.dir && fs.existsSync(inst.dir)) {
        fs.rmSync(inst.dir, { recursive: true, force: true });
      }
    } catch {}
    this.installed.delete(id);
    return { ok: true };
  }

  toggle(id, enabled) {
    this.init();
    const inst = this.installed.get(id);
    if (!inst) return { ok: false, error: 'Skill not installed' };
    inst.enabled = Boolean(enabled);
    const manifestFile = path.join(inst.dir, 'skill.json');
    if (fs.existsSync(manifestFile)) {
      try {
        const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
        manifest.enabled = inst.enabled;
        fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));
      } catch {}
    }
    return { ok: true, enabled: inst.enabled };
  }

  createCustom(customSpec) {
    this.init();
    const id = customSpec.id || `custom-${Date.now()}`;
    const dir = path.join(this.skillsDir, id);
    fs.mkdirSync(dir, { recursive: true });
    const manifest = {
      id,
      name: customSpec.name || id,
      description: customSpec.description || '',
      category: customSpec.category || 'custom',
      author: customSpec.author || 'User',
      version: '1.0.0',
      icon: customSpec.icon || '⚡',
      tags: customSpec.tags || ['custom'],
      enabled: true,
      replyTemplate: customSpec.replyTemplate || 'Done: {input}',
      patternStr: customSpec.pattern || '',
      installedAt: new Date().toISOString(),
    };
    fs.writeFileSync(path.join(dir, 'skill.json'), JSON.stringify(manifest, null, 2));
    
    // Add to catalog & installed
    const entry = {
      ...manifest,
      patterns: manifest.patternStr ? [new RegExp(manifest.patternStr, 'i')] : [],
      async execute({ text, match }) {
        const reply = manifest.replyTemplate
          .replace('{input}', text)
          .replace('{match}', match?.[1] || '');
        return { ok: true, text: reply, face: 'smug' };
      },
    };
    this.catalog.set(id, entry);
    this.installed.set(id, { ...entry, dir });
    return { ok: true, skill: manifest };
  }

  // Direct intent match before LLM is called
  match(text) {
    this.init();
    const clean = String(text || '').trim();
    for (const skill of this.installed.values()) {
      if (skill.enabled === false || !skill.patterns) continue;
      for (const pattern of skill.patterns) {
        const m = pattern.exec(clean);
        if (m) {
          return { skill, match: m, text: clean };
        }
      }
    }
    return null;
  }

  async runAction(skillId, params) {
    this.init();
    const skill = this.installed.get(skillId) || this.catalog.get(skillId);
    if (!skill || !skill.execute) {
      return { ok: false, error: 'Skill or action not found' };
    }
    return skill.execute(params);
  }

  getPowers() {
    this.init();
    const active = Array.from(this.installed.values()).filter((s) => s.enabled !== false && s.prompt);
    return active.map((s) => s.prompt);
  }
}

const skills = new SkillsManager();

module.exports = skills;
