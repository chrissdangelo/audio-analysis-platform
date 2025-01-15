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

            // Populate checkboxes
            characterCheckboxes.querySelector('.d-flex').innerHTML = Array.from(characters)
                .sort()
                .map(char => `
                    <div class="form-check me-3">
                        <input class="form-check-input" type="checkbox" value="${char}" id="char-${char}">
                        <label class="form-check-label" for="char-${char}">${char}</label>
                    </div>
                `).join('');

            environmentCheckboxes.querySelector('.d-flex').innerHTML = Array.from(environments)
                .sort()
                .map(env => `
                    <div class="form-check me-3">
                        <input class="form-check-input" type="checkbox" value="${env}" id="env-${env}">
                        <label class="form-check-label" for="env-${env}">${env}</label>
                    </div>
                `).join('');

            themesList.querySelector('.d-flex').innerHTML = Array.from(themes)
                .sort()
                .map(theme => `
                    <div class="form-check me-3">
                        <input class="form-check-input" type="checkbox" value="${theme}" id="theme-${theme}">
                        <label class="form-check-label" for="theme-${theme}">${theme}</label>
                    </div>
                `).join('');

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

        // Update character counts
        document.querySelectorAll('#characterCheckboxes input').forEach(input => {
            const char = input.value;
            const label = input.parentElement.querySelector('label');
            const count = countMatchesForCriterion(char, 'speaking_characters', selectedCharacters, selectedEnvironments, selectedThemes, matchAll);
            label.textContent = `${char} (${count})`;
        });

        // Update environment counts
        document.querySelectorAll('#environmentCheckboxes input').forEach(input => {
            const env = input.value;
            const label = input.parentElement.querySelector('label');
            const count = countMatchesForCriterion(env, 'environments', selectedCharacters, selectedEnvironments, selectedThemes, matchAll);
            label.textContent = `${env} (${count})`;
        });

        // Update theme counts
        document.querySelectorAll('#themesList input').forEach(input => {
            const theme = input.value;
            const label = input.parentElement.querySelector('label');
            const count = countMatchesForCriterion(theme, 'themes', selectedCharacters, selectedEnvironments, selectedThemes, matchAll);
            label.textContent = `${theme} (${count})`;
        });
    }

    function countMatchesForCriterion(value, type, selectedCharacters, selectedEnvironments, selectedThemes, matchAll) {
        return analyses.filter(analysis => {
            // Check if the item has the current criterion
            const hasCurrentCriterion = analysis[type] && analysis[type].includes(value);
            if (!hasCurrentCriterion) return false;

            // If no other criteria are selected, just count items with this criterion
            if (selectedCharacters.length === 0 && selectedEnvironments.length === 0 && selectedThemes.length === 0) {
                return true;
            }

            // For other selected criteria, check if they match based on the mode
            const matchesSelectedCharacters = type === 'speaking_characters' ? true :
                selectedCharacters.length === 0 || 
                selectedCharacters.some(char => analysis.speaking_characters && analysis.speaking_characters.includes(char));

            const matchesSelectedEnvironments = type === 'environments' ? true :
                selectedEnvironments.length === 0 || 
                selectedEnvironments.some(env => analysis.environments && analysis.environments.includes(env));

            const matchesSelectedThemes = type === 'themes' ? true :
                selectedThemes.length === 0 || 
                selectedThemes.some(theme => analysis.themes && analysis.themes.includes(theme));

            if (matchAll) {
                return matchesSelectedCharacters && matchesSelectedEnvironments && matchesSelectedThemes;
            } else {
                return true; // In "Any" mode, we count all items that have this criterion
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

            const matchAll = criteriaModeToggle.checked;

            // Filter results locally based on selected criteria
            const filteredResults = analyses.filter(analysis => {
                // If no criteria are selected, return false to show no results
                if (selectedCharacters.length === 0 && selectedEnvironments.length === 0 && selectedThemes.length === 0) {
                    return false;
                }

                const matchesCharacters = selectedCharacters.length === 0 || 
                    (matchAll ? selectedCharacters.every(char => analysis.speaking_characters && analysis.speaking_characters.includes(char))
                             : selectedCharacters.some(char => analysis.speaking_characters && analysis.speaking_characters.includes(char)));

                const matchesEnvironments = selectedEnvironments.length === 0 || 
                    (matchAll ? selectedEnvironments.every(env => analysis.environments && analysis.environments.includes(env))
                             : selectedEnvironments.some(env => analysis.environments && analysis.environments.includes(env)));

                const matchesThemes = selectedThemes.length === 0 || 
                    (matchAll ? selectedThemes.every(theme => analysis.themes && analysis.themes.includes(theme))
                             : selectedThemes.some(theme => analysis.themes && analysis.themes.includes(theme)));

                if (matchAll) {
                    // Must match all selected criteria
                    return matchesCharacters && matchesEnvironments && matchesThemes;
                } else {
                    // Match any of the selected criteria
                    return (selectedCharacters.length > 0 && matchesCharacters) ||
                           (selectedEnvironments.length > 0 && matchesEnvironments) ||
                           (selectedThemes.length > 0 && matchesThemes);
                }
            });

            displaySearchResults(filteredResults);
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

    // Initialize collapse functionality for criteria sections
    document.querySelectorAll('[data-bs-toggle="collapse"]').forEach(button => {
        button.addEventListener('click', function() {
            const icon = this.querySelector('i');
            if (this.getAttribute('aria-expanded') === 'true') {
                icon.classList.remove('fa-chevron-up');
                icon.classList.add('fa-chevron-down');
            } else {
                icon.classList.remove('fa-chevron-down');
                icon.classList.add('fa-chevron-up');
            }
        });
    });

    // Initialize
    loadFilterOptions();
});