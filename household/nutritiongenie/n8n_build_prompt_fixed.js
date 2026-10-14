const b = $json;

// ── Normalise inbound fields ──────────────────────────────────────────
const planDays         = Number(b.planDays || 7);
const people           = Number(b.people || 1);
const mealsPerDay      = Array.isArray(b.mealsPerDay)      ? b.mealsPerDay      : (b.mealsPerDay      ? [b.mealsPerDay]      : ["breakfast","lunch","dinner"]);
const cuisine          = Array.isArray(b.cuisine)           ? b.cuisine           : (b.cuisine           ? [b.cuisine]           : []);
const allergies        = Array.isArray(b.allergies)         ? b.allergies         : (b.allergies         ? [b.allergies]         : []);
const avoidIngredients = Array.isArray(b.avoidIngredients)  ? b.avoidIngredients  : (b.avoidIngredients  ? [b.avoidIngredients]  : []);

const goal         = b.goal         || "balanced";
const budgetLevel  = b.budgetLevel  || "medium";
const budgetTotal  = b.budgetTotal  ? `$${b.budgetTotal}/week` : "";   // FIX: was ignored
const timePerMeal  = Number(b.timePerMeal || 30);
const calorieTarget = b.calorieTarget ? String(b.calorieTarget) : "";
const notes        = b.notes || "";

// FIX: macroTargets was never read — now extracted properly
const macroTargets = b.macroTargets || {};
const proteinTarget = macroTargets.protein ? `${macroTargets.protein}g protein` : "";
const carbsTarget   = macroTargets.carbs   ? `${macroTargets.carbs}g carbs`     : "";
const fatTarget     = macroTargets.fat     ? `${macroTargets.fat}g fat`         : "";
const macroLine     = [proteinTarget, carbsTarget, fatTarget].filter(Boolean).join(", ");

// FIX: dietStyle was a ghost field — derive it from goal instead
const dietStyle = goal.includes("diabetic") ? "diabetic-friendly"
                : goal.includes("vegan")    ? "vegan"
                : goal.includes("vegetarian") ? "vegetarian"
                : goal.includes("keto")     ? "keto"
                : "";

const system = `You are a meal planning assistant. Output ONLY valid JSON. No markdown fences. No extra text before or after the JSON.`;

// FIX: added top-level macroSummary field that the genie sidebar displays
const schema = {
  planMeta: {
    days: planDays,
    people,
    goal,
    dietStyle,
    mealsPerDay,
    cuisine,
    allergies,
    avoidIngredients,
    budgetLevel,
    timePerMealMinutes: timePerMeal,
    calorieTarget,
    notes
  },
  macroSummary: {
    protein: 0,
    carbs: 0,
    fat: 0,
    calories: 0,
    note: "Average per person per day across all meals"
  },
  groceryList: [
    { item: "string", quantity: "string", category: "Produce|Protein|Dairy|Pantry|Frozen|Bakery|Snacks|Drinks|Household|Other" }
  ],
  days: [
    {
      day: 1,
      label: "Monday",
      meals: [
        {
          mealType: "breakfast|lunch|dinner|snack|morning_snack|afternoon_snack",
          title: "string",
          cuisine: "string",
          prepTimeMinutes: 10,
          cookTimeMinutes: 15,
          servings: people,
          ingredients: [{ name: "string", amount: "string" }],
          steps: ["string"],
          nutrition: {
            calories: 0,
            protein_g: 0,
            carbs_g: 0,
            fat_g: 0,
            fiber_g: 0,
            sugar_g: 0
          },
          diabeticNotes: "string — leave empty string if not relevant"
        }
      ]
    }
  ]
};

const userPrompt = `Create a ${planDays}-day meal plan for ${people} ${people === 1 ? "person" : "people"}.

Constraints:
- Goal: ${goal}
- Diet style: ${dietStyle || "none specified"}
- Meals per day: ${mealsPerDay.join(", ")}
- Cuisine preferences: ${cuisine.length ? cuisine.join(", ") : "no preference"}
- Allergies / intolerances: ${allergies.length ? allergies.join(", ") : "none"}
- Avoid ingredients: ${avoidIngredients.length ? avoidIngredients.join(", ") : "none"}
- Budget: ${budgetLevel}${budgetTotal ? ` (${budgetTotal} total for ${people} ${people === 1 ? "person" : "people"})` : ""}
- Max time per meal: ${timePerMeal} minutes
- Daily calorie target per person: ${calorieTarget || "not specified"}
- Macro targets per person per day: ${macroLine || "not specified"}
- Additional notes: ${notes || "none"}

Output requirements:
- Return ONLY valid JSON — no markdown, no preamble, no trailing text.
- Match this JSON structure exactly (replace all placeholder values with real data): ${JSON.stringify(schema)}
- Include a realistic "label" field on each day (Monday, Tuesday, etc. matching the plan start).
- Make meals practical. Reuse ingredients across the week to keep the grocery list short and cost down.
- Grocery list categories must use exactly: Produce, Protein, Dairy, Pantry, Frozen, Bakery, Snacks, Drinks, Household, Other.
- macroSummary must be filled with the average per-person per-day totals calculated from all meals.
- diabeticNotes: only fill if goal is diabetic-friendly, otherwise use empty string.
- For diabetic-friendly plans: prioritise low-GI ingredients, limit added sugars, include fibre-rich options.
`;

return [{
  system,
  userPrompt,
  planDays,
  people
}];
