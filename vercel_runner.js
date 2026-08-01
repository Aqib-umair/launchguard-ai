import app from './server.js';
const port = 3000;
app.listen(port, () => {
  console.log(`[Vercel Simulation] Backend running on port ${port}`);
});
