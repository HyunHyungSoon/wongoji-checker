/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{html,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#185FA5',
        correction: '#cc0000',
        gridbg: '#fff9ee',
        gridline: '#c8b899',
        panel: '#f5f0e8'
      },
      fontFamily: {
        // covers macOS (Apple SD Gothic Neo) and Windows (Malgun Gothic) so the
        // shared web version renders Korean correctly on teachers' machines
        kr: ['Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans KR', 'sans-serif']
      }
    }
  },
  plugins: []
}
