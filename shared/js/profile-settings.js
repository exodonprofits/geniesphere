document.addEventListener("DOMContentLoaded", () => {
  const nameInput = document.getElementById("name");
  const roleInput = document.getElementById("role");
  const status = document.getElementById("profileStatus");

  // Load saved values
  nameInput.value = localStorage.getItem("userName") || "";
  roleInput.value = localStorage.getItem("userRole") || "owner";

  document.getElementById("profileForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = nameInput.value.trim();
    const role = roleInput.value;
    if (!name) {
      status.textContent = "⚠️ Please enter your name.";
      return;
    }
    localStorage.setItem("userName", name);
    localStorage.setItem("userRole", role);
    status.textContent = "✅ Profile saved successfully!";
  });
});
