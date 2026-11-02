const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

// Point userData to a clean temp directory for testing
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'capri-skills-test-'));

// Mock electron app if needed
try {
  const electron = require('electron');
  if (!electron.app) {
    electron.app = { getPath: () => tmpDir };
  }
} catch {
  // noop
}

const skills = require('../src/main/skills');

test('skills engine catalog and lifecycle', async (t) => {
  await t.test('list returns default catalog items with install status', () => {
    const list = skills.list();
    assert.ok(Array.isArray(list));
    assert.ok(list.length >= 5);
    const weather = list.find((s) => s.id === 'weather');
    assert.ok(weather, 'weather skill should be in catalog');
    assert.equal(weather.installed, true, 'default skills should be installed');
  });

  await t.test('intent matching for calculator', async () => {
    const match = skills.match('посчитай 42 * 2');
    assert.ok(match, 'should match calculator');
    assert.equal(match.skill.id, 'calculator');
    const res = await skills.runAction('calculator', { text: 'посчитай 42 * 2', match: match.match });
    assert.ok(res.ok);
    assert.ok(res.text.includes('84'));
  });

  await t.test('intent matching for coin_dice', async () => {
    const coinMatch = skills.match('брось монетку');
    assert.ok(coinMatch);
    assert.equal(coinMatch.skill.id, 'coin_dice');
    const coinRes = await skills.runAction('coin_dice', { text: 'брось монетку', match: coinMatch.match });
    assert.ok(coinRes.ok);
    assert.ok(coinRes.text.includes('Орёл') || coinRes.text.includes('Решка'));

    const diceMatch = skills.match('кинь кубик');
    assert.ok(diceMatch);
    const diceRes = await skills.runAction('coin_dice', { text: 'кинь кубик', match: diceMatch.match });
    assert.ok(diceRes.ok);
    assert.ok(/На гранях кубика: [1-6]/.test(diceRes.text));
  });

  await t.test('intent matching for cyber_quotes', async () => {
    const quoteMatch = skills.match('скажи что-нибудь из найт-сити');
    assert.ok(quoteMatch);
    assert.equal(quoteMatch.skill.id, 'cyber_quotes');
    const quoteRes = await skills.runAction('cyber_quotes', { text: 'скажи что-нибудь', match: quoteMatch.match });
    assert.ok(quoteRes.ok);
    assert.ok(quoteRes.text.length > 10);
  });

  await t.test('custom skill creation and execution', async () => {
    const created = skills.createCustom({
      id: 'greeting_mod',
      name: 'Custom Greeter',
      pattern: '^привет capri',
      replyTemplate: 'Йоу! Системы в норме, чоом. Запрос: {input}',
    });
    assert.ok(created.ok);

    const match = skills.match('привет capri');
    assert.ok(match);
    assert.equal(match.skill.id, 'greeting_mod');

    const res = await skills.runAction('greeting_mod', { text: 'привет capri', match: match.match });
    assert.ok(res.ok);
    assert.ok(res.text.includes('Йоу! Системы в норме'));
  });

  await t.test('toggle and uninstall skill', () => {
    skills.toggle('calculator', false);
    assert.equal(skills.match('посчитай 1 + 1'), null, 'disabled skill should not match');

    skills.toggle('calculator', true);
    assert.ok(skills.match('посчитай 1 + 1'), 'enabled skill should match');

    skills.uninstall('greeting_mod');
    assert.equal(skills.match('привет capri'), null, 'uninstalled custom skill should not match');
  });

  await t.test('prompt powers list', () => {
    const powers = skills.getPowers();
    assert.ok(Array.isArray(powers));
    assert.ok(powers.length > 0);
  });
});
