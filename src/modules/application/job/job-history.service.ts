import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { JobHistoryFiltersDto, SortBy } from './dto/job-history-filters.dto';
import { SojebStorage } from '../../../common/lib/Disk/SojebStorage';

// Export the filters type for the controller
export type JobHistoryFilters = JobHistoryFiltersDto;

@Injectable()
export class JobHistoryService {
  constructor(private prisma: PrismaService) {}

  async getUserJobHistory(filters: JobHistoryFilters) {
    if (!filters.userId) {
      throw new NotFoundException('User ID is required');
    }

    const where = this.buildWhereClause(filters);
    where.user_id = filters.userId;

    const [jobs, total] = await Promise.all([
      this.getJobsWithPagination(where, filters),
      this.prisma.job.count({ where })
    ]);

    return this.formatResponse(jobs, total, filters);
  }

  async getHelperJobHistory(filters: JobHistoryFilters) {
    if (!filters.helperId) {
      throw new NotFoundException('Helper ID is required');
    }

    // Get jobs where the helper has accepted offers
    const where = {
      accepted_offers: {
        some: {
          counter_offer: {
            helper_id: filters.helperId
          }
        }
      },
      deleted_at: null,
      status: 1
    };

    // Apply additional filters
    const additionalFilters = this.buildWhereClause(filters);
    Object.assign(where, additionalFilters);

    const [jobs, total] = await Promise.all([
      this.getJobsWithPagination(where, filters),
      this.prisma.job.count({ where })
    ]);

    return this.formatResponse(jobs, total, filters);
  }

  async getNearestJobs(filters: JobHistoryFilters) {
    if (!filters.userLatitude || !filters.userLongitude) {
      throw new NotFoundException('User location coordinates are required for nearest jobs');
    }

    const where = this.buildWhereClause(filters);
    where.latitude = { not: null };
    where.longitude = { not: null };

    const jobs = await this.getJobsWithPagination(where, filters, false);
    
    // Calculate distances and filter by maxDistanceKm
    const jobsWithDistance = jobs.map(job => ({
      ...job,
      distance: this.calculateDistance(
        filters.userLatitude!,
        filters.userLongitude!,
        job.latitude,
        job.longitude
      )
    }));

    const maxDistance = filters.maxDistanceKm || 50;
    const filteredJobs = jobsWithDistance.filter(job => job.distance <= maxDistance);

    // Sort by distance
    filteredJobs.sort((a, b) => a.distance - b.distance);

    // Apply pagination after filtering
    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const skip = (page - 1) * limit;
    const paginatedJobs = filteredJobs.slice(skip, skip + limit);

    return {
      jobs: paginatedJobs.map(job => this.mapToResponseDto(job)),
      total: filteredJobs.length,
      page,
      limit,
      totalPages: Math.ceil(filteredJobs.length / limit)
    };
  }

  async getBestRatedJobs(filters: JobHistoryFilters) {
    const where = this.buildWhereClause(filters);

    const [jobs, total] = await Promise.all([
      this.getJobsWithPagination(where, filters, true, 'rating'),
      this.prisma.job.count({ where })
    ]);

    return this.formatResponse(jobs, total, filters);
  }

  async getJobsByPriceRange(filters: JobHistoryFilters) {
    if (!filters.minPrice && !filters.maxPrice) {
      throw new NotFoundException('At least one price filter (minPrice or maxPrice) is required');
    }

    const where = this.buildWhereClause(filters);

    const [jobs, total] = await Promise.all([
      this.getJobsWithPagination(where, filters),
      this.prisma.job.count({ where })
    ]);

    return this.formatResponse(jobs, total, filters);
  }

  async getJobsByStatus(filters: JobHistoryFilters) {
    if (!filters.status || filters.status.length === 0) {
      throw new NotFoundException('At least one status is required');
    }

    const where = this.buildWhereClause(filters);

    const [jobs, total] = await Promise.all([
      this.getJobsWithPagination(where, filters),
      this.prisma.job.count({ where })
    ]);

    return this.formatResponse(jobs, total, filters);
  }

  async getJobsByType(filters: JobHistoryFilters) {
    if (!filters.jobType || filters.jobType.length === 0) {
      throw new NotFoundException('At least one job type is required');
    }

    const where = this.buildWhereClause(filters);

    const [jobs, total] = await Promise.all([
      this.getJobsWithPagination(where, filters),
      this.prisma.job.count({ where })
    ]);

    return this.formatResponse(jobs, total, filters);
  }

  private buildWhereClause(filters: JobHistoryFilters): any {
    const where: any = {
      deleted_at: null,
      status: 1
    };

    // Status filter
    if (filters.status && filters.status.length > 0) {
      where.job_status = { in: filters.status };
    }

    // Job type filter
    if (filters.jobType && filters.jobType.length > 0) {
      where.job_type = { in: filters.jobType };
    }

    // Price range filter
    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
      where.price = {};
      if (filters.minPrice !== undefined) {
        where.price.gte = filters.minPrice;
      }
      if (filters.maxPrice !== undefined) {
        where.price.lte = filters.maxPrice;
      }
    }

    return where;
  }

  private async getJobsWithPagination(
    where: any, 
    filters: JobHistoryFilters, 
    includeUserRating: boolean = false,
    sortByField?: string
  ) {
    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const skip = (page - 1) * limit;

    const orderBy = this.buildOrderBy(filters.sortBy, sortByField);

    const include: any = {
      requirements: true,
      notes: true,
      user: {
        select: {
          id: true,
          name: true,
          username: true,
          email: true,
          avatar: true,
          rating: includeUserRating
        }
      },
      counter_offers: {
        include: {
          helper: {
            select: {
              id: true,
              name: true,
              avatar: true
            }
          }
        }
      },
      accepted_offers: {
        include: {
          counter_offer: {
            include: {
              helper: {
                select: {
                  id: true,
                  name: true,
                  first_name: true,
                  last_name: true,
                  email: true,
                  phone_number: true
                }
              }
            }
          }
        }
      }
    };

    return await this.prisma.job.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include
    });
  }

  private buildOrderBy(sortBy?: SortBy, sortByField?: string): any {
    if (sortByField === 'rating') {
      return { user: { rating: 'desc' } };
    }

    switch (sortBy) {
      case SortBy.DATE_NEWEST:
        return { created_at: 'desc' };
      case SortBy.DATE_OLDEST:
        return { created_at: 'asc' };
      case SortBy.PRICE_LOW_HIGH:
        return { price: 'asc' };
      case SortBy.PRICE_HIGH_LOW:
        return { price: 'desc' };
      case SortBy.RATING:
        return { user: { rating: 'desc' } };
      case SortBy.NEAREST:
        // For nearest, we'll sort by distance after calculation
        return { created_at: 'desc' };
      default:
        return { created_at: 'desc' };
    }
  }

  private formatResponse(jobs: any[], total: number, filters: JobHistoryFilters) {
    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const totalPages = Math.ceil(total / limit);

    return {
      jobs: jobs.map(job => this.mapToResponseDto(job)),
      total,
      page,
      limit,
      totalPages
    };
  }

  private mapToResponseDto(job: any) {
    const accepted = job.accepted_offers && job.accepted_offers.length ? job.accepted_offers[0] : undefined;
    const hasCounterOffers = job.counter_offers && job.counter_offers.length > 0;
    
    // Determine current status based on actual state
    let current_status = job.job_status;
    
    if (accepted) {
      current_status = 'confirmed';
    } else if (hasCounterOffers) {
      current_status = 'counter_offer';
    } else {
      current_status = 'posted';
    }

    return {
      id: job.id,
      title: job.title,
      description: job.description,
      category: job.category,
      price: job.price,
      status: current_status,
      location: job.location,
      latitude: job.latitude,
      longitude: job.longitude,
      distance: job.distance, // Will be set for nearest jobs
      created_at: job.created_at,
      updated_at: job.updated_at,
      user: {
        id: job.user.id,
        name: job.user.name,
        username: job.user.username,
        avatar: job.user.avatar ? SojebStorage.url(job.user.avatar) : null,
        rating: job.user.rating || 0
      },
      accepted_offers: accepted ? [{
        amount: Number(accepted.counter_offer.amount),
        type: accepted.counter_offer.type,
        note: accepted.counter_offer.note,
        helper: {
          id: accepted.counter_offer.helper.id,
          name: accepted.counter_offer.helper.name || 
                [accepted.counter_offer.helper.first_name, accepted.counter_offer.helper.last_name]
                  .filter(Boolean).join(' '),
          email: accepted.counter_offer.helper.email,
          phone_number: accepted.counter_offer.helper.phone_number
        }
      }] : [],
      _count: {
        counter_offers: job.counter_offers?.length || 0,
        accepted_offers: job.accepted_offers?.length || 0
      }
    };
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radius of the Earth in kilometers
    const dLat = this.degreesToRadians(lat2 - lat1);
    const dLon = this.degreesToRadians(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.degreesToRadians(lat1)) * Math.cos(this.degreesToRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private degreesToRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}