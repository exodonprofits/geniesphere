document.addEventListener("DOMContentLoaded", () => {
  const apiKeyInput = document.getElementById("apiKey");
  const statusMsg = document.getElementById("statusMsg");

  const savedKey = localStorage.getItem("userAPIKey");
  if (savedKey) apiKeyInput.value = savedKey;

  document.getElementById("apiKeyForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const key = apiKeyInput.value.trim();
    if (key) {
      localStorage.setItem("userAPIKey", key);
      showMessage("✅ Your API key was saved successfully.");
    } else {
      showMessage("⚠️ Please enter a valid key.");
    }
  });

  document.getElementById("clearBtn").addEventListener("click", () => {
    localStorage.removeItem("userAPIKey");
    apiKeyInput.value = "";
    showMessage("❌ Your API key has been removed.");
  });

  function showMessage(msg) {
    statusMsg.textContent = msg;
    statusMsg.style.display = "block";
  }
});
