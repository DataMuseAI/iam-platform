import {Pool} from 'pg';
import {cfg} from './config';
const globalDb=globalThis as typeof globalThis & {__webPool?:Pool};
export const db=globalDb.__webPool ?? new Pool({connectionString:cfg.WEB_DATABASE_URL,max:10});
if(process.env.NODE_ENV!=='production')globalDb.__webPool=db;
