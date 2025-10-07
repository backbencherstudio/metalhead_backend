# Debug 401 Unauthorized Error

## 🔍 Issue Analysis

**Error**: `401 Unauthorized` on PATCH request from Flutter app

**Possible Causes:**
1. **Missing Authorization Header**
2. **Invalid JWT Token**
3. **Expired JWT Token**
4. **Wrong JWT Format**
5. **Authentication Guard Issues**

## 🛠️ Debug Steps

### **Step 1: Check Your Flutter Request**

Make sure your Flutter app is sending the Authorization header correctly:

```dart
// Correct format
headers: {
  'Content-Type': 'application/json',
  'Authorization': 'Bearer YOUR_JWT_TOKEN_HERE', // Make sure this is correct
}
```

### **Step 2: Verify JWT Token**

Check if your JWT token is valid:

1. **Decode your JWT** at https://jwt.io
2. **Check expiration** - make sure it's not expired
3. **Verify format** - should be `Bearer <token>`

### **Step 3: Test with Postman/API Client**

Test the same endpoint with Postman to isolate the issue:

```http
PATCH /api/auth/update
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "address": "123 Main St",
  "city": "New York",
  "state": "NY",
  "zip_code": "10001",
  "age": 29,
  "date_of_birth": "01/11/1996",
  "bio": "This is my bio",
  "skills": ["JavaScript", "Node.js"]
}
```

### **Step 4: Check JWT Token Generation**

If you're using a temporary JWT, make sure it was generated correctly:

```http
POST /api/auth/verify-email
{
  "email": "user@example.com",
  "otp": "123456"
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Email verified successfully",
  "temporary_jwt": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user_id": "user_id_here"
}
```

## 🔧 Common Fixes

### **Fix 1: Correct Authorization Header**

**Flutter Code:**
```dart
final response = await http.patch(
  Uri.parse('$baseUrl/api/auth/update'),
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer $jwtToken', // Make sure this is correct
  },
  body: jsonEncode({
    'address': address,
    'city': city,
    'state': state,
    'zip_code': zipCode,
    'age': age,
    'date_of_birth': dateOfBirth,
    'bio': bio,
    'skills': skills,
  }),
);
```

### **Fix 2: Check JWT Token Storage**

Make sure you're storing and retrieving the JWT token correctly:

```dart
// Store token after login/verification
await storage.write(key: 'jwt_token', value: responseData['temporary_jwt']);

// Retrieve token for requests
String? jwtToken = await storage.read(key: 'jwt_token');
```

### **Fix 3: Handle Token Expiration**

Add token expiration handling:

```dart
if (response.statusCode == 401) {
  // Token might be expired, try to refresh or re-authenticate
  await refreshToken();
  // Retry the request
}
```

## 🧪 Test Endpoints

### **Test 1: Check if JWT is Working**

```http
GET /api/auth/test-temporary-jwt
Authorization: Bearer YOUR_JWT_TOKEN
```

### **Test 2: Check User Info**

```http
GET /api/payment/cards/debug/user-lookup
Authorization: Bearer YOUR_JWT_TOKEN
```

## 📋 Debug Checklist

- [ ] **Authorization header** is present and correctly formatted
- [ ] **JWT token** is valid and not expired
- [ ] **Bearer prefix** is included in Authorization header
- [ ] **Content-Type** is set to `application/json`
- [ ] **Request method** is PATCH (not POST)
- [ ] **URL** is correct (`/api/auth/update`)
- [ ] **JWT token** was generated from a valid user

## 🚨 Quick Fix

If you're still having issues, try this:

1. **Get a fresh JWT token** by re-verifying email
2. **Use the temporary JWT** from the verification response
3. **Test with Postman first** to confirm the endpoint works
4. **Copy the exact headers** from working Postman request to Flutter

## 📞 Need More Help?

If the issue persists, please share:
1. **Your Flutter request code**
2. **The JWT token** (you can decode it at jwt.io)
3. **The exact error response**
4. **Whether it works with Postman**

This will help identify the exact cause of the 401 error!
