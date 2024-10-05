// Import Firebase modules
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

// Initialize Firebase
const firebaseConfig = {
    apiKey: "AIzaSyAToB2gXmzCK4t-1dW5urnGG87gbK6MxR8",
    authDomain: "dupuis-lol.firebaseapp.com",
    databaseURL: "https://dupuis-lol-default-rtdb.firebaseio.com",
    projectId: "dupuis-lol",
    storageBucket: "dupuis-lol.appspot.com",
    messagingSenderId: "807402660080",
    appId: "1:807402660080:web:545d4e1287f5803ebda235",
    measurementId: "G-TR8JMF5FRY"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

class EnhancedChatbot {
    constructor() {
        this.net = new brain.recurrent.LSTM({
            hiddenLayers: [64, 32],
            learningRate: 0.008,
            activation: 'leaky-relu',
            errorThresh: 0.003
        });

        this.trainingMetrics = {
            lastError: null,
            totalIterations: 0,
            bestError: Infinity,
            lastTrainingTimestamp: null
        };

        this.contextWindow = [];
        this.maxContextLength = 6;
        this.isTraining = false;
        this.isInitialized = false;
        this.userId = null;
        this.userProfile = null;
        this.globalModelRef = null;
        this.networkState = null;
        this.trainingData = null;

        this.elements = {
            userInput: null,
            sendBtn: null,
            chatWindow: null,
            typingIndicator: null,
            status: null,
            clearBtn: null,
        };

        window.addEventListener('DOMContentLoaded', () => {
            this.initializeElements();
            this.initialize().catch(this.handleError.bind(this));
        });
    }

    async initialize() {
        try {
            this.updateStatus('Initializing...', 'loading');
            await this.initializeFirebase();
            await this.loadUserProfile();
            await this.initializeGlobalModel();
            this.isInitialized = true;
            this.updateStatus('Ready to chat!', 'success');
            this.setInterfaceEnabled(true);
            this.setupEventListeners();
            this.loadPreviousConversation();
            this.startModelSyncListener();
        } catch (error) {
            throw new Error('Initialization failed: ' + error.message);
        }
    }

    initializeElements() {
        this.elements = {
            userInput: document.getElementById('userInput'),
            sendBtn: document.getElementById('sendBtn'),
            chatWindow: document.getElementById('chatWindow'),
            typingIndicator: document.querySelector('.typing-indicator'),
            status: document.getElementById('status'),
            clearBtn: document.getElementById('clearBtn'),
        };

        const missingElements = Object.entries(this.elements)
            .filter(([key, value]) => !value)
            .map(([key]) => key);

        if (missingElements.length > 0) {
            throw new Error(`Missing DOM elements: ${missingElements.join(', ')}`);
        }
    }

    async initializeFirebase() {
        return new Promise((resolve, reject) => {
            const unsubscribe = onAuthStateChanged(auth, (user) => {
                unsubscribe();
                if (user) {
                    this.userId = user.uid;
                    resolve();
                } else {
                    resolve(); // Allow anonymous usage
                }
            });
        });
    }

    async initializeGlobalModel() {
            this.globalModelRef = ref(database, 'globalModel');
            
            try {
                const snapshot = await get(this.globalModelRef);
                if (snapshot.exists()) {
                    const savedState = snapshot.val();
                    
                    // Restore network state and training metrics
                    if (savedState.model) {
                        console.log('Restoring model state with error:', savedState.performance.errorRate);
                        this.net.fromJSON(savedState.model);
                        this.trainingMetrics = {
                            lastError: savedState.performance.errorRate,
                            totalIterations: savedState.performance.totalIterations || 0,
                            bestError: savedState.performance.bestError || savedState.performance.errorRate,
                            lastTrainingTimestamp: savedState.lastUpdated
                        };
                    }
                    
                    // Restore training data
                    if (savedState.trainingData) {
                        this.trainingData = savedState.trainingData;
                    } else {
                        await this.loadTrainingData();
                    }
                } else {
                    await this.loadTrainingData();
                    await this.trainNetwork();
                }

                // Set up real-time sync for training data
                this.setupTrainingDataSync();
            } catch (error) {
                console.error('Error initializing global model:', error);
                await this.loadTrainingData();
                await this.trainNetwork();
            }
        }
    
    async loadUserProfile() {
        if (!this.userId) return;
        
        const userProfileRef = ref(database, `users/${this.userId}/profile`);
        const snapshot = await get(userProfileRef);
        if (snapshot.exists()) {
            this.userProfile = snapshot.val();
        } else {
            this.userProfile = { name: 'User', preferences: {} };
            await set(userProfileRef, this.userProfile);
        }
    }

    async loadTrainingData() {
        const trainingDataRef = ref(database, 'trainingData');
        try {
            const snapshot = await get(trainingDataRef);
            if (snapshot.exists()) {
                this.trainingData = snapshot.val();
            } else {
                this.trainingData = [
                    { input: "hello", output: "Hi! How can I help you?" },
                    { input: "how are you", output: "I'm here to assist you. What can I do for you today?" },
                    { input: "what can you do", output: "I can answer questions, provide information, and help with various tasks. What do you need help with?" },
                    { input: "bye", output: "Goodbye! Feel free to come back if you need any more assistance." },
                    { input: "thanks", output: "You're welcome! Is there anything else I can help you with?" }
                ];
                await set(trainingDataRef, this.trainingData);
            }
        } catch (error) {
            console.error('Error loading training data:', error);
            this.trainingData = [
                { input: "hello", output: "Hi! How can I help you?" },
                { input: "how are you", output: "I'm here to assist you. What can I do for you today?" }
            ];
        }
    }

    hasNewTrainingData(newData) {
        return JSON.stringify(this.trainingData) !== JSON.stringify(newData);
    }

    setupTrainingDataSync() {
            onValue(ref(database, 'trainingData'), async (snapshot) => {
                if (snapshot.exists()) {
                    const newTrainingData = snapshot.val();
                    if (this.hasNewTrainingData(newTrainingData)) {
                        console.log('New training data detected');
                        this.trainingData = newTrainingData;
                        await this.trainNetwork(true); // true indicates incremental training
                    }
                }
            });
        }

        hasNewTrainingData(newData) {
            if (!this.trainingData) return true;
            if (newData.length !== this.trainingData.length) return true;
            return JSON.stringify(newData) !== JSON.stringify(this.trainingData);
        }

    async saveModelState() {
            if (!this.isTraining) {
                try {
                    const modelState = {
                        model: this.net.toJSON(),
                        trainingData: this.trainingData,
                        lastUpdated: Date.now(),
                        performance: {
                            errorRate: this.trainingMetrics.lastError,
                            totalIterations: this.trainingMetrics.totalIterations,
                            bestError: this.trainingMetrics.bestError,
                            iterations: this.net.iterations
                        }
                    };

                    await update(this.globalModelRef, modelState);
                    console.log('Model state saved with error:', this.trainingMetrics.lastError);
                } catch (error) {
                    console.error('Error saving model state:', error);
                }
            }
        }

    async trainNetwork(isIncremental = false) {
    if (this.isTraining) {
        console.log('Training already in progress, skipping...');
        return;
    }

    // Prevent training with empty or invalid data
    if (!this.trainingData || !Array.isArray(this.trainingData) || this.trainingData.length === 0) {
        console.error('No valid training data available');
        this.updateStatus('Error: No training data available', 'error');
        return;
    }

    this.isTraining = true;
    const startTime = Date.now();
    let lastSaveTime = startTime;
    const saveInterval = 30000; // Save every 30 seconds

    try {
        // Load previous state if available
        const modelStateRef = ref(database, 'globalModel');
        const snapshot = await get(modelStateRef);
        let previousError = Infinity;
        let stagnantIterations = 0;
        const maxStagnantIterations = 50;

        if (snapshot.exists()) {
            const savedState = snapshot.val();
            if (savedState.performance?.errorRate) {
                previousError = savedState.performance.errorRate;
                console.log('Resuming training from previous error rate:', previousError);
            }
        }

        // Configure base training options
        const baseIterations = isIncremental ? 100 : 1000;
        const targetError = isIncremental ? Math.max(0.001, previousError * 0.9) : 0.003;
        
        // Calculate adaptive learning rate
        const adaptiveLearningRate = this.calculateAdaptiveLearningRate(previousError, isIncremental);
        this.net.trainOpts.learningRate = adaptiveLearningRate;

        console.log(`Starting training with learning rate: ${adaptiveLearningRate}`);
        console.log(`Target error: ${targetError}`);

        const trainingOptions = {
            iterations: baseIterations,
            errorThresh: targetError,
            log: true,
            logPeriod: 1,
            momentum: 0.1,
            callback: async (stats) => {
                try {
                    const currentError = stats.error;
                    const currentIteration = stats.iterations;
                    const timeSinceLastSave = Date.now() - lastSaveTime;

                    // Update training metrics
                    this.trainingMetrics = {
                        ...this.trainingMetrics,
                        lastError: currentError,
                        totalIterations: (this.trainingMetrics.totalIterations || 0) + 1,
                        bestError: Math.min(currentError, this.trainingMetrics.bestError || Infinity),
                        lastTrainingTimestamp: Date.now()
                    };

                    // Check for training stagnation
                    if (Math.abs(currentError - previousError) < 0.0001) {
                        stagnantIterations++;
                    } else {
                        stagnantIterations = 0;
                    }

                    // Update status with detailed information
                    this.updateStatus(
                        `Training: Iteration ${currentIteration}/${baseIterations} | ` +
                        `Error: ${currentError.toFixed(4)} | ` +
                        `Best: ${this.trainingMetrics.bestError.toFixed(4)}`,
                        'loading'
                    );

                    // Periodic save based on time interval or significant improvement
                    if (timeSinceLastSave >= saveInterval || 
                        (currentError < previousError * 0.9)) { // 10% improvement
                        await this.saveModelState();
                        lastSaveTime = Date.now();
                        console.log(`Saved model state at iteration ${currentIteration} with error ${currentError}`);
                    }

                    // Early stopping conditions
                    if (stagnantIterations >= maxStagnantIterations) {
                        console.log('Training stopped due to stagnation');
                        return true; // Stop training
                    }

                    if (currentError <= targetError) {
                        console.log('Target error reached');
                        return true; // Stop training
                    }

                    // Update previous error for next iteration
                    previousError = currentError;

                } catch (callbackError) {
                    console.error('Error in training callback:', callbackError);
                    // Don't throw here to allow training to continue
                }
            }
        };

        // Perform the actual training
        console.log('Starting neural network training...');
        const trainingStartTime = Date.now();
        
        await this.net.train(this.trainingData, trainingOptions);
        
        const trainingDuration = (Date.now() - trainingStartTime) / 1000;
        console.log(`Training completed in ${trainingDuration.toFixed(2)} seconds`);

        // Final save of model state
        await this.saveModelState();

        // Update status with final results
        this.updateStatus(
            `Training complete! Final error: ${this.trainingMetrics.lastError.toFixed(4)}`,
            'success'
        );

        // Log training summary
        console.log('Training Summary:', {
            finalError: this.trainingMetrics.lastError,
            bestError: this.trainingMetrics.bestError,
            totalIterations: this.trainingMetrics.totalIterations,
            duration: trainingDuration
        });

    } catch (error) {
        console.error('Fatal training error:', error);
        this.updateStatus('Training error occurred. Using fallback responses.', 'error');
        
        // Attempt to save the last good state
        try {
            await this.saveModelState();
        } catch (saveError) {
            console.error('Error saving model state after training error:', saveError);
        }

    } finally {
        this.isTraining = false;
        
        // Schedule next incremental training if needed
        if (isIncremental && this.trainingMetrics.lastError > targetError) {
            setTimeout(() => {
                this.trainNetwork(true).catch(console.error);
            }, 60000); // Wait 1 minute before trying again
        }
    }
}

// Helper method for calculating adaptive learning rate
calculateAdaptiveLearningRate(previousError, isIncremental) {
    if (isIncremental) {
        // For incremental training, use a smaller learning rate based on current error
        return Math.min(0.008, Math.max(0.001, previousError * 0.1));
    }

    // For full training, use dynamic rate based on training progress
    if (previousError === Infinity) {
        return 0.008; // Initial learning rate
    }

    // Scale learning rate based on error magnitude
    const baseRate = 0.008;
    const errorScale = Math.min(1, Math.max(0.1, previousError));
    return baseRate * errorScale;
}

    preprocessInput(text) {
        return text.toLowerCase()
            .replace(/[^\w\s?!.,]/g, '')
            .trim();
    }

    async getResponse(userInput) {
        const sanitizedInput = this.preprocessInput(userInput);
        const contextualInput = [...this.contextWindow, sanitizedInput].join(' ');
        
        try {
            let response = await this.net.run(contextualInput);
            
            if (!response || response === "I'm not quite sure how to respond to that.") {
                response = await this.net.run(sanitizedInput);
            }
            
            const finalResponse = response || "I'm not quite sure how to respond to that. Could you rephrase?";
            
            // Update context window
            this.contextWindow.push(sanitizedInput);
            this.contextWindow = this.contextWindow.slice(-this.maxContextLength);
            
            // Save conversation and update training data
            await Promise.all([
                this.saveConversation(userInput, finalResponse),
                this.updateTrainingData(sanitizedInput, finalResponse)
            ]);
            
            return finalResponse;
        } catch (error) {
            console.error('Response generation error:', error);
            return "I'm having trouble processing that. Could you try saying it differently?";
        }
    }

    async updateTrainingData(input, output) {
            if (!this.isTraining) {
                try {
                    const trainingDataRef = ref(database, 'trainingData');
                    const newExample = { input, output };

                    // Check if this exact example already exists
                    const exists = this.trainingData.some(data => 
                        data.input === input && data.output === output
                    );

                    if (!exists) {
                        const newTrainingData = [...this.trainingData, newExample];
                        
                        // Update local and Firebase training data
                        this.trainingData = newTrainingData;
                        await set(trainingDataRef, newTrainingData);
                        
                        // Trigger incremental training if enough new data accumulated
                        if (newTrainingData.length % 5 === 0) {
                            await this.trainNetwork(true);
                        }
                    }
                } catch (error) {
                    console.error('Error updating training data:', error);
                }
            }
        }

    async saveConversation(userInput, botResponse) {
        if (!this.userId) return;

        const conversationRef = ref(database, `users/${this.userId}/conversations`);
        const newConversationRef = push(conversationRef);
        try {
            await set(newConversationRef, {
                timestamp: Date.now(),
                userInput: userInput,
                botResponse: botResponse
            });
        } catch (error) {
            console.error('Error saving conversation:', error);
        }
    }

    startModelSyncListener() {
        onValue(this.globalModelRef, (snapshot) => {
            if (snapshot.exists()) {
                const newState = snapshot.val();
                if (newState.lastUpdated > (this.networkState?.lastUpdated || 0)) {
                    this.networkState = newState;
                    this.net.fromJSON(newState.model);
                    this.trainingData = newState.trainingData;
                }
            }
        });
    }

    async handleUserInput() {
        const userInput = this.elements.userInput.value.trim();
        
        if (!userInput || !this.isInitialized || this.isTraining) return;

        this.elements.userInput.value = '';
        this.setInterfaceEnabled(false);
        
        this.addMessage(userInput, 'user');
        this.elements.typingIndicator.style.display = 'inline-flex';

        try {
            await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
            const response = await this.getResponse(userInput);
            this.addMessage(response, 'bot');
        } catch (error) {
            this.handleError('Failed to generate response. Please try again.');
            this.addMessage("I apologize, but I'm having trouble right now. Please try again.", 'bot');
        } finally {
            this.elements.typingIndicator.style.display = 'none';
            this.setInterfaceEnabled(true);
            this.elements.userInput.focus();
        }
    }

    addMessage(text, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', `${sender}-message`);
        
        const content = document.createElement('div');
        content.classList.add('message-content');
        content.textContent = text;
        
        const time = document.createElement('div');
        time.classList.add('message-time');
        time.textContent = this.formatTime();
        
        messageDiv.appendChild(content);
        messageDiv.appendChild(time);
        
        this.elements.chatWindow.appendChild(messageDiv);
        this.elements.chatWindow.scrollTop = this.elements.chatWindow.scrollHeight;
    }

    async clearChat() {
        while (this.elements.chatWindow.firstChild) {
            this.elements.chatWindow.removeChild(this.elements.chatWindow.firstChild);
        }
        this.addMessage("Chat cleared. How can I help you?", 'bot');
        
        if (this.userId) {
            const conversationRef = ref(database, `users/${this.userId}/conversations`);
            try {
                await remove(conversationRef);
            } catch (error) {
                console.error('Error clearing conversation history:', error);
                this.updateStatus('Failed to clear conversation history.', 'error');
            }
        }
    }

    setupEventListeners() {
        if (this.elements.sendBtn) {
            this.elements.sendBtn.addEventListener('click', () => this.handleUserInput());
        }

        if (this.elements.userInput) {
            this.elements.userInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.handleUserInput();
                }
            });

            this.elements.userInput.addEventListener('focus', () => {
                if (this.elements.status && this.elements.status.classList.contains('error')) {
                    this.updateStatus('Ready to chat!', 'success');
                }
            });
        }

        if (this.elements.clearBtn) {
            this.elements.clearBtn.addEventListener('click', () => this.clearChat());
        }

        window.addEventListener('online', () => {
            if (this.isInitialized) {
                this.updateStatus('Connection restored!', 'success');
                setTimeout(() => {
                    if (this.isInitialized) {
                        this.updateStatus('Ready to chat!', 'success');
                    }
                }, 2000);
            }
        });

        window.addEventListener('offline', () => {
            this.updateStatus('Connection lost. Please check your internet connection.', 'error');
        });
    }

    async loadPreviousConversation() {
        if (!this.userId) return;

        const conversationRef = ref(database, `users/${this.userId}/conversations`);
        const recentConversationsQuery = query(conversationRef, orderByChild('timestamp'), limitToLast(10));

        try {
            const snapshot = await get(recentConversationsQuery);
            if (snapshot.exists()) {
                const conversations = [];
                snapshot.forEach((childSnapshot) => {
                    conversations.push(childSnapshot.val());
                });
                conversations.sort((a, b) => a.timestamp - b.timestamp);
                
                conversations.forEach(conv => {
                    this.addMessage(conv.userInput, 'user');
                    this.addMessage(conv.botResponse, 'bot');
                });
            }
        } catch (error) {
            console.error('Error loading previous conversations:', error);
            this.updateStatus('Failed to load previous conversations.', 'error');
        }
    }

    updateStatus(message, type = '') {
        if (this.elements.status) {
            this.elements.status.textContent = message;
            this.elements.status.className = type;
        } else {
            console.warn('Status element not found. Status update:', message, type);
        }
    }

    setInterfaceEnabled(enabled) {
        if (this.elements.userInput) {
            this.elements.userInput.disabled = !enabled;
        }
        if (this.elements.sendBtn) {
            this.elements.sendBtn.disabled = !enabled;
        }
        if (enabled && this.elements.userInput) {
            this.elements.userInput.focus();
        }
    }

    handleError(error) {
        console.error('Chatbot error:', error);
        this.updateStatus(typeof error === 'string' ? error : 'An error occurred. Please refresh the page.', 'error');
        this.setInterfaceEnabled(false);
    }

    formatTime() {
        return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
}

// Initialize the chatbot when the page loads
window.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded event fired');
    try {
        if (typeof brain === 'undefined') {
            throw new Error('Brain.js library not loaded');
        }
        console.log('Initializing EnhancedChatbot');
        window.chatbot = new EnhancedChatbot();
    } catch (error) {
        console.error('Initialization error:', error);
        const status = document.getElementById('status');
        if (status) {
            status.textContent = 'Error: Failed to initialize chatbot. Please refresh the page.';
            status.className = 'error';
        }
    }
});

export default EnhancedChatbot;
