import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const categories = [
  {
    name: 'cleaning',
    label: 'Cleaning Services',
    category_status: 1,
  },
  {
    name: 'delivery',
    label: 'Delivery Services',
    category_status: 1,
  },
  {
    name: 'grocery_pickup',
    label: 'Grocery Pickup',
    category_status: 1,
  },
  {
    name: 'yard_work',
    label: 'Yard Work',
    category_status: 1,
  },
  {
    name: 'plumbing',
    label: 'Plumbing Services',
    category_status: 1,
  },
  {
    name: 'electrical',
    label: 'Electrical Services',
    category_status: 1,
  },
  {
    name: 'carpentry',
    label: 'Carpentry Services',
    category_status: 1,
  },
  {
    name: 'painting',
    label: 'Painting Services',
    category_status: 1,
  },
  {
    name: 'gardening',
    label: 'Gardening & Landscaping',
    category_status: 1,
  },
  {
    name: 'moving',
    label: 'Moving & Hauling',
    category_status: 1,
  },
  {
    name: 'furniture_moving',
    label: 'Furniture Moving',
    category_status: 1,
  },
  {
    name: 'appliance',
    label: 'Appliance Repair',
    category_status: 1,
  },
  {
    name: 'hvac',
    label: 'HVAC Services',
    category_status: 1,
  },
  {
    name: 'handyman',
    label: 'Handyman Services',
    category_status: 1,
  },
  {
    name: 'pet_care',
    label: 'Pet Care',
    category_status: 1,
  },
  {
    name: 'errands_shopping',
    label: 'Errands & Shopping',
    category_status: 1,
  },
  {
    name: 'assembly_installation',
    label: 'Assembly & Installation',
    category_status: 1,
  },
  {
    name: 'event_setup',
    label: 'Event Setup',
    category_status: 1,
  },
  {
    name: 'personal_assistance',
    label: 'Personal Assistance',
    category_status: 1,
  },
  {
    name: 'tech_setup_repair',
    label: 'Technology Setup & Repair',
    category_status: 1,
  },
  {
    name: 'car_services',
    label: 'Car Services',
    category_status: 1,
  },
  {
    name: 'house_sitting',
    label: 'House Sitting',
    category_status: 1,
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

