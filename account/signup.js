import { 
    createUserWithEmailAndPassword, 
    sendEmailVerification, 
    signInWithEmailAndPassword, 
    sendPasswordResetEmail,
    onAuthStateChanged,
    GoogleAuthProvider,
    signInWithPopup,
    signOut
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { ref, set, get } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js";
import { resetInactivityTimer } from '/background/access.js';

let signupForm, signinForm, forgotPasswordForm, signupTab, signinTab;
let termsModal, forgotPasswordModal;
let usernameInput, emailInput, passwordInput, confirmPasswordInput, roleInput, languageInput;
let signinEmailInput, signinPasswordInput;
let resetEmailInput;
let termsLink, forgotPasswordLink;
let closeButtons;
let togglePasswordButtons;
let passwordStrengthIndicator;
let googleSignInButton;

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

    forgotPasswordLink = document.getElementById('forgot-password-link');

    closeButtons = document.querySelectorAll('.close');
    togglePasswordButtons = document.querySelectorAll('.toggle-password');

    passwordStrengthIndicator = document.createElement('div');
    passwordStrengthIndicator.className = 'password-strength';
    passwordInput.parentNode.insertBefore(passwordStrengthIndicator, passwordInput.nextSibling);

    googleSignInButton = document.createElement('button');
    googleSignInButton.textContent = 'Sign in with Google';
    googleSignInButton.className = 'google-signin';
    signinForm.appendChild(googleSignInButton);
}

function setupEventListeners() {
    signupForm.addEventListener('submit', handleSignup);
    signinForm.addEventListener('submit', handleSignin);
    forgotPasswordForm.addEventListener('submit', handleForgotPassword);
    signupTab.addEventListener('click', () => switchTab('signup'));
    signinTab.addEventListener('click', () => switchTab('signin'));
    
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

    googleSignInButton.addEventListener('click', handleGoogleSignIn);
}

function setupAuthStateListener() {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            if (user.emailVerified) {
                showNotification(`Welcome, ${user.displayName || user.email}!`, 'success');
                resetInactivityTimer();
                redirectToClasses(user.uid);
            } else {
                showNotification('Please verify your email before signing in.', 'warning');
                signOut(auth);
            }
        } else {
            window.location.href = 'https://fbl.dupuis.lol/account/signup';
        }
    });
}

async function redirectToClasses(userId) {
    try {
        const userRef = ref(database, `users/${userId}`);
        const snapshot = await get(userRef);
        const userData = snapshot.val();
        
        if (userData && userData.classes && userData.classes.length > 0) {
            window.location.href = `https://fbl.dupuis.lol/classes/find?id=${userData.classes[0]}`;
        } else {
            window.location.href = 'https://fbl.dupuis.lol/classes/join';
        }
    } catch (error) {
        console.error('Error fetching user data:', error);
        showNotification('An error occurred. Please try again.', 'error');
    }
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
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        if (!user.emailVerified) {
            await sendEmailVerification(user);
            showNotification('Please verify your email before signing in. A new verification email has been sent.', 'warning');
            await signOut(auth);
            return;
        }
        resetInactivityTimer();
        showNotification('Signed in successfully!', 'success');
        signinForm.reset();
        redirectToClasses(user.uid);
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

async function handleGoogleSignIn() {
    const provider = new GoogleAuthProvider();
    try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        await saveUserData(user.uid, { email: user.email, username: user.displayName });
        showNotification('Signed in with Google successfully!', 'success');
    } catch (error) {
        console.error('Google Sign-In error:', error);
        handleFirebaseError(error);
    }
}

async function saveUserData(userId, additionalData = {}) {
    const userData = {
        username: additionalData.username || usernameInput.value,
        email: additionalData.email || emailInput.value,
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

function togglePasswordVisibility(e) {
    const passwordInput = e.target.closest('.password-group').querySelector('input');
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
    const password = input.value;
    const strength = calculatePasswordStrength(password);
    updatePasswordStrengthIndicator(strength);

    if (strength < 3) {
        showError(input, 'Password must be at least 8 characters long and include uppercase, lowercase, number, and special character');
        return false;
    } else {
        removeError(input);
        return true;
    }
}

function calculatePasswordStrength(password) {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.match(/[a-z]/)) strength++;
    if (password.match(/[A-Z]/)) strength++;
    if (password.match(/[0-9]/)) strength++;
    if (password.match(/[^a-zA-Z0-9]/)) strength++;
    return strength;
}

function updatePasswordStrengthIndicator(strength) {
    const colors = ['#EA4335', '#FBBC05', '#34A853', '#4285F4'];
    const labels = ['Weak', 'Fair', 'Good', 'Strong'];
    
    passwordStrengthIndicator.style.width = `${(strength / 4) * 100}%`;
    passwordStrengthIndicator.style.backgroundColor = colors[strength - 1] || colors[0];
    passwordStrengthIndicator.textContent = labels[strength - 1] || labels[0];
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
    input.parentNode.insertBefore(error, input.nextSibling);
    input.classList.add('error');
}

function removeError(input) {
    const errorElement = input.parentNode.querySelector('.error-message');
    if (errorElement) {
        errorElement.remove();
    }
    input.classList.remove('error');
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
        case 'auth/popup-closed-by-user':
            errorMessage = 'Google Sign-In was cancelled. Please try again.';
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
    
    // Trigger a reflow to enable the transition
    notification.offsetHeight;
    
    notification.classList.add('show');
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300); // Wait for the fade-out transition
    }, 5000);
}
