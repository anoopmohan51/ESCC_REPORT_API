/**
 * Job Status Enum Constants
 * Defines the different states a job can be in
 */

const JOB_STATUS = {
  "In Progress": "1",
  "Forwarded to Accountant": "2", 
  "Billed and Closed": "-1",
  "Closed": "-2",
  "All": "1,2,-1,-2"
};

module.exports = JOB_STATUS; 


