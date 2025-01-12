document.addEventListener('DOMContentLoaded', function() {
    const searchForm = document.getElementById('searchForm');
    const resultsTable = document.getElementById('searchResults');
    
    searchForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const criteria = {
            themes: document.getElementById('themeSearch').value.split(',').map(s => s.trim()).filter(s => s),
            characters: document.getElementById('characterSearch').value.split(',').map(s => s.trim()).filter(s => s),
            environments: document.getElementById('environmentSearch').value.split(',').map(s => s.trim()).filter(s => s)
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
            displaySearchResults(results);
            
        } catch (error) {
            console.error('Error:', error);
            alert('Error performing search');
        }
    });
    
    function displaySearchResults(results) {
        if (results.length === 0) {
            resultsTable.innerHTML = '<tr><td colspan="5" class="text-center">No results found</td></tr>';
            return;
        }
        
        resultsTable.innerHTML = results.map(result => `
            <tr>
                <td>${result.filename}</td>
                <td>${result.format}</td>
                <td>${result.characters_mentioned.join(', ')}</td>
                <td>${result.themes.join(', ')}</td>
                <td>${result.environments.join(', ')}</td>
            </tr>
        `).join('');
    }
});
