# Temporary JWT Flow - API Testing Guide

## Overview
This system allows users to get a temporary JWT after email verification, which they can use to immediately update their profile.

## Flow
1. **Register User** → Get OTP
2. **Verify Email with OTP** → Get Temporary JWT
3. **Update Profile with Temporary JWT** → Get Permanent JWT

## API Endpoints

### 1. Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "first_name": "John",
  "last_name": "Doe",
  "email": "john.doe@example.com",
  "username": "johndoe",
  "password": "password123",
  "phone_number": "+1234567890",
  "type": "user"
}
```

**Response:**
```json
{
  "success": true,
  "message": "We have sent an OTP code to your email"
}
```

### 2. Verify Email with OTP
```http
POST /api/auth/verify-email
Content-Type: application/json

{
  "email": "john.doe@example.com",
  "token": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Email verified successfully",
  "temporary_jwt": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user_id": "user_id_here"
}
```

### 3. Update Profile with Temporary JWT
```http
PATCH /api/auth/update
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "address": "123 Main Street",
  "city": "New York",
  "state": "NY",
  "zip_code": "10001",
  "age": 28,
  "date_of_birth": "01/11/1996",
  "bio": "Professional developer",
  "skills": ["JavaScript", "TypeScript", "Node.js"]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Profile updated successfully. You can now use the permanent JWT for future requests.",
  "permanent_jwt": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "data": {
    "id": "user_id_here",
    "first_name": "John",
    "last_name": "Doe",
    "email": "john.doe@example.com",
    "address": "123 Main Street",
    "city": "New York",
    "state": "NY",
    "zip_code": "10001",
    "age": 28,
    "date_of_birth": "1996-01-11T00:00:00.000Z",
    "bio": "Professional developer",
    "skills": ["JavaScript", "TypeScript", "Node.js"]
  }
}
```

### 4. Test Temporary JWT (Optional)
```http
GET /api/auth/test-temporary-jwt
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response:**
```json
{
  "success": true,
  "message": "Temporary JWT is working!",
  "user_id": "user_id_here",
  "is_temporary": true,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Key Features

### Temporary JWT Properties
- **Expiry**: 1 hour
- **Purpose**: Profile completion only
- **Type**: `temporary`
- **Usage**: Single use for profile update

### Permanent JWT Properties
- **Expiry**: As configured in your JWT settings
- **Purpose**: Full application access
- **Type**: Regular JWT (no type field)
- **Usage**: All authenticated endpoints

## Security Notes
- Temporary JWT has short expiry (1 hour)
- Temporary JWT can only be used for profile updates
- After profile update, user gets permanent JWT
- Both temporary and permanent JWTs are accepted by the update endpoint

## Testing with Postman

1. **Create a new collection** called "Temporary JWT Flow"
2. **Add the 4 requests** above
3. **Set up environment variables**:
   - `base_url`: Your API base URL
   - `temporary_jwt`: Will be set from verify-email response
   - `permanent_jwt`: Will be set from update response
4. **Use Postman's test scripts** to automatically extract and set JWT tokens

## Error Handling

### Invalid Temporary JWT
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

### Expired Temporary JWT
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

### Invalid OTP
```json
{
  "success": false,
  "message": "Invalid token"
}
```

## Implementation Details

### Files Modified
- `src/modules/auth/auth.service.ts` - Added temporary JWT generation
- `src/modules/auth/auth.controller.ts` - Updated update endpoint
- `src/modules/auth/guards/temporary-jwt-auth.guard.ts` - New guard for temporary JWTs
- `src/modules/auth/auth.module.ts` - Added new guard
- `src/types/index.d.ts` - Extended user type

### Database Changes
No database changes required - the system uses existing user table.

### Environment Variables
No additional environment variables required - uses existing JWT configuration.
