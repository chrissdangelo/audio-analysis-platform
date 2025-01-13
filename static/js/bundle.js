document.addEventListener('DOMContentLoaded', function() {
    const bundleSuggestions = document.getElementById('bundleSuggestions');

    async function findBundleOpportunities() {
        try {
            const response = await fetch('/api/analyses');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const analyses = await response.json();

            if (!Array.isArray(analyses) || analyses.length === 0) {
                bundleSuggestions.innerHTML = '<div class="col-12"><div class="alert alert-info">No content available for bundle analysis</div></div>';
                return;
            }

            // Group by themes
            const themeGroups = groupByField(analyses, 'themes');

            // Group by characters
            const characterGroups = groupByField(analyses, 'characters_mentioned');

            displayBundleSuggestions(themeGroups, characterGroups);

        } catch (error) {
            console.error('Error finding bundle opportunities:', error);
            bundleSuggestions.innerHTML = `
                <div class="col-12">
                    <div class="alert alert-danger">
                        Error analyzing bundle opportunities: ${error.message}
                    </div>
                </div>`;
        }
    }

    function groupByField(analyses, field) {
        const groups = new Map();

        analyses.forEach(analysis => {
            let items = analysis[field] || [];
            if (!Array.isArray(items)) {
                items = [items].filter(Boolean);
            }

            items.forEach(item => {
                if (!item) return;
                const key = item.toString().trim();
                if (!key) return;

                if (!groups.has(key)) {
                    groups.set(key, []);
                }
                groups.get(key).push(analysis);
            });
        });

        return Array.from(groups.entries())
            .filter(([_, items]) => items.length > 1)
            .map(([key, items]) => ({
                commonality: key,
                items: items,
                count: items.length
            }))
            .sort((a, b) => b.count - a.count);
    }

    function displayBundleSuggestions(themeGroups, characterGroups) {
        let html = '';

        if (themeGroups.length > 0) {
            html += createBundleSection('Theme Collections', themeGroups);
        }

        if (characterGroups.length > 0) {
            html += createBundleSection('Character Collections', characterGroups);
        }

        if (!html) {
            html = '<div class="col-12"><div class="alert alert-info">No bundle opportunities found</div></div>';
        }

        bundleSuggestions.innerHTML = html;
    }

    function createBundleSection(title, groups) {
        return `
            <div class="col-12 mb-4">
                <h6 class="mb-3">${title}</h6>
                ${groups.slice(0, 5).map(group => `
                    <div class="card mb-3">
                        <div class="card-header" role="button" data-bs-toggle="collapse" 
                             data-bs-target="#bundle-${group.commonality.replace(/\s+/g, '-')}"
                             aria-expanded="false">
                            <div class="d-flex justify-content-between align-items-center">
                                <h5 class="mb-0">
                                    ✨ ${group.commonality}
                                    <i class="bi bi-chevron-down ms-2"></i>
                                </h5>
                                <span class="badge bg-primary">${group.count} stories</span>
                            </div>
                        </div>
                        <div class="collapse" id="bundle-${group.commonality.replace(/\s+/g, '-')}">
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
                `).join('')}
            </div>
        `;
    }

    // Initialize bundle suggestions when the bundle tab is shown
    const bundleTab = document.getElementById('bundle-tab');
    bundleTab.addEventListener('shown.bs.tab', findBundleOpportunities);
});