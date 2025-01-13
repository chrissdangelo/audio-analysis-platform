
document.addEventListener('DOMContentLoaded', function() {
    const characterCheckboxes = document.getElementById('characterCheckboxes');
    const environmentCheckboxes = document.getElementById('environmentCheckboxes');
    const themesList = document.getElementById('themesList');
    const searchResults = document.getElementById('searchResults');

    // Setup collapsible sections
    document.querySelectorAll('.card-header.collapsible').forEach(header => {
        header.addEventListener('click', function() {
            const target = this.getAttribute('data-target');
            const content = document.getElementById(target);
            
            // Toggle current section
            this.classList.toggle('active');
            content.classList.toggle('show');
        });
    });

    async function loadFilterOptions() {
        try {
            const response = await fetch('/api/analyses');
            const analyses = await response.json();

            // Extract unique values
            const characters = new Set();
            const environments = new Set();
            const themes = new Set();

            analyses.forEach(analysis => {
                if (analysis.speaking_characters) {
                    analysis.speaking_characters.forEach(char => characters.add(char));
                }
                if (analysis.environments) {
                    analysis.environments.forEach(env => environments.add(env));
                }
                if (analysis.themes) {
                    analysis.themes.forEach(theme => themes.add(theme));
                }
            });

            // Count occurrences
            const characterCounts = new Map();
            const environmentCounts = new Map();
            const themeCounts = new Map();

            analyses.forEach(analysis => {
                if (analysis.speaking_characters) {
                    analysis.speaking_characters.forEach(char => {
                        characterCounts.set(char, (characterCounts.get(char) || 0) + 1);
                    });
                }
                if (analysis.environments) {
                    analysis.environments.forEach(env => {
                        environmentCounts.set(env, (environmentCounts.get(env) || 0) + 1);
                    });
                }
                if (analysis.themes) {
                    analysis.themes.forEach(theme => {
                        themeCounts.set(theme, (themeCounts.get(theme) || 0) + 1);
                    });
                }
            });

            // Populate checkboxes with counts
            characterCheckboxes.innerHTML = Array.from(characters)
                .sort()
                .map(char => `
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" value="${char}" id="char-${char}">
                        <label class="form-check-label" for="char-${char}">${char} (${characterCounts.get(char) || 0})</label>
                    </div>
                `).join('');

            environmentCheckboxes.innerHTML = Array.from(environments)
                .sort()
                .map(env => `
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" value="${env}" id="env-${env}">
                        <label class="form-check-label" for="env-${env}">${env} (${environmentCounts.get(env) || 0})</label>
                    </div>
                `).join('');

            themesList.innerHTML = Array.from(themes)
                .sort()
                .map(theme => `
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" value="${theme}" id="theme-${theme}">
                        <label class="form-check-label" for="theme-${theme}">${theme} (${themeCounts.get(theme) || 0})</label>
                    </div>
                `).join('');

            // Add change event listeners to all checkboxes and search mode toggle
            document.querySelectorAll('.form-check-input').forEach(checkbox => {
                checkbox.addEventListener('change', (e) => {
                    if (e.target.id === 'searchMode') {
                        e.target.nextElementSibling.textContent = e.target.checked ? 'Has All' : 'Has One';
                    }
                    performSearch();
                });
            });

        } catch (error) {
            console.error('Error loading filter options:', error);
        }
    }

    async function performSearch() {
        try {
            const searchMode = document.getElementById('searchMode');
            const selectedCharacters = [...document.querySelectorAll('#characterCheckboxes input:checked')]
                .map(input => input.value);
            const selectedEnvironments = [...document.querySelectorAll('#environmentCheckboxes input:checked')]
                .map(input => input.value);
            const selectedThemes = [...document.querySelectorAll('#themesList input:checked')]
                .map(input => input.value);

            const params = new URLSearchParams();
            if (selectedCharacters.length) params.append('characters', selectedCharacters.join(','));
            if (selectedEnvironments.length) params.append('environments', selectedEnvironments.join(','));
            if (selectedThemes.length) params.append('themes', selectedThemes.join(','));
            params.append('mode', searchMode.checked ? 'all' : 'any');

            const response = await fetch(`/api/search?${params.toString()}`);
            const results = await response.json();
            displaySearchResults(results);
        } catch (error) {
            console.error('Error performing search:', error);
        }
    }

    function displaySearchResults(results) {
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

    // Initialize
    loadFilterOptions();
});
