
document.addEventListener('DOMContentLoaded', function() {
    async function findBundleOpportunities() {
        try {
            const response = await fetch('/api/bundles');
            if (!response.ok) throw new Error('Failed to fetch bundles');
            const bundles = await response.json();
            displayBundles(bundles);
        } catch (error) {
            console.error('Error:', error);
            const container = document.getElementById('bundleSuggestions');
            if (container) {
                container.innerHTML = `<div class="alert alert-danger">Error loading bundles: ${error.message}</div>`;
            }
        }
    }

    function displayBundles(bundles) {
        const container = document.getElementById('bundleSuggestions');
        if (!container) return;

        if (!bundles.length) {
            container.innerHTML = '<div class="alert alert-info">No bundle opportunities found.</div>';
            return;
        }

        container.innerHTML = bundles.map((bundle, index) => `
            <div class="col-12 mb-4">
                <div class="card">
                    <div class="card-body">
                        <h5 class="card-title">${bundle.commonality}</h5>
                        <p class="card-text">Bundle of ${bundle.count} ${bundle.type} items</p>
                        <div class="d-flex justify-content-between align-items-center">
                            <button class="btn btn-primary" onclick="toggleBundleDetails(${index})">
                                View Details
                            </button>
                            <button class="btn btn-secondary" onclick="downloadBundlePitch(${index})">
                                Download Bundle Pitch
                            </button>
                        </div>
                        <div id="bundleDetails${index}" class="mt-3" style="display: none;">
                            <h6>Items:</h6>
                            <ul>
                                ${bundle.items.map(item => `<li>${item.title}</li>`).join('')}
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

    window.downloadBundlePitch = async function(index) {
        try {
            const response = await fetch('/api/bundles');
            const bundles = await response.json();
            const bundle = bundles[index];
            
            if (!bundle) return;

            const pitchResponse = await fetch('/api/bundle-pitch', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    type: bundle.type,
                    group: bundle
                })
            });

            if (!pitchResponse.ok) throw new Error('Failed to generate pitch');

            const blob = await pitchResponse.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${bundle.commonality.replace(/\s+/g, '_')}_bundle_pitch.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error('Error downloading pitch:', error);
            alert('Error generating bundle pitch');
        }
    };

    // Initial load of bundle opportunities
    findBundleOpportunities();
});
