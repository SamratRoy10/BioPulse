import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const { name, roll_number, photo } = req.body;

    if (!name || !roll_number) {
      return res.status(400).json({ success: false, message: 'Name and Roll Number are required' });
    }

    await sql`
      INSERT INTO students (name, roll_number, photo) 
      VALUES (${name}, ${roll_number}, ${photo || null});
    `;

    return res.status(200).json({ success: true, message: 'Student and photo successfully saved to Neon!' });
    
  } catch (error) {
    console.error('Database Insert Error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Database insert failed', 
      details: error.message 
    });
  }
}
