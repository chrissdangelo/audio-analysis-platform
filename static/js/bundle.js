document.addEventListener('DOMContentLoaded', function() {
    const bundleSuggestions = document.getElementById('bundleSuggestions');
    const themesContainer = document.getElementById('themesContainer');
    const charactersContainer = document.getElementById('charactersContainer');
    const environmentsContainer = document.getElementById('environmentsContainer');

    async function findBundleOpportunities() {
        try {
            const response = await fetch('/api/analyses');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const analyses = await response.json();

            if (!Array.isArray(analyses)) {
                throw new Error('Expected analyses to be an array');
            }

            if (analyses.length === 0) {
                bundleSuggestions.innerHTML = '<div class="col-12"><div class="alert alert-info">No content available for bundle analysis</div></div>';
                return;
            }

            // Extract all unique themes, characters, and environments
            const uniqueThemes = new Set();
            const uniqueCharacters = new Set();
            const uniqueEnvironments = new Set();

            analyses.forEach(analysis => {
                if (analysis.themes) analysis.themes.forEach(theme => uniqueThemes.add(theme));
                if (analysis.speaking_characters) analysis.speaking_characters.forEach(char => uniqueCharacters.add(char));
                if (analysis.environments) analysis.environments.forEach(env => uniqueEnvironments.add(env));
            });

            // Group by themes with emotion context
            const themeGroups = groupByCommonality(analyses, 'themes', 'emotion_scores');
            const characterGroups = groupByCharacterInteractions(analyses);
            const emotionGroups = groupByEmotions(analyses);
            const emotionalArcGroups = groupByEmotionalArcs(analyses);
            const environmentGroups = groupByCommonality(analyses, 'environments', 'emotion_scores');
            const characterDynamicsGroups = groupByCharacterDynamics(analyses);

            // Update dropdowns
            updateFilterDropdowns(Array.from(uniqueThemes), Array.from(uniqueCharacters), Array.from(uniqueEnvironments));

            displayBundleSuggestions(themeGroups, characterGroups, emotionGroups, environmentGroups, emotionalArcGroups, characterDynamicsGroups);
        } catch (error) {
            console.error('Error finding bundle opportunities:', error);
            bundleSuggestions.innerHTML = `
                <div class="col-12">
                    <div class="alert alert-danger">
                        <h5 class="alert-heading">Error analyzing bundle opportunities</h5>
                        <p>${error.message}</p>
                    </div>
                </div>`;
        }
    }

    function updateFilterDropdowns(themes, characters, environments) {
        // Update themes dropdown
        themesContainer.innerHTML = themes.map(theme => `
            <div class="form-check">
                <input class="form-check-input" type="checkbox" value="${theme}" id="theme-${theme}">
                <label class="form-check-label" for="theme-${theme}">${theme}</label>
            </div>
        `).join('');

        // Update characters dropdown
        charactersContainer.innerHTML = characters.map(char => `
            <div class="form-check">
                <input class="form-check-input" type="checkbox" value="${char}" id="char-${char}">
                <label class="form-check-label" for="char-${char}">${char}</label>
            </div>
        `).join('');

        // Update environments dropdown
        environmentsContainer.innerHTML = environments.map(env => `
            <div class="form-check">
                <input class="form-check-input" type="checkbox" value="${env}" id="env-${env}">
                <label class="form-check-label" for="env-${env}">${env}</label>
            </div>
        `).join('');

        // Add event listeners for filtering
        document.querySelectorAll('.form-check-input').forEach(checkbox => {
            checkbox.addEventListener('change', filterBundles);
        });
    }

    function filterBundles() {
        const selectedThemes = Array.from(document.querySelectorAll('#themesContainer input:checked')).map(cb => cb.value);
        const selectedCharacters = Array.from(document.querySelectorAll('#charactersContainer input:checked')).map(cb => cb.value);
        const selectedEnvironments = Array.from(document.querySelectorAll('#environmentsContainer input:checked')).map(cb => cb.value);

        document.querySelectorAll('.bundle-card').forEach(card => {
            const themes = card.dataset.themes?.split(',') || [];
            const characters = card.dataset.characters?.split(',') || [];
            const environments = card.dataset.environments?.split(',') || [];

            const themeMatch = selectedThemes.length === 0 || themes.some(t => selectedThemes.includes(t));
            const characterMatch = selectedCharacters.length === 0 || characters.some(c => selectedCharacters.includes(c));
            const environmentMatch = selectedEnvironments.length === 0 || environments.some(e => selectedEnvironments.includes(e));

            card.style.display = (themeMatch && characterMatch && environmentMatch) ? 'block' : 'none';
        });
    }

    function groupByEmotions(analyses) {
        const emotionGroups = [];
        const emotions = ['joy', 'sadness', 'anger', 'fear', 'surprise'];

        emotions.forEach(emotion => {
            const matchingAnalyses = analyses.filter(analysis => {
                const scores = analysis.emotion_scores || {};
                return scores[emotion] && scores[emotion] > 0.6; // High emotion threshold
            });

            if (matchingAnalyses.length > 1) {
                emotionGroups.push({
                    commonality: emotion,
                    items: matchingAnalyses,
                    count: matchingAnalyses.length,
                    averageScore: matchingAnalyses.reduce((acc, curr) =>
                        acc + (curr.emotion_scores?.[emotion] || 0), 0) / matchingAnalyses.length
                });
            }
        });

        return emotionGroups.sort((a, b) => b.averageScore - a.averageScore);
    }

    function groupByCharacterInteractions(analyses) {
        const characterPairs = new Map();
        const characterEmotions = new Map();

        analyses.forEach(analysis => {
            const characters = analysis.speaking_characters || [];
            const emotion = analysis.dominant_emotion;

            // Track character pairs and their emotional context
            for (let i = 0; i < characters.length; i++) {
                for (let j = i + 1; j < characters.length; j++) {
                    const pair = [characters[i], characters[j]].sort().join(' & ');
                    if (!characterPairs.has(pair)) {
                        characterPairs.set(pair, []);
                        characterEmotions.set(pair, new Map());
                    }
                    characterPairs.get(pair).push(analysis);
                    if (emotion) {
                        const emotions = characterEmotions.get(pair);
                        emotions.set(emotion, (emotions.get(emotion) || 0) + 1);
                    }
                }
            }
        });

        return Array.from(characterPairs.entries())
            .filter(([_, items]) => items.length > 1)
            .map(([pair, items]) => {
                const emotions = characterEmotions.get(pair);
                const dominantEmotion = Array.from(emotions?.entries() || [])
                    .sort((a, b) => b[1] - a[1])[0]?.[0];
                return {
                    commonality: pair,
                    items: items,
                    count: items.length,
                    emotionalContext: dominantEmotion ? { dominant: dominantEmotion } : null
                };
            })
            .sort((a, b) => b.count - a.count);
    }

    function groupByEmotionalArcs(analyses) {
        const arcPatterns = new Map();

        analyses.forEach(analysis => {
            if (!analysis.emotion_scores) return;

            const scores = analysis.emotion_scores;
            const dominantEmotions = Object.entries(scores)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 2)
                .map(([emotion]) => emotion)
                .join(' to ');

            if (!arcPatterns.has(dominantEmotions)) {
                arcPatterns.set(dominantEmotions, []);
            }
            arcPatterns.get(dominantEmotions).push(analysis);
        });

        return Array.from(arcPatterns.entries())
            .filter(([_, items]) => items.length > 1)
            .map(([arc, items]) => ({
                commonality: arc,
                items: items,
                count: items.length,
                emotionalContext: {
                    dominant: arc.split(' to ')[0]
                }
            }))
            .sort((a, b) => b.count - a.count);
    }

    function groupByCharacterDynamics(analyses) {
        const dynamics = new Map();

        analyses.forEach(analysis => {
            const characters = analysis.speaking_characters || [];
            const emotion = analysis.dominant_emotion;

            characters.forEach(char => {
                if (!dynamics.has(char)) {
                    dynamics.set(char, { stories: [], emotions: new Map() });
                }
                dynamics.get(char).stories.push(analysis);
                if (emotion) {
                    const emotions = dynamics.get(char).emotions;
                    emotions.set(emotion, (emotions.get(emotion) || 0) + 1);
                }
            });
        });

        return Array.from(dynamics.entries())
            .filter(([_, data]) => data.stories.length > 1)
            .map(([character, data]) => {
                const dominantEmotion = Array.from(data.emotions.entries())
                    .sort((a, b) => b[1] - a[1])[0]?.[0];
                return {
                    commonality: character,
                    items: data.stories,
                    count: data.stories.length,
                    emotionalContext: dominantEmotion ? { dominant: dominantEmotion } : null
                };
            })
            .sort((a, b) => b.count - a.count);
    }

    function groupByCommonality(analyses, field, emotionField = null) {
        try {
            const groups = new Map();

            analyses.forEach(analysis => {
                let items = analysis[field] || [];
                if (!Array.isArray(items)) {
                    items = [items].filter(Boolean);
                }

                items.forEach(item => {
                    if (!item) return;
                    const key = item.toString().trim();
                    if (!key) return;

                    if (!groups.has(key)) {
                        groups.set(key, []);
                    }
                    groups.get(key).push(analysis);
                });
            });

            return Array.from(groups.entries())
                .filter(([_, items]) => items.length > 1)
                .map(([key, items]) => ({
                    commonality: key,
                    items: items,
                    count: items.length,
                    emotionalContext: emotionField ? getEmotionalContext(items) : null
                }))
                .sort((a, b) => b.count - a.count);

        } catch (error) {
            console.error('Error in groupByCommonality:', error);
            return [];
        }
    }

    function getEmotionalContext(items) {
        const emotionTotals = {
            joy: 0, sadness: 0, anger: 0, fear: 0, surprise: 0
        };
        let count = 0;

        items.forEach(item => {
            if (item.emotion_scores) {
                count++;
                Object.entries(item.emotion_scores).forEach(([emotion, score]) => {
                    emotionTotals[emotion] = (emotionTotals[emotion] || 0) + score;
                });
            }
        });

        if (count === 0) return null;

        const dominantEmotion = Object.entries(emotionTotals)
            .sort((a, b) => b[1] - a[1])[0];

        return {
            dominant: dominantEmotion[0],
            score: dominantEmotion[1] / count
        };
    }

    function generateBundleTitle(type, commonality, emotionalContext = null) {
        const emotions = {
            joy: ['✨', '🌟', '💫'],
            sadness: ['💫', '🌙', '✨'],
            anger: ['⚡', '🔥', '💥'],
            fear: ['🌘', '💫', '✨'],
            surprise: ['✨', '🌟', '💫']
        };

        const getEmoji = () => {
            if (emotionalContext?.dominant && emotions[emotionalContext.dominant]) {
                const emojis = emotions[emotionalContext.dominant];
                return emojis[Math.floor(Math.random() * emojis.length)];
            }
            return '✨';
        };

        const titles = {
            theme: [
                `${getEmoji()} Tales of ${commonality}: Where Magic Begins`,
                `${getEmoji()} The ${commonality} Chronicles: Untold Wonders`,
                `${getEmoji()} Once Upon a ${commonality}`
            ],
            character: [
                `${getEmoji()} ${commonality}'s Epic Adventures`,
                `${getEmoji()} ${commonality}: Legend in the Making`,
                `${getEmoji()} The ${commonality} Saga`
            ],
            emotion: [
                `${getEmoji()} Journey through ${commonality}`,
                `${getEmoji()} Tales of ${commonality}`,
                `${getEmoji()} Moments of ${commonality}`
            ],
            environment: [
                `${getEmoji()} Secrets of the ${commonality}`,
                `${getEmoji()} ${commonality}: A World of Wonder`,
                `${getEmoji()} Hidden Tales of the ${commonality}`
            ]
        };

        const options = titles[type] || titles.theme;
        return options[Math.floor(Math.random() * options.length)];
    }

    function generateElevatorPitch(type, commonality, count, items, emotionalContext = null) {
        const examples = items
            .slice(0, 3)
            .map(item => item.title || 'Untitled')
            .filter(title => title !== 'Untitled');

        const emotions = items
            .filter(item => item.dominant_emotion)
            .map(item => item.dominant_emotion)
            .reduce((acc, emotion) => {
                acc[emotion] = (acc[emotion] || 0) + 1;
                return acc;
            }, {});

        const dominantEmotion = Object.entries(emotions)
            .sort((a, b) => b[1] - a[1])[0]?.[0];

        const emotionDescriptor = dominantEmotion ?
            `${dominantEmotion}-filled` : 'enchanting';

        const pitches = {
            theme: [
                `${getEmoji(emotionalContext)} Experience ${count} ${emotionDescriptor} tales celebrating "${commonality}"! From "${examples[0]}"${examples[1] ? ` to "${examples[1]}"` : ''}, each story weaves a unique perspective on this timeless theme.`,
                `${getEmoji(emotionalContext)} Discover a collection of ${count} ${emotionDescriptor} adventures exploring "${commonality}". Journey from "${examples[0]}"${examples[1] ? ` through "${examples[1]}"` : ''}, where every story adds depth to the theme.`
            ],
            character: [
                `${getEmoji(emotionalContext)} Follow ${commonality} through ${count} ${emotionDescriptor} quests! From "${examples[0]}"${examples[1] ? ` to "${examples[1]}"` : ''}, witness their growth and adventures.`,
                `${getEmoji(emotionalContext)} Join ${commonality} in ${count} ${emotionDescriptor} tales, starting with "${examples[0]}"${examples[1] ? ` and continuing through "${examples[1]}"` : ''}.`
            ],
            emotion: [
                `${getEmoji(emotionalContext)} Immerse yourself in ${count} stories flowing with ${commonality}. Experience "${examples[0]}"${examples[1] ? ` and "${examples[1]}"` : ''} in this emotional journey.`,
                `${getEmoji(emotionalContext)} Explore the depths of ${commonality} through ${count} moving tales, including "${examples[0]}"${examples[1] ? ` and "${examples[1]}"` : ''}.`
            ],
            environment: [
                `${getEmoji(emotionalContext)} Venture into ${count} ${emotionDescriptor} stories set in the ${commonality}. Begin with "${examples[0]}"${examples[1] ? ` and journey to "${examples[1]}"` : ''}.`,
                `${getEmoji(emotionalContext)} Explore the magical ${commonality} through ${count} ${emotionDescriptor} adventures, featuring "${examples[0]}"${examples[1] ? ` and "${examples[1]}"` : ''}.`
            ]
        };

        const options = pitches[type] || pitches.theme;
        return options[Math.floor(Math.random() * options.length)];
    }

    function getEmoji(emotionalContext) {
        const emojis = {
            joy: '✨',
            sadness: '💫',
            anger: '⚡',
            fear: '🌘',
            surprise: '🌟'
        };
        return emotionalContext?.dominant ?
            (emojis[emotionalContext.dominant] || '✨') : '✨';
    }

    function displayBundleSuggestions(themeGroups, characterGroups, emotionGroups, environmentGroups, emotionalArcGroups, characterDynamicsGroups) {
        let html = '<div class="row g-4">';

        // Emotional Journeys Section
        if (emotionGroups.length > 0) {
            html += createBundleSection('Emotional Journeys', emotionGroups, 'emotion');
        }

        // Character Dynamics Section
        if (characterDynamicsGroups.length > 0) {
            html += createBundleSection('Character Arcs', characterDynamicsGroups, 'character');
        }

        // Theme-based Collections
        if (themeGroups.length > 0) {
            html += createBundleSection('Theme Collections', themeGroups, 'theme');
        }

        // Environment-based Collections
        if (environmentGroups.length > 0) {
            html += createBundleSection('Setting Collections', environmentGroups, 'environment');
        }

        html += '</div>';
        bundleSuggestions.innerHTML = html;
    }

    function createBundleSection(title, groups, type) {
        return `
            <div class="col-12 mb-4">
                <h6 class="mb-3">${title}</h6>
                ${groups.slice(0, 5).map(group => {
            const bundleTitle = generateBundleTitle(type, group.commonality, group.emotionalContext);
            const elevatorPitch = generateElevatorPitch(
                type,
                group.commonality,
                group.count,
                group.items,
                group.emotionalContext
            );
            const themes = group.items.map(item => item.themes).flat().filter(Boolean).join(',');
            const characters = group.items.map(item => item.speaking_characters).flat().filter(Boolean).join(',');
            const environments = group.items.map(item => item.environments).flat().filter(Boolean).join(',');

            return `
                    <div class="card mb-3 bundle-card" data-themes="${themes}" data-characters="${characters}" data-environments="${environments}">
                        <div class="card-header" role="button" data-bs-toggle="collapse"
                             data-bs-target="#bundle-${type}-${group.commonality.replace(/\s+/g, '-')}"
                             aria-expanded="false">
                            <div class="d-flex justify-content-between align-items-center">
                                <h5 class="mb-0">
                                    ${bundleTitle}
                                    <i class="bi bi-chevron-down ms-2"></i>
                                </h5>
                                <span class="badge bg-primary">${group.count} stories</span>
                            </div>
                            <p class="card-text text-muted mb-0 mt-2">${elevatorPitch}</p>
                            <div class="mt-2">
                                ${group.emotionalContext ?
                    `<span class="badge bg-info me-2">
                                        Mood: ${group.emotionalContext.dominant}
                                    </span>` : ''}
                                <span class="badge bg-secondary">
                                    ${type}: ${group.commonality}
                                </span>
                            </div>
                        </div>
                        <div class="collapse" id="bundle-${type}-${group.commonality.replace(/\s+/g, '-')}">
                            <div class="card-body">
                                <div class="list-group list-group-flush">
                                    ${group.items.map(item => `
                                        <div class="list-group-item">
                                            <div class="d-flex justify-content-between align-items-center">
                                                <span>${item.title || 'Untitled'}</span>
                                                ${item.emotion_scores ? `
                                                    <span class="badge bg-info">
                                                        ${item.dominant_emotion || 'Neutral'}
                                                    </span>
                                                ` : ''}
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        </div>
                    </div>
                    `}).join('')}
            </div>
        `;
    }

    // Load bundle opportunities when the bundle tab is shown
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