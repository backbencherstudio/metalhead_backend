# Dashboard API

This module provides comprehensive dashboard functionality for both helpers and users, including job management, earnings tracking, and button state management.

## Features

### 1. Helper Dashboard
- **Job Statistics**: Total jobs, active jobs, completed jobs
- **Earnings Tracking**: Total earnings, pending earnings
- **Stripe Integration**: Onboarding status, payment capability
- **Recent Jobs**: Latest job activities
- **Active Jobs**: Currently ongoing jobs with action buttons

### 2. User Dashboard
- **Job Statistics**: Total jobs posted, active jobs, completed jobs
- **Spending Tracking**: Total spent, pending payments
- **Recent Jobs**: Latest job postings
- **Active Jobs**: Currently ongoing jobs with action buttons

### 3. Button State Management
- **Dynamic Actions**: Context-aware button states
- **Auto-completion**: 24-hour auto-completion countdown
- **Role-based Access**: Different actions for helpers vs users
- **Real-time Updates**: Live countdown timers

## API Endpoints

### Authentication
All endpoints require JWT authentication. Include the Bearer token in the Authorization header.

### Helper Dashboard

#### Get Helper Dashboard
```http
GET /api/dashboard/helper
Authorization: Bearer <token>
```

**Response:**
```json
{
  "helper_id": "helper_id",
  "helper_name": "John Doe",
  "total_jobs": 15,
  "active_jobs": 3,
  "completed_jobs": 12,
  "total_earnings": 25000,
  "pending_earnings": 5000,
  "stripe_onboarding_completed": true,
  "can_receive_payments": true,
  "recent_jobs": [
    {
      "id": "job_id",
      "title": "Website Development",
      "status": "ongoing",
      "price": 5000,
      "final_price": 5000,
      "created_at": "2024-01-15T10:00:00Z",
      "accepted_offer": {
        "helper_id": "helper_id",
        "helper_name": "John Doe",
        "amount": 5000
      },
      "available_actions": [
        {
          "action": "complete",
          "enabled": true
        }
      ]
    }
  ],
  "active_jobs_list": [...]
}
```

### User Dashboard

#### Get User Dashboard
```http
GET /api/dashboard/user
Authorization: Bearer <token>
```

**Response:**
```json
{
  "user_id": "user_id",
  "user_name": "Jane Smith",
  "total_jobs_posted": 8,
  "active_jobs": 2,
  "completed_jobs": 6,
  "total_spent": 30000,
  "pending_payments": 10000,
  "recent_jobs": [
    {
      "id": "job_id",
      "title": "Website Development",
      "status": "completed",
      "price": 5000,
      "final_price": 5000,
      "created_at": "2024-01-15T10:00:00Z",
      "accepted_offer": {
        "helper_id": "helper_id",
        "helper_name": "John Doe",
        "amount": 5000
      },
      "available_actions": [
        {
          "action": "mark_finished",
          "enabled": true
        },
        {
          "action": "auto_complete",
          "enabled": true,
          "countdown": 3600
        }
      ]
    }
  ],
  "active_jobs_list": [...]
}
```

### Job Action States

#### Get Job Action States
```http
GET /api/dashboard/job/{jobId}/actions
Authorization: Bearer <token>
```

**Response:**
```json
{
  "job_id": "job_id",
  "job_status": "completed",
  "user_role": "owner",
  "available_actions": [
    {
      "action": "mark_finished",
      "enabled": true
    },
    {
      "action": "auto_complete",
      "enabled": true,
      "countdown": 3600
    }
  ],
  "auto_complete_at": "2024-01-16T10:00:00Z",
  "auto_release_at": "2024-01-16T10:00:00Z"
}
```

### Admin Endpoints

#### Get Helper Dashboard by ID
```http
GET /api/dashboard/helper/{helperId}
Authorization: Bearer <admin_token>
```

#### Get User Dashboard by ID
```http
GET /api/dashboard/user/{userId}
Authorization: Bearer <admin_token>
```

## Button Actions

### Helper Actions
- **`start`**: Start a confirmed job (changes status to ongoing)
- **`complete`**: Mark an ongoing job as completed

### User Actions
- **`mark_finished`**: Mark a completed job as finished (triggers payment release)
- **`auto_complete`**: Shows countdown until automatic completion

### Auto-completion Logic
- Jobs are automatically marked as finished after 24 hours of completion
- Payment is automatically released after 24 hours
- Countdown shows remaining seconds until auto-completion

## Job Status Flow

```
posted → counter_offer → confirmed → ongoing → completed → paid
```

### Button Availability by Status

| Status | Helper Actions | User Actions |
|--------|----------------|--------------|
| `posted` | None | None |
| `counter_offer` | None | Accept/Decline counter offers |
| `confirmed` | Start job | None |
| `ongoing` | Complete job | None |
| `completed` | None | Mark finished, Auto-complete countdown |
| `paid` | None | None |

## Error Responses

### 404 Not Found
```json
{
  "statusCode": 404,
  "message": "Helper not found",
  "error": "Not Found"
}
```

### 401 Unauthorized
```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```

### 403 Forbidden
```json
{
  "statusCode": 403,
  "message": "You are not authorized to view this job",
  "error": "Forbidden"
}
```

## Integration with Existing APIs

The dashboard APIs work seamlessly with existing job management APIs:

- **Job Creation**: `POST /api/jobs`
- **Job Updates**: `PATCH /api/jobs/{id}`
- **Job Status Changes**: `PATCH /api/jobs/{id}/start`, `PATCH /api/jobs/{id}/complete`
- **Counter Offers**: `POST /api/counter-offers`, `POST /api/counter-offers/accept/{id}`

## Frontend Integration

### Helper Dashboard
```javascript
// Get helper dashboard
const helperDashboard = await fetch('/api/dashboard/helper', {
  headers: { 'Authorization': `Bearer ${token}` }
});

// Check if helper can start a job
const jobActions = await fetch(`/api/dashboard/job/${jobId}/actions`, {
  headers: { 'Authorization': `Bearer ${token}` }
});

const startAction = jobActions.available_actions.find(a => a.action === 'start');
if (startAction?.enabled) {
  // Show "Start Job" button
}
```

### User Dashboard
```javascript
// Get user dashboard
const userDashboard = await fetch('/api/dashboard/user', {
  headers: { 'Authorization': `Bearer ${token}` }
});

// Check auto-completion countdown
const jobActions = await fetch(`/api/dashboard/job/${jobId}/actions`, {
  headers: { 'Authorization': `Bearer ${token}` }
});

const autoCompleteAction = jobActions.available_actions.find(a => a.action === 'auto_complete');
if (autoCompleteAction?.countdown) {
  // Show countdown timer
  const hours = Math.floor(autoCompleteAction.countdown / 3600);
  const minutes = Math.floor((autoCompleteAction.countdown % 3600) / 60);
  console.log(`Auto-completion in ${hours}h ${minutes}m`);
}
```

## Real-time Updates

For real-time updates, consider implementing:

1. **WebSocket Integration**: Connect to existing chat WebSocket for live updates
2. **Polling**: Refresh dashboard data every 30 seconds
3. **Server-Sent Events**: Stream updates for countdown timers

## Security Considerations

- All endpoints require JWT authentication
- Users can only access their own dashboard data
- Job action states are role-based (helper vs owner)
- Admin endpoints require elevated permissions
- Sensitive financial data is properly protected
