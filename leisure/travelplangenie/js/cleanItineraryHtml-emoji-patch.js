// 👇 Add this near the top of your cleanItineraryHtml function

// 🛠️ Patch: Emoji mapping for Cost Summary labels
const emojiMap = {
  'Flights': '🛫 Flights',
  'Accommodation': '🏨 Accommodation',
  'Activities': '🎟️ Activities',
  'Food': '🍽️ Food',
  'Total': '💰 Total',
  'Remaining Budget': '💵 Remaining Budget'
};

function applyEmojiToLabel(label) {
  return emojiMap[label] || label;
}


// 👇 Replace your cost table rendering loop with this:

for (const item of costItems) {
  const label = applyEmojiToLabel(item.label);
  costSummaryTable += `<tr><td style="padding: 8px; border: 1px solid #ddd;">${label}</td><td style="padding: 8px; border: 1px solid #ddd;">${item.value}</td></tr>`;
}
