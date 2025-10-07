# Stripe + NestJS Implementation Guide

## 🏗️ Architecture Overview

Your card system uses a **hybrid approach** combining:
- **NestJS** (Backend Framework) - 70% of the implementation
- **Stripe npm package** (Payment Processing) - 30% of the implementation

## 📁 File Structure & Responsibilities

### **NestJS Components (70%)**

#### 1. **DTOs (Data Transfer Objects)**
```typescript
// src/modules/payment/card/dto/create-card.dto.ts
export class CreateCardDto {
  @ApiProperty() // NestJS Swagger decorator
  @IsNotEmpty()  // NestJS validation decorator
  @IsString()    // NestJS validation decorator
  cardholder_name: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  stripe_token: string; // Stripe token ID

  @ApiProperty()
  @IsOptional()
  is_default?: boolean;
}
```
**Purpose**: Define API contract, validation rules, and Swagger documentation

#### 2. **Controllers (API Endpoints)**
```typescript
// src/modules/payment/card/card.controller.ts
@Controller('payment/cards') // NestJS routing
@UseGuards(JwtAuthGuard)     // NestJS authentication
export class CardController {
  @Post()                    // NestJS HTTP method decorator
  @ApiOperation()           // NestJS Swagger decorator
  async addCard(
    @Body() createCardDto: CreateCardDto,  // NestJS parameter decorator
    @Req() req: Request,                   // NestJS request decorator
  ): Promise<CardResponseDto> {
    const userId = req.user.userId;
    return this.cardService.addCard(userId, createCardDto);
  }
}
```
**Purpose**: Handle HTTP requests, authentication, validation, and routing

#### 3. **Services (Business Logic)**
```typescript
// src/modules/payment/card/card.service.ts
@Injectable() // NestJS dependency injection
export class CardService {
  constructor(private prisma: PrismaService) {} // NestJS DI

  async addCard(userId: string, createCardDto: CreateCardDto) {
    // 1. NestJS: Database operations with Prisma
    const user = await this.prisma.user.findUnique({
      where: { id: userId }
    });

    // 2. Stripe: Create payment method from token
    const paymentMethod = await StripePayment.createPaymentMethodFromToken({
      token_id: createCardDto.stripe_token,
      customer_id: customerId,
    });

    // 3. NestJS: Save to database
    const cardRecord = await this.prisma.userCard.create({
      data: { /* card data */ }
    });

    return this.mapToResponseDto(cardRecord);
  }
}
```
**Purpose**: Business logic, database operations, and orchestration

#### 4. **Guards (Authentication)**
```typescript
// src/modules/auth/guards/jwt-auth.guard.ts
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    // NestJS: JWT validation logic
    return super.canActivate(context);
  }
}
```
**Purpose**: Authentication and authorization

#### 5. **Modules (Dependency Injection)**
```typescript
// src/modules/payment/card/card.module.ts
@Module({
  imports: [PrismaModule],
  controllers: [CardController],
  providers: [CardService],
  exports: [CardService],
})
export class CardModule {}
```
**Purpose**: Dependency injection container and module organization

### **Stripe npm Package (30%)**

#### 1. **Stripe Helper Class**
```typescript
// src/common/lib/Payment/stripe/StripePayment.ts
import stripe from 'stripe'; // Stripe npm package

const Stripe = new stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2025-03-31.basil',
});

export class StripePayment {
  // Stripe: Create customer
  static async createCustomer({ user_id, name, email }) {
    return Stripe.customers.create({
      metadata: { user_id },
      name,
      email,
    });
  }

  // Stripe: Create payment method from token
  static async createPaymentMethodFromToken({ token_id, customer_id }) {
    const token = await Stripe.tokens.retrieve(token_id); // Stripe API
    const paymentMethod = await Stripe.paymentMethods.create({ // Stripe API
      type: 'card',
      card: { token: token_id },
    });
    await Stripe.paymentMethods.attach(paymentMethod.id, { // Stripe API
      customer: customer_id,
    });
    return paymentMethod;
  }
}
```
**Purpose**: Stripe API interactions, payment processing

## 🔄 Data Flow

### **1. User Request Flow**
```
Frontend → NestJS Controller → NestJS Guard → NestJS Service → Stripe API → Database
```

### **2. Detailed Step-by-Step**

#### **Step 1: Request Reception (NestJS)**
```typescript
@Post()
async addCard(@Body() createCardDto: CreateCardDto, @Req() req: Request) {
  // NestJS handles:
  // - HTTP request parsing
  // - DTO validation
  // - Authentication via Guard
  // - Parameter extraction
}
```

#### **Step 2: Authentication (NestJS)**
```typescript
@UseGuards(JwtAuthGuard)
// NestJS Guard:
// - Extracts JWT from Authorization header
// - Validates JWT signature
// - Sets req.user with user data
```

#### **Step 3: Business Logic (NestJS + Stripe)**
```typescript
async addCard(userId: string, createCardDto: CreateCardDto) {
  // NestJS: Database lookup
  const user = await this.prisma.user.findUnique({ where: { id: userId } });
  
  // Stripe: Create customer if needed
  let customerId = user.billing_id;
  if (!customerId) {
    const customer = await StripePayment.createCustomer({...});
    customerId = customer.id;
  }
  
  // Stripe: Create payment method
  const paymentMethod = await StripePayment.createPaymentMethodFromToken({
    token_id: createCardDto.stripe_token,
    customer_id: customerId,
  });
  
  // NestJS: Save to database
  const cardRecord = await this.prisma.userCard.create({...});
  
  return this.mapToResponseDto(cardRecord);
}
```

#### **Step 4: Response (NestJS)**
```typescript
// NestJS automatically:
// - Serializes response to JSON
// - Sets appropriate HTTP status codes
// - Handles errors and exceptions
```

## 🎯 Key Integration Points

### **1. Stripe Token Handling**
```typescript
// NestJS DTO accepts Stripe token
stripe_token: string; // "tok_visa" or real token ID

// Stripe npm package processes token
const token = await Stripe.tokens.retrieve(token_id);
const paymentMethod = await Stripe.paymentMethods.create({
  card: { token: token_id }
});
```

### **2. Customer Management**
```typescript
// NestJS: Check if user has Stripe customer
const user = await this.prisma.user.findUnique({
  select: { billing_id: true } // Stripe customer ID
});

// Stripe: Create customer if needed
if (!user.billing_id) {
  const customer = await Stripe.customers.create({
    metadata: { user_id: userId },
    name: cardholder_name,
    email: user.email,
  });
}
```

### **3. Payment Method Storage**
```typescript
// Stripe: Create payment method
const paymentMethod = await Stripe.paymentMethods.create({...});

// NestJS: Store payment method ID (not card data)
await this.prisma.userCard.create({
  data: {
    stripe_payment_method_id: paymentMethod.id, // Stripe reference
    cardholder_name: createCardDto.cardholder_name,
    last_four: paymentMethod.card.last4,
    card_type: paymentMethod.card.brand,
    // No raw card data stored!
  }
});
```

## 🔧 Configuration

### **Environment Variables**
```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# NestJS Configuration
JWT_SECRET=your-jwt-secret
DATABASE_URL=postgresql://...
```

### **Module Imports**
```typescript
// NestJS modules
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

// Stripe package
import stripe from 'stripe';
```

## 📊 Responsibility Breakdown

| Component | NestJS | Stripe | Purpose |
|-----------|--------|--------|---------|
| **API Endpoints** | ✅ 100% | ❌ 0% | HTTP routing, validation |
| **Authentication** | ✅ 100% | ❌ 0% | JWT validation, guards |
| **Database Operations** | ✅ 100% | ❌ 0% | User/card data storage |
| **Business Logic** | ✅ 70% | ❌ 30% | Orchestration, validation |
| **Payment Processing** | ❌ 0% | ✅ 100% | Token creation, payment methods |
| **Customer Management** | ❌ 0% | ✅ 100% | Stripe customer creation |
| **Error Handling** | ✅ 80% | ❌ 20% | HTTP errors, Stripe error mapping |
| **Response Formatting** | ✅ 100% | ❌ 0% | API response structure |

## 🎓 Key Learning Points

### **NestJS Strengths:**
- **Dependency Injection**: Automatic service injection
- **Decorators**: Clean, declarative code
- **Guards**: Centralized authentication
- **DTOs**: Type-safe validation
- **Modules**: Organized architecture

### **Stripe npm Package Strengths:**
- **Type Safety**: Full TypeScript support
- **API Coverage**: All Stripe features available
- **Error Handling**: Detailed error information
- **Webhooks**: Real-time event processing

### **Integration Benefits:**
- **Security**: No raw card data in your database
- **Compliance**: Stripe handles PCI requirements
- **Scalability**: Stripe handles payment processing
- **Maintainability**: Clear separation of concerns

## 🚀 Best Practices Implemented

1. **Separation of Concerns**: NestJS handles API, Stripe handles payments
2. **Security**: No raw card data storage
3. **Type Safety**: Full TypeScript coverage
4. **Error Handling**: Proper exception mapping
5. **Validation**: Input validation at multiple layers
6. **Documentation**: Swagger/OpenAPI integration
7. **Testing**: Debug endpoints for development

This architecture gives you the best of both worlds: NestJS's excellent API framework with Stripe's robust payment processing! 🎉
