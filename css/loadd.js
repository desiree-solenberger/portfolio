document.addEventListener("DOMContentLoaded", () => {
  const lazyImages = document.querySelectorAll("img");

  lazyImages.forEach(img => {
    // Enable native lazy loading
    img.setAttribute("loading", "lazy");

    // Optional: thumbnail swap
    if (img.dataset.src) {
      // Use Intersection Observer if available
      if ("IntersectionObserver" in window) {
        const observer = new IntersectionObserver((entries, obs) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              img.src = img.dataset.src;      // load full image
              img.onload = () => img.classList.add("loaded");
              obs.unobserve(img);
            }
          });
        });
        observer.observe(img);
      } else {
        // Fallback for older browsers
        img.src = img.dataset.src;
        img.onload = () => img.classList.add("loaded");
      }
    }
  });
});
