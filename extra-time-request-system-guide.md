# 🕐 Extra Time Request System - Complete Implementation Guide

## 🎯 **System Overview**

The Extra Time Request System allows helpers to request additional time for ongoing hourly jobs, with client approval required before the timeline extends.

## 🔄 **Complete Flow**

```
1. Helper starts job (status: "ongoing")
2. Helper realizes more time needed
3. Helper requests extra time (1/2/3 hours)
4. Client gets notification to approve
5. If approved: Timeline extends, job continues
6. If rejected: Job continues with original timeline
7. When finished: Final calculation based on actual time worked
```

## 📊 **Database Schema Changes**

### New Fields Added to Job Model:
```prisma
// Extra time request system
extra_time_requested    Decimal?  // Extra time requested by helper (in hours)
extra_time_approved     Boolean?  // Whether client approved the extra time
extra_time_requested_at DateTime? // When extra time was requested
extra_time_approved_at  DateTime? // When extra time was approved/rejected
total_approved_hours    Decimal?  // Original estimated + approved extra time
```

## 🚀 **API Endpoints**

### 1. **Helper Requests Extra Time**
```http
POST /api/jobs/{jobId}/request-extra-time
Authorization: Bearer {helper_jwt_token}
Content-Type: application/json

{
  "extra_hours": 2,
  "reason": "The furniture is heavier than expected and requires additional time for safe moving"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Extra time request submitted successfully",
  "job_id": "cmghi61b1000bih4c9msj3qlq",
  "extra_hours_requested": 2,
  "estimated_extra_cost": 40,
  "reason": "The furniture is heavier than expected...",
  "status": "pending_approval"
}
```

### 2. **Client Approves/Rejects Extra Time**
```http
PUT /api/jobs/{jobId}/approve-extra-time
Authorization: Bearer {client_jwt_token}
Content-Type: application/json

{
  "approved": true,
  "message": "Approved. Please take your time to do the job properly."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Extra time request approved",
  "job_id": "cmghi61b1000bih4c9msj3qlq",
  "approved": true,
  "extra_hours": 2,
  "total_approved_hours": 4,
  "message_to_helper": "Approved. Please take your time..."
}
```

### 3. **Get Extra Time Status**
```http
GET /api/jobs/{jobId}/extra-time-status
Authorization: Bearer {jwt_token}
```

**Response:**
```json
{
  "job_id": "cmghi61b1000bih4c9msj3qlq",
  "title": "Help Move Couch and Dining Table",
  "job_status": "ongoing",
  "payment_type": "HOURLY",
  "estimated_hours": 2,
  "hourly_rate": 20,
  "original_price": 40,
  "extra_time_requested": 2,
  "extra_time_approved": true,
  "total_approved_hours": 4,
  "extra_time_requested_at": "2025-01-08T10:30:00.000Z",
  "extra_time_approved_at": "2025-01-08T10:35:00.000Z",
  "estimated_extra_cost": 40,
  "can_request_extra_time": false,
  "can_approve_extra_time": false
}
```

## 💰 **Pricing Logic**

### **Final Price Calculation:**
1. **Within Approved Time**: Charge for actual hours worked
2. **Overage Beyond Approved**: Charge for approved hours + overage at hourly rate
3. **No Extra Time Approved**: Use existing automatic overage billing

### **Example Scenarios:**

**Scenario 1: Approved Extra Time**
- Original: 2 hours @ $20/hour = $40
- Extra Time Approved: +2 hours = 4 total approved hours
- Actual Work: 3.5 hours
- **Final Charge**: 3.5 × $20 = $70

**Scenario 2: Overage Beyond Approved**
- Original: 2 hours @ $20/hour = $40
- Extra Time Approved: +2 hours = 4 total approved hours
- Actual Work: 5 hours
- **Final Charge**: 4 × $20 + 1 × $20 = $100

**Scenario 3: Rejected Extra Time**
- Original: 2 hours @ $20/hour = $40
- Extra Time Requested: +2 hours (REJECTED)
- Actual Work: 3 hours
- **Final Charge**: 3 × $20 = $60 (automatic overage billing)

## 🧪 **Testing Guide**

### **Prerequisites:**
1. Create an hourly job
2. Have a helper apply and get accepted
3. Start the job (status: "ongoing")

### **Test Flow:**

#### **Step 1: Helper Requests Extra Time**
```bash
curl -X POST "http://localhost:3000/api/jobs/{jobId}/request-extra-time" \
  -H "Authorization: Bearer {helper_jwt}" \
  -H "Content-Type: application/json" \
  -d '{
    "extra_hours": 2,
    "reason": "Additional time needed for proper completion"
  }'
```

#### **Step 2: Client Approves Extra Time**
```bash
curl -X PUT "http://localhost:3000/api/jobs/{jobId}/approve-extra-time" \
  -H "Authorization: Bearer {client_jwt}" \
  -H "Content-Type: application/json" \
  -d '{
    "approved": true,
    "message": "Approved. Take your time."
  }'
```

#### **Step 3: Check Status**
```bash
curl -X GET "http://localhost:3000/api/jobs/{jobId}/extra-time-status" \
  -H "Authorization: Bearer {jwt_token}"
```

#### **Step 4: Complete Job**
```bash
curl -X PATCH "http://localhost:3000/api/jobs/{jobId}/complete" \
  -H "Authorization: Bearer {helper_jwt}"
```

## 🔒 **Security & Validation**

### **Helper Request Validation:**
- ✅ Only assigned helpers can request
- ✅ Job must be in "ongoing" status
- ✅ Job must be hourly payment type
- ✅ No pending request already exists
- ✅ Extra hours: 0.5 to 8 hours

### **Client Approval Validation:**
- ✅ Only job owner can approve
- ✅ Job must be in "ongoing" status
- ✅ Pending request must exist
- ✅ Cannot approve twice

### **Status View Validation:**
- ✅ Only job participants (owner/helper) can view
- ✅ Returns appropriate permissions for each user type

## 🎯 **Key Features**

1. **Helper-Initiated**: Only helpers can request extra time
2. **Client Approval**: All requests require client approval
3. **Flexible Pricing**: Handles approved time + overage billing
4. **Status Tracking**: Complete audit trail of requests/approvals
5. **Permission-Based**: Role-based access control
6. **Integration**: Works with existing time tracking system

## 🚀 **Ready for Testing!**

The system is now fully implemented and ready for testing. Use the provided endpoints to test the complete flow from helper request to job completion with extended timeline support.
