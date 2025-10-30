import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiResponse,
} from '@nestjs/swagger';
import { CardService } from './card.service';
import { CreateCardDto, CardResponseDto, UpdateCardDto } from './dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Request } from 'express';

@ApiBearerAuth()
@ApiTags('User Cards')
@UseGuards(JwtAuthGuard)
@Controller('payment/cards')
export class CardController {
  constructor(private readonly cardService: CardService) {}

  @ApiOperation({ summary: 'Add a new card' })
  @ApiResponse({
    status: 201,
    description: 'Card added successfully',
    type: CardResponseDto,
  })
  @Post()
  async addCard(
    @Body() createCardDto: CreateCardDto,
    @Req() req: Request,
  ): Promise<CardResponseDto> {
    const userId = (req as any).user.userId || (req as any).user.id;
    return this.cardService.addCard(userId, createCardDto);
  }


  @Get()
  async getUserCards(@Req() req: Request): Promise<CardResponseDto[]> {
    const userId = (req as any).user.userId || (req as any).user.id;
    return this.cardService.getUserCards(userId);
  }

  @Patch('set-default/:id')
  async setDefaultCard(
    @Param('id') cardId: string,
    @Req() req: Request,
  ): Promise<CardResponseDto> {
    const userId = (req as any).user.userId || (req as any).user.id;
    return this.cardService.setDefaultCard(userId, cardId);
  }

 
  @Get(':id')
  async getCardById(
    @Param('id') cardId: string,
    @Req() req: Request,
  ): Promise<CardResponseDto> {
    const userId = (req as any).user.userId || (req as any).user.id;
    return this.cardService.getCardById(userId, cardId);
  }

  @ApiOperation({ summary: 'Update card (mainly for setting as default)' })
  @ApiResponse({
    status: 200,
    description: 'Card updated successfully',
    type: CardResponseDto,
  })
  @Patch(':id')
  async updateCard(
    @Param('id') cardId: string,
    @Body() updateCardDto: UpdateCardDto,
    @Req() req: Request,
  ): Promise<CardResponseDto> {
    const userId = (req as any).user.userId || (req as any).user.id;
    return this.cardService.updateCard(userId, cardId, updateCardDto);
  }

  @ApiOperation({ summary: 'Delete a card' })
  @ApiResponse({ status: 200, description: 'Card deleted successfully' })
  @Delete(':id')
  async deleteCard(
    @Param('id') cardId: string,
    @Req() req: Request,
  ): Promise<{ message: string }> {
    const userId = (req as any).user.userId || (req as any).user.id;
    return this.cardService.deleteCard(userId, cardId);
  }

  @ApiOperation({ summary: 'Check and remove expired cards' })
  @ApiResponse({
    status: 200,
    description: 'Expired cards checked and removed',
  })
  @Post('check-expired')
  async checkAndRemoveExpiredCards(
    @Req() req: Request,
  ): Promise<{ expiredCards: number; message: string }> {
    const userId = (req as any).user.userId || (req as any).user.id;
    return this.cardService.checkAndRemoveExpiredCards(userId);
  }

  @ApiOperation({ summary: 'Get expired cards' })
  @ApiResponse({
    status: 200,
    description: 'Expired cards retrieved',
    type: [CardResponseDto],
  })
  @Get('expired/list')
  async getExpiredCards(@Req() req: Request): Promise<CardResponseDto[]> {
    const userId = (req as any).user.userId || (req as any).user.id;
    return this.cardService.getExpiredCards(userId);
  }
}
