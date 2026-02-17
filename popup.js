const siteInput = document.getElementById("siteInput");
const addBtn = document.getElementById("addBtn");
const siteList = document.getElementById("siteList");
const startBtn = document.getElementById("startBtn");
const timeInput = document.getElementById("timeInput");
const setupUI = document.getElementById("setupUI");
const statusText = document.getElementById("status");
const timerDisplay = document.getElementById("timerDisplay");
const stopBtn = document.getElementById("stopBtn"); // Grab the new button

let countdownInterval;

function normalizeSiteInput(inputValue) {
  const trimmed = inputValue.trim().toLowerCase();
  if (!trimmed) return null;

  try {
    const withScheme = trimmed.includes("://") ? trimmed : `http://${trimmed}`;
    const url = new URL(withScheme);
    return url.hostname.replace(/^www\./, "") || null;
  } catch (error) {
    console.error("Invalid site input:", error);
    return null;
  }
}

// Initialize UI
chrome.storage.local.get(["blockedSites"], (result) => {
  const sites = result.blockedSites || [];
  sites.forEach(site => addSiteToList(site));
});

// Check for running timer
chrome.alarms.get("focusTimer", (alarm) => {
  if (alarm) startCountdownUI(alarm.scheduledTime);
});

// Add Sites
addBtn.addEventListener("click", () => {
  const newSite = normalizeSiteInput(siteInput.value);
  if (newSite) {
    chrome.storage.local.get(["blockedSites"], (result) => {
      const sites = result.blockedSites || [];
      if (!sites.includes(newSite)) {
        sites.push(newSite);
        chrome.storage.local.set({ blockedSites: sites }, () => {
          if (chrome.runtime.lastError) {
            console.error("Failed to save site:", chrome.runtime.lastError.message);
            return;
          }
          addSiteToList(newSite);
          siteInput.value = ""; 
        });
      }
    });
  }
});

function addSiteToList(site) {
  const li = document.createElement("li");
  li.style.display = "flex"; li.style.justifyContent = "space-between"; li.style.marginBottom = "8px";
  const textSpan = document.createElement("span"); textSpan.textContent = site;
  const deleteBtn = document.createElement("button"); deleteBtn.textContent = "✖";
  deleteBtn.style.cssText = "background-color: #dc3545; color: white; border: none; border-radius: 3px; cursor: pointer; padding: 2px 6px; width: auto;";

  deleteBtn.addEventListener("click", () => {
    chrome.storage.local.get(["blockedSites"], (result) => {
      const sites = result.blockedSites || [];
      const updatedSites = sites.filter(s => s !== site);
      chrome.storage.local.set({ blockedSites: updatedSites }, () => li.remove());
    });
  });

  li.appendChild(textSpan); li.appendChild(deleteBtn); siteList.appendChild(li);
}

// Start Session
startBtn.addEventListener("click", () => {
  const focusMinutes = Math.max(1, parseInt(timeInput.value) || 25);
  chrome.alarms.get("focusTimer", (alarm) => {
    if (alarm) {
      startCountdownUI(alarm.scheduledTime);
      return;
    }

    chrome.runtime.sendMessage({ action: "start_focus_session", duration: focusMinutes }, (response) => {
      if (response && response.status === "Session Started") {
        const endTime = Date.now() + (focusMinutes * 60 * 1000);
        startCountdownUI(endTime);
      }
    });
  });
});

// NEW: Stop Session Logic
stopBtn.addEventListener("click", () => {
  chrome.runtime.sendMessage({ action: "stop_focus_session" }, (response) => {
    if (response && response.status === "Session Stopped") {
      clearInterval(countdownInterval); // Stop the clock ticking
      
      // Reset the UI back to normal
      timerDisplay.style.display = "none";
      statusText.style.display = "none";
      stopBtn.style.display = "none";
      setupUI.style.display = "block";
    }
  });
});

// Timer Logic
function startCountdownUI(endTime) {
  setupUI.style.display = "none";
  statusText.style.display = "block";
  statusText.textContent = "Session Active! 🚀";
  statusText.style.color = "#28a745";
  timerDisplay.style.display = "block";
  stopBtn.style.display = "block"; // Show the stop button!

  if (countdownInterval) {
    clearInterval(countdownInterval);
  }

  countdownInterval = setInterval(() => {
    const timeLeft = Math.max(0, endTime - Date.now());

    if (timeLeft === 0) {
      clearInterval(countdownInterval);
      timerDisplay.textContent = "00:00";
      statusText.textContent = "Session Complete! ✅";
      statusText.style.color = "#007bff";
      stopBtn.style.display = "none"; // Hide the stop button when finished
      
      // Bring back the setup screen after 3 seconds so they can start again
      setTimeout(() => {
        timerDisplay.style.display = "none";
        statusText.style.display = "none";
        setupUI.style.display = "block";
      }, 3000);
      
    } else {
      const minutes = Math.floor(timeLeft / (1000 * 60));
      const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
      timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
  }, 1000);
}