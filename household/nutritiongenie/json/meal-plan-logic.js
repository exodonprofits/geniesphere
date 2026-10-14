async function generateMealPlanFromData(data) {
  const start = new Date(data.personal_info.start_date);
  const end = new Date(data.personal_info.end_date);
  const diffDays = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1); // Inclusive

  const prompt = `
    You are a nutritionist AI. Create a ${diffDays}-day personalized meal plan based on the following user profile.

    📝 Instructions:
    1. For each day, include:
      - Breakfast
      - Lunch
      - Dinner
      - Snack (optional)
      - Drink (optional)

    2. For each meal/snack/drink, list:
      - Meal name only (no recipe shown directly)
      - After the meal name, include:
        <span class='recipe-icon' title='Click to view recipe' onclick="showRecipe('dayX-mealtype')">📖</span>

    3. After all days, include a hidden recipe section in this format:
      <div id="recipe-dayX-mealtype" class="hidden-recipe">...HTML recipe and ingredients...</div>

      🔁 Replace "dayX" with day number (e.g. day1, day2) and "mealtype" with meal label (breakfast, lunch, etc.) all in lowercase and kebab-case.

    4. At the bottom of the plan, include a categorized grocery list using:
      <h2>🛒 Grocery List</h2>
      <ul>
        <li>Proteins: ...</li>
        <li>Vegetables: ...</li>
        <li>Grains: ...</li>
        <li>Dairy: ...</li>
        <li>Spices & Condiments: ...</li>
      </ul>

    5. Output must be clean HTML. Use <ul> for meals and <br> for instructions. All recipe content must be hidden by default. based on the following user profile.

    📝 Instructions:
    1. For each day, include:
      - Breakfast
      - Lunch
      - Dinner
      - Snack (optional)
      - Drink (optional)

    2. For each meal/snack/drink, list:
      - Meal name (no recipe shown directly)
      - After the meal name, include this HTML:
        <span class='recipe-icon' title='Click to view recipe' onclick="showRecipe('Day X - Meal Name')">📖</span>

    3. After all days, include a hidden recipe section in this format:
      <div id="recipe-Day X - Meal Name" class="hidden-recipe">...HTML recipe and ingredients...</div>

    4. At the bottom of the plan, include a categorized grocery list using:
      <h2>🛒 Grocery List</h2>
      <ul>
        <li>Proteins: ...</li>
        <li>Vegetables: ...</li>
        <li>Grains: ...</li>
        <li>Dairy: ...</li>
        <li>Spices & Condiments: ...</li>
      </ul>

    5. Output must be clean HTML. Use <ul> and <br> for lists and instructions. All recipe content must be hidden by default. based on the following user profile.

    📝 Instructions:
    1. For each day, provide meals (Breakfast, Lunch, Dinner, Snack if applicable) with:
      - Meal name
      - Estimated calories (e.g., 450 kcal)
      - Simple recipe with ingredients and short cooking instructions
    2. Format clearly with day headings and <ul> list for meals.
    3. At the end, ALWAYS include a categorized grocery list using:
      <h2>🛒 Grocery List</h2>
      <ul>
        <li>Proteins: ...</li>
        <li>Vegetables: ...</li>
        <li>Grains: ...</li>
        <li>Dairy: ...</li>
        <li>Spices & Condiments: ...</li>
      </ul>
    4. Ensure all grocery list items cover every meal across ${diffDays} days.
    5. Output must be in clean HTML format with <br> used for line breaks in instructions.

    📄 User Profile:
    Name: ${data.personal_info.name}
    Age Range: ${data.personal_info.age_range}
    Gender: ${data.personal_info.gender}
    Start Date: ${data.personal_info.start_date}
    End Date: ${data.personal_info.end_date}

    Medical Conditions: ${data.health_dietary_preferences.medical_conditions.join(", ")}
    Allergies: ${data.health_dietary_preferences.allergies.join(", ")}
    Dietary Restrictions: ${data.health_dietary_preferences.dietary_restrictions.join(", ")}
    Nutritional Goals: ${data.health_dietary_preferences.nutritional_goals}

    Meals per Day: ${data.meal_preferences.meals_per_day}
    Preferred Cuisines: ${data.meal_preferences.cuisine_preferences.join(", ")}
    Disliked Foods: ${data.meal_preferences.disliked_foods}
    Preferred Meal Types: ${data.meal_preferences.preferred_meal_types.join(", ")}

    Cooking Skill: ${data.cooking_lifestyle_habits.cooking_skill_level}
    Kitchen Equipment: ${data.cooking_lifestyle_habits.available_kitchen_equipment.join(", ")}

    Budget: $${data.shopping_budget.weekly_grocery_budget}
    Pantry Staples: ${data.shopping_budget.pantry_staples_available.join(", ")}
`;

  const apiKey = ""; // Replace with your key

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + apiKey
      },
      body: JSON.stringify({
        model: "gpt-4 turbo",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7
      })
    })
  }
    const result = await response.json();
    console.log("AI API Raw Response:", result);
    if (!result.choices || !result.choices[0] || !result.choices[0].message || !result.choices[0].message.content) {
      throw new Error("Invalid response from OpenAI API. Please check API key or model status.");
    }
    
    const htmlPlan = result.choices[0].message.content;
    return htmlPlan;
  }

  function showRecipe(id) {
    id = id.startsWith('recipe-') ? id : 'recipe-' + id;
    const el = document.getElementById(id);
    if (el) {
      el.style.display = el.style.display === "none" || el.style.display === "" ? "block" : "none";
    }
  }
  
  window.showRecipe = showRecipe;


