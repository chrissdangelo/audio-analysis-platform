document.addEventListener('DOMContentLoaded', function() {
    const bundleSuggestions = document.getElementById('bundleSuggestions');
    
    async function findBundleOpportunities() {
        try {
            const response = await fetch('/api/analyses');
            const analyses = await response.json();
            
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
            bundleSuggestions.innerHTML = '<div class="col-12"><div class="alert alert-danger">Error analyzing bundle opportunities</div></div>';
        }
    }
    
    function groupByCommonality(analyses, field) {
        const groups = new Map();
        
        analyses.forEach(analysis => {
            const items = analysis[field] || [];
            items.forEach(item => {
                if (!groups.has(item)) {
                    groups.set(item, []);
                }
                groups.get(item).push(analysis);
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
                ${groups.slice(0, 5).map(group => `
                    <div class="card mb-3">
                        <div class="card-body">
                            <h6 class="card-subtitle mb-2 text-muted">
                                ${type.charAt(0).toUpperCase() + type.slice(1)}: ${group.commonality}
                                <span class="badge bg-primary ms-2">${group.count} items</span>
                            </h6>
                            <div class="list-group list-group-flush">
                                ${group.items.map(item => `
                                    <div class="list-group-item">
                                        <div class="d-flex justify-content-between align-items-center">
                                            <span>${item.title}</span>
                                            <small class="text-muted">${item.duration}</small>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    // Load bundle opportunities when the bundle tab is shown
    const bundleTab = document.getElementById('bundle-tab');
    bundleTab.addEventListener('shown.bs.tab', findBundleOpportunities);
});
