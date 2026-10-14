// Mobile bottom nav: highlight current tab
  (function(){
    const path = (location.pathname || "").toLowerCase();
    let key = "household";
    if(path.includes("business")) key = "business";
    else if(path.includes("investment")) key = "investment";
    else if(path.includes("leisure")) key = "leisure";

    document.querySelectorAll('.mobile-nav .mnav').forEach(a=>{
      a.classList.toggle('active', a.getAttribute('data-nav') === key);
    });
  })();
