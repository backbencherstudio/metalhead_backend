import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateCardDto, CardResponseDto, UpdateCardDto } from './dto';
import { StripePayment } from 'src/common/lib/Payment/stripe/StripePayment';
import stripe from 'stripe';

@Injectable()
export class CardService {

  constructor(private prisma: PrismaService) {}

  /**
   * Add a new card for a user
   */
  async addCard(userId: string, createCardDto: CreateCardDto): Promise<CardResponseDto> {
    // 1. Verify user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, billing_id: true },
    });
  
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }
  
    // 2. Get or create Stripe customer
    let customerId = user.billing_id;
    if (!customerId) {
      const customer = await StripePayment.createCustomer({
        user_id: userId,
        name: createCardDto.cardholder_name,
        email: user.email,
      });
      customerId = customer.id;
      
      // Update user with customer ID
      await this.prisma.user.update({
        where: { id: userId },
        data: { billing_id: customerId },
      });
    }
  
    // 3. Create payment method from token (test tokens or real tokens)
    const paymentMethod = await StripePayment.createPaymentMethodFromToken({
      token_id: createCardDto.stripe_token,
      customer_id: customerId,
      billing_details: {
        name: createCardDto.cardholder_name,
        email: user.email,
      },
    });
  
    // 6. Get card details from payment method
    const card = paymentMethod.card as stripe.PaymentMethod.Card;
    const lastFour = card.last4;
    const cardType = card.brand;
    const expMonth = card.exp_month;
    const expYear = card.exp_year;
  
    return await this.prisma.$transaction(async (tx) => {
      // If setting as default, unset other default cards
      if (createCardDto.is_default) {
        await tx.userCard.updateMany({
          where: { user_id: userId, is_default: true },
          data: { is_default: false },
        });
      }
  
      // Create the new card record
      const cardRecord = await tx.userCard.create({
        data: {
          user_id: userId,
          cardholder_name: createCardDto.cardholder_name,
          stripe_payment_method_id: paymentMethod.id, // Store Stripe payment method ID
          card_type: cardType,
          last_four: lastFour,
          expiration_date: `${expMonth}/${expYear}`,
          is_default: createCardDto.is_default || false,
          is_expired: false,
        } as any, // Type assertion until Prisma client is regenerated
      });
  
      return this.mapToResponseDto(cardRecord);
    });
  }
  /**
   * Get all cards for a user
   */
  async getUserCards(userId: string): Promise<CardResponseDto[]> {
    const cards = await this.prisma.userCard.findMany({
      where: {
        user_id: userId,
        status: 1,
        deleted_at: null,
      },
      orderBy: [
        { is_default: 'desc' },
        { created_at: 'desc' },
      ],
    });

    return cards.map(card => this.mapToResponseDto(card));
  }

  /**
   * Get a specific card by ID
   */
  async getCardById(userId: string, cardId: string): Promise<CardResponseDto> {
    const card = await this.prisma.userCard.findFirst({
      where: {
        id: cardId,
        user_id: userId,
        status: 1,
        deleted_at: null,
      },
    });

    if (!card) {
      throw new NotFoundException('Card not found');
    }

    return this.mapToResponseDto(card);
  }

  /**
   * Update card (mainly for setting as default)
   */
  async updateCard(userId: string, cardId: string, updateCardDto: UpdateCardDto): Promise<CardResponseDto> {
    const card = await this.prisma.userCard.findFirst({
      where: {
        id: cardId,
        user_id: userId,
        status: 1,
        deleted_at: null,
      },
    });

    if (!card) {
      throw new NotFoundException('Card not found');
    }

    return await this.prisma.$transaction(async (tx) => {
      // If setting as default, unset other default cards
      if (updateCardDto.is_default) {
        await tx.userCard.updateMany({
          where: { user_id: userId, is_default: true },
          data: { is_default: false },
        });
      }

      // Update the card
      const updatedCard = await tx.userCard.update({
        where: { id: cardId },
        data: updateCardDto,
      });

      return this.mapToResponseDto(updatedCard);
    });
  }

  /**
   * Delete a card
   */
  async deleteCard(userId: string, cardId: string): Promise<{ message: string }> {
    const card = await this.prisma.userCard.findFirst({
      where: {
        id: cardId,
        user_id: userId,
        status: 1,
        deleted_at: null,
      },
    });

    if (!card) {
      throw new NotFoundException('Card not found');
    }

    // Soft delete the card
    await this.prisma.userCard.update({
      where: { id: cardId },
      data: {
        deleted_at: new Date(),
        status: 0,
      },
    });

    return { message: 'Card deleted successfully' };
  }

  /**
   * Set a card as default
   */
  async setDefaultCard(userId: string, cardId: string): Promise<CardResponseDto> {
    return this.updateCard(userId, cardId, { is_default: true });
  }

  /**
   * Check and remove expired cards
   */
  async checkAndRemoveExpiredCards(userId: string): Promise<{ expiredCards: number; message: string }> {
    const cards = await this.prisma.userCard.findMany({
      where: {
        user_id: userId,
        status: 1,
        deleted_at: null,
      },
    });

    let expiredCount = 0;

    for (const card of cards) {
      if (this.isCardExpired(card.expiration_date)) {
        await this.prisma.userCard.update({
          where: { id: card.id },
          data: {
            is_expired: true,
            deleted_at: new Date(),
            status: 0,
          },
        });
        expiredCount++;
      }
    }

    return {
      expiredCards: expiredCount,
      message: expiredCount > 0 ? `${expiredCount} expired cards removed` : 'No expired cards found',
    };
  }

  /**
   * Get expired cards for a user
   */
  async getExpiredCards(userId: string): Promise<CardResponseDto[]> {
    const cards = await this.prisma.userCard.findMany({
      where: {
        user_id: userId,
        status: 1,
        deleted_at: null,
      },
    });

    const expiredCards = cards.filter(card => this.isCardExpired(card.expiration_date));
    return expiredCards.map(card => this.mapToResponseDto(card));
  }


  /**
   * Check if card is expired
   */
  private isCardExpired(expirationDate: string): boolean {
    const [month, year] = expirationDate.split('/');
    const expDate = new Date(2000 + parseInt(year), parseInt(month) - 1);
    const currentDate = new Date();
    
    return expDate < currentDate;
  }

  /**
   * Get card type based on card number
   */
  private getCardType(cardNumber: string): string {
    const firstDigit = cardNumber[0];
    const firstTwoDigits = cardNumber.substring(0, 2);

    if (firstDigit === '4') return 'Visa';
    if (firstTwoDigits >= '51' && firstTwoDigits <= '55') return 'MasterCard';
    if (firstTwoDigits === '34' || firstTwoDigits === '37') return 'American Express';
    if (firstTwoDigits === '65' || firstTwoDigits === '60') return 'Discover';
    
    return 'Unknown';
  }


  /**
   * Map database card to response DTO
   */
  private mapToResponseDto(card: any): CardResponseDto {
    return {
      id: card.id,
      cardholder_name: card.cardholder_name,
      last_four: card.last_four,
      expiration_date: card.expiration_date,
      card_type: card.card_type,
      is_default: card.is_default,
      is_expired: card.is_expired,
      created_at: card.created_at,
      updated_at: card.updated_at,
    };
  }
}
