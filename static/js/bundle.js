document.addEventListener('DOMContentLoaded', function() {
    const bundleSuggestions = document.getElementById('bundleSuggestions');
    
    function updateTable(data) {
        try {
            if ($.fn.DataTable.isDataTable('#analysisTable')) {
                $('#analysisTable').DataTable().destroy();
            }
            
            const tbody = $('#analysisTable tbody');
            tbody.empty();
            
            data.forEach(analysis => {
                const row = `
                    <tr data-id="${analysis.id}">
                        <td>${analysis.id}</td>
                        <td>${analysis.title || "Untitled"}</td>
                        <td>${analysis.filename}</td>
                        <td>${analysis.file_type}</td>
                        <td>${analysis.format}</td>
                        <td>${analysis.duration}</td>
                        <td>${analysis.environments?.join(', ') || '-'}</td>
                        <td>${analysis.characters_mentioned?.join(', ') || '-'}</td>
                        <td>${analysis.speaking_characters?.join(', ') || '-'}</td>
                        <td>${analysis.has_underscore ? "Yes" : "No"}</td>
                        <td>${analysis.has_sound_effects ? "Yes" : "No"}</td>
                        <td>${analysis.songs_count}</td>
                        <td>${analysis.themes?.join(', ') || '-'}</td>
                        <td>
                            <a href="/debug_analysis/${analysis.id}" class="btn btn-sm btn-info mb-1">Info</a>
                            <button class="btn btn-sm btn-danger delete-btn" data-id="${analysis.id}">Delete</button>
                        </td>
                    </tr>
                `;
                tbody.append(row);
            });
            
            $('#analysisTable').DataTable({
                colReorder: true,
                pageLength: 25
            });
        } catch (error) {
            console.error("Error updating table:", error);
        }
    }

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

            // Group by themes with emotion context
            const themeGroups = groupByCommonality(analyses, 'themes', 'emotion_scores');

            // Group by characters with interaction context
            const characterGroups = groupByCharacterInteractions(analyses);

            // Group by emotional patterns
            const emotionGroups = groupByEmotions(analyses);

            // Group by emotional arcs (stories that follow similar emotional progressions)
            const emotionalArcGroups = groupByEmotionalArcs(analyses);

            // Group by environments with emotional context
            const environmentGroups = groupByCommonality(analyses, 'environments', 'emotion_scores');

            // Group by character dynamics (recurring character relationships)
            const characterDynamicsGroups = groupByCharacterDynamics(analyses);

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

    function groupByEmotions(analyses) {
        const emotionGroups = [];
        const emotions = ['joy', 'sadness', 'anger', 'fear', 'surprise'];

        emotions.forEach(emotion => {
            const matchingAnalyses = analyses.filter(analysis => {
                const scores = analysis.emotion_scores || {};
                return scores[emotion] && scores[emotion] > 0.6; // High emotion threshold
            });

            if (matchingAnalyses.length > 1) {
                // Group by series
                const seriesGroups = new Map();
                matchingAnalyses.forEach(item => {
                    const series = item.filename.split('_')[0];
                    if (!seriesGroups.has(series)) {
                        seriesGroups.set(series, []);
                    }
                    seriesGroups.get(series).push(item);
                });

                // Take max 2 from each series
                let diverseItems = [];
                seriesGroups.forEach(seriesItems => {
                    diverseItems.push(...seriesItems.slice(0, 2));
                });

                // Sort by emotion score
                diverseItems.sort((a, b) => (b.emotion_scores?.[emotion] || 0) - (a.emotion_scores?.[emotion] || 0));

                emotionGroups.push({
                    commonality: emotion,
                    items: diverseItems,
                    count: matchingAnalyses.length,
                    averageScore: diverseItems.reduce((acc, curr) => 
                        acc + (curr.emotion_scores?.[emotion] || 0), 0) / diverseItems.length
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
                // Group by series
                const seriesGroups = new Map();
                items.forEach(item => {
                    const series = item.filename.split('_')[0];
                    if (!seriesGroups.has(series)) {
                        seriesGroups.set(series, []);
                    }
                    seriesGroups.get(series).push(item);
                });

                // Take max 2 from each series
                let diverseItems = [];
                seriesGroups.forEach(seriesItems => {
                    diverseItems.push(...seriesItems.slice(0, 2));
                });

                const emotions = characterEmotions.get(pair);
                const dominantEmotion = Array.from(emotions?.entries() || [])
                    .sort((a, b) => b[1] - a[1])[0]?.[0];
                return {
                    commonality: pair,
                    items: diverseItems,
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

            const minTitles = parseInt(document.getElementById('minTitles')?.value || '2');
            let result = Array.from(groups.entries())
                .filter(([_, items]) => items.length === minTitles)
                .map(([key, items]) => {
                    // Group by series (first part of filename before underscore)
                    const seriesGroups = new Map();
                    items.forEach(item => {
                        const series = item.filename.split('_')[0];
                        if (!seriesGroups.has(series)) {
                            seriesGroups.set(series, []);
                        }
                        seriesGroups.get(series).push(item);
                    });

                    // Ensure diversity by taking max 2 items from each series
                    let diverseItems = [];
                    seriesGroups.forEach(seriesItems => {
                        diverseItems.push(...seriesItems.slice(0, 2));
                    });

                    // Sort by confidence score if available
                    diverseItems.sort((a, b) => (b.confidence_score || 0) - (a.confidence_score || 0));

                    return {
                        commonality: key,
                        items: diverseItems,
                        count: items.length,
                        emotionalContext: emotionField ? getEmotionalContext(items) : null
                    };
                });

            // Filter groups to only show those with the minimum number of items
            const minSize = Math.min(...result.map(group => group.items.length));
            result = result.filter(group => group.items.length === minSize);

            return result.sort((a, b) => b.count - a.count);

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
        let html = '';

        // Emotion-based bundles
        if (emotionGroups.length > 0) {
            html += createBundleSection('Emotional Journeys', emotionGroups, 'emotion');
        }

        // Character Dynamics
        if (characterDynamicsGroups.length > 0) {
            html += createBundleSection('Character Spotlights', characterDynamicsGroups, 'character');
        }

        // Character Interactions
        if (characterGroups.length > 0) {
            html += createBundleSection('Dynamic Duos', characterGroups, 'character');
        }

        // Emotional Arcs
        if (emotionalArcGroups.length > 0) {
            html += createBundleSection('Emotional Story Arcs', emotionalArcGroups, 'emotion');
        }

        // Theme-based bundles
        if (themeGroups.length > 0) {
            html += createBundleSection('Theme-based Collections', themeGroups, 'theme');
        }

        // Environment-based bundles
        if (environmentGroups.length > 0) {
            html += createBundleSection('Magical Realms', environmentGroups, 'environment');
        }

        if (!html) {
            html = '<div class="col-12"><div class="alert alert-info">No bundle opportunities found</div></div>';
        }

        bundleSuggestions.innerHTML = html;

        // Initialize tooltips
        const tooltips = document.querySelectorAll('[data-bs-toggle="tooltip"]');
        tooltips.forEach(tooltip => new bootstrap.Tooltip(tooltip));
    }

    function createBundleSection(title, groups, type) {
        return `
            <div class="col-12 mb-4">
                <h6 class="mb-3">${title}</h6>
                ${groups.map(group => {
                    const bundleTitle = generateBundleTitle(type, group.commonality, group.emotionalContext);
                    const elevatorPitch = generateElevatorPitch(
                        type, 
                        group.commonality, 
                        group.count, 
                        group.items,
                        group.emotionalContext
                    );

                    return `
                    <div class="card mb-3">
                        <div class="card-header" role="button" data-bs-toggle="collapse" 
                             data-bs-target="#bundle-${type}-${group.commonality.replace(/\s+/g, '-')}"
                             aria-expanded="false">
                            <div class="d-flex justify-content-between align-items-center">
                                <h5 class="mb-0">
                                    ${bundleTitle}
                                    <i class="bi bi-chevron-down ms-2"></i>
                                </h5>
                                <span class="badge bg-primary">${group.items.length} stories</span>
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
    bundleTab.addEventListener('shown.bs.tab', findBundleOpportunities);

    // Update bundles when minimum titles changes
    document.getElementById('minTitles')?.addEventListener('change', findBundleOpportunities);
});