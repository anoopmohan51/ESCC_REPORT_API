const sql = require('mssql/msnodesqlv8');
require('dotenv').config();

const dbConfig = {
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT) || 1433,
    driver: 'msnodesqlv8',
    options: {
        trustedConnection: true,
        trustServerCertificate: true,
        connectTimeout: 60000,
        requestTimeout: 60000,
        idleTimeoutMillis: 30000
    },
    pool: {
        max: 200,
        min: 0,
        idleTimeoutMillis: 2400000
    }
};

const pool = new sql.ConnectionPool(dbConfig);

const connectDB = async () => {
    try {
        await pool.connect();
        console.log('Connected to SQL Server');
    } catch (error) {
        console.error('Database connection failed:', error);
        console.error('Please check:');
        console.error('1. SQL Server is running');
        console.error('2. Server name is correct');
        console.error('3. Database credentials are correct');
        console.error('4. Network connectivity to the server');
        throw error;
    }
};

module.exports = {
    pool,
    connectDB
}; 