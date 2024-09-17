// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import {
    getAuth, 
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js";

// Your web app's Firebase configuration
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

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

let inactivityTimer;
const INACTIVITY_TIMEOUT = 2 * 60 * 60 * 1000;  // 2 hours in milliseconds

function init() {
    onAuthStateChanged(auth, handleAuthStateChange);
    setupInactivityListeners();
}

async function handleAuthStateChange(user) {
    if (user) {
        if (user.emailVerified) {
            resetInactivityTimer();
            await redirectToAppropriatePlace(user.uid);
        } else {
            showNotification('Please verify your email before accessing the app.', 'warning');
            await signOut(auth);
            redirectToSignup();
        }
    } else {
        redirectToSignup();
    }
}

async function redirectToAppropriatePlace(userId) {
    try {
        const userRef = ref(database, `users/${userId}`);
        const snapshot = await get(userRef);
        const userData = snapshot.val();
        
        if (userData && userData.classes && userData.classes.length > 0) {
            window.location.href = `https://fbl.dupuis.lol/classes/${userData.classes[0]}`;
        } else {
            window.location.href = 'https://fbl.dupuis.lol/classes/join';
        }
    } catch (error) {
        console.error('Error fetching user data:', error);
        showNotification('An error occurred. Please try again.', 'error');
    }
}

function setupInactivityListeners() {
    ['mousedown', 'keydown', 'touchstart', 'scroll'].forEach(eventType => {
        document.addEventListener(eventType, resetInactivityTimer);
    });
}

function resetInactivityTimer() {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(handleInactivity, INACTIVITY_TIMEOUT);
}

async function handleInactivity() {
    try {
        await signOut(auth);
        showSignInPopup();
    } catch (error) {
        console.error("Error signing out:", error);
    }
}

function showSignInPopup() {
    const popup = document.createElement('div');
    popup.className = 'signin-popup';
    popup.innerHTML = `
        <div class="signin-popup-content">
            <h2>Session Expired</h2>
            <p>Your session has expired due to inactivity. Please sign in again.</p>
            <button id="signin-popup-button">Sign In</button>
        </div>
    `;
    document.body.appendChild(popup);

    document.getElementById('signin-popup-button').addEventListener('click', () => {
        window.location.href = 'https://fbl.dupuis.lol/account/signup';
    });
}

function redirectToSignup() {
    if (window.location.pathname !== '/account/signup' && window.location.pathname !== '/account/signin') {
        window.location.href = 'https://fbl.dupuis.lol/account/signup';
    }
}

function showNotification(message, type) {
    // Implement this function to show notifications to the user
    console.log(`${type.toUpperCase()}: ${message}`);
    // You can use the same implementation as in the main script
}

// Initialize the access control
init();

// Export functions that might be needed in other parts of your application
export { resetInactivityTimer };
