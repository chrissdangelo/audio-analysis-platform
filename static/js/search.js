document.addEventListener('DOMContentLoaded', function() {
    const bundleCreatorForm = document.getElementById('bundleCreatorForm');
    const themeCheckboxes = document.getElementById('themeCheckboxes');
    const characterCheckboxes = document.getElementById('characterCheckboxes');
    const environmentCheckboxes = document.getElementById('environmentCheckboxes');
    const resultsDiv = document.getElementById('searchResults');
    const createBundleBtn = document.getElementById('createBundleBtn');
    const bundlePreview = document.getElementById('bundlePreview');
    const bundleContent = document.getElementById('bundleContent');

    // Function to normalize character names
    function normalizeCharacterName(name) {
        const normalizations = {
            'mom': ['mum', 'mummy', 'mother'],
            'dad': ['father', 'daddy', 'papa'],
            'grandma': ['grandmother', 'granny', 'nana'],
            'grandpa': ['grandfather', 'granddad', 'grandpapa'],
            'cat': ['kitty', 'kitten'],
            'dog': ['puppy', 'pup']
        };

        name = name.toLowerCase().trim();
        for (const [primary, variations] of Object.entries(normalizations)) {
            if (variations.includes(name) || name === primary) {
                return primary;
            }
        }
        return name;
    }

    // Function to group similar character names
    function groupCharacterNames(characters) {
        const groupedChars = new Map();
        characters.forEach(char => {
            const normalized = normalizeCharacterName(char);
            if (!groupedChars.has(normalized)) {
                groupedChars.set(normalized, [char]);
            } else {
                groupedChars.get(normalized).push(char);
            }
        });
        return Array.from(groupedChars.entries()).map(([normalized, variants]) => ({
            normalized,
            variants,
            displayName: variants[0] // Use the first variant as display name
        }));
    }

    // Function to create checkboxes from unique values
    function populateCheckboxes(container, items, type) {
        if (type === 'character') {
            const groupedItems = groupCharacterNames(items);
            const html = groupedItems.map(group => `
                <div class="form-check form-check-inline">
                    <input class="form-check-input" type="checkbox" 
                           id="${type}_${group.normalized}" 
                           name="${type}" 
                           value="${group.normalized}"
                           data-variants='${JSON.stringify(group.variants)}'>
                    <label class="form-check-label" for="${type}_${group.normalized}">
                        ${group.displayName}
                        ${group.variants.length > 1 ? 
                            `<i class="bi bi-info-circle" data-bs-toggle="tooltip" 
                                title="Includes: ${group.variants.join(', ')}"></i>` 
                            : ''}
                    </label>
                </div>
            `).join('');
            container.innerHTML = html;

            // Initialize tooltips
            const tooltips = container.querySelectorAll('[data-bs-toggle="tooltip"]');
            tooltips.forEach(tooltip => new bootstrap.Tooltip(tooltip));
        } else {
            const uniqueItems = [...new Set(items)].sort();
            container.innerHTML = uniqueItems.map(item => `
                <div class="form-check form-check-inline">
                    <input class="form-check-input" type="checkbox" 
                           id="${type}_${item}" 
                           name="${type}" 
                           value="${item}">
                    <label class="form-check-label" for="${type}_${item}">${item}</label>
                </div>
            `).join('');
        }
    }

    // Fetch and populate all available options
    async function loadSearchOptions() {
        try {
            const response = await fetch('/api/analyses');
            const analyses = await response.json();

            const themes = analyses.flatMap(a => a.themes || []);
            const characters = analyses.flatMap(a => a.characters_mentioned || []);
            const environments = analyses.flatMap(a => a.environments || []);

            populateCheckboxes(themeCheckboxes, themes, 'theme');
            populateCheckboxes(characterCheckboxes, characters, 'character');
            populateCheckboxes(environmentCheckboxes, environments, 'environment');

        } catch (error) {
            console.error('Error loading search options:', error);
            alert('Error loading search options');
        }
    }

    let currentSearchResults = [];

    bundleCreatorForm.addEventListener('submit', async function(e) {
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

            currentSearchResults = await response.json();
            displaySearchResults(currentSearchResults);
            createBundleBtn.disabled = currentSearchResults.length === 0;

        } catch (error) {
            console.error('Error:', error);
            resultsDiv.innerHTML = '<div class="alert alert-danger">Error performing search</div>';
            createBundleBtn.disabled = true;
        }
    });

    createBundleBtn.addEventListener('click', function() {
        if (currentSearchResults.length === 0) return;

        const criteria = {
            themes: Array.from(document.querySelectorAll('input[name="theme"]:checked')).map(cb => cb.value),
            characters: Array.from(document.querySelectorAll('input[name="character"]:checked')).map(cb => cb.value),
            environments: Array.from(document.querySelectorAll('input[name="environment"]:checked')).map(cb => cb.value)
        };

        // Generate bundle title and description
        const bundleType = criteria.characters.length ? 'character' : 
                          criteria.themes.length ? 'theme' : 'environment';
        const commonality = criteria.characters[0] || criteria.themes[0] || criteria.environments[0];

        const titles = {
            theme: [
                `✨ Tales of ${commonality}: Where Magic Begins`,
                `🌟 The ${commonality} Chronicles: Untold Wonders`,
                `🎭 Once Upon a ${commonality}`
            ],
            character: [
                `🦸 ${commonality}'s Epic Adventures`,
                `⚔️ ${commonality}: Legend in the Making`,
                `🎭 The ${commonality} Saga: Heroes Rise`
            ],
            environment: [
                `🏰 Secrets of the ${commonality}`,
                `🌌 ${commonality}: A World of Wonder`,
                `🌳 Hidden Tales of the ${commonality}`
            ]
        };

        const bundleTitle = titles[bundleType][Math.floor(Math.random() * titles[bundleType].length)];

        // Generate marketing pitch
        const examples = currentSearchResults
            .slice(0, 3)
            .map(item => item.title || 'Untitled')
            .filter(title => title !== 'Untitled');

        const pitches = [
            `🎭 Step into a realm of wonder with ${currentSearchResults.length} enchanted tales that weave the magic of "${commonality}"! Starting with "${examples[0]}"${examples[1] ? ` and "${examples[1]}"` : ''}, each story opens a new door to adventure.`,
            `✨ Discover a treasure trove of ${currentSearchResults.length} magical stories featuring "${commonality}". Journey from "${examples[0]}"${examples[1] ? ` through "${examples[1]}"` : ''}, where every tale is a new discovery.`,
            `🌟 Embark on an extraordinary voyage through ${currentSearchResults.length} handpicked gems exploring "${commonality}". Let "${examples[0]}"${examples[1] ? ` and "${examples[1]}"` : ''} transport you to worlds beyond imagination.`
        ];

        const marketingPitch = pitches[Math.floor(Math.random() * pitches.length)];

        // Display bundle preview
        bundleContent.innerHTML = `
            <h3 class="mb-3">${bundleTitle}</h3>
            <p class="lead mb-4">${marketingPitch}</p>
            <div class="table-responsive">
                <table class="table table-striped">
                    <thead>
                        <tr>
                            <th>Title</th>
                            <th>Format</th>
                            <th>Characters</th>
                            <th>Themes</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${currentSearchResults.map(result => `
                            <tr>
                                <td>${result.title}</td>
                                <td>${result.format}</td>
                                <td>${(result.characters_mentioned || []).join(', ') || '-'}</td>
                                <td>${(result.themes || []).join(', ') || '-'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        bundlePreview.classList.remove('d-none');
        bundlePreview.scrollIntoView({ behavior: 'smooth' });
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