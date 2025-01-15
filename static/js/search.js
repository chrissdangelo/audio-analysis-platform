document.addEventListener('DOMContentLoaded', function() {
    const characterCheckboxes = document.getElementById('characterCheckboxes');
    const environmentCheckboxes = document.getElementById('environmentCheckboxes');
    const themesList = document.getElementById('themesList');
    const searchResults = document.getElementById('searchResults');
    const criteriaModeToggle = document.getElementById('criteriaMode');

    let analyses = []; // Store all analyses data

    async function loadFilterOptions() {
        try {
            const response = await fetch('/api/analyses');
            analyses = await response.json();

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

            updateFilterCounts();

            // Add change event listeners to all checkboxes
            document.querySelectorAll('.form-check-input').forEach(checkbox => {
                checkbox.addEventListener('change', () => {
                    performSearch();
                    updateFilterCounts();
                });
            });

            // Add change event listener to criteria mode toggle
            criteriaModeToggle.addEventListener('change', () => {
                performSearch();
                updateFilterCounts();
            });

        } catch (error) {
            console.error('Error loading filter options:', error);
        }
    }

    function updateFilterCounts() {
        const selectedCharacters = [...document.querySelectorAll('#characterCheckboxes input:checked')]
            .map(input => input.value);
        const selectedEnvironments = [...document.querySelectorAll('#environmentCheckboxes input:checked')]
            .map(input => input.value);
        const selectedThemes = [...document.querySelectorAll('#themesList input:checked')]
            .map(input => input.value);

        const matchAll = criteriaModeToggle.checked;

        // Count matching items for each criterion
        analyses.forEach(analysis => {
            // Update character counts
            document.querySelectorAll('#characterCheckboxes input').forEach(input => {
                const char = input.value;
                const label = input.parentElement.querySelector('label');
                const count = countMatches(char, 'speaking_characters', selectedCharacters, selectedEnvironments, selectedThemes, matchAll);
                label.textContent = `${char} (${count})`;
            });

            // Update environment counts
            document.querySelectorAll('#environmentCheckboxes input').forEach(input => {
                const env = input.value;
                const label = input.parentElement.querySelector('label');
                const count = countMatches(env, 'environments', selectedCharacters, selectedEnvironments, selectedThemes, matchAll);
                label.textContent = `${env} (${count})`;
            });

            // Update theme counts
            document.querySelectorAll('#themesList input').forEach(input => {
                const theme = input.value;
                const label = input.parentElement.querySelector('label');
                const count = countMatches(theme, 'themes', selectedCharacters, selectedEnvironments, selectedThemes, matchAll);
                label.textContent = `${theme} (${count})`;
            });
        });
    }

    function countMatches(value, type, selectedCharacters, selectedEnvironments, selectedThemes, matchAll) {
        return analyses.filter(analysis => {
            const hasValue = analysis[type] && analysis[type].includes(value);

            if (!hasValue) return false;

            if (selectedCharacters.length === 0 && selectedEnvironments.length === 0 && selectedThemes.length === 0) {
                return true;
            }

            const matchesCharacters = selectedCharacters.length === 0 || 
                selectedCharacters.some(char => analysis.speaking_characters && analysis.speaking_characters.includes(char));
            const matchesEnvironments = selectedEnvironments.length === 0 || 
                selectedEnvironments.some(env => analysis.environments && analysis.environments.includes(env));
            const matchesThemes = selectedThemes.length === 0 || 
                selectedThemes.some(theme => analysis.themes && analysis.themes.includes(theme));

            if (matchAll) {
                return matchesCharacters && matchesEnvironments && matchesThemes;
            } else {
                return matchesCharacters || matchesEnvironments || matchesThemes;
            }
        }).length;
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
                document.querySelector('#resultsCount').textContent = '0 items found';
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