import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { 
    getAuth,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { 
    getDatabase,
    ref, 
    set, 
    get, 
    push, 
    query, 
    orderByChild, 
    equalTo,
    onValue,
    update,
    remove,
    limitToLast
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js";

class EnhancedChatbot {
    constructor() {
        // Firebase configuration
        this.firebaseConfig = {
            apiKey: "AIzaSyAToB2gXmzCK4t-1dW5urnGG87gbK6MxR8",
            authDomain: "dupuis-lol.firebaseapp.com",
            databaseURL: "https://dupuis-lol-default-rtdb.firebaseio.com",
            projectId: "dupuis-lol",
            storageBucket: "dupuis-lol.appspot.com",
            messagingSenderId: "807402660080",
            appId: "1:807402660080:web:545d4e1287f5803ebda235",
            measurementId: "G-TR8JMF5FRY"
        };

        // Enhanced LSTM configuration with improved architecture
        this.net = new brain.recurrent.LSTM({
            hiddenLayers: [512, 256, 128], // Deeper network
            learningRate: 0.003,
            activation: 'leaky-relu',
            errorThresh: 0.0005,
            momentum: 0.95,
            beta1: 0.9,
            beta2: 0.999,
            dropout: 0.1 // Added dropout for better generalization
        });

        // System state
        this.isInitialized = false;
        this.isTraining = false;
        this.userId = null;
        this.userProfile = null;

        // Enhanced memory management
        this.contextWindow = [];
        this.maxContextLength = 15; // Increased context window
        this.conversationMemory = new Map();
        this.knowledgeBase = new Map();
        this.webData = new Map();

        // Timing and rate limiting
        this.lastTrainingTime = null;
        this.trainingInterval = 1800000; // 30 minutes
        this.lastScrapingTime = null;
        this.scrapingInterval = 3600000; // 1 hour
        this.requestQueue = [];
        this.maxConcurrentRequests = 3;

        // Training monitoring
        this.trainingLogElement = null;
        this.trainingStats = {
            iterations: 1,
            errorHistory: [],
            startTime: null,
            endTime: null
        };

        // Initialize components
        this.initializeApp();
    }

    async initializeApp() {
        try {
            const app = initializeApp(this.firebaseConfig);
            this.auth = getAuth(app);
            this.database = getDatabase(app);
            
            // Initialize UI and event listeners after DOM loads
            window.addEventListener('DOMContentLoaded', () => {
                this.initializeElements();
                this.initialize().catch(this.handleError.bind(this));
            });

            // Setup training log
            this.setupTrainingLog();
            
            // Initialize advanced features
            await this.initializeAdvancedFeatures();
        } catch (error) {
            console.error('Initialization error:', error);
            this.handleError(error);
        }
    }

    async initializeAdvancedFeatures() {
        // Initialize advanced ML features
        await this.initializeNLP();
        await this.initializeEntityRecognition();
        await this.initializeSentimentAnalysis();
        
        // Setup periodic tasks
        this.setupPeriodicTraining();
        this.setupPeriodicDataCollection();
    }

    initializeElements() {
        // Enhanced UI elements initialization
        this.elements = {
            userInput: document.getElementById('userInput'),
            sendBtn: document.getElementById('sendBtn'),
            chatWindow: document.getElementById('chatWindow'),
            typingIndicator: document.querySelector('.typing-indicator'),
            status: document.getElementById('status'),
            clearBtn: document.getElementById('clearBtn'),
            trainingProgress: document.getElementById('trainingProgress'),
            confidenceIndicator: document.getElementById('confidenceIndicator')
        };

        // Validate all elements exist
        const missingElements = Object.entries(this.elements)
            .filter(([key, value]) => !value)
            .map(([key]) => key);

        if (missingElements.length > 0) {
            throw new Error(`Missing DOM elements: ${missingElements.join(', ')}`);
        }

        // Initialize advanced UI features
        this.initializeAdvancedUI();
    }

    async initialize() {
        try {
            this.updateStatus('Initializing...', 'loading');
            
            // Enhanced initialization sequence with timeouts and error handling
            await this.initializeWithTimeout(this.initializeFirebase, 'Firebase initialization');
            await this.initializeWithTimeout(this.loadUserProfile, 'User profile loading');
            await this.initializeWithTimeout(this.loadTrainingData, 'Training data loading');
            await this.initializeWithTimeout(this.enhancedTraining, 'Model training');
            await this.initializeWithTimeout(this.initialWebScrape, 'Initial web scrape');
            
            // Initialize advanced features
            await this.initializeWithTimeout(this.initializeNLP, 'NLP initialization');
            await this.initializeWithTimeout(this.initializeEntityRecognition, 'Entity recognition initialization');
            await this.initializeWithTimeout(this.initializeSentimentAnalysis, 'Sentiment analysis initialization');
            
            this.isInitialized = true;
            this.updateStatus('Ready to chat!', 'success');
            this.setInterfaceEnabled(true);
            this.setupEventListeners();
            this.loadPreviousConversation();
            
            // Start background processes
            this.startBackgroundProcesses();
        } catch (error) {
            console.error('Initialization failed:', error);
            this.updateStatus('Initialization failed. Please refresh the page.', 'error');
            this.handleError(error);
        }
    }

    async initializeWithTimeout(func, stepName, timeout = 30000) {
        return new Promise(async (resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error(`${stepName} timed out`));
            }, timeout);

            try {
                await func.call(this);
                clearTimeout(timeoutId);
                resolve();
            } catch (error) {
                clearTimeout(timeoutId);
                reject(error);
            }
        });
    }

    handleError(error) {
        console.error('Error during initialization:', error);
        this.updateStatus(`Error: ${error.message}. Please refresh the page.`, 'error');
        // Optionally, implement retry logic or fallback initialization here
    }

    async initializeNLP() {
        // Initialize NLP components
        this.nlp = {
            tokenizer: new natural.WordTokenizer(),
            stemmer: natural.PorterStemmer,
            classifier: new natural.BayesClassifier()
        };

        // Train classifier with initial data
        await this.trainClassifier();
    }

    async initializeEntityRecognition() {
        // Initialize named entity recognition
        this.ner = {
            model: await this.loadNERModel(),
            tags: new Set(['PERSON', 'ORG', 'LOC', 'DATE']),
            cache: new Map()
        };
    }

    async initializeSentimentAnalysis() {
        // Initialize sentiment analysis
        this.sentiment = new natural.SentimentAnalyzer(
            'English', 
            natural.PorterStemmer, 
            'afinn'
        );
    }

    async loadUserProfile() {
        if (!this.userId) return;
        
        const userProfileRef = ref(this.database, `users/${this.userId}/profile`);
        const snapshot = await get(userProfileRef);
        
        if (snapshot.exists()) {
            this.userProfile = snapshot.val();
            await this.enhanceUserProfile();
        } else {
            this.userProfile = await this.createInitialProfile();
            await set(userProfileRef, this.userProfile);
        }
    }

    async enhanceUserProfile() {
        // Analyze user preferences and behavior
        const conversationHistory = await this.getConversationHistory();
        const preferences = this.analyzeUserPreferences(conversationHistory);
        const interactionPatterns = this.analyzeInteractionPatterns(conversationHistory);
        
        // Update profile with enhanced data
        this.userProfile = {
            ...this.userProfile,
            preferences,
            interactionPatterns,
            lastUpdated: Date.now()
        };
        
        // Save enhanced profile
        const userProfileRef = ref(this.database, `users/${this.userId}/profile`);
        await update(userProfileRef, this.userProfile);
    }

    async loadTrainingData() {
        const trainingDataRef = ref(this.database, 'trainingData');
        try {
            const snapshot = await get(trainingDataRef);
            if (snapshot.exists()) {
                this.trainingData = snapshot.val();
                // Enhance training data with metadata
                this.trainingData = this.enhanceTrainingData(this.trainingData);
            } else {
                this.trainingData = await this.createEnhancedTrainingData();
                await set(trainingDataRef, this.trainingData);
            }
        } catch (error) {
            console.error('Error loading training data:', error);
            this.trainingData = await this.createEnhancedTrainingData();
        }
    }

    async enhancedTraining() {
        this.isTraining = true;
        this.trainingStats.startTime = Date.now();
        this.clearTrainingLog();

        try {
            // Prepare enhanced training data
            const baseData = this.trainingData;
            const webData = await this.getEnhancedWebData();
            const userSpecificData = await this.getUserSpecificTrainingData();
            
            const combinedData = [
                ...baseData,
                ...webData,
                ...userSpecificData
            ];

            // Advanced training configuration
            const config = {
                iterations: 1000,
                errorThresh: 0.0005,
                log: stats => this.logTrainingProgress(stats),
                logPeriod: 1,
                learningRate: 0.003,
                momentum: 0.95,
                callback: stats => this.handleTrainingCallback(stats)
            };

            // Perform training with progress monitoring
            await this.trainModelWithProgress(combinedData, config);

            this.trainingStats.endTime = Date.now();
            this.lastTrainingTime = Date.now();
            
            // Save training results
            await this.saveTrainingResults();
            
        } catch (error) {
            console.error('Training error:', error);
            this.logTrainingError(error);
            throw error;
        } finally {
            this.isTraining = false;
        }
    }

    async trainModelWithProgress(data, config) {
        return new Promise((resolve, reject) => {
            try {
                const batchSize = 50;
                let currentBatch = 0;
                const totalBatches = Math.ceil(data.length / batchSize);

                const trainBatch = async () => {
                    if (currentBatch >= totalBatches) {
                        resolve();
                        return;
                    }

                    const start = currentBatch * batchSize;
                    const end = Math.min(start + batchSize, data.length);
                    const batch = data.slice(start, end);

                    await this.net.train(batch, {
                        ...config,
                        iterations: Math.floor(config.iterations / totalBatches),
                        callback: stats => {
                            const progress = (currentBatch / totalBatches) * 100;
                            this.updateTrainingProgress(progress, stats);
                            return config.callback(stats);
                        }
                    });

                    currentBatch++;
                    setTimeout(trainBatch, 0); // Allow UI updates
                };

                trainBatch();
            } catch (error) {
                reject(error);
            }
        });
    }

    async getEnhancedWebData() {
        const topics = new Set();
        
        // Extract topics from conversation history
        const conversations = await this.getConversationHistory();
        conversations.forEach(conv => {
            const extracted = this.extractTopics(conv.userInput);
            extracted.forEach(topic => topics.add(topic));
        });

        // Get Wikipedia data for each topic
        const webData = [];
        for (const topic of topics) {
            const wikiData = await this.fetchWikipediaData(topic);
            if (wikiData) {
                webData.push(...this.generateTrainingPairsFromWiki(wikiData));
            }
        }

        return webData;
    }

    async fetchWikipediaData(topic) {
        // Check cache first
        if (this.webData.has(topic) && 
            Date.now() - this.webData.get(topic).timestamp < this.scrapingInterval) {
            return this.webData.get(topic).data;
        }

        // Rate limiting
        await this.waitForRequestSlot();

        const params = new URLSearchParams({
            action: 'query',
            format: 'json',
            prop: 'extracts|categories|links',
            exintro: 1,
            explaintext: 1,
            exsectionformat: 'wiki',
            cllimit: 10,
            titles: topic,
            origin: '*'
        });

        try {
            const response = await fetch(`https://en.wikipedia.org/w/api.php?${params}`);
            if (!response.ok) throw new Error('Wikipedia API request failed');

            const data = await response.json();
            const pages = data.query.pages;
            const pageId = Object.keys(pages)[0];
            const page = pages[pageId];

            if (page.missing) return null;

            const processedData = {
                title: page.title,
                extract: page.extract,
                categories: page.categories?.map(c => c.title) || [],
                links: page.links?.map(l => l.title) || [],
                summary: this.generateSummary(page.extract),
                timestamp: Date.now()
            };

            // Cache the data
            this.webData.set(topic, {
                data: processedData,
                timestamp: Date.now()
            });

            return processedData;
        } catch (error) {
            console.error(`Error fetching Wikipedia data for ${topic}:`, error);
            return null;
        }
    }

    generateTrainingPairsFromWiki(wikiData) {
        const pairs = [];
        
        // Generate question-answer pairs
        pairs.push({
            input: `what is ${wikiData.title.toLowerCase()}?`,
            output: wikiData.summary
        });

        // Generate context-based pairs
        const sentences = wikiData.extract.split(/[.!?]+/).filter(s => s.trim());
        for (let i = 0; i < sentences.length - 1; i++) {
            pairs.push({
                input: sentences[i].trim(),
                output: sentences[i + 1].trim()
            });
        }

        // Generate category-based pairs
        wikiData.categories.forEach(category => {
            pairs.push({
                input: `what category does ${wikiData.title.toLowerCase()} belong to?`,
                output: `${wikiData.title} is related to ${category.replace('Category:', '')}`
            });
        });

        return pairs;
    }

    async getResponse(userInput) {
        const sanitizedInput = this.preprocessInput(userInput);
        const context = this.buildContext(sanitizedInput);
        
        try {
            // Get base response from neural network
            let response = await this.net.run(context);
            const confidence = this.getResponseConfidence(response);
            
            // Enhance response if confidence is low
            if (confidence < 0.7) {
                response = await this.enhanceResponse(response, userInput);
            }
            
            // Post-process response
            response = await this.postProcessResponse(response, userInput);
            
            // Update conversation history
            this.updateContext(sanitizedInput, response);
            await this.saveConversation(userInput, response);
            
            return response;
        } catch (error) {
            console.error('Error generating response:', error);
            return this.getFailsafeResponse();
        }
    }

    setInterfaceEnabled(enabled) {
        if (this.elements) {
            this.elements.userInput.disabled = !enabled;
            this.elements.sendBtn.disabled = !enabled;
        }
    }

    updateStatus(message, status) {
        if (this.elements && this.elements.status) {
            this.elements.status.textContent = message;
            this.elements.status.className = status;
        }
    }

    async enhanceResponse(baseResponse, userInput) {
        // Extract entities and topics from user input
        const entities = await this.extractEntities(userInput);
        const topics = this.extractTopics(userInput);
        const sentiment = this.analyzeSentiment(userInput);

        // Get relevant Wikipedia data
        const wikiData = await Promise.all(
            topics.map(topic => this.fetchWikipediaData(topic))
        );

        // Combine information
        let enhancedResponse = baseResponse;
        const validWikiData = wikiData.filter(data => data !== null);

        if (validWikiData.length > 0) {
            const relevantInfo = this.selectMostRelevant(validWikiData, userInput);
            enhancedResponse = this.combineResponses(baseResponse, relevantInfo);
        }

        // Adjust response based on sentiment
        enhancedResponse = this.adjustResponseTone(enhancedResponse, sentiment);

        return enhancedResponse;
    }

    async postProcessResponse(response, userInput) {
        // Clean up response
        response = this.cleanResponse(response);

        // Add contextual awareness
        response = this.addContextualAwareness(response, userInput);

        // Format response
        response = this.formatResponse(response);

        return response;
    }

    getResponseConfidence(response) {
        const factors = {
            length: Math.min(response.length / 100, 1) * 0.3,
            complexity: this.analyzeComplexity(response) * 0.3,
            coherence: this.analyzeCoherence(response) * 0.4
        };

        return Object.values(factors).reduce((sum, value) => sum + value, 0);
    }

    analyzeComplexity(response) {
        const sentenceCount = response.split(/[.!?]+/).length;
        const wordCount = response.split(/\s+/).length;
        const avgWordLength = response.length / wordCount;

        return Math.min(
            (sentenceCount / 5) * 0.4 +
            (wordCount / 20) * 0.3 +
            (avgWordLength / 5) * 0.3,
            1
        );
    }

    analyzeCoherence(response) {
        // Check for logical connectors
        const logicalConnectors = ['because', 'therefore', 'however', 'moreover', 'furthermore'];
        const hasConnectors = logicalConnectors.some(connector => 
            response.toLowerCase().includes(connector)
        );

        // Check for proper sentence structure
        const hasProperStructure = response.match(/[A-Z][^.!?]*[.!?]/g)?.length > 0;

        // Check for topic consistency
        const topicConsistency = this.checkTopicConsistency(response);

        return (
            (hasConnectors ? 0.4 : 0) +
            (hasProperStructure ? 0.3 : 0) +
            (topicConsistency * 0.3)
        );
    }

    checkTopicConsistency(response) {
        const sentences = response.split(/[.!?]+/).filter(s => s.trim());
        if (sentences.length <= 1) return 1;

        const topics = sentences.map(s => this.extractTopics(s));
        const commonTopics = new Set(topics[0].filter(topic =>
            topics.every(sentenceTopics => sentenceTopics.includes(topic))
        ));

        return Math.min(commonTopics.size / 2, 1);
    }

    async extractEntities(text) {
        if (!this.ner.model) return [];

        try {
            const tokens = this.nlp.tokenizer.tokenize(text);
            const entities = await this.ner.model.process(tokens);
            return entities.filter(entity => this.ner.tags.has(entity.type));
        } catch (error) {
            console.error('Entity extraction error:', error);
            return [];
        }
    }

    extractTopics(text) {
        // Remove stop words and tokenize
        const tokens = this.removeStopWords(text.toLowerCase()).split(/\s+/);
        
        // Extract noun phrases
        const nounPhrases = this.extractNounPhrases(tokens);
        
        // Use TF-IDF to identify important terms
        const tfidf = this.calculateTFIDF(tokens);
        
        // Combine and rank topics
        return this.rankTopics([...nounPhrases, ...tfidf.slice(0, 5)]);
    }

    analyzeSentiment(text) {
        return this.sentiment.getSentiment(
            this.nlp.tokenizer.tokenize(text)
        );
    }

    selectMostRelevant(wikiData, userInput) {
        const userTopics = this.extractTopics(userInput);
        
        return wikiData
            .map(data => ({
                data,
                relevance: this.calculateRelevance(data, userTopics)
            }))
            .sort((a, b) => b.relevance - a.relevance)
            .slice(0, 2)
            .map(item => item.data);
    }

    calculateRelevance(wikiData, userTopics) {
        const topicOverlap = userTopics.filter(topic => 
            wikiData.title.toLowerCase().includes(topic) ||
            wikiData.categories.some(cat => cat.toLowerCase().includes(topic))
        ).length;

        const contentRelevance = userTopics.filter(topic =>
            wikiData.extract.toLowerCase().includes(topic)
        ).length;

        return (topicOverlap * 0.6) + (contentRelevance * 0.4);
    }

    combineResponses(baseResponse, wikiInfo) {
        let combined = baseResponse;

        wikiInfo.forEach(info => {
            const relevantPart = this.extractRelevantPart(info.extract, baseResponse);
            if (relevantPart) {
                combined += ` Additionally, ${relevantPart}`;
            }
        });

        return this.smoothenCombinedResponse(combined);
    }

    adjustResponseTone(response, sentiment) {
        const tone = sentiment > 0.2 ? 'positive' :
                    sentiment < -0.2 ? 'negative' : 'neutral';

        const toneAdjustments = {
            positive: {
                addWords: ['certainly', 'absolutely', 'definitely'],
                removeWords: ['unfortunately', 'sadly', 'regrettably']
            },
            negative: {
                addWords: ['however', 'nevertheless', 'although'],
                removeWords: ['great', 'excellent', 'wonderful']
            },
            neutral: {
                addWords: ['specifically', 'particularly', 'notably'],
                removeWords: ['very', 'extremely', 'absolutely']
            }
        };

        return this.applyToneAdjustments(response, toneAdjustments[tone]);
    }

    getFailsafeResponse() {
        const failsafeResponses = [
            "I apologize, but I'm having trouble processing that request. Could you rephrase it?",
            "I'm not quite sure how to respond to that. Could you try asking in a different way?",
            "I didn't quite catch that. Could you please provide more context or rephrase your question?"
        ];

        return failsafeResponses[Math.floor(Math.random() * failsafeResponses.length)];
    }

    // Add any missing utility methods and error handlers here...
}

const chatbot = new EnhancedChatbot();
chatbot.initializeApp();
