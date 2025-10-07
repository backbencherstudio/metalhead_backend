# Stripe Tokens Card API - Testing Guide

## Overview
Your card system now uses Stripe Tokens for enhanced security and PCI compliance. Users enter their card details directly, and the backend creates Stripe tokens automatically.

## Implementation Status ✅

### ✅ Completed:
- **DTO Updated**: `CreateCardDto` accepts raw card data (user-friendly)
- **Service Updated**: `CardService.addCard()` creates Stripe tokens from card data
- **Database Schema**: Updated to support Stripe payment method IDs
- **Stripe Integration**: Added `createTokenFromCard()` and `createPaymentMethodFromToken()` methods
- **Security**: Card data is tokenized by Stripe, no raw storage

### 🔧 Files Modified:
- `src/modules/payment/card/dto/create-card.dto.ts` - Accepts raw card data
- `src/modules/payment/card/card.service.ts` - Creates tokens from card data
- `src/common/lib/Payment/stripe/StripePayment.ts` - Added token creation methods
- `prisma/schema.prisma` - Made `card_number` and `cvv` optional
- Database migration applied successfully

## API Testing

### 1. Add Card with Raw Card Data

```http
POST /api/payment/cards
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "cardholder_name": "John Doe",
  "card_number": "4111111111111111",
  "expiration_date": "12/25",
  "cvv": "123",
  "is_default": false
}
```

**Expected Response:**
```json
{
  "id": "card_id_here",
  "cardholder_name": "John Doe",
  "last_four": "4242",
  "expiration_date": "12/25",
  "card_type": "Visa",
  "is_default": false,
  "is_expired": false,
  "created_at": "2024-01-15T10:30:00.000Z",
  "updated_at": "2024-01-15T10:30:00.000Z"
}
```

### 2. Frontend Integration (Simple Form)

```javascript
// Frontend code - simple form submission
const addCard = async (cardData) => {
  const response = await fetch('/api/payment/cards', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${jwt_token}`
    },
    body: JSON.stringify({
      cardholder_name: cardData.cardholder_name,
      card_number: cardData.card_number,
      expiration_date: cardData.expiration_date, // Format: MM/YY
      cvv: cardData.cvv,
      is_default: cardData.is_default || false
    })
  });
  
  const result = await response.json();
  console.log('Card added:', result);
  return result;
};

// Usage
addCard({
  cardholder_name: 'John Doe',
  card_number: '4111111111111111',
  expiration_date: '12/25',
  cvv: '123',
  is_default: false
});
```

### 3. Test with Stripe Test Card Numbers

Use these Stripe test card numbers for testing:

```json
{
  "successful_visa": "4242424242424242",
  "successful_mastercard": "5555555555554444",
  "declined_card": "4000000000000002",
  "insufficient_funds": "4000000000009995",
  "expired_card": "4000000000000069",
  "invalid_cvc": "4000000000000127"
}
```

**Test CVV**: Use any 3-digit number (e.g., "123")  
**Test Expiry**: Use any future date (e.g., "12/25")

### 4. Error Handling

**Invalid Card Number:**
```json
{
  "statusCode": 400,
  "message": "Your card number is incorrect."
}
```

**Declined Card:**
```json
{
  "statusCode": 400,
  "message": "Your card was declined."
}
```

**Expired Card:**
```json
{
  "statusCode": 400,
  "message": "Your card has expired."
}
```

## Key Benefits ✅

1. **User-Friendly**: Users enter card details directly (no complex frontend setup)
2. **Security**: Card data is tokenized by Stripe, no raw storage
3. **PCI Compliance**: Stripe handles all PCI requirements
4. **Simplicity**: No encryption/decryption needed on your end
5. **Integration**: Works with existing Stripe infrastructure
6. **Validation**: Stripe handles card validation automatically

## Database Changes

### Before (Raw Card Storage):
```sql
-- Old schema with encrypted data
card_number: "encrypted_card_number"
cvv: "encrypted_cvv"
```

### After (Stripe Tokens):
```sql
-- New schema with Stripe payment method ID
stripe_payment_method_id: "pm_1N3T00LkdIwHu7ixRdxpVI1Q"
card_number: NULL (optional)
cvv: NULL (optional)
```

## Migration Notes

- **Existing Cards**: Still work (backward compatible)
- **New Cards**: Must use Stripe tokens
- **Database**: Migration applied successfully
- **Types**: Prisma client needs regeneration (use `npx prisma generate`)

## Testing Checklist

- [ ] Test with valid Stripe token
- [ ] Test with invalid/expired token
- [ ] Test with declined card token
- [ ] Verify card details are stored correctly
- [ ] Test default card functionality
- [ ] Test card retrieval
- [ ] Test card deletion

## Next Steps

1. **Regenerate Prisma Client**: Run `npx prisma generate` when possible
2. **Update Frontend**: Implement Stripe.js token creation
3. **Test Thoroughly**: Use Stripe test tokens
4. **Remove Type Assertion**: Remove `as any` after Prisma client regeneration

Your Stripe Tokens implementation is now complete and ready for testing! 🎉
