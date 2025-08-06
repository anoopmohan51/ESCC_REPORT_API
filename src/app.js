const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const sql = require('mssql');
const utf7 = require('utf7');

const { connectDB, pool } = require('./config/db');
const JOB_STATUS = require('./constants/jobStatus');
const DATE_RANGE_FILTER = require('./constants/dateRangeFilter');
const SORT_FIELD = require('./constants/sortField');
const SORT_DIRECTION = require('./constants/sortDirection');
const PROJECT_MANAGER_STATUS = require('./constants/projectManagerStatus');

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/', (req, res) => {
    res.json({ message: 'Welcome to ESCC Report API' });
});

// Utility function to encode password as described
function encodePassword(password) {
    // Equivalent of UTF7Encoding.GetString(hashedBytes)
    const strDecrypted = utf7.decode(password.toString());

    let strNewDecrypted = '';

    for (let i = 0; i < strDecrypted.length; i++) {
        const chPswdChar = strDecrypted[i];
        const charCode = chPswdChar.charCodeAt(0);

        if (charCode !== 0) {
            strNewDecrypted += String.fromCharCode(charCode - 10);
        } else {
            break;
        }
    }

    return strNewDecrypted;
}

// Utility function to decode password (equivalent to IantzClass.GetPassword)
function decodePassword(hashedBytes) {
    if (!hashedBytes) return '';
    
    // Convert to Buffer if it's not already
    let buffer;
    if (Buffer.isBuffer(hashedBytes)) {
        buffer = hashedBytes;
    } else if (typeof hashedBytes === 'string') {
        // If it's a string, try to convert to buffer
        buffer = Buffer.from(hashedBytes, 'binary');
    } else if (Array.isArray(hashedBytes)) {
        // If it's an array of bytes
        buffer = Buffer.from(hashedBytes);
    } else {
        console.log('Invalid hashedBytes format:', typeof hashedBytes);
        return '';
    }
    
    // Equivalent of UTF7Encoding.GetString(hashedBytes)
    const strDecrypted = utf7.decode(buffer.toString());

    let strNewDecrypted = '';

    for (let i = 0; i < strDecrypted.length; i++) {
        const chPswdChar = strDecrypted[i];
        const charCode = chPswdChar.charCodeAt(0);

        if (charCode !== 0) {
            strNewDecrypted += String.fromCharCode(charCode - 10);
        } else {
            break;
        }
    }

    return strNewDecrypted;
}

// JWT Authentication Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ message: 'Access token required' });
    }
    
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

// Get Job Details API with JWT Authentication
app.get('/job/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    
    if (!id) {
        return res.status(400).json({ message: 'Job ID is required.' });
    }

    try {
        const request = pool.request();
        request.input('ID', sql.Int, parseInt(id));
        
        const result = await request.execute('uspS_ReportModuleSelectedIDsByID');
        
        // Print the result for debugging
        console.log('Job API Result:', JSON.stringify(result, null, 2));
        
        if (result.recordset && result.recordset.length > 0) {
            res.json({
                success: true,
                data: result.recordset,
                message: 'Job details retrieved successfully'
            });
        } else {
            res.status(404).json({
                success: false,
                message: 'Job not found'
            });
        }
    } catch (error) {
        console.error('Error fetching job details:', error);
        res.status(500).json({ 
            success: false,
            message: 'Internal server error while fetching job details' 
        });
    }
});

// Job Search API with JWT Authentication
app.post('/jobs/search', authenticateToken, async (req, res) => {
    // Get user details from request
    const userDetails = req.user;
    // console.log('Current user:', userDetails);
    
    // Print the entire request payload
    console.log('Jobs Search API Payload:', JSON.stringify(req.body, null, 2));
    
    const { 
        jobId, 
        startDate, 
        endDate, 
        filterRange,
        jobStatus,
        sortBy,
        sortDirection,
        projectManager,
        custCntctIds
    } = req.body;

    const { 
        offset = 0,
        limit = 50
    } = req.query;

    try {
        // Add debug logging for sortDirection
        console.log('Raw sortDirection from request:', sortDirection);
        console.log('SORT_DIRECTION enum values:', SORT_DIRECTION);
        
        // Handle case-insensitive sort direction
        let normalizedSortDirection = null;
        if (sortDirection) {
            // Find the matching key in SORT_DIRECTION regardless of case
            const sortDirKey = Object.keys(SORT_DIRECTION).find(
                key => key.toLowerCase() === sortDirection.toLowerCase()
            );
            normalizedSortDirection = sortDirKey ? SORT_DIRECTION[sortDirKey] : null;
        }
        console.log('Normalized sortDirection value:', normalizedSortDirection);

        // Prepare search parameters
        const searchParams = {
            jobId: jobId ? jobId.trim() : null,
            startDate: startDate ? new Date(startDate).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : null,
            endDate: endDate ? new Date(endDate).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : null,
            filterRange: DATE_RANGE_FILTER[filterRange] || null,
            jobStatus: jobStatus || null, // Keep original jobStatus from request body
            sortBy: SORT_FIELD[sortBy] || null,
            sortDirection: normalizedSortDirection,
            projectManager: projectManager || null,
            custCntctIds: custCntctIds || null,
            userId: req.user.userId,
            offset: parseInt(offset),
            limit: parseInt(limit)
        };
        console.log('Search Params:', searchParams);
        // Call the job search stored procedure
        const request = pool.request();
        
        // Set input parameters based on VB.NET code structure
        let paramCount = 0;
        
        // Create an object to store all parameters for logging
        const procedureParams = {};
        
        // if (searchParams.userId && searchParams.userId.toString() !== '') {
        //     request.input('StrUserID', sql.VarChar(50), searchParams.userId.toString());
        //     procedureParams.StrUserID = searchParams.userId.toString();
        //     paramCount++;
        // }
        
        if (searchParams.jobId && searchParams.jobId !== '') {
            request.input('StrJobId', sql.VarChar(50), searchParams.jobId);
            procedureParams.StrJobId = searchParams.jobId;
            paramCount++;
        }
        
        if (searchParams.filterRange && searchParams.filterRange !== '') {
            request.input('StrDateRangeFilter', sql.VarChar(50), searchParams.filterRange);
            procedureParams.StrDateRangeFilter = searchParams.filterRange;
            paramCount++;
        }
        
        if (searchParams.startDate && searchParams.startDate.toString() !== '1/1/1900') {
            request.input('StartDate', sql.DateTime, new Date(searchParams.startDate));
            procedureParams.StartDate = searchParams.startDate;
            paramCount++;
        }
        
        if (searchParams.endDate && searchParams.endDate.toString() !== '1/1/1900') {
            request.input('EndDate', sql.DateTime, new Date(searchParams.endDate));
            procedureParams.EndDate = searchParams.endDate;
            paramCount++;
        }
        
        if (searchParams.jobStatus) {
            // Convert jobStatus to array if it's not already
            const statusArray = Array.isArray(searchParams.jobStatus) 
                ? searchParams.jobStatus 
                : [searchParams.jobStatus];

            // Map each status to its corresponding value
            const statusValues = statusArray
                .map(status => JOB_STATUS[status])
                .filter(Boolean)
                .join(',');
            
            if (statusValues) {
                request.input('StrJobStatus', sql.VarChar(50), statusValues);
                procedureParams.StrJobStatus = statusValues;
                paramCount++;
            }
        }
        
        request.input('StrSortBy', sql.Int, searchParams.sortBy);
        procedureParams.StrSortBy = searchParams.sortBy;
        paramCount++;
        
        request.input('StrSortDirection', sql.Int, searchParams.sortDirection);
        procedureParams.StrSortDirection = searchParams.sortDirection;
        paramCount++;
        
        if (searchParams.projectManager && searchParams.projectManager !== '') {
            request.input('StrProjectManager', sql.VarChar(1000), searchParams.projectManager);
            procedureParams.StrProjectManager = searchParams.projectManager;
            paramCount++;
        }
        
        if (searchParams.custCntctIds && searchParams.custCntctIds !== '') {
            request.input('Strcust_cntct_ids', sql.VarChar(500), searchParams.custCntctIds);
            procedureParams.Strcust_cntct_ids = searchParams.custCntctIds;
        }
        
        // Log all procedure parameters
        console.log('=== Stored Procedure: uspS_JobReport ===');
        console.log('Parameters:', JSON.stringify(procedureParams, null, 2));
        console.log('Total parameters:', paramCount);
        console.log('=====================================');
        
        // Execute the stored procedure to get all results
        const result = await request.execute('uspS_JobReport');
        
        
        if (result.recordset && result.recordset.length > 0) {
            // Apply pagination to the results
            const totalCount = result.recordset.length;
            const startIndex = searchParams.offset;
            const endIndex = startIndex + searchParams.limit;
            const paginatedData = result.recordset.slice(startIndex, endIndex);
            
            res.json({
                success: true,
                data: paginatedData,
                message: 'Jobs found successfully',
                pagination: {
                    offset: searchParams.offset,
                    limit: searchParams.limit,
                    total: totalCount,
                    totalPages: Math.ceil(totalCount / searchParams.limit),
                    currentPage: Math.floor(searchParams.offset / searchParams.limit) + 1,
                    hasNextPage: endIndex < totalCount,
                    hasPreviousPage: searchParams.offset > 0
                }
            });
        } else {
            res.json({
                success: false,
                message: 'No items found',
                data: [],
                pagination: {
                    offset: searchParams.offset,
                    limit: searchParams.limit,
                    total: 0,
                    totalPages: 0,
                    currentPage: 1,
                    hasNextPage: false,
                    hasPreviousPage: false
                }
            });
        }

    } catch (error) {
        console.error('Error searching jobs:', error);
        res.status(500).json({ 
            success: false,
            message: 'Internal server error while searching jobs' 
        });
    }
});

// Login API
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required.' });
    }

    try {
        // Get user IP address
        const userIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress || (req.connection.socket ? req.connection.socket.remoteAddress : null) || req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || '127.0.0.1';
        
        // Convert password to binary format (similar to VB.NET SqlDbType.Binary)
        const encodedPassword = encodePassword(password);
        const passwordBuffer = Buffer.from(encodedPassword, 'utf8');

        // Call the stored procedure SP_IS_VALID_LOGIN_NAME
        const request = pool.request();
        
        // Set parameters as per VB.NET code
        request.input('UserName', sql.VarChar(20), username);
        request.input('IPAddress', sql.VarChar(20), userIP);
        request.output('Password', sql.VarBinary(50));
        request.output('ErrorCode', sql.Int);
        request.output('LoginAttempts', sql.Int);
        request.output('UserWorkEmail', sql.VarChar(50));

        // Log login procedure parameters
        console.log('=== Stored Procedure: SP_IS_VALID_LOGIN_NAME ===');
        console.log('Input Parameters:', JSON.stringify({
            UserName: username,
            IPAddress: userIP
        }, null, 2));
        console.log('Output Parameters: Password, ErrorCode, LoginAttempts, UserWorkEmail');
        console.log('=====================================');

        // Execute the stored procedure
        const result = await request.execute('SP_IS_VALID_LOGIN_NAME');
        
        // Get output parameters
        const errorCode = result.output.ErrorCode;
        const loginAttempts = result.output.LoginAttempts;
        const userWorkEmail = result.output.UserWorkEmail;

        // Check error code (similar to VB.NET logic)
        if (errorCode === 0) {
            // Successful login - NOW Check the password
            
            // Get the encrypted password from the stored procedure result
            // Note: In VB.NET, ecrPswrdFromLogin = cmmdDoLogin.Parameters(2).Value
            // We need to get this from the stored procedure output or recordset
            const encryptedPasswordFromDB = result.output.Password;
            
            // Decode the password (assuming IantzClass.GetPassword equivalent)
            const decodedPasswordFromDB = decodePassword(encryptedPasswordFromDB);
            
            if (decodedPasswordFromDB === password) {
                // Password is correct.. NOW check whether the user is allowed to login from here.
                const loginActionsRequest = pool.request();
                loginActionsRequest.input('UserName', sql.VarChar(20), username);
                loginActionsRequest.input('IPAddress', sql.VarChar(20), userIP);
                loginActionsRequest.output('ErrorCode', sql.Int);
                
                const loginActionsResult = await loginActionsRequest.execute('SP_DO_LOGIN_ACTIONS');
                const loginActionsErrorCode = loginActionsResult.output.ErrorCode;
                
                if (loginActionsErrorCode === 0) {
                    // The IP is not blocked, now get the USER_ID and pass to the success area.
                    const getUserIdRequest = pool.request();
                    getUserIdRequest.input('LoginName', sql.VarChar(20), username);
                    getUserIdRequest.output('UserId', sql.Int);
                    
                    const getUserIdResult = await getUserIdRequest.execute('SP_GET_USER_ID');
                    const userId = getUserIdResult.output.UserId;
                    
                    // Generate JWT token with user ID
                    const token = jwt.sign({ 
                        userId: userId,
                        username: username,
                        userWorkEmail: userWorkEmail,
                        ipAddress: userIP
                    }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
                    const refresh_token = jwt.sign({ 
                        userId: userId,
                        username: username,
                        userWorkEmail: userWorkEmail,
                        ipAddress: userIP
                    }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '7d' });

                    // Return success response
                    res.json({
                        message: 'Login successful',
                        user: {
                            userId: userId,
                            username: username,
                            userWorkEmail: userWorkEmail,
                            loginAttempts: loginAttempts || 0
                        },
                        token,
                        refresh_token
                    });
                } else {
                    // IP is blocked or other login action error
                    res.status(403).json({ 
                        message: 'Access denied - IP blocked or login restrictions',
                        errorCode: loginActionsErrorCode
                    });
                }
            } else {
                // Log the Failed Login Attempt
                const failedLoginRequest = pool.request();
                failedLoginRequest.input('UserName', sql.VarChar(20), username);
                failedLoginRequest.input('IPAddress', sql.VarChar(20), userIP);
                failedLoginRequest.input('Comments', sql.VarChar(1000), 'failed login attempt');
                failedLoginRequest.input('AccessCode', sql.VarChar(50), 'no code');
                
                await failedLoginRequest.execute('usp_Login_Failed_Attempt');
                
                res.status(401).json({ 
                    message: 'Invalid username or password',
                    loginAttempts: loginAttempts || 0,
                    errorCode: -14004
                });
            }
        } else {
            // Handle different error codes from first stored procedure
            let errorMessage = 'Login failed';
            switch (errorCode) {
                case 1:
                    errorMessage = 'Invalid username or password';
                    break;
                case 2:
                    errorMessage = 'Account is disabled';
                    break;
                case 3:
                    errorMessage = 'Too many login attempts';
                    break;
                default:
                    errorMessage = `Login error: ${errorCode}`;
            }
            
            return res.status(401).json({ 
                message: errorMessage,
                loginAttempts: loginAttempts || 0
            });
        }

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

// Refresh Token API
app.post('/refresh-token', async (req, res) => {
    const { refresh_token } = req.body;

    if (!refresh_token) {
        return res.status(400).json({ message: 'Refresh token is required.' });
    }

    try {
        // Verify the refresh token
        const user = jwt.verify(refresh_token, process.env.REFRESH_TOKEN_SECRET);

        // Generate new access token and refresh token
        const newAccessToken = jwt.sign({ 
            userId: user.userId,
            username: user.username,
            userWorkEmail: user.userWorkEmail,
            ipAddress: user.ipAddress
        }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });

        const newRefreshToken = jwt.sign({ 
            userId: user.userId,
            username: user.username,
            userWorkEmail: user.userWorkEmail,
            ipAddress: user.ipAddress
        }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '7d' });

        // Return new tokens
        res.json({
            message: 'Tokens refreshed successfully',
            token: newAccessToken,
            refresh_token: newRefreshToken
        });
    } catch (error) {
        console.error('Token refresh error:', error);
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Refresh token has expired. Please login again.' });
        }
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Invalid refresh token.' });
        }
        res.status(500).json({ message: 'Internal server error.' });
    }
});

// Get Project Managers API with JWT Authentication
app.post('/project-managers', authenticateToken, async (req, res) => {
    const { status } = req.body;

    if (!status || typeof status !== 'string') {
        return res.status(400).json({ 
            success: false,
            message: 'Status must be a string value' 
        });
    }

    try {
        const request = pool.request();
        
        // Convert status string to its corresponding numeric value
        const statusKey = status.toUpperCase();
        let pmTypeValue = 1; // default to ACTIVE

        if (statusKey === 'ALL') {
            pmTypeValue = 1; // default to ACTIVE for 'ALL'
        } else {
            const numericStatus = PROJECT_MANAGER_STATUS[statusKey];
            if (numericStatus === undefined) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid status: ${status}`
                });
            }
            pmTypeValue = numericStatus;
        }
        request.input('strProjectManagerIDs', sql.VarChar(5), "0");
        request.input('PMType', sql.Int, pmTypeValue);
        request.input('USER_ID', sql.VarChar(50), req.user.userId);
        request.input('ip', sql.VarChar(50),'127.0.0.1');
        request.input('ReportId',sql.Int,0)
        // Log procedure parameters
        console.log('=== Stored Procedure: uspS_getmembersforJobsassignment ===');
        console.log('Parameters:', JSON.stringify({
            strProjectManagerIDs: "0",
            PMType: pmTypeValue,
            RequestedStatus: status,
            USER_ID: req.user.userId,
            ip: '127.0.0.1',
            ReportId: 0
        }, null, 2));
        
        // Log SQL parameter types for debugging
        console.log('SQL Parameter Types:', {
            strProjectManagerIDs: 'VarChar(5)',
            PMType: 'Int',
            USER_ID: 'VarChar(50)',
            ip: 'VarChar(50)',
            ReportId: 'Int'
        });
        
        const result = await request.execute('uspS_getmembersforJobsassignment');
        
        if (result.recordset && result.recordset.length > 0) {
            res.json({
                success: true,
                data: result.recordset,
                message: 'Project managers retrieved successfully'
            });
        } else {
            res.json({
                success: false,
                message: 'No project managers found',
                data: []
            });
        }

    } catch (error) {
        console.error('Error fetching project managers:', error);
        res.status(500).json({ 
            success: false,
            message: 'Internal server error while fetching project managers' 
        });
    }
});

// List Sites API with JWT Authentication
app.post('/sites', authenticateToken, async (req, res) => {
    const { search } = req.body;
    const { offset = 0, limit = 50 } = req.query;

    try {
        const request = pool.request();
        let procedureName;
        let procedureParams;

        // Common parameters for all procedures
        const commonParams = {
            ShowCustSiteOnce: 1,
            USER_ID: req.user.userId,
            ip: req.ip || '127.0.0.1',
            ReportID: 0
        };

        if (typeof search === 'string' && search.trim() !== '') {
            const str_phone_number = getPhone(search);
            
            if (str_phone_number !== 'No') {
                // Case 2: Valid phone number - use phone search procedure
                procedureName = 'SP_CUSTOMER_SITE_SEARCH_PHONEV2_for_report';
                procedureParams = {
                    ...commonParams,
                    SearchField: search.trim(),
                    strPhoneNo: str_phone_number
                };

                request.input('ShowCustSiteOnce', sql.Bit, procedureParams.ShowCustSiteOnce);
                request.input('SearchField', sql.VarChar(100), procedureParams.SearchField);
                request.input('strPhoneNo', sql.VarChar(50), procedureParams.strPhoneNo);
                request.input('USER_ID', sql.VarChar(50), procedureParams.USER_ID);
                request.input('ip', sql.VarChar(50), procedureParams.ip);
                request.input('ReportID', sql.Int, procedureParams.ReportID);
            } else {
                // Case 3: Not a phone number - use simple search procedure
                procedureName = 'SP_CUSTOMER_SITE_SEARCH_SIMPLEV2_for_report';
                procedureParams = {
                    ...commonParams,
                    SearchField: search.trim()
                };

                request.input('ShowCustSiteOnce', sql.Bit, procedureParams.ShowCustSiteOnce);
                request.input('SearchField', sql.VarChar(100), procedureParams.SearchField);
                request.input('USER_ID', sql.VarChar(50), procedureParams.USER_ID);
                request.input('ip', sql.VarChar(50), procedureParams.ip);
                request.input('ReportID', sql.Int, procedureParams.ReportID);
            }
        } else {
            // Case 1: No search term - use list all procedure
            procedureName = 'SP_LIST_ALL_CUSTOMER_SITEV2_for_report';
            procedureParams = commonParams;

            request.input('ShowCustSiteOnce', sql.Bit, procedureParams.ShowCustSiteOnce);
            request.input('USER_ID', sql.VarChar(50), procedureParams.USER_ID);
            request.input('ip', sql.VarChar(50), procedureParams.ip);
            request.input('ReportID', sql.Int, procedureParams.ReportID);
        }

        // Log procedure parameters
        console.log(`=== Stored Procedure: ${procedureName} ===`);
        console.log('Parameters:', JSON.stringify(procedureParams, null, 2));
        
        // Execute the stored procedure
        const result = await request.execute(procedureName);

        if (result.recordset && result.recordset.length > 0) {
            // Filter results if search parameter is provided
            let filteredData = result.recordset;
            if (typeof search === 'string' && search.trim() !== '') {
                const searchLower = search.toLowerCase().trim();
                filteredData = result.recordset.filter(site => 
                    Object.values(site).some(value => 
                        value && value.toString().toLowerCase().includes(searchLower)
                    )
                );
            }

            // Apply pagination
            const totalCount = filteredData.length;
            const startIndex = parseInt(offset);
            const endIndex = startIndex + parseInt(limit);
            const paginatedData = filteredData.slice(startIndex, endIndex);

            res.json({
                success: true,
                data: paginatedData,
                message: 'Sites retrieved successfully',
                pagination: {
                    offset: startIndex,
                    limit: parseInt(limit),
                    total: totalCount,
                    totalPages: Math.ceil(totalCount / limit),
                    currentPage: Math.floor(startIndex / limit) + 1,
                    hasNextPage: endIndex < totalCount,
                    hasPreviousPage: startIndex > 0
                }
            });
        } else {
            res.json({
                success: false,
                message: 'No sites found',
                data: [],
                pagination: {
                    offset: parseInt(offset),
                    limit: parseInt(limit),
                    total: 0,
                    totalPages: 0,
                    currentPage: 1,
                    hasNextPage: false,
                    hasPreviousPage: false
                }
            });
        }

    } catch (error) {
        console.error('Error fetching sites:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error while fetching sites'
        });
    }
});

// Utility function to format phone numbers
function getPhone(strSubString) {
    if (!strSubString || typeof strSubString !== 'string') {
        return 'No';
    }

    // Remove specified characters
    strSubString = strSubString
        .replace(/\(/g, '')
        .replace(/\-/g, '')
        .replace(/\)/g, '')
        .replace(/\s/g, '')
        .replace(/x/g, '');

    // Check if the remaining string is numeric
    if (/^\d+$/.test(strSubString)) {
        // Insert formatting characters at specific positions
        strSubString = '(' + strSubString;  // Insert at beginning
        if (strSubString.length >= 4) {
            strSubString = strSubString.slice(0, 4) + ')' + strSubString.slice(4);
        }
        if (strSubString.length >= 5) {
            strSubString = strSubString.slice(0, 5) + ' ' + strSubString.slice(5);
        }
        if (strSubString.length >= 9) {
            strSubString = strSubString.slice(0, 9) + '-' + strSubString.slice(9);
        }
        if (strSubString.length >= 15) {
            strSubString = strSubString.slice(0, 14) + 'x' + strSubString.slice(14);
        }
        if (strSubString.length > 18) {
            strSubString = strSubString.substring(0, 19);
        }
        return strSubString;
    }
    
    return 'No';
}

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Something went wrong!' });
});

const PORT = process.env.PORT || 3000;

// Start server
const startServer = async () => {
    try {
        await connectDB();
        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer(); 