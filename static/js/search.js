document.addEventListener('DOMContentLoaded', function() {
    const searchForm = document.getElementById('searchForm');
    const themeCheckboxes = document.getElementById('themeCheckboxes');
    const characterCheckboxes = document.getElementById('characterCheckboxes');
    const environmentCheckboxes = document.getElementById('environmentCheckboxes');
    const resultsDiv = document.getElementById('searchResults');

    // Function to create checkboxes from unique values
    function populateCheckboxes(container, items, type) {
        const uniqueItems = [...new Set(items)].sort();
        container.innerHTML = uniqueItems.map(item => `
            <div class="form-check form-check-inline">
                <input class="form-check-input" type="checkbox" id="${type}_${item}" name="${type}" value="${item}">
                <label class="form-check-label" for="${type}_${item}">${item}</label>
            </div>
        `).join('');
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