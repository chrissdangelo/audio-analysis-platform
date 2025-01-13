document.addEventListener('DOMContentLoaded', function() {
    const bundleSuggestions = document.getElementById('bundleSuggestions');

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

            // Group by environments with emotional context
            const environmentGroups = groupByCommonality(analyses, 'environments', 'emotion_scores');

            displayBundleSuggestions(themeGroups, characterGroups, emotionGroups, environmentGroups);

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

        analyses.forEach(analysis => {
            const characters = analysis.speaking_characters || [];

            // Create pairs of characters that appear together
            for (let i = 0; i < characters.length; i++) {
                for (let j = i + 1; j < characters.length; j++) {
                    const pair = [characters[i], characters[j]].sort().join(' & ');
                    if (!characterPairs.has(pair)) {
                        characterPairs.set(pair, []);
                    }
                    characterPairs.get(pair).push(analysis);
                }
            }
        });

        return Array.from(characterPairs.entries())
            .filter(([_, items]) => items.length > 1)
            .map(([pair, items]) => ({
                commonality: pair,
                items: items,
                count: items.length
            }))
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

    function displayBundleSuggestions(themeGroups, characterGroups, emotionGroups, environmentGroups) {
        let html = '';

        // Emotion-based bundles
        if (emotionGroups.length > 0) {
            html += createBundleSection('Emotional Journeys', emotionGroups, 'emotion');
        }

        // Theme-based bundles
        if (themeGroups.length > 0) {
            html += createBundleSection('Theme-based Collections', themeGroups, 'theme');
        }

        // Character-based bundles
        if (characterGroups.length > 0) {
            html += createBundleSection('Character Adventures', characterGroups, 'character');
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
                ${groups.slice(0, 5).map(group => {
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
    bundleTab.addEventListener('shown.bs.tab', findBundleOpportunities);
});