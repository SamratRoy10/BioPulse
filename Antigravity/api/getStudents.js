import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  try {
    // Simplified query: grabs everything without sorting to prevent column errors
    const { rows } = await sql`SELECT * FROM students;`;
    return res.status(200).json(rows);
  } catch (error) {
    // This passes the EXACT error message back to your browser console
    console.error('Database error details:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch students', 
      details: error.message 
    });
  }
}
