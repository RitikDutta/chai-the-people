console.log("Chai ThePeople Home Page Loaded");

const svgCanvas = document.getElementById('smokeCanvas');

function createSmokeCurve() {
    // Simple throttle to prevent double-firing on slower devices
    if (document.hidden) return;

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.classList.add('smoke-path');

    // --- CURVE LOGIC ---
    // We draw narrower curves now for a more elegant look
    const startX = 50;
    const startY = 180;

    // Reduced random sway for smoother visual flow
    const endX = 50 + (Math.random() * 60 - 30); // Increased spread (was 30-15)
    const endY = 0;

    const cp1x = 50 + (Math.random() * 60 - 30); // Increased spread (was 40-20)
    const cp1y = 120;

    const cp2x = 50 + (Math.random() * 80 - 40); // Increased spread (was 60-30)
    const cp2y = 60;

    const d = `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`;
    path.setAttribute("d", d);

    // Slightly randomized duration
    const duration = Math.random() * 1.5 + 3.5; // 3.5s to 5s
    path.style.animationDuration = `${duration}s`;

    svgCanvas.appendChild(path);

    // Cleanup
    setTimeout(() => {
        path.remove();
    }, duration * 1000);
}

// 300ms is a sweet spot for performance vs visual density
if (svgCanvas) {
    setInterval(createSmokeCurve, 300);
}

// Scroll Effects
document.addEventListener('DOMContentLoaded', () => {
    const teaCupContainer = document.querySelector('.tea-cup-container');
    const scrollTexts = document.querySelectorAll('.scroll-text');

    // Parallax & Transition for Tea Cup
    const placeholder = document.getElementById('tea-cup-placeholder');

    function updateTeaCupPosition() {
        const scrollY = window.scrollY;
        const placeholderRect = placeholder.getBoundingClientRect();
        const windowHeight = window.innerHeight;

        // Default Parallax State (Section 1 & 2)
        // Cup is fixed at bottom: 0, left: 0
        // We apply a small parallax
        let targetX = 0;
        let targetY = scrollY * 0.15;
        let scale = 1;

        // Transition Logic
        // When the placeholder starts coming into view (or slightly before), we start moving the cup towards it.
        // We want the cup to land exactly on the placeholder when the placeholder is in its final position (centered vertically).

        // Calculate where the placeholder is relative to the viewport
        const placeholderTop = placeholderRect.top;
        const placeholderLeft = placeholderRect.left;

        // Define the "Transition Zone"
        // Start transitioning when placeholder is entering from the bottom
        // End transitioning when placeholder is near the center
        const startTransition = windowHeight; // When placeholder is at bottom of screen
        const endTransition = windowHeight / 2; // When placeholder is at center of screen

        if (placeholderTop < startTransition) {
            // Calculate progress (0 to 1)
            // 0 = at startTransition (bottom of screen)
            // 1 = at endTransition (center of screen)
            let progress = (startTransition - placeholderTop) / (startTransition - endTransition);
            progress = Math.min(Math.max(progress, 0), 1); // Clamp between 0 and 1

            // Ease the progress for smoother movement
            const ease = t => t < .5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
            const easedProgress = ease(progress);

            // Calculate Target Position (relative to the fixed container's origin at bottom-left)
            // The container is width: 100%, bottom: 0. The cup img is inside.
            // We need to move the *container* or the *img*. 
            // The container is fixed. Let's move the container.

            // Current Fixed Position (visual start point):
            // X: 0 (actually it has some padding/margin in CSS? Let's check. .tea-cup-img has margin-left: 3rem)
            // Y: 0 (bottom aligned)

            // Target Position (visual end point):
            // X: placeholderLeft
            // Y: placeholderTop - (windowHeight - cupHeight) ... wait.
            // The fixed container is at bottom: 0.
            // So Y=0 means bottom of screen.
            // If placeholder is at top: 100px.
            // We need to translate Y by -(windowHeight - placeholderTop - cupHeight).
            // Actually simpler: translateY = placeholderTop - (windowHeight - cupHeightOffset)

            // Let's assume the cup sits on the bottom edge initially.
            // The placeholder top is `placeholderTop`.
            // The cup height is approx 150px.
            // So the cup's top should be at `placeholderTop`.
            // The container's top is `windowHeight - containerHeight`.

            // Let's use getBoundingClientRect of the cup to be precise if we could, but we are transforming it.
            // Instead, let's just calculate offsets.

            // Initial State (Progress 0):
            // X = 0
            // Y = scrollY * 0.15 (Parallax)

            // Final State (Progress 1):
            // X = placeholderLeft - (3rem margin offset approx, or better: 0 and we move container to match)
            // The .tea-cup-img has `margin-left: 5rem` (from CSS check? No, let's check CSS).
            // CSS: .tea-cup-img { width: 120px; margin-left: 5%; margin-bottom: 2rem; }
            // So visual X start is 5%. Visual Y start is bottom 2rem.

            // We need to cancel out the CSS margins in our target calculation or account for them.
            // Let's calculate the delta needed.

            // Target X (screen coordinate) = placeholderLeft
            // Start X (screen coordinate) = window.innerWidth * 0.05 (5%)
            // Delta X = placeholderLeft - (window.innerWidth * 0.05)

            // Target Y (screen coordinate top) = placeholderTop
            // Start Y (screen coordinate top) = windowHeight - 150px (approx cup height) - 2rem (margin)
            // Delta Y = placeholderTop - (windowHeight - 150 - 32)

            // But wait, the parallax `scrollY * 0.15` is already applied.
            // We should interpolate from `parallaxY` to `TargetY`.

            const startX = 0;
            const startY = scrollY * 0.15;

            // We need to know the cup's dimensions/margins dynamically for robustness
            const cupImg = document.querySelector('.tea-cup-img');
            const cupStyle = window.getComputedStyle(cupImg);
            const marginLeft = parseFloat(cupStyle.marginLeft);
            const marginBottom = parseFloat(cupStyle.marginBottom);
            const cupHeight = cupImg.offsetHeight;

            // Target translation relative to the fixed container's original position
            // The fixed container is at 0,0. The cup is at marginLeft, windowHeight - cupHeight - marginBottom.

            // We want the cup's top-left to be at placeholderLeft, placeholderTop.
            // Currently cup's top-left is at: marginLeft, windowHeight - cupHeight - marginBottom.

            const currentVisualX = marginLeft;
            const currentVisualY = windowHeight - cupHeight - marginBottom; // Top edge of cup

            const finalTranslateX = placeholderLeft - currentVisualX;
            const finalTranslateY = placeholderTop - currentVisualY;

            targetX = startX + (finalTranslateX - startX) * easedProgress;
            targetY = startY + (finalTranslateY - startY) * easedProgress;

            // Scale interpolation if sizes differ
            // Placeholder is 150px. Cup is 120px (from CSS).
            // We might want to scale up.
            const startScale = 1;
            const endScale = 150 / 120; // 1.25
            scale = startScale + (endScale - startScale) * easedProgress;
        }

        teaCupContainer.style.transform = `translate(${targetX}px, ${targetY}px) scale(${scale})`;
    }

    window.addEventListener('scroll', () => {
        window.requestAnimationFrame(updateTeaCupPosition);
    });

    // Initial call
    updateTeaCupPosition();

    // Intersection Observer for Text
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, {
        threshold: 0.2 // Trigger when 20% visible
    });

    scrollTexts.forEach(text => {
        observer.observe(text);
    });
});
