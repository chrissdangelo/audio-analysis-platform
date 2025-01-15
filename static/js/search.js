document.addEventListener('DOMContentLoaded', function() {
    const characterCheckboxes = document.getElementById('characterCheckboxes');
    const environmentCheckboxes = document.getElementById('environmentCheckboxes');
    const themesList = document.getElementById('themesList');
    const searchResults = document.getElementById('searchResults');
    const criteriaModeToggle = document.getElementById('criteriaMode');

    // Initialize collapse functionality
    document.querySelectorAll('.collapsible').forEach(header => {
        header.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('data-target');
            const content = document.getElementById(targetId);

            // Toggle the collapse state
            if (content.classList.contains('show')) {
                content.classList.remove('show');
                this.querySelector('i').classList.remove('fa-chevron-up');
                this.querySelector('i').classList.add('fa-chevron-down');
            } else {
                content.classList.add('show');
                this.querySelector('i').classList.remove('fa-chevron-down');
                this.querySelector('i').classList.add('fa-chevron-up');
            }
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

            // Add change event listeners to all checkboxes
            document.querySelectorAll('.form-check-input').forEach(checkbox => {
                checkbox.addEventListener('change', performSearch);
            });

            // Add change event listener to criteria mode toggle
            criteriaModeToggle.addEventListener('change', performSearch);

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

            // If no criteria are selected, show the default message
            if (!selectedCharacters.length && !selectedEnvironments.length && !selectedThemes.length) {
                searchResults.innerHTML = `
                    <div class="alert alert-info">
                        <i class="fas fa-info-circle me-2"></i>
                        Select criteria from the left panel to see matching content
                    </div>
                `;
                return;
            }

            const params = new URLSearchParams();
            if (selectedCharacters.length) params.append('characters', selectedCharacters.join(','));
            if (selectedEnvironments.length) params.append('environments', selectedEnvironments.join(','));
            if (selectedThemes.length) params.append('themes', selectedThemes.join(','));
            params.append('match_all', criteriaModeToggle.checked ? 'true' : 'false');

            const response = await fetch(`/api/search?${params.toString()}`);
            const results = await response.json();
            displaySearchResults(results);
        } catch (error) {
            console.error('Error performing search:', error);
            searchResults.innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-circle me-2"></i>
                    Error performing search. Please try again.
                </div>
            `;
        }
    }

    function displaySearchResults(results) {
        // Update results count
        const resultsCount = document.querySelector('#resultsCount');
        resultsCount.textContent = `${results.length} items found`;

        if (!results.length) {
            searchResults.innerHTML = `
                <div class="alert alert-info">
                    <i class="fas fa-info-circle me-2"></i>
                    No matches found for the selected criteria
                </div>
            `;
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