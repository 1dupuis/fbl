// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { 
    getAuth,
    createUserWithEmailAndPassword, 
    sendEmailVerification, 
    signInWithEmailAndPassword, 
    sendPasswordResetEmail,
    onAuthStateChanged,
    GoogleAuthProvider,
    signInWithPopup,
    signOut,
    updateProfile
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { 
    getDatabase,
    ref, 
    set, 
    get, 
    push, 
    child, 
    update, 
    remove, 
    query, 
    orderByChild, 
    equalTo 
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js";
import { resetInactivityTimer } from '/background/access.js';

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

// DOM Elements
const joinClassForm = document.getElementById('joinClassForm');
const createClassForm = document.getElementById('createClassForm');
const classesContainer = document.getElementById('classesContainer');
const logoutLink = document.getElementById('logoutLink');
const usernameSpan = document.getElementById('username');
const userRoleSpan = document.getElementById('userRole');
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modalTitle');
const modalBody = document.getElementById('modalBody');
const closeModal = document.getElementsByClassName('close')[0];
const profileLink = document.getElementById('profileLink');
const searchInput = document.getElementById('searchInput');

// Current user
let currentUser = null;

// Auth state observer
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        loadUserData();
        loadUserClasses();
    } else {
        // Redirect to login page if not authenticated
        window.location.href = '/account/signup';
    }
});

// Load user data
async function loadUserData() {
    try {
        const userRef = ref(database, `users/${currentUser.uid}`);
        const userSnapshot = await get(userRef);

        if (userSnapshot.exists()) {
            const userData = userSnapshot.val();
            usernameSpan.textContent = userData.username;
            userRoleSpan.textContent = userData.role;

            // Show/hide create class form based on user role
            if (userData.role === 'teacher') {
                document.getElementById('createClass').style.display = 'block';
            } else {
                document.getElementById('createClass').style.display = 'none';
            }
        } else {
            // If user data doesn't exist, create a new user profile
            await createUserProfile();
        }
    } catch (error) {
        console.error('Error loading user data:', error);
        showNotification('Failed to load user data. Please refresh the page.', 'error');
    }
}

// Create user profile
async function createUserProfile() {
    try {
        const username = prompt('Please enter your username:');
        const role = prompt('Are you a student or a teacher?').toLowerCase();

        if (username && (role === 'student' || role === 'teacher')) {
            const userData = {
                username: username,
                email: currentUser.email,
                role: role,
                createdAt: new Date().toISOString()
            };

            await set(ref(database, `users/${currentUser.uid}`), userData);
            await updateProfile(currentUser, { displayName: username });

            usernameSpan.textContent = username;
            userRoleSpan.textContent = role;

            if (role === 'teacher') {
                document.getElementById('createClass').style.display = 'block';
            }

            showNotification('User profile created successfully!', 'success');
        } else {
            throw new Error('Invalid input');
        }
    } catch (error) {
        console.error('Error creating user profile:', error);
        showNotification('Failed to create user profile. Please try again.', 'error');
    }
}

// Generate a unique class code
function generateClassCode() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return code;
}

// Join Class
joinClassForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const classCode = document.getElementById('classCode').value.trim();
    joinClass(classCode);
});

async function joinClass(classCode) {
    try {
        const classRef = ref(database, `classes/${classCode}`);
        const classSnapshot = await get(classRef);

        if (classSnapshot.exists()) {
            const classData = classSnapshot.val();
            const userClassesRef = ref(database, `users/${currentUser.uid}/classes/${classCode}`);
            await set(userClassesRef, true);
            
            // Add student to class members
            const classMembersRef = ref(database, `classes/${classCode}/members/${currentUser.uid}`);
            await set(classMembersRef, true);

            showNotification('Successfully joined the class!', 'success');
            loadUserClasses();
        } else {
            showNotification('Class not found. Please check the class code.', 'error');
        }
    } catch (error) {
        console.error('Error joining class:', error);
        showNotification('Failed to join class. Please try again.', 'error');
    }
}

// Create Class
createClassForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const className = document.getElementById('className').value.trim();
    const subject = document.getElementById('subject').value.trim();
    const description = document.getElementById('classDescription').value.trim();
    createClass(className, subject, description);
});

async function createClass(className, subject, description) {
    try {
        const classCode = generateClassCode();
        const classRef = ref(database, `classes/${classCode}`);

        const classData = {
            name: className,
            subject: subject,
            description: description,
            teacher: currentUser.uid,
            createdAt: new Date().toISOString(),
            members: {
                [currentUser.uid]: true
            }
        };

        await set(classRef, classData);

        const userClassesRef = ref(database, `users/${currentUser.uid}/classes/${classCode}`);
        await set(userClassesRef, true);

        showNotification(`Class created successfully! Class Code: ${classCode}`, 'success');
        loadUserClasses();
    } catch (error) {
        console.error('Error creating class:', error);
        showNotification('Failed to create class. Please try again.', 'error');
    }
}

// Load User Classes
async function loadUserClasses() {
    try {
        const userClassesRef = ref(database, `users/${currentUser.uid}/classes`);
        const userClassesSnapshot = await get(userClassesRef);

        classesContainer.innerHTML = '';

        if (userClassesSnapshot.exists()) {
            const classes = userClassesSnapshot.val();
            const classPromises = Object.keys(classes).map(async (classCode) => {
                const classRef = ref(database, `classes/${classCode}`);
                const classSnapshot = await get(classRef);
                return { classCode, classData: classSnapshot.val() };
            });

            const classResults = await Promise.all(classPromises);
            classResults.forEach(({ classCode, classData }) => {
                const classCard = createClassCard(classCode, classData);
                classesContainer.appendChild(classCard);
            });
        } else {
            classesContainer.innerHTML = '<p>You are not enrolled in any classes yet.</p>';
        }
    } catch (error) {
        console.error('Error loading classes:', error);
        showNotification('Failed to load classes. Please try again.', 'error');
    }
}

function createClassCard(classCode, classData) {
    const card = document.createElement('div');
    card.className = 'class-card';
    card.innerHTML = `
        <h3>${classData.name}</h3>
        <p>${classData.subject}</p>
        <p>Code: ${classCode}</p>
        <button onclick="showClassDetails('${classCode}')">View Details</button>
    `;
    return card;
}

// Show class details
window.showClassDetails = async function(classCode) {
    try {
        const classRef = ref(database, `classes/${classCode}`);
        const classSnapshot = await get(classRef);
        const classData = classSnapshot.val();

        const teacherRef = ref(database, `users/${classData.teacher}`);
        const teacherSnapshot = await get(teacherRef);
        const teacherData = teacherSnapshot.val();

        modalTitle.textContent = classData.name;
        modalBody.innerHTML = `
            <p><strong>Subject:</strong> ${classData.subject}</p>
            <p><strong>Description:</strong> ${classData.description || 'No description available.'}</p>
            <p><strong>Teacher:</strong> ${teacherData.username}</p>
            <p><strong>Class Code:</strong> ${classCode}</p>
            <p><strong>Created At:</strong> ${new Date(classData.createdAt).toLocaleString()}</p>
            <button onclick="leaveClass('${classCode}')">Leave Class</button>
            ${currentUser.uid === classData.teacher ? `
                <button onclick="editClass('${classCode}')">Edit Class</button>
                <button onclick="deleteClass('${classCode}')">Delete Class</button>
                <button onclick="addAssignment('${classCode}')">Add Assignment</button>
            ` : ''}
            <button onclick="viewAssignments('${classCode}')">View Assignments</button>
            <button onclick="showClassDiscussion('${classCode}')">Class Discussion</button>
        `;
        modal.style.display = 'block';
    } catch (error) {
        console.error('Error loading class details:', error);
        showNotification('Failed to load class details. Please try again.', 'error');
    }
}

// Leave class
window.leaveClass = async function(classCode) {
    if (confirm('Are you sure you want to leave this class?')) {
        try {
            const userClassRef = ref(database, `users/${currentUser.uid}/classes/${classCode}`);
            await remove(userClassRef);

            const classMemberRef = ref(database, `classes/${classCode}/members/${currentUser.uid}`);
            await remove(classMemberRef);

            showNotification('You have left the class.', 'success');
            modal.style.display = 'none';
            loadUserClasses();
        } catch (error) {
            console.error('Error leaving class:', error);
            showNotification('Failed to leave the class. Please try again.', 'error');
        }
    }
}

// Edit class
window.editClass = async function(classCode) {
    try {
        const classRef = ref(database, `classes/${classCode}`);
        const classSnapshot = await get(classRef);
        const classData = classSnapshot.val();

        const newName = prompt('Enter new class name:', classData.name);
        const newSubject = prompt('Enter new subject:', classData.subject);
        const newDescription = prompt('Enter new description:', classData.description);

        if (newName && newSubject) {
            await update(classRef, {
                name: newName,
                subject: newSubject,
                description: newDescription
            });

            showNotification('Class updated successfully!', 'success');
            showClassDetails(classCode);
            loadUserClasses();
        }
    } catch (error) {
        console.error('Error editing class:', error);
        showNotification('Failed to edit the class. Please try again.', 'error');
    }
}

// Delete class
window.deleteClass = async function(classCode) {
    if (confirm('Are you sure you want to delete this class? This action cannot be undone.')) {
        try {
            const classRef = ref(database, `classes/${classCode}`);
            const classSnapshot = await get(classRef);
            const classData = classSnapshot.val();

            // Remove class from all members
            const memberPromises = Object.keys(classData.members || {}).map(async (userId) => {
                const userClassRef = ref(database, `users/${userId}/classes/${classCode}`);
                await remove(userClassRef);
            });

            await Promise.all(memberPromises);

            // Delete the class
            await remove(classRef);

            showNotification('Class deleted successfully.', 'success');
            modal.style.display = 'none';
            loadUserClasses();
        } catch (error) {
            console.error('Error deleting class:', error);
            showNotification('Failed to delete the class. Please try again.', 'error');
        }
    }
}

// Profile management
profileLink.addEventListener('click', (e) => {
    e.preventDefault();
    showProfileModal();
});

async function showProfileModal() {
    try {
        const userRef = ref(database, `users/${currentUser.uid}`);
        const userSnapshot = await get(userRef);
        const userData = userSnapshot.val();

        modalTitle.textContent = 'User Profile';
        modalBody.innerHTML = `
            <p><strong>Username:</strong> ${userData.username}</p>
            <p><strong>Email:</strong> ${userData.email}</p>
            <p><strong>Role:</strong> ${userData.role}</p>
            <button onclick="editProfile()">Edit Profile</button>
            <button onclick="changePassword()">Change Password</button>
        `;
        modal.style.display = 'block';
    } catch (error) {
        console.error('Error loading user profile:', error);
        showNotification('Failed to load user profile. Please try again.', 'error');
    }
}

window.editProfile = async function() {
    try {
        const userRef = ref(database, `users/${currentUser.uid}`);
        const userSnapshot = await get(userRef);
        const userData = userSnapshot.val();

        const newUsername = prompt('Enter new username:', userData.username);
        if (newUsername && newUsername !== userData.username) {
            await update(userRef, { username: newUsername });
            await updateProfile(currentUser, { displayName: newUsername });
            showNotification('Profile updated successfully!', 'success');
            showProfileModal();
            loadUserData();
        }
    } catch (error) {
        console.error('Error updating profile:', error);
        showNotification('Failed to update profile. Please try again.', 'error');
    }
}

window.changePassword = async function() {
    const email = currentUser.email;
    try {
        await sendPasswordResetEmail(auth, email);
        showNotification('Password reset email sent. Check your inbox.', 'success');
    } catch (error) {
        console.error('Error sending password reset email:', error);
        showNotification('Failed to send password reset email. Please try again.', 'error');
    }
}

// Logout
logoutLink.addEventListener('click', (e) => {
    e.preventDefault();
    signOut(auth).then(() => {
        window.location.href = '/login.html';
    }).catch((error) => {
        console.error('Error signing out:', error);
        showNotification('Failed to sign out. Please try again.', 'error');
    });
});

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    // Check if user is already logged in
    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            loadUserData();
            loadUserClasses();
        } else {
            window.location.href = '/login.html';
        }
    });

    // Reset inactivity timer on user interaction
    document.addEventListener('mousemove', resetInactivityTimer);
    document.addEventListener('keypress', resetInactivityTimer);
});

// Export functions for use in HTML
window.joinClass = joinClass;
window.createClass = createClass;
window.showClassDetails = showClassDetails;
window.leaveClass = leaveClass;
window.editClass = editClass;
window.deleteClass = deleteClass;
window.editProfile = editProfile;
window.changePassword = changePassword;
window.addAssignment = addAssignment;
window.viewAssignments = viewAssignments;
window.editAssignment = editAssignment;
window.deleteAssignment = deleteAssignment;
window.showClassDiscussion = showClassDiscussion;
window.postMessage = postMessage;
