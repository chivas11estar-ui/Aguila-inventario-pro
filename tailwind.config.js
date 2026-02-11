/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ["./index.html", "./*.js"],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                primary: "#0056b3",
                secondary: "#10b981",
                "background-light": "#f4f7fa",
                "background-dark": "#0f172a",
            },
            fontFamily: {
                display: ["Inter", "sans-serif"],
            },
            borderRadius: {
                DEFAULT: "12px",
            },
        },
    },
    plugins: [],
}
