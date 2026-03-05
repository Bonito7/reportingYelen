/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                orange: {
                    primary: 'var(--orange-primary)',
                    light: 'var(--orange-light)',
                    dark: 'var(--orange-dark)',
                },
                dark: 'var(--bg-dark)',
                'text-primary': 'var(--text-primary)',
                secondary: 'var(--text-secondary)',
                muted: 'var(--text-muted)',
            }
        },
    },
    plugins: [],
}
