import { neon } from '@neondatabase/serverless'; //

export default async function handler(req, res) {
    // 1. Only allow POST requests (sending data)
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Only POST requests allowed' });
    }

    try {
        // 2. Connect to the database using your secure Vercel environment variable
        const sql = neon(process.env.DATABASE_URL); //

        // 3. Grab the student data sent from your frontend
        const { name, roll_number } = req.body;

        // 4. Securely insert the data into your Neon database
        // This syntax is safe from SQL injection attacks
        await sql`
            INSERT INTO students (name, roll_number, status) 
            VALUES (${name}, ${roll_number}, 'Present')
        `; //

        // 5. Send a success message back to the frontend
        return res.status(200).json({ success: true, message: 'Student saved to database!' });
        
    } catch (error) {
        console.error("Database error:", error);
        return res.status(500).json({ success: false, message: 'Failed to connect to database' });
    }
}
