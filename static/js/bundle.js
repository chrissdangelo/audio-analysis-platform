document.addEventListener('DOMContentLoaded', function() {
    const bundleSuggestions = document.getElementById('bundleSuggestions');
    const noBundlesMessage = document.getElementById('noBundlesMessage');
    const bundleSize = document.getElementById('bundleSize');
    let accessToken = null;

    // Function to get guest access token
    async function getGuestAccessToken() {
        try {
            const response = await fetch('/api/guest-access', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    duration_days: 1,
                    access_level: 'read-write'
                })
            });

            if (!response.ok) {
                throw new Error('Failed to get access token');
            }

            const data = await response.json();
            return data.access.access_token;
        } catch (error) {
            console.error('Error getting access token:', error);
            showError('Error accessing the application. Please try again later.');
            return null;
        }
    }

    // Initialize access token
    (async function initializeAccess() {
        accessToken = await getGuestAccessToken();
        if (accessToken) {
            // Initial load of bundle suggestions
            findBundleOpportunities();
        }
    })();

    // Add event listeners for real-time updates
    bundleSize.addEventListener('change', findBundleOpportunities);

    // Theme, character, and environment selection handlers
    function setupSelectionHandlers(containerId, items) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = ''; // Clear existing content
        items.forEach(item => {
            const button = document.createElement('button');
            button.className = 'btn btn-outline-primary btn-sm';
            button.textContent = item;
            button.dataset.selected = 'false';

            button.addEventListener('click', () => {
                const wasSelected = button.dataset.selected === 'true';
                button.dataset.selected = (!wasSelected).toString();
                button.className = wasSelected ? 
                    'btn btn-outline-primary btn-sm' : 
                    'btn btn-primary btn-sm';
                findBundleOpportunities();
            });

            container.appendChild(button);
        });
    }

    function getSelectedItems(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return [];

        return Array.from(container.children)
            .filter(button => button.dataset.selected === 'true')
            .map(button => button.textContent);
    }

    async function findBundleOpportunities() {
        try {
            if (!accessToken) {
                accessToken = await getGuestAccessToken();
                if (!accessToken) {
                    showNoBundlesMessage('Unable to authenticate. Please refresh the page.');
                    return;
                }
            }

            // Show loading state
            showLoading();

            // Get selected criteria
            const size = parseInt(bundleSize.value);
            const themes = getSelectedItems('bundleThemesList');
            const characters = getSelectedItems('bundleCharacterList');
            const environments = getSelectedItems('bundleEnvironmentList');

            // Build query parameters
            const params = new URLSearchParams({
                bundle_size: size,
                ...themes.length && { 'themes[]': themes },
                ...characters.length && { 'characters[]': characters },
                ...environments.length && { 'environments[]': environments }
            });

            const response = await fetch(`/api/bundle-suggestions?access_token=${accessToken}&${params}`);

            if (!response.ok) {
                if (response.status === 401) {
                    // Token expired, get new token and retry
                    accessToken = await getGuestAccessToken();
                    if (accessToken) {
                        hideLoading();
                        return findBundleOpportunities();
                    }
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (!data.bundles || data.bundles.length === 0) {
                showNoBundlesMessage(`No bundles of size ${size} match the current criteria`);
                return;
            }

            displayBundles(data.bundles);

        } catch (error) {
            console.error('Error finding bundle opportunities:', error);
            showNoBundlesMessage('Error analyzing bundle opportunities: ' + error.message);
        } finally {
            hideLoading();
        }
    }

    function showLoading() {
        if (bundleSuggestions) {
            bundleSuggestions.innerHTML = `
                <div class="text-center py-4">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <p class="mt-2">Finding bundle opportunities...</p>
                </div>
            `;
        }
        if (noBundlesMessage) {
            noBundlesMessage.classList.add('d-none');
        }
    }

    function hideLoading() {
        const loadingSpinner = bundleSuggestions?.querySelector('.spinner-border')?.parentElement;
        if (loadingSpinner) {
            loadingSpinner.remove();
        }
    }

    function showNoBundlesMessage(message) {
        if (noBundlesMessage) {
            noBundlesMessage.textContent = message;
            noBundlesMessage.classList.remove('d-none');
        }
        if (bundleSuggestions) {
            bundleSuggestions.innerHTML = '';
        }
    }

    function displayBundles(bundles) {
        if (!bundleSuggestions) return;

        let html = `<div class="row g-4">`;

        bundles.forEach(bundle => {
            html += `
                <div class="col-md-6 col-lg-4">
                    <div class="card h-100">
                        <div class="card-header">
                            <h5 class="card-title mb-0">Bundle #${bundle.id}</h5>
                        </div>
                        <div class="card-body">
                            <div class="bundle-stats mb-3">
                                <span class="badge bg-primary me-2">
                                    ${bundle.items.length} items
                                </span>
                                <span class="badge bg-secondary">
                                    ${formatDuration(bundle.total_duration)}
                                </span>
                            </div>
                            ${bundle.common_themes.length ? `
                                <div class="bundle-themes mb-3">
                                    <h6>Common Themes</h6>
                                    <div class="d-flex flex-wrap gap-1">
                                        ${bundle.common_themes.map(theme => 
                                            `<span class="badge bg-info">${theme}</span>`
                                        ).join('')}
                                    </div>
                                </div>
                            ` : ''}
                            <div class="bundle-items">
                                <h6>Content</h6>
                                <div class="list-group list-group-flush">
                                    ${bundle.items.map(item => `
                                        <div class="list-group-item">
                                            <div class="d-flex justify-content-between align-items-center">
                                                <span>${item.title || 'Untitled'}</span>
                                                <span class="badge bg-light text-dark">
                                                    ${item.duration}
                                                </span>
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });

        html += `</div>`;
        bundleSuggestions.innerHTML = html;
        noBundlesMessage?.classList.add('d-none');
    }

    function formatDuration(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const remainingSeconds = seconds % 60;

        if (hours > 0) {
            return `${hours}h ${minutes}m ${remainingSeconds}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${remainingSeconds}s`;
        }
        return `${remainingSeconds}s`;
    }

    // Initialize available options
    fetch('/api/analyses').then(response => response.json()).then(analyses => {
        // Extract unique themes, characters, and environments
        const themes = new Set();
        const characters = new Set();
        const environments = new Set();

        analyses.forEach(analysis => {
            if (typeof analysis.themes === 'string') {
                try {
                    JSON.parse(analysis.themes)?.forEach(theme => themes.add(theme));
                } catch (e) {}
            }
            if (typeof analysis.characters_mentioned === 'string') {
                try {
                    JSON.parse(analysis.characters_mentioned)?.forEach(char => characters.add(char));
                } catch (e) {}
            }
            if (typeof analysis.environments === 'string') {
                try {
                    JSON.parse(analysis.environments)?.forEach(env => environments.add(env));
                } catch (e) {}
            }
        });

        // Setup selection handlers
        setupSelectionHandlers('bundleThemesList', Array.from(themes));
        setupSelectionHandlers('bundleCharacterList', Array.from(characters));
        setupSelectionHandlers('bundleEnvironmentList', Array.from(environments));

    }).catch(error => {
        console.error('Error initializing bundle options:', error);
        showNoBundlesMessage('Error loading bundle options: ' + error.message);
    });

    function showError(message) {
        // Add your error handling logic here.  For example, display an alert.
        alert(message);
    }


    // Load bundle opportunities when the bundle tab is shown
    const bundleTab = document.getElementById('bundle-tab');
    bundleTab.addEventListener('shown.bs.tab', findBundleOpportunities);

    // Update bundles when minimum titles changes
    document.getElementById('minTitles')?.addEventListener('change', findBundleOpportunities);
});