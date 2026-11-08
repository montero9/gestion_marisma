import app from './index.js';

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`🚀 Servidor Marisma de Hinojos (Supabase) ejecutándose en http://localhost:${PORT}`);
});
