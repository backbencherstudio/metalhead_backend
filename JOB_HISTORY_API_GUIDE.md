# 🚀 Job History & Filtering API Guide

This guide provides comprehensive documentation for the job history and filtering system, including all available endpoints, request/response formats, and frontend implementation examples.

## 📋 **Table of Contents**

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [API Endpoints](#api-endpoints)
4. [Request/Response Formats](#requestresponse-formats)
5. [Frontend Implementation Examples](#frontend-implementation-examples)
6. [Error Handling](#error-handling)
7. [Testing in Postman](#testing-in-postman)

## 🎯 **Overview**

The Job History & Filtering system provides comprehensive endpoints for:
- **User Job History**: Track jobs posted by users
- **Helper Job History**: Track jobs accepted by helpers
- **Advanced Filtering**: Multiple filtering options for job discovery
- **Location-based Search**: Find jobs near user location
- **Sorting Options**: Various sorting criteria

## 🔐 **Authentication**

All endpoints require JWT authentication. Include the Bearer token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

## 🛠 **API Endpoints**

### **1. User Job History**
Get jobs posted by the authenticated user.

**Endpoint:** `GET /api/job-history/user`

**Query Parameters:**
- `status` (optional): Comma-separated job statuses
- `jobType` (optional): Comma-separated job types
- `minPrice` (optional): Minimum price filter
- `maxPrice` (optional): Maximum price filter
- `sortBy` (optional): Sort criteria
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)

**Example Request:**
```
GET /api/job-history/user?status=posted,confirmed&jobType=Technology,Photography&minPrice=100&maxPrice=1000&sortBy=date_newest&page=1&limit=10
```

### **2. Helper Job History**
Get jobs accepted by the authenticated helper.

**Endpoint:** `GET /api/job-history/helper`

**Query Parameters:** Same as user job history

**Example Request:**
```
GET /api/job-history/helper?status=confirmed,ongoing,completed&sortBy=price_high_low&page=1&limit=10
```

### **3. Nearest Jobs**
Get jobs sorted by distance from user location.

**Endpoint:** `GET /api/job-history/nearest`

**Required Parameters:**
- `lat`: User latitude
- `lng`: User longitude

**Optional Parameters:**
- `maxDistanceKm`: Maximum distance in kilometers (default: 50)
- All other filtering parameters

**Example Request:**
```
GET /api/job-history/nearest?lat=40.7128&lng=-74.0060&maxDistanceKm=25&status=posted,confirmed&minPrice=50&maxPrice=500
```

### **4. Best Rated Jobs**
Get jobs sorted by user ratings.

**Endpoint:** `GET /api/job-history/best-rated`

**Query Parameters:** Standard filtering parameters

**Example Request:**
```
GET /api/job-history/best-rated?jobType=Technology,Design&minPrice=200&sortBy=rating&page=1&limit=20
```

### **5. Price Range Filtering**
Get jobs within a specific price range.

**Endpoint:** `GET /api/job-history/price-range`

**Required Parameters:**
- At least one of: `minPrice` or `maxPrice`

**Example Request:**
```
GET /api/job-history/price-range?minPrice=100&maxPrice=500&sortBy=price_low_high&status=posted,confirmed
```

### **6. Status-based Filtering**
Get jobs filtered by status.

**Endpoint:** `GET /api/job-history/status`

**Required Parameters:**
- `status`: Comma-separated status values

**Example Request:**
```
GET /api/job-history/status?status=posted,counter_offer,confirmed&jobType=Technology&sortBy=date_newest
```

### **7. Type-based Filtering**
Get jobs filtered by category/type.

**Endpoint:** `GET /api/job-history/type`

**Required Parameters:**
- `jobType`: Comma-separated job types

**Example Request:**
```
GET /api/job-history/type?jobType=Technology,Photography,Design&status=posted,confirmed&minPrice=100
```

### **8. Comprehensive Search**
Advanced search with multiple filters.

**Endpoint:** `GET /api/job-history/search`

**Query Parameters:** All available filtering parameters

**Example Request:**
```
GET /api/job-history/search?lat=40.7128&lng=-74.0060&maxDistanceKm=30&status=posted,confirmed&jobType=Technology&minPrice=100&maxPrice=1000&sortBy=nearest&page=1&limit=15
```

## 📊 **Request/Response Formats**

### **Query Parameters**

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `status` | string | Comma-separated statuses | `posted,confirmed,completed` |
| `jobType` | string | Comma-separated job types | `Technology,Photography,Design` |
| `minPrice` | number | Minimum price filter | `100` |
| `maxPrice` | number | Maximum price filter | `1000` |
| `sortBy` | string | Sort criteria | `date_newest`, `price_low_high`, `nearest` |
| `lat` | number | User latitude | `40.7128` |
| `lng` | number | User longitude | `-74.0060` |
| `maxDistanceKm` | number | Max distance in km | `50` |
| `page` | number | Page number | `1` |
| `limit` | number | Items per page | `10` |

### **Sort Options**

| Value | Description |
|-------|-------------|
| `date_newest` | Sort by creation date (newest first) |
| `date_oldest` | Sort by creation date (oldest first) |
| `price_low_high` | Sort by price (low to high) |
| `price_high_low` | Sort by price (high to low) |
| `nearest` | Sort by distance (nearest first) |
| `rating` | Sort by user rating (highest first) |

### **Job Statuses**

| Status | Description |
|--------|-------------|
| `posted` | Job posted by user |
| `counter_offer` | Counter offer received |
| `confirmed` | Job confirmed |
| `ongoing` | Job in progress |
| `completed` | Job completed |
| `paid` | Job paid |

### **Job Types**

| Type | Description |
|------|-------------|
| `Technology` | Tech-related jobs |
| `Photography` | Photography jobs |
| `Design` | Design jobs |
| `Writing` | Writing jobs |
| `Marketing` | Marketing jobs |
| `Consulting` | Consulting jobs |
| `Other` | Other job types |

### **Response Format**

```json
{
  "success": true,
  "message": "Jobs retrieved successfully",
  "data": {
    "jobs": [
      {
        "id": "cmg1r7kyp0003ihzs5vd30pkc",
        "title": "Website Development",
        "description": "Need a modern website",
        "category": "Technology",
        "price": 500,
        "status": "posted",
        "location": "New York, NY",
        "latitude": 40.7128,
        "longitude": -74.0060,
        "distance": 2.5,
        "created_at": "2025-01-28T10:30:00Z",
        "updated_at": "2025-01-28T10:30:00Z",
        "user": {
          "id": "cmfz1zcd60004ihssyrt3n81u",
          "name": "John Doe",
          "username": "johndoe",
          "avatar": "https://example.com/avatar.jpg",
          "rating": 4.8
        },
        "accepted_offers": [],
        "_count": {
          "counter_offers": 3,
          "accepted_offers": 0
        }
      }
    ],
    "total": 25,
    "page": 1,
    "limit": 10,
    "totalPages": 3
  }
}
```

## 💻 **Frontend Implementation Examples**

### **1. React Hook for Job History**

```jsx
import { useState, useEffect } from 'react';

const useJobHistory = () => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0
  });

  const fetchJobs = async (endpoint, filters = {}) => {
    setLoading(true);
    setError(null);

    try {
      const queryParams = new URLSearchParams();
      
      // Add filters to query params
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          if (Array.isArray(value)) {
            queryParams.append(key, value.join(','));
          } else {
            queryParams.append(key, value.toString());
          }
        }
      });

      const response = await fetch(
        `${process.env.REACT_APP_API_URL}${endpoint}?${queryParams}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const data = await response.json();

      if (data.success) {
        setJobs(data.data.jobs);
        setPagination({
          page: data.data.page,
          limit: data.data.limit,
          total: data.data.total,
          totalPages: data.data.totalPages
        });
      } else {
        throw new Error(data.message);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return {
    jobs,
    loading,
    error,
    pagination,
    fetchJobs
  };
};

export default useJobHistory;
```

### **2. Job History Component**

```jsx
import React, { useState, useEffect } from 'react';
import useJobHistory from './hooks/useJobHistory';

const JobHistory = ({ userType = 'user' }) => {
  const { jobs, loading, error, pagination, fetchJobs } = useJobHistory();
  const [filters, setFilters] = useState({
    status: [],
    jobType: [],
    minPrice: '',
    maxPrice: '',
    sortBy: 'date_newest',
    page: 1,
    limit: 10
  });

  useEffect(() => {
    const endpoint = userType === 'user' ? '/api/job-history/user' : '/api/job-history/helper';
    fetchJobs(endpoint, filters);
  }, [filters, userType]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      page: 1 // Reset to first page when filters change
    }));
  };

  const handlePageChange = (newPage) => {
    setFilters(prev => ({
      ...prev,
      page: newPage
    }));
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="job-history">
      <div className="filters">
        <select 
          value={filters.status.join(',')} 
          onChange={(e) => handleFilterChange('status', e.target.value.split(',').filter(s => s))}
        >
          <option value="">All Statuses</option>
          <option value="posted">Posted</option>
          <option value="confirmed">Confirmed</option>
          <option value="ongoing">Ongoing</option>
          <option value="completed">Completed</option>
        </select>

        <select 
          value={filters.jobType.join(',')} 
          onChange={(e) => handleFilterChange('jobType', e.target.value.split(',').filter(t => t))}
        >
          <option value="">All Types</option>
          <option value="Technology">Technology</option>
          <option value="Photography">Photography</option>
          <option value="Design">Design</option>
        </select>

        <input 
          type="number" 
          placeholder="Min Price" 
          value={filters.minPrice}
          onChange={(e) => handleFilterChange('minPrice', e.target.value)}
        />

        <input 
          type="number" 
          placeholder="Max Price" 
          value={filters.maxPrice}
          onChange={(e) => handleFilterChange('maxPrice', e.target.value)}
        />

        <select 
          value={filters.sortBy} 
          onChange={(e) => handleFilterChange('sortBy', e.target.value)}
        >
          <option value="date_newest">Newest First</option>
          <option value="date_oldest">Oldest First</option>
          <option value="price_low_high">Price: Low to High</option>
          <option value="price_high_low">Price: High to Low</option>
        </select>
      </div>

      <div className="jobs-list">
        {jobs.map(job => (
          <div key={job.id} className="job-card">
            <h3>{job.title}</h3>
            <p>{job.description}</p>
            <div className="job-meta">
              <span className="category">{job.category}</span>
              <span className="price">${job.price}</span>
              <span className="status">{job.status}</span>
              {job.distance && <span className="distance">{job.distance.toFixed(1)} km</span>}
            </div>
            <div className="job-user">
              <img src={job.user.avatar} alt={job.user.name} />
              <span>{job.user.name}</span>
              <span className="rating">⭐ {job.user.rating}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="pagination">
        <button 
          disabled={pagination.page === 1}
          onClick={() => handlePageChange(pagination.page - 1)}
        >
          Previous
        </button>
        <span>Page {pagination.page} of {pagination.totalPages}</span>
        <button 
          disabled={pagination.page === pagination.totalPages}
          onClick={() => handlePageChange(pagination.page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default JobHistory;
```

### **3. Location-based Job Search**

```jsx
import React, { useState, useEffect } from 'react';
import useJobHistory from './hooks/useJobHistory';

const LocationJobSearch = () => {
  const { jobs, loading, error, fetchJobs } = useJobHistory();
  const [userLocation, setUserLocation] = useState(null);
  const [filters, setFilters] = useState({
    maxDistanceKm: 25,
    status: ['posted', 'confirmed'],
    minPrice: '',
    maxPrice: '',
    sortBy: 'nearest'
  });

  useEffect(() => {
    // Get user's current location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.error('Error getting location:', error);
        }
      );
    }
  }, []);

  useEffect(() => {
    if (userLocation) {
      fetchJobs('/api/job-history/nearest', {
        ...filters,
        lat: userLocation.lat,
        lng: userLocation.lng
      });
    }
  }, [userLocation, filters]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  if (!userLocation) {
    return <div>Getting your location...</div>;
  }

  return (
    <div className="location-job-search">
      <div className="location-info">
        <p>📍 Searching jobs near your location</p>
        <p>Lat: {userLocation.lat.toFixed(4)}, Lng: {userLocation.lng.toFixed(4)}</p>
      </div>

      <div className="filters">
        <label>
          Max Distance (km):
          <input 
            type="range" 
            min="1" 
            max="100" 
            value={filters.maxDistanceKm}
            onChange={(e) => handleFilterChange('maxDistanceKm', parseInt(e.target.value))}
          />
          <span>{filters.maxDistanceKm} km</span>
        </label>

        <input 
          type="number" 
          placeholder="Min Price" 
          value={filters.minPrice}
          onChange={(e) => handleFilterChange('minPrice', e.target.value)}
        />

        <input 
          type="number" 
          placeholder="Max Price" 
          value={filters.maxPrice}
          onChange={(e) => handleFilterChange('maxPrice', e.target.value)}
        />
      </div>

      {loading && <div>Loading nearby jobs...</div>}
      {error && <div>Error: {error}</div>}

      <div className="jobs-list">
        {jobs.map(job => (
          <div key={job.id} className="job-card">
            <h3>{job.title}</h3>
            <p>{job.description}</p>
            <div className="job-meta">
              <span className="distance">📍 {job.distance?.toFixed(1)} km away</span>
              <span className="price">${job.price}</span>
              <span className="status">{job.status}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LocationJobSearch;
```

## ❌ **Error Handling**

### **Common Error Responses**

```json
{
  "success": false,
  "message": "User ID is required"
}
```

```json
{
  "success": false,
  "message": "User location coordinates are required for nearest jobs"
}
```

```json
{
  "success": false,
  "message": "At least one status is required"
}
```

### **Error Handling in Frontend**

```jsx
const handleApiError = (error) => {
  switch (error.message) {
    case 'User ID is required':
      // Redirect to login
      break;
    case 'User location coordinates are required for nearest jobs':
      // Show location permission request
      break;
    default:
      // Show generic error message
      break;
  }
};
```

## 🧪 **Testing in Postman**

### **1. User Job History**

**Request:**
```
GET {{base_url}}/api/job-history/user?status=posted,confirmed&jobType=Technology&minPrice=100&maxPrice=1000&sortBy=date_newest&page=1&limit=10
```

**Headers:**
```
Authorization: Bearer {{jwt_token}}
Content-Type: application/json
```

### **2. Nearest Jobs**

**Request:**
```
GET {{base_url}}/api/job-history/nearest?lat=40.7128&lng=-74.0060&maxDistanceKm=25&status=posted,confirmed&minPrice=50&maxPrice=500
```

**Headers:**
```
Authorization: Bearer {{jwt_token}}
Content-Type: application/json
```

### **3. Price Range Filtering**

**Request:**
```
GET {{base_url}}/api/job-history/price-range?minPrice=100&maxPrice=500&sortBy=price_low_high&status=posted,confirmed
```

**Headers:**
```
Authorization: Bearer {{jwt_token}}
Content-Type: application/json
```

### **4. Comprehensive Search**

**Request:**
```
GET {{base_url}}/api/job-history/search?lat=40.7128&lng=-74.0060&maxDistanceKm=30&status=posted,confirmed&jobType=Technology&minPrice=100&maxPrice=1000&sortBy=nearest&page=1&limit=15
```

**Headers:**
```
Authorization: Bearer {{jwt_token}}
Content-Type: application/json
```

## 🎯 **Best Practices**

1. **Pagination**: Always implement pagination for large datasets
2. **Loading States**: Show loading indicators during API calls
3. **Error Handling**: Implement comprehensive error handling
4. **Location Permissions**: Request location permissions gracefully
5. **Filter Persistence**: Save filter preferences in localStorage
6. **Debouncing**: Debounce filter inputs to avoid excessive API calls
7. **Caching**: Implement client-side caching for better performance

## 📱 **Mobile Considerations**

1. **Location Services**: Handle location permission requests
2. **Touch Interactions**: Optimize for touch-based filtering
3. **Performance**: Limit initial data load for mobile devices
4. **Offline Support**: Consider offline job history viewing

This comprehensive API system provides all the functionality needed for a robust job history and filtering system in your application! 🚀




