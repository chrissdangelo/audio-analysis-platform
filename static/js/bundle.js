document.addEventListener('DOMContentLoaded', function() {
    let bundles = [];

    async function findBundleOpportunities() {
        try {
            const response = await fetch('/api/bundles');
            bundles = await response.json();
            displayBundles(bundles);
        } catch (error) {
            console.error('Error:', error);
        }
    }

    function displayBundles(bundles) {
        const container = document.getElementById('bundleSuggestions');
        if (!container) return;

        container.innerHTML = bundles.map((bundle, index) => `
            <div class="col-12 mb-4">
                <div class="card">
                    <div class="card-body">
                        <h5 class="card-title">${bundle.name}</h5>
                        <p class="card-text">${bundle.description}</p>
                        <div class="d-flex justify-content-between align-items-center">
                            <button class="btn btn-primary" onclick="toggleBundleDetails(${index})">
                                View Details
                            </button>
                            <button class="btn btn-secondary" onclick="downloadBundlePitch(${index})">
                                Download Bundle Pitch
                            </button>
                        </div>
                        <div id="bundleDetails${index}" class="mt-3" style="display: none;">
                            <h6>Files:</h6>
                            <ul>
                                ${bundle.files.map(file => `<li>${file}</li>`).join('')}
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    window.toggleBundleDetails = function(index) {
        const details = document.getElementById(`bundleDetails${index}`);
        if (details) {
            details.style.display = details.style.display === 'none' ? 'block' : 'none';
        }
    };

    window.downloadBundlePitch = function(index) {
        const bundle = bundles[index];
        if (!bundle) return;

        const pitch = generateBundlePitch(bundle);
        downloadFile(pitch, `${bundle.name.replace(/\s+/g, '_')}_pitch.txt`);
    };

    function generateBundlePitch(bundle) {
        return `Bundle: ${bundle.name}
Description: ${bundle.description}

Files Included:
${bundle.files.map(file => `- ${file}`).join('\n')}

Summary:
This bundle contains ${bundle.files.length} related audio files that form a cohesive collection.
`;
    }

    function downloadFile(content, filename) {
        const blob = new Blob([content], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    }

    // Initial load of bundle opportunities
    findBundleOpportunities();

    // Load bundles when the bundle tab is shown
    const bundleTab = document.getElementById('bundle-tab');
    if (bundleTab) {
        bundleTab.addEventListener('shown.bs.tab', findBundleOpportunities);
    }
});