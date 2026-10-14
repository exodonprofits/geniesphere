document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("tickers");
  const status = document.getElementById("status");

  // Load saved from localStorage
  const saved = localStorage.getItem("portfolioTickers");
  if (saved) input.value = saved;

  document.getElementById("portfolioForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const tickers = input.value.trim();
    if (!tickers) {
      status.textContent = "⚠️ Please enter at least one ticker.";
      return;
    }
    localStorage.setItem("portfolioTickers", tickers);
    status.textContent = "✅ Portfolio saved successfully!";
  });
});
