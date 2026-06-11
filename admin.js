/* ⭐ UPDATED: Auto-fetch token before prompting ⭐ */
async function goToScorecard() {
  // 1. If we saved the token during round creation, use it automatically
  if (adminState.activeToken) {
    window.location.href = `scorecard.html?token=${encodeURIComponent(adminState.activeToken)}`;
    return;
  }

  // 2. Ask the server for the active round's token
  try {
    // IMPORTANT: Make sure this path matches the name of the file from Step 1!
    const response = await fetch("/api/get-active-round"); 
    
    if (response.ok) {
      const data = await response.json();
      
      if (data.active && data.token) {
        adminState.activeToken = data.token; // Save it to memory
        window.location.href = `scorecard.html?token=${encodeURIComponent(data.token)}`;
        return; // Stop here, we successfully navigated!
      }
    }
  } catch (err) {
    console.error("Could not fetch the active token:", err);
  }

  // 3. Failsafe: Only show the popup if the server couldn't find a token
  const manualToken = prompt(
    "Could not automatically find an active token. Please paste an active 'scorecard_token' from your Google Sheet:"
  );

  if (manualToken) {
    window.location.href = `scorecard.html?token=${encodeURIComponent(manualToken.trim())}`;
  }
}
// END OF FILE
