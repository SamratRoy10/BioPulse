import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const { roll_number } = req.body;

    if (!roll_number) {
      return res.status(400).json({ success: false, message: 'Roll Number is required for attendance' });
    }

    // Insert a new log into the attendance table. 
    // The database automatically generates the scan_time!
    await sql`
      INSERT INTO attendance (roll_number) 
      VALUES (${roll_number});
    `;

    return res.status(200).json({ success: true, message: 'Attendance logged successfully!' });
    
  } catch (error) {
    console.error('Attendance Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
