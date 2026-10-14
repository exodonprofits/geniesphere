// Elements
const formSteps = document.querySelectorAll(".form-step");
const nextBtn = document.getElementById("nextBtn");
const prevBtn = document.getElementById("prevBtn");
const mealForm = document.getElementById("mealForm");

let currentStep = 0;

function initCheckboxGroups() {
  const groups = ["medical", "allergies", "diet"];
  groups.forEach(name => {
    document.querySelectorAll(`input[name='${name}']`).forEach(checkbox => {
      checkbox.addEventListener("change", () => {
        if (checkbox.value === "none" && checkbox.checked) {
          document.querySelectorAll(`input[name='${name}']:not([value='none'])`).forEach(cb => cb.checked = false);
        } else {
          document.querySelector(`input[name='${name}'][value='none']`).checked = false;
        }
      });
    });
  });
}

function validateStep() {
  clearErrors();
  let isValid = true;
  const currentStepEl = formSteps[currentStep];

  switch (currentStep) {
    case 0:
      const name = currentStepEl.querySelector("#name");
      const ageRange = currentStepEl.querySelector("#age_range");
      const gender = currentStepEl.querySelector("#gender");
      if (!name.value.trim()) { showError(name, "Name is required"); isValid = false; }
      if (ageRange.value === "") { showError(ageRange, "Select an age range"); isValid = false; }
      if (gender.value === "") { showError(gender, "Select a gender"); isValid = false; }
      break;
    case 1:
      const medical = currentStepEl.querySelectorAll("input[name='medical']:checked").length;
      const allergies = currentStepEl.querySelectorAll("input[name='allergies']:checked").length;
      const diet = currentStepEl.querySelectorAll("input[name='diet']:checked").length;
      const goals = currentStepEl.querySelector("#goals");
      if (!medical) { showError(currentStepEl.querySelector("input[name='medical']"), "Select at least one medical condition"); isValid = false; }
      if (!allergies) { showError(currentStepEl.querySelector("input[name='allergies']"), "Select at least one allergy"); isValid = false; }
      if (!diet) { showError(currentStepEl.querySelector("input[name='diet']"), "Select at least one dietary restriction"); isValid = false; }
      if (goals.value === "") { showError(goals, "Select a nutritional goal"); isValid = false; }
      break;
    case 2:
      const mealsPerDay = currentStepEl.querySelector("#meals_per_day");
      const cuisines = currentStepEl.querySelectorAll("input[name='cuisine']:checked").length;
      const dislikedFoods = currentStepEl.querySelector("#disliked_foods");
      const mealTypes = currentStepEl.querySelectorAll("input[name='meal_type']:checked").length;
      if (mealsPerDay.value === "") { showError(mealsPerDay, "Select meals per day"); isValid = false; }
      if (!cuisines) { showError(currentStepEl.querySelector("input[name='cuisine']"), "Select at least one cuisine"); isValid = false; }
      if (!dislikedFoods.value.trim()) { showError(dislikedFoods, "Enter disliked foods"); isValid = false; }
      if (!mealTypes) { showError(currentStepEl.querySelector("input[name='meal_type']"), "Select at least one meal type"); isValid = false; }
      break;
    case 3:
      const cookingSkill = currentStepEl.querySelector("#cooking_skill");
      const equipment = currentStepEl.querySelectorAll("input[name='equipment']:checked").length;
      if (cookingSkill.value === "") { showError(cookingSkill, "Select cooking skill"); isValid = false; }
      if (!equipment) { showError(currentStepEl.querySelector("input[name='equipment']"), "Select at least one equipment"); isValid = false; }
      break;
    case 4:
      const groceryBudget = currentStepEl.querySelector("#grocery_budget");
      const pantry = currentStepEl.querySelectorAll("input[name='pantry']:checked").length;
      if (!groceryBudget.value || isNaN(groceryBudget.value)) { showError(groceryBudget, "Enter a valid grocery budget"); isValid = false; }
      if (!pantry) { showError(currentStepEl.querySelector("input[name='pantry']"), "Select at least one pantry staple"); isValid = false; }
      break;
  }

  return isValid;
}

function collectFormData() {
  const formData = new FormData(mealForm);

  const jsonData = {
    personal_info: {
      name: formData.get("name"),
      age_range: formData.get("age_range"),
      gender: formData.get("gender")
    },
    health_dietary_preferences: {
      medical_conditions: formData.getAll("medical"),
      allergies: formData.getAll("allergies"),
      dietary_restrictions: formData.getAll("diet"),
      nutritional_goals: formData.get("goals")
    },
    meal_preferences: {
      meals_per_day: formData.get("meals_per_day"),
      cuisine_preferences: formData.getAll("cuisine"),
      disliked_foods: formData.get("disliked_foods"),
      preferred_meal_types: formData.getAll("meal_type")
    },
    cooking_lifestyle_habits: {
      cooking_skill_level: formData.get("cooking_skill"),
      available_kitchen_equipment: formData.getAll("equipment")
    },
    shopping_budget: {
      weekly_grocery_budget: Number(formData.get("grocery_budget")),
      pantry_staples_available: formData.getAll("pantry")
    }
  };

  return jsonData;
}

function showError(input, message) {
  const error = document.createElement("div");
  error.className = "error-message";
  error.textContent = message;
  input.parentNode.insertBefore(error, input.nextSibling);
  input.style.borderColor = "#ef4444";
}

function clearErrors() {
  document.querySelectorAll(".error-message").forEach(error => error.remove());
  document.querySelectorAll("input, select").forEach(input => input.style.borderColor = "#cbd5e1");
}

function updateFormSteps() {
  formSteps.forEach((step, idx) => {
    step.classList.toggle("active", idx === currentStep);
  });

  prevBtn.style.display = currentStep === 0 ? "none" : "inline-block";

  if (currentStep === formSteps.length - 1) {
    nextBtn.textContent = "Submit";
  } else {
    nextBtn.textContent = "Next";
  }
}

nextBtn.addEventListener("click", () => {
  if (!validateStep()) return;

  if (currentStep < formSteps.length - 1) {
    currentStep++;
    updateFormSteps();
  } else {
    const jsonOutput = collectFormData();

    localStorage.setItem('nutritionFormData', JSON.stringify(jsonOutput));

    fetch('/submit_meal_form', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(jsonOutput)
    })
    .then(response => response.json())
    .then(data => {
      console.log("Server response:", data);
      window.location.href = "/nutrition_form/confirmation";
    })
    .catch(error => {
      console.error("Error submitting form:", error);
      alert("Failed to submit form. Please try again.");
    });
  }
});

prevBtn.addEventListener("click", () => {
  if (currentStep > 0) {
    currentStep--;
    updateFormSteps();
  }
});

document.addEventListener("keypress", (e) => {
  if (e.key === "Enter" && e.target.tagName !== "TEXTAREA") {
    e.preventDefault();
    nextBtn.click();
  }
});

initCheckboxGroups();
updateFormSteps();
