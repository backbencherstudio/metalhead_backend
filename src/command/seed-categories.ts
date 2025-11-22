import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const categories = [
  {
    name: 'cleaning',
    label: 'Cleaning Services',
    category_status: 1,
    icon: 'cleaning-bucket.svg',
  },
  {
    name: 'delivery',
    label: 'Delivery Services',
    category_status: 1,
    icon: 'van.svg',
  },
  {
    name: 'grocery_pickup',
    label: 'Grocery Pickup',
    category_status: 1,
    icon: 'shopping-bag-01.svg',
  },
  {
    name: 'yard_work',
    label: 'Yard Work',
    category_status: 1,
    icon: 'flower-pot.svg',
  },
  {
    name: 'plumbing',
    label: 'Plumbing Services',
    category_status: 1,
    icon: 'wrench-01.svg',
  },
  {
    name: 'electrical',
    label: 'Electrical Services',
    category_status: 1,
    icon: 'tools.svg',
  },
  {
    name: 'carpentry',
    label: 'Carpentry Services',
    category_status: 1,
    icon: 'Frame.svg',
  },
  {
    name: 'painting',
    label: 'Painting Services',
    category_status: 1,
    icon: 'Frame.svg',
  },
  {
    name: 'gardening',
    label: 'Gardening & Landscaping',
    category_status: 1,
    icon: 'flower-pot.svg',
  },
  {
    name: 'moving',
    label: 'Moving & Hauling',
    category_status: 1,
    icon: 'package-moving-01.svg',
  },
  {
    name: 'furniture_moving',
    label: 'Furniture Moving',
    category_status: 1,
    icon: 'package.svg',
  },
  {
    name: 'appliance',
    label: 'Appliance Repair',
    category_status: 1,
    icon: 'tools.svg',
  },
  {
    name: 'hvac',
    label: 'HVAC Services',
    category_status: 1,
    icon: 'Frame.svg',
  },
  {
    name: 'handyman',
    label: 'Handyman Services',
    category_status: 1,
    icon: 'home-01.svg',
  },
  {
    name: 'pet_care',
    label: 'Pet Care',
    category_status: 1,
    icon: 'Frame.svg',
  },
  {
    name: 'errands_shopping',
    label: 'Errands & Shopping',
    category_status: 1,
    icon: 'shopping-bag-01.svg',
  },
  {
    name: 'assembly_installation',
    label: 'Assembly & Installation',
    category_status: 1,
    icon: 'Frame.svg',
  },
  {
    name: 'event_setup',
    label: 'Event Setup',
    category_status: 1,
    icon:'calendar-04.svg',
  },
  {
    name: 'personal_assistance',
    label: 'Personal Assistance',
    category_status: 1,
    icon: 'user.svg',
  },
  {
    name: 'tech_setup_repair',
    label: 'Technology Setup & Repair',
    category_status: 1,
    icon: 'laptop.svg',
  },
  {
    name: 'car_services',
    label: 'Car Services',
    category_status: 1,
    icon: 'car-05.svg',
  },
  {
    name: 'house_sitting',
    label: 'House Sitting',
    category_status: 1,
    icon: 'child.svg',
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

