# Stripe Tokens Direct API - Testing Guide

## Overview
Your implementation now uses the Stripe Tokens API directly (`/v1/tokens`) as specified in the Stripe documentation. This creates single-use tokens that represent credit card details.

## Implementation Details ✅

### **API Version**: `2025-09-30.preview`
### **Endpoint**: `POST /v1/tokens`
### **Method**: `StripePayment.createTokenFromCard()`

## Test the Token Creation

### 1. Test Token Creation Endpoint

```http
POST /api/payment/cards/test-token
Content-Type: application/json

{
  "card_number": "4242424242424242",
  "exp_month": 5,
  "exp_year": 2026,
  "cvc": "314"
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Stripe token created successfully",
  "token": {
    "id": "tok_1N3T00LkdIwHu7ixt44h1F8k",
    "type": "card",
    "used": false,
    "card": {
      "brand": "Visa",
      "last4": "4242",
      "exp_month": 5,
      "exp_year": 2026
    }
  }
}
```

### 2. Add Card with Token Flow

```http
POST /api/payment/cards
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "cardholder_name": "John Doe",
  "card_number": "4242424242424242",
  "expiration_date": "05/26",
  "cvc": "314",
  "is_default": false
}
```

**What happens internally:**
1. Your API receives raw card data
2. Creates Stripe token using `/v1/tokens`
3. Creates payment method from token
4. Stores payment method ID in database
5. Returns card information

## Test with Different Card Types

### Visa Card
```json
{
  "card_number": "4242424242424242",
  "exp_month": 5,
  "exp_year": 2026,
  "cvc": "314"
}
```

### Mastercard
```json
{
  "card_number": "5555555555554444",
  "exp_month": 12,
  "exp_year": 2025,
  "cvc": "123"
}
```

### American Express
```json
{
  "card_number": "378282246310005",
  "exp_month": 8,
  "exp_year": 2027,
  "cvc": "1234"
}
```

## Error Testing

### Declined Card
```json
{
  "card_number": "4000000000000002",
  "exp_month": 5,
  "exp_year": 2026,
  "cvc": "314"
}
```
**Expected**: Card declined error

### Expired Card
```json
{
  "card_number": "4000000000000069",
  "exp_month": 1,
  "exp_year": 2020,
  "cvc": "314"
}
```
**Expected**: Card expired error

### Invalid CVC
```json
{
  "card_number": "4000000000000127",
  "exp_month": 5,
  "exp_year": 2026,
  "cvc": "999"
}
```
**Expected**: Invalid CVC error

## Direct Stripe API Test (cURL)

You can also test the Stripe API directly:

```bash
curl https://api.stripe.com/v1/tokens \
  -u "sk_test_YOUR_SECRET_KEY:" \
  -H "Stripe-Version: 2025-09-30.preview" \
  -d "card[number]"=4242424242424242 \
  -d "card[exp_month]"=5 \
  -d "card[exp_year]"=2026 \
  -d "card[cvc]"=314
```

**Expected Response:**
```json
{
  "id": "tok_1N3T00LkdIwHu7ixt44h1F8k",
  "object": "token",
  "card": {
    "id": "card_1N3T00LkdIwHu7ixRdxpVI1Q",
    "object": "card",
    "brand": "Visa",
    "country": "US",
    "cvc_check": "unchecked",
    "exp_month": 5,
    "exp_year": 2026,
    "fingerprint": "mToisGZ01V71BCos",
    "funding": "credit",
    "last4": "4242",
    "metadata": {},
    "name": null,
    "tokenization_method": null,
    "wallet": null
  },
  "client_ip": "YOUR_IP",
  "created": 1683071568,
  "livemode": false,
  "type": "card",
  "used": false
}
```

## Important Notes

### **Single-Use Tokens**
- Each token can only be used **once**
- After creating a payment method, the token becomes `"used": true`
- You cannot reuse the same token

### **API Version**
- Using `2025-09-30.preview` as specified in documentation
- This version supports the raw card data APIs

### **Security**
- Card data is sent to Stripe and tokenized
- No raw card data is stored in your database
- Only payment method IDs are stored

## Testing Checklist

- [ ] Test token creation with valid Visa card
- [ ] Test token creation with valid Mastercard
- [ ] Test token creation with valid American Express
- [ ] Test with declined card (should fail)
- [ ] Test with expired card (should fail)
- [ ] Test with invalid CVC (should fail)
- [ ] Test full card addition flow
- [ ] Verify payment method ID is stored
- [ ] Verify no raw card data is stored

## Environment Setup

Make sure your `.env` file has:
```env
STRIPE_SECRET_KEY=sk_test_your_secret_key_here
```

## Your Implementation is Ready! 🎉

Your code now correctly implements the Stripe Tokens API as specified in the documentation:

1. ✅ **API Version**: Updated to `2025-09-30.preview`
2. ✅ **Token Creation**: Uses `Stripe.tokens.create()` with card object
3. ✅ **Single-Use**: Tokens are used once and marked as used
4. ✅ **Security**: No raw card data storage
5. ✅ **Testing**: Test endpoint available at `/api/payment/cards/test-token`

Test it out with the examples above!
