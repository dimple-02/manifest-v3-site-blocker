// Function to dynamically block a site
function blockSite(domainToBlock, ruleId) {
  const blockRule = {
    id: ruleId,
    priority: 1,
    action: { type: "block" },
    condition: { urlFilter: domainToBlock, resourceTypes: ["main_frame"] }
  };

  chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [ruleId],
    addRules: [blockRule]
  }, () => {
    if (chrome.runtime.lastError) {
      console.error("Failed to add blocking rule:", chrome.runtime.lastError.message);
    }
  });
}

// NEW: Function to safely unblock ALL sites
function unblockAllSites(callback) {
  chrome.declarativeNetRequest.getDynamicRules((rules) => {
    if (chrome.runtime.lastError) {
      console.error("Failed to fetch rules:", chrome.runtime.lastError.message);
      if (callback) callback();
      return;
    }
    const ruleIds = rules.map(rule => rule.id);
    chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: ruleIds }, () => {
      if (chrome.runtime.lastError) {
        console.error("Failed to remove blocking rules:", chrome.runtime.lastError.message);
      }
      if (callback) callback();
    });
  });
}

function cleanupRulesIfNoActiveAlarm() {
  chrome.alarms.get("focusTimer", (alarm) => {
    if (!alarm) {
      unblockAllSites();
    }
  });
}

chrome.runtime.onStartup.addListener(cleanupRulesIfNoActiveAlarm);
chrome.runtime.onInstalled.addListener(cleanupRulesIfNoActiveAlarm);

// Listen for messages from popup.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  
  if (message.action === "start_focus_session") {
    const minutesToFocus = message.duration || 25;

    chrome.alarms.get("focusTimer", (alarm) => {
      if (alarm) {
        sendResponse({ status: "Session Already Active" });
        return;
      }

      chrome.storage.local.get(["blockedSites"], (result) => {
        const sites = result.blockedSites || [];
        sites.forEach((site, index) => {
          blockSite(site, index + 1); 
        });
        console.log(`🚀 Blocked ${sites.length} sites for ${minutesToFocus} minutes.`);
      });

      chrome.alarms.create("focusTimer", { delayInMinutes: minutesToFocus });
      sendResponse({ status: "Session Started" });
    });
    return true;
  } 
  
  // NEW: Listen for the emergency stop!
  else if (message.action === "stop_focus_session") {
    console.log("🛑 Emergency Stop Activated!");
    chrome.alarms.clear("focusTimer"); // Kill the alarm
    unblockAllSites(() => {            // Delete the blocking rules
      sendResponse({ status: "Session Stopped" });
    });
    return true; // Tells Chrome we will send the response asynchronously
  }
});

// Listen for the timer to finish normally
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "focusTimer") {
    unblockAllSites(() => {
      console.log("✅ Focus session over. Sites unblocked.");
    });
  }
});