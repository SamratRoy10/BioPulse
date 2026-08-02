import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  try {
    // Make sure you are querying ONLY the students table without JOINs
    const { rows } = await sql`SELECT * FROM students ORDER BY id DESC;`;
    
    return res.status(200).json({ success: true, students: rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
