/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      colors: {
        // Add custom colors if needed
      }
    },
  },
  plugins: [],
  // Important: Prevent purging of dynamic classes
  safelist: [
    'bg-blue-50', 'bg-blue-100', 'bg-blue-200', 'bg-blue-500', 'bg-blue-600', 'bg-blue-700',
    'text-blue-600', 'text-blue-700', 'text-blue-800', 'border-blue-200',
    'bg-green-50', 'bg-green-100', 'bg-green-200', 'bg-green-500',
    'text-green-600', 'text-green-700', 'text-green-800', 'border-green-200',
    'bg-purple-50', 'bg-purple-100', 'bg-purple-200',
    'text-purple-600', 'text-purple-700', 'text-purple-800', 'border-purple-200',
    'bg-orange-50', 'bg-orange-100', 'bg-orange-200',
    'text-orange-600', 'text-orange-700', 'text-orange-800', 'border-orange-200',
    'bg-red-50', 'bg-red-100', 'bg-red-500',
    'text-red-600', 'text-red-700', 'text-red-800', 'border-red-200',
    'bg-yellow-50', 'bg-yellow-100', 'bg-yellow-500',
    'text-yellow-600', 'text-yellow-700', 'text-yellow-800', 'border-yellow-200'
  ]
}
