import dotenv from 'dotenv';
dotenv.config();
import { dataAdapter } from '../server/dataAdapter.js';
import { generateToken } from '../server/auth.js';

async function main() {
  const users = await dataAdapter.getUsers();
  const admin = users.find(u => u.rol === 'ADMINISTRADOR') || users[0];
  console.log('Admin user found:', admin);
  const token = generateToken({
    id: admin.id,
    username: admin.username,
    rol: admin.rol
  });
  console.log('GENERATED_TOKEN=' + token);
}

main().catch(console.error);
