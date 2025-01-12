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
                `${commonality} Collection`,
                `${commonality} Series`,
                `The ${commonality} Experience`
            ],
            character: [
                `Adventures with ${commonality}`,
                `${commonality}'s Story Collection`,
                `The World of ${commonality}`
            ],
            environment: [
                `Tales from the ${commonality}`,
                `${commonality} Stories`,
                `Journey to the ${commonality}`
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

        // Get example characters if available (for character-based bundles)
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
                `Explore ${count} captivating stories centered around "${commonality}", including "${examples[0]}"${examples[1] ? ` and "${examples[1]}"` : ''}. ${relatedThemes.length ? `These stories also touch on themes of ${relatedThemes.join(' and ')}.` : ''}`,
                `Dive into a collection of ${count} handpicked tales exploring "${commonality}". Featured stories include "${examples[0]}"${examples[1] ? ` and "${examples[1]}"` : ''}.`,
                `Experience the power of "${commonality}" through ${count} unique perspectives, showcasing stories like "${examples[0]}"${examples[1] ? ` and "${examples[1]}"` : ''}.`
            ],
            character: [
                `Join ${commonality} in ${count} unforgettable adventures${speakingCharacters.length ? `, alongside ${speakingCharacters.join(', ')}` : ''}. Start with "${examples[0]}"${examples[1] ? ` and "${examples[1]}"` : ''}.`,
                `Experience ${count} magical stories featuring ${commonality}${speakingCharacters.length ? ` and friends like ${speakingCharacters.join(' and ')}` : ''}. Begin your journey with "${examples[0]}"${examples[1] ? ` and "${examples[1]}"` : ''}.`,
                `Discover the world of ${commonality} through ${count} enchanting tales${speakingCharacters.length ? `, featuring appearances by ${speakingCharacters.join(', ')}` : ''}.`
            ],
            environment: [
                `Transport yourself to the ${commonality} in ${count} immersive stories, including "${examples[0]}"${examples[1] ? ` and "${examples[1]}"` : ''}${relatedThemes.length ? `. Experience themes of ${relatedThemes.join(' and ')}.` : ''}`,
                `Explore the magical ${commonality} setting across ${count} unique adventures. Featured stories include "${examples[0]}"${examples[1] ? ` and "${examples[1]}"` : ''}.`,
                `Journey through ${count} tales set in the enchanting ${commonality}, beginning with "${examples[0]}"${examples[1] ? ` and "${examples[1]}"` : ''}.`
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
            html += createBundleSection('Theme-based Bundles', themeGroups, 'theme');
        }

        // Character-based bundles
        if (characterGroups.length > 0) {
            html += createBundleSection('Character-based Bundles', characterGroups, 'character');
        }

        // Environment-based bundles
        if (environmentGroups.length > 0) {
            html += createBundleSection('Environment-based Bundles', environmentGroups, 'environment');
        }

        if (!html) {
            html = '<div class="col-12"><div class="alert alert-info">No bundle opportunities found</div></div>';
        }

        bundleSuggestions.innerHTML = html;
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
                             data-bs-target="#bundle-${type}-${group.commonality.replace(/\s+/g, '-')}">
                            <div class="d-flex justify-content-between align-items-center">
                                <h5 class="mb-0">${bundleTitle}</h5>
                                <span class="badge bg-primary">${group.count} items</span>
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