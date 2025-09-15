# User Statistics API

This document describes the user statistics endpoints that provide comprehensive data about users and helpers including job completion counts and rating statistics.

## New Endpoints

### 1. Get User Statistics
```http
GET /api/reviews/user/{userId}/stats
Authorization: Bearer <token>
```

### 2. Get My Statistics
```http
GET /api/reviews/my-stats
Authorization: Bearer <token>
```

## Response Format

```json
{
  "user_id": "cmfgh8zs60001ihi83b7pj5h4",
  "user_name": "John Smith",
  "user_type": "user",
  "total_jobs_completed": 5,
  "total_jobs_delivered": 0,
  "average_rating": 4.7,
  "total_reviews": 12,
  "recent_reviews": [
    {
      "id": "review_id_1",
      "rating": 5,
      "comment": "Excellent work!",
      "created_at": "2024-01-15T10:30:00.000Z",
      "reviewer": {
        "id": "reviewer_id",
        "name": "Jane Doe",
        "email": "jane@example.com",
        "avatar": "https://example.com/avatar.jpg"
      },
      "job": {
        "id": "job_id",
        "title": "Website Development"
      }
    }
  ],
  "rating_breakdown": {
    "five_star": 8,
    "four_star": 3,
    "three_star": 1,
    "two_star": 0,
    "one_star": 0
  }
}
```

## Statistics Explained

### For Users (Job Posters)
- **total_jobs_completed**: Number of jobs they posted that have been completed
- **total_jobs_delivered**: Always 0 (not applicable for job posters)
- **average_rating**: Average rating received from helpers
- **total_reviews**: Number of reviews received from helpers

### For Helpers (Job Takers)
- **total_jobs_completed**: Always 0 (not applicable for helpers)
- **total_jobs_delivered**: Number of jobs they completed as a helper
- **average_rating**: Average rating received from job posters
- **total_reviews**: Number of reviews received from job posters

### Rating Breakdown
- **five_star**: Number of 5-star reviews
- **four_star**: Number of 4-star reviews
- **three_star**: Number of 3-star reviews
- **two_star**: Number of 2-star reviews
- **one_star**: Number of 1-star reviews

## Use Cases

### Dashboard Display
```javascript
// Example dashboard component
const userStats = await fetch('/api/reviews/my-stats');
const stats = await userStats.json();

// Display user profile
console.log(`${stats.user_name} (${stats.user_type})`);
console.log(`Jobs Completed: ${stats.total_jobs_completed}`);
console.log(`Jobs Delivered: ${stats.total_jobs_delivered}`);
console.log(`Average Rating: ${stats.average_rating}/5`);
console.log(`Total Reviews: ${stats.total_reviews}`);
```

### User Profile Page
```javascript
// Example user profile
const userStats = await fetch(`/api/reviews/user/${userId}/stats`);
const stats = await userStats.json();

// Show rating breakdown
stats.rating_breakdown.five_star; // Show 5-star count
stats.rating_breakdown.four_star; // Show 4-star count
// etc.
```

### Helper Search/Filtering
```javascript
// Filter helpers by rating
const helpers = allHelpers.filter(helper => 
  helper.average_rating >= 4.0 && 
  helper.total_jobs_delivered >= 5
);
```

## Business Logic

### Job Counting
- **Users**: Count jobs where `user_id = userId` AND `job_status = 'completed'`
- **Helpers**: Count jobs where helper has accepted offer AND `job_status = 'completed'`

### Rating Calculation
- Average rating is calculated from all reviews where `reviewee_id = userId`
- Rounded to 1 decimal place
- Returns 0 if no reviews exist

### Recent Reviews
- Shows last 5 reviews received by the user
- Includes reviewer information and job details
- Ordered by creation date (newest first)

## Error Handling

### 404 Not Found
```json
{
  "statusCode": 404,
  "message": "User not found",
  "error": "Not Found"
}
```

## Performance Considerations

- Statistics are calculated in real-time
- Consider caching for high-traffic scenarios
- Database queries are optimized with proper indexing
- Recent reviews are limited to 5 items to reduce payload size

## Integration with Existing Features

This statistics system integrates seamlessly with:
- Review system (for rating calculations)
- Job system (for completion counts)
- User system (for profile information)
- Role switching (handles both user and helper types)
