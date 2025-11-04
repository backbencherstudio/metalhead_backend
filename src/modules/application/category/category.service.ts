import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateCategoryDto, UpdateCategoryDto, CategoryResponseDto } from './dto';

@Injectable()
export class CategoryService {
  constructor(private prisma: PrismaService) {}

  async createCategory(createCategoryDto: CreateCategoryDto): Promise<CategoryResponseDto> {
    // Check if category with same name already exists
    const existingCategory = await this.prisma.category.findUnique({
      where: { name: createCategoryDto.name }
    });

    if (existingCategory) {
      throw new BadRequestException('Category with this name already exists');
    }

    const category = await this.prisma.category.create({
      data: createCategoryDto,
    });

    return this.mapToResponseDto(category);
  }

  async getAllCategories(): Promise<CategoryResponseDto[]> {
    const categories = await this.prisma.category.findMany({
      where: {
        status: 1,
        deleted_at: null,
      },
      orderBy: { label: 'asc' },
    });

    return categories.map(category => this.mapToResponseDto(category));
  }

  async getCategoriesWithCounts(): Promise<any> {
    const categories = await this.prisma.category.findMany({
      where: { status: 1, deleted_at: null },
      select: { id: true, label: true, name: true },
      orderBy: { label: 'asc' },
    });
  
    const formatted = await Promise.all(
      categories.map(async (category) => {
        const count = await this.prisma.job.count({
          where: {
            category_id: category.id,
            status: 1,
            deleted_at: null,
          },
        });
        return {
          id: category.id,
          category: category.name,
          label: category.label,
          count,
        };
      }),
    );
  
    return {
      success: true,
      message: 'Categories fetched successfully',
      data: formatted,
    };
  }
  

  async getCategoryByName(name: string): Promise<CategoryResponseDto> {
    const category = await this.prisma.category.findUnique({
      where: { name },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return this.mapToResponseDto(category);
  }

  async updateCategory(id: string, updateCategoryDto: UpdateCategoryDto): Promise<CategoryResponseDto> {
    const category = await this.prisma.category.findUnique({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    // Check if name is being changed and if new name already exists
    if (updateCategoryDto.name && updateCategoryDto.name !== category.name) {
      const existingCategory = await this.prisma.category.findUnique({
        where: { name: updateCategoryDto.name }
      });

      if (existingCategory) {
        throw new BadRequestException('Category with this name already exists');
      }
    }

    const updatedCategory = await this.prisma.category.update({
      where: { id },
      data: updateCategoryDto,
    });

    return this.mapToResponseDto(updatedCategory);
  }

  async deleteCategory(id: string): Promise<void> {
    const category = await this.prisma.category.findUnique({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    // Check if category has any jobs
    const jobCount = await this.prisma.job.count({
      where: {
        category_id: id,
        status: 1,
        deleted_at: null,
      }
    });

    if (jobCount > 0) {
      throw new BadRequestException('Cannot delete category that has associated jobs');
    }

    await this.prisma.category.update({
      where: { id },
      data: {
        deleted_at: new Date(),
        status: 0,
      },
    });
  }

  private mapToResponseDto(category: any): CategoryResponseDto {
    return {
      id: category.id,
      name: category.name,
      label: category.label,
      created_at: category.created_at,
      updated_at: category.updated_at,
    };
  }
}
