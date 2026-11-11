// Vercel function entry. `npm run build` (tsc) runs first, so this re-exports the compiled app.
// Every path is rewritten here by vercel.json; Express sees the original URL.
export { default } from '../distribution/vercel.js';
