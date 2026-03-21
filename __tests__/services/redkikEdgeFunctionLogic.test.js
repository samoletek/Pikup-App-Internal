/**
 * Unit tests for Redkik Edge Function pure logic.
 *
 * The edge function runs in Deno, so we re-declare the pure helpers here
 * (they contain zero Deno imports) and test them thoroughly.
 * If the source logic changes, these tests must be updated to match.
 */

// ── Re-declared pure helpers (mirrors supabase/functions/redkik-quote/index.ts) ──

const ELECTRONICS_KEYWORDS = [
  "tv", "television", "monitor", "laptop", "computer", "desktop", "tablet",
  "smartphone", "iphone", "ipad", "macbook", "chromebook",
  "smartwatch", "apple watch", "airpods", "earbuds", "headphones", "headset",
  "soundbar", "home theater", "streaming device", "roku", "fire stick", "apple tv",
  "smart thermostat", "smart doorbell", "security camera", "smart speaker", "echo dot",
  "google home", "google nest", "ring doorbell",
  "playstation", "xbox", "nintendo switch", "game console", "vr headset",
  "gopro", "drone", "digital camera", "action cam",
];

const ELECTRONICS_CATEGORIES = [
  "electronics", "computers", "phones", "gaming", "smart home",
  "audio", "photography", "mobile",
];

function isElectronicsItem(item) {
  const name = (item.name || "").toLowerCase();
  const category = (item.category || "").toLowerCase();
  const description = (item.description || "").toLowerCase();
  const text = `${name} ${description}`;

  if (ELECTRONICS_CATEGORIES.some((cat) => category.includes(cat))) return true;
  if (ELECTRONICS_KEYWORDS.some((kw) => text.includes(kw))) return true;
  return false;
}

const VALUE_LIMITS = {
  general: { min: 1, max: 8000 },
  electronics: { min: 1, max: 4000 },
};

const REDKIK_MINIMUM_PREMIUM = 11.00;
const SERVICE_FEE_MINIMUM = 1.99;
const SERVICE_FEE_PERCENT = 0.18;

function calculateServiceFee(redkikPremium) {
  if (redkikPremium <= REDKIK_MINIMUM_PREMIUM) {
    return SERVICE_FEE_MINIMUM;
  }
  return Math.round(redkikPremium * SERVICE_FEE_PERCENT * 100) / 100;
}

function calculateTotalInsuranceCost(redkikPremium) {
  return Math.round((redkikPremium + calculateServiceFee(redkikPremium)) * 100) / 100;
}

function findCommodityId(setup, type) {
  if (type === "electronics") {
    const elec = setup.commodities.find(
      (c) => c.name.toLowerCase().includes("electronic") || c.name.toLowerCase().includes("home electronics")
    );
    if (elec) return elec.id;
  }
  const general = setup.commodities.find(
    (c) => c.name.toLowerCase().includes("general")
  );
  if (general) return general.id;
  if (setup.commodities.length > 0) return setup.commodities[0].id;
  return "ebe38cf9-df60-4f69-9210-a439981e6989";
}

function findPolicyByAlias(setup, alias) {
  const policy = setup.policies.find(
    (p) => p.alias.toLowerCase().includes(alias.toLowerCase())
  );
  return policy?.id || null;
}

function validateItemValues(items) {
  const errors = [];
  for (const item of items) {
    const value = Number(item.value) || 0;
    if (value <= 0) continue;
    const isElec = isElectronicsItem(item);
    const limits = isElec ? VALUE_LIMITS.electronics : VALUE_LIMITS.general;
    const label = item.name || "Item";
    if (value < limits.min) {
      errors.push(`${label}: value $${value} is below minimum $${limits.min}`);
    }
    if (value > limits.max) {
      errors.push(`${label}: value $${value} exceeds maximum $${limits.max} for ${isElec ? "electronics" : "general merchandise"}`);
    }
  }
  return { valid: errors.length === 0, errors };
}

function extractAmendments(offer) {
  const amendments = offer.amendments || offer.Amendments || [];
  return Array.isArray(amendments) ? amendments : [];
}

function hasBlockingAmendments(amendments) {
  return amendments.some((a) => (a.type || "").toLowerCase() === "error");
}

// ── Tests ──

describe('Redkik Edge Function — calculateServiceFee', () => {
  test('returns $1.99 when premium is exactly $11 (minimum)', () => {
    expect(calculateServiceFee(11)).toBe(1.99);
  });

  test('returns $1.99 when premium is below $11', () => {
    expect(calculateServiceFee(5)).toBe(1.99);
    expect(calculateServiceFee(0)).toBe(1.99);
    expect(calculateServiceFee(10.99)).toBe(1.99);
  });

  test('returns 18% when premium is above $11', () => {
    // $15 * 0.18 = $2.70
    expect(calculateServiceFee(15)).toBe(2.70);
    // $20 * 0.18 = $3.60
    expect(calculateServiceFee(20)).toBe(3.60);
    // $100 * 0.18 = $18.00
    expect(calculateServiceFee(100)).toBe(18.00);
  });

  test('18% fee rounds to 2 decimal places', () => {
    // $11.01 * 0.18 = 1.9818 → $1.98
    expect(calculateServiceFee(11.01)).toBe(1.98);
    // $25.50 * 0.18 = 4.59
    expect(calculateServiceFee(25.50)).toBe(4.59);
    // $33.33 * 0.18 = 5.9994 → $6.00
    expect(calculateServiceFee(33.33)).toBe(6.00);
  });

  test('boundary: $11.00 exact uses minimum, $11.01 uses percent', () => {
    expect(calculateServiceFee(11.00)).toBe(1.99);
    expect(calculateServiceFee(11.01)).toBe(1.98); // 18% of $11.01 < $1.99 — expected
  });
});

describe('Redkik Edge Function — calculateTotalInsuranceCost', () => {
  test('minimum premium: $11 + $1.99 = $12.99', () => {
    expect(calculateTotalInsuranceCost(11)).toBe(12.99);
  });

  test('below minimum: $5 + $1.99 = $6.99', () => {
    expect(calculateTotalInsuranceCost(5)).toBe(6.99);
  });

  test('above minimum: $20 + $3.60 = $23.60', () => {
    expect(calculateTotalInsuranceCost(20)).toBe(23.60);
  });

  test('large premium: $100 + $18.00 = $118.00', () => {
    expect(calculateTotalInsuranceCost(100)).toBe(118.00);
  });

  test('rounds total to 2 decimal places', () => {
    // $11.01 → fee = $1.98 → total = $12.99
    expect(calculateTotalInsuranceCost(11.01)).toBe(12.99);
    // $25.50 → fee = $4.59 → total = $30.09
    expect(calculateTotalInsuranceCost(25.50)).toBe(30.09);
  });

  test('various realistic amounts', () => {
    // $50 → fee = $9.00 → total = $59.00
    expect(calculateTotalInsuranceCost(50)).toBe(59);
    // $75 → fee = $13.50 → total = $88.50
    expect(calculateTotalInsuranceCost(75)).toBe(88.50);
    // $200 → fee = $36.00 → total = $236.00
    expect(calculateTotalInsuranceCost(200)).toBe(236);
  });
});

describe('Redkik Edge Function — isElectronicsItem', () => {
  test('detects electronics by keyword in name', () => {
    expect(isElectronicsItem({ name: 'Samsung TV 55"' })).toBe(true);
    expect(isElectronicsItem({ name: 'MacBook Pro 16' })).toBe(true);
    expect(isElectronicsItem({ name: 'iPhone 15 Pro Max' })).toBe(true);
    expect(isElectronicsItem({ name: 'PlayStation 5' })).toBe(true);
    expect(isElectronicsItem({ name: 'GoPro Hero 12' })).toBe(true);
    expect(isElectronicsItem({ name: 'Bose Headphones' })).toBe(true);
  });

  test('detects electronics by keyword in description', () => {
    expect(isElectronicsItem({ name: 'Gift', description: 'a new laptop for college' })).toBe(true);
    expect(isElectronicsItem({ name: 'Package', description: 'contains an ipad mini' })).toBe(true);
  });

  test('detects electronics by category', () => {
    expect(isElectronicsItem({ name: 'Item', category: 'electronics' })).toBe(true);
    expect(isElectronicsItem({ name: 'Item', category: 'gaming' })).toBe(true);
    expect(isElectronicsItem({ name: 'Item', category: 'smart home' })).toBe(true);
    expect(isElectronicsItem({ name: 'Item', category: 'photography' })).toBe(true);
  });

  test('does NOT flag non-electronics items', () => {
    expect(isElectronicsItem({ name: 'Dining Table' })).toBe(false);
    expect(isElectronicsItem({ name: 'Sofa' })).toBe(false);
    expect(isElectronicsItem({ name: 'Bookshelf' })).toBe(false);
    expect(isElectronicsItem({ name: 'Mattress' })).toBe(false);
    expect(isElectronicsItem({ name: 'Box of clothes' })).toBe(false);
  });

  test('avoids false positives on ambiguous words', () => {
    // These were problematic before the keyword fix
    expect(isElectronicsItem({ name: 'Phone case' })).toBe(false);
    expect(isElectronicsItem({ name: 'Light switch' })).toBe(false);
    expect(isElectronicsItem({ name: 'Console table' })).toBe(false);
    expect(isElectronicsItem({ name: 'Camera bag' })).toBe(false);
    expect(isElectronicsItem({ name: 'Bird nest decoration' })).toBe(false);
    expect(isElectronicsItem({ name: 'Bluetooth speaker stand' })).toBe(false);
    expect(isElectronicsItem({ name: 'Watch box' })).toBe(false);
  });

  test('handles empty / missing fields gracefully', () => {
    expect(isElectronicsItem({})).toBe(false);
    expect(isElectronicsItem({ name: '' })).toBe(false);
    expect(isElectronicsItem({ name: null, category: null })).toBe(false);
  });
});

describe('Redkik Edge Function — validateItemValues', () => {
  test('valid general merchandise items pass', () => {
    const result = validateItemValues([
      { name: 'Table', value: 500 },
      { name: 'Chair', value: 200 },
    ]);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test('valid electronics items pass', () => {
    const result = validateItemValues([
      { name: 'MacBook Pro', value: 2500 },
      { name: 'iPad Mini', value: 499 },
    ]);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test('general item over $8,000 fails', () => {
    const result = validateItemValues([
      { name: 'Antique desk', value: 9000 },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('exceeds maximum $8000');
    expect(result.errors[0]).toContain('general merchandise');
  });

  test('electronics item over $4,000 fails', () => {
    const result = validateItemValues([
      { name: 'MacBook Pro Max', value: 5000 },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('exceeds maximum $4000');
    expect(result.errors[0]).toContain('electronics');
  });

  test('boundary: general at exactly $8,000 passes', () => {
    const result = validateItemValues([{ name: 'Desk', value: 8000 }]);
    expect(result.valid).toBe(true);
  });

  test('boundary: electronics at exactly $4,000 passes', () => {
    const result = validateItemValues([{ name: 'Laptop', value: 4000 }]);
    expect(result.valid).toBe(true);
  });

  test('boundary: general at exactly $1 passes', () => {
    const result = validateItemValues([{ name: 'Keychain', value: 1 }]);
    expect(result.valid).toBe(true);
  });

  test('items with zero or missing value are skipped', () => {
    const result = validateItemValues([
      { name: 'No value' },
      { name: 'Zero', value: 0 },
    ]);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test('mixed items: valid general + invalid electronics', () => {
    const result = validateItemValues([
      { name: 'Sofa', value: 3000 },
      { name: 'Television', value: 5000 },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('Television');
  });

  test('multiple errors reported', () => {
    const result = validateItemValues([
      { name: 'Expensive desk', value: 10000 },
      { name: 'Expensive laptop', value: 6000 },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(2);
  });
});

describe('Redkik Edge Function — findCommodityId', () => {
  const setupWithBoth = {
    commodities: [
      { id: 'gen-123', name: 'General Merchandise' },
      { id: 'elec-456', name: 'Home Electronics' },
    ],
  };

  const setupGeneralOnly = {
    commodities: [
      { id: 'gen-123', name: 'General Merchandise' },
    ],
  };

  const setupEmpty = { commodities: [] };

  test('finds general commodity', () => {
    expect(findCommodityId(setupWithBoth, 'general')).toBe('gen-123');
  });

  test('finds electronics commodity', () => {
    expect(findCommodityId(setupWithBoth, 'electronics')).toBe('elec-456');
  });

  test('electronics falls back to general when no electronics commodity exists', () => {
    expect(findCommodityId(setupGeneralOnly, 'electronics')).toBe('gen-123');
  });

  test('falls back to first commodity when no name matches', () => {
    const setup = { commodities: [{ id: 'other-789', name: 'Other Stuff' }] };
    expect(findCommodityId(setup, 'general')).toBe('other-789');
  });

  test('returns hardcoded fallback when commodities array is empty', () => {
    expect(findCommodityId(setupEmpty, 'general')).toBe('ebe38cf9-df60-4f69-9210-a439981e6989');
  });
});

describe('Redkik Edge Function — findPolicyByAlias', () => {
  const setup = {
    policies: [
      { id: 'pol-1', alias: 'PU Test' },
      { id: 'pol-2', alias: 'PU Production' },
    ],
  };

  test('finds policy by alias (case-insensitive)', () => {
    expect(findPolicyByAlias(setup, 'PU Test')).toBe('pol-1');
    expect(findPolicyByAlias(setup, 'pu test')).toBe('pol-1');
    expect(findPolicyByAlias(setup, 'PU PRODUCTION')).toBe('pol-2');
  });

  test('returns null when no match', () => {
    expect(findPolicyByAlias(setup, 'NonExistent')).toBeNull();
  });

  test('returns null for empty policies', () => {
    expect(findPolicyByAlias({ policies: [] }, 'PU Test')).toBeNull();
  });
});

describe('Redkik Edge Function — amendments', () => {
  test('extractAmendments reads from amendments field', () => {
    const offer = { amendments: [{ type: 'warning', message: 'test' }] };
    expect(extractAmendments(offer)).toEqual([{ type: 'warning', message: 'test' }]);
  });

  test('extractAmendments reads from Amendments (capitalized)', () => {
    const offer = { Amendments: [{ type: 'error', message: 'blocked' }] };
    expect(extractAmendments(offer)).toEqual([{ type: 'error', message: 'blocked' }]);
  });

  test('extractAmendments returns empty array for missing field', () => {
    expect(extractAmendments({})).toEqual([]);
  });

  test('hasBlockingAmendments returns true when error type present', () => {
    expect(hasBlockingAmendments([{ type: 'error', message: 'bad' }])).toBe(true);
    expect(hasBlockingAmendments([{ type: 'Error', message: 'bad' }])).toBe(true);
  });

  test('hasBlockingAmendments returns false for warnings/info only', () => {
    expect(hasBlockingAmendments([{ type: 'warning' }, { type: 'info' }])).toBe(false);
  });

  test('hasBlockingAmendments returns false for empty array', () => {
    expect(hasBlockingAmendments([])).toBe(false);
  });
});

describe('Redkik Edge Function — multi-commodity duplicate protection', () => {
  test('when electronics and general resolve to same ID, items merge into one commodity', () => {
    const setup = {
      commodities: [{ id: 'gen-123', name: 'General Merchandise' }],
      defaultCurrencyId: 'USD',
      policies: [],
      customers: [],
    };

    const generalId = findCommodityId(setup, 'general');
    const electronicsId = findCommodityId(setup, 'electronics');
    const hasSeparate = electronicsId !== generalId;

    expect(hasSeparate).toBe(false);
    expect(generalId).toBe('gen-123');
    expect(electronicsId).toBe('gen-123');
  });

  test('when separate electronics commodity exists, IDs differ', () => {
    const setup = {
      commodities: [
        { id: 'gen-123', name: 'General Merchandise' },
        { id: 'elec-456', name: 'Home Electronics' },
      ],
      defaultCurrencyId: 'USD',
      policies: [],
      customers: [],
    };

    const generalId = findCommodityId(setup, 'general');
    const electronicsId = findCommodityId(setup, 'electronics');
    expect(generalId).not.toBe(electronicsId);
  });
});

describe('Redkik Edge Function — fee calculation with various realistic amounts', () => {
  const cases = [
    // [redkikPremium, expectedFee, expectedTotal, description]
    [11.00, 1.99, 12.99, 'minimum premium ($11)'],
    [5.00, 1.99, 6.99, 'below minimum ($5)'],
    [0, 1.99, 1.99, 'zero premium'],
    [10.99, 1.99, 12.98, 'just below minimum ($10.99)'],
    [11.01, 1.98, 12.99, 'just above minimum ($11.01)'],
    [15.00, 2.70, 17.70, '$15 premium'],
    [20.00, 3.60, 23.60, '$20 premium'],
    [25.00, 4.50, 29.50, '$25 premium'],
    [30.00, 5.40, 35.40, '$30 premium'],
    [50.00, 9.00, 59.00, '$50 premium'],
    [75.00, 13.50, 88.50, '$75 premium'],
    [100.00, 18.00, 118.00, '$100 premium'],
    [150.00, 27.00, 177.00, '$150 premium'],
    [200.00, 36.00, 236.00, '$200 premium'],
    [500.00, 90.00, 590.00, '$500 premium'],
    [12.50, 2.25, 14.75, '$12.50 premium'],
    [17.99, 3.24, 21.23, '$17.99 premium'],
    [99.99, 18.00, 117.99, '$99.99 premium'],
  ];

  test.each(cases)(
    'premium $%d → fee $%d, total $%d (%s)',
    (premium, expectedFee, expectedTotal) => {
      expect(calculateServiceFee(premium)).toBe(expectedFee);
      expect(calculateTotalInsuranceCost(premium)).toBe(expectedTotal);
    }
  );
});
