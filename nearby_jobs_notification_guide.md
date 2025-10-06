# Nearby Jobs Notification System - Complete Guide

## 🎯 **Overview**

This system automatically notifies helpers about nearby jobs based on their location and preferences. When a user posts a job with latitude/longitude coordinates, the system automatically finds eligible helpers within their preferred distance and sends them notifications.

## 🏗️ **How It Works**

### **1. Job Posting Flow**
```
User posts job with lat/lng → 
Job saved to database → 
JobNotificationService.notifyHelpersAboutNewJob() called → 
NearbyJobsService finds eligible helpers → 
Notifications sent to helpers
```

### **2. Helper Discovery Flow**
```
Helper opens app → 
Helper can view nearby jobs → 
System filters by distance, price, categories → 
Results sorted by distance
```

## 📱 **API Endpoints**

### **1. Get Nearby Jobs for Helper**
```http
GET /nearby-jobs?page=1&limit=10&maxDistanceKm=25&sortBy=distance
Authorization: Bearer <token>
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)
- `maxDistanceKm` (optional): Maximum distance in kilometers
- `minPrice` (optional): Minimum job price filter
- `maxPrice` (optional): Maximum job price filter
- `categories` (optional): Comma-separated job categories
- `sortBy` (optional): Sort by `distance`, `price`, or `date`

**Response:**
```json
{
  "success": true,
  "data": {
    "jobs": [
      {
        "jobId": "job123",
        "jobTitle": "Website Design Help",
        "jobPrice": 500,
        "jobLocation": "New York, NY, USA",
        "jobCategory": "Technology",
        "jobType": "urgent",
        "distance": 2.5,
        "latitude": 40.7200,
        "longitude": -74.0100,
        "created_at": "2024-01-15T10:30:00.000Z",
        "date_and_time": "2024-01-20T10:00:00.000Z",
        "user": {
          "id": "user123",
          "name": "John Doe",
          "avatar": "avatar_url"
        }
      }
    ],
    "total": 1,
    "totalPages": 1,
    "currentPage": 1
  },
  "message": "Found 1 nearby jobs"
}
```

### **2. Get Helper Notification Preferences**
```http
GET /nearby-jobs/preferences
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "maxDistanceKm": 25,
    "minJobPrice": 100,
    "maxJobPrice": 1000,
    "preferredCategories": ["Technology", "Photography", "Design"],
    "isActive": true,
    "notificationTypes": ["new_job"]
  },
  "message": "Notification preferences retrieved successfully"
}
```

### **3. Update Helper Notification Preferences**
```http
PUT /nearby-jobs/preferences
Authorization: Bearer <token>
Content-Type: application/json

{
  "maxDistanceKm": 30,
  "minJobPrice": 150,
  "maxJobPrice": 1500,
  "preferredCategories": ["Technology", "Photography", "Design", "Writing"],
  "isActive": true,
  "notificationTypes": ["new_job"]
}
```

### **4. Get Nearby Jobs Count**
```http
GET /nearby-jobs/count?maxDistanceKm=25
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "count": 5,
    "maxDistance": 25
  },
  "message": "Found 5 nearby jobs"
}
```

### **5. Test Notification**
```http
POST /nearby-jobs/test-notification
Authorization: Bearer <token>
```

### **6. Get Nearby Jobs by Specific Location**
```http
GET /nearby-jobs/by-location?lat=40.7128&lng=-74.0060&maxDistanceKm=25&limit=10
Authorization: Bearer <token>
```

## 🧪 **Testing Scenarios**

### **Scenario 1: Helper Setup**
1. **Create a helper user** with location data:
   ```sql
   UPDATE users SET 
     type = 'helper',
     latitude = 40.7128,
     longitude = -74.0060,
     max_distance_km = 25,
     min_job_price = 100,
     max_job_price = 1000,
     preferred_categories = ['Technology', 'Photography'],
     device_tokens = ['test_device_token']
   WHERE id = 'helper_user_id';
   ```

2. **Test getting nearby jobs**:
   ```http
   GET /nearby-jobs
   ```

### **Scenario 2: Job Posting Triggers Notifications**
1. **Post a job with location**:
   ```http
   POST /jobs
   Content-Type: application/json
   
   {
     "title": "Need help with website design",
     "description": "Looking for a web designer",
     "category": "Technology",
     "jobType": "urgent",
     "price": 500,
     "location": "New York, NY, USA",
     "latitude": 40.7200,
     "longitude": -74.0100
   }
   ```

2. **Check if helper received notification** (check Firebase console or device)

### **Scenario 3: Helper Preferences**
1. **Update helper preferences**:
   ```http
   PUT /nearby-jobs/preferences
   Content-Type: application/json
   
   {
     "maxDistanceKm": 15,
     "minJobPrice": 200,
     "preferredCategories": ["Technology"]
   }
   ```

2. **Post jobs with different criteria** and verify filtering

## 🔧 **Database Schema Requirements**

### **User Model Fields (Already Exists)**
```sql
-- Location coordinates
latitude FLOAT,
longitude FLOAT,

-- Helper notification preferences
max_distance_km INT DEFAULT 20,
min_job_price DECIMAL,
max_job_price DECIMAL,
preferred_categories TEXT[],

-- Firebase push notification tokens
device_tokens TEXT[]
```

### **Job Model Fields (Already Exists)**
```sql
-- Job location coordinates
latitude FLOAT,
longitude FLOAT,
location TEXT
```

## 📱 **Frontend Integration**

### **React/JavaScript Example**

```javascript
// Get nearby jobs for helper
async function getNearbyJobs(filters = {}) {
  try {
    const params = new URLSearchParams();
    if (filters.maxDistance) params.append('maxDistanceKm', filters.maxDistance);
    if (filters.minPrice) params.append('minPrice', filters.minPrice);
    if (filters.maxPrice) params.append('maxPrice', filters.maxPrice);
    if (filters.categories) params.append('categories', filters.categories.join(','));
    if (filters.sortBy) params.append('sortBy', filters.sortBy);
    
    const response = await fetch(`/nearby-jobs?${params}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (data.success) {
      return data.data.jobs;
    }
  } catch (error) {
    console.error('Error getting nearby jobs:', error);
  }
}

// Update helper preferences
async function updatePreferences(preferences) {
  try {
    const response = await fetch('/nearby-jobs/preferences', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(preferences)
    });
    
    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error('Error updating preferences:', error);
  }
}

// Get notification count for badge
async function getNotificationCount() {
  try {
    const response = await fetch('/nearby-jobs/count', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    return data.success ? data.data.count : 0;
  } catch (error) {
    console.error('Error getting notification count:', error);
    return 0;
  }
}
```

### **React Native Example**

```javascript
import AsyncStorage from '@react-native-async-storage/async-storage';

// Get nearby jobs
const getNearbyJobs = async (filters = {}) => {
  try {
    const token = await AsyncStorage.getItem('auth_token');
    
    const params = new URLSearchParams();
    Object.keys(filters).forEach(key => {
      if (filters[key] !== undefined) {
        params.append(key, filters[key]);
      }
    });
    
    const response = await fetch(`${API_BASE_URL}/nearby-jobs?${params}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (data.success) {
      return data.data.jobs;
    }
  } catch (error) {
    console.error('Error getting nearby jobs:', error);
  }
};

// Update preferences
const updatePreferences = async (preferences) => {
  try {
    const token = await AsyncStorage.getItem('auth_token');
    
    const response = await fetch(`${API_BASE_URL}/nearby-jobs/preferences`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(preferences)
    });
    
    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error('Error updating preferences:', error);
  }
};
```

## 🔔 **Notification Flow**

### **When Job is Posted:**
1. Job is saved with latitude/longitude
2. `JobNotificationService.notifyHelpersAboutNewJob()` is called
3. `NearbyJobsService.notifyHelpersAboutNewJob()` finds eligible helpers
4. For each eligible helper:
   - In-app notification is created
   - Firebase push notification is sent

### **Helper Eligibility Criteria:**
- User type is 'helper'
- Has location data (latitude/longitude)
- Has device tokens for push notifications
- Within maximum distance preference
- Job price within min/max range
- Job category matches preferred categories

## 🎯 **Key Features**

✅ **Automatic Notifications**: Helpers get notified when jobs are posted nearby
✅ **Smart Filtering**: Based on distance, price, and category preferences
✅ **Real-time Updates**: Uses Firebase for instant push notifications
✅ **Flexible Preferences**: Helpers can customize their notification settings
✅ **Distance Calculation**: Accurate distance calculation between coordinates
✅ **Pagination Support**: Efficient handling of large job lists
✅ **Multiple Sort Options**: Sort by distance, price, or date

## 🚀 **Benefits**

1. **For Helpers**: 
   - Get notified about relevant nearby jobs
   - Customize notification preferences
   - Find work opportunities easily

2. **For Job Posters**:
   - Jobs automatically reach nearby helpers
   - Faster job completion
   - Better helper matching

3. **For the Platform**:
   - Increased engagement
   - Better job-helper matching
   - Higher success rates

## 🔧 **Configuration**

### **Default Settings**
- Default maximum distance: 20km
- Default notification types: ['new_job']
- Default sort order: by distance

### **Customization Options**
- Maximum distance per helper
- Price range preferences
- Category preferences
- Notification frequency settings

The system is now ready to automatically notify helpers about nearby jobs based on their location and preferences!
