document.addEventListener('DOMContentLoaded', function() {
    const searchForm = document.getElementById('searchForm');
    const themeInput = document.getElementById('themeSearch');
    const characterInput = document.getElementById('characterSearch');
    const environmentInput = document.getElementById('environmentSearch');
    const searchResults = document.getElementById('searchResults');

    searchForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        const criteria = {
            themes: themeInput.value.split(',').map(t => t.trim()).filter(t => t),
            characters: characterInput.value.split(',').map(c => c.trim()).filter(c => c),
            environments: environmentInput.value.split(',').map(e => e.trim()).filter(e => e)
        };

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

            if (results.length === 0) {
                searchResults.innerHTML = `<tr><td colspan="5" class="text-center">No results found</td></tr>`;
                return;
            }

            searchResults.innerHTML = results.map(result => `
                <tr>
                    <td>${result.filename || '-'}</td>
                    <td>${result.format || '-'}</td>
                    <td>${(result.characters || []).join(', ') || '-'}</td>
                    <td>${(result.themes || []).join(', ') || '-'}</td>
                    <td>${(result.environments || []).join(', ') || '-'}</td>
                </tr>
            `).join('');

        } catch (error) {
            console.error('Search error:', error);
            searchResults.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Error performing search</td></tr>`;
        }
    });
});