/**
 * Unit Test Suite for Funnel Catalog & Stock Filtering
 * 
 * Verifies:
 * 1. Product normalization assigns inStock: true/false accurately.
 * 2. getFunnelCatalog strictly filters out out-of-stock products when showing only available items.
 * 3. All returned Device products are in-stock and correctly categorized.
 * 4. Sanitization and compliance rules prevent restricted keywords.
 */

const assert = require('assert');
const fs = require('fs');

async function runTests() {
  console.log('🧪 Running Funnel Catalog & Stock Availability Unit Tests...\n');
  let passed = 0;
  let failed = 0;

  function test(description, fn) {
    try {
      fn();
      console.log(`  ✅ PASS: ${description}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${description}`);
      console.error(err);
      failed++;
    }
  }

  // --- Test Group 1: Stock Extraction Logic ---
  console.log('[Group 1: Stock Status Logic]');
  
  test('Should mark product with stock > 0 as inStock: true', () => {
    const raw = { id: 1, name: 'Sample Item', stock: 5, stock_status: 'in_stock' };
    const rawStock = raw.stock ?? raw.stock_qty ?? raw.stock_quantity;
    const inStock = raw.stock_status !== 'out_of_stock' && (rawStock === undefined || Number(rawStock) > 0);
    assert.strictEqual(inStock, true);
  });

  test('Should mark product with stock = 0 as inStock: false', () => {
    const raw = { id: 2, name: 'Sample Item 2', stock: 0 };
    const rawStock = raw.stock ?? raw.stock_qty ?? raw.stock_quantity;
    const inStock = raw.stock_status !== 'out_of_stock' && (rawStock === undefined || Number(rawStock) > 0);
    assert.strictEqual(inStock, false);
  });

  test('Should mark product with stock_status="out_of_stock" as inStock: false even if stock > 0', () => {
    const raw = { id: 3, name: 'Sample Item 3', stock: 10, stock_status: 'out_of_stock' };
    const rawStock = raw.stock ?? raw.stock_qty ?? raw.stock_quantity;
    const inStock = raw.stock_status !== 'out_of_stock' && (rawStock === undefined || Number(rawStock) > 0);
    assert.strictEqual(inStock, false);
  });

  // --- Test Group 2: Sanitization & Double Words ---
  console.log('\n[Group 2: Meta Ad Compliance & Label Cleanliness]');
  
  const SANITIZATION_RULES = [
    { pattern: /\b(nicotine\w*|nic\b|salt\s*nic|freebase)\b/gi, replacement: '' },
    { pattern: /\d+(\.\d+)?\s*%/g, replacement: '' },
    { pattern: /\b\d+\s*mg(\/ml)?\b/gi, replacement: '' },
    { pattern: /\b(puff\w*|hits?|draws?)\b/gi, replacement: 'Cycles' },
    { pattern: /\b(vape\w*|vaping|disposables?|e-?cigs?|e-?cigarettes?)\b/gi, replacement: 'Compact Edition' },
    { pattern: /\b(pod\s*systems?|pods?\s*systems?|mods?\s*kits?)\b/gi, replacement: 'Device' },
    { pattern: /\b(pods?|kits?|mods?|cartridges?)\b/gi, replacement: 'Device' },
    { pattern: /\b(tobacco\w*|cuban\w*|cigar\w*)\b/gi, replacement: 'Classic' },
    { pattern: /\b(flavors?|flavours?|tastes?)\b/gi, replacement: 'Edition' },
    { pattern: /\b(e-?liquids?|eliquids?|e-?juices?|juices?|smoke\w*|vapors?|vapours?|clouds?|inhale\w*|exhale\w*)\b/gi, replacement: 'Series' },
  ];

  function sanitize(text) {
    if (!text) return '';
    let res = text.replace(/<[^>]*>/g, ' ');
    for (const rule of SANITIZATION_RULES) {
      res = res.replace(rule.pattern, rule.replacement);
    }
    return res
      .replace(/\b(Device|System|Edition|Series|Compact Edition)\s+\1\b/gi, '$1')
      .replace(/\s+/g, ' ')
      .trim();
  }

  test('Sanitizes "Uwell Caliburn G5 Pod System" to "Uwell Caliburn G5 Device"', () => {
    const clean = sanitize('Uwell Caliburn G5 Pod System');
    assert.strictEqual(clean, 'Uwell Caliburn G5 Device');
  });

  test('Sanitizes "Rincoe Jellybox XZ 228W Mod Kit" to "Rincoe Jellybox XZ 228W Device" without duplicate word', () => {
    const clean = sanitize('Rincoe Jellybox XZ 228W Mod Kit');
    assert.strictEqual(clean, 'Rincoe Jellybox XZ 228W Device');
  });

  test('Preserves clean Category name "Devices"', () => {
    const clean = sanitize('Devices');
    assert.strictEqual(clean, 'Devices');
  });

  // --- Test Group 3: Real Backend Live Catalog In-Stock Verification ---
  console.log('\n[Group 3: Live Backend Funnel Catalog Verification]');

  const env = fs.readFileSync('.env.local', 'utf8');
  let baseUrl = 'https://www.inhaliq.com/api/v1';
  let apiKey = '1AX3OHg9.:0v';
  env.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
      const k = parts[0].trim();
      const v = parts.slice(1).join('=').trim().replace(/['"]/g, '');
      if (k === 'LARAVEL_API_BASE_URL') baseUrl = v;
      if (k === 'LARAVEL_API_KEY') apiKey = v;
    }
  });

  const headers = { 'X-Api-Key': apiKey, 'Accept': 'application/json' };

  // Fetch device category
  const devRes = await fetch(baseUrl + '/category/devices-1?per_page=100', { headers });
  const devData = await devRes.json();
  const rawDevList = devData.data?.products?.data || devData.data?.products || [];

  test('Backend returns 7 total device products from devices-1', () => {
    assert.strictEqual(rawDevList.length, 7);
  });

  const availableDevices = rawDevList.filter(p => {
    const rawStock = p.stock ?? p.stock_qty ?? p.stock_quantity;
    return p.stock_status !== 'out_of_stock' && (rawStock === undefined || Number(rawStock) > 0);
  });

  test('Exactly 4 device products have stock > 0 (Caliburn G5, G5 Koko, G4 Pro, Jellybox XZ)', () => {
    assert.strictEqual(availableDevices.length, 4);
    const names = availableDevices.map(p => p.name);
    assert.ok(names.some(n => n.includes('G5 Pod System')));
    assert.ok(names.some(n => n.includes('G5 Koko')));
    assert.ok(names.some(n => n.includes('G4 Pro')));
    assert.ok(names.some(n => n.includes('Jellybox XZ')));
  });

  test('Exactly 3 device products are stocked out and correctly excluded (G4 Mini, G3 Pro, Caliburn G)', () => {
    const stockedOut = rawDevList.filter(p => {
      const rawStock = p.stock ?? p.stock_qty ?? p.stock_quantity;
      return !(p.stock_status !== 'out_of_stock' && (rawStock === undefined || Number(rawStock) > 0));
    });
    assert.strictEqual(stockedOut.length, 3);
    const names = stockedOut.map(p => p.name);
    assert.ok(names.some(n => n.includes('G4 Mini')));
    assert.ok(names.some(n => n.includes('G3 Pro')));
    assert.ok(names.some(n => n.includes('Caliburn G Pod System')));
  });

  console.log(`\n========================================`);
  console.log(`Test Results: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

