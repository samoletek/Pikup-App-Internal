const normalizeItemText = (value) => (value || '').trim().toLowerCase();

export const buildItemsFingerprint = (items = []) => {
    const normalized = (items || []).map(item => ({
        name: normalizeItemText(item.name),
        description: normalizeItemText(item.description),
        condition: normalizeItemText(item.condition || 'used'),
        fragile: !!item.isFragile,
        insured: !!item.hasInsurance,
        weight: Number(item.weightEstimate) || 0,
    })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));

    return JSON.stringify(normalized);
};

export const buildItemsSummary = (items = []) => {
    const grouped = new Map();
    let totalWeight = 0;

    (items || []).forEach(item => {
        const name = (item.name || 'Unnamed item').trim();
        const description = (item.description || '').trim();
        const condition = (item.condition || 'used').trim();
        const fragile = !!item.isFragile;
        const insured = !!item.hasInsurance;
        const weight = Number(item.weightEstimate) || 0;
        totalWeight += weight;

        const key = `${name}|${description}|${condition}|${fragile}|${insured}`;
        if (!grouped.has(key)) {
            grouped.set(key, {
                name,
                description,
                condition,
                fragile,
                insured,
                count: 0,
                weight: 0,
            });
        }

        const entry = grouped.get(key);
        entry.count += 1;
        entry.weight += weight;
    });

    const lines = Array.from(grouped.values()).map((entry, index) => {
        const attributes = [
            `${entry.count}x`,
            entry.name,
            `condition: ${entry.condition}`,
            `fragile: ${entry.fragile ? 'yes' : 'no'}`,
            `insured: ${entry.insured ? 'yes' : 'no'}`,
            `est weight total: ${entry.weight} lbs`,
        ];

        if (entry.description) {
            attributes.push(`description: ${entry.description}`);
        }

        return `${index + 1}. ${attributes.join('; ')}`;
    });

    return [
        `Total distinct lines: ${grouped.size}`,
        `Total items count: ${items.length}`,
        `Estimated total weight: ${totalWeight} lbs`,
        'Items:',
        ...lines,
    ].join('\n');
};
