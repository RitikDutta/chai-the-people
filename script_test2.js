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
