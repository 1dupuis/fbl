// Import Firebase functions
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, sendEmailVerification } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { getDatabase, ref, set } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js";

let form, usernameInput, emailInput, passwordInput, confirmPasswordInput, roleInput, languageInput, termsCheckbox, termsLink, termsModal, closeModal, togglePassword, submitButton;
let auth, database;

// Firebase configuration
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
auth = getAuth(app);
database = getDatabase(app);

document.addEventListener('DOMContentLoaded', init);

function init() {
    bindElements();
    setupEventListeners();
}

function bindElements() {
    form = document.getElementById('signup-form');
    usernameInput = document.getElementById('username');
    emailInput = document.getElementById('email');
    passwordInput = document.getElementById('password');
    confirmPasswordInput = document.getElementById('confirm-password');
    roleInput = document.getElementById('role');
    languageInput = document.getElementById('language');
    termsCheckbox = document.getElementById('terms');
    termsLink = document.getElementById('terms-link');
    termsModal = document.getElementById('terms-modal');
    closeModal = document.querySelector('.close');
    togglePassword = document.getElementById('toggle-password');
    submitButton = document.querySelector('button[type="submit"]');
}

function setupEventListeners() {
    form.addEventListener('submit', handleSubmit);
    termsLink.addEventListener('click', openModal);
    closeModal.addEventListener('click', closeModalFunction);
    window.addEventListener('click', outsideClickCloseModal);
    
    usernameInput.addEventListener('input', debounce(() => validateField(usernameInput, 'Username is required'), 300));
    emailInput.addEventListener('input', debounce(() => validateEmail(emailInput), 300));
    passwordInput.addEventListener('input', debounce(() => validatePasswordStrength(passwordInput), 300));
    confirmPasswordInput.addEventListener('input', debounce(() => validatePasswordMatch(passwordInput, confirmPasswordInput), 300));
    
    if (togglePassword) {
        togglePassword.addEventListener('click', () => {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            confirmPasswordInput.setAttribute('type', type);
            togglePassword.textContent = type === 'password' ? 'Show' : 'Hide';
        });
    }
}

function debounce(func, delay) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

async function handleSubmit(e) {
    e.preventDefault();
    if (validateForm()) {
        submitButton.disabled = true;
        submitButton.textContent = 'Creating account...';
        try {
            await createUser();
        } catch (error) {
            console.error('Error creating user:', error);
            handleFirebaseError(error);
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Sign Up';
        }
    }
}

function validateForm() {
    let isValid = true;

    isValid = validateField(usernameInput, 'Username is required') && isValid;
    isValid = validateEmail(emailInput) && isValid;
    isValid = validatePasswordStrength(passwordInput) && isValid;
    isValid = validatePasswordMatch(passwordInput, confirmPasswordInput) && isValid;
    isValid = validateField(roleInput, 'Please select a role') && isValid;
    isValid = validateField(languageInput, 'Please select a preferred language') && isValid;
    isValid = validateCheckbox(termsCheckbox, 'You must agree to the terms and conditions') && isValid;

    return isValid;
}

function validateField(input, errorMessage) {
    if (input.value.trim() === '') {
        showError(input, errorMessage);
        return false;
    } else {
        removeError(input);
        return true;
    }
}

function validateEmail(input) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!re.test(input.value.trim())) {
        showError(input, 'Please enter a valid email address');
        return false;
    } else {
        removeError(input);
        return true;
    }
}

function validatePasswordStrength(input) {
    const re = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*]).{8,}$/;
    if (!re.test(input.value)) {
        showError(input, 'Password must be at least 8 characters long and include uppercase, lowercase, number, and special character');
        return false;
    } else {
        removeError(input);
        return true;
    }
}

function validatePasswordMatch(password, confirmPassword) {
    if (password.value !== confirmPassword.value) {
        showError(confirmPassword, 'Passwords do not match');
        return false;
    } else {
        removeError(confirmPassword);
        return true;
    }
}

function validateCheckbox(checkbox, errorMessage) {
    if (!checkbox.checked) {
        showError(checkbox, errorMessage);
        return false;
    } else {
        removeError(checkbox);
        return true;
    }
}

function showError(input, message) {
    removeError(input);
    const error = document.createElement('div');
    error.className = 'error-message';
    error.textContent = message;
    error.style.color = 'var(--error-color)';
    error.style.fontSize = '0.875rem';
    error.style.marginTop = '0.25rem';
    input.parentNode.insertBefore(error, input.nextSibling);
    input.style.borderColor = 'var(--error-color)';
}

function removeError(input) {
    const errorElement = input.nextElementSibling;
    if (errorElement && errorElement.classList.contains('error-message')) {
        errorElement.remove();
    }
    input.style.borderColor = '';
}

async function createUser() {
    const email = emailInput.value;
    const password = passwordInput.value;

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        await sendEmailVerification(user);
        await saveUserData(user.uid);
        showSuccessMessage('Account created successfully! Please check your email to verify your account.');
        form.reset();
    } catch (error) {
        console.error('Firebase error:', error);
        throw error;
    }
}

async function saveUserData(userId) {
    const userData = {
        username: usernameInput.value,
        email: emailInput.value,
        role: roleInput.value,
        language: languageInput.value,
        createdAt: new Date().toISOString()
    };

    try {
        await set(ref(database, 'users/' + userId), userData);
    } catch (error) {
        console.error('Error saving user data:', error);
        throw new Error('Failed to save user data');
    }
}

function handleFirebaseError(error) {
    let errorMessage;
    switch (error.code) {
        case 'auth/email-already-in-use':
            errorMessage = 'This email is already in use. Please use a different email or try logging in.';
            break;
        case 'auth/invalid-email':
            errorMessage = 'The email address is not valid. Please check your email and try again.';
            break;
        case 'auth/weak-password':
            errorMessage = 'The password is too weak. Please choose a stronger password.';
            break;
        case 'auth/network-request-failed':
            errorMessage = 'Network error. Please check your internet connection and try again.';
            break;
        case 'auth/too-many-requests':
            errorMessage = 'Too many unsuccessful attempts. Please try again later.';
            break;
        case 'auth/configuration-not-found':
            errorMessage = 'Firebase configuration error. Please check your Firebase setup.';
            break;
        default:
            errorMessage = `An error occurred while creating your account: ${error.message}`;
    }
    showErrorMessage(errorMessage);
}

function showSuccessMessage(message) {
    showNotification(message, 'success');
}

function showErrorMessage(message) {
    showNotification(message, 'error');
}

function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.position = 'fixed';
    notification.style.top = '10px';
    notification.style.right = '10px';
    notification.style.padding = '10px';
    notification.style.borderRadius = '4px';
    notification.style.color = 'white';
    notification.style.zIndex = '1000';
    notification.style.maxWidth = '300px';

    if (type === 'success') {
        notification.style.backgroundColor = '#4CAF50';
    } else {
        notification.style.backgroundColor = '#F44336';
    }

    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 5000);
}

function openModal(e) {
    e.preventDefault();
    termsModal.style.display = 'block';
}

function closeModalFunction() {
    termsModal.style.display = 'none';
}

function outsideClickCloseModal(e) {
    if (e.target === termsModal) {
        termsModal.style.display = 'none';
    }
}
