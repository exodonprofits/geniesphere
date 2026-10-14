
document.getElementById('mealForm').addEventListener('submit', function (e) {
  e.preventDefault();
  document.querySelector('.form-navigation').style.display = 'none';
  document.getElementById('spinner').style.display = 'block';

  setTimeout(() => {
    window.location.href = 'nutrition-result.html';
  }, 2000);
});
