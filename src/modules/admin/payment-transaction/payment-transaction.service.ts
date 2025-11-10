import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { UserRepository } from '../../../common/repository/user/user.repository';
import { TransactionQueryDto } from './dto/transaction-query.dto';

@Injectable()
export class PaymentTransactionService {
  constructor(private prisma: PrismaService) {}

  async findAll(user_id?: string) {
    try {
      const userDetails = await UserRepository.getUserDetails(user_id);

      const whereClause = {};
      if (userDetails.type == 'admin') {
        whereClause['user_id'] = user_id;
      }

      const paymentTransactions = await this.prisma.paymentTransaction.findMany(
        {
          where: {
            ...whereClause,
          },
          select: {
            id: true,
            reference_number: true,
            status: true,
            provider: true,
            amount: true,
            currency: true,
            paid_amount: true,
            paid_currency: true,
            created_at: true,
            updated_at: true,
          },
        },
      );

      return {
        success: true,
        data: paymentTransactions,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async findOne(id: string, user_id?: string) {
    try {
      const userDetails = await UserRepository.getUserDetails(user_id);

      const whereClause = {};
      if (userDetails.type == 'vendor') {
        whereClause['user_id'] = user_id;
      }

      const paymentTransaction =
        await this.prisma.paymentTransaction.findUnique({
          where: {
            id: id,
            ...whereClause,
          },
          select: {
            id: true,
            reference_number: true,
            status: true,
            provider: true,
            amount: true,
            currency: true,
            paid_amount: true,
            paid_currency: true,
            created_at: true,
            updated_at: true,
          },
        });

      if (!paymentTransaction) {
        return {
          success: false,
          message: 'Payment transaction not found',
        };
      }

      return {
        success: true,
        data: paymentTransaction,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async remove(id: string, user_id?: string) {
    try {
      const userDetails = await UserRepository.getUserDetails(user_id);

      const whereClause = {};
      if (userDetails.type == 'vendor') {
        whereClause['user_id'] = user_id;
      }

      const paymentTransaction =
        await this.prisma.paymentTransaction.findUnique({
          where: {
            id: id,
            ...whereClause,
          },
        });

      if (!paymentTransaction) {
        return {
          success: false,
          message: 'Payment transaction not found',
        };
      }

      await this.prisma.paymentTransaction.delete({
        where: {
          id: id,
        },
      });

      return {
        success: true,
        message: 'Payment transaction deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async getTransactionsWithFilters(query: TransactionQueryDto) {
    try {
      const { type } = query;

      // 🧩 Step 1: Fetch jobs (with allowed statuses)
      const jobTransactions = await this.prisma.job.findMany({
        where: {
          job_status: {
            in: ['confirmed', 'ongoing', 'completed', 'paid', 'cancelled'],
          },
          deleted_at: null,
        },
        select: {
          id: true,
          title: true,
          price: true,
          final_price: true,
          payment_type: true,
          job_status: true,
          created_at: true,
          updated_at: true,
        },
      });

      const jobIds = jobTransactions.map(job => job.id);

      // 🧩 Step 2: Build transaction filter
      const transactionWhere: any = {
        order_id: { in: jobIds },
      };

      if (type && type.length > 0) {
        transactionWhere.type = { in: type };
      }

      // 🧩 Step 3: Fetch transactions
      const transactionData = await this.prisma.paymentTransaction.findMany({
        where: transactionWhere,
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          order_id: true,
          reference_number: true,
          status: true,
          provider: true,
          amount: true,
          currency: true,
          paid_amount: true,
          paid_currency: true,
          created_at: true,
          updated_at: true,
          type: true,
          withdraw_via: true,
        },
      });

      // 🧩 Step 4: Attach transactions to their jobs
      const mapped = jobTransactions
        .map(job => ({
          ...job,
          transactions: transactionData.filter(t => t.order_id === job.id),
        }))
        .filter(job => job.transactions.length > 0);

      // ✅ Step 5: Return response
      return {
        success: true,
        total: mapped.length,
        data: mapped,
      };
    } catch (error) {
      console.error('Error in getTransactionsWithFilters:', error);
      return {
        success: false,
        message: error.message,
      };
    }
  }
  
}
