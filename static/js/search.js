document.addEventListener('DOMContentLoaded', function() {
    const searchForm = document.getElementById('searchForm');
    const themeCheckboxes = document.getElementById('themeCheckboxes');
    const characterCheckboxes = document.getElementById('characterCheckboxes');
    const environmentCheckboxes = document.getElementById('environmentCheckboxes');
    const resultsDiv = document.getElementById('searchResults');

    // Normalize and group similar terms
    function normalizeTerms(items) {
        const normalized = new Map();

        // Common variations to combine
        const variations = {
            'mom': ['mum', 'mommy', 'mummy', 'mother'],
            'dad': ['daddy', 'father', 'papa'],
            'grandma': ['grandmother', 'granny', 'nana'],
            'grandpa': ['grandfather', 'granddad', 'grandpapa'],
            'house': ['home', 'residence', 'dwelling'],
            'forest': ['woods', 'woodland', 'grove'],
            'school': ['classroom', 'schoolhouse', 'academy']
        };

        items.forEach(item => {
            if (!item) return; // Skip null/undefined items

            let normalizedTerm = item.toLowerCase().trim();
            if (!normalizedTerm) return; // Skip empty strings

            // Check if this term is a variation of another
            for (const [main, variants] of Object.entries(variations)) {
                if (variants.includes(normalizedTerm) || normalizedTerm === main) {
                    normalizedTerm = main;
                    break;
                }
            }

            if (!normalized.has(normalizedTerm)) {
                normalized.set(normalizedTerm, new Set());
            }
            normalized.get(normalizedTerm).add(item);
        });

        return normalized;
    }

    // Create hierarchical structure for environments
    function categorizeEnvironments(environments) {
        const categories = {
            'Indoor Locations': {
                items: ['house', 'school', 'library', 'museum', 'store', 'restaurant'],
                pattern: /(house|home|school|library|museum|store|shop|restaurant|building|room)/i
            },
            'Outdoor Nature': {
                items: ['forest', 'beach', 'mountain', 'park', 'garden', 'lake', 'river'],
                pattern: /(forest|beach|mountain|park|garden|lake|river|woods|field)/i
            },
            'Fantasy Realms': {
                items: ['castle', 'magical forest', 'enchanted garden', 'fairy kingdom'],
                pattern: /(castle|magical|enchanted|fairy|kingdom|realm)/i
            },
            'Urban Settings': {
                items: ['city', 'street', 'playground', 'neighborhood', 'mall'],
                pattern: /(city|street|playground|neighborhood|mall|urban|town)/i
            }
        };

        const categorized = {};
        for (const category in categories) {
            categorized[category] = new Set();
        }
        const other = new Set();

        environments.forEach(env => {
            let matched = false;
            for (const [category, info] of Object.entries(categories)) {
                if (info.pattern.test(env)) {
                    categorized[category].add(env);
                    matched = true;
                    break;
                }
            }
            if (!matched) {
                other.add(env);
            }
        });

        if (other.size > 0) {
            categorized['Other Locations'] = other;
        }

        return categorized;
    }

    // Create hierarchical structure for themes
    function categorizeThemes(themes) {
        const categories = {
            'Emotional Journey': {
                items: ['friendship', 'love', 'family', 'courage', 'hope'],
                pattern: /(friend|love|family|courage|hope|emotion|feel)/i
            },
            'Adventure & Discovery': {
                items: ['exploration', 'adventure', 'discovery', 'quest'],
                pattern: /(explore|adventure|discover|quest|journey)/i
            },
            'Life Lessons': {
                items: ['responsibility', 'growth', 'learning', 'change'],
                pattern: /(responsibility|grow|learn|change|lesson)/i
            },
            'Magic & Wonder': {
                items: ['magic', 'fantasy', 'imagination', 'dreams'],
                pattern: /(magic|fantasy|imagine|dream|wonder)/i
            }
        };

        const categorized = {};
        for (const category in categories) {
            categorized[category] = new Set();
        }
        const other = new Set();

        themes.forEach(theme => {
            let matched = false;
            for (const [category, info] of Object.entries(categories)) {
                if (info.pattern.test(theme)) {
                    categorized[category].add(theme);
                    matched = true;
                    break;
                }
            }
            if (!matched) {
                other.add(theme);
            }
        });

        if (other.size > 0) {
            categorized['Other Themes'] = other;
        }

        return categorized;
    }

    // Function to create checkboxes from categorized items
    function populateCategorizedCheckboxes(container, categories, type) {
        container.innerHTML = Object.entries(categories).map(([category, items]) => `
            <div class="card mb-3">
                <div class="card-header" role="button" data-bs-toggle="collapse" 
                     data-bs-target="#${type}-${category.replace(/\s+/g, '-').toLowerCase()}"
                     aria-expanded="false">
                    <div class="d-flex justify-content-between align-items-center">
                        <h6 class="mb-0">
                            ${category}
                            <i class="bi bi-chevron-down ms-2"></i>
                        </h6>
                        <span class="badge bg-secondary">${items.size}</span>
                    </div>
                </div>
                <div class="collapse show" id="${type}-${category.replace(/\s+/g, '-').toLowerCase()}">
                    <div class="card-body">
                        <div class="d-flex flex-wrap gap-2">
                            ${Array.from(items).sort().map(item => `
                                <div class="form-check form-check-inline">
                                    <input class="form-check-input" type="checkbox" 
                                           id="${type}_${item}" name="${type}" value="${item}">
                                    <label class="form-check-label" for="${type}_${item}">${item}</label>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    // Fetch and populate all available options
    async function loadSearchOptions() {
        try {
            const response = await fetch('/api/analyses');
            const analyses = await response.json();

            const themes = analyses.flatMap(a => a.themes || []);
            const characters = analyses.flatMap(a => a.characters_mentioned || []);
            const environments = analyses.flatMap(a => a.environments || []);

            // Create hierarchical structures
            const categorizedThemes = categorizeThemes(Array.from(new Set(themes)));
            const categorizedEnvironments = categorizeEnvironments(Array.from(new Set(environments)));

            // Populate the checkboxes with the categorized data
            populateCategorizedCheckboxes(themeCheckboxes, categorizedThemes, 'theme');
            populateCategorizedCheckboxes(environmentCheckboxes, categorizedEnvironments, 'environment');

            // For characters, we'll just use a simple list for now
            const charactersList = Array.from(new Set(characters)).sort();
            characterCheckboxes.innerHTML = `
                <div class="card">
                    <div class="card-body">
                        <div class="d-flex flex-wrap gap-2">
                            ${charactersList.map(char => `
                                <div class="form-check form-check-inline">
                                    <input class="form-check-input" type="checkbox" 
                                           id="character_${char}" name="character" value="${char}">
                                    <label class="form-check-label" for="character_${char}">${char}</label>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `;

            // Initialize tooltips
            const tooltips = document.querySelectorAll('[data-bs-toggle="tooltip"]');
            tooltips.forEach(tooltip => new bootstrap.Tooltip(tooltip));

        } catch (error) {
            console.error('Error loading search options:', error);
            alert('Error loading search options');
        }
    }

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
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(criteria)
            });

            if (!response.ok) {
                throw new Error('Search failed');
            }

            const results = await response.json();
            displaySearchResults(results);

        } catch (error) {
            console.error('Error:', error);
            resultsDiv.innerHTML = '<div class="alert alert-danger">Error performing search</div>';
        }
    });

    function displaySearchResults(results) {
        if (results.length === 0) {
            resultsDiv.innerHTML = '<div class="alert alert-info">No results found matching your criteria</div>';
            return;
        }

        resultsDiv.innerHTML = `
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
                        ${results.map(result => `
                            <tr>
                                <td>${result.title}</td>
                                <td>${result.format}</td>
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

    // Load search options when the page loads
    loadSearchOptions();
});