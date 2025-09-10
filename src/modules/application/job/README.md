# Job Posting API

This module implements a comprehensive job posting system based on the mobile-first web form design. It allows users to create, manage, and browse job postings with all the features shown in the form.

## Features Implemented

### 1. Job Summary Section
- **Job Title**: Text input for job title
- **Category**: Dropdown selection for job category
- **Date and Time**: Date/time picker for preferred scheduling
- **Price**: Numeric input for job pricing
- **Payment Type**: Dropdown for payment methods (Fixed Price, Hourly, Per Project)
- **Job Type**: Dropdown for work arrangement (Remote, On-site, Hybrid)
- **Location**: Text input for job location
- **Estimated Time**: Optional text input for time estimation

### 2. Job Description Section
- **Description**: Large text area for detailed job description

### 3. Job Requirements Section
- **Dynamic Requirements**: Add multiple requirement entries with title and description
- **Add/Remove**: Plus button to add new requirements

### 4. Important Notes Section
- **Dynamic Notes**: Add multiple important notes with title and description
- **Add/Remove**: Plus button to add new notes

### 5. Photos Section (Optional)
- **File Upload**: Drag and drop or browse files functionality
- **Multiple Photos**: Support for multiple photo uploads per job
- **Storage Integration**: Uses the project's SojebStorage system

## API Endpoints

### Authentication
All endpoints require JWT authentication. Include the Bearer token in the Authorization header.

### Job Management

#### Create Job
```http
POST /api/jobs
Content-Type: application/json
Authorization: Bearer <token>

{
  "title": "Frontend Developer",
  "category": "Technology",
  "date_and_time": "2024-01-15T10:00:00Z",
  "price": 5000,
  "payment_type": "Fixed Price",
  "job_type": "Remote",
  "location": "New York, NY",
  "estimated_time": "2 weeks",
  "description": "We are looking for a skilled frontend developer...",
  "requirements": [
    {
      "title": "Experience Required",
      "description": "Must have 3+ years of React experience"
    }
  ],
  "notes": [
    {
      "title": "Important Notice",
      "description": "This job requires immediate availability"
    }
  ]
}
```

#### Get All Jobs (with filters)
```http
GET /api/jobs?page=1&limit=10&category=Technology&location=New York&jobType=Remote
Authorization: Bearer <token>
```

#### Get My Jobs
```http
GET /api/jobs/my-jobs?page=1&limit=10
Authorization: Bearer <token>
```

#### Get Job by ID
```http
GET /api/jobs/{jobId}
Authorization: Bearer <token>
```

#### Update Job
```http
PATCH /api/jobs/{jobId}
Content-Type: application/json
Authorization: Bearer <token>

{
  "title": "Updated Job Title",
  "price": 6000
}
```

#### Delete Job
```http
DELETE /api/jobs/{jobId}
Authorization: Bearer <token>
```

### Photo Management

#### Upload Photo
```http
POST /api/jobs/{jobId}/photos
Content-Type: multipart/form-data
Authorization: Bearer <token>

file: [binary file data]
```

#### Remove Photo
```http
DELETE /api/jobs/photos/{photoId}
Authorization: Bearer <token>
```

## Database Schema

The implementation includes the following Prisma models:

- **Job**: Main job posting entity
- **JobRequirement**: Individual job requirements
- **JobNote**: Important notes for jobs
- **JobPhoto**: Photo attachments for jobs

## File Storage

Photos are stored using the project's SojebStorage system:
- Files are stored in the `job-photos/` directory
- Unique filenames are generated using UUID
- Public URLs are provided for accessing uploaded photos

## Validation

All inputs are validated using class-validator decorators:
- Required fields are enforced
- Email format validation where applicable
- File type and size validation for uploads
- Proper data type validation

## Error Handling

The API includes comprehensive error handling:
- 404 errors for non-existent resources
- 403 errors for unauthorized access
- 400 errors for validation failures
- Proper error messages and status codes

## Usage Examples

### Frontend Integration

```javascript
// Create a new job
const createJob = async (jobData) => {
  const response = await fetch('/api/jobs', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(jobData)
  });
  return response.json();
};

// Upload a photo
const uploadPhoto = async (jobId, file) => {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await fetch(`/api/jobs/${jobId}/photos`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });
  return response.json();
};
```

This implementation provides a complete job posting system that matches the form design and includes all the functionality needed for a modern job marketplace application.
