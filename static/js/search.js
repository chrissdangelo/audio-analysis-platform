
document.addEventListener('DOMContentLoaded', function() {
    const characterCheckboxes = document.getElementById('characterCheckboxes');
    const environmentCheckboxes = document.getElementById('environmentCheckboxes');
    const themesList = document.getElementById('themesList');
    const searchResults = document.getElementById('searchResults');

    function toggleSection(id) {
        const element = document.getElementById(id);
        element.classList.toggle('expanded');
    }

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

            // Populate checkboxes
            characterCheckboxes.innerHTML = Array.from(characters)
                .sort()
                .map(char => `
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" value="${char}" id="char-${char}">
                        <label class="form-check-label" for="char-${char}">${char}</label>
                    </div>
                `).join('');

            environmentCheckboxes.innerHTML = Array.from(environments)
                .sort()
                .map(env => `
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" value="${env}" id="env-${env}">
                        <label class="form-check-label" for="env-${env}">${env}</label>
                    </div>
                `).join('');

            themesList.innerHTML = Array.from(themes)
                .sort()
                .map(theme => `
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" value="${theme}" id="theme-${theme}">
                        <label class="form-check-label" for="theme-${theme}">${theme}</label>
                    </div>
                `).join('');

            // Add change event listeners to all checkboxes
            document.querySelectorAll('.form-check-input').forEach(checkbox => {
                checkbox.addEventListener('change', performSearch);
            });

        } catch (error) {
            console.error('Error loading filter options:', error);
        }
    }

    async function performSearch() {
        try {
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

    window.toggleSection = toggleSection;
    loadFilterOptions();
});
