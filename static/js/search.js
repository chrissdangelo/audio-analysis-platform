
document.addEventListener('DOMContentLoaded', function() {
    const characterCheckboxes = document.getElementById('characterCheckboxes');
    const environmentCheckboxes = document.getElementById('environmentCheckboxes');
    const themesList = document.getElementById('themesList');
    const searchForm = document.getElementById('searchForm');

    // Fetch and populate filters when the search tab is shown
    document.getElementById('search-tab').addEventListener('shown.bs.tab', loadFilterOptions);

    async function loadFilterOptions() {
        try {
            const response = await fetch('/api/analyses');
            const analyses = await response.json();
            
            // Extract unique values
            const characters = new Set();
            const environments = new Set();
            const themes = new Set();
            
            analyses.forEach(analysis => {
                // Add characters
                if (analysis.speaking_characters) {
                    analysis.speaking_characters.forEach(char => characters.add(char));
                }
                
                // Add environments
                if (analysis.environments) {
                    analysis.environments.forEach(env => environments.add(env));
                }
                
                // Add themes
                if (analysis.themes) {
                    analysis.themes.forEach(theme => themes.add(theme));
                }
            });

            // Populate characters
            characterCheckboxes.innerHTML = Array.from(characters)
                .sort()
                .map(char => `
                    <div class="form-check form-check-inline">
                        <input class="form-check-input" type="checkbox" value="${char}" id="char-${char}">
                        <label class="form-check-label" for="char-${char}">${char}</label>
                    </div>
                `).join('');

            // Populate environments
            environmentCheckboxes.innerHTML = Array.from(environments)
                .sort()
                .map(env => `
                    <div class="form-check form-check-inline">
                        <input class="form-check-input" type="checkbox" value="${env}" id="env-${env}">
                        <label class="form-check-label" for="env-${env}">${env}</label>
                    </div>
                `).join('');

            // Populate themes
            if (themesList) {
                themesList.innerHTML = Array.from(themes)
                    .sort()
                    .map(theme => `
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" value="${theme}" id="theme-${theme}">
                            <label class="form-check-label" for="theme-${theme}">${theme}</label>
                        </div>
                    `).join('');
            }

        } catch (error) {
            console.error('Error loading filter options:', error);
        }
    }

    // Handle form submission
    if (searchForm) {
        searchForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            // Get selected values
            const selectedCharacters = [...document.querySelectorAll('#characterCheckboxes input:checked')]
                .map(input => input.value);
            const selectedEnvironments = [...document.querySelectorAll('#environmentCheckboxes input:checked')]
                .map(input => input.value);
            const selectedThemes = [...document.querySelectorAll('#themesList input:checked')]
                .map(input => input.value);

            // Build query parameters
            const params = new URLSearchParams();
            if (selectedCharacters.length) params.append('characters', selectedCharacters.join(','));
            if (selectedEnvironments.length) params.append('environments', selectedEnvironments.join(','));
            if (selectedThemes.length) params.append('themes', selectedThemes.join(','));

            try {
                const response = await fetch(`/api/search?${params.toString()}`);
                const results = await response.json();
                displaySearchResults(results);
            } catch (error) {
                console.error('Error performing search:', error);
            }
        });
    }

    function displaySearchResults(results) {
        const searchResults = document.getElementById('searchResults');
        if (!searchResults) return;

        if (!results.length) {
            searchResults.innerHTML = '<div class="alert alert-info">No matches found</div>';
            return;
        }

        searchResults.innerHTML = `
            <div class="list-group">
                ${results.map(result => `
                    <div class="list-group-item">
                        <h5 class="mb-1">${result.title || 'Untitled'}</h5>
                        ${result.themes ? `<p class="mb-1"><strong>Themes:</strong> ${result.themes.join(', ')}</p>` : ''}
                        ${result.speaking_characters ? `<p class="mb-1"><strong>Characters:</strong> ${result.speaking_characters.join(', ')}</p>` : ''}
                        ${result.environments ? `<p class="mb-1"><strong>Environments:</strong> ${result.environments.join(', ')}</p>` : ''}
                        ${result.dominant_emotion ? `<span class="badge bg-info">${result.dominant_emotion}</span>` : ''}
                    </div>
                `).join('')}
            </div>
        `;
    }
});
