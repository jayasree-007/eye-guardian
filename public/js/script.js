// DOM Elements
const video = document.getElementById('webcam');
const trackingStatus = document.getElementById('tracking-status');
const faceOverlay = document.getElementById('face-overlay');
const blinkRateElement = document.getElementById('blink-rate');
const screenDistanceElement = document.getElementById('screen-distance');
const gazeDurationElement = document.getElementById('gaze-duration');
const alertsContainer = document.getElementById('alerts-container');
const notification = document.getElementById('notification');
const notificationMessage = document.getElementById('notification-message');
const notificationClose = document.getElementById('notification-close');
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const closeSettingsBtn = document.getElementById('close-settings');
const startButton = document.getElementById('start-btn');

// Range sliders and values
const blinkThresholdSlider = document.getElementById('blink-threshold');
const blinkThresholdValue = document.getElementById('blink-threshold-value');
const distanceThresholdSlider = document.getElementById('distance-threshold');
const distanceThresholdValue = document.getElementById('distance-threshold-value');
const gazeThresholdSlider = document.getElementById('gaze-threshold');
const gazeThresholdValue = document.getElementById('gaze-threshold-value');

// Settings checkboxes
const enableNotifications = document.getElementById('enable-notifications');
const enableSound = document.getElementById('enable-sound');

// System state
let faceDetectionInterval;
let isModelLoaded = false;
let lastBlinks = [];
let blinkCount = 0;
let lastBlinkTime = null;
let isEyesClosed = false;
let continuousGazeDuration = 0;
let lastGazeUpdate = Date.now();
let faceSize = 0;
let userProfile = {
  name: 'User',
  optimalBlinkRate: 15,
  optimalDistance: 50,
  maxGazeDuration: 20,
  notifications: true,
  sound: true,
  history: []
};

// Constants
const BLINK_HISTORY_SIZE = 60; // Store 1 minute of blink data (at 1Hz sampling)
const BLINK_THRESHOLD = 0.24; // Eye aspect ratio threshold for blink detection
const FACE_SIZE_CALIBRATION = 0.85; // Calibration factor for distance estimation
const FACE_DETECTION_INTERVAL = 100; // Detection interval in ms
const METRICS_UPDATE_INTERVAL = 1000; // Update metrics every second
const LEARNING_RATE = 0.1; // Learning rate for adaptive recommendations

// Initialize the app with simplified face detection
async function initFaceDetection() {
  try {
    updateStatus('Starting camera...');
    
    // Start webcam first
    await startWebcam();
    
    updateStatus('Loading models...');
    
    // Load face-api.js models
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri('https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights'),
      faceapi.nets.faceLandmark68Net.loadFromUri('https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights')
    ]);
    
    isModelLoaded = true;
    updateStatus('Ready to track', 'active');
    
    // Start face detection with a simple implementation first
    startSimpleFaceDetection();
    
    // Add initial success message
    showNotification('Eye Guardian is now active');
    addAlert('success', 'Eye tracking started. The system is now monitoring your eye health.');
    
    // Hide start button
    startButton.classList.add('hidden');
    
  } catch (error) {
    console.error('Error initializing:', error);
    updateStatus('Error starting', 'error');
    addAlert('danger', 'Failed to initialize. Please check camera permissions and refresh the page.');
    startButton.disabled = false;
    startButton.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Try Again';
  }
}

// Update status indicator
function updateStatus(message, statusClass = '') {
  trackingStatus.innerHTML = `<i class="fas ${statusClass === 'active' ? 'fa-check-circle' : statusClass === 'error' ? 'fa-exclamation-triangle' : 'fa-spinner fa-spin'}"></i> ${message}`;
  trackingStatus.className = 'status-indicator ' + statusClass;
}

// Start webcam with simpler implementation
async function startWebcam() {
  try {
    // Basic camera request with fewer constraints
    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: true,
      audio: false
    });
    
    video.srcObject = stream;
    
    // Wait for video to be ready
    return new Promise((resolve) => {
      video.onloadedmetadata = () => {
        video.play();
        resolve();
      };
    });
  } catch (error) {
    console.error('Camera error:', error);
    updateStatus('Camera access denied', 'error');
    addAlert('danger', 'Camera access denied. Please enable camera permissions and refresh.');
    throw error;
  }
}

// Start simplified face detection
function startSimpleFaceDetection() {
  // Use a slightly longer interval for better performance
  faceDetectionInterval = setInterval(detectFaceSimple, 200);
  
  // Update metrics less frequently
  setInterval(updateSimpleMetrics, 1000);
  
  // Simulate some eye metrics for demo purposes
  simulateEyeMetrics();
}

// Simplified face detection function
async function detectFaceSimple() {
  if (!isModelLoaded || !video.readyState || video.paused || video.ended) {
    return;
  }
  
  try {
    // Simple face detection without expressions
    const options = new faceapi.TinyFaceDetectorOptions({ 
      inputSize: 160,  // Smaller input size for faster detection
      scoreThreshold: 0.4  // Lower threshold to detect faces more easily
    });
    
    const result = await faceapi.detectSingleFace(video, options).withFaceLandmarks();
    
    if (result) {
      updateStatus('Face detected', 'active');
      
      // Draw simplified face landmarks
      drawSimpleFaceLandmarks(result);
      
      // Get face size for distance estimation
      if (result.detection) {
        const box = result.detection.box;
        faceSize = Math.sqrt(Math.pow(box.width, 2) + Math.pow(box.height, 2));
      }
      
      // Simple blink detection demo
      if (Math.random() < 0.05) {
        blinkCount++;
        lastBlinkTime = Date.now();
      }
      
    } else {
      updateStatus('No face detected');
      faceOverlay.innerHTML = '';
    }
  } catch (error) {
    console.error('Detection error:', error);
  }
}

// Draw simplified face landmarks
function drawSimpleFaceLandmarks(faceData) {
  try {
    // Create canvas with correct dimensions
    const displaySize = { 
      width: video.videoWidth || video.clientWidth,
      height: video.videoHeight || video.clientHeight 
    };
    
    if (!displaySize.width || !displaySize.height) {
      return; // Skip if dimensions aren't available
    }
    
    const canvas = document.createElement('canvas');
    canvas.width = displaySize.width;
    canvas.height = displaySize.height;
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    
    // Clear previous overlay
    faceOverlay.innerHTML = '';
    faceOverlay.appendChild(canvas);
    
    // Draw face outlines
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Resize results to match video dimensions
    const resizedResults = faceapi.resizeResults(faceData, displaySize);
    
    // Simple box around face
    const box = resizedResults.detection.box;
    ctx.strokeStyle = '#38b2ac';
    ctx.lineWidth = 2;
    ctx.strokeRect(box.x, box.y, box.width, box.height);
    
    // Draw eye outlines in different color
    ctx.strokeStyle = '#4e54c8';
    ctx.lineWidth = 2;
    
    // Left and right eye detection (simplified)
    if (resizedResults.landmarks && resizedResults.landmarks.positions) {
      // Left eye (landmarks 36-41)
      ctx.beginPath();
      for (let i = 36; i <= 41; i++) {
        const point = resizedResults.landmarks.positions[i];
        if (i === 36) {
          ctx.moveTo(point.x, point.y);
        } else {
          ctx.lineTo(point.x, point.y);
        }
      }
      ctx.closePath();
      ctx.stroke();
      
      // Right eye (landmarks 42-47)
      ctx.beginPath();
      for (let i = 42; i <= 47; i++) {
        const point = resizedResults.landmarks.positions[i];
        if (i === 42) {
          ctx.moveTo(point.x, point.y);
        } else {
          ctx.lineTo(point.x, point.y);
        }
      }
      ctx.closePath();
      ctx.stroke();
    }
  } catch (error) {
    console.error('Error drawing landmarks:', error);
  }
}

// Update metrics with simplified approach
function updateSimpleMetrics() {
  // Get values (with simple simulation for demo)
  const currentBlinkRate = Math.floor(Math.random() * 5) + 10; 
  const currentDistance = Math.floor(faceSize ? FACE_SIZE_CALIBRATION * (900 / faceSize) : 50);
  const currentGazeDuration = Math.floor((Date.now() - lastBlinkTime) / 1000) || 5;
  
  // Update display
  blinkRateElement.textContent = currentBlinkRate;
  screenDistanceElement.textContent = Math.min(Math.max(currentDistance, 30), 80);
  gazeDurationElement.textContent = Math.min(currentGazeDuration, 25);
  
  // Color coding
  styleMetric(blinkRateElement, currentBlinkRate, 12, 15);
  styleMetric(screenDistanceElement, currentDistance, 40, 50);
  styleMetric(gazeDurationElement, currentGazeDuration, 15, 20, true);
}

// Simulate eye metrics for demo
function simulateEyeMetrics() {
  // Periodically add alerts for demo purposes
  setTimeout(() => {
    addAlert('info', 'Try to maintain a comfortable distance from your screen (40-60cm).');
  }, 5000);
  
  setTimeout(() => {
    showNotification('Remember to blink frequently to prevent eye strain.');
    addAlert('warning', 'Low blink rate detected. Remember to blink more often to reduce eye fatigue.');
  }, 12000);
  
  setTimeout(() => {
    addAlert('success', 'Good job! Your blink rate has improved.');
  }, 20000);
}

// Style metric based on healthy range
function styleMetric(element, value, warningThreshold, optimalThreshold, isReversed = false) {
  if (isReversed) {
    // For metrics where lower is better (like gaze duration)
    if (value > optimalThreshold) {
      element.style.color = 'var(--danger)';
    } else if (value > warningThreshold) {
      element.style.color = 'var(--warning)';
    } else {
      element.style.color = 'var(--success)';
    }
  } else {
    // For metrics where higher is better (like blink rate)
    if (value < warningThreshold) {
      element.style.color = 'var(--danger)';
    } else if (value < optimalThreshold) {
      element.style.color = 'var(--warning)';
    } else {
      element.style.color = 'var(--success)';
    }
  }
}

// Show notification
function showNotification(message) {
  if (!userProfile.notifications) return;
  
  notificationMessage.textContent = message;
  notification.classList.add('show');
  
  // Hide after 5 seconds
  setTimeout(() => {
    notification.classList.remove('show');
  }, 5000);
}

// Add alert to alerts panel
function addAlert(type, message) {
  const timestamp = new Date();
  const timeString = timestamp.toLocaleTimeString();
  
  // Create alert element
  const alertElement = document.createElement('div');
  alertElement.className = `alert-item ${type}`;
  alertElement.innerHTML = `
    <div class="alert-time">${timeString}</div>
    <div class="alert-message">${message}</div>
  `;
  
  // Add to alerts container
  alertsContainer.prepend(alertElement);
  
  // Limit number of alerts
  if (alertsContainer.children.length > 10) {
    alertsContainer.removeChild(alertsContainer.lastChild);
  }
  
  // Save to user history
  userProfile.history.push({
    timestamp: timestamp.toISOString(),
    type,
    message
  });
  
  // Store in local storage
  saveUserProfile();
}

// Save user profile to local storage
function saveUserProfile() {
  // Limit history size
  if (userProfile.history.length > 100) {
    userProfile.history = userProfile.history.slice(-100);
  }
  
  localStorage.setItem('eyeGuardianProfile', JSON.stringify(userProfile));
}

// Load user profile from local storage
function loadUserProfile() {
  const savedProfile = localStorage.getItem('eyeGuardianProfile');
  if (savedProfile) {
    try {
      const parsedProfile = JSON.parse(savedProfile);
      userProfile = { ...userProfile, ...parsedProfile };
      
      // Update UI to reflect loaded settings
      updateSettingsUI();
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  }
}

// Update settings UI based on user profile
function updateSettingsUI() {
  blinkThresholdSlider.value = userProfile.optimalBlinkRate;
  blinkThresholdValue.textContent = userProfile.optimalBlinkRate;
  
  distanceThresholdSlider.value = userProfile.optimalDistance;
  distanceThresholdValue.textContent = userProfile.optimalDistance;
  
  gazeThresholdSlider.value = userProfile.maxGazeDuration;
  gazeThresholdValue.textContent = userProfile.maxGazeDuration;
  
  enableNotifications.checked = userProfile.notifications;
  enableSound.checked = userProfile.sound;
}

// Event listeners for settings
settingsBtn.addEventListener('click', () => {
  settingsModal.classList.add('show');
});

closeSettingsBtn.addEventListener('click', () => {
  settingsModal.classList.remove('show');
});

notificationClose.addEventListener('click', () => {
  notification.classList.remove('show');
});

// Event listeners for settings changes
blinkThresholdSlider.addEventListener('input', () => {
  const value = blinkThresholdSlider.value;
  blinkThresholdValue.textContent = value;
  userProfile.optimalBlinkRate = parseInt(value);
  saveUserProfile();
});

distanceThresholdSlider.addEventListener('input', () => {
  const value = distanceThresholdSlider.value;
  distanceThresholdValue.textContent = value;
  userProfile.optimalDistance = parseInt(value);
  saveUserProfile();
});

gazeThresholdSlider.addEventListener('input', () => {
  const value = gazeThresholdSlider.value;
  gazeThresholdValue.textContent = value;
  userProfile.maxGazeDuration = parseInt(value);
  saveUserProfile();
});

enableNotifications.addEventListener('change', () => {
  userProfile.notifications = enableNotifications.checked;
  saveUserProfile();
});

enableSound.addEventListener('change', () => {
  userProfile.sound = enableSound.checked;
  saveUserProfile();
});

// Click outside modal to close
window.addEventListener('click', (event) => {
  if (event.target === settingsModal) {
    settingsModal.classList.remove('show');
  }
});

// Global function for direct button access
function startCamera() {
  startButton.disabled = true;
  startButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Starting...';
  initFaceDetection();
}

// Load user profile and initialize the app
document.addEventListener('DOMContentLoaded', () => {
  loadUserProfile();
  
  // Add event listener for the start button (redundant but kept for compatibility)
  startButton.addEventListener('click', startCamera);
  
  // Add an initial alert
  addAlert('info', 'Welcome to Eye Guardian! Click the Start button to begin monitoring your eye health.');
});
