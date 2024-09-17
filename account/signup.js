import { 
    createUserWithEmailAndPassword, 
    sendEmailVerification, 
    signInWithEmailAndPassword, 
    sendPasswordResetEmail,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { ref, set } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js";

let signupForm, signinForm, forgotPasswordForm, signupTab, signinTab;
let termsModal, forgotPasswordModal;
let usernameInput, emailInput, passwordInput, confirmPasswordInput, roleInput, languageInput;
let signinEmailInput, signinPasswordInput;
let resetEmailInput;
let termsLink, forgotPasswordLink;
let closeButtons;
let togglePasswordButtons;

document.addEventListener('DOMContentLoaded', init);

function init() {
    bindElements();
    setupEventListeners();
    setupAuthStateListener();
}

function bindElements() {
    signupForm = document.getElementById('signup-form');
    signinForm = document.getElementById('signin-form');
    forgotPasswordForm = document.getElementById('forgot-password-form');
    signupTab = document.getElementById('signup-tab');
    signinTab = document.getElementById('signin-tab');
    termsModal = document.getElementById('terms-modal');
    forgotPasswordModal = document.getElementById('forgot-password-modal');

    usernameInput = document.getElementById('username');
    emailInput = document.getElementById('email');
    passwordInput = document.getElementById('password');
    confirmPasswordInput = document.getElementById('confirm-password');
    roleInput = document.getElementById('role');
    languageInput = document.getElementById('language');

    signinEmailInput = document.getElementById('signin-email');
    signinPasswordInput = document.getElementById('signin-password');

    resetEmailInput = document.getElementById('reset-email');

    termsLink = document.getElementById('terms-link');
    forgotPasswordLink = document.getElementById('forgot-password-link');

    closeButtons = document.querySelectorAll('.close');
    togglePasswordButtons = document.querySelectorAll('.toggle-password');
}

function setupEventListeners() {
    signupForm.addEventListener('submit', handleSignup);
    signinForm.addEventListener('submit', handleSignin);
    forgotPasswordForm.addEventListener('submit', handleForgotPassword);
    signupTab.addEventListener('click', () => switchTab('signup'));
    signinTab.addEventListener('click', () => switchTab('signin'));
    
    termsLink.addEventListener('click', openModal);
    forgotPasswordLink.addEventListener('click', openModal);
    
    closeButtons.forEach(button => {
        button.addEventListener('click', closeModal);
    });

    togglePasswordButtons.forEach(button => {
        button.addEventListener('click', togglePasswordVisibility);
    });

    window.addEventListener('click', outsideClickCloseModal);

    // Add input event listeners for real-time validation
    usernameInput.addEventListener('input', () => validateField(usernameInput, 'Username is required'));
    emailInput.addEventListener('input', validateEmail);
    passwordInput.addEventListener('input', validatePasswordStrength);
    confirmPasswordInput.addEventListener('input', () => validatePasswordMatch(passwordInput, confirmPasswordInput));
    roleInput.addEventListener('change', () => validateField(roleInput, 'Please select a role'));
    languageInput.addEventListener('change', () => validateField(languageInput, 'Please select a preferred language'));
}

function setupAuthStateListener() {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // User is signed in, redirect to dashboard or show welcome message
            showNotification(`Welcome, ${user.email}!`, 'success');
            // You can redirect to a dashboard page here
            window.location.href = 'https://dupuis.lol/classes/id';
        }
    });
}

async function handleSignup(e) {
    e.preventDefault();
    if (validateForm(signupForm)) {
        const email = emailInput.value;
        const password = passwordInput.value;

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            await sendEmailVerification(user);
            await saveUserData(user.uid);
            showNotification('Account created successfully! Please check your email to verify your account.', 'success');
            signupForm.reset();
        } catch (error) {
            console.error('Firebase error:', error);
            handleFirebaseError(error);
        }
    }
}

async function handleSignin(e) {
    e.preventDefault();
    const email = signinEmailInput.value;
    const password = signinPasswordInput.value;

    try {
        await signInWithEmailAndPassword(auth, email, password);
        showNotification('Signed in successfully!', 'success');
        signinForm.reset();
        // Redirect to dashboard or show welcome message
    } catch (error) {
        console.error('Firebase error:', error);
        handleFirebaseError(error);
    }
}

async function handleForgotPassword(e) {
    e.preventDefault();
    const email = resetEmailInput.value;

    try {
        await sendPasswordResetEmail(auth, email);
        showNotification('Password reset email sent. Please check your inbox.', 'success');
        forgotPasswordForm.reset();
        closeForgotPasswordModal();
    } catch (error) {
        console.error('Firebase error:', error);
        handleFirebaseError(error);
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

function switchTab(tab) {
    if (tab === 'signup') {
        signupForm.classList.add('active-form');
        signinForm.classList.remove('active-form');
        signupTab.classList.add('active');
        signinTab.classList.remove('active');
    } else {
        signinForm.classList.add('active-form');
        signupForm.classList.remove('active-form');
        signinTab.classList.add('active');
        signupTab.classList.remove('active');
    }
}

function openModal(e) {
    e.preventDefault();
    const modalId = e.target.getAttribute('href').substring(1);
    document.getElementById(modalId).style.display = 'block';
}

function closeModal() {
    termsModal.style.display = 'none';
    forgotPasswordModal.style.display = 'none';
}

function outsideClickCloseModal(e) {
    if (e.target === termsModal || e.target === forgotPasswordModal) {
        closeModal();
    }
}

function togglePasswordVisibility(e) {
    const passwordInput = e.target.previousElementSibling;
    const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
    passwordInput.setAttribute('type', type);
    e.target.classList.toggle('fa-eye');
    e.target.classList.toggle('fa-eye-slash');
}

function validateForm(form) {
    let isValid = true;
    form.querySelectorAll('input, select').forEach(input => {
        if (input.type === 'checkbox') {
            isValid = validateCheckbox(input, 'You must agree to the terms and conditions') && isValid;
        } else if (input.type === 'email') {
            isValid = validateEmail(input) && isValid;
        } else if (input.type === 'password' && input.id === 'password') {
            isValid = validatePasswordStrength(input) && isValid;
        } else if (input.type === 'password' && input.id === 'confirm-password') {
            isValid = validatePasswordMatch(passwordInput, input) && isValid;
        } else {
            isValid = validateField(input, `${input.placeholder} is required`) && isValid;
        }
    });
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
        case 'auth/user-not-found':
        case 'auth/wrong-password':
            errorMessage = 'Invalid email or password. Please try again.';
            break;
        case 'auth/too-many-requests':
            errorMessage = 'Too many unsuccessful attempts. Please try again later.';
            break;
        default:
            errorMessage = `An error occurred: ${error.message}`;
    }
    showNotification(errorMessage, 'error');
}

function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.className = `notification ${type}`;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 5000);
}
