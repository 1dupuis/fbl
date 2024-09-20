// Import Firebase modules ////
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { 
    getAuth,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { 
    getDatabase,
    ref, 
    set, 
    get, 
    onValue,
    push
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js";

// Import Three.js and OrbitControls
//import * as THREE from 'three';
//import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

// Initialize Firebase (replace with your own config)
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

// State variables
let currentUser = null;
let currentAssignment = null;
let currentClass = null;
let currentMode = '3d';
let currentPage = 0;
let pages = [];
let isEditing = false;
let isDragging = false;
let lastMousePosition = { x: 0, y: 0 };

// Three.js variables
let scene, camera, renderer, book, light, controls;

// Function to initialize the 3D scene
function init3DScene() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0xE8F0FE, 1);
    document.getElementById('bookContainer').appendChild(renderer.domElement);

    // Create book geometry
    const bookGeometry = new THREE.BoxGeometry(5, 7, 0.5);
    const bookMaterials = [
        new THREE.MeshPhongMaterial({ color: 0x1E88E5 }), // Right side
        new THREE.MeshPhongMaterial({ color: 0x1E88E5 }), // Left side
        new THREE.MeshPhongMaterial({ color: 0x1565C0 }), // Top side
        new THREE.MeshPhongMaterial({ color: 0x1565C0 }), // Bottom side
        new THREE.MeshPhongMaterial({ color: 0xFFFFFF, map: new THREE.Texture() }), // Front side (page)
        new THREE.MeshPhongMaterial({ color: 0x1565C0 })  // Back side
    ];
    book = new THREE.Mesh(bookGeometry, bookMaterials);
    scene.add(book);

    // Add lighting
    light = new THREE.PointLight(0xFFFFFF, 1, 100);
    light.position.set(0, 0, 10);
    scene.add(light);

    const ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);

    camera.position.z = 10;

    // Add OrbitControls
    controls = new OrbitControls(camera, renderer.domElement); //THREE.OrbitControls not working?
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;
    controls.enableZoom = true;

    // Add event listeners for 3D interactions
    renderer.domElement.addEventListener('mousedown', onMouseDown);
    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('mouseup', onMouseUp);
    renderer.domElement.addEventListener('touchstart', onTouchStart, { passive: false });
    renderer.domElement.addEventListener('touchmove', onTouchMove, { passive: false });
    renderer.domElement.addEventListener('touchend', onTouchEnd);

    // Add event listener for window resize
    window.addEventListener('resize', onWindowResize, false);

    animate();
}

// Function to handle window resize
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

// Mouse and touch event handlers
function onMouseDown(event) {
    isDragging = true;
    lastMousePosition = {
        x: event.clientX,
        y: event.clientY
    };
}

function onMouseMove(event) {
    if (!isDragging) return;
    const deltaMove = {
        x: event.clientX - lastMousePosition.x,
        y: event.clientY - lastMousePosition.y
    };
    rotateBook(deltaMove);
    lastMousePosition = {
        x: event.clientX,
        y: event.clientY
    };
}

function onMouseUp() {
    isDragging = false;
}

function onTouchStart(event) {
    if (event.touches.length === 1) {
        event.preventDefault();
        isDragging = true;
        lastMousePosition = {
            x: event.touches[0].pageX,
            y: event.touches[0].pageY
        };
    }
}

function onTouchMove(event) {
    if (!isDragging || event.touches.length !== 1) return;
    event.preventDefault();
    const deltaMove = {
        x: event.touches[0].pageX - lastMousePosition.x,
        y: event.touches[0].pageY - lastMousePosition.y
    };
    rotateBook(deltaMove);
    lastMousePosition = {
        x: event.touches[0].pageX,
        y: event.touches[0].pageY
    };
}

function onTouchEnd() {
    isDragging = false;
}

function rotateBook(deltaMove) {
    book.rotation.y += deltaMove.x * 0.005;
    book.rotation.x += deltaMove.y * 0.005;
}

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
            setPageMode(currentMode);
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
        <h2>${escapeHtml(currentAssignment.title)}</h2>
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
            pages = submission.pages || [''];
        } else {
            pages = [''];
        }
        currentPage = 0;
        updateBookContent();
    } catch (error) {
        console.error('Error loading submission:', error);
        showNotification('Failed to load submission. Please try again.', 'error');
    }
}

// Function to save submission
async function saveSubmission() {
    try {
        const submissionRef = ref(database, `submissions/${currentClass}/${currentAssignment.id}/${currentUser.uid}`);
        await set(submissionRef, {
            pages: pages,
            lastUpdated: new Date().toISOString()
        });
        showNotification('Submission saved successfully!', 'success');
    } catch (error) {
        console.error('Error saving submission:', error);
        showNotification('Failed to save submission. Please try again.', 'error');
    }
}

// Function to update book content
function updateBookContent() {
    if (currentMode === '3d') {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'black';
        ctx.font = '24px Arial';
        
        const lines = pages[currentPage].split('\n');
        lines.forEach((line, index) => {
            ctx.fillText(line, 20, 40 + (index * 30), 472);
        });
        
        const texture = new THREE.CanvasTexture(canvas);
        book.material[4].map = texture;
        book.material[4].needsUpdate = true;
    } else {
        document.getElementById('submissionContent').value = pages[currentPage];
    }
    document.getElementById('pageNumber').textContent = `Page ${currentPage + 1} of ${pages.length}`;
}

// Function to set page mode (3d or 2d)
function setPageMode(mode) {
    currentMode = mode;
    document.getElementById('bookContainer').style.display = currentMode === '3d' ? 'block' : 'none';
    document.getElementById('2dView').style.display = currentMode === '2d' ? 'block' : 'none';
    updateBookContent();
}

// Function to show notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Function to handle page navigation
function navigatePage(direction) {
    if (direction === 'prev' && currentPage > 0) {
        currentPage--;
    } else if (direction === 'next' && currentPage < pages.length - 1) {
        currentPage++;
    }
    updateBookContent();
}

// Function to add a new page
function addPage() {
    pages.push('');
    currentPage = pages.length - 1;
    updateBookContent();
}

// Function to delete the current page
function deletePage() {
    if (pages.length > 1) {
        pages.splice(currentPage, 1);
        if (currentPage >= pages.length) {
            currentPage = pages.length - 1;
        }
        updateBookContent();
    } else {
        showNotification('Cannot delete the only page.', 'error');
    }
}

// Function to handle content editing
function handleContentEdit() {
    if (currentMode === '2d') {
        pages[currentPage] = document.getElementById('submissionContent').value;
        updateBookContent();
    }
}

// Function to toggle edit mode
function toggleEditMode() {
    isEditing = !isEditing;
    const editButton = document.getElementById('toggleEdit');
    editButton.textContent = isEditing ? 'Save' : 'Edit';
    document.getElementById('submissionContent').readOnly = !isEditing;
    if (!isEditing) {
        handleContentEdit();
    }
}

// Function to sign out
function signOutUser() {
    signOut(auth).then(() => {
        window.location.href = '/account/login';
    }).catch((error) => {
        console.error('Error signing out:', error);
        showNotification('Failed to sign out. Please try again.', 'error');
    });
}

// Function to export assignment as PDF
function exportToPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    pages.forEach((page, index) => {
        if (index > 0) {
            doc.addPage();
        }
        doc.setFontSize(12);
        doc.text(page, 10, 10);
    });
    
    doc.save(`${currentAssignment.title}.pdf`);
}

// Utility function to escape HTML
function escapeHtml(unsafe) {
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const assignmentId = urlParams.get('id');
    const classCode = urlParams.get('class');
    const mode = urlParams.get('mode');

    if (!assignmentId || !classCode) {
        showNotification('Invalid assignment or class.', 'error');
        return;
    }

    init3DScene();

    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            loadAssignment(assignmentId, classCode).then(() => {
                document.getElementById('loadingIndicator').style.display = 'none';
                document.getElementById('content').style.display = 'block';
                if (mode === 'edit') {
                    setPageMode('2d');
                    toggleEditMode();
                }
            });
        } else {
            window.location.href = '/account/login';
        }
    });

    // Event listeners for controls
    document.getElementById('prevPage').addEventListener('click', () => navigatePage('prev'));
    document.getElementById('nextPage').addEventListener('click', () => navigatePage('next'));
    document.getElementById('addPage').addEventListener('click', addPage);
    document.getElementById('deletePage').addEventListener('click', deletePage);
    document.getElementById('saveBook').addEventListener('click', saveSubmission);
    document.getElementById('toggleViewMode').addEventListener('click', () => setPageMode(currentMode === '3d' ? '2d' : '3d'));
    document.getElementById('toggleEdit').addEventListener('click', toggleEditMode);
    document.getElementById('submissionContent').addEventListener('input', handleContentEdit);
    document.getElementById('signOut').addEventListener('click', signOutUser);
    document.getElementById('exportPDF').addEventListener('click', exportToPDF);

    // Add key event listeners for page navigation
    document.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowLeft') {
            navigatePage('prev');
        } else if (event.key === 'ArrowRight') {
            navigatePage('next');
        }
    });

    // Set up auto-save functionality
    let autoSaveTimer;
    document.getElementById('submissionContent').addEventListener('input', () => {
        clearTimeout(autoSaveTimer);
        autoSaveTimer = setTimeout(saveSubmission, 5000); // Auto-save after 5 seconds of inactivity
    });

    // Set up confirmation before leaving the page
    window.addEventListener('beforeunload', (event) => {
        if (isEditing) {
            event.preventDefault(); // Cancel the event
            event.returnValue = ''; // Display a default message in most browsers
        }
    });
});

// Error handling wrapper
function errorHandler(func) {
    return function (...args) {
        try {
            return func.apply(this, args);
        } catch (error) {
            console.error(`Error in ${func.name}:`, error);
            showNotification(`An error occurred. Please try again.`, 'error');
        }
    };
}

// Wrap all exported functions with error handler
Object.keys(window).forEach(key => {
    if (typeof window[key] === 'function' && key !== 'errorHandler') {
        window[key] = errorHandler(window[key]);
    }
});
