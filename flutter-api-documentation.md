# 🚀 **Complete API Documentation for Flutter Developers**

## 📋 **Overview**
This document provides all the job-related APIs, counter offers, and notifications that your Flutter developers need to integrate with the backend.

---

## 🔐 **Authentication**
All endpoints require JWT authentication:
```
Authorization: Bearer {jwt_token}
```

---

## 📱 **1. JOB MANAGEMENT APIs**

### **Base URL:** `/api/jobs`

#### **1.1 Create Job**
```http
POST /api/jobs
Content-Type: multipart/form-data
Authorization: Bearer {jwt_token}

Body (Form Data):
- title: string
- category: string (CLEANING, TECHNOLOGY, etc.)
- description: string
- payment_type: "HOURLY" | "FIXED"
- job_type: "URGENT" | "ANYTIME"
- price: string (number as string)
- start_time: string (ISO date)
- end_time: string (ISO date)
- location: string
- latitude: number
- longitude: number
- urgent_note: string (optional)
- requirements: array of {title: string, description: string}
- file: File (optional photo)
```

#### **1.2 Get All Jobs (with filters)**
```http
GET /api/jobs?page=1&limit=10&category=CLEANING&location=Dhaka&jobType=URGENT&priceRange=100,500&sortBy=date_newest&search=cleaning&urgency=urgent
Authorization: Bearer {jwt_token}
```

#### **1.3 Get My Jobs (Posted by User)**
```http
GET /api/jobs/my-jobs?page=1&limit=10
Authorization: Bearer {jwt_token}
```

#### **1.4 Get Job Details**
```http
GET /api/jobs/{jobId}
Authorization: Bearer {jwt_token}
```

#### **1.5 Update Job**
```http
PATCH /api/jobs/{jobId}
Content-Type: multipart/form-data
Authorization: Bearer {jwt_token}
```

#### **1.6 Delete Job**
```http
DELETE /api/jobs/{jobId}
Authorization: Bearer {jwt_token}
```

#### **1.7 Get Job Categories**
```http
GET /api/jobs/categories
Authorization: Bearer {jwt_token}
```

#### **1.8 Get Jobs by Category**
```http
GET /api/jobs/by-category/{category}?page=1&limit=10
Authorization: Bearer {jwt_token}
```

---

## 🕐 **2. JOB STATUS & TIME TRACKING APIs**

#### **2.1 Start Job (Helper)**
```http
PATCH /api/jobs/{jobId}/start
Authorization: Bearer {helper_jwt_token}
```

#### **2.2 Complete Job**
```http
PATCH /api/jobs/{jobId}/complete
Authorization: Bearer {jwt_token}
```

#### **2.3 Finish Job**
```http
PATCH /api/jobs/{jobId}/finish
Authorization: Bearer {jwt_token}
```

#### **2.4 Get Time Tracking**
```http
GET /api/jobs/{jobId}/time-tracking
Authorization: Bearer {jwt_token}
```

#### **2.5 Get Job Timeline**
```http
GET /api/jobs/{jobId}/timeline
Authorization: Bearer {jwt_token}
```

---

## ⏰ **3. EXTRA TIME REQUEST SYSTEM (NEW)**

#### **3.1 Request Extra Time (Helper)**
```http
POST /api/jobs/{jobId}/request-extra-time
Authorization: Bearer {helper_jwt_token}
Content-Type: application/json

{
  "extra_hours": 2,
  "reason": "The furniture is heavier than expected and requires additional time for safe moving"
}
```

#### **3.2 Approve/Reject Extra Time (Client)**
```http
PUT /api/jobs/{jobId}/approve-extra-time
Authorization: Bearer {client_jwt_token}
Content-Type: application/json

{
  "approved": true,
  "message": "Approved. Please take your time to do the job properly."
}
```

#### **3.3 Get Extra Time Status**
```http
GET /api/jobs/{jobId}/extra-time-status
Authorization: Bearer {jwt_token}
```

**Response includes:**
```json
{
  "total_approved_hours": 4.67,
  "total_approved_hours_formatted": "4 hours and 40 minutes"
}
```

---

## 💼 **4. COUNTER OFFER APIs**

### **Base URL:** `/api/counter-offers`

#### **4.1 Create Counter Offer (Helper)**
```http
POST /api/counter-offers
Authorization: Bearer {helper_jwt_token}
Content-Type: application/json

{
  "job_id": "job_id_here",
  "amount": 5000,
  "type": "counter_offer",
  "note": "I can start immediately and complete this project within the timeline"
}
```

#### **4.2 Get Counter Offers by Job**
```http
GET /api/counter-offers/job/{job_id}
Authorization: Bearer {jwt_token}
```

#### **4.3 Get Counter Offers by Helper**
```http
GET /api/counter-offers/helper/{helper_id}
Authorization: Bearer {jwt_token}
```

#### **4.4 Accept Counter Offer (Job Owner)**
```http
POST /api/counter-offers/accept/{counter_offer_id}
Authorization: Bearer {client_jwt_token}
```

#### **4.5 Decline Counter Offer (Job Owner)**
```http
POST /api/counter-offers/decline/{counter_offer_id}
Authorization: Bearer {client_jwt_token}
```

#### **4.6 User Counter Back (Job Owner)**
```http
POST /api/counter-offers/user-counter/{counter_offer_id}
Authorization: Bearer {client_jwt_token}
Content-Type: application/json

{
  "amount": 4500,
  "note": "This is my counter offer"
}
```

#### **4.7 Helper Accept User Counter (Helper)**
```http
POST /api/counter-offers/helper-accept/{counter_offer_id}
Authorization: Bearer {helper_jwt_token}
```

#### **4.8 Direct Accept Job (Helper)**
```http
POST /api/counter-offers/direct-accept/{job_id}
Authorization: Bearer {helper_jwt_token}
Content-Type: application/json

{
  "note": "I accept this job at the original price"
}
```

---

## 📍 **5. NEARBY JOBS & NOTIFICATIONS APIs**

### **Base URL:** `/api/nearby-jobs`

#### **5.1 Get Nearby Jobs (Helper)**
```http
GET /api/nearby-jobs?page=1&limit=10&maxDistanceKm=25&minPrice=100&maxPrice=1000&categories=CLEANING,TECHNOLOGY&sortBy=distance
Authorization: Bearer {helper_jwt_token}
```

#### **5.2 Get Nearby Jobs Count**
```http
GET /api/nearby-jobs/count?maxDistanceKm=25
Authorization: Bearer {helper_jwt_token}
```

#### **5.3 Update Notification Preferences**
```http
PUT /api/nearby-jobs/notification-preferences
Authorization: Bearer {helper_jwt_token}
Content-Type: application/json

{
  "enabled": true,
  "maxDistanceKm": 25,
  "minPrice": 100,
  "maxPrice": 1000,
  "categories": ["CLEANING", "TECHNOLOGY"]
}
```

#### **5.4 Test Notification**
```http
POST /api/nearby-jobs/test-notification
Authorization: Bearer {helper_jwt_token}
```

---

## 📊 **6. JOB HISTORY & FILTERING APIs**

### **Base URL:** `/api/job-history`

#### **6.1 Get User Job History (Posted Jobs)**
```http
GET /api/job-history/user?status=posted,confirmed,completed&jobType=URGENT,ANYTIME&minPrice=100&maxPrice=1000&sortBy=date_newest&page=1&limit=10
Authorization: Bearer {jwt_token}
```

#### **6.2 Get Helper Job History (Accepted Jobs)**
```http
GET /api/job-history/helper?status=confirmed,ongoing,completed&jobType=URGENT,ANYTIME&minPrice=100&maxPrice=1000&sortBy=date_newest&page=1&limit=10
Authorization: Bearer {helper_jwt_token}
```

#### **6.3 Get Nearest Jobs**
```http
GET /api/job-history/nearest?userLatitude=23.7104&userLongitude=90.40744&maxDistanceKm=25&page=1&limit=10
Authorization: Bearer {jwt_token}
```

#### **6.4 Get Best Rated Jobs**
```http
GET /api/job-history/best-rated?page=1&limit=10
Authorization: Bearer {jwt_token}
```

#### **6.5 Get All Jobs for User (Debug)**
```http
GET /api/jobs/debug/all-jobs
Authorization: Bearer {jwt_token}
```

---

## 📱 **7. PUSH NOTIFICATION APIs**

#### **7.1 Add Device Token**
```http
POST /api/jobs/device-token
Authorization: Bearer {jwt_token}
Content-Type: application/json

{
  "deviceToken": "firebase_device_token_here"
}
```

#### **7.2 Remove Device Token**
```http
DELETE /api/jobs/device-token
Authorization: Bearer {jwt_token}
Content-Type: application/json

{
  "deviceToken": "firebase_device_token_here"
}
```

#### **7.3 Get Device Tokens**
```http
GET /api/jobs/device-tokens
Authorization: Bearer {jwt_token}
```

---

## 📅 **8. APPOINTMENTS & EARNINGS APIs**

#### **8.1 Get Upcoming Appointments**
```http
GET /api/jobs/appointments/upcoming
Authorization: Bearer {jwt_token}
```

#### **8.2 Get Past Appointments**
```http
GET /api/jobs/appointments/past
Authorization: Bearer {jwt_token}
```

#### **8.3 Get Helper Upcoming Appointments**
```http
GET /api/jobs/appointments/helper/upcoming
Authorization: Bearer {helper_jwt_token}
```

#### **8.4 Get Helper Past Appointments**
```http
GET /api/jobs/appointments/helper/past
Authorization: Bearer {helper_jwt_token}
```

#### **8.5 Get Historical Earnings**
```http
GET /api/jobs/earnings/historical?startDate=2025-01-01&endDate=2025-01-31
Authorization: Bearer {jwt_token}
```

#### **8.6 Get Weekly Earnings**
```http
GET /api/jobs/earnings/weekly
Authorization: Bearer {jwt_token}
```

---

## 🔧 **9. HELPER PREFERENCES APIs**

#### **9.1 Update Helper Preferences**
```http
PATCH /api/jobs/helper/preferences
Authorization: Bearer {helper_jwt_token}
Content-Type: application/json

{
  "max_distance_km": 25,
  "min_job_price": 100,
  "max_job_price": 1000,
  "preferred_categories": ["CLEANING", "TECHNOLOGY"]
}
```

---

## 🎯 **10. KEY RESPONSE FORMATS**

### **Job Response:**
```json
{
  "id": "job_id",
  "title": "Job Title",
  "category": "CLEANING",
  "description": "Job description",
  "payment_type": "HOURLY",
  "job_type": "URGENT",
  "price": "5000",
  "start_time": "2025-01-08T14:00:00.000Z",
  "end_time": "2025-01-08T16:00:00.000Z",
  "estimated_time": "2 hours and 40 minutes",
  "location": "Dhaka, Bangladesh",
  "latitude": 23.7104,
  "longitude": 90.40744,
  "job_status": "posted",
  "user": {
    "id": "user_id",
    "name": "User Name",
    "email": "user@example.com",
    "avatar": "avatar_url"
  },
  "counter_offers": [...],
  "accepted_offers": [...],
  "requirements": [...],
  "created_at": "2025-01-08T10:00:00.000Z"
}
```

### **Counter Offer Response:**
```json
{
  "id": "counter_offer_id",
  "job_id": "job_id",
  "helper_id": "helper_id",
  "amount": 5000,
  "type": "counter_offer",
  "note": "I can start immediately",
  "status": "pending",
  "helper": {
    "id": "helper_id",
    "name": "Helper Name",
    "avatar": "avatar_url"
  },
  "created_at": "2025-01-08T10:00:00.000Z"
}
```

---

## 🚨 **11. ERROR HANDLING**

### **Common Error Responses:**
```json
{
  "success": false,
  "message": "Error message here",
  "error": "Bad Request",
  "statusCode": 400
}
```

### **Validation Errors:**
```json
{
  "success": false,
  "message": {
    "message": [
      "title should not be empty",
      "category should not be empty"
    ],
    "error": "Bad Request",
    "statusCode": 400
  }
}
```

---

## ✅ **12. RECOMMENDATION FOR FLUTTER DEVELOPERS**

### **✅ YES - Pass These APIs to Flutter Team:**

1. **All Job Management APIs** (Create, Read, Update, Delete)
2. **Counter Offer System** (Complete flow)
3. **Time Tracking & Extra Time System** (NEW - Very Important!)
4. **Nearby Jobs & Notifications** (Core functionality)
5. **Job History & Filtering** (User experience)
6. **Push Notifications** (Real-time updates)
7. **Appointments & Earnings** (Dashboard features)

### **🎯 Priority Order for Implementation:**

1. **HIGH PRIORITY:**
   - Job CRUD operations
   - Counter offer system
   - Nearby jobs discovery
   - Push notifications

2. **MEDIUM PRIORITY:**
   - Time tracking system
   - Extra time requests (NEW feature)
   - Job history & filtering
   - Appointments

3. **LOW PRIORITY:**
   - Helper preferences
   - Earnings tracking
   - Debug endpoints

### **📱 Flutter Integration Notes:**

1. **Authentication:** All endpoints require JWT tokens
2. **File Upload:** Use multipart/form-data for job photos
3. **Real-time:** Implement push notifications for job updates
4. **Location:** Use latitude/longitude for nearby jobs
5. **Pagination:** All list endpoints support pagination
6. **Error Handling:** Implement proper error handling for all responses

**The API system is production-ready and comprehensive for a full-featured job marketplace app!** 🚀
