import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Obscural/.env is two levels up from server/src/config
const envPath = path.resolve(__dirname, '../../../.env');

dotenv.config({ path: envPath });
dotenv.config();
