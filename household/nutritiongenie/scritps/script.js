const formSteps = document.querySelectorAll(".form-step");
const nextBtn = document.getElementById("nextBtn");
const prevBtn = document.getElementById("prevBtn");
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

function showError(input, message) {
  const error = document.createElement("div");
  error.className = "error-message";
  error.textContent = message;
  input.parentNode.insertBefore(error, input.nextSibling);
  input.style.borderColor = "#ef4444";
}

function clearErrors() {
  document.querySelectorAll(".error-message").forEach(e => e.remove());
  document.querySelectorAll("input, select").forEach(input => {
    input.style.borderColor = "#cbd5e1";
  });
}

function validateStep() {
  clearErrors();
  let isValid = true;
  const currentStepEl = formSteps[currentStep];

  switch (currentStep) {
    case 0: // Step 1
      const name = currentStepEl.querySelector("#name");
      const age = currentStepEl.querySelector("#age");
      const gender = currentStepEl.querySelector("#gender");
      if (!name.value.trim()) { showError(name, "Name is required"); isValid = false; }
      if (!age.value || isNaN(age.value)) { showError(age, "Valid age is required"); isValid = false; }
      if (gender.value === "") { showError(gender, "Please select gender"); isValid = false; }
      break;

    case 1: // Step 2
      const medical = currentStepEl.querySelectorAll("input[name='medical']:checked").length;
      const allergies = currentStepEl.querySelectorAll("input[name='allergies']:checked").length;
      const diet = currentStepEl.querySelectorAll("input[name='diet']:checked").length;
      const goals = currentStepEl.querySelector("#goals");
      if (!medical) { showError(currentStepEl.querySelector("input[name='medical']"), "Select medical"); isValid = false; }
      if (!allergies) { showError(currentStepEl.querySelector("input[name='allergies']"), "Select allergy"); isValid = false; }
      if (!diet) { showError(currentStepEl.querySelector("input[name='diet']"), "Select diet"); isValid = false; }
      if (goals.value === "") { showError(goals, "Select goal"); isValid = false; }
      break;

    case 2: // Step 3
      const meals = currentStepEl.querySelector("#meals_per_day");
      const cuisines = currentStepEl.querySelectorAll("input[name='cuisine']:checked").length;
      const disliked = currentStepEl.querySelector("#disliked_foods");
      const mealTypes = currentStepEl.querySelectorAll("input[name='meal_type']:checked").length;
      if (meals.value === "") { showError(meals, "Select meals per day"); isValid = false; }
      if (!cuisines) { showError(currentStepEl.querySelector("input[name='cuisine']"), "Select cuisine"); isValid = false; }
      if (!disliked.value.trim()) { showError(disliked, "Enter disliked foods"); isValid = false; }
      if (!mealTypes) { showError(currentStepEl.querySelector("input[name='meal_type']"), "Select meal type"); isValid = false; }
      break;

    case 3: // Step 4
      const cookingSkill = currentStepEl.querySelector("#cooking_skill");
      const equipment = currentStepEl.querySelectorAll("input[name='equipment']:checked").length;
      if (cookingSkill.value === "") { showError(cookingSkill, "Select cooking skill"); isValid = false; }
      if (!equipment) { showError(currentStepEl.querySelector("input[name='equipment']"), "Select equipment"); isValid = false; }
      break;

    case 4: // Step 5
      const budget = currentStepEl.querySelector("#grocery_budget");
      const pantry = currentStepEl.querySelectorAll("input[name='pantry']:checked").length;
      if (!budget.value || isNaN(budget.value)) { showError(budget, "Valid budget required"); isValid = false; }
      if (!pantry) { showError(currentStepEl.querySelector("input[name='pantry']"), "Select pantry items"); isValid = false; }
      break;
  }

  return isValid;
}

function updateFormSteps() {
  formSteps.forEach((step, idx) => {
    step.classList.toggle("active", idx === currentStep);
  });

  prevBtn.style.display = currentStep === 0 ? "none" : "inline-block";
  nextBtn.textContent = currentStep === formSteps.length - 1 ? "Submit" : "Next";
}

nextBtn.addEventListener("click", () => {
  if (!validateStep()) return;
  if (currentStep < formSteps.length - 1) {
    currentStep++;
    updateFormSteps();
  } else {
    nextBtn.disabled = true;
    nextBtn.innerHTML = `<div class="spinner"></div> Submitting...`;
    setTimeout(() => {
      document.getElementById("mealForm").submit();
    }, 1500);
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
