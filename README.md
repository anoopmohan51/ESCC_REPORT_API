# ESCC Report API

A Node.js backend API with SQL Server integration for ESCC reporting system.

## Prerequisites

- Node.js (v14 or higher)
- SQL Server
- npm or yarn

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the root directory with the following variables:
   ```
   PORT=3000
   NODE_ENV=development
   DB_SERVER=your_server_name
   DB_DATABASE=your_database_name
   DB_USER=your_username
   DB_PASSWORD=your_password
   DB_PORT=1433
   ```

## Running the Application

Development mode:
```bash
npm run dev
```

Production mode:
```bash
npm start
```

## Project Structure

```
escc-report-api/
├── src/
│   ├── config/
│   │   └── db.js
│   └── app.js
├── .env
├── package.json
└── README.md
```

## API Endpoints

- `GET /`: Welcome message
- More endpoints will be added as the project grows

## Security

- Uses Helmet for security headers
- CORS enabled
- Environment variables for sensitive data
- SQL injection protection through parameterized queries 