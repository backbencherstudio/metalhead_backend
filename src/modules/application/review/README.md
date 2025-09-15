# Review System

This module implements a comprehensive rating and review system where both users and helpers can rate each other after a job is completed.

## Features

- **Mutual Reviews**: Both job owners and helpers can rate and review each other
- **Job-Specific Reviews**: Reviews are tied to specific completed jobs
- **Rating System**: 1-5 star rating system with optional text comments
- **Dashboard Integration**: Reviews are visible on user dashboards
- **Validation**: Proper validation for rating values and review content
- **Security**: Only job participants can create reviews for their jobs

## API Endpoints

### Create Review
```http
POST /api/reviews
Authorization: Bearer <token>
Content-Type: application/json

{
  "rating": 5,
  "comment": "Great work! Very professional and completed on time.",
  "reviewee_id": "clx123456789",
  "job_id": "clx123456789"
}
```

### Get Job Reviews
```http
GET /api/reviews/job/{jobId}
Authorization: Bearer <token>
```

### Get User Reviews
```http
GET /api/reviews/user/{userId}?page=1&limit=10
Authorization: Bearer <token>
```

### Get My Reviews
```http
GET /api/reviews/my-reviews?page=1&limit=10
Authorization: Bearer <token>
```

### Update Review
```http
PATCH /api/reviews/{reviewId}
Authorization: Bearer <token>
Content-Type: application/json

{
  "rating": 4,
  "comment": "Updated review: Still great work!"
}
```

### Delete Review
```http
DELETE /api/reviews/{reviewId}
Authorization: Bearer <token>
```

### Complete Job (Enable Reviews)
```http
PATCH /api/jobs/{jobId}/complete
Authorization: Bearer <token>
```

## Database Schema

### Review Model
```prisma
model Review {
  id         String    @id @default(cuid())
  created_at DateTime  @default(now())
  updated_at DateTime  @default(now())
  deleted_at DateTime?

  rating Int? // 1-5 star rating
  comment String? @db.Text // Review text/note

  // Who wrote the review
  reviewer_id String?
  reviewer    User?   @relation("ReviewerReviews", fields: [reviewer_id], references: [id])

  // Who is being reviewed
  reviewee_id String?
  reviewee    User?   @relation("RevieweeReviews", fields: [reviewee_id], references: [id])

  // Which job this review is for
  job_id String?
  job    Job?   @relation(fields: [job_id], references: [id], onDelete: Cascade)

  @@map("reviews")
}
```

## Workflow

1. **Job Creation**: User creates a job posting
2. **Counter Offers**: Helpers submit counter offers
3. **Job Confirmation**: User accepts a counter offer (job status: 'confirmed')
4. **Job Completion**: Either participant marks job as completed (job status: 'completed')
5. **Review Creation**: Both participants can now create reviews for each other
6. **Dashboard Display**: Reviews are visible on both users' dashboards

## Business Rules

- Reviews can only be created for jobs with status 'completed'
- Only job participants (owner or helper) can create reviews
- Each participant can only review the other participant
- One review per participant per job
- Reviews can be updated or deleted by the reviewer
- Rating must be between 1-5 stars
- Comments are optional but recommended

## Response DTOs

### ReviewResponseDto
```typescript
{
  id: string;
  rating: number;
  comment?: string;
  created_at: Date;
  updated_at: Date;
  reviewer: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  reviewee: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  job_id: string;
}
```

### JobReviewsResponseDto
```typescript
{
  job_id: string;
  job_title: string;
  reviews: ReviewResponseDto[];
  average_rating?: number;
  total_reviews: number;
}
```

### UserReviewsSummaryDto
```typescript
{
  user_id: string;
  user_name: string;
  average_rating: number;
  total_reviews: number;
  recent_reviews: ReviewResponseDto[];
}
```

## Error Handling

- **400 Bad Request**: Invalid rating, job not completed, review already exists
- **403 Forbidden**: Not authorized to create/update/delete review
- **404 Not Found**: Job, user, or review not found

## Security

- JWT authentication required for all endpoints
- Users can only review participants in their jobs
- Users can only modify their own reviews
- Proper validation of all input data
