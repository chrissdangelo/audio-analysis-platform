document.addEventListener('DOMContentLoaded', function() {
    const bundleSuggestions = document.getElementById('bundleSuggestions');
    const themesContainer = document.getElementById('themesContainer');
    const charactersContainer = document.getElementById('charactersContainer');
    const environmentsContainer = document.getElementById('environmentsContainer');

    function findBundleOpportunities() {
        fetch('/api/analyses')
            .then(response => response.json())
            .then(data => {
                const characters = new Set();
                const environments = new Set();
                const themes = new Set();

                data.forEach(analysis => {
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

                // Update checkboxes
                themesContainer.innerHTML = Array.from(themes).map(theme => `
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" value="${theme}" id="theme-${theme}">
                        <label class="form-check-label" for="theme-${theme}">${theme}</label>
                    </div>
                `).join('');

                charactersContainer.innerHTML = Array.from(characters).map(char => `
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" value="${char}" id="char-${char}">
                        <label class="form-check-label" for="char-${char}">${char}</label>
                    </div>
                `).join('');

                environmentsContainer.innerHTML = Array.from(environments).map(env => `
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" value="${env}" id="env-${env}">
                        <label class="form-check-label" for="env-${env}">${env}</label>
                    </div>
                `).join('');

                // Add event listeners
                document.querySelectorAll('.form-check-input').forEach(checkbox => {
                    checkbox.addEventListener('change', () => filterContent(data));
                });

                // Initial display
                displayContent(data);
            })
            .catch(error => {
                console.error('Error:', error);
                bundleSuggestions.innerHTML = '<div class="alert alert-danger">Error loading bundle suggestions</div>';
            });
    }

    function filterContent(data) {
        const selectedThemes = Array.from(document.querySelectorAll('#themesContainer input:checked')).map(cb => cb.value);
        const selectedCharacters = Array.from(document.querySelectorAll('#charactersContainer input:checked')).map(cb => cb.value);
        const selectedEnvironments = Array.from(document.querySelectorAll('#environmentsContainer input:checked')).map(cb => cb.value);

        const filteredData = data.filter(item => {
            const themeMatch = selectedThemes.length === 0 || 
                (item.themes && item.themes.some(theme => selectedThemes.includes(theme)));
            const charMatch = selectedCharacters.length === 0 || 
                (item.speaking_characters && item.speaking_characters.some(char => selectedCharacters.includes(char)));
            const envMatch = selectedEnvironments.length === 0 || 
                (item.environments && item.environments.some(env => selectedEnvironments.includes(env)));

            return themeMatch && charMatch && envMatch;
        });

        displayContent(filteredData);
    }

    function displayContent(data) {
        if (data.length === 0) {
            bundleSuggestions.innerHTML = '<div class="alert alert-info">No matching content found</div>';
            return;
        }

        bundleSuggestions.innerHTML = `
            <div class="table-responsive">
                <table class="table table-dark table-hover">
                    <thead>
                        <tr>
                            <th>Title</th>
                            <th>Characters</th>
                            <th>Environments</th>
                            <th>Themes</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.map(item => `
                            <tr>
                                <td>${item.title || 'Untitled'}</td>
                                <td>${(item.speaking_characters || []).join(', ') || 'None'}</td>
                                <td>${(item.environments || []).join(', ') || 'None'}</td>
                                <td>${(item.themes || []).join(', ') || 'None'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    // Initialize when bundle tab is shown
    const bundleTab = document.getElementById('bundle-tab');
    if (bundleTab) {
        bundleTab.addEventListener('shown.bs.tab', findBundleOpportunities);
    }

    const searchForm = document.getElementById('searchForm');
    const searchResults = document.getElementById('searchResults');
    const characterCheckboxes = document.getElementById('characterCheckboxes');
    const environmentCheckboxes = document.getElementById('environmentCheckboxes');

    // Populate checkboxes when the page loads
    fetch('/api/analyses')
        .then(response => response.json())
        .then(data => {
            const characters = new Set();
            const environments = new Set();

            data.forEach(analysis => {
                if (analysis.speaking_characters) {
                    analysis.speaking_characters.forEach(char => characters.add(char));
                }
                if (analysis.environments) {
                    analysis.environments.forEach(env => environments.add(env));
                }
            });

            characters.forEach(character => {
                const div = document.createElement('div');
                div.className = 'form-check form-check-inline';
                div.innerHTML = `
                    <input class="form-check-input" type="checkbox" name="characters" value="${character}" id="char-${character}">
                    <label class="form-check-label" for="char-${character}">${character}</label>
                `;
                characterCheckboxes.appendChild(div);
            });

            environments.forEach(environment => {
                const div = document.createElement('div');
                div.className = 'form-check form-check-inline';
                div.innerHTML = `
                    <input class="form-check-input" type="checkbox" name="environments" value="${environment}" id="env-${environment}">
                    <label class="form-check-label" for="env-${environment}">${environment}</label>
                `;
                environmentCheckboxes.appendChild(div);
            });
        })
        .catch(error => console.error('Error fetching data:', error));

    // Handle form submission
    searchForm.addEventListener('submit', function(e) {
        e.preventDefault();

        const formData = new FormData(searchForm);
        const selectedCharacters = formData.getAll('characters');
        const selectedEnvironments = formData.getAll('environments');

        fetch('/api/analyses')
            .then(response => response.json())
            .then(data => {
                const filteredResults = data.filter(analysis => {
                    const characterMatch = selectedCharacters.length === 0 ||
                        (analysis.speaking_characters &&
                            selectedCharacters.some(char => analysis.speaking_characters.includes(char)));

                    const environmentMatch = selectedEnvironments.length === 0 ||
                        (analysis.environments &&
                            selectedEnvironments.some(env => analysis.environments.includes(env)));

                    return characterMatch && environmentMatch;
                });

                displayResults(filteredResults);
            })
            .catch(error => console.error('Error searching:', error));
    });

    function displayResults(results) {
        if (results.length === 0) {
            searchResults.innerHTML = '<div class="alert alert-info">No matches found</div>';
            return;
        }

        const html = `
            <div class="table-responsive">
                <table class="table table-dark table-hover">
                    <thead>
                        <tr>
                            <th>Title</th>
                            <th>Characters</th>
                            <th>Environments</th>
                            <th>Themes</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${results.map(result => `
                            <tr>
                                <td>${result.title || 'Untitled'}</td>
                                <td>${(result.speaking_characters || []).join(', ') || 'None'}</td>
                                <td>${(result.environments || []).join(', ') || 'None'}</td>
                                <td>${(result.themes || []).join(', ') || 'None'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        searchResults.innerHTML = html;
    }
});