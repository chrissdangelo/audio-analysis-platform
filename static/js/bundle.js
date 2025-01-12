document.addEventListener('DOMContentLoaded', function() {
    const bundleSuggestions = document.getElementById('bundleSuggestions');

    async function findBundleOpportunities() {
        try {
            const response = await fetch('/api/analyses');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const analyses = await response.json();

            if (!Array.isArray(analyses)) {
                throw new Error('Expected analyses to be an array');
            }

            if (analyses.length === 0) {
                bundleSuggestions.innerHTML = '<div class="col-12"><div class="alert alert-info">No content available for bundle analysis</div></div>';
                return;
            }

            // Group by themes
            const themeGroups = groupByCommonality(analyses, 'themes');

            // Group by characters
            const characterGroups = groupByCommonality(analyses, 'characters_mentioned');

            // Group by environments
            const environmentGroups = groupByCommonality(analyses, 'environments');

            displayBundleSuggestions(themeGroups, characterGroups, environmentGroups);

        } catch (error) {
            console.error('Error finding bundle opportunities:', error);
            bundleSuggestions.innerHTML = `
                <div class="col-12">
                    <div class="alert alert-danger">
                        <h5 class="alert-heading">Error analyzing bundle opportunities</h5>
                        <p>${error.message}</p>
                    </div>
                </div>`;
        }
    }

    function groupByCommonality(analyses, field) {
        try {
            const groups = new Map();

            analyses.forEach(analysis => {
                // Handle potential null/undefined values
                let items = analysis[field] || [];

                // Ensure items is an array
                if (!Array.isArray(items)) {
                    console.warn(`${field} is not an array:`, items);
                    items = [items].filter(Boolean);
                }

                items.forEach(item => {
                    if (!item) return; // Skip null/undefined items
                    const key = item.toString().trim();
                    if (!key) return; // Skip empty strings

                    if (!groups.has(key)) {
                        groups.set(key, []);
                    }
                    groups.get(key).push(analysis);
                });
            });

            // Filter groups to only include those with multiple items
            return Array.from(groups.entries())
                .filter(([_, items]) => items.length > 1)
                .map(([key, items]) => ({
                    commonality: key,
                    items: items,
                    count: items.length
                }))
                .sort((a, b) => b.count - a.count);

        } catch (error) {
            console.error('Error in groupByCommonality:', error);
            return [];
        }
    }

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
        const index = Math.floor(Math.random() * options.length);
        return options[index];
    }

    function generateElevatorPitch(type, commonality, count, items) {
        // Extract some example titles or names to make the pitch more specific
        const examples = items
            .slice(0, 3)
            .map(item => item.title || 'Untitled')
            .filter(title => title !== 'Untitled');

        // Get example characters if available
        const speakingCharacters = items
            .flatMap(item => item.speaking_characters || [])
            .filter(Boolean)
            .slice(0, 3);

        // Get example themes if available
        const relatedThemes = items
            .flatMap(item => item.themes || [])
            .filter(Boolean)
            .filter(theme => theme !== commonality)
            .slice(0, 2);

        const pitches = {
            theme: [
                `🎭 Step into a realm of wonder with ${count} enchanted tales that weave the magic of "${commonality}"! From the spellbinding "${examples[0]}"${examples[1] ? ` to the mesmerizing "${examples[1]}"` : ''}${relatedThemes.length ? `, where themes of ${relatedThemes.join(' and ')} dance together in perfect harmony` : ''}.`,
                `✨ Discover a treasure trove of ${count} magical stories that bring "${commonality}" to vivid life. Journey from the captivating "${examples[0]}"${examples[1] ? ` through the enchanted world of "${examples[1]}"` : ''}, where every tale is a doorway to adventure.`,
                `🌟 Embark on an extraordinary voyage through ${count} handpicked gems exploring "${commonality}". Let "${examples[0]}"${examples[1] ? ` and "${examples[1]}"` : ''} transport you to worlds beyond imagination${relatedThemes.length ? `, where ${relatedThemes.join(' and ')} weave their own special magic` : ''}.`
            ],
            character: [
                `⚔️ Join the legendary ${commonality} on ${count} epic quests${speakingCharacters.length ? `, alongside beloved heroes ${speakingCharacters.join(', ')}` : ''}! Your adventure begins with the thrilling "${examples[0]}"${examples[1] ? ` and soars through "${examples[1]}"` : ''}.`,
                `🦸 Experience ${count} legendary tales where ${commonality} becomes a beacon of hope${speakingCharacters.length ? `. Stand with ${speakingCharacters.join(' and ')} as they` : ''}. The saga unfolds in "${examples[0]}"${examples[1] ? ` and reaches new heights in "${examples[1]}"` : ''}!`,
                `🎭 Witness the extraordinary journey of ${commonality} through ${count} spellbinding adventures${speakingCharacters.length ? `. Join forces with ${speakingCharacters.join(', ')}` : ''} as you dive into "${examples[0]}"${examples[1] ? ` and uncover the mysteries of "${examples[1]}"` : ''}.`
            ],
            environment: [
                `🏰 Unlock the mysteries of the ${commonality} in ${count} breathtaking tales! Your journey begins with "${examples[0]}"${examples[1] ? ` and ventures deep into "${examples[1]}"` : ''}${relatedThemes.length ? `. Each step reveals ${relatedThemes.join(' and ')}` : ''}.`,
                `🌌 Step through the gateway to the enchanted ${commonality}, where ${count} remarkable stories await. From the wondrous "${examples[0]}"${examples[1] ? ` to the magical "${examples[1]}"` : ''}, each tale holds secrets yearning to be discovered.`,
                `🗺️ Chart a course through the mystical ${commonality} with ${count} unforgettable adventures! "${examples[0]}"${examples[1] ? ` and "${examples[1]}"` : ''} will be your guides${relatedThemes.length ? ` as you explore themes of ${relatedThemes.join(' and ')}` : ''}.`
            ]
        };

        const options = pitches[type] || pitches.theme;
        const index = Math.floor(Math.random() * options.length);
        return options[index];
    }

    function displayBundleSuggestions(themeGroups, characterGroups, environmentGroups) {
        let html = '';

        // Theme-based bundles
        if (themeGroups.length > 0) {
            html += createBundleSection('Theme-based Collections', themeGroups, 'theme');
        }

        // Character-based bundles
        if (characterGroups.length > 0) {
            html += createBundleSection('Character-based Adventures', characterGroups, 'character');
        }

        // Environment-based bundles
        if (environmentGroups.length > 0) {
            html += createBundleSection('Magical Realms', environmentGroups, 'environment');
        }

        if (!html) {
            html = '<div class="col-12"><div class="alert alert-info">No bundle opportunities found</div></div>';
        }

        bundleSuggestions.innerHTML = html;

        // Initialize all tooltips
        const tooltips = document.querySelectorAll('[data-bs-toggle="tooltip"]');
        tooltips.forEach(tooltip => new bootstrap.Tooltip(tooltip));
    }

    function createBundleSection(title, groups, type) {
        return `
            <div class="col-12 mb-4">
                <h6 class="mb-3">${title}</h6>
                ${groups.slice(0, 5).map(group => {
                    const bundleTitle = generateBundleTitle(type, group.commonality);
                    const elevatorPitch = generateElevatorPitch(type, group.commonality, group.count, group.items);

                    return `
                    <div class="card mb-3">
                        <div class="card-header" role="button" data-bs-toggle="collapse" 
                             data-bs-target="#bundle-${type}-${group.commonality.replace(/\s+/g, '-')}"
                             aria-expanded="false">
                            <div class="d-flex justify-content-between align-items-center">
                                <h5 class="mb-0">
                                    ${bundleTitle}
                                    <i class="bi bi-chevron-down ms-2"></i>
                                </h5>
                                <span class="badge bg-primary">${group.count} stories</span>
                            </div>
                            <p class="card-text text-muted mb-0 mt-2">${elevatorPitch}</p>
                            <div class="mt-2">
                                <span class="badge bg-secondary">${type}: ${group.commonality}</span>
                            </div>
                        </div>
                        <div class="collapse" id="bundle-${type}-${group.commonality.replace(/\s+/g, '-')}">
                            <div class="card-body">
                                <div class="list-group list-group-flush">
                                    ${group.items.map(item => `
                                        <div class="list-group-item">
                                            <div class="d-flex justify-content-between align-items-center">
                                                <span>${item.title || 'Untitled'}</span>
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        </div>
                    </div>
                    `}).join('')}
            </div>
        `;
    }

    // Load bundle opportunities when the bundle tab is shown
    const bundleTab = document.getElementById('bundle-tab');
    bundleTab.addEventListener('shown.bs.tab', findBundleOpportunities);
});