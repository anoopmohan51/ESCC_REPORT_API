/**
 * Job Status Enum Constants
 * Defines the different states a job can be in
 */

const JOB_STATUS = {
  "In Progress": "1",
  "Sent To Manager":"2",
  "Forwarded to Accountant": "-1",
  "Billed and Closed":"-2",
  "All": "1,2,-1,-2",
  "Cancelled":"-3"
};

module.exports = JOB_STATUS; 


