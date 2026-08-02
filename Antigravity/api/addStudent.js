import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  // 1. Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    // 2. Extract the data sent from your frontend app.js
    const { name, roll_number } = req.body;

    if (!name || !roll_number) {
      return res.status(400).json({ success: false, message: 'Name and Roll Number are required' });
    }

    // 3. Insert into the Neon database matching your exact column names
    await sql`
      INSERT INTO students (name, roll_number) 
      VALUES (${name}, ${roll_number});
    `;

    return res.status(200).json({ success: true, message: 'Student successfully saved to Neon!' });
    
  } catch (error) {
    // 4. If it fails, send the EXACT error message back to the browser
    console.error('Database Insert Error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Database insert failed', 
      details: error.message 
    });
  }
}
