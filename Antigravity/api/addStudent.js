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

    // Try inserting with photo, fallback to null if photo is missing/broken
    await sql`
      INSERT INTO students (name, roll_number, photo) 
      VALUES (${name}, ${roll_number}, ${photo || null});
    `;

    return res.status(200).json({ success: true, message: 'Student successfully saved to Neon!' });
    
  } catch (error) {
    console.error('Detailed Database Insert Error:', error);
    // Send the actual database error message back to the browser console so we can see it!
    return res.status(500).json({ 
      success: false, 
      message: error.message || 'Database insert failed' 
    });
  }
}
