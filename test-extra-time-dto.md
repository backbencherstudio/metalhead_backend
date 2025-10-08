# 🧪 Extra Time DTO Test Guide

## 🔧 **Fixed DTO Issues:**

I've updated the `RequestExtraTimeDto` with:
1. **Added `@Type(() => Number)`** for proper number transformation
2. **Added `@IsString()`** for reason validation
3. **Added custom error messages** for better debugging

## ✅ **Test the Fixed DTO:**

### **Request Format:**
```json
{
  "extra_hours": 2,
  "reason": "The furniture is heavier than expected and requires additional time for safe moving"
}
```

### **Endpoint:**
```http
POST /api/jobs/{jobId}/request-extra-time
Authorization: Bearer {helper_jwt_token}
Content-Type: application/json
```

## 🔍 **Debug Steps:**

1. **Restart the application** (already done)
2. **Test with the exact JSON above**
3. **Check if validation errors are resolved**

## 🚨 **If Still Getting Errors:**

The issue might be:
1. **Job doesn't exist** - Check if `{jobId}` is valid
2. **Helper not assigned** - Make sure the helper is assigned to the job
3. **Job not in "ongoing" status** - Job must be started first
4. **Wrong payment type** - Job must be "HOURLY"

## 📋 **Complete Test Flow:**

1. **Create an hourly job**
2. **Have helper apply and get accepted**
3. **Start the job** (status: "ongoing")
4. **Request extra time** with the JSON above

Try the request again with the restarted application! 🚀
