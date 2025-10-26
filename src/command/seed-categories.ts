import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const categories = [
  {
    name: 'cleaning',
    label: 'Cleaning Services',
    status: 1,
  },
  {
    name: 'plumbing',
    label: 'Plumbing Services',
    status: 1,
  },
  {
    name: 'electrical',
    label: 'Electrical Services',
    status: 1,
  },
  {
    name: 'carpentry',
    label: 'Carpentry Services',
    status: 1,
  },
  {
    name: 'painting',
    label: 'Painting Services',
    status: 1,
  },
  {
    name: 'gardening',
    label: 'Gardening & Landscaping',
    status: 1,
  },
  {
    name: 'moving',
    label: 'Moving & Hauling',
    status: 1,
  },
  {
    name: 'appliance',
    label: 'Appliance Repair',
    status: 1,
  },
  {
    name: 'hvac',
    label: 'HVAC Services',
    status: 1,
  },
  {
    name: 'handyman',
    label: 'Handyman Services',
    status: 1,
  },
];

async function seedCategories() {
  try {
    console.log('Seeding categories...');

    for (const category of categories) {
      await prisma.category.upsert({
        where: { name: category.name },
        update: category,
        create: category,
      });
      console.log(`✓ Seeded: ${category.label}`);
    }

    console.log('\n✅ Categories seeded successfully!');
  } catch (error) {
    console.error('❌ Error seeding categories:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seedCategories();

