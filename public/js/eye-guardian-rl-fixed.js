/**
 * Eye Guardian Reinforcement Learning Module
 * 
 * This module implements a Q-learning based reinforcement learning system
 * for monitoring and improving eye health habits.
 */

// Eye Guardian RL Module
// Handles reinforcement learning for eye health monitoring

// States for the RL system
const STATES = {
  GOOD_BLINK_GOOD_DISTANCE: 'GOOD_BLINK_GOOD_DISTANCE',
  GOOD_BLINK_BAD_DISTANCE: 'GOOD_BLINK_BAD_DISTANCE',
  LOW_BLINK_GOOD_DISTANCE: 'LOW_BLINK_GOOD_DISTANCE',
  LOW_BLINK_BAD_DISTANCE: 'LOW_BLINK_BAD_DISTANCE'
};

// Actions for the RL system
const ACTIONS = {
  BLINK_REMINDER: 'BLINK_REMINDER',
  DISTANCE_REMINDER: 'DISTANCE_REMINDER',
  COMBINED_REMINDER: 'COMBINED_REMINDER',
  NO_ACTION: 'NO_ACTION'
};

/**
 * Q-learning implementation for eye health monitoring
 */
class EyeGuardianRL {
  constructor(learningRate = 0.1, discountFactor = 0.9) {
    this.learningRate = learningRate;
    this.discountFactor = discountFactor;
    this.qTable = {};
    this.lastState = null;
    this.lastAction = null;
    this.lastReward = 0;
    this.explorationRate = 0.1;
    this.lastDistance = null;
    
    // Initialize Q-table
    Object.values(STATES).forEach(state => {
      this.qTable[state] = {};
      Object.values(ACTIONS).forEach(action => {
        this.qTable[state][action] = 0;
      });
    });
    
    // Load saved Q-table if exists
    this.loadQTable();
  }
  
  /**
   * Get Q-value for a state-action pair
   * @param {string} state - The current state
   * @param {string} action - The action taken
   * @returns {number} - The Q-value for the state-action pair
   */
  getQValue(state, action) {
    return this.qTable[state][action];
  }
  
  /**
   * Update Q-value based on reward
   * @param {string} state - The current state
   * @param {string} action - The action taken
   * @param {number} reward - The reward received
   * @param {string} nextState - The next state
   */
  updateQValue(state, action, reward, nextState) {
    const currentQ = this.getQValue(state, action);
    const nextMaxQ = Math.max(...Object.values(this.qTable[nextState]));
    
    // Q-learning update formula
    const newQ = currentQ + this.learningRate * (
      reward + this.discountFactor * nextMaxQ - currentQ
    );
    
    this.qTable[state][action] = newQ;
    this.saveQTable();
  }
  
  /**
   * Choose the best action for a state
   * @param {string} state - The current state
   * @returns {string} - The chosen action
   */
  chooseAction(state) {
    // Exploration vs exploitation
    if (Math.random() < this.explorationRate) {
      // Exploration: choose random action
      const actions = Object.values(ACTIONS);
      return actions[Math.floor(Math.random() * actions.length)];
    } else {
      // Exploitation: choose best action
      const stateActions = this.qTable[state];
      return Object.entries(stateActions).reduce((a, b) => 
        a[1] > b[1] ? a : b
      )[0];
    }
  }
  
  /**
   * Save Q-table to localStorage
   */
  saveQTable() {
    localStorage.setItem('eyeGuardianQTable', JSON.stringify(this.qTable));
  }
  
  /**
   * Load Q-table from localStorage
   */
  loadQTable() {
    const saved = localStorage.getItem('eyeGuardianQTable');
    if (saved) {
      this.qTable = JSON.parse(saved);
    }
  }
  
  /**
   * Reset the Q-table
   */
  resetQTable() {
    Object.values(STATES).forEach(state => {
      this.qTable[state] = {};
      Object.values(ACTIONS).forEach(action => {
        this.qTable[state][action] = 0;
      });
    });
    this.saveQTable();
  }
  
  /**
   * Determine the current state based on blink rate and distance
   * @param {number} blinkRate - The current blink rate (blinks per minute)
   * @param {number} distance - The current distance from the screen (cm)
   * @returns {string} - The current state
   */
  determineState(blinkRate, distance) {
    const GOOD_BLINK_THRESHOLD = 12; // blinks per minute
    const GOOD_DISTANCE_MIN = 50; // cm
    const GOOD_DISTANCE_MAX = 80; // cm
    
    const isGoodBlinkRate = blinkRate >= GOOD_BLINK_THRESHOLD;
    const isGoodDistance = distance >= GOOD_DISTANCE_MIN && distance <= GOOD_DISTANCE_MAX;
    
    if (isGoodBlinkRate && isGoodDistance) return STATES.GOOD_BLINK_GOOD_DISTANCE;
    if (isGoodBlinkRate && !isGoodDistance) return STATES.GOOD_BLINK_BAD_DISTANCE;
    if (!isGoodBlinkRate && isGoodDistance) return STATES.LOW_BLINK_GOOD_DISTANCE;
    return STATES.LOW_BLINK_BAD_DISTANCE;
  }
  
  /**
   * Calculate reward based on state transition
   * @param {string} currentState - The current state
   * @param {string} nextState - The next state
   * @returns {number} - The calculated reward
   */
  calculateReward(currentState, nextState) {
    let reward = 0;
    
    // Reward for improving state
    if (currentState === STATES.LOW_BLINK_BAD_DISTANCE && 
        nextState !== STATES.LOW_BLINK_BAD_DISTANCE) {
      reward += 1.0;
    } else if (currentState === STATES.GOOD_BLINK_BAD_DISTANCE && 
               nextState === STATES.GOOD_BLINK_GOOD_DISTANCE) {
      reward += 0.8;
    } else if (currentState === STATES.LOW_BLINK_GOOD_DISTANCE && 
               nextState === STATES.GOOD_BLINK_GOOD_DISTANCE) {
      reward += 0.8;
    }
    
    // Small negative reward for getting worse
    if (currentState === STATES.GOOD_BLINK_GOOD_DISTANCE && 
        nextState !== STATES.GOOD_BLINK_GOOD_DISTANCE) {
      reward -= 0.2;
    }
    
    return reward;
  }
  
  /**
   * Process new metrics and update the RL system
   * @param {number} blinkRate - The current blink rate (blinks per minute)
   * @param {number} distance - The current distance from the screen (cm)
   * @param {Function} actionCallback - Callback function to execute the chosen action
   * @returns {Object} - Information about the RL update
   */
  processMetrics(blinkRate, distance, actionCallback) {
    const currentState = this.determineState(blinkRate, distance);
    
    // If this is the first state, just choose an action
    if (!this.lastState) {
      this.lastState = currentState;
      this.lastAction = this.chooseAction(currentState);
      actionCallback(this.lastAction);
      return {
        previousState: null,
        newState: currentState,
        action: this.lastAction,
        reward: 0
      };
    }
    
    // Calculate reward and update Q-table
    const reward = this.calculateReward(this.lastState, currentState);
    this.updateQValue(this.lastState, this.lastAction, reward, currentState);
    
    // Choose next action
    const nextAction = this.chooseAction(currentState);
    
    // Update state tracking
    const result = {
      previousState: this.lastState,
      newState: currentState,
      action: this.lastAction,
      reward: reward
    };
    
    this.lastState = currentState;
    this.lastAction = nextAction;
    this.lastReward = reward;
    
    // Execute the next action
    actionCallback(nextAction);
    
    return result;
  }
  
  /**
   * Execute a blink-related action
   * @param {string} action - The action to execute
   */
  executeAction(action) {
    switch (action) {
      case ACTIONS.BLINK_REMINDER:
        showReminder('Remember to blink regularly!');
        break;
      case ACTIONS.DISTANCE_REMINDER:
        showReminder('Please maintain a safe distance from the screen');
        break;
      case ACTIONS.COMBINED_REMINDER:
        showReminder('Take a break: blink regularly and adjust your distance');
        break;
      case ACTIONS.NO_ACTION:
        // Do nothing
        break;
    }
  }
}

/**
 * UI Helper Functions
 */

/**
 * Show a gentle blink reminder
 * @param {string} message - The message to display
 */
function showReminder(message) {
  const reminder = document.createElement('div');
  reminder.className = 'reminder';
  reminder.textContent = message;
  document.body.appendChild(reminder);
  
  setTimeout(() => {
    reminder.remove();
  }, 3000);
}

/**
 * Create and update the RL dashboard
 * @param {HTMLElement} container - The container element for the dashboard
 * @param {EyeGuardianRL} rlAgent - The RL agent
 * @param {Object} updateInfo - Information about the RL update
 */
function updateRlDashboard(container, rlAgent, updateInfo) {
  if (!container) return;
  
  // Get dashboard elements
  const currentStateEl = container.querySelector('#rl-current-state');
  const lastActionEl = container.querySelector('#rl-last-action');
  const lastRewardEl = container.querySelector('#rl-last-reward');
  
  // Update dashboard with current state, action, and reward
  if (currentStateEl) currentStateEl.textContent = updateInfo ? updateInfo.newState : '-';
  if (lastActionEl) lastActionEl.textContent = updateInfo ? updateInfo.action : '-';
  if (lastRewardEl) lastRewardEl.textContent = updateInfo ? updateInfo.reward.toFixed(2) : '-';
  
  // Update Q-table visualization
  updateQTableVisualization(container, rlAgent);
}

/**
 * Update the Q-table visualization
 * @param {HTMLElement} container - The container element for the dashboard
 * @param {EyeGuardianRL} rlAgent - The RL agent
 */
function updateQTableVisualization(container, rlAgent) {
  if (!container) return;
  
  // Get Q-table elements
  const qTableBody = container.querySelector('#rl-q-table-body');
  
  // Clear existing rows
  qTableBody.innerHTML = '';
  
  // Populate Q-table
  Object.entries(rlAgent.qTable).forEach(([state, actions]) => {
    const row = document.createElement('tr');
    const stateCell = document.createElement('td');
    stateCell.textContent = state;
    row.appendChild(stateCell);
    
    Object.entries(actions).forEach(([action, qValue]) => {
      const actionCell = document.createElement('td');
      actionCell.textContent = qValue.toFixed(2);
      row.appendChild(actionCell);
    });
    
    qTableBody.appendChild(row);
  });
}

/**
 * Create the RL dashboard HTML
 * @returns {string} - The HTML for the RL dashboard
 */
function createRlDashboardHtml() {
  return `
    <div id="rl-dashboard" class="rl-dashboard" style="display: none;">
      <h3>Eye Guardian RL Dashboard</h3>
      <div class="rl-metric">
        <span class="rl-metric-label">Current State:</span>
        <span id="rl-current-state">-</span>
      </div>
      <div class="rl-metric">
        <span class="rl-metric-label">Last Action:</span>
        <span id="rl-last-action">-</span>
      </div>
      <div class="rl-metric">
        <span class="rl-metric-label">Last Reward:</span>
        <span id="rl-last-reward">-</span>
      </div>
      <table class="rl-q-table">
        <thead>
          <tr>
            <th>State</th>
            ${Object.values(ACTIONS).map(action => `<th>${action}</th>`).join('')}
          </tr>
        </thead>
        <tbody id="rl-q-table-body">
        </tbody>
      </table>
      <button id="toggle-rl-dashboard" class="action-button">
        <i class="fas fa-chart-line"></i> Hide Dashboard
      </button>
    </div>
  `;
}

/**
 * Add the RL dashboard styles to the document
 */
function addRlDashboardStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .reminder {
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 15px 25px;
      background-color: #4e54c8;
      color: white;
      border-radius: 5px;
      font-weight: bold;
      z-index: 1000;
      animation: slideIn 0.3s ease-out;
    }
    
    @keyframes slideIn {
      from { transform: translateX(100%); }
      to { transform: translateX(0); }
    }
    
    .rl-dashboard {
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 15px;
      background-color: white;
      border-radius: 5px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
      z-index: 1000;
    }
    
    .rl-dashboard h3 {
      margin: 0 0 10px 0;
      color: #4e54c8;
    }
    
    .rl-metric {
      margin: 5px 0;
    }
    
    .rl-metric-label {
      font-weight: bold;
      color: #666;
    }
    
    .rl-q-table {
      margin-top: 10px;
      border-collapse: collapse;
    }
    
    .rl-q-table th, .rl-q-table td {
      padding: 5px;
      border: 1px solid #ddd;
      text-align: center;
    }
    
    .rl-q-table th {
      background-color: #f5f5f5;
    }
  `;
  document.head.appendChild(style);
}

// Export the RL module to the global scope
window.EyeGuardianRL = {
  initEyeGuardianRL: function(options = {}) {
    const {
      learningRate = 0.1,
      discountFactor = 0.9,
      addDashboard = false,
      addStyles = false
    } = options;

    // Create RL agent instance
    const rlAgent = new EyeGuardianRL(learningRate, discountFactor);

    // Add dashboard if requested
    if (addDashboard) {
      const dashboardHtml = createRlDashboardHtml();
      document.body.insertAdjacentHTML('beforeend', dashboardHtml);
      
      if (addStyles) {
        addRlDashboardStyles();
      }
    }

    // Add methods to handle metrics
    rlAgent.processMetrics = function(metrics) {
      const { blinkRate, screenDistance } = metrics;
      const currentState = this.determineState(blinkRate, screenDistance);
      
      // If this is the first state, just choose an action
      if (!this.lastState) {
        this.lastState = currentState;
        this.lastAction = this.chooseAction(currentState);
        return {
          previousState: null,
          newState: currentState,
          action: this.lastAction
        };
      }
      
      // Calculate reward and update Q-table
      const reward = this.calculateReward(this.lastState, currentState);
      this.updateQValue(this.lastState, this.lastAction, reward, currentState);
      
      // Choose next action
      const nextAction = this.chooseAction(currentState);
      
      // Update state tracking
      const result = {
        previousState: this.lastState,
        newState: currentState,
        action: this.lastAction
      };
      
      this.lastState = currentState;
      this.lastAction = nextAction;
      
      return result;
    };

    return rlAgent;
  }
}; 