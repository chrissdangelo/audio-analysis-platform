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
            if (!env) return; // Skip null/undefined
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
            if (!theme) return; // Skip null/undefined
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

    // Function to generate bundle title
    function generateBundleTitle(type, commonality) {
        const titles = {
            theme: [
                `✨ Tales of ${commonality}: Where Magic Begins`,
                `🌟 The ${commonality} Chronicles: Untold Wonders`,
                `🎭 Once Upon a ${commonality}`,
                `💫 Whispers of ${commonality}`,
                `🌈 ${commonality}: A Tapestry of Tales`,
                `✨ Through the Lens of ${commonality}`
            ],
            character: [
                `🦸 ${commonality}'s Epic Adventures`,
                `⚔️ ${commonality}: Legend in the Making`,
                `🎭 The ${commonality} Saga: Heroes Rise`,
                `✨ ${commonality}'s Magical Moments`,
                `🌟 Legends of ${commonality}`,
                `💫 ${commonality}: Beyond the Story`
            ],
            environment: [
                `🏰 Secrets of the ${commonality}`,
                `🌌 ${commonality}: A World of Wonder`,
                `🌳 Hidden Tales of the ${commonality}`,
                `🌊 The Magic of ${commonality}`,
                `🗺️ Lost in the ${commonality}`,
                `✨ ${commonality}: Realm of Dreams`
            ]
        };

        const options = titles[type] || titles.theme;
        return options[Math.floor(Math.random() * options.length)];
    }

    // Function to generate elevator pitch
    function generateElevatorPitch(type, commonality, count, items) {
        const examples = items
            .slice(0, 3)
            .map(item => item.title || 'Untitled')
            .filter(title => title !== 'Untitled');

        const speakingCharacters = items
            .flatMap(item => item.speaking_characters || [])
            .filter(Boolean)
            .slice(0, 3);

        const relatedThemes = items
            .flatMap(item => item.themes || [])
            .filter(Boolean)
            .filter(theme => theme !== commonality)
            .slice(0, 2);

        const pitches = {
            theme: [
                `🎭 Step into a realm of wonder with ${count} enchanted tales that weave the magic of "${commonality}"! From the spellbinding "${examples[0]}"${examples[1] ? ` to the mesmerizing "${examples[1]}"` : ''}${relatedThemes.length ? `, where themes of ${relatedThemes.join(' and ')} dance together in perfect harmony` : ''}.`,
                `✨ Discover a treasure trove of ${count} magical stories that bring "${commonality}" to vivid life. Journey from the captivating "${examples[0]}"${examples[1] ? ` through the enchanted world of "${examples[1]}"` : ''}, where every tale is a doorway to adventure.`
            ],
            character: [
                `⚔️ Join the legendary ${commonality} on ${count} epic quests${speakingCharacters.length ? `, alongside beloved heroes ${speakingCharacters.join(', ')}` : ''}! Your adventure begins with the thrilling "${examples[0]}"${examples[1] ? ` and soars through "${examples[1]}"` : ''}.`,
                `🦸 Experience ${count} legendary tales where ${commonality} becomes a beacon of hope${speakingCharacters.length ? `. Stand with ${speakingCharacters.join(' and ')} as they` : ''}. The saga unfolds in "${examples[0]}"${examples[1] ? ` and reaches new heights in "${examples[1]}"` : ''}!`
            ],
            environment: [
                `🏰 Unlock the mysteries of the ${commonality} in ${count} breathtaking tales! Your journey begins with "${examples[0]}"${examples[1] ? ` and ventures deep into "${examples[1]}"` : ''}${relatedThemes.length ? `. Each step reveals ${relatedThemes.join(' and ')}` : ''}.`,
                `🌌 Step through the gateway to the enchanted ${commonality}, where ${count} remarkable stories await. From the wondrous "${examples[0]}"${examples[1] ? ` to the magical "${examples[1]}"` : ''}, each tale holds secrets yearning to be discovered.`
            ]
        };

        const options = pitches[type] || pitches.theme;
        return options[Math.floor(Math.random() * options.length)];
    }

    // Function to generate bundle preview
    function generateBundlePreview(results) {
        const commonThemes = findCommonalities(results, 'themes');
        const commonCharacters = findCommonalities(results, 'characters_mentioned');
        const commonEnvironments = findCommonalities(results, 'environments');

        // Select the most prominent commonality for the main pitch
        let mainType, mainCommonality;
        if (commonThemes.length > 0) {
            mainType = 'theme';
            mainCommonality = commonThemes[0].commonality;
        } else if (commonCharacters.length > 0) {
            mainType = 'character';
            mainCommonality = commonCharacters[0].commonality;
        } else if (commonEnvironments.length > 0) {
            mainType = 'environment';
            mainCommonality = commonEnvironments[0].commonality;
        } else {
            mainType = 'theme';
            mainCommonality = 'Adventure';
        }

        const title = generateBundleTitle(mainType, mainCommonality);
        const pitch = generateElevatorPitch(mainType, mainCommonality, results.length, results);

        return {
            title,
            pitch,
            results,
            type: mainType,
            commonality: mainCommonality
        };
    }

    // Function to find commonalities in results
    function findCommonalities(results, field) {
        const counts = {};
        results.forEach(result => {
            const items = result[field] || [];
            items.forEach(item => {
                counts[item] = (counts[item] || 0) + 1;
            });
        });

        return Object.entries(counts)
            .map(([commonality, count]) => ({ commonality, count }))
            .filter(item => item.count > 1)
            .sort((a, b) => b.count - a.count);
    }

    // Function to display bundle preview
    function displayBundlePreview(bundle) {
        currentBundle = bundle;
        bundlePreview.classList.remove('d-none');

        bundlePitch.innerHTML = `
            <div class="alert alert-info">
                <h4 class="alert-heading">${bundle.title}</h4>
                <p>${bundle.pitch}</p>
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

    // Function to save bundle
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

    // Function to delete bundle
    function deleteBundle(id) {
        const savedBundles = JSON.parse(localStorage.getItem('savedBundles') || '[]');
        const updatedBundles = savedBundles.filter(bundle => bundle.id !== id);
        localStorage.setItem('savedBundles', JSON.stringify(updatedBundles));
        displaySavedBundles();
    }

    // Function to display saved bundles
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

        // Add event listeners for view and delete buttons
        document.querySelectorAll('.view-bundle').forEach(btn => {
            btn.addEventListener('click', () => {
                const bundle = savedBundles.find(b => b.id === parseInt(btn.dataset.id));
                if (bundle) {
                    displayBundlePreview(bundle);
                }
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

    // Fetch and populate all available options
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

            // Create hierarchical structures
            const categorizedThemes = categorizeThemes(Array.from(new Set(themes)));
            const categorizedEnvironments = categorizeEnvironments(Array.from(new Set(environments)));

            // Populate the checkboxes with the categorized data
            populateCategorizedCheckboxes(themeCheckboxes, categorizedThemes, 'theme');
            populateCategorizedCheckboxes(environmentCheckboxes, categorizedEnvironments, 'environment');

            // For characters, we'll use a simple list for now
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

    // Event listeners
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

    // Load saved bundles when the page loads
    displaySavedBundles();

    // Load search options when the page loads
    loadSearchOptions();
});