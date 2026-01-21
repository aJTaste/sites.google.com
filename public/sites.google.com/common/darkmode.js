// darkmode.js

// Function to initialize the dark mode setting based on localStorage
function initializeDarkMode() {
    const darkModeEnabled = localStorage.getItem('darkMode');
    if (darkModeEnabled === 'true') {
        enableDarkMode();
    } else {
        disableDarkMode();
    }
}

// Function to enable dark mode
function enableDarkMode() {
    document.documentElement.style.setProperty('--background-color', '#121212');
    document.documentElement.style.setProperty('--text-color', '#ffffff');
    localStorage.setItem('darkMode', 'true');
}

// Function to disable dark mode
function disableDarkMode() {
    document.documentElement.style.setProperty('--background-color', '#ffffff');
    document.documentElement.style.setProperty('--text-color', '#000000');
    localStorage.setItem('darkMode', 'false');
}

// Event listener for a toggle button to switch modes
const toggleButton = document.getElementById('darkModeToggle');
toggleButton.addEventListener('click', () => {
    const darkModeEnabled = localStorage.getItem('darkMode');
    if (darkModeEnabled === 'true') {
        disableDarkMode();
    } else {
        enableDarkMode();
    }
});

// Initialize dark mode on page load
window.addEventListener('DOMContentLoaded', initializeDarkMode);