// middleware/auth.js

const jwt = require('jsonwebtoken');

// NOTE: Use the same secret key you defined in your .env file
const JWT_SECRET = process.env.JWT_SECRET || 'a_very_secret_key_that_is_long_and_random'; 

const auth = (req, res, next) => {
    // 1. Get the Authorization header
    const authHeader = req.header('Authorization');
    
    // Check 1: If no Authorization header exists or it doesn't start with 'Bearer '
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        // This is the error path that currently causes the 401 you are seeing
        return res.status(401).json({ 
            message: 'No token found, or token is not in "Bearer <token>" format. Authorization denied.' 
        });
    }

    // Extract the token part (The JWT is the second element after splitting by space)
    const token = authHeader.split(' ')[1];

    try {
        // 2. Verify the token using the secret key
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // 3. Normalize and attach a predictable `req.user` object so routes can use `req.user.id` safely.
        // Support tokens that include either { id } or { userId } in their payload.
        req.user = {
            id: decoded.id || decoded.userId,
            email: decoded.email || null,
        };
        
        // 4. Continue to the route handler (e.g., to routes/clipboard.js)
        next();

    } catch (err) {
        // If the token is invalid (expired, wrong secret, or malformed JWT body)
        // Log the error detail internally for debugging, but send a generic 401 to the client
        console.error('JWT Verification Failed:', err.message);
        res.status(401).json({ message: 'Token is not valid or has expired.' });
    }
};

module.exports = auth;