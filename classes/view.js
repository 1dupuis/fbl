import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { 
    getAuth,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { 
    getDatabase,
    ref,
    get,
    set,
    push,
    remove,
    update,
    onValue
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js";
import { 
    getStorage, 
    ref as storageRef, 
    uploadBytes, 
    getDownloadURL 
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-storage.js";

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
const auth = getAuth(app);
const database = getDatabase(app);
const storage = getStorage(app);

let currentUser = null;
let classId = null;
let classData = null;

// DOM Elements
const className = document.getElementById('className');
const classSubject = document.getElementById('classSubject');
const classDescription = document.getElementById('classDescription');
const classTeacher = document.getElementById('classTeacher');
const classCode = document.getElementById('classCode');
const editClassBtn = document.getElementById('editClassBtn');
const deleteClassBtn = document.getElementById('deleteClassBtn');
const leaveClassBtn = document.getElementById('leaveClassBtn');
const addAssignmentBtn = document.getElementById('addAssignmentBtn');
const assignmentsList = document.getElementById('assignmentsList');
const membersList = document.getElementById('membersList');
const discussionMessages = document.getElementById('discussionMessages');
const newMessage = document.getElementById('newMessage');
const postMessageBtn = document.getElementById('postMessageBtn');
const logoutLink = document.getElementById('logoutLink');
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modalTitle');
const modalBody = document.getElementById('modalBody');
const closeModal = document.getElementsByClassName('close')[0];
const chatContainer = document.getElementById('chatContainer');
const toggleChatBtn = document.getElementById('toggleChatBtn');
const profilePicUpload = document.getElementById('profilePicUpload');

// Initialize the view
function initializeView() {
    const urlParams = new URLSearchParams(window.location.search);
    classId = urlParams.get('class');
    const assignmentId = urlParams.get('id');
    const mode = urlParams.get('mode');

    if (!classId) {
        showNotification('Invalid class ID. Redirecting to dashboard...', 'error');
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 3000);
        return;
    }

    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            loadClassData();
            loadUserProfilePic();
            if (assignmentId && mode === 'edit') {
                loadAssignmentForEditing(assignmentId);
            }
        } else {
            window.location.href = 'account/signup';
        }
    });

    // Event listeners
    editClassBtn.addEventListener('click', editClass);
    deleteClassBtn.addEventListener('click', deleteClass);
    leaveClassBtn.addEventListener('click', leaveClass);
    addAssignmentBtn.addEventListener('click', addAssignment);
    postMessageBtn.addEventListener('click', postMessage);
    logoutLink.addEventListener('click', logout);
    toggleChatBtn.addEventListener('click', toggleChat);
    profilePicUpload.addEventListener('change', uploadProfilePic);
    closeModal.onclick = () => modal.style.display = "none";
    window.onclick = (event) => {
        if (event.target == modal) {
            modal.style.display = "none";
        }
    };
}

// Load class data
async function loadClassData() {
    try {
        const classRef = ref(database, `classes/${classId}`);
        const classSnapshot = await get(classRef);

        if (classSnapshot.exists()) {
            classData = classSnapshot.val();
            updateClassView();
            loadAssignments();
            loadMembers();
            setupDiscussion();
        } else {
            showNotification('Class not found.', 'error');
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 3000);
        }
    } catch (error) {
        console.error('Error loading class data:', error);
        showNotification('Failed to load class data. Please try again.', 'error');
    }
}

// Update class view
function updateClassView() {
    className.textContent = classData.name;
    classSubject.textContent = classData.subject;
    classDescription.textContent = classData.description || 'No description available.';
    classCode.textContent = classId;

    // Show/hide buttons based on user role
    if (currentUser.uid === classData.teacher) {
        editClassBtn.classList.remove('hidden');
        deleteClassBtn.classList.remove('hidden');
        addAssignmentBtn.classList.remove('hidden');
    } else {
        leaveClassBtn.classList.remove('hidden');
    }

    // Load teacher's name
    loadTeacherName();
}

// Load teacher's name
async function loadTeacherName() {
    try {
        const teacherRef = ref(database, `users/${classData.teacher}`);
        const teacherSnapshot = await get(teacherRef);
        if (teacherSnapshot.exists()) {
            const teacherData = teacherSnapshot.val();
            classTeacher.textContent = teacherData.username;
        }
    } catch (error) {
        console.error('Error loading teacher name:', error);
        classTeacher.textContent = 'Unknown';
    }
}

// Load assignments
async function loadAssignments() {
    try {
        const assignmentsRef = ref(database, `classes/${classId}/assignments`);
        onValue(assignmentsRef, (snapshot) => {
            assignmentsList.innerHTML = '';
            if (snapshot.exists()) {
                const assignments = snapshot.val();
                for (const [id, assignment] of Object.entries(assignments)) {
                    const assignmentElement = document.createElement('div');
                    assignmentElement.className = 'assignment';
                    assignmentElement.innerHTML = `
                        <h3>${assignment.title}</h3>
                        <p>${assignment.description}</p>
                        <p>Due: ${new Date(assignment.dueDate).toLocaleString()}</p>
                        <button onclick="viewAssignment('${id}')">View</button>
                        <button onclick="workOnAssignment('${id}')">Work on Assignment</button>
                        ${currentUser.uid === classData.teacher ? `
                            <button onclick="editAssignment('${id}')">Edit</button>
                            <button onclick="deleteAssignment('${id}')">Delete</button>
                        ` : ''}
                    `;
                    assignmentsList.appendChild(assignmentElement);
                }
            } else {
                assignmentsList.innerHTML = '<p>No assignments yet.</p>';
            }
        });
    } catch (error) {
        console.error('Error loading assignments:', error);
        showNotification('Failed to load assignments. Please try again.', 'error');
    }
}

// Load members
async function loadMembers() {
    try {
        const membersRef = ref(database, `classes/${classId}/members`);
        const membersSnapshot = await get(membersRef);
        membersList.innerHTML = '';
        if (membersSnapshot.exists()) {
            const members = membersSnapshot.val();
            for (const [userId, value] of Object.entries(members)) {
                const userRef = ref(database, `users/${userId}`);
                const userSnapshot = await get(userRef);
                if (userSnapshot.exists()) {
                    const userData = userSnapshot.val();
                    const memberElement = document.createElement('div');
                    memberElement.className = 'member';
                    memberElement.innerHTML = `
                        <img src="${userData.profilePicUrl || '/default-profile-pic.jpg'}" alt="${userData.username}" class="profile-pic">
                        <p>${userData.username} (${userData.role})</p>
                        ${currentUser.uid === classData.teacher && userId !== classData.teacher ? `
                            <button onclick="removeMember('${userId}')">Remove</button>
                        ` : ''}
                    `;
                    membersList.appendChild(memberElement);
                }
            }
        } else {
            membersList.innerHTML = '<p>No members yet.</p>';
        }
    } catch (error) {
        console.error('Error loading members:', error);
        showNotification('Failed to load members. Please try again.', 'error');
    }
}

// Setup discussion
function setupDiscussion() {
    const discussionRef = ref(database, `classes/${classId}/discussion`);
    onValue(discussionRef, (snapshot) => {
        discussionMessages.innerHTML = '';
        if (snapshot.exists()) {
            const messages = snapshot.val();
            const sortedMessages = Object.entries(messages)
                .sort(([, a], [, b]) => new Date(b.timestamp) - new Date(a.timestamp));
            for (const [id, message] of sortedMessages) {
                const messageElement = document.createElement('div');
                messageElement.className = 'message';
                messageElement.innerHTML = `
                    <img src="${message.profilePicUrl || '/default-profile-pic.jpg'}" alt="${message.username}" class="profile-pic">
                    <div class="message-content">
                        <strong>${message.username}</strong>
                        <p>${message.content}</p>
                        <small>${new Date(message.timestamp).toLocaleString()}</small>
                    </div>
                `;
                discussionMessages.insertBefore(messageElement, discussionMessages.firstChild);
            }
        } else {
            discussionMessages.innerHTML = '<p>No messages yet.</p>';
        }
    });
}

// Post message
async function postMessage() {
    const content = newMessage.value.trim();
    if (content) {
        try {
            const discussionRef = ref(database, `classes/${classId}/discussion`);
            const newMessageRef = push(discussionRef);
            await set(newMessageRef, {
                content: content,
                username: currentUser.displayName,
                userId: currentUser.uid,
                timestamp: new Date().toISOString(),
                profilePicUrl: currentUser.photoURL || null
            });
            newMessage.value = '';
        } catch (error) {
            console.error('Error posting message:', error);
            showNotification('Failed to post message. Please try again.', 'error');
        }
    }
}

// Edit class
async function editClass() {
    try {
        const newName = prompt('Enter new class name:', classData.name);
        const newSubject = prompt('Enter new subject:', classData.subject);
        const newDescription = prompt('Enter new description:', classData.description);

        if (newName && newSubject) {
            const updates = {
                name: newName,
                subject: newSubject,
                description: newDescription
            };
            await update(ref(database, `classes/${classId}`), updates);
            showNotification('Class updated successfully!', 'success');
            loadClassData();
        }
    } catch (error) {
        console.error('Error editing class:', error);
        showNotification('Failed to edit class. Please try again.', 'error');
    }
}

// Delete class
async function deleteClass() {
    if (confirm('Are you sure you want to delete this class? This action cannot be undone.')) {
        try {
            await remove(ref(database, `classes/${classId}`));
            showNotification('Class deleted successfully.', 'success');
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 2000);
        } catch (error) {
            console.error('Error deleting class:', error);
            showNotification('Failed to delete class. Please try again.', 'error');
        }
    }
}

// Leave class
async function leaveClass() {
    if (confirm('Are you sure you want to leave this class?')) {
        try {
            await remove(ref(database, `classes/${classId}/members/${currentUser.uid}`));
            await remove(ref(database, `users/${currentUser.uid}/classes/${classId}`));
            showNotification('You have left the class.', 'success');
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 2000);
        } catch (error) {
            console.error('Error leaving class:', error);
            showNotification('Failed to leave class. Please try again.', 'error');
        }
    }
}

// Add assignment
async function addAssignment() {
    try {
        const title = prompt('Enter assignment title:');
        const description = prompt('Enter assignment description:');
        const dueDate = prompt('Enter due date (YYYY-MM-DD):');

        if (title && description && dueDate) {
            const assignmentsRef = ref(database, `classes/${classId}/assignments`);
            const newAssignmentRef = push(assignmentsRef);
            await set(newAssignmentRef, {
                title,
                description,
                dueDate,
                createdAt: new Date().toISOString(),
                teacherId: currentUser.uid
            });
            showNotification('Assignment added successfully!', 'success');
        }
    } catch (error) {
        console.error('Error adding assignment:', error);
        showNotification('Failed to add assignment. Please try again.', 'error');
    }
}

// View assignment
function viewAssignment(assignmentId) {
    // Implement view assignment functionality
    console.log('View assignment:', assignmentId);
    // You can open a modal or navigate to a new page to show assignment details
}

// Work on assignment
function workOnAssignment(assignmentId) {
    window.location.href = `projects/assignment?id=${assignmentId}&class=${classId}&mode=edit`;
}

// Edit assignment
async function editAssignment(assignmentId) {
    try {
        const assignmentRef = ref(database, `classes/${classId}/assignments/${assignmentId}`);
        const assignmentSnapshot = await get(assignmentRef);
        const assignment = assignmentSnapshot.val();

        const newTitle = prompt('Enter new title:', assignment.title);
        const newDescription = prompt('Enter new description:', assignment.description);
        const newDueDate = prompt('Enter new due date (YYYY-MM-DD):', assignment.dueDate);

        if (newTitle && newDescription && newDueDate) {
            await update(assignmentRef, {
                title: newTitle,
                description: newDescription,
                dueDate: newDueDate,
                updatedAt: new Date().toISOString()
            });
            showNotification('Assignment updated successfully!', 'success');
        }
    } catch (error) {
        console.error('Error editing assignment:', error);
        showNotification('Failed to edit assignment. Please try again.', 'error');
    }
}

// Delete assignment
async function deleteAssignment(assignmentId) {
    if (confirm('Are you sure you want to delete this assignment?')) {
        try {
            await remove(ref(database, `classes/${classId}/assignments/${assignmentId}`));
            showNotification('Assignment deleted successfully.', 'success');
        } catch (error) {
            console.error('Error deleting assignment:', error);
            showNotification('Failed to delete assignment. Please try again.', 'error');
        }
    }
}

// Remove member
async function removeMember(userId) {
    if (confirm('Are you sure you want to remove this member from the class?')) {
        try {
            await remove(ref(database, `classes/${classId}/members/${userId}`));
            await remove(ref(database, `users/${userId}/classes/${classId}`));
            showNotification('Member removed successfully.', 'success');
            loadMembers();
        } catch (error) {
            console.error('Error removing member:', error);
            showNotification('Failed to remove member. Please try again.', 'error');
        }
    }
}

// Logout
function logout() {
    signOut(auth).then(() => {
        window.location.href = 'account/signup';
    }).catch((error) => {
        console.error('Error signing out:', error);
        showNotification('Failed to sign out. Please try again.', 'error');
    });
}

// Show notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Toggle chat
function toggleChat() {
    chatContainer.classList.toggle('minimized');
    if (chatContainer.classList.contains('minimized')) {
        toggleChatBtn.textContent = 'Maximize Chat';
    } else {
        toggleChatBtn.textContent = 'Minimize Chat';
    }
}

// Upload profile picture
async function uploadProfilePic(event) {
    const file = event.target.files[0];
    if (file) {
        try {
            const storageReference = storageRef(storage, `profile_pics/${currentUser.uid}`);
            await uploadBytes(storageReference, file);
            const downloadURL = await getDownloadURL(storageReference);
            await update(ref(database, `users/${currentUser.uid}`), {
                profilePicUrl: downloadURL
            });
            showNotification('Profile picture updated successfully!', 'success');
            loadUserProfilePic();
        } catch (error) {
            console.error('Error uploading profile picture:', error);
            showNotification('Failed to upload profile picture. Please try again.', 'error');
        }
    }
}

// Load user profile picture
async function loadUserProfilePic() {
    try {
        const userRef = ref(database, `users/${currentUser.uid}`);
        const userSnapshot = await get(userRef);
        if (userSnapshot.exists()) {
            const userData = userSnapshot.val();
            if (userData.profilePicUrl) {
                document.getElementById('userProfilePic').src = userData.profilePicUrl;
            }
        }
    } catch (error) {
        console.error('Error loading user profile picture:', error);
    }
}

// Load assignment for editing
async function loadAssignmentForEditing(assignmentId) {
    try {
        const assignmentRef = ref(database, `classes/${classId}/assignments/${assignmentId}`);
        const assignmentSnapshot = await get(assignmentRef);
        if (assignmentSnapshot.exists()) {
            const assignment = assignmentSnapshot.val();
            // Populate form fields or update UI with assignment details
            document.getElementById('assignmentTitle').value = assignment.title;
            document.getElementById('assignmentDescription').value = assignment.description;
            document.getElementById('assignmentDueDate').value = assignment.dueDate;
            // Add more fields as necessary
        } else {
            showNotification('Assignment not found.', 'error');
        }
    } catch (error) {
        console.error('Error loading assignment for editing:', error);
        showNotification('Failed to load assignment. Please try again.', 'error');
    }
}

// Save assignment changes
async function saveAssignmentChanges(assignmentId) {
    try {
        const title = document.getElementById('assignmentTitle').value;
        const description = document.getElementById('assignmentDescription').value;
        const dueDate = document.getElementById('assignmentDueDate').value;
        // Get more fields as necessary

        if (title && description && dueDate) {
            const assignmentRef = ref(database, `classes/${classId}/assignments/${assignmentId}`);
            await update(assignmentRef, {
                title,
                description,
                dueDate,
                updatedAt: new Date().toISOString()
            });
            showNotification('Assignment updated successfully!', 'success');
            // Redirect back to class view or update UI as needed
        } else {
            showNotification('Please fill in all required fields.', 'error');
        }
    } catch (error) {
        console.error('Error saving assignment changes:', error);
        showNotification('Failed to save changes. Please try again.', 'error');
    }
}

// Initialize the view
initializeView();

// Make functions available globally
window.viewAssignment = viewAssignment;
window.editAssignment = editAssignment;
window.deleteAssignment = deleteAssignment;
window.removeMember = removeMember;
window.workOnAssignment = workOnAssignment;
window.saveAssignmentChanges = saveAssignmentChanges;
