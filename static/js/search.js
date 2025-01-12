document.addEventListener('DOMContentLoaded', function() {
    const searchForm = document.getElementById('searchForm');
    const themeCheckboxes = document.getElementById('themeCheckboxes');
    const characterCheckboxes = document.getElementById('characterCheckboxes');
    const environmentCheckboxes = document.getElementById('environmentCheckboxes');
    const bundlePreview = document.getElementById('bundlePreview');
    const bundlePitch = document.getElementById('bundlePitch');
    const bundleContent = document.getElementById('bundleContent');
    const reprocessBtn = document.getElementById('reprocessBtn');
    const saveBtn = document.getElementById('saveBtn');
    const savedBundlesTable = document.getElementById('savedBundlesTable').getElementsByTagName('tbody')[0];

    // Keep track of current bundle
    let currentBundle = null;

    // Create hierarchical structure for themes
    function categorizeThemes(themes) {
        const categories = {
            'Emotional Journey': /(friend|love|family|courage|hope|emotion|feel)/i,
            'Adventure & Discovery': /(explore|adventure|discover|quest|journey)/i,
            'Life Lessons': /(responsibility|grow|learn|change|lesson)/i,
            'Magic & Wonder': /(magic|fantasy|imagine|dream|wonder)/i
        };
        return categorizeItems(themes, categories, 'Other Themes');
    }

    // Create hierarchical structure for environments
    function categorizeEnvironments(environments) {
        const categories = {
            'Indoor Locations': /(house|home|school|library|museum|store|shop|restaurant|building|room)/i,
            'Outdoor Nature': /(forest|beach|mountain|park|garden|lake|river|woods|field)/i,
            'Fantasy Realms': /(castle|magical|enchanted|fairy|kingdom|realm)/i,
            'Urban Settings': /(city|street|playground|neighborhood|mall|urban|town)/i
        };
        return categorizeItems(environments, categories, 'Other Locations');
    }

    // Generic function to categorize items
    function categorizeItems(items, categories, otherCategory) {
        const categorized = {};
        Object.keys(categories).forEach(category => {
            categorized[category] = new Set();
        });
        const other = new Set();

        items.forEach(item => {
            if (!item) return;
            let matched = false;
            for (const [category, pattern] of Object.entries(categories)) {
                if (pattern.test(item)) {
                    categorized[category].add(item);
                    matched = true;
                    break;
                }
            }
            if (!matched) {
                other.add(item);
            }
        });

        if (other.size > 0) {
            categorized[otherCategory] = other;
        }

        return categorized;
    }

    // Function to create checkboxes from categorized items
    function createCategoryGroup(category, items, type) {
        const categoryId = `${type}-${category.replace(/\s+/g, '-').toLowerCase()}`;
        return `
            <div class="mb-3">
                <h6 class="mb-2 d-flex justify-content-between align-items-center" 
                    data-bs-toggle="collapse" 
                    data-bs-target="#${categoryId}" 
                    style="cursor: pointer;">
                    ${category}
                    <span class="badge bg-secondary">${items.size}</span>
                </h6>
                <div class="collapse show" id="${categoryId}">
                    <div class="d-flex flex-wrap gap-2">
                        ${Array.from(items).sort().map(item => `
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" 
                                       id="${type}_${item}" name="${type}" value="${item}">
                                <label class="form-check-label" for="${type}_${item}">
                                    ${item}
                                </label>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    // Function to populate categorized checkboxes
    function populateCategorizedCheckboxes(container, categories, type) {
        container.innerHTML = Object.entries(categories)
            .map(([category, items]) => createCategoryGroup(category, items, type))
            .join('');
    }

    // Generate bundle preview
    function generateBundlePreview(results) {
        const findCommonalities = (field) => {
            const counts = {};
            results.forEach(result => {
                (result[field] || []).forEach(item => {
                    counts[item] = (counts[item] || 0) + 1;
                });
            });
            return Object.entries(counts)
                .map(([item, count]) => ({ item, count }))
                .filter(x => x.count > 1)
                .sort((a, b) => b.count - a.count);
        };

        const commonThemes = findCommonalities('themes');
        const commonCharacters = findCommonalities('characters_mentioned');
        const commonEnvironments = findCommonalities('environments');

        let type = 'theme';
        let commonality = 'Adventure';

        if (commonThemes.length > 0) {
            type = 'theme';
            commonality = commonThemes[0].item;
        } else if (commonCharacters.length > 0) {
            type = 'character';
            commonality = commonCharacters[0].item;
        } else if (commonEnvironments.length > 0) {
            type = 'environment';
            commonality = commonEnvironments[0].item;
        }

        const title = generateTitle(type, commonality);
        const pitch = generatePitch(type, commonality, results.length, results);

        return { title, pitch, results, type, commonality };
    }

    function generateTitle(type, commonality) {
        const titles = {
            theme: [
                `✨ Tales of ${commonality}: Where Magic Begins`,
                `🌟 The ${commonality} Chronicles: Untold Wonders`
            ],
            character: [
                `🦸 ${commonality}'s Epic Adventures`,
                `⚔️ ${commonality}: Legend in the Making`
            ],
            environment: [
                `🏰 Secrets of the ${commonality}`,
                `🌌 ${commonality}: A World of Wonder`
            ]
        };

        const options = titles[type] || titles.theme;
        return options[Math.floor(Math.random() * options.length)];
    }

    function generatePitch(type, commonality, count, items) {
        const examples = items.slice(0, 2).map(item => item.title || 'Untitled');
        const relatedThemes = items
            .flatMap(item => item.themes || [])
            .filter(theme => theme !== commonality)
            .slice(0, 2);

        const pitches = {
            theme: `✨ Discover ${count} magical stories celebrating "${commonality}"! From "${examples[0]}" to "${examples[1]}"${relatedThemes.length ? `, exploring themes of ${relatedThemes.join(' and ')}` : ''}.`,
            character: `🦸 Join ${commonality} through ${count} epic adventures! Starting with "${examples[0]}" and continuing through "${examples[1]}".`,
            environment: `🏰 Explore the wonders of ${commonality} across ${count} unique tales! Begin with "${examples[0]}" and journey through "${examples[1]}".`
        };

        return pitches[type] || pitches.theme;
    }

    function displayBundlePreview(bundle) {
        currentBundle = bundle;
        bundlePreview.classList.remove('d-none');

        bundlePitch.innerHTML = `
            <div class="alert alert-info">
                <h4 class="alert-heading">${bundle.title}</h4>
                <p class="mb-0">${bundle.pitch}</p>
            </div>
        `;

        bundleContent.innerHTML = `
            <div class="table-responsive">
                <table class="table table-striped">
                    <thead>
                        <tr>
                            <th>Title</th>
                            <th>Format</th>
                            <th>Characters</th>
                            <th>Themes</th>
                            <th>Environments</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${bundle.results.map(result => `
                            <tr>
                                <td>${result.title || 'Untitled'}</td>
                                <td>${result.format || '-'}</td>
                                <td>${(result.characters_mentioned || []).join(', ') || '-'}</td>
                                <td>${(result.themes || []).join(', ') || '-'}</td>
                                <td>${(result.environments || []).join(', ') || '-'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    // Save and manage bundles
    function saveBundle(bundle) {
        const savedBundles = JSON.parse(localStorage.getItem('savedBundles') || '[]');
        const newBundle = {
            ...bundle,
            id: Date.now(),
            dateCreated: new Date().toISOString()
        };
        savedBundles.unshift(newBundle);
        localStorage.setItem('savedBundles', JSON.stringify(savedBundles));
        displaySavedBundles();
    }

    function deleteBundle(id) {
        const savedBundles = JSON.parse(localStorage.getItem('savedBundles') || '[]');
        const updatedBundles = savedBundles.filter(bundle => bundle.id !== id);
        localStorage.setItem('savedBundles', JSON.stringify(updatedBundles));
        displaySavedBundles();
    }

    function displaySavedBundles() {
        const savedBundles = JSON.parse(localStorage.getItem('savedBundles') || '[]');
        savedBundlesTable.innerHTML = savedBundles.map(bundle => `
            <tr>
                <td>${new Date(bundle.dateCreated).toLocaleString()}</td>
                <td>${bundle.title}</td>
                <td>${bundle.results.length} items</td>
                <td>
                    <button class="btn btn-sm btn-info me-2 view-bundle" data-id="${bundle.id}">View</button>
                    <button class="btn btn-sm btn-danger delete-bundle" data-id="${bundle.id}">Delete</button>
                </td>
            </tr>
        `).join('');

        // Add event listeners
        document.querySelectorAll('.view-bundle').forEach(btn => {
            btn.addEventListener('click', () => {
                const bundle = savedBundles.find(b => b.id === parseInt(btn.dataset.id));
                if (bundle) displayBundlePreview(bundle);
            });
        });

        document.querySelectorAll('.delete-bundle').forEach(btn => {
            btn.addEventListener('click', () => {
                if (confirm('Are you sure you want to delete this bundle?')) {
                    deleteBundle(parseInt(btn.dataset.id));
                }
            });
        });
    }

    // Initialize the interface
    async function loadSearchOptions() {
        try {
            const response = await fetch('/api/analyses');
            const analyses = await response.json();

            if (!Array.isArray(analyses)) {
                throw new Error('Expected analyses to be an array');
            }

            const themes = analyses.flatMap(a => a.themes || []);
            const characters = analyses.flatMap(a => a.characters_mentioned || []);
            const environments = analyses.flatMap(a => a.environments || []);

            const uniqueThemes = Array.from(new Set(themes));
            const uniqueCharacters = Array.from(new Set(characters));
            const uniqueEnvironments = Array.from(new Set(environments));

            populateCategorizedCheckboxes(themeCheckboxes, categorizeThemes(uniqueThemes), 'theme');
            populateCategorizedCheckboxes(environmentCheckboxes, categorizeEnvironments(uniqueEnvironments), 'environment');

            // For characters, use a simple list view
            characterCheckboxes.innerHTML = `
                <div class="d-flex flex-wrap gap-2">
                    ${uniqueCharacters.sort().map(char => `
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" 
                                   id="character_${char}" name="character" value="${char}">
                            <label class="form-check-label" for="character_${char}">
                                ${char}
                            </label>
                        </div>
                    `).join('')}
                </div>
            `;
        } catch (error) {
            console.error('Error loading search options:', error);
            alert('Error loading search options');
        }
    }

    // Event handlers
    searchForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        const criteria = {
            themes: Array.from(document.querySelectorAll('input[name="theme"]:checked')).map(cb => cb.value),
            characters: Array.from(document.querySelectorAll('input[name="character"]:checked')).map(cb => cb.value),
            environments: Array.from(document.querySelectorAll('input[name="environment"]:checked')).map(cb => cb.value)
        };

        if (!criteria.themes.length && !criteria.characters.length && !criteria.environments.length) {
            alert('Please select at least one search criteria');
            return;
        }

        try {
            const response = await fetch('/api/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(criteria)
            });

            if (!response.ok) {
                throw new Error('Search failed');
            }

            const results = await response.json();
            if (results.length === 0) {
                alert('No results found matching your criteria');
                return;
            }

            const bundle = generateBundlePreview(results);
            displayBundlePreview(bundle);

        } catch (error) {
            console.error('Error:', error);
            alert('Error performing search');
        }
    });

    reprocessBtn.addEventListener('click', function() {
        if (currentBundle) {
            const bundle = generateBundlePreview(currentBundle.results);
            displayBundlePreview(bundle);
        }
    });

    saveBtn.addEventListener('click', function() {
        if (currentBundle) {
            saveBundle(currentBundle);
            alert('Bundle saved successfully!');
        }
    });

    // Initialize
    loadSearchOptions();
    displaySavedBundles();
});