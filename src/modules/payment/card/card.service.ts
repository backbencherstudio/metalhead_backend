import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateCardDto, CardResponseDto, UpdateCardDto } from './dto';
import * as crypto from 'crypto';

@Injectable()
export class CardService {
  private readonly encryptionKey = process.env.CARD_ENCRYPTION_KEY || 'your-32-character-secret-key-here!'; // Change this in production

  constructor(private prisma: PrismaService) {}

  /**
   * Add a new card for a user
   */
  async addCard(userId: string, createCardDto: CreateCardDto): Promise<CardResponseDto> {
    // First, verify the user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found. Please ensure you're logged in with a valid account.`);
    }

    console.log(`Adding card for user: ${user.email} (${userId})`);

    // Validate card number using Luhn algorithm
    if (!this.validateCardNumber(createCardDto.card_number)) {
      throw new BadRequestException('Invalid card number');
    }

    // Check if card is expired
    if (this.isCardExpired(createCardDto.expiration_date)) {
      throw new BadRequestException('Card has already expired');
    }

    // Encrypt sensitive data
    const encryptedCardNumber = this.encrypt(createCardDto.card_number);
    const encryptedCvv = this.encrypt(createCardDto.cvv);
    const lastFour = createCardDto.card_number.slice(-4);
    const cardType = this.getCardType(createCardDto.card_number);

    return await this.prisma.$transaction(async (tx) => {
      // If setting as default, unset other default cards
      if (createCardDto.is_default) {
        await tx.userCard.updateMany({
          where: { user_id: userId, is_default: true },
          data: { is_default: false },
        });
      }

      // Create the new card
      const card = await tx.userCard.create({
        data: {
          user_id: userId,
          cardholder_name: createCardDto.cardholder_name,
          card_number: encryptedCardNumber,
          expiration_date: createCardDto.expiration_date,
          cvv: encryptedCvv,
          card_type: cardType,
          last_four: lastFour,
          is_default: createCardDto.is_default || false,
          is_expired: false,
        },
      });

      return this.mapToResponseDto(card);
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
   * Validate card number using Luhn algorithm
   */
  private validateCardNumber(cardNumber: string): boolean {
    const digits = cardNumber.replace(/\D/g, '');
    let sum = 0;
    let isEven = false;

    for (let i = digits.length - 1; i >= 0; i--) {
      let digit = parseInt(digits[i]);

      if (isEven) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }

      sum += digit;
      isEven = !isEven;
    }

    return sum % 10 === 0;
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
   * Encrypt sensitive data
   */
  private encrypt(text: string): string {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Combine IV and encrypted data
    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * Decrypt sensitive data
   */
  private decrypt(encryptedText: string): string {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
    
    // Split IV and encrypted data
    const parts = encryptedText.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
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
