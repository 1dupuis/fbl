// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { 
    getAuth,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { 
    getDatabase,
    ref, 
    set, 
    get, 
    onValue
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js";

// Initialize Firebase (use the same config as in dashboard.js)
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

let currentUser = null;
let currentAssignment = null;
let currentClass = null;
let currentMode = null;

// Function to load assignment details
async function loadAssignment(assignmentId, classCode) {
    try {
        const assignmentRef = ref(database, `classes/${classCode}/assignments/${assignmentId}`);
        const assignmentSnapshot = await get(assignmentRef);
        
        if (assignmentSnapshot.exists()) {
            currentAssignment = assignmentSnapshot.val();
            currentAssignment.id = assignmentId;
            currentClass = classCode;
            displayAssignmentDetails();
            await loadSubmission();
            setPageMode();
        } else {
            showNotification('Assignment not found.', 'error');
        }
    } catch (error) {
        console.error('Error loading assignment:', error);
        showNotification('Failed to load assignment. Please try again.', 'error');
    }
}

// Function to display assignment details
function displayAssignmentDetails() {
    const detailsElement = document.getElementById('assignmentDetails');
    const converter = new showdown.Converter();
    const descriptionHtml = converter.makeHtml(currentAssignment.description);
    
    detailsElement.innerHTML = `
        <h2>${currentAssignment.title}</h2>
        <div>${descriptionHtml}</div>
        <p><strong>Due:</strong> ${new Date(currentAssignment.dueDate).toLocaleString()}</p>
    `;
}

// Function to load user's submission
async function loadSubmission() {
    try {
        const submissionRef = ref(database, `submissions/${currentClass}/${currentAssignment.id}/${currentUser.uid}`);
        const submissionSnapshot = await get(submissionRef);
        
        if (submissionSnapshot.exists()) {
            const submission = submissionSnapshot.val();
            if (currentMode === 'edit') {
                document.getElementById('submissionContent').value = submission.content;
            } else {
                const converter = new showdown.Converter();
                const contentHtml = converter.makeHtml(submission.content);
                document.getElementById('submissionContent').innerHTML = contentHtml;
            }
        }
    } catch (error) {
        console.error('Error loading submission:', error);
        showNotification('Failed to load submission. Please try again.', 'error');
    }
}

// Function to save submission
async function saveSubmission() {
    const content = document.getElementById('submissionContent').value;
    try {
        const submissionRef = ref(database, `submissions/${currentClass}/${currentAssignment.id}/${currentUser.uid}`);
        await set(submissionRef, {
            content: content,
            lastUpdated: new Date().toISOString()
        });
        showNotification('Submission saved successfully!', 'success');
    } catch (error) {
        console.error('Error saving submission:', error);
        showNotification('Failed to save submission. Please try again.', 'error');
    }
}

// Function to set page mode (edit or view)
function setPageMode() {
    document.getElementById('pageTitle').textContent = currentMode === 'edit' ? 'Edit Assignment' : 'View Assignment';
    document.getElementById('editMode').style.display = currentMode === 'edit' ? 'block' : 'none';
    document.getElementById('viewMode').style.display = currentMode === 'view' ? 'block' : 'none';
}

// Notification function
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const assignmentId = urlParams.get('id');
    const classCode = urlParams.get('class');
    currentMode = urlParams.get('mode') || 'view';

    if (!assignmentId || !classCode) {
        showNotification('Invalid assignment or class.', 'error');
        return;
    }

    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            loadAssignment(assignmentId, classCode).then(() => {
                document.getElementById('loadingIndicator').style.display = 'none';
                document.getElementById('content').style.display = 'block';
            });
        } else {
            window.location.href = '/login.html';
        }
    });

    // Add event listener for save button if in edit mode
    const saveButton = document.getElementById('saveSubmission');
    if (saveButton) {
        saveButton.addEventListener('click', saveSubmission);
    }
});

// Export functions for use in HTML
window.saveSubmission = saveSubmission;
