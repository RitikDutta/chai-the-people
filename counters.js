// Select all elements with the class 'counter-number'
const counters = document.querySelectorAll('.counter-number');
// Set the animation speed/duration (in milliseconds)
const animationDuration = 2000; // 2 seconds

// Function to update a single counter
const updateCount = (counter) => {
    const target = +counter.getAttribute('data-target'); // Get target number from data attribute
    const count = +counter.innerText; // Get current number displayed

    // Calculate the increment needed per step
    // Divide target by duration to get increment per ms, then multiply by update interval (e.g., 1ms)
    // A smaller interval makes it smoother but more resource-intensive
    // Let's aim for roughly 100 steps for smoothness
    const updateInterval = animationDuration / 100;
    const increment = target / (animationDuration / updateInterval);

    if (count < target) {
        // Update the counter text, rounding up to avoid decimals during animation
        counter.innerText = Math.ceil(count + increment);
        // Schedule the next update
        setTimeout(() => updateCount(counter), updateInterval); // Adjust timeout for speed
    } else {
        // Ensure the final target number is displayed exactly
        counter.innerText = target;
    }
};

// --- Intersection Observer to trigger animation only when visible ---
const observerOptions = {
    root: null, // use the viewport
    threshold: 0.1 // Trigger when 10% of the element is visible
};

const observerCallback = (entries, observer) => {
    entries.forEach(entry => {
        // Check if the element is intersecting (visible)
        if (entry.isIntersecting) {
            const counterElement = entry.target;
            console.log(`Counter ${counterElement.dataset.target} is visible, starting animation.`);
            updateCount(counterElement); // Start the animation
            observer.unobserve(counterElement); // Stop observing once animation starts
        }
    });
};

const observer = new IntersectionObserver(observerCallback, observerOptions);

// Observe each counter element
counters.forEach(counter => {
    // Initialize text to 0 before observing
    counter.innerText = '0';
    observer.observe(counter);
    console.log(`Observing counter for target: ${counter.dataset.target}`);
});