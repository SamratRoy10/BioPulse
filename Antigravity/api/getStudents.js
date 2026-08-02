import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  try {
    // Fetch all students from Neon, ordered newest first
    const result = await sql`SELECT * FROM students ORDER BY id DESC;`;
    
    // Vercel Postgres returns rows in the .rows property
    return res.status(200).json(result.rows);
  } catch (error) {
    console.error('Fetch Students Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
