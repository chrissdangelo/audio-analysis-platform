document.addEventListener('DOMContentLoaded', function() {
    const searchForm = document.getElementById('searchForm');
    const themeCheckboxes = document.getElementById('themeCheckboxes');
    const characterCheckboxes = document.getElementById('characterCheckboxes');
    const environmentCheckboxes = document.getElementById('environmentCheckboxes');
    const resultsDiv = document.getElementById('searchResults');

    // Normalize and group similar terms
    function normalizeTerms(items) {
        const normalized = new Map();

        // Common variations to combine (all in lowercase)
        const variations = {
            'mom': ['mum', 'mommy', 'mummy', 'mother'],
            'dad': ['daddy', 'father', 'papa'],
            'grandma': ['grandmother', 'granny', 'nana'],
            'grandpa': ['grandfather', 'granddad', 'grandpapa'],
            'house': ['home', 'residence', 'dwelling'],
            'forest': ['woods', 'woodland', 'grove'],
            'school': ['classroom', 'schoolhouse', 'academy'],
            'garage': ['carport', 'car garage'],
            'garden': ['backyard garden', 'vegetable garden'],
            'kitchen': ['kitchenette', 'cooking area'],
            'bedroom': ['bed room', 'sleeping room'],
            'living room': ['livingroom', 'sitting room', 'family room'],
            'bathroom': ['bath', 'restroom', 'washroom']
        };

        // Create a Set to track processed terms
        const processedTerms = new Set();

        items.forEach(item => {
            if (!item) return; // Skip null/undefined items

            let normalizedTerm = item.toLowerCase().trim();
            if (!normalizedTerm || processedTerms.has(normalizedTerm)) return; // Skip empty strings and duplicates
            
            processedTerms.add(normalizedTerm);

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
            'Home Settings': {
                items: ['house', 'home', 'bedroom', 'kitchen', 'backyard', 'garage'],
                pattern: /(house|home|bedroom|kitchen|backyard|garage|living room|basement)/i
            },
            'Educational': {
                items: ['school', 'library', 'classroom', 'museum', 'laboratory'],
                pattern: /(school|library|classroom|museum|lab|university|campus)/i
            },
            'Commercial': {
                items: ['store', 'restaurant', 'mall', 'shop', 'market', 'cafe'],
                pattern: /(store|restaurant|mall|shop|market|cafe|cinema|theater)/i
            },
            'Natural Land': {
                items: ['forest', 'mountain', 'park', 'garden', 'field', 'cave'],
                pattern: /(forest|mountain|park|garden|field|cave|hill|valley)/i
            },
            'Water Bodies': {
                items: ['beach', 'lake', 'river', 'ocean', 'pond', 'waterfall'],
                pattern: /(beach|lake|river|ocean|pond|waterfall|stream|sea)/i
            },
            'Urban Outdoor': {
                items: ['street', 'playground', 'neighborhood', 'park', 'sidewalk'],
                pattern: /(street|playground|neighborhood|sidewalk|parking|road|avenue)/i
            },
            'Fantasy & Magical': {
                items: ['castle', 'magical forest', 'enchanted garden', 'fairy kingdom'],
                pattern: /(castle|magical|enchanted|fairy|kingdom|realm|mystical)/i
            },
            'Holidays & Celebrations': {
                items: ['christmas', 'birthday', 'halloween', 'thanksgiving', 'wedding', 'festival'],
                pattern: /(christmas|birthday|halloween|thanksgiving|wedding|festival|holiday|celebration|party)/i
            }
        };

        const categorizedItems = {};
        for (const category in categories) {
            categorizedItems[category] = new Set();
        }
        const other = new Set();

        environments.forEach(env => {
            if (!env) return; // Skip null/undefined values

            let matched = false;
            for (const [category, info] of Object.entries(categories)) {
                if (info.pattern.test(env)) {
                    categorizedItems[category].add(env);
                    matched = true;
                    break;
                }
            }
            if (!matched) {
                other.add(env);
            }
        });

        if (other.size > 0) {
            categorizedItems['Other Locations'] = other;
        }

        return categorizedItems;
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

        const categorizedItems = {};
        for (const category in categories) {
            categorizedItems[category] = new Set();
        }
        const other = new Set();

        themes.forEach(theme => {
            if (!theme) return; // Skip null/undefined values

            let matched = false;
            for (const [category, info] of Object.entries(categories)) {
                if (info.pattern.test(theme)) {
                    categorizedItems[category].add(theme);
                    matched = true;
                    break;
                }
            }
            if (!matched) {
                other.add(theme);
            }
        });

        if (other.size > 0) {
            categorizedItems['Other Themes'] = other;
        }

        return categorizedItems;
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
            if (!response.ok) {
                throw new Error('Failed to fetch analyses');
            }

            const analyses = await response.json();
            if (!Array.isArray(analyses)) {
                throw new Error('Expected analyses to be an array');
            }

            const themes = analyses.flatMap(a => a.themes || []);
            const characters = analyses.flatMap(a => a.characters_mentioned || []);
            const environments = analyses.flatMap(a => a.environments || []);

            // Create hierarchical structures
            const categorizedThemes = categorizeThemes(themes);
            const categorizedEnvironments = categorizeEnvironments(environments);

            // Populate the checkboxes with the categorized data
            populateCategorizedCheckboxes(themeCheckboxes, categorizedThemes, 'theme');
            populateCategorizedCheckboxes(environmentCheckboxes, categorizedEnvironments, 'environment');

            // Create a single category for characters
            const characterCategories = {
                'Characters': new Set(characters)
            };

            // Use the same categorized checkbox format for characters
            populateCategorizedCheckboxes(characterCheckboxes, characterCategories, 'character');

            // Initialize tooltips
            const tooltips = document.querySelectorAll('[data-bs-toggle="tooltip"]');
            tooltips.forEach(tooltip => new bootstrap.Tooltip(tooltip));

        } catch (error) {
            console.error('Error loading search options:', error);
            const errorMessage = error.message || 'Error loading search options';
            resultsDiv.innerHTML = `<div class="alert alert-danger">${errorMessage}</div>`;
        }
    }

    // Handle form submission
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
        if (!Array.isArray(results)) {
            resultsDiv.innerHTML = '<div class="alert alert-danger">Invalid search results format</div>';
            return;
        }

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

    // Load search options when the page loads
    loadSearchOptions();
});